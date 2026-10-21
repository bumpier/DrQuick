import { test, expect, beforeAll, beforeEach, vi, describe } from 'vitest';
import { resetDb, useTestDb } from './helpers/db';
import { setDb, type DB } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { adminAuditLog, adminUsers } from '@/lib/db/schema';
import { addMember, removeMember } from '@/lib/admin/team';
import { addTestMember } from './helpers/admin';

// next/headers is request-scoped; stand in a cookie jar and a header bag.
const jar = new Map<string, { value: string; opts?: Record<string, unknown> }>();
const reqHeaders = new Headers();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)!.value } : undefined),
    set: (name: string, value: string, opts?: Record<string, unknown>) => { jar.set(name, { value, opts }); },
    delete: (arg: string | { name: string }) => { jar.delete(typeof arg === 'string' ? arg : arg.name); },
  }),
  headers: async () => reqHeaders,
}));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => { throw Object.assign(new Error(`NEXT_REDIRECT ${to}`), { digest: `NEXT_REDIRECT;${to}` }); },
}));

import {
  SESSION_COOKIE, actionAdmin, adminAccounts, hashPassword, loginAllowed, readSession, requireAdmin,
  routeAdmin, signSession, verifyCredentials, verifyPassword,
} from '@/lib/admin-auth';
import { signIn, signOut } from '@/app/admin/actions';

const SECRET = 'x'.repeat(40);
const HASH = hashPassword('correct horse battery');

let db: DB;
beforeAll(async () => { db = await useTestDb(); });

beforeEach(async () => {
  vi.unstubAllEnvs();
  setDb(db);
  vi.stubEnv('ADMIN_SESSION_SECRET', SECRET);
  vi.stubEnv('ADMIN_USERS', `Editor@Example.com|Sam Editor|${HASH};broken-entry;other@example.com|Alex Other|${HASH}`);
  jar.clear();
  reqHeaders.set('x-forwarded-for', '203.0.113.9');
  await resetDb(db);
});

describe('passwords', () => {
  test('a hash verifies its password and nothing else, and never repeats', () => {
    expect(verifyPassword('correct horse battery', HASH)).toBe(true);
    expect(verifyPassword('correct horse batterY', HASH)).toBe(false);
    expect(hashPassword('same')).not.toBe(hashPassword('same'));
    expect(verifyPassword('anything', 'not-a-hash')).toBe(false);
  });

  test('accounts parse case-insensitively and skip malformed entries', () => {
    expect([...adminAccounts().keys()]).toEqual(['editor@example.com', 'other@example.com']);
  });

  test('credentials: right password in, wrong password and unknown email both out', async () => {
    expect(await verifyCredentials(' EDITOR@example.com ', 'correct horse battery')).toEqual({ id: null, email: 'editor@example.com', name: 'Sam Editor', role: 'admin' });
    expect(await verifyCredentials('editor@example.com', 'wrong')).toBeNull();
    expect(await verifyCredentials('nobody@example.com', 'correct horse battery')).toBeNull();
    expect(await verifyCredentials('nobody@example.com', 'decoy')).toBeNull();
  });
});

describe('sessions', () => {
  test('a signed session reads back as its admin', async () => {
    expect(await readSession(signSession('editor@example.com', 1000)!, 2000)).toEqual({ id: null, email: 'editor@example.com', name: 'Sam Editor', role: 'admin' });
  });

  test('a tampered payload or signature is refused', async () => {
    const token = signSession('editor@example.com')!;
    const [payload, sig] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ email: 'other@example.com', exp: Date.now() + 1e9 })).toString('base64url');
    expect(await readSession(`${forged}.${sig}`)).toBeNull();
    expect(await readSession(`${payload}.${sig.slice(0, -2)}xx`)).toBeNull();
    expect(await readSession('garbage')).toBeNull();
  });

  test('an expired session is refused', async () => {
    const token = signSession('editor@example.com', 0)!;
    expect(await readSession(token, 8 * 3600_000 + 1)).toBeNull();
  });

  test('removing an admin from the list ends their session', async () => {
    const token = signSession('other@example.com')!;
    vi.stubEnv('ADMIN_USERS', `editor@example.com|Sam Editor|${HASH}`);
    expect(await readSession(token)).toBeNull();
  });

  test('with no secret, or a short one, nothing is signed and nothing reads', async () => {
    const token = signSession('editor@example.com')!;
    vi.stubEnv('ADMIN_SESSION_SECRET', 'short');
    expect(signSession('editor@example.com')).toBeNull();
    expect(await readSession(token)).toBeNull();
  });

  test('requireAdmin sends a visitor with no session to sign in', async () => {
    await expect(requireAdmin('overview')).rejects.toThrow('NEXT_REDIRECT /admin/login');
  });
});

