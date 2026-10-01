// Admin sign-in for the blog editor. Server-only: node:crypto and next/headers
// keep it out of any client bundle. No dependencies.
//
// Accounts come from ADMIN_USERS, entries separated by ";":
//   email|Display Name|scrypt:16384:<salt>:<hash>
// made with `npm run admin:hash`. Colons, not dollar signs: Next expands
// $NAME inside .env files, which would silently corrupt a salt. Removing an entry signs that admin out on
// their next request, because every session is re-checked against the list.
//
// A session is base64url(JSON {email, exp}) + "." + HMAC-SHA256 over it with
// ADMIN_SESSION_SECRET, in an httpOnly, SameSite=Strict cookie scoped to /admin.
// The proxy (proxy.ts) only redirects when the cookie is missing; the real
// check is requireAdmin() here, in every admin page and every server action.
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { hashKey, hit } from '@/lib/rate-limit';
import { readToken, signToken } from '@/lib/signed-token';

export const SESSION_COOKIE = 'dq_admin';
export const SESSION_HOURS = 8;
const SCRYPT_N = 16384;
const KEYLEN = 64;

export type Admin = { email: string; name: string };
type Account = Admin & { hash: string };

/* ------------------------------------------------------------ passwords */

const b64 = (buf: Buffer) => buf.toString('base64url');

export function hashPassword(password: string, salt = randomBytes(16)): string {
  const key = scryptSync(password.normalize('NFKC'), salt, KEYLEN, { N: SCRYPT_N });
  return `scrypt:${SCRYPT_N}:${b64(salt)}:${b64(key)}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, n, salt, hash] = stored.split(':');
  if (scheme !== 'scrypt' || !n || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = scryptSync(password.normalize('NFKC'), Buffer.from(salt, 'base64url'), expected.length, { N: Number(n) });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// An unknown email still costs one scrypt, so the response time never says
// which addresses are admins.
const DECOY = hashPassword('decoy', Buffer.alloc(16));

export function adminAccounts(env = process.env.ADMIN_USERS ?? ''): Map<string, Account> {
  const accounts = new Map<string, Account>();
  for (const entry of env.split(';')) {
    const [email, name, hash] = entry.split('|').map((s) => s.trim());
    if (email && name && hash?.startsWith('scrypt:')) accounts.set(email.toLowerCase(), { email: email.toLowerCase(), name, hash });
  }
  return accounts;
}

export function verifyCredentials(email: string, password: string): Admin | null {
  const account = adminAccounts().get(email.trim().toLowerCase());
  const ok = verifyPassword(password, account?.hash ?? DECOY);
  return ok && account ? { email: account.email, name: account.name } : null;
}

/* ------------------------------------------------------------- sessions */

function secret(): string | null {
  const s = process.env.ADMIN_SESSION_SECRET ?? '';
  return s.length >= 32 ? s : null; // a short secret signs nothing
}

export function signSession(email: string, now = Date.now()): string | null {
  const key = secret();
  if (!key) return null;
  return signToken({ email, exp: now + SESSION_HOURS * 3600_000 }, key);
}

// The admin a token belongs to, if it is genuine, unexpired and the email is
// still on the list.
export function readSession(token: string | undefined, now = Date.now()): Admin | null {
  const key = secret();
  if (!key) return null;
  const data = readToken(token, key, now);
  if (!data || typeof data.email !== 'string') return null;
  const account = adminAccounts().get(data.email);
  return account ? { email: account.email, name: account.name } : null;
}

export async function currentAdmin(): Promise<Admin | null> {
  return readSession((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function requireAdmin(): Promise<Admin> {
  const admin = await currentAdmin();
  if (!admin) redirect('/admin/login');
  return admin;
}

// Only from a server action or route handler: cookies can be set nowhere else.
export async function startSession(email: string): Promise<boolean> {
  const token = signSession(email);
  if (!token) return false;
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/admin',
    maxAge: SESSION_HOURS * 3600,
  });
  return true;
}

export async function endSession() {
  (await cookies()).delete({ name: SESSION_COOKIE, path: '/admin' });
}

/* ------------------------------------------------------------- throttle */

// Five attempts per ten minutes per IP and email, in the rate_limits table (a
// salted hash as the key, never the raw IP). A production server with no
// database throws 'store_unavailable' and sign-in is refused: every admin page
// reads the database, so there would be nothing to sign in to.
const ATTEMPTS = 5;
const WINDOW_S = 600;

export async function loginAllowed(ip: string, email: string, now = new Date()): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error('store_unavailable');
  return (await hit(db, hashKey('rl:admin', ip, email.toLowerCase()), WINDOW_S, now)) <= ATTEMPTS;
}
