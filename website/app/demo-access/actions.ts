'use server';
// The demo deployment's passcode (lib/demo/session.ts). A server action is a
// POST Next checks for same origin; it is still treated as an untrusted entry
// point: it refuses outside the demo, and it is the only way in without the
// session (proxy.ts lets /demo-access through).
//
// Ten attempts per ten minutes per client address, right or wrong, counted
// before the passcode is compared; the comparison does the same work for any
// attempt. Without the database there is no rate limit, so no way in.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { clientIp } from '@/lib/client-ip';
import { getDb } from '@/lib/db';
import { demoMode } from '@/lib/demo';
import {
  DEMO_COOKIE, demoConfigured, demoCookieOptions, passcodeMatches, safeNext, signDemoSession,
} from '@/lib/demo/session';
import { hashKey, hit } from '@/lib/rate-limit';

export type DemoAccessState = { error: string | null };

const ATTEMPTS = 10;
const WINDOW_SECONDS = 600;
const WRONG = 'That passcode isn\'t right.';
const UNAVAILABLE = 'The demo is unavailable right now. Try again shortly.';

export async function enterDemo(_prev: DemoAccessState, form: FormData): Promise<DemoAccessState> {
  if (!demoMode() || !demoConfigured()) return { error: UNAVAILABLE };
  const attempt = String(form.get('passcode') ?? '').slice(0, 256);
  if (!attempt.trim()) return { error: 'Enter the passcode.' };

  const db = await getDb();
  if (!db) return { error: UNAVAILABLE };
  try {
    if ((await hit(db, hashKey('rl:demo-access', await clientIp()), WINDOW_SECONDS)) > ATTEMPTS) {
      return { error: 'Too many attempts. Try again in ten minutes.' };
    }
  } catch {
    return { error: UNAVAILABLE };
  }

  if (!passcodeMatches(attempt)) return { error: WRONG };
  const token = signDemoSession();
  if (!token) return { error: UNAVAILABLE };
  (await cookies()).set(DEMO_COOKIE, token, demoCookieOptions());
  redirect(safeNext(form.get('next'))); // throws, so it sits outside any try
}
