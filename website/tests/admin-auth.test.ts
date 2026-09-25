import { test, expect, beforeEach, vi, describe } from 'vitest';

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
  SESSION_COOKIE, adminAccounts, hashPassword, loginAllowed, readSession, requireAdmin, resetLoginThrottle,
  signSession, verifyCredentials, verifyPassword,
} from '@/lib/admin-auth';
import { signIn, signOut } from '@/app/admin/actions';

const SECRET = 'x'.repeat(40);
const HASH = hashPassword('correct horse battery');

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv('ADMIN_SESSION_SECRET', SECRET);
  vi.stubEnv('ADMIN_USERS', `Editor@Example.com|Sam Editor|${HASH};broken-entry;other@example.com|Alex Other|${HASH}`);
  jar.clear();
  reqHeaders.set('x-forwarded-for', '203.0.113.9');
  resetLoginThrottle();
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

  test('credentials: right password in, wrong password and unknown email both out', () => {
    expect(verifyCredentials(' EDITOR@example.com ', 'correct horse battery')).toEqual({ email: 'editor@example.com', name: 'Sam Editor' });
    expect(verifyCredentials('editor@example.com', 'wrong')).toBeNull();
    expect(verifyCredentials('nobody@example.com', 'correct horse battery')).toBeNull();
    expect(verifyCredentials('nobody@example.com', 'decoy')).toBeNull();
  });
});

describe('sessions', () => {
  test('a signed session reads back as its admin', () => {
    expect(readSession(signSession('editor@example.com', 1000)!, 2000)).toEqual({ email: 'editor@example.com', name: 'Sam Editor' });
  });

  test('a tampered payload or signature is refused', () => {
    const token = signSession('editor@example.com')!;
    const [payload, sig] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ email: 'other@example.com', exp: Date.now() + 1e9 })).toString('base64url');
    expect(readSession(`${forged}.${sig}`)).toBeNull();
    expect(readSession(`${payload}.${sig.slice(0, -2)}xx`)).toBeNull();
    expect(readSession('garbage')).toBeNull();
  });

  test('an expired session is refused', () => {
    const token = signSession('editor@example.com', 0)!;
    expect(readSession(token, 8 * 3600_000 + 1)).toBeNull();
  });

  test('removing an admin from the list ends their session', () => {
    const token = signSession('other@example.com')!;
    vi.stubEnv('ADMIN_USERS', `editor@example.com|Sam Editor|${HASH}`);
    expect(readSession(token)).toBeNull();
  });

  test('with no secret, or a short one, nothing is signed and nothing reads', () => {
    const token = signSession('editor@example.com')!;
    vi.stubEnv('ADMIN_SESSION_SECRET', 'short');
    expect(signSession('editor@example.com')).toBeNull();
    expect(readSession(token)).toBeNull();
  });

  test('requireAdmin sends a visitor with no session to sign in', async () => {
    await expect(requireAdmin()).rejects.toThrow('NEXT_REDIRECT /admin/login');
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
      .rejects.toThrow('NEXT_REDIRECT /admin/blog');
    const cookie = jar.get(SESSION_COOKIE)!;
    expect(cookie.opts).toMatchObject({ httpOnly: true, sameSite: 'strict', path: '/admin' });
    expect(readSession(cookie.value)?.email).toBe('editor@example.com');
    await expect(requireAdmin()).resolves.toMatchObject({ name: 'Sam Editor' });
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

  test('signing out clears the cookie', async () => {
    jar.set(SESSION_COOKIE, { value: signSession('editor@example.com')! });
    await expect(signOut()).rejects.toThrow('NEXT_REDIRECT /admin/login');
    expect(jar.has(SESSION_COOKIE)).toBe(false);
  });
});
