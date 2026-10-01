// The Stripe API, server-only: the one place a Checkout Session is created or
// read. The webhook (lib/finance/stripe-webhook.ts) verifies signatures by hand
// and needs no client; everything that calls Stripe goes through here.
//
//   STRIPE_SECRET_KEY   unset: the GP sign-up answers 'payments_unavailable'
//                       and nothing is charged. Prefer a restricted key (rk_…)
//                       with Checkout Sessions write and read, nothing else.
//
// The key is read per call, not at module load, so a build with no key works
// and tests can stub it. It is never logged and never sent to the browser.
import Stripe from 'stripe';
import { siteUrl } from '@/lib/site-url';
import {
  GP_FEE_KIND, GP_FEE_PRODUCT, GP_FEE_PRODUCT_DESCRIPTION, GP_FEE_REFUND, GP_SIGNUP_FEE_PENCE,
} from '@/lib/gp-fee';

export const checkoutConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);

let cached: { key: string; client: Stripe } | null = null;

function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  if (cached?.key !== key) cached = { key, client: new Stripe(key, { maxNetworkRetries: 2, timeout: 10_000 }) };
  return cached.client;
}

// Tags these sessions in the Stripe Dashboard so this flow can be told apart
// from any other checkout added later.
const INTEGRATION = 'gp-signup-fee-qhvtmzkd';

// Stripe allows 30 minutes to 24 hours.
const CHECKOUT_LIFETIME_SECONDS = 60 * 60;

const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Stripe's hosted payment page for one GP's sign-up fee. Only the sign-up id
 * and the email travel to Stripe: the name, mobile and GMC number stay here.
 * The return addresses are built from NEXT_PUBLIC_SITE_URL, never from a
 * request header, so a forged Host cannot send a paying doctor somewhere else.
 */
export async function createFeeCheckout(signup: { id: string; email: string }): Promise<{ id: string; url: string }> {
  const origin = siteUrl().origin;
  const metadata = { kind: GP_FEE_KIND, signup_id: signup.id };
  const session = await stripeClient().checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'gbp',
        unit_amount: GP_SIGNUP_FEE_PENCE,
        product_data: { name: GP_FEE_PRODUCT, description: GP_FEE_PRODUCT_DESCRIPTION },
      },
    }],
    customer_email: signup.email,
    client_reference_id: signup.id,
    metadata,
    payment_intent_data: { metadata, description: GP_FEE_PRODUCT },
    submit_type: 'pay',
    custom_text: { submit: { message: GP_FEE_REFUND } },
    integration_identifier: INTEGRATION,
    // The fee is the fee, in pounds: no local-currency conversion, so the
    // amount that comes back can be checked against it exactly.
    adaptive_pricing: { enabled: false },
    // An abandoned checkout stops being payable after an hour, not a day.
    expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_LIFETIME_SECONDS,
    // {CHECKOUT_SESSION_ID} is Stripe's own template; it fills it in.
    success_url: `${origin}/gp/welcome?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?checkout=cancelled#gp-join`,
  });
  if (!session.url) throw new Error('Stripe returned a session with no URL');
  return { id: session.id, url: session.url };
}

// What a paid session tells us, in the shape the store wants.
export type FeePayment = {
  signupId: string;
  sessionId: string;
  paymentIntentId: string | null;
  amountPence: number;
  paidAt: Date;
};

/**
 * Closes a checkout that is still open, so it can no longer be paid: called
 * before a second one is started for the same sign-up (two open checkouts are
 * two chances to pay twice) and when a sign-up is erased. Best effort and
 * silent: a session that is already paid or expired cannot be expired, and
 * that is not a failure.
 */
export async function expireFeeCheckout(sessionId: string | null | undefined): Promise<void> {
  if (!sessionId || !SESSION_ID.test(sessionId) || !checkoutConfigured()) return;
  try {
    await stripeClient().checkout.sessions.expire(sessionId);
  } catch {
    // Already complete or already expired.
  }
}

type SessionLike = {
  id?: unknown; metadata?: unknown; payment_status?: unknown; payment_intent?: unknown;
  amount_total?: unknown; currency?: unknown; created?: unknown;
};

export function isFeeSession(session: SessionLike): boolean {
  const meta = (session.metadata ?? {}) as Record<string, unknown>;
  return meta.kind === GP_FEE_KIND && typeof meta.signup_id === 'string' && UUID.test(meta.signup_id);
}

/**
 * Reads a Checkout Session, whether it came from the SDK or from a webhook
 * body. `null` for a session that is not this fee or is not paid: one that
 * completed with a delayed payment method is still 'unpaid', and the fee is
 * only ever recorded once the money has actually arrived.
 *
 * "Paid" means the whole fee, in pounds. A session that completed for nothing
 * (a coupon, a promotion code switched on later) or for some other amount is
 * not the fee being paid, whatever its metadata says. If the fee ever changes,
 * checkouts started at the old amount and paid after the change are refused
 * here and need recording by hand.
 */
export function feePaymentFrom(session: SessionLike, now = new Date()): FeePayment | null {
  if (!isFeeSession(session) || typeof session.id !== 'string') return null;
  if (session.payment_status !== 'paid') return null;
  if (session.amount_total !== GP_SIGNUP_FEE_PENCE || String(session.currency).toLowerCase() !== 'gbp') return null;
  const intent = session.payment_intent;
  const paymentIntentId = typeof intent === 'string' ? intent
    : intent && typeof intent === 'object' && typeof (intent as { id?: unknown }).id === 'string' ? (intent as { id: string }).id
    : null;
  const created = Number(session.created);
  return {
    signupId: ((session.metadata as Record<string, string>).signup_id).toLowerCase(),
    sessionId: session.id,
    paymentIntentId,
    amountPence: GP_SIGNUP_FEE_PENCE,
    paidAt: Number.isFinite(created) && created > 0 ? new Date(created * 1000) : now,
  };
}

export type FeeCheckoutState =
  | { state: 'paid'; payment: FeePayment }
  | { state: 'processing' }   // completed with a delayed method; the webhook will finish it
  | { state: 'open' }         // never completed
  | { state: 'unknown' };     // not a session id, not ours, or Stripe could not be reached

/** Looks a session up for the welcome page. Never throws. */
export async function readFeeCheckout(sessionId: string | null | undefined): Promise<FeeCheckoutState> {
  if (!sessionId || !SESSION_ID.test(sessionId) || !checkoutConfigured()) return { state: 'unknown' };
  try {
    const session = await stripeClient().checkout.sessions.retrieve(sessionId);
    if (!isFeeSession(session)) return { state: 'unknown' };
    const payment = feePaymentFrom(session);
    if (payment) return { state: 'paid', payment };
    return { state: session.status === 'complete' ? 'processing' : 'open' };
  } catch (err) {
    console.error('Stripe session lookup failed:', (err as Error).message);
    return { state: 'unknown' };
  }
}
