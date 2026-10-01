// The GP sign-up fee, in one place. Decided by the user on 2026-10-01: a GP
// pays once, by card through Stripe, when they submit the sign-up, and gets it
// back in full if they are not taken on.
//
// The amount is integer pence like every other sum in the codebase, and the
// label is formatted from it, so no surface types the figure by hand and a
// change here changes the page, the pop-up, the checkout and the email at once.
// No imports: the landing page and the server both read this.

export const GP_SIGNUP_FEE_PENCE = 5000;

const POUNDS = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const PENNIES = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Pence as pounds, with pennies only when there are any. */
export function feeLabel(pence: number): string {
  return (pence % 100 === 0 ? POUNDS : PENNIES).format(pence / 100);
}

export const GP_FEE_LABEL = feeLabel(GP_SIGNUP_FEE_PENCE);

// The refund promise, word for word wherever the fee is asked for. It is a
// commitment, so it is written once and never paraphrased.
export const GP_FEE_REFUND = 'Refunded in full if we can’t verify your GMC registration or don’t take you on.';

// What Stripe shows on its payment page and on the receipt.
export const GP_FEE_PRODUCT = 'Dr Quick GP sign-up fee';
export const GP_FEE_PRODUCT_DESCRIPTION =
  'One-off sign-up fee. Refunded in full if we cannot verify your GMC registration or do not take you on.';

// Marks a Stripe object as this fee, so the webhook can tell it from a
// consultation payment.
export const GP_FEE_KIND = 'gp_signup_fee';

export const FEE_STATUSES = ['unpaid', 'paid', 'refunded'] as const;
export type FeeStatus = (typeof FEE_STATUSES)[number];
