import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { resetDb, useTestDb } from './helpers/db';
import { addTestMember } from './helpers/admin';
import { setDb, type DB } from '@/lib/db';
import { adminAuditLog, adminUsers } from '@/lib/db/schema';

let db: DB;
beforeAll(async () => { db = await useTestDb(); });

const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: async () => new Headers(),
}));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => { throw new Error(`NEXT_REDIRECT ${to}`); },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import {
  addMemberAction, changeRoleAction, removeMemberAction, sendLinkAction,
} from '@/app/admin/(panel)/system/team/actions';
import { NOT_YOUR_ROLE, SESSION_COOKIE, hashPassword, signSession } from '@/lib/admin-auth';

const HASH = hashPassword('correct horse battery');

beforeEach(async () => {
  setDb(db);
  vi.unstubAllEnvs();
  vi.stubEnv('ADMIN_SESSION_SECRET', 'y'.repeat(40));
  vi.stubEnv('ADMIN_USERS', `lead@example.com|Lead Admin|${HASH}`);
  vi.stubEnv('RESEND_API_KEY', '');
  vi.stubEnv('EMAIL_FROM', '');
  jar.clear();
  jar.set(SESSION_COOKIE, signSession('lead@example.com')!);
  await resetDb(db);
});

describe('team actions', () => {
  test('only an Admin can manage the team', async () => {
    jar.set(SESSION_COOKIE, (await addTestMember(db, 'operations')).token);
    expect(await addMemberAction({ name: 'X', email: 'x@example.com', role: 'admin' })).toEqual(NOT_YOUR_ROLE);
    expect((await db.select().from(adminUsers)).length).toBe(1); // only the test member
  });

  test('adding audits the role and whether the link was shown, by id and never by address', async () => {
    const r = await addMemberAction({ name: 'Dr Asif', email: 'asif@example.com', role: 'admin' });
    expect(r).toMatchObject({ ok: true, link: expect.stringContaining('/admin/set-password?token=') });
    const [m] = await db.select().from(adminUsers);
    const [a] = await db.select().from(adminAuditLog);
    expect(a).toMatchObject({ adminEmail: 'lead@example.com', action: 'team_add', target: m.id, meta: { role: 'admin', linkShown: true } });
    expect(JSON.stringify(a)).not.toContain('asif@example.com');
  });

  test('a role change and a removal are audited with the id', async () => {
    await addMemberAction({ name: 'Olu Ops', email: 'ops@example.com', role: 'operations' });
    const [m] = await db.select().from(adminUsers);
    expect(await changeRoleAction(m.id, 'finance')).toEqual({ ok: true, message: 'Role changed to Finance.' });
    expect(await removeMemberAction(m.id)).toEqual({ ok: true, message: 'Olu Ops no longer has access.' });
    expect((await db.select().from(adminAuditLog)).map((r) => [r.action, r.target, r.meta]))
      .toEqual([['team_add', m.id, { role: 'operations', linkShown: true }], ['team_role', m.id, { from: 'operations', to: 'finance' }], ['team_remove', m.id, { role: 'finance' }]]);
  });

  test('refusals come back as sentences and write no audit', async () => {
    const me = await addTestMember(db, 'admin');
    jar.set(SESSION_COOKIE, me.token);
    expect(await removeMemberAction(me.id)).toEqual({ ok: false, error: 'You cannot change your own role or remove yourself.' });
    expect(await addMemberAction({ name: 'Lead', email: 'lead@example.com', role: 'admin' }))
      .toEqual({ ok: false, error: 'This address is already a backstop Admin in the server settings.' });
    expect(await db.select().from(adminAuditLog)).toEqual([]);
  });

  test('a reset link for an active person is never handed back', async () => {
    const m = await addTestMember(db, 'finance');
    const r = await sendLinkAction(m.id);
    expect(r).toEqual({ ok: false, error: 'The email could not be sent, so no new link was made. Their earlier link, if they have one, still works.' });
  });
});
