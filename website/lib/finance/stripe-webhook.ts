// Stripe webhooks without the Stripe SDK: signature verification by hand
// (node:crypto) and the mapping from Stripe events onto the finance tables.
// app/api/webhooks/stripe/route.ts is the thin HTTP wrapper around this.
//
// Verification follows Stripe's scheme: the Stripe-Signature header carries
// t=<unix seconds> and one or more v1=<hex HMAC-SHA256 of "t.rawBody"> keyed
// with the endpoint's signing secret (whsec_…). The raw body must be the exact
// bytes Stripe sent — never re-serialised JSON — and a timestamp more than five
// minutes from now is refused, which stops a captured request being replayed.
//
// Handling is idempotent twice over: each event id is recorded in
// stripe_events in the same transaction as its effect (a redelivery is a
// no-op, a failure rolls both back so Stripe's retry applies it), and every
// effect is itself safe to repeat (unique refund ids, status moves that never
// go backwards).
import { createHmac, timingSafeEqual } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { DB } from '@/lib/db';
import { rowsOf } from '@/lib/rate-limit';

export const TOLERANCE_SECONDS = 300;

export type VerifyResult = { ok: true } | { ok: false; reason: 'missing_header' | 'malformed' | 'stale' | 'bad_signature' };

export function signPayload(rawBody: string, secret: string, timestamp: number): string {
  return createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex');
}

export function verifyStripeSignature(
  rawBody: string,
  header: string | null | undefined,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  tolerance = TOLERANCE_SECONDS,
): VerifyResult {
  if (!header) return { ok: false, reason: 'missing_header' };
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(',')) {
    const [key, value] = part.trim().split('=', 2);
    if (key === 't' && /^\d+$/.test(value ?? '')) timestamp = Number(value);
    if (key === 'v1' && value) signatures.push(value);
  }
  if (timestamp === null || signatures.length === 0) return { ok: false, reason: 'malformed' };
  if (Math.abs(nowSeconds - timestamp) > tolerance) return { ok: false, reason: 'stale' };

  const expected = Buffer.from(signPayload(rawBody, secret, timestamp), 'hex');
  const match = signatures.some((sig) => {
    if (!/^[0-9a-f]+$/i.test(sig)) return false;
    const given = Buffer.from(sig, 'hex');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  return match ? { ok: true } : { ok: false, reason: 'bad_signature' };
}

/* ------------------------------------------------------------ handling */

export type StripeEvent = {
  id: string;
  type: string;
  created: number;
  data: { object: Record<string, unknown> };
};

export function parseEvent(rawBody: string): StripeEvent | null {
  try {
    const e = JSON.parse(rawBody) as Partial<StripeEvent>;
    if (typeof e?.id !== 'string' || typeof e.type !== 'string' || typeof e.data?.object !== 'object' || !e.data.object) return null;
    return { id: e.id, type: e.type, created: Number(e.created) || Math.floor(Date.now() / 1000), data: { object: e.data.object } };
  } catch {
    return null;
  }
}

export const HANDLED_EVENTS = [
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'charge.refunded',
  'refund.created',
  'refund.updated',
  'transfer.created',
  'transfer.paid',
  'transfer.reversed',
  'transfer.failed',
] as const;

export type Outcome = 'applied' | 'duplicate' | 'ignored';

const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
const at = (seconds: unknown, fallback: number) => new Date((Number(seconds) || fallback) * 1000).toISOString();

type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];

// A refund object (from refund.* events, or listed on a charge) onto the
// refunds table: inserted once per Stripe refund id; a refund that failed or
// was cancelled is removed, so it stops counting.
async function applyRefund(tx: Tx, refund: Record<string, unknown>, intentFallback: string | null, created: number) {
  const refundId = str(refund.id);
  const intent = str(refund.payment_intent) ?? intentFallback;
  if (!refundId || !intent) return;
  const status = str(refund.status) ?? 'succeeded';
  if (status === 'failed' || status === 'canceled') {
    await tx.execute(sql`delete from refunds where stripe_refund_id = ${refundId}`);
    return;
  }
  const [payment] = rowsOf<{ id: string }>(await tx.execute(sql`select id from payments where stripe_payment_intent_id = ${intent}`));
  if (!payment) return; // not a payment this site made
  await tx.execute(sql`
    insert into refunds (payment_id, amount_pence, reason, stripe_refund_id, created_at)
    values (${payment.id}, ${Math.round(Number(refund.amount) || 0)}, ${str(refund.reason)}, ${refundId}, ${at(refund.created, created)})
    on conflict (stripe_refund_id) do nothing`);
}

async function apply(tx: Tx, event: StripeEvent) {
  const o = event.data.object;
  const id = str(o.id);
  if (!id) return;
  switch (event.type) {
    case 'payment_intent.succeeded':
      await tx.execute(sql`
        update payments set status = 'succeeded', paid_at = coalesce(paid_at, ${at(o.created, event.created)}::timestamptz)
        where stripe_payment_intent_id = ${id}`);
      return;
    case 'payment_intent.payment_failed':
      // A later failure never undoes a success.
      await tx.execute(sql`update payments set status = 'failed' where stripe_payment_intent_id = ${id} and status = 'pending'`);
      return;
    case 'charge.refunded': {
      // Charges no longer list their refunds by default; refund.created carries
      // them then. Either way each refund id is inserted once.
      const list = (o.refunds as { data?: unknown[] } | undefined)?.data ?? [];
      for (const r of list) if (r && typeof r === 'object') await applyRefund(tx, r as Record<string, unknown>, str(o.payment_intent), event.created);
      return;
    }
    case 'refund.created':
    case 'refund.updated':
      await applyRefund(tx, o, null, event.created);
      return;
    case 'transfer.created':
      await tx.execute(sql`update payouts set status = 'processing' where stripe_transfer_id = ${id} and status = 'pending'`);
      return;
    case 'transfer.paid':
      await tx.execute(sql`
        update payouts set status = 'paid', paid_at = coalesce(paid_at, ${at(event.created, event.created)}::timestamptz)
        where stripe_transfer_id = ${id} and status <> 'paid'`);
      return;
    case 'transfer.reversed':
    case 'transfer.failed':
      await tx.execute(sql`update payouts set status = 'failed', paid_at = null where stripe_transfer_id = ${id}`);
      return;
  }
}

export async function handleStripeEvent(db: DB, event: StripeEvent): Promise<Outcome> {
  if (!(HANDLED_EVENTS as readonly string[]).includes(event.type)) return 'ignored';
  return db.transaction(async (tx) => {
    const fresh = rowsOf<{ id: string }>(await tx.execute(sql`
      insert into stripe_events (id, type) values (${event.id}, ${event.type}) on conflict (id) do nothing returning id`));
    if (fresh.length === 0) return 'duplicate';
    await apply(tx, event);
    return 'applied';
  });
}

export const stripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
