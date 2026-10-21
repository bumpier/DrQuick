'use server';
// Sign-in and sign-out. Server actions are POSTs Next checks for same origin;
// each one is still treated as an untrusted entry point.
import { redirect } from 'next/navigation';
import { endSession, loginAllowed, startSession, verifyCredentials } from '@/lib/admin-auth';
import { audit } from '@/lib/admin/audit';
import type { Admin } from '@/lib/admin/roles';
import { linkIsLive, recordSignIn, setPasswordWithLink } from '@/lib/admin/team';
import { clientIp } from '@/lib/client-ip';
import { getDb } from '@/lib/db';
import { PASSWORD_MIN } from '@/lib/password';

export type SignInState = { error: string | null; email: string };

// One wording for a wrong password and an unknown email, so the form never
// confirms which addresses are admins.
const NOT_RECOGNISED = 'Email or password not recognised.';

export async function signIn(_prev: SignInState, form: FormData): Promise<SignInState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase().slice(0, 254);
  const password = String(form.get('password') ?? '').slice(0, 256);
  if (!email || !password) return { error: 'Enter your email and password.', email };

  const ip = await clientIp();
  try {
    if (!(await loginAllowed(ip, email))) return { error: 'Too many attempts. Try again in ten minutes.', email };
  } catch (err) {
    return (err as Error).message === 'store_unavailable'
      ? { error: 'Sign-in needs the site’s database, which is not configured on this server (set DATABASE_URL).', email }
      : { error: 'Sign-in is unavailable right now. Try again shortly.', email };
  }

  const admin = await verifyCredentials(email, password);
  if (!admin) return { error: NOT_RECOGNISED, email };
  if (!(await startSession(admin))) {
    return { error: 'Sign-in is not set up on this server (ADMIN_SESSION_SECRET).', email };
  }
  const db = await getDb(); // loginAllowed already needed one
  if (db) {
    if (admin.id) await recordSignIn(db, admin.id);
    await audit(db, admin, 'sign_in', admin.id, { backstop: admin.id === null });
  }
  redirect('/admin'); // throws, so it sits outside any try
}

export async function signOut() {
  await endSession();
  redirect('/admin/login');
}

/* ---------------------------------------------------- setting a password */

export type SetPasswordState = { error: string | null };

const NO_DB = 'Sign-in needs the site’s database, which is not configured on this server (set DATABASE_URL).';
const UNAVAILABLE = 'This is unavailable right now. Try again shortly.';
const DEAD_LINK = 'This link has expired or has already been used. Ask an Admin to send you a new one.';

// The page is unauthenticated, so a bogus token must not cost a scrypt hash:
// linkIsLive is the cheap gate, setPasswordWithLink the real one.
export async function setPassword(_prev: SetPasswordState, form: FormData): Promise<SetPasswordState> {
  const token = String(form.get('token') ?? '').slice(0, 200);
  const password = String(form.get('password') ?? '');
  const confirm = String(form.get('confirm') ?? '');
  if (password !== confirm) return { error: 'The two passwords do not match.' };

  const db = await getDb();
  if (!db) return { error: NO_DB };
  let result;
  try {
    if (!(await linkIsLive(db, token))) return { error: DEAD_LINK };
    result = await setPasswordWithLink(db, token, password);
  } catch {
    return { error: UNAVAILABLE };
  }
  if (!result.ok) {
    return { error: result.error === 'weak_password' ? `Use at least ${PASSWORD_MIN} characters.` : DEAD_LINK };
  }
  const { member, accepted } = result;
  const admin: Admin = { id: member.id, email: member.email, name: member.name, role: member.role };
  if (!(await startSession(admin))) return { error: 'Sign-in is not set up on this server (ADMIN_SESSION_SECRET).' };
  await recordSignIn(db, member.id);
  await audit(db, admin, accepted ? 'team_accept' : 'team_password', member.id);
  redirect('/admin'); // throws, so it sits outside any try
}
