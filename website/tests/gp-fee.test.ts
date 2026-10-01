import { describe, expect, test } from 'vitest';
import { GP_FEE_LABEL, GP_FEE_REFUND, GP_SIGNUP_FEE_PENCE, feeLabel } from '@/lib/gp-fee';
import { checkCopy } from '@/lib/compliance';
import { feePaymentFrom, isFeeSession } from '@/lib/stripe';

const SIGNUP = '0f8e2a8c-3b1d-4c55-9d0e-1a2b3c4d5e6f';
const session = (over: Record<string, unknown> = {}) => ({
  id: 'cs_test_fee0000000001', payment_status: 'paid', payment_intent: 'pi_fee_1',
  amount_total: 5000, currency: 'gbp', created: 1_790_000_000, metadata: { kind: 'gp_signup_fee', signup_id: SIGNUP }, ...over,
});

describe('the sign-up fee', () => {
  test('is fifty pounds, in pence, and labelled from that figure', () => {
    expect(GP_SIGNUP_FEE_PENCE).toBe(5000);
    expect(GP_FEE_LABEL).toBe('£50');
    expect(feeLabel(5000)).toBe('£50');
    expect(feeLabel(5050)).toBe('£50.50');
    expect(feeLabel(125000)).toBe('£1,250');
  });

  // The promise is shown to doctors next to a payment button, so it is held to
  // the same copy rules as the rest of the site.
  test('the refund promise breaks no copy rule', () => {
    expect(checkCopy(GP_FEE_REFUND)).toEqual([]);
  });
});

describe('reading a Checkout Session', () => {
  test('a paid fee session becomes a payment, with the intent as a string or an expanded object', () => {
    const want = {
      signupId: SIGNUP, sessionId: 'cs_test_fee0000000001', paymentIntentId: 'pi_fee_1',
      amountPence: 5000, paidAt: new Date(1_790_000_000 * 1000),
    };
    expect(feePaymentFrom(session())).toEqual(want);
    expect(feePaymentFrom(session({ payment_intent: { id: 'pi_fee_1', object: 'payment_intent' } }))).toEqual(want);
  });

  test('a session that is not paid yet yields nothing', () => {
    expect(feePaymentFrom(session({ payment_status: 'unpaid' }))).toBeNull();
    expect(feePaymentFrom(session({ payment_status: undefined }))).toBeNull();
  });

  test('a session that is not this fee, or names no sign-up, is not ours', () => {
    for (const metadata of [undefined, null, {}, { kind: 'other', signup_id: SIGNUP }, { kind: 'gp_signup_fee' }, { kind: 'gp_signup_fee', signup_id: 'nope' }]) {
      expect(isFeeSession(session({ metadata })), JSON.stringify(metadata)).toBe(false);
      expect(feePaymentFrom(session({ metadata }))).toBeNull();
    }
    expect(feePaymentFrom(session({ id: undefined }))).toBeNull();
  });

  // Paid means the whole fee, in pounds. A coupon, another amount or another
  // currency is not the fee being paid, whatever the metadata says.
  test('only the exact fee in pounds counts as paid', () => {
    for (const over of [
      { payment_status: 'no_payment_required', amount_total: 0 },
      { amount_total: 0 }, { amount_total: 4999 }, { amount_total: 5001 }, { amount_total: '5000' }, { amount_total: undefined },
      { currency: 'usd' }, { currency: undefined },
    ]) {
      expect(feePaymentFrom(session(over)), JSON.stringify(over)).toBeNull();
    }
    expect(feePaymentFrom(session({ currency: 'GBP' }))?.amountPence).toBe(5000);
  });

  test('a missing intent or time is read safely', () => {
    const now = new Date('2026-10-01T12:00:00Z');
    expect(feePaymentFrom(session({ payment_intent: null, created: undefined }), now)).toEqual({
      signupId: SIGNUP, sessionId: 'cs_test_fee0000000001', paymentIntentId: null, amountPence: 5000, paidAt: now,
    });
  });
});
