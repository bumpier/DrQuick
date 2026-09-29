// POST /api/waitlist
//   patient: { email, role: "patient", source }
//   gp:      { name, email, mobile, gmc, role: "gp", source }
//
// A patient is subscribing, so email is still the only thing asked or stored.
// A GP is applying, so the sign-up carries the four fields the register check
// needs. No IP is retained in either case: the rate-limit key is a salted hash
// with a short TTL and is never written into the waitlist record.
//
// DEPLOY / LEGAL: the GP record is real personal data — a name, a mobile number
// and a GMC reference are identifying on their own and together. UK GDPR Art 13
// requires the controller's registered name and address and a working privacy
// contact at the point of collection, and PRODUCT.md still records the legal
// entity as undecided. Do not point this route at a live store until those are
// filled in on the page.
//
// The client validates these fields too; this is the authority. Both read the
// same rules from lib/gp-signup so they cannot drift.
//
// Stored in Postgres (lib/waitlist.ts). Optional attribution — the analytics
// visitor id, first-touch UTM tags, referrer and landing path — rides along so
// the admin can show how each person found the site and what they read first.
// Emails are sent after the write and can never fail the sign-up.
// Other verbs get the framework's own 405 — only POST is exported.
import { getDb } from '@/lib/db';
import { hashKey, hit } from '@/lib/rate-limit';
import { cleanAttribution, joinWaitlist } from '@/lib/waitlist';
import { sendSignupEmails } from '@/lib/email';
import { MAX_EMAIL, firstInvalidField, normaliseEmail, normaliseGpSignup } from '@/lib/gp-signup';

export const runtime = 'nodejs';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = new Set(['patient', 'gp']);

const RATE_MAX = 5;      // submissions per window, per client
const RATE_WINDOW = 600; // seconds
const MAX_BODY = 8192;

function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for') ?? '';
  const first = fwd.split(',')[0].trim();
  return first || (request.headers.get('x-real-ip') ?? '').trim();
}

const json = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request) {
  const db = await getDb().catch((err) => {
    console.error('Database unavailable:', (err as Error).message);
    return null;
  });
  if (!db) {
    console.error('Waitlist store is not configured: set DATABASE_URL.');
    return json(503, { ok: false, error: 'store_unavailable' });
  }

  let payload: Record<string, unknown>;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) throw new Error('PAYLOAD_TOO_LARGE');
    payload = text ? JSON.parse(text) : {};
  } catch {
    return json(400, { ok: false, error: 'bad_request' });
  }

  const role = String(payload.role || '').trim();
  const source = String(payload.source || 'landing').trim().slice(0, 40);

  // Honeypot: any value here means a bot filled a field a human cannot see.
  if (payload.company) return json(200, { ok: true, alreadyJoined: false });

  if (!ROLES.has(role)) {
    return json(400, { ok: false, error: 'invalid_role' });
  }

  // The two roles collect different things, so they are validated differently and
  // stored with different shapes. `error` names the offending field so the form
  // can point at it rather than showing a generic failure over a fixable form.
  let email: string;
  let details: Record<string, string> = {};
  if (role === 'gp') {
    const signup = normaliseGpSignup(payload);
    const bad = firstInvalidField(signup);
    if (bad) return json(400, { ok: false, error: `invalid_${bad}` });
    email = signup.email;
    details = { name: signup.name, mobile: signup.mobile, gmc: signup.gmc };
  } else {
    email = normaliseEmail(payload.email);
    if (!EMAIL.test(email) || email.length > MAX_EMAIL) {
      return json(400, { ok: false, error: 'invalid_email' });
    }
  }

  try {
    const ip = clientIp(request);
    if (ip && (await hit(db, hashKey('rl:waitlist', ip), RATE_WINDOW)) > RATE_MAX) {
      return json(429, { ok: false, error: 'rate_limited' });
    }

    const { signup, alreadyJoined } = await joinWaitlist(db, {
      role: role as 'patient' | 'gp', email, source, ...details, ...cleanAttribution(payload),
    });
    if (!alreadyJoined) await sendSignupEmails(db, signup);

    return json(200, { ok: true, alreadyJoined });
  } catch (err) {
    console.error('Waitlist write failed:', (err as Error).message);
    return json(502, { ok: false, error: 'store_write_failed' });
  }
}
