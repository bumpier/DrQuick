import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { eq, isNull } from 'drizzle-orm';
import { resetDb, useTestDb } from './helpers/db';
import { mailIsDown, mailWorks, tokenIn } from './helpers/mail';
import { setDb, type DB } from '@/lib/db';
import { adminTokens, adminUsers } from '@/lib/db/schema';
import { hashPassword } from '@/lib/password';
import type { Admin } from '@/lib/admin/roles';
import {
  addMember, changeRole, linkIsLive, listTeam, removeMember, sendLink, setPasswordWithLink,
  type LinkOutcome,
} from '@/lib/admin/team';

const LEAD: Admin = { id: null, email: 'lead@example.com', name: 'Lead Admin', role: 'admin' };
const NOW = new Date('2026-10-21T09:00:00Z');

let db: DB;
beforeAll(async () => { db = await useTestDb(); });

beforeEach(async () => {
  vi.unstubAllEnvs();
  setDb(db);
  vi.stubEnv('ADMIN_USERS', `lead@example.com|Lead Admin|${hashPassword('x')}`);
  vi.stubEnv('RESEND_API_KEY', '');
  vi.stubEnv('EMAIL_FROM', '');
  await resetDb(db);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const add = (email = 'asif@example.com', role = 'admin', name = 'Dr Asif') => addMember(db, LEAD, { name, email, role }, NOW);
const member = async (id: string) => (await db.select().from(adminUsers).where(eq(adminUsers.id, id)))[0];
const tokenOf = (o: LinkOutcome) => { if (!o.ok || o.delivery !== 'shown') throw new Error('no link'); return new URL(o.url).searchParams.get('token')!; };

test('adding stores the person invited and, with no email set up, hands back the link to show', async () => {
  const o = await addMember(db, LEAD, { name: ' Dr Asif ', email: ' Asif@Example.com ', role: 'admin' }, NOW);
  expect(o).toMatchObject({ ok: true, delivery: 'shown' });
  const row = await member(o.ok ? o.id : '');
  expect(row).toMatchObject({ email: 'asif@example.com', name: 'Dr Asif', role: 'admin', status: 'invited', passwordHash: null, createdBy: 'lead@example.com' });
  const [token] = await db.select().from(adminTokens);
  expect(token.expiresAt).toEqual(new Date(NOW.getTime() + 24 * 3600_000));
  expect(token.tokenHash).not.toBe(tokenOf(o)); // only the hash is stored
});

test('with email working, the invite is emailed, names the inviter and the role, and is not handed back', async () => {
  const sent = mailWorks();
  const o = await add();
  expect(o).toEqual({ ok: true, id: expect.any(String), delivery: 'sent' });
  expect(sent[0].to).toEqual(['asif@example.com']);
  expect(sent[0].text).toContain('Lead Admin has added you to the Dr Quick admin as Admin.');
  expect(sent[0].text).toContain('24 hours');
});

test('refuses a bad name, email or role, a backstop address, and someone already on the team however it is typed', async () => {
  expect(await add('asif@example.com', 'admin', '   ')).toEqual({ ok: false, error: 'invalid_name' });
  expect(await add('not-an-email')).toEqual({ ok: false, error: 'invalid_email' });
  expect(await add('asif@example.com', 'owner')).toEqual({ ok: false, error: 'invalid_role' });
  expect(await add(' LEAD@example.com')).toEqual({ ok: false, error: 'on_backstop' });
  await add();
  expect(await add(' ASIF@Example.com ')).toEqual({ ok: false, error: 'already_member' });
});

test('checking a link does not spend it; using it sets the password once and activates the person', async () => {
  const token = tokenOf(await add());
  expect(await linkIsLive(db, token, NOW)).toBe(true);
  expect(await linkIsLive(db, token, NOW)).toBe(true);
  const r = await setPasswordWithLink(db, token, 'a long enough password', NOW);
  expect(r).toMatchObject({ ok: true, accepted: true, member: { status: 'active', sessionEpoch: 1 } });
  expect(r.ok && 'passwordHash' in r.member).toBe(false);
  expect(await setPasswordWithLink(db, token, 'a long enough password', NOW)).toEqual({ ok: false, error: 'invalid_link' });
  expect(await linkIsLive(db, token, NOW)).toBe(false);
});

test('a short password is refused and leaves the link usable', async () => {
  const token = tokenOf(await add());
  expect(await setPasswordWithLink(db, token, 'short', NOW)).toEqual({ ok: false, error: 'weak_password' });
  expect(await linkIsLive(db, token, NOW)).toBe(true);
});

test('a link is dead after 24 hours', async () => {
  const token = tokenOf(await add());
  const later = new Date(NOW.getTime() + 24 * 3600_000 + 1);
  expect(await linkIsLive(db, token, later)).toBe(false);
  expect(await setPasswordWithLink(db, token, 'a long enough password', later)).toEqual({ ok: false, error: 'invalid_link' });
});

test('a new link for an invited person replaces the earlier one', async () => {
  const o = await add();
  const first = tokenOf(o);
  const second = tokenOf(await sendLink(db, LEAD, o.ok ? o.id : '', NOW));
  expect(await linkIsLive(db, first, NOW)).toBe(false);
  expect(await linkIsLive(db, second, NOW)).toBe(true);
});

test('a reset for an active person goes by email only: unsent, it is withdrawn and the earlier link keeps working', async () => {
  const o = await add();
  const id = o.ok ? o.id : '';
  await setPasswordWithLink(db, tokenOf(o), 'a long enough password', NOW);
  const sent = mailWorks();
  expect(await sendLink(db, LEAD, id, NOW)).toEqual({ ok: true, id, delivery: 'sent' });
  const emailed = tokenIn(sent[0].text);
  vi.spyOn(console, 'error').mockImplementation(() => {}); // sendEmail logs the failure
  mailIsDown();
  expect(await sendLink(db, LEAD, id, NOW)).toEqual({ ok: false, error: 'not_sent' });
  expect(await linkIsLive(db, emailed, NOW)).toBe(true);
  expect((await db.select().from(adminTokens).where(isNull(adminTokens.usedAt))).length).toBe(1);
});

test('changing a role: refuses yourself, an unknown id and a bad role; a no-op writes nothing', async () => {
  const o = await add('ops@example.com', 'operations', 'Olu Ops');
  const id = o.ok ? o.id : '';
  const self: Admin = { id, email: 'ops@example.com', name: 'Olu Ops', role: 'admin' };
  expect(await changeRole(db, self, id, 'finance')).toEqual({ ok: false, error: 'self' });
  expect(await changeRole(db, LEAD, 'nope', 'finance')).toEqual({ ok: false, error: 'not_found' });
  expect(await changeRole(db, LEAD, id, 'boss')).toEqual({ ok: false, error: 'invalid_role' });
  expect(await changeRole(db, LEAD, id, 'operations')).toEqual({ ok: true, id, from: 'operations', to: 'operations' });
  expect(await changeRole(db, LEAD, id, 'finance')).toEqual({ ok: true, id, from: 'operations', to: 'finance' });
  expect((await member(id)).role).toBe('finance');
});

test('removing someone kills their links; adding them again starts afresh and the old link stays dead', async () => {
  const o = await add('ops@example.com', 'operations', 'Olu Ops');
  const id = o.ok ? o.id : '';
  const oldLink = tokenOf(o);
  expect(await removeMember(db, LEAD, id, NOW)).toEqual({ ok: true, id, role: 'operations', name: 'Olu Ops' });
  expect(await member(id)).toMatchObject({ status: 'removed', sessionEpoch: 1, passwordHash: null });
  expect(await db.select().from(adminTokens)).toEqual([]);
  expect(await sendLink(db, LEAD, id, NOW)).toEqual({ ok: false, error: 'not_found' });
  const again = await add('ops@example.com', 'finance', 'Olu Ops');
  expect(again).toMatchObject({ ok: true, id, delivery: 'shown' }); // the same row, revived
  expect(await member(id)).toMatchObject({ status: 'invited', role: 'finance', sessionEpoch: 2, removedAt: null });
  expect(await setPasswordWithLink(db, oldLink, 'a long enough password', NOW)).toEqual({ ok: false, error: 'invalid_link' });
});

test('you cannot remove yourself', async () => {
  const o = await add();
  const id = o.ok ? o.id : '';
  expect(await removeMember(db, { id, email: 'asif@example.com', name: 'Dr Asif', role: 'admin' }, id, NOW)).toEqual({ ok: false, error: 'self' });
});

test('the last Admin who can sign in can be neither removed nor moved to another role', async () => {
  vi.stubEnv('ADMIN_USERS', '');
  const a = await add('a@example.com'); const b = await add('b@example.com');
  for (const o of [a, b]) await setPasswordWithLink(db, tokenOf(o), 'a long enough password', NOW);
  const aId = a.ok ? a.id : ''; const bId = b.ok ? b.id : '';
  // A's request passed its guard just before B removed A: A is gone, B is the last Admin.
  await db.update(adminUsers).set({ status: 'removed' }).where(eq(adminUsers.id, aId));
  const staleA: Admin = { id: aId, email: 'a@example.com', name: 'Dr Asif', role: 'admin' };
  expect(await removeMember(db, staleA, bId, NOW)).toEqual({ ok: false, error: 'last_admin' });
  expect(await changeRole(db, staleA, bId, 'finance')).toEqual({ ok: false, error: 'last_admin' });
  expect(await member(bId)).toMatchObject({ role: 'admin', status: 'active' });
});

test('the team list leaves out removed people and shows when an invite expires', async () => {
  await add('a@example.com'); const b = await add('b@example.com', 'finance');
  await removeMember(db, LEAD, b.ok ? b.id : '', NOW);
  const team = await listTeam(db, NOW);
  expect(team.map((m) => m.email)).toEqual(['a@example.com']);
  expect(team[0].linkExpiresAt).toEqual(new Date(NOW.getTime() + 24 * 3600_000));
  expect('passwordHash' in team[0]).toBe(false);
});
