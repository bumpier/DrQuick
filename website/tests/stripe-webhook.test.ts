import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { resetDb, useTestDb } from './helpers/db';
import { setDb, type DB } from '@/lib/db';
import { consultations, patients, payments, payouts, refunds, stripeEvents } from '@/lib/db/schema';
import { handleStripeEvent, signPayload, verifyStripeSignature, type StripeEvent } from '@/lib/finance/stripe-webhook';
import { POST } from '@/app/api/webhooks/stripe/route';

let db: DB;
beforeAll(async () => { db = await useTestDb(); });
beforeEach(async () => {
  setDb(db);
  vi.unstubAllEnvs();
  await resetDb(db);
});

const SECRET = 'whsec_test_secret';
const NOW = 1_790_000_000;
const header = (body: string, t = NOW, secret = SECRET) => `t=${t},v1=${signPayload(body, secret, t)}`;

describe('signature verification', () => {
  const body = JSON.stringify({ id: 'evt_1', type: 'payment_intent.succeeded' });

  test('a valid signature passes, alongside other schemes and extra v1 values', () => {
    expect(verifyStripeSignature(body, header(body), SECRET, NOW)).toEqual({ ok: true });
    const t = NOW - 10;
    const multi = `t=${t},v0=abc,v1=${'0'.repeat(64)},v1=${signPayload(body, SECRET, t)}`;
    expect(verifyStripeSignature(body, multi, SECRET, NOW)).toEqual({ ok: true });
  });

  test('a wrong secret, a changed body or a junk signature fails', () => {
    expect(verifyStripeSignature(body, header(body, NOW, 'whsec_other'), SECRET, NOW)).toEqual({ ok: false, reason: 'bad_signature' });
    expect(verifyStripeSignature(`${body} `, header(body), SECRET, NOW)).toEqual({ ok: false, reason: 'bad_signature' });
    expect(verifyStripeSignature(body, `t=${NOW},v1=zz`, SECRET, NOW)).toEqual({ ok: false, reason: 'bad_signature' });
    expect(verifyStripeSignature(body, `t=${NOW},v1=abcd`, SECRET, NOW)).toEqual({ ok: false, reason: 'bad_signature' });
  });

  test('a missing or malformed header fails', () => {
    expect(verifyStripeSignature(body, null, SECRET, NOW)).toEqual({ ok: false, reason: 'missing_header' });
    expect(verifyStripeSignature(body, 'v1=abc', SECRET, NOW)).toEqual({ ok: false, reason: 'malformed' });
    expect(verifyStripeSignature(body, `t=${NOW}`, SECRET, NOW)).toEqual({ ok: false, reason: 'malformed' });
  });

  test('a timestamp more than five minutes away is stale, even correctly signed', () => {
    expect(verifyStripeSignature(body, header(body, NOW - 301), SECRET, NOW)).toEqual({ ok: false, reason: 'stale' });
    expect(verifyStripeSignature(body, header(body, NOW + 301), SECRET, NOW)).toEqual({ ok: false, reason: 'stale' });
    expect(verifyStripeSignature(body, header(body, NOW - 299), SECRET, NOW)).toEqual({ ok: true });
  });
});

async function seed() {
  const [p] = await db.insert(patients).values({ email: 'p@example.com' }).returning();
  const [c] = await db.insert(consultations).values({
    patientId: p.id, status: 'completed', requestedAt: new Date('2026-09-10T10:00:00Z'),
    pricePence: 4000, gpFeePence: 2800, platformFeePence: 1200,
  }).returning();
  const [pay] = await db.insert(payments).values({ consultationId: c.id, amountPence: 4000, status: 'pending', stripePaymentIntentId: 'pi_1' }).returning();
  const [po] = await db.insert(payouts).values({
    gpId: '33333333-3333-4333-8333-333333333333', periodStart: new Date('2026-09-07'), periodEnd: new Date('2026-09-14'),
    amountPence: 2800, status: 'pending', stripeTransferId: 'tr_1',
  }).returning();
  return { pay, po };
}

const ev = (id: string, type: string, object: Record<string, unknown>): StripeEvent => ({ id, type, created: NOW, data: { object } });

