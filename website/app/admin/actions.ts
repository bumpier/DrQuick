'use server';
// Sign-in and sign-out. Server actions are POSTs Next checks for same origin;
// each one is still treated as an untrusted entry point.
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { endSession, loginAllowed, startSession, verifyCredentials } from '@/lib/admin-auth';

export type SignInState = { error: string | null; email: string };

// One wording for a wrong password and an unknown email, so the form never
// confirms which addresses are admins.
const NOT_RECOGNISED = 'Email or password not recognised.';

export async function signIn(_prev: SignInState, form: FormData): Promise<SignInState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase().slice(0, 254);
  const password = String(form.get('password') ?? '').slice(0, 256);
  if (!email || !password) return { error: 'Enter your email and password.', email };

  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown';
  try {
    if (!(await loginAllowed(ip, email))) return { error: 'Too many attempts. Try again in ten minutes.', email };
  } catch {
    return { error: 'Sign-in is unavailable right now. Try again shortly.', email };
  }

  const admin = verifyCredentials(email, password);
  if (!admin) return { error: NOT_RECOGNISED, email };
  if (!(await startSession(admin.email))) {
    return { error: 'Sign-in is not set up on this server (ADMIN_SESSION_SECRET).', email };
  }
  redirect('/admin/blog'); // throws, so it sits outside any try
}

export async function signOut() {
  await endSession();
  redirect('/admin/login');
}
