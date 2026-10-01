import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { resetDb, useTestDb } from './helpers/db';
import { setDb, type DB } from '@/lib/db';
import { appErrors, consultations, emailLog, patients, payments, payouts, refunds, stripeEvents, waitlistSignups } from '@/lib/db/schema';
import { renderFor } from '@/lib/email';
import { handleStripeEvent, signPayload, verifyStripeSignature, type StripeEvent } from '@/lib/finance/stripe-webhook';
import { markFeePaid } from '@/lib/gp-fee-store';
import { feePaymentFrom } from '@/lib/stripe';
import { recordFeeCheckout, startGpSignup } from '@/lib/waitlist';
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

/* The GP sign-up fee (lib/gp-fee.ts). A GP's application is stored unpaid by
   app/api/gp-signup; this is where it becomes paid, and where a refund made in
   the Stripe Dashboard is recorded. */
describe('the GP sign-up fee', () => {
  async function application() {
    const { signup } = await startGpSignup(db, {
      name: 'Dr Jane Okafor', email: 'jane@example.com', mobile: '07700900123', gmc: '1234567', source: 'hero-gp',
    });
    return signup;
  }
  const row = async (id: string) => (await db.select().from(waitlistSignups).where(eq(waitlistSignups.id, id)))[0];
  const session = (signupId: string, over: Record<string, unknown> = {}) => ({
    id: 'cs_test_fee0000000001', object: 'checkout.session', payment_status: 'paid', status: 'complete',
    payment_intent: 'pi_fee_1', amount_total: 5000, currency: 'gbp', created: NOW - 30,
    metadata: { kind: 'gp_signup_fee', signup_id: signupId }, ...over,
  });
  const sent = async () => (await db.select().from(emailLog)).map((l) => [l.to, l.template]);

  test('a completed, paid checkout marks the fee paid and sends the confirmation and the team alert, once', async () => {
    vi.stubEnv('ADMIN_ALERT_EMAILS', 'ops@example.com');
    const s = await application();
    expect(await sent()).toEqual([]);

    expect(await handleStripeEvent(db, ev('evt_fee_1', 'checkout.session.completed', session(s.id)))).toBe('applied');
    expect(await row(s.id)).toMatchObject({
      feeStatus: 'paid', feePence: 5000, feePaidAt: new Date((NOW - 30) * 1000),
      stripeCheckoutSessionId: 'cs_test_fee0000000001', stripePaymentIntentId: 'pi_fee_1',
      status: 'new', // the pipeline is the team's to move, not the payment's
    });
    expect(await sent()).toEqual([['jane@example.com', 'gp_received'], ['ops@example.com', 'admin_new_gp']]);

    // Stripe redelivers the event, and then sends the same news under a new id.
    expect(await handleStripeEvent(db, ev('evt_fee_1', 'checkout.session.completed', session(s.id)))).toBe('duplicate');
    expect(await handleStripeEvent(db, ev('evt_fee_2', 'checkout.session.completed', session(s.id)))).toBe('applied');
    expect(await sent()).toHaveLength(2);
  });

  test('the confirmation states the amount that was actually paid, and the refund promise', async () => {
    const s = await application();
    await handleStripeEvent(db, ev('evt_fee_3', 'checkout.session.completed', session(s.id)));
    const { email } = renderFor(await row(s.id));
    expect(email.subject).toBe('You’re signed up with Dr Quick');
    expect(email.text).toContain('Your £50 sign-up fee is paid');
    expect(email.text).toContain('Refunded in full if we can’t verify your GMC registration or don’t take you on.');
  });

  test('a delayed payment method is not paid at "completed", only when its success arrives', async () => {
    const s = await application();
    await handleStripeEvent(db, ev('evt_fee_4', 'checkout.session.completed', session(s.id, { payment_status: 'unpaid' })));
    expect((await row(s.id)).feeStatus).toBe('unpaid');
    expect(await sent()).toEqual([]);
    await handleStripeEvent(db, ev('evt_fee_5', 'checkout.session.async_payment_succeeded', session(s.id)));
    expect((await row(s.id)).feeStatus).toBe('paid');
    expect(await sent()).toEqual([['jane@example.com', 'gp_received']]);
  });

  test('a checkout that is not a sign-up fee, or names no sign-up of ours, changes nothing', async () => {
    const s = await application();
    await handleStripeEvent(db, ev('evt_fee_6', 'checkout.session.completed', session(s.id, { metadata: { kind: 'something_else', signup_id: s.id } })));
    await handleStripeEvent(db, ev('evt_fee_7', 'checkout.session.completed', session('not-a-uuid')));
    await handleStripeEvent(db, ev('evt_fee_8', 'checkout.session.completed', session('99999999-9999-4999-8999-999999999999')));
    expect((await row(s.id)).feeStatus).toBe('unpaid');
    expect(await sent()).toEqual([]);
  });

  // Paid means the whole fee, in pounds, whatever the metadata says: a session
  // that completed for nothing, or for another amount or currency, is not it.
  test('a session for the wrong amount, the wrong currency or no payment at all is not the fee being paid', async () => {
    const s = await application();
    const cases = [
      { amount_total: 0, payment_status: 'no_payment_required' },
      { amount_total: 0 },
      { amount_total: 4999 },
      { amount_total: 5000, currency: 'usd' },
      { amount_total: '5000' },
    ];
    for (const [i, over] of cases.entries()) {
      await handleStripeEvent(db, ev(`evt_fee_bad_${i}`, 'checkout.session.completed', session(s.id, over)));
    }
    expect((await row(s.id)).feeStatus).toBe('unpaid');
    expect(await sent()).toEqual([]);
  });

  // Anyone can post anyone's email, so the row keeps the first details and a
  // later post's details wait beside its checkout: they take effect only if
  // that checkout is the one paid.
  test('the details typed with the checkout that is paid become the application’s', async () => {
    const s = await application();
    await recordFeeCheckout(db, s, 'cs_test_fee0000000001', { name: 'Dr Jane Okafor', mobile: '07700900123', gmc: '1234567' });
    await recordFeeCheckout(db, await row(s.id), 'cs_test_fee0000000002', { name: 'Dr J. Okafor', mobile: '07700900999', gmc: '7654321' });
    expect(await row(s.id)).toMatchObject({ name: 'Dr Jane Okafor', gmc: '1234567' });

    await handleStripeEvent(db, ev('evt_fee_d1', 'checkout.session.completed', session(s.id, { id: 'cs_test_fee0000000002' })));
    expect(await row(s.id)).toMatchObject({
      feeStatus: 'paid', name: 'Dr J. Okafor', mobile: '07700900999', gmc: '7654321', pendingDetails: null,
    });
    // The confirmation greets the person who paid.
    expect(renderFor(await row(s.id)).email.text).toContain('Hello Dr J. Okafor,');
  });

  test('an unpaid checkout’s details are discarded when another one is paid, and a started application is never rewritten', async () => {
    const s = await application();
    await recordFeeCheckout(db, s, 'cs_test_fee0000000001', { name: 'Dr Jane Okafor', mobile: '07700900123', gmc: '1234567' });
    await recordFeeCheckout(db, await row(s.id), 'cs_test_stranger00001', { name: 'A Stranger', mobile: '07700900000', gmc: '0000000' });
    await handleStripeEvent(db, ev('evt_fee_d2', 'checkout.session.completed', session(s.id)));
    expect(await row(s.id)).toMatchObject({ feeStatus: 'paid', name: 'Dr Jane Okafor', gmc: '1234567', pendingDetails: null });

    await resetDb(db);
    const t = await application();
    await db.update(waitlistSignups).set({ status: 'gmc_verified' }).where(eq(waitlistSignups.id, t.id));
    await recordFeeCheckout(db, await row(t.id), 'cs_test_fee0000000001', { name: 'A Stranger', mobile: '07700900000', gmc: '0000000' });
    await handleStripeEvent(db, ev('evt_fee_d3', 'checkout.session.completed', session(t.id)));
    expect(await row(t.id)).toMatchObject({ feeStatus: 'paid', name: 'Dr Jane Okafor', gmc: '1234567', status: 'gmc_verified' });
  });

  // Money taken that nothing can be attached to goes where the team will see
  // it (the admin's Technical page), with the Stripe reference to refund.
  test('a second payment for a paid sign-up is flagged for a refund, and changes nothing', async () => {
    const s = await application();
    await handleStripeEvent(db, ev('evt_fee_t1', 'checkout.session.completed', session(s.id)));
    await handleStripeEvent(db, ev('evt_fee_t2', 'checkout.session.completed', session(s.id, { id: 'cs_test_fee0000000002', payment_intent: 'pi_fee_2' })));
    expect(await row(s.id)).toMatchObject({ feeStatus: 'paid', stripePaymentIntentId: 'pi_fee_1' });
    expect(await sent()).toHaveLength(1);
    const flagged = (await db.select().from(appErrors)).map((e) => e.message);
    expect(flagged).toEqual([`GP sign-up fee paid twice: payment pi_fee_2 is a second payment for sign-up ${s.id} and needs refunding in Stripe.`]);
    expect(flagged.join()).not.toContain('jane@example.com');
  });

  test('a payment for a sign-up that was withdrawn or erased is flagged for a refund', async () => {
    const s = await application();
    await db.delete(waitlistSignups).where(eq(waitlistSignups.id, s.id));
    expect(await handleStripeEvent(db, ev('evt_fee_9', 'checkout.session.completed', session(s.id)))).toBe('applied');
    expect(await sent()).toEqual([]);
    expect((await db.select().from(appErrors)).map((e) => e.message)).toEqual([
      `GP sign-up fee paid for a sign-up that no longer exists: payment pi_fee_1 (sign-up ${s.id}) needs refunding in Stripe.`,
    ]);
  });

  test('an event from a connected account, or from the other mode than the key, is not acted on', async () => {
    const s = await application();
    const paid = session(s.id);
    // A connected account's owner chooses its metadata, so could name our sign-up.
    expect(await handleStripeEvent(db, { ...ev('evt_fee_f1', 'checkout.session.completed', paid), account: 'acct_someone' })).toBe('ignored');
    // A test-mode payment must never mark a live sign-up paid, nor the reverse.
    vi.stubEnv('STRIPE_SECRET_KEY', 'rk_live_placeholder');
    expect(await handleStripeEvent(db, { ...ev('evt_fee_f2', 'checkout.session.completed', paid), livemode: false })).toBe('ignored');
    vi.stubEnv('STRIPE_SECRET_KEY', 'rk_test_placeholder');
    expect(await handleStripeEvent(db, { ...ev('evt_fee_f3', 'checkout.session.completed', paid), livemode: true })).toBe('ignored');
    expect((await row(s.id)).feeStatus).toBe('unpaid');
    expect(await db.select().from(stripeEvents)).toHaveLength(0);
    // The matching mode is acted on.
    expect(await handleStripeEvent(db, { ...ev('evt_fee_f4', 'checkout.session.completed', paid), livemode: false })).toBe('applied');
    expect((await row(s.id)).feeStatus).toBe('paid');
  });

  test('a full refund marks the fee refunded, a failed refund puts it back, a partial one leaves it paid', async () => {
    const s = await application();
    await handleStripeEvent(db, ev('evt_fee_10', 'checkout.session.completed', session(s.id)));
    const refund = { id: 're_fee_1', amount: 5000, payment_intent: 'pi_fee_1', status: 'succeeded', created: NOW };

    await handleStripeEvent(db, ev('evt_fee_11', 'refund.created', { ...refund, id: 're_fee_part', amount: 2000 }));
    expect((await row(s.id)).feeStatus).toBe('paid');

    await handleStripeEvent(db, ev('evt_fee_12', 'refund.created', refund));
    expect((await row(s.id)).feeStatus).toBe('refunded');
    // The fee is not a consultation payment, so the consultation refunds table is untouched.
    expect(await db.select().from(refunds)).toEqual([]);

    await handleStripeEvent(db, ev('evt_fee_13', 'refund.updated', { ...refund, status: 'failed' }));
    expect((await row(s.id)).feeStatus).toBe('paid');

    // A charge refunded in full, as charge.refunded reports it.
    await handleStripeEvent(db, ev('evt_fee_14', 'charge.refunded', { id: 'ch_fee_1', payment_intent: 'pi_fee_1', refunded: true, amount_refunded: 5000 }));
    expect((await row(s.id)).feeStatus).toBe('refunded');
  });

  // Only the refund that refunded the fee can un-refund it by failing.
  test('an earlier refund failing late does not undo a later refund that succeeded', async () => {
    const s = await application();
    await handleStripeEvent(db, ev('evt_fee_r1', 'checkout.session.completed', session(s.id)));
    const r1 = { id: 're_fee_1', amount: 5000, payment_intent: 'pi_fee_1', status: 'pending', created: NOW };
    const r2 = { id: 're_fee_2', amount: 5000, payment_intent: 'pi_fee_1', status: 'succeeded', created: NOW + 60 };

    await handleStripeEvent(db, ev('evt_fee_r2', 'refund.created', r1));
    expect(await row(s.id)).toMatchObject({ feeStatus: 'refunded', feeRefundId: 're_fee_1' });
    await handleStripeEvent(db, ev('evt_fee_r3', 'refund.updated', { ...r1, status: 'failed' }));
    expect(await row(s.id)).toMatchObject({ feeStatus: 'paid', feeRefundId: null });

    await handleStripeEvent(db, ev('evt_fee_r4', 'refund.created', r2));
    expect(await row(s.id)).toMatchObject({ feeStatus: 'refunded', feeRefundId: 're_fee_2' });
    // Stripe tells us about the first refund's failure again, after the second succeeded.
    await handleStripeEvent(db, ev('evt_fee_r5', 'refund.updated', { ...r1, status: 'failed' }));
    expect(await row(s.id)).toMatchObject({ feeStatus: 'refunded', feeRefundId: 're_fee_2' });
  });

  test('a refunded fee is not flipped back by the payment that was refunded, only by a new one', async () => {
    const s = await application();
    await handleStripeEvent(db, ev('evt_fee_15', 'checkout.session.completed', session(s.id)));
    await handleStripeEvent(db, ev('evt_fee_16', 'charge.refunded', { id: 'ch_fee_1', payment_intent: 'pi_fee_1', refunded: true, amount_refunded: 5000 }));
    // The welcome page reloaded, or a late event for the same payment.
    expect(await markFeePaid(db, feePaymentFrom(session(s.id))!)).toBe('already');
    expect((await row(s.id)).feeStatus).toBe('refunded');
    // They sign up and pay again: a different payment.
    await handleStripeEvent(db, ev('evt_fee_17', 'checkout.session.completed', session(s.id, { id: 'cs_test_fee0000000002', payment_intent: 'pi_fee_2' })));
    expect(await row(s.id)).toMatchObject({ feeStatus: 'paid', stripePaymentIntentId: 'pi_fee_2' });
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
