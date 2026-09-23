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
// Other verbs get the framework's own 405 — only POST is exported.
import { createHash } from 'node:crypto';
import { configured, pipeline } from '@/lib/waitlist-store';
import { MAX_EMAIL, firstInvalidField, normaliseEmail, normaliseGpSignup } from '@/lib/gp-signup';

export const runtime = 'nodejs';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = new Set(['patient', 'gp']);

const RATE_MAX = 5;      // submissions per window, per client
const RATE_WINDOW = 600; // seconds
const MAX_BODY = 4096;

function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for') ?? '';
  const first = fwd.split(',')[0].trim();
  return first || (request.headers.get('x-real-ip') ?? '').trim();
}

function clientKey(ip: string): string {
  const salt = process.env.RATE_LIMIT_SALT || 'dr-quick-waitlist';
  return createHash('sha256').update(salt + '|' + ip).digest('hex').slice(0, 24);
}

const json = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request) {
  if (!configured()) {
    console.error('Waitlist store is not configured: set KV_REST_API_URL and KV_REST_API_TOKEN.');
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
    if (ip) {
      const key = `rl:${clientKey(ip)}`;
      const [hits] = await pipeline([['INCR', key], ['EXPIRE', key, String(RATE_WINDOW), 'NX']]);
      if (Number(hits) > RATE_MAX) {
        return json(429, { ok: false, error: 'rate_limited' });
      }
    }

    const record = JSON.stringify({ email, role, ...details, source, joinedAt: new Date().toISOString() });
    // SADD reports 1 on a genuinely new address and 0 on a repeat. The hash is keyed
    // by role AND email so someone who signs up as both a patient and a GP keeps two
    // records instead of the second silently overwriting the first.
    const [added] = await pipeline([
      ['SADD', `waitlist:${role}`, email],
      ['HSET', 'waitlist:entries', `${role}:${email}`, record],
    ]);

    return json(200, { ok: true, alreadyJoined: Number(added) === 0 });
  } catch (err) {
    console.error('Waitlist write failed:', (err as Error).message);
    return json(502, { ok: false, error: 'store_write_failed' });
  }
}