describe('event handling', () => {
  test('payment_intent.succeeded marks the payment paid, once', async () => {
    const { pay } = await seed();
    const e = ev('evt_a', 'payment_intent.succeeded', { id: 'pi_1', created: NOW - 60 });
    expect(await handleStripeEvent(db, e)).toBe('applied');
    expect(await handleStripeEvent(db, e)).toBe('duplicate');
    const [row] = await db.select().from(payments).where(eq(payments.id, pay.id));
    expect(row.status).toBe('succeeded');
    expect(row.paidAt?.getTime()).toBe((NOW - 60) * 1000);
    // A late failure event never undoes the success.
    await handleStripeEvent(db, ev('evt_b', 'payment_intent.payment_failed', { id: 'pi_1' }));
    expect((await db.select().from(payments).where(eq(payments.id, pay.id)))[0].status).toBe('succeeded');
  });

  test('payment_intent.payment_failed fails a pending payment', async () => {
    const { pay } = await seed();
    await handleStripeEvent(db, ev('evt_c', 'payment_intent.payment_failed', { id: 'pi_1' }));
    expect((await db.select().from(payments).where(eq(payments.id, pay.id)))[0].status).toBe('failed');
  });

  test('refunds insert once per Stripe refund, whichever event carries them', async () => {
    const { pay } = await seed();
    const refund = { id: 're_1', amount: 1500, payment_intent: 'pi_1', status: 'succeeded', created: NOW, reason: 'requested_by_customer' };
    await handleStripeEvent(db, ev('evt_d', 'charge.refunded', { id: 'ch_1', payment_intent: 'pi_1', refunds: { data: [refund] } }));
    await handleStripeEvent(db, ev('evt_e', 'refund.created', refund));
    // A replay under a new event id (Stripe can send the same change twice).
    await handleStripeEvent(db, ev('evt_f', 'refund.updated', refund));
    const rows = await db.select().from(refunds);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ paymentId: pay.id, amountPence: 1500, stripeRefundId: 're_1' });
    // A refund that later fails stops counting.
    await handleStripeEvent(db, ev('evt_g', 'refund.updated', { ...refund, status: 'failed' }));
    expect(await db.select().from(refunds)).toHaveLength(0);
    // A refund for a payment this site never made is ignored.
    await handleStripeEvent(db, ev('evt_h', 'refund.created', { ...refund, id: 're_2', payment_intent: 'pi_other' }));
    expect(await db.select().from(refunds)).toHaveLength(0);
  });

  test('transfers move payouts forward: processing, paid, or failed on reversal', async () => {
    const { po } = await seed();
    const status = async () => (await db.select().from(payouts).where(eq(payouts.id, po.id)))[0];
    await handleStripeEvent(db, ev('evt_i', 'transfer.created', { id: 'tr_1' }));
    expect((await status()).status).toBe('processing');
    await handleStripeEvent(db, ev('evt_j', 'transfer.paid', { id: 'tr_1' }));
    expect(await status()).toMatchObject({ status: 'paid', paidAt: new Date(NOW * 1000) });
    await handleStripeEvent(db, ev('evt_k', 'transfer.reversed', { id: 'tr_1' }));
    expect(await status()).toMatchObject({ status: 'failed', paidAt: null });
  });

  test('other event types are ignored and not recorded', async () => {
    await seed();
    expect(await handleStripeEvent(db, ev('evt_z', 'customer.created', { id: 'cus_1' }))).toBe('ignored');
    expect(await db.select().from(stripeEvents)).toHaveLength(0);
  });
});

describe('the route', () => {
  const post = (body: string, sig?: string) => POST(new Request('http://localhost/api/webhooks/stripe', {
    method: 'POST', body, headers: sig ? { 'stripe-signature': sig } : {},
  }));

  test('answers 501 until both Stripe variables are set', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', '');
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', SECRET);
    const res = await post('{}');
    expect(res.status).toBe(501);
    expect(await res.json()).toEqual({ error: 'stripe_not_configured' });
  });

  test('refuses a bad signature and applies a good one', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'rk_test_x');
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', SECRET);
    const { pay } = await seed();
    const body = JSON.stringify(ev('evt_r', 'payment_intent.succeeded', { id: 'pi_1' }));
    const now = Math.floor(Date.now() / 1000);
    expect((await post(body)).status).toBe(400);
    expect((await post(body, header(body, now, 'whsec_wrong'))).status).toBe(400);
    const ok = await post(body, header(body, now));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ received: true, outcome: 'applied' });
    expect(await (await post(body, header(body, now))).json()).toEqual({ received: true, outcome: 'duplicate' });
    expect((await db.select().from(payments).where(eq(payments.id, pay.id)))[0].status).toBe('succeeded');
  });
});
