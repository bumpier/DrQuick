'use server';
// The portal's sign-in, sign-out and set-password actions. Server actions are
// POSTs Next checks for same origin; each one is still treated as an untrusted
// entry point.
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db';
import { doctorLoginAllowed, endDoctorSession, startDoctorSession, verifyDoctorCredentials } from '@/lib/doctor-auth';
import { PASSWORD_MIN, linkAllowed, requestSetPasswordLink, setPasswordWithToken } from '@/lib/doctor/account';

const NO_DB = 'The portal needs the site’s database, which is not configured on this server (set DATABASE_URL).';
const NO_SECRET = 'Sign-in is not set up on this server (DOCTOR_SESSION_SECRET).';
const UNAVAILABLE = 'This is unavailable right now. Try again shortly.';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emailFrom = (form: FormData) => String(form.get('email') ?? '').trim().toLowerCase().slice(0, 254);

async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown';
}

/* --------------------------------------------------------------- sign in */

export type SignInState = { error: string | null; email: string };

// One wording for a wrong password, an unknown email and an account nobody has
// claimed yet, so the form never confirms which addresses are doctors.
const NOT_RECOGNISED = 'Email or password not recognised.';

export async function signIn(_prev: SignInState, form: FormData): Promise<SignInState> {
  const email = emailFrom(form);
  const password = String(form.get('password') ?? '').slice(0, 256);
  if (!email || !password) return { error: 'Enter your email and password.', email };

  const db = await getDb();
  if (!db) return { error: NO_DB, email };
  let doctor;
  try {
    if (!(await doctorLoginAllowed(db, await clientIp(), email))) return { error: 'Too many attempts. Try again in ten minutes.', email };
    doctor = await verifyDoctorCredentials(db, email, password);
  } catch {
    return { error: UNAVAILABLE, email };
  }
  if (!doctor) return { error: NOT_RECOGNISED, email };
  if (!(await startDoctorSession(doctor))) return { error: NO_SECRET, email };
  redirect('/doctor'); // throws, so it sits outside any try
}

export async function signOut() {
  await endDoctorSession();
  redirect('/doctor/login');
}

/* ------------------------------------------------------ asking for a link */

export type LinkState = { error: string | null; sent: boolean; email: string };

// The same answer whether or not the address belongs to a GP, and whether or
// not the throttle let an email out: the form must not be a way to find out
// who has signed up.
export async function requestLink(_prev: LinkState, form: FormData): Promise<LinkState> {
  const email = emailFrom(form);
  if (!EMAIL.test(email)) return { error: 'Enter a valid email address, like name@example.com.', sent: false, email };

  const db = await getDb();
  if (!db) return { error: NO_DB, sent: false, email };
  try {
    if (await linkAllowed(db, await clientIp(), email)) await requestSetPasswordLink(db, email);
  } catch {
    return { error: UNAVAILABLE, sent: false, email };
  }
  return { error: null, sent: true, email };
}

/* ---------------------------------------------------- setting a password */

export type SetPasswordState = { error: string | null };

export async function setPassword(_prev: SetPasswordState, form: FormData): Promise<SetPasswordState> {
  const token = String(form.get('token') ?? '').slice(0, 200);
  const password = String(form.get('password') ?? '');
  const confirm = String(form.get('confirm') ?? '');
  if (password !== confirm) return { error: 'The two passwords do not match.' };

  const db = await getDb();
  if (!db) return { error: NO_DB };
  let result;
  try {
    result = await setPasswordWithToken(db, token, password);
  } catch {
    return { error: UNAVAILABLE };
  }
  if (!result.ok) {
    if (result.error === 'weak_password') return { error: `Use at least ${PASSWORD_MIN} characters.` };
    if (result.error === 'gmc_taken') return { error: 'An account already exists for this GMC number. Contact us and we will sort it out.' };
    return { error: 'This link has expired or has already been used. Ask for a new one.' };
  }
  if (!(await startDoctorSession(result.gp))) return { error: NO_SECRET };
  redirect('/doctor');
}