describe('sign in and out', () => {
  const form = (email: string, password: string) => {
    const f = new FormData();
    f.set('email', email);
    f.set('password', password);
    return f;
  };

  test('the right credentials set a strict, httpOnly cookie on /admin and go to the blog', async () => {
    await expect(signIn({ error: null, email: '' }, form('editor@example.com', 'correct horse battery')))
      .rejects.toThrow('NEXT_REDIRECT /admin');
    const cookie = jar.get(SESSION_COOKIE)!;
    expect(cookie.opts).toMatchObject({ httpOnly: true, sameSite: 'strict', path: '/admin' });
    expect((await readSession(cookie.value))?.email).toBe('editor@example.com');
    await expect(requireAdmin('overview')).resolves.toMatchObject({ name: 'Sam Editor' });
  });

  test('a wrong password and an unknown email get the same answer, and no cookie', async () => {
    const a = await signIn({ error: null, email: '' }, form('editor@example.com', 'nope'));
    const b = await signIn({ error: null, email: '' }, form('nobody@example.com', 'nope'));
    expect(a.error).toBe('Email or password not recognised.');
    expect(b.error).toBe(a.error);
    expect(jar.has(SESSION_COOKIE)).toBe(false);
  });

  test('the sixth attempt in ten minutes is refused, even with the right password', async () => {
    for (let i = 0; i < 5; i += 1) await signIn({ error: null, email: '' }, form('editor@example.com', 'nope'));
    const sixth = await signIn({ error: null, email: '' }, form('editor@example.com', 'correct horse battery'));
    expect(sixth.error).toMatch(/Too many attempts/);
    expect(jar.has(SESSION_COOKIE)).toBe(false);
  });

  test('the throttle is per IP and email', async () => {
    for (let i = 0; i < 5; i += 1) expect(await loginAllowed('1.1.1.1', 'a@example.com')).toBe(true);
    expect(await loginAllowed('1.1.1.1', 'a@example.com')).toBe(false);
    expect(await loginAllowed('2.2.2.2', 'a@example.com')).toBe(true);
  });

  test('a production server with no store says so, rather than blaming the password', async () => {
    setDb(null);
    const result = await signIn({ error: null, email: '' }, form('editor@example.com', 'correct horse battery'));
    expect(result.error).toMatch(/database, which is not configured/);
    expect(jar.has(SESSION_COOKIE)).toBe(false);
  });

  test('signing out clears the cookie', async () => {
    jar.set(SESSION_COOKIE, { value: signSession('editor@example.com')! });
    await expect(signOut()).rejects.toThrow('NEXT_REDIRECT /admin/login');
    expect(jar.has(SESSION_COOKIE)).toBe(false);
  });
});

