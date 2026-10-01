# GP sign-up as the main page, the sign-up fee, and commission tiers

Date: 2026-10-01. Status: built. This records the design and the decisions behind it.

## What was asked for

1. Make the GP sign-up the main page.
2. State a £50 sign-up fee, and take it through Stripe when a GP submits their details.
3. Make the sign-up pop-up high quality and high converting.
4. Tier the GP commission: 60 / 40 to start, 70 / 30 at 100 patients served, 75 / 25 at 500, the maximum.

## Decisions made with the user

| Question | Decision |
|---|---|
| What "main page" means for patients | The site opens on GPs. The patient page stays, one tap away on the switch. |
| Terms of the fee | Refunded in full if the GMC registration cannot be verified or the GP is not taken on. |
| How the payment appears | Stripe's hosted payment page, reached from the pop-up. |
| What "patients served" counts | A GP's lifetime completed consultations. |

## Design

### The page

`DEFAULT_ROLE` in `lib/site-mode.ts` is `'gp'`. Everything that depended on the patient mode being the default reads that constant: the pre-paint role script and the head in `app/layout.tsx`, the order of the modes in `app/page.tsx`, the switch and the CTA in `components/Nav.tsx`, and the address rewriting in `components/LandingBehavior.tsx`. The bare address is the GP page; `?role=patient` and the `#join` hash open the patient page, so links from the other pages still land on the right audience.

### The pop-up

One dialog (`components/GpSignupDialog.tsx`), mounted once, opened only by the reader: a click on anything carrying `data-gp-signup` (the hero, the closing band, the nav), or a `#gp-join` hash. It never opens on a timer, on scroll or on leaving.

Two cells. The forest cell carries the offer: what a GP keeps, drawn as three rising steps (`components/CommissionLadder.tsx`). The white cell carries the ask: where the reader is (details, then payment), four fields, the fee with its refund promise directly above the button, and one action.

What it does to convert, and what it does not:

- The fee is stated beside every sign-up button before the click, and again at the moment of paying, so nobody meets it late.
- The refund promise is the risk reversal, and sits with the price rather than in fine print.
- The four fields are the ones the register check needs, and no more.
- The button says what happens: "Continue to payment".
- Every failure says what happened and that no money moved.
- No countdown, no scarcity, no invented figures, faces or testimonials. The site's rule that warmth never outruns honesty applies here most of all, because a payment follows.

### The payment

`POST /api/gp-signup` validates, stores the application unpaid, creates a Stripe Checkout Session (`lib/stripe.ts`) and returns its address. Only the email and the sign-up id go to Stripe.

Stripe, never the browser, decides that a fee is paid. The webhook handles `checkout.session.completed` and `checkout.session.async_payment_succeeded` and records the fee only when the session is paid, for the exact fee, in pounds (`lib/gp-fee-store.ts`). The welcome page reads the session back from Stripe and runs the same idempotent write. The confirmation email and the team alert are sent once, by whichever recorded it.

Points settled after an independent security review:

- **Whose details.** Anyone can type anyone's email. The row keeps the first details submitted for an address; details typed later wait beside the checkout they started and replace the row's only if that checkout is paid. An application can be rewritten by paying for it, never by posting its email.
- **One open checkout.** Starting a new checkout closes the previous one, and checkouts expire after an hour.
- **Money that needs a person.** A second payment for a paid sign-up, and a payment for a sign-up that was erased while its checkout was open, are flagged in the admin with the Stripe reference to refund.
- **Refunds.** A full refund marks the fee refunded and remembers which refund did it; only that refund failing puts it back.
- **Limits.** Per client, per email address named, and a shared bucket for requests with no client address.
- **Other accounts and modes.** Events from a connected account, or from the other mode than the key in use, are ignored.

### The commission

`lib/finance/commission.ts`: three tiers in basis points, `tierFor`, `nextTier` and `splitPrice`. A tier applies to consultations after its threshold: consultations 1 to 100 pay 60%, 101 to 500 pay 70%, 501 onwards pay 75%. The GP's part is rounded to the penny and Dr Quick takes the remainder, so the two always sum to the price.

Every surface that states the commission reads the module: the hero, the pay tile, the FAQ, the pop-up, the pricing page and the admin payouts table. The demo finance data is split by it. No code writes real consultations yet; when it does, it splits the price with `splitPrice(price, servedBefore)`.

## Left open

- Whether a GP who withdraws of their own accord gets the fee back.
- VAT on the fee.
- Whether commission is of the price before or after Stripe's charges (the code takes it of the full price).
- At the business plan's £32 base price, 60% is £19.20 a consultation, below the £24 to £33 the plan assumed.
- The share card (`assets/og.png`) still shows the patient message.
- The fee needs the legal entity, fee terms and a privacy notice naming Stripe before live keys are set.
