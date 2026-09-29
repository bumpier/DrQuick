import { beforeAll, beforeEach, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resetDb, useTestDb } from './helpers/db';
import { setDb, type DB } from '@/lib/db';
import { adminAuditLog, waitlistSignups } from '@/lib/db/schema';
import { findByToken, joinWaitlist, unsubscribeByToken } from '@/lib/waitlist';
import { confirmUnsubscribe } from '@/app/(site)/unsubscribe/actions';
import UnsubscribePage, { metadata } from '@/app/(site)/unsubscribe/page';
import { checkCopy } from '@/lib/compliance';

let db: DB;
beforeAll(async () => { db = await useTestDb(); });
beforeEach(async () => { setDb(db); await resetDb(db); });

const page = (token?: string) => UnsubscribePage({ searchParams: Promise.resolve(token ? { token } : {}) });

test('opening the link (the GET a mail scanner makes) changes nothing', async () => {
  const { signup } = await joinWaitlist(db, { role: 'patient', email: 'amy@example.com', source: 'hero' });
  const rendered = await page(signup.unsubscribeToken);
  expect(rendered).toBeTruthy();
  expect(await db.select().from(waitlistSignups)).toHaveLength(1);
  expect(await db.select().from(adminAuditLog)).toEqual([]);
});

test('confirming erases the person and keeps an audit row without the address', async () => {
  const { signup } = await joinWaitlist(db, { role: 'gp', email: 'gp@example.com', source: 'hero-gp', name: 'Dr G', gmc: '7000002' });
  await joinWaitlist(db, { role: 'patient', email: 'other@example.com', source: 'hero' });

  expect(await confirmUnsubscribe(signup.unsubscribeToken)).toEqual({ done: true });
  expect((await db.select().from(waitlistSignups)).map((r) => r.email)).toEqual(['other@example.com']);
  const [entry] = await db.select().from(adminAuditLog);
  expect(entry).toMatchObject({ adminEmail: 'self-service', action: 'self_erasure', target: signup.id, meta: { role: 'gp' } });
  expect(JSON.stringify(entry)).not.toContain('gp@example.com');

  // The link is single-use.
  expect(await confirmUnsubscribe(signup.unsubscribeToken)).toEqual({ done: false, error: 'invalid' });
});

test('unknown, malformed and missing tokens do nothing', async () => {
  await joinWaitlist(db, { role: 'patient', email: 'amy@example.com', source: 'hero' });
  expect(await unsubscribeByToken(db, 'x'.repeat(32))).toEqual({ ok: false });
  expect(await findByToken(db, "' or 1=1 --")).toBeNull();
  expect(await findByToken(db, '')).toBeNull();
  expect(await confirmUnsubscribe('')).toEqual({ done: false, error: 'invalid' });
  expect(await db.select().from(waitlistSignups)).toHaveLength(1);
  expect(await page()).toBeTruthy();
});

test('the page is never indexed and its copy passes the public copy rules', () => {
  expect(metadata.robots).toMatchObject({ index: false, follow: false });
  const dir = join(__dirname, '..', 'app', '(site)', 'unsubscribe');
  for (const file of ['page.tsx', 'UnsubscribeConfirm.tsx', 'actions.ts']) {
    expect(checkCopy(readFileSync(join(dir, file), 'utf8')), file).toEqual([]);
  }
});
