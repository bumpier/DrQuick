// POST /api/gp-signup
//   { name, email, mobile, gmc, source, company?, …attribution }
//
// The GP sign-up, which now ends in a payment: the details are validated and
// stored as an unpaid application, a Stripe Checkout Session is created for the
// sign-up fee (lib/gp-fee.ts), and the browser is sent Stripe's hosted payment
// page. The fee is recorded as paid by the webhook (app/api/webhooks/stripe),
// and by the welcome page as a second, idempotent path; never here, and never
// on the say-so of anything the browser sends back.
//
// Answers:
//   200 { ok, url }              go to Stripe
//   200 { ok, alreadyPaid }      this address has already paid; nothing to do
//   400 invalid_<field> | bad_request
//   429 rate_limited
//   503 store_unavailable | payments_unavailable   (nothing stored, nothing charged)
//   502 store_write_failed | checkout_failed
//
// The client validates the fields too; this is the authority, and both read the
// same rules from lib/gp-signup. No IP is retained: the rate-limit keys are
// salted hashes with a short TTL.
//
// What this route cannot hide: `alreadyPaid` tells a caller that an address has
// signed up and paid. Hiding it would mean sending a paid doctor to pay again.
// The limits below bound how fast anyone can ask.
//
// The client address is the first X-Forwarded-For entry, as in the other
// routes. That is right behind Caddy (scripts/deploy.sh), which replaces the
// header with the real address; behind a proxy that passes a client-supplied
// header through, it would be forgeable, and the per-address limit is what
// would still hold.
//
// DEPLOY / LEGAL: this route takes personal data and money. UK GDPR Art 13
// needs the controller's registered name and address at the point of
// collection, and the fee needs terms a doctor can read before paying. Both
// wait on the legal entity (PRODUCT.md); do not switch live keys on before
// they are in place.
import { getDb } from '@/lib/db';
import { hashKey, hit } from '@/lib/rate-limit';
import { cleanAttribution, recordFeeCheckout, startGpSignup } from '@/lib/waitlist';
import { firstInvalidField, normaliseGpSignup } from '@/lib/gp-signup';
import { checkoutConfigured, createFeeCheckout, expireFeeCheckout } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RATE_MAX = 5;           // submissions per window, per client and per email address
const RATE_MAX_UNKNOWN = 30;  // per window, shared by every request with no client address
const RATE_WINDOW = 600;      // seconds
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
  if (!db) return json(503, { ok: false, error: 'store_unavailable' });

  let payload: Record<string, unknown>;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) throw new Error('PAYLOAD_TOO_LARGE');
    payload = text ? JSON.parse(text) : {};
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('NOT_AN_OBJECT');
  } catch {
    return json(400, { ok: false, error: 'bad_request' });
  }

  // Honeypot: any value here means a bot filled a field a human cannot see. It
  // is told what a doctor who has already paid is told, and nothing happens.
  if (payload.company) return json(200, { ok: true, alreadyPaid: true });

  const details = normaliseGpSignup(payload);
  const bad = firstInvalidField(details);
  if (bad) return json(400, { ok: false, error: `invalid_${bad}` });

  // Checked before anything is stored: a doctor's details are not kept for a
  // sign-up that cannot be completed.
  if (!checkoutConfigured()) {
    console.error('GP sign-up refused: STRIPE_SECRET_KEY is not set.');
    return json(503, { ok: false, error: 'payments_unavailable' });
  }

  let signup;
  try {
    // Three limits, because each submission can create a Stripe session and
    // each one names an email address the sender may not own: per client; one
    // shared, looser bucket for requests that arrive with no client address
    // (so a missing header is never a way round the limit); and per address
    // named, which holds whatever the sender's own address claims to be.
    const ip = clientIp(request);
    const byClient = ip
      ? (await hit(db, hashKey('rl:gp-signup', ip), RATE_WINDOW)) > RATE_MAX
      : (await hit(db, hashKey('rl:gp-signup', 'no-address'), RATE_WINDOW)) > RATE_MAX_UNKNOWN;
    if (byClient || (await hit(db, hashKey('rl:gp-signup-email', details.email), RATE_WINDOW)) > RATE_MAX) {
      return json(429, { ok: false, error: 'rate_limited' });
    }
    const source = String(payload.source || 'landing').trim().slice(0, 40);
    const started = await startGpSignup(db, { ...details, source, ...cleanAttribution(payload) });
    if (started.alreadyPaid) return json(200, { ok: true, alreadyPaid: true });
    signup = started.signup;
  } catch (err) {
    console.error('GP sign-up write failed:', (err as Error).message);
    return json(502, { ok: false, error: 'store_write_failed' });
  }

  try {
    // One open checkout per sign-up: two would be two chances to pay twice.
    await expireFeeCheckout(signup.stripeCheckoutSessionId);
    const session = await createFeeCheckout({ id: signup.id, email: signup.email });
    // The details typed with this checkout, which become the application's
    // only if this checkout is paid. Losing this write loses a correction, not
    // a payment: the webhook finds the row by its id.
    await recordFeeCheckout(db, signup, session.id, { name: details.name, mobile: details.mobile, gmc: details.gmc })
      .catch((err) => console.error('Recording the checkout failed:', (err as Error).message));
    return json(200, { ok: true, url: session.url });
  } catch (err) {
    // The message, never the error object: an SDK error can carry request detail.
    console.error('Stripe checkout failed:', (err as Error).message);
    return json(502, { ok: false, error: 'checkout_failed' });
  }
}