describe('team accounts', () => {
  const signInAs = (email: string, password: string) => {
    const f = new FormData(); f.set('email', email); f.set('password', password);
    return signIn({ error: null, email: '' }, f);
  };
  const as = (token: string) => jar.set(SESSION_COOKIE, { value: token });

  test('an active member signs in with their own role; the sign-in is recorded and audited', async () => {
    const m = await addTestMember(db, 'finance');
    await expect(signInAs(m.email, 'correct horse battery')).rejects.toThrow('NEXT_REDIRECT /admin');
    expect(await readSession(jar.get(SESSION_COOKIE)!.value)).toEqual({ id: m.id, email: m.email, name: 'Test Finance', role: 'finance' });
    expect((await db.select().from(adminUsers))[0].lastSignInAt).toBeInstanceOf(Date);
    expect(await db.select().from(adminAuditLog)).toMatchObject([{ adminEmail: m.email, action: 'sign_in', target: m.id }]);
  });

  test('an invited person, a removed person and a wrong password all get the same answer and no cookie', async () => {
    await addTestMember(db, 'operations', { status: 'invited', passwordHash: null });
    await addTestMember(db, 'marketing', { status: 'removed' });
    for (const [email, pw] of [['operations@team.example', 'correct horse battery'], ['marketing@team.example', 'correct horse battery'], ['editor@example.com', 'nope']]) {
      expect((await signInAs(email, pw)).error).toBe('Email or password not recognised.');
    }
    expect(jar.has(SESSION_COOKIE)).toBe(false);
  });

  test('ADMIN_USERS wins over a team row with the same address', async () => {
    await addTestMember(db, 'marketing', { email: 'editor@example.com', passwordHash: hashPassword('another password here') });
    expect(await verifyCredentials('editor@example.com', 'correct horse battery')).toMatchObject({ id: null, role: 'admin' });
    expect(await verifyCredentials('editor@example.com', 'another password here')).toBeNull();
  });

  test('a backstop address costs the same database lookup as any other, so timing does not tell them apart', async () => {
    const select = vi.spyOn(db, 'select');
    await verifyCredentials('editor@example.com', 'correct horse battery');
    const backstop = select.mock.calls.length;
    select.mockClear();
    await verifyCredentials('nobody@example.com', 'correct horse battery');
    expect(backstop).toBeGreaterThan(0);
    expect(backstop).toBe(select.mock.calls.length);
    select.mockRestore();
  });

  test('a row whose role is not one of the four is no session', async () => {
    const m = await addTestMember(db, 'finance');
    await db.update(adminUsers).set({ role: 'owner' }).where(eq(adminUsers.id, m.id));
    expect(await readSession(m.token)).toBeNull();
  });

  test('removal and a password change end a session on the next request; a role change applies without signing in again', async () => {
    const m = await addTestMember(db, 'operations');
    await db.update(adminUsers).set({ role: 'finance' }).where(eq(adminUsers.id, m.id));
    expect((await readSession(m.token))?.role).toBe('finance');
    await db.update(adminUsers).set({ sessionEpoch: 1 }).where(eq(adminUsers.id, m.id));
    expect(await readSession(m.token)).toBeNull();
    const n = await addTestMember(db, 'marketing');
    await db.update(adminUsers).set({ status: 'removed' }).where(eq(adminUsers.id, n.id));
    expect(await readSession(n.token)).toBeNull();
  });

  test('someone removed and added again cannot use their old session', async () => {
    const m = await addTestMember(db, 'operations');
    const lead = { id: null, email: 'editor@example.com', name: 'Sam Editor', role: 'admin' } as const;
    await removeMember(db, lead, m.id);
    await addMember(db, lead, { name: 'Back Again', email: m.email, role: 'operations' });
    expect(await readSession(m.token)).toBeNull();
  });

  test('the guards: outside your role a page redirects, an action gets null, a route gets 403', async () => {
    as((await addTestMember(db, 'marketing')).token);
    await expect(requireAdmin('finance')).rejects.toThrow('NEXT_REDIRECT /admin/no-access');
    await expect(requireAdmin('blog')).resolves.toMatchObject({ role: 'marketing' });
    expect(await actionAdmin('finance')).toBeNull();
    expect(((await routeAdmin('finance')) as Response).status).toBe(403);
    expect(await routeAdmin('analytics')).toMatchObject({ role: 'marketing' });
    jar.clear();
    expect(((await routeAdmin('analytics')) as Response).status).toBe(401);
    await expect(actionAdmin('blog')).rejects.toThrow('NEXT_REDIRECT /admin/login');
  });
});
