// Admin sign-in. Server-only: node:crypto and next/headers keep it out of any
// client bundle. No dependencies.
//
// Accounts come from two places. ADMIN_USERS holds backstop Admins, entries
// separated by ";":
//   email|Display Name|scrypt:16384:<salt>:<hash>
// made with `npm run admin:hash`. Colons, not dollar signs: Next expands
// $NAME inside .env files, which would silently corrupt a salt. The Team page
// cannot remove these; they are the way back in. Everyone else is a row in
// admin_users with a role (lib/admin/roles.ts). An address in both places is
// the backstop entry.
//
// A session is base64url(JSON payload) + "." + HMAC-SHA256 over it with
// ADMIN_SESSION_SECRET, in an httpOnly, SameSite=Strict cookie scoped to
// /admin. A backstop session carries {email, exp}; a team session carries
// {uid, epoch, exp}. Every read re-checks the source, so removing a backstop
// entry, or removing a member or changing their password (which bumps
// session_epoch), signs them out on their next request, and a role change
// applies at once.
// The proxy (proxy.ts) only redirects when the cookie is missing; the real
// check is a guard here, in every admin page, server action and route, and
// each takes the area it serves: requireAdmin(area) for pages (a redirect),
// actionAdmin(area) for server actions (null) and routeAdmin(area) for route
// handlers (a 401 or 403 Response).
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminAccounts } from '@/lib/admin/backstop';
import { can, isRole, type Admin, type Area } from '@/lib/admin/roles';
import { accountByEmail, accountById } from '@/lib/admin/team';
import { getDb } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/password';
import { hashKey, hit } from '@/lib/rate-limit';
import { readToken, signToken } from '@/lib/signed-token';

export const SESSION_COOKIE = 'dq_admin';
export const SESSION_HOURS = 8;

export type { Admin } from '@/lib/admin/roles';

export const NOT_YOUR_ROLE = { ok: false, error: 'This is not part of your role. Ask an Admin if you need it.' } as const;
export const NO_ACCESS_PATH = '/admin/no-access';

export { hashPassword, verifyPassword } from '@/lib/password';
export { adminAccounts } from '@/lib/admin/backstop';

// An unknown email still costs one scrypt, so the response time never says
// which addresses are admins.
const DECOY = hashPassword('decoy', Buffer.alloc(16));

// Exactly one scrypt and one database lookup whatever the outcome, so the time
// never says whether an address is an admin, a member or nobody. A backstop
// entry is checked against its own hash only, even if a team row shares the
// address; the lookup still runs and its answer is ignored.
export async function verifyCredentials(email: string, password: string): Promise<Admin | null> {
  const key = email.trim().toLowerCase();
  const backstop = adminAccounts().get(key);
  const db = await getDb();
  const row = db ? await accountByEmail(db, key) : null;
  if (backstop) {
    return verifyPassword(password, backstop.hash)
      ? { id: null, email: backstop.email, name: backstop.name, role: 'admin' }
      : null;
  }
  const ok = verifyPassword(password, row?.passwordHash ?? DECOY);
  return ok && row?.passwordHash ? { id: row.id, email: row.email, name: row.name, role: row.role } : null;
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

export function signAccountSession(id: string, epoch: number, now = Date.now()): string | null {
  const key = secret();
  if (!key) return null;
  return signToken({ uid: id, epoch, exp: now + SESSION_HOURS * 3600_000 }, key);
}

function backstopAdmin(email: string): Admin | null {
  const account = adminAccounts().get(email);
  return account ? { id: null, email: account.email, name: account.name, role: 'admin' } : null;
}

// The admin a token belongs to, if it is genuine, unexpired and its source
// still vouches for it: the email still on ADMIN_USERS, or the member still
// active and on the epoch the token was signed with.
export async function readSession(token: string | undefined, now = Date.now()): Promise<Admin | null> {
  const key = secret();
  if (!key) return null;
  const data = readToken(token, key, now);
  if (!data) return null;
  if (typeof data.email === 'string') return backstopAdmin(data.email);
  if (typeof data.uid !== 'string' || typeof data.epoch !== 'number') return null;
  const db = await getDb();
  if (!db) return null;
  const row = await accountById(db, data.uid);
  if (!row || row.status !== 'active' || row.sessionEpoch !== data.epoch) return null;
  if (!isRole(row.role)) return null; // a role edited by hand to something unknown signs nobody in
  return backstopAdmin(row.email) ?? { id: row.id, email: row.email, name: row.name, role: row.role };
}

export async function currentAdmin(): Promise<Admin | null> {
  return readSession((await cookies()).get(SESSION_COOKIE)?.value);
}

// For pages and layouts: signed out goes to sign-in, outside the role to the
// no-access page.
export async function requireAdmin(area: Area): Promise<Admin> {
  const admin = await currentAdmin();
  if (!admin) redirect('/admin/login');
  if (!can(admin.role, area)) redirect(NO_ACCESS_PATH);
  return admin;
}

// For server actions: signed out goes to sign-in; outside the role the action
// gets null and answers NOT_YOUR_ROLE.
export async function actionAdmin(area: Area): Promise<Admin | null> {
  const admin = await currentAdmin();
  if (!admin) redirect('/admin/login');
  return can(admin.role, area) ? admin : null;
}

// For route handlers, which answer rather than redirect.
export async function routeAdmin(area: Area): Promise<Admin | Response> {
  const admin = await currentAdmin();
  if (!admin) return new Response('Sign in first.', { status: 401 });
  if (!can(admin.role, area)) return new Response('This is not part of your role.', { status: 403 });
  return admin;
}

// Only from a server action or route handler: cookies can be set nowhere else.
export async function startSession(admin: Admin): Promise<boolean> {
  let token: string | null;
  if (admin.id === null) {
    token = signSession(admin.email);
  } else {
    const db = await getDb();
    const row = db ? await accountById(db, admin.id) : null;
    token = row ? signAccountSession(row.id, row.sessionEpoch) : null;
  }
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
