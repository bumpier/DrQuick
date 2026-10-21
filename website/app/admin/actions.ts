'use server';
// Sign-in and sign-out. Server actions are POSTs Next checks for same origin;
// each one is still treated as an untrusted entry point.
import { redirect } from 'next/navigation';
import { endSession, loginAllowed, startSession, verifyCredentials } from '@/lib/admin-auth';
import { audit } from '@/lib/admin/audit';
import { recordSignIn } from '@/lib/admin/team';
import { clientIp } from '@/lib/client-ip';
import { getDb } from '@/lib/db';

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
