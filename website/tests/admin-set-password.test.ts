import { test, expect, beforeAll, beforeEach, vi } from 'vitest';
import { resetDb, useTestDb } from './helpers/db';
import { setDb, type DB } from '@/lib/db';
import { adminAuditLog } from '@/lib/db/schema';
import { addMember, linkIsLive, sendLink, type LinkOutcome } from '@/lib/admin/team';
import type { Admin } from '@/lib/admin/roles';
import { addTestMember } from './helpers/admin';
import { mailWorks, tokenIn } from './helpers/mail';

const jar = new Map<string, { value: string; opts?: Record<string, unknown> }>();
const reqHeaders = new Headers();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)!.value } : undefined),
    set: (name: string, value: string, opts?: Record<string, unknown>) => { jar.set(name, { value, opts }); },
    delete: (arg: string | { name: string }) => { jar.delete(typeof arg === 'string' ? arg : arg.name); },
    has: (name: string) => jar.has(name),
  }),
  headers: async () => reqHeaders,
}));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => { throw Object.assign(new Error(`NEXT_REDIRECT ${to}`), { digest: `NEXT_REDIRECT;${to}` }); },
}));

import { SESSION_COOKIE, readSession } from '@/lib/admin-auth';
import { setPassword } from '@/app/admin/actions';

const LEAD: Admin = { id: null, email: 'lead@example.com', name: 'Lead Admin', role: 'admin' };

let db: DB;
beforeAll(async () => { db = await useTestDb(); });
beforeEach(async () => {
  vi.unstubAllEnvs();
  setDb(db);
  vi.stubEnv('ADMIN_SESSION_SECRET', 'x'.repeat(40));
  jar.clear();
  await resetDb(db);
});

const form = (token: string, password: string, confirm = password) => {
  const f = new FormData(); f.set('token', token); f.set('password', password); f.set('confirm', confirm); return f;
};
const tokenOf = (o: LinkOutcome) => new URL((o as { url: string }).url).searchParams.get('token')!;

test('an invited person sets a password, is signed in with their role, and it is audited as team_accept', async () => {
  const o = await addMember(db, LEAD, { name: 'Olu Ops', email: 'ops@example.com', role: 'operations' });
  await expect(setPassword({ error: null }, form(tokenOf(o), 'a long enough password'))).rejects.toThrow('NEXT_REDIRECT /admin');
  expect(await readSession(jar.get(SESSION_COOKIE)!.value)).toMatchObject({ email: 'ops@example.com', role: 'operations' });
  expect(await db.select().from(adminAuditLog)).toMatchObject([{ adminEmail: 'ops@example.com', action: 'team_accept', target: o.ok ? o.id : '' }]);
});

test('a mismatch and a short password are refused and the link still works', async () => {
  const token = tokenOf(await addMember(db, LEAD, { name: 'Olu Ops', email: 'ops@example.com', role: 'operations' }));
  expect((await setPassword({ error: null }, form(token, 'a long enough password', 'something else entirely'))).error).toBe('The two passwords do not match.');
  expect((await setPassword({ error: null }, form(token, 'short'))).error).toBe('Use at least 12 characters.');
  expect(await linkIsLive(db, token)).toBe(true);
  expect(jar.has(SESSION_COOKIE)).toBe(false);
});

test('an unknown or used link is refused', async () => {
  expect((await setPassword({ error: null }, form('not-a-token', 'a long enough password'))).error)
    .toBe('This link has expired or has already been used. Ask an Admin to send you a new one.');
});

test('a reset is audited as team_password and ends the person’s older session', async () => {
  const m = await addTestMember(db, 'finance');
  const sent = mailWorks();
  await sendLink(db, LEAD, m.id);
  await expect(setPassword({ error: null }, form(tokenIn(sent[0].text), 'a brand new password'))).rejects.toThrow('NEXT_REDIRECT /admin');
  expect(await readSession(m.token)).toBeNull();
  expect((await db.select().from(adminAuditLog)).map((r) => r.action)).toEqual(['team_password']);
});
