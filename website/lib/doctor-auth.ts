// Doctor sign-in for the portal at /doctor. Server-only. Modelled on
// lib/admin-auth.ts, with one difference: accounts live in the gps table, not
// in an environment variable.
//
// A session is a signed token (lib/signed-token.ts) holding the GP's id and the
// session epoch it was signed under, keyed by DOCTOR_SESSION_SECRET, in an
// httpOnly, SameSite=Strict cookie scoped to /doctor. Every read loads the GP
// again, so offboarding a doctor or changing their password (which bumps the
// epoch) ends their sessions on the next request.
//
// The proxy (proxy.ts) only redirects when the cookie is missing; the real
// check is requireDoctor() here, in the portal layout, in every page and in
// every server action.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { hashPassword, verifyPassword } from '@/lib/admin-auth';
import { getDb, type DB } from '@/lib/db';
import { gps } from '@/lib/db/schema';
import { hashKey, hit } from '@/lib/rate-limit';
import { readToken, signToken } from '@/lib/signed-token';

export const DOCTOR_COOKIE = 'dq_doctor';
// Longer than the admin's eight hours: a GP signs in once for a day's sessions.
export const DOCTOR_SESSION_HOURS = 12;

export type GpRow = typeof gps.$inferSelect;
// What the rest of the app handles. The hash never leaves this file, so it can
// never be passed to a client component by mistake.
export type Doctor = Omit<GpRow, 'passwordHash'>;

const withoutHash = ({ passwordHash: _hash, ...doctor }: GpRow): Doctor => doctor;

export const normaliseEmail = (email: string) => email.trim().toLowerCase();

/* ------------------------------------------------------------- sessions */

function secret(): string | null {
  const s = process.env.DOCTOR_SESSION_SECRET ?? '';
  return s.length >= 32 ? s : null; // a short secret signs nothing
}

export function signDoctorSession(gp: Pick<GpRow, 'id' | 'sessionEpoch'>, now = Date.now()): string | null {
  const key = secret();
  if (!key) return null;
  return signToken({ gp: gp.id, epoch: gp.sessionEpoch, exp: now + DOCTOR_SESSION_HOURS * 3600_000 }, key);
}

// The doctor a token belongs to, if it is genuine and unexpired, was signed
// under their current epoch, and they may still sign in.
export async function doctorForSession(db: DB, token: string | undefined, now = Date.now()): Promise<Doctor | null> {
  const key = secret();
  if (!key) return null;
  const data = readToken(token, key, now);
  if (!data || typeof data.gp !== 'string' || typeof data.epoch !== 'number') return null;
  const [row] = await db.select().from(gps).where(eq(gps.id, data.gp));
  if (!row || row.status === 'offboarded' || row.sessionEpoch !== data.epoch) return null;
  return withoutHash(row);
}

export async function currentDoctor(): Promise<Doctor | null> {
  const token = (await cookies()).get(DOCTOR_COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  return db ? doctorForSession(db, token) : null;
}

export async function requireDoctor(): Promise<Doctor> {
  const doctor = await currentDoctor();
  if (!doctor) redirect('/doctor/login');
  return doctor;
}

// Only from a server action: cookies can be set nowhere else. Never call this
// from anything polled; setting a cookie re-renders the page.
export async function startDoctorSession(gp: Pick<GpRow, 'id' | 'sessionEpoch'>): Promise<boolean> {
  const token = signDoctorSession(gp);
  if (!token) return false;
  (await cookies()).set(DOCTOR_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/doctor',
    maxAge: DOCTOR_SESSION_HOURS * 3600,
  });
  return true;
}

export async function endDoctorSession() {
  (await cookies()).delete({ name: DOCTOR_COOKIE, path: '/doctor' });
}

/* ---------------------------------------------------------- credentials */

// An unknown email, and an account with no password yet, still cost one scrypt,
// so the response time never says which addresses are doctors.
const DECOY = hashPassword('decoy', Buffer.alloc(16));

export async function verifyDoctorCredentials(db: DB, email: string, password: string): Promise<Doctor | null> {
  const [row] = await db.select().from(gps).where(eq(gps.email, normaliseEmail(email)));
  const ok = verifyPassword(password, row?.passwordHash ?? DECOY);
  return ok && row?.passwordHash && row.status !== 'offboarded' ? withoutHash(row) : null;
}

/* ------------------------------------------------------------- throttle */

// Five attempts per ten minutes per IP and email, in the rate_limits table (a
// salted hash as the key, never the raw IP).
const ATTEMPTS = 5;
const WINDOW_S = 600;

export async function doctorLoginAllowed(db: DB, ip: string, email: string, now = new Date()): Promise<boolean> {
  return (await hit(db, hashKey('rl:doctor', ip, normaliseEmail(email)), WINDOW_S, now)) <= ATTEMPTS;
}
