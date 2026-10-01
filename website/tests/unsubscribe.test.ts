import { beforeAll, beforeEach, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resetDb, useTestDb } from './helpers/db';
import { setDb, type DB } from '@/lib/db';
import { adminAuditLog, consultations, gps, waitlistSignups } from '@/lib/db/schema';
import { erasureEffect, findByToken, joinWaitlist, unsubscribeByToken } from '@/lib/waitlist';
import { randomUUID } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { confirmUnsubscribe } from '@/app/(site)/unsubscribe/actions';
import { UnsubscribeConfirm } from '@/app/(site)/unsubscribe/UnsubscribeConfirm';
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

// A GP's unsubscribe link also closes their doctor portal account. What that
// does depends on whether they have ever taken a consultation, and the page has
// to say which before they press the button.
async function doctorWith(status: 'none' | 'completed' | 'in_progress') {
  const { signup } = await joinWaitlist(db, { role: 'gp', email: 'gp@example.com', source: 'hero-gp', name: 'A Doctor', gmc: '7000002' });
  const [gp] = await db.insert(gps).values({ signupId: signup.id, name: 'A Doctor', email: 'gp@example.com', gmc: '7000002', status: 'active' }).returning();
  if (status !== 'none') {
    await db.insert(consultations).values({
      patientId: randomUUID(), gpId: gp.id, status, requestedAt: new Date(), pricePence: 4000, gpFeePence: 2400, platformFeePence: 1600,
    });
  }
  return signup;
}
const confirmCopy = (portal: 'none' | 'deleted' | 'kept') =>
  renderToStaticMarkup(createElement(UnsubscribeConfirm, { token: 't', role: 'gp', email: 'gp@example.com', portal }));

test('what erasing will do to a portal account is known before anyone confirms', async () => {
  expect(await erasureEffect(db, 'nobody@example.com')).toBe('none');
  await doctorWith('completed');
  expect(await erasureEffect(db, 'gp@example.com')).toBe('kept');
  await resetDb(db);
  await doctorWith('none');
  expect(await erasureEffect(db, 'gp@example.com')).toBe('deleted');
});

test('a doctor who has taken consultations is told what is kept, and is never told everything is deleted', () => {
  const kept = confirmCopy('kept');
  expect(kept).toContain('your name and GMC number');
  expect(kept).toContain('doctor portal');
  expect(kept).not.toContain('delete everything you gave us');
  // With an account and no consultations, everything does go, the account included.
  const deleted = confirmCopy('deleted');
  expect(deleted).toContain('delete everything you gave us');
  expect(deleted).toContain('doctor portal');
  expect(confirmCopy('none')).not.toContain('doctor portal');
});

test('a doctor in the middle of a consultation is told it could not be done, and nothing is deleted', async () => {
  const signup = await doctorWith('in_progress');
  expect(await confirmUnsubscribe(signup.unsubscribeToken)).toEqual({ done: false, error: 'unavailable' });
  expect(await db.select().from(waitlistSignups)).toHaveLength(1);
  expect(await db.select().from(gps)).toHaveLength(1);
});

test('the page is never indexed and its copy passes the public copy rules', () => {
  expect(metadata.robots).toMatchObject({ index: false, follow: false });
  const dir = join(__dirname, '..', 'app', '(site)', 'unsubscribe');
  for (const file of ['page.tsx', 'UnsubscribeConfirm.tsx', 'actions.ts']) {
    expect(checkCopy(readFileSync(join(dir, file), 'utf8')), file).toEqual([]);
  }
});
