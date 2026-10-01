// The sign-up fee on the waitlist row: recording that it was paid, and that it
// was refunded. Server-only. Two callers reach the "paid" write, the webhook
// and the welcome page, and either may arrive first or more than once, so every
// write here is safe to repeat and reports what it found.
import { eq, sql } from 'drizzle-orm';
import type { DB } from '@/lib/db';
import { waitlistSignups } from '@/lib/db/schema';
import { sendSignupEmails } from '@/lib/email';
import { rowsOf } from '@/lib/rate-limit';
import type { FeePayment } from '@/lib/stripe';

// The webhook writes inside its own transaction; everything else uses the pool.
type Executor = Pick<DB, 'execute'>;

// What a paid session turned out to be:
//   recorded    this call marked the fee paid (and is the one that sends email)
//   already     it was recorded before: a redelivery, or the other caller won
//   paid_twice  the sign-up is already paid by a DIFFERENT payment: money was
//               taken a second time and needs refunding by hand
//   missing     the sign-up no longer exists (the GP withdrew, or was erased,
//               with a checkout still open): money was taken with nothing to
//               attach it to, and needs refunding by hand
export type FeeOutcome = 'recorded' | 'already' | 'paid_twice' | 'missing';

/**
 * Marks the fee paid. The details typed with the checkout that was paid replace
 * the row's, while the application is still 'new': the row keeps the first
 * details submitted for an address until someone pays, so an application can
 * only be rewritten by paying for it, never by posting its email address.
 *
 * A refunded fee is not flipped back by the payment that was refunded: only a
 * different, later payment can pay it again.
 */
export async function markFeePaid(db: Executor, p: FeePayment): Promise<FeeOutcome> {
  const typed = sql`pending_details -> ${p.sessionId}::text`;
  const rows = rowsOf<{ id: string }>(await db.execute(sql`
    update waitlist_signups set
      fee_status = 'paid',
      fee_pence = ${p.amountPence},
      fee_paid_at = ${p.paidAt.toISOString()}::timestamptz,
      stripe_checkout_session_id = ${p.sessionId},
      stripe_payment_intent_id = ${p.paymentIntentId},
      fee_refund_id = null,
      name = case when status = 'new' then coalesce(${typed} ->> 'name', name) else name end,
      mobile = case when status = 'new' then coalesce(${typed} ->> 'mobile', mobile) else mobile end,
      gmc = case when status = 'new' then coalesce(${typed} ->> 'gmc', gmc) else gmc end,
      pending_details = null,
      updated_at = now()
    where id = ${p.signupId} and role = 'gp'
      and (fee_status is null or fee_status = 'unpaid'
        or (fee_status = 'refunded' and stripe_payment_intent_id is distinct from ${p.paymentIntentId}))
    returning id`));
  if (rows[0]) return 'recorded';

  const [row] = rowsOf<{ fee_status: string | null; stripe_payment_intent_id: string | null }>(await db.execute(sql`
    select fee_status, stripe_payment_intent_id from waitlist_signups where id = ${p.signupId} and role = 'gp'`));
  if (!row) return 'missing';
  const other = Boolean(p.paymentIntentId) && row.stripe_payment_intent_id !== p.paymentIntentId;
  return row.fee_status === 'paid' && other ? 'paid_twice' : 'already';
}

// A payment that needs a person: said plainly, with the Stripe reference to
// refund and never an email address (the admin's Technical page shows these).
export function feeAnomalyMessage(outcome: FeeOutcome, p: FeePayment): string | null {
  const payment = p.paymentIntentId ?? p.sessionId;
  if (outcome === 'paid_twice') {
    return `GP sign-up fee paid twice: payment ${payment} is a second payment for sign-up ${p.signupId} and needs refunding in Stripe.`;
  }
  if (outcome === 'missing') {
    return `GP sign-up fee paid for a sign-up that no longer exists: payment ${payment} (sign-up ${p.signupId}) needs refunding in Stripe.`;
  }
  return null;
}

/**
 * A refund against the fee's payment. A full refund marks the fee refunded and
 * remembers which refund did it; if that refund later fails or is cancelled the
 * fee goes back to paid. Another refund failing does not undo it. A partial
 * refund leaves the fee paid: the promise is all of it or none.
 *
 * `refundId` is null when the news comes from a charge refunded in full rather
 * than from one refund: the fee is refunded, and stays so.
 *
 * Known gap: a refund that arrives before the payment itself has been recorded
 * matches no row. It would take a webhook outage longer than it takes staff to
 * refund by hand; the Stripe Dashboard remains the record of what was refunded.
 */
export async function applyFeeRefund(
  db: Executor,
  refund: { paymentIntentId: string; refundId: string | null; amountPence: number; undone: boolean },
): Promise<void> {
  if (refund.undone) {
    if (!refund.refundId) return;
    await db.execute(sql`
      update waitlist_signups set fee_status = 'paid', fee_refund_id = null, updated_at = now()
      where stripe_payment_intent_id = ${refund.paymentIntentId} and fee_status = 'refunded'
        and fee_refund_id = ${refund.refundId}`);
    return;
  }
  await db.execute(sql`
    update waitlist_signups set
      fee_status = 'refunded',
      fee_refund_id = coalesce(${refund.refundId}, fee_refund_id),
      updated_at = now()
    where stripe_payment_intent_id = ${refund.paymentIntentId} and fee_status in ('paid', 'refunded')
      and ${refund.amountPence} >= coalesce(fee_pence, 0)`);
}

/**
 * The confirmation to the GP and the alert to the team, sent once: only by the
 * call that recorded the payment. Never throws (sendSignupEmails does not), so
 * a mail outage cannot turn a recorded payment into an error. If the process
 * dies between recording and sending, the email is lost rather than doubled;
 * the admin's resend button covers that.
 */
export async function sendFeePaidEmails(db: DB, signupId: string): Promise<void> {
  const [signup] = await db.select().from(waitlistSignups).where(eq(waitlistSignups.id, signupId));
  if (signup) await sendSignupEmails(db, signup);
}

/** Records a paid fee and, if this call recorded it, sends its emails. */
export async function fulfilFee(db: DB, payment: FeePayment): Promise<FeeOutcome> {
  const outcome = await markFeePaid(db, payment);
  if (outcome === 'recorded') await sendFeePaidEmails(db, payment.signupId);
  return outcome;
}
