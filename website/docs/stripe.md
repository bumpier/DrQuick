# Stripe: the GP sign-up fee

A GP who signs up pays a one-off fee on Stripe's hosted payment page. This is how to switch it on, test it, and refund it.

Nothing is charged until `STRIPE_SECRET_KEY` is set. Until then the sign-up pop-up answers "Sign-up payments aren't switched on yet" and stores nothing.

## How it works

1. The GP fills in the pop-up and presses **Continue to payment**.
2. `POST /api/gp-signup` stores the application as **unpaid** and creates a Stripe Checkout Session for the fee.
3. The browser goes to Stripe's page. The card is entered there; this site never sees it.
4. Stripe tells the site the payment succeeded by calling the webhook, `POST /api/webhooks/stripe`. That call is what marks the application **paid** and sends the confirmation email and the team alert.
5. Stripe sends the GP back to `/gp/welcome`. That page also records the payment, so it is right the moment they land, but it is not relied on: someone who pays and closes the tab never loads it.

The webhook is therefore required, not optional. Without it, a GP can pay and never be marked paid.

## Switching it on

### 1. Make a restricted API key

In the Stripe Dashboard: **Developers → API keys → Create restricted key**.

- Permission: **Checkout Sessions: Write**. Nothing else.
- Copy the key (it starts `rk_test_` in test mode, `rk_live_` in live mode).

A restricted key is safer than the full secret key (`sk_…`): if it leaks, it can only create and read checkouts.

### 2. Add the webhook endpoint

**Developers → Webhooks → Add endpoint**.

- URL: `https://<your domain>/api/webhooks/stripe`
- Events:
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `charge.refunded`
  - `refund.created`
  - `refund.updated`
- Copy the endpoint's **signing secret** (it starts `whsec_`).

Do not tick "Listen to events on Connected accounts". The site ignores those.

### 3. Set the two variables and migrate

On the server, in `.env.production`:

```
STRIPE_SECRET_KEY=rk_live_…
STRIPE_WEBHOOK_SECRET=whsec_…
```

Then `npm run deploy` (it runs the migrations, which add the fee columns). Test mode and live mode have different keys and different webhook secrets; do not mix them. The site ignores a test-mode event when it holds a live key, and the reverse.

Never commit either value, and never paste them into chat or a ticket.

### 4. Check the Dashboard settings

In Stripe's settings:

- **Customer emails**: turn on emails for successful payments, so Stripe sends a receipt.
- **Branding**: the name and colours shown on the payment page.
- **Payment methods**: which methods are offered. The site leaves the choice to Stripe.

## Testing before any real money

Use a test-mode key and Stripe's test card, `4242 4242 4242 4242`, any future expiry, any CVC.

To receive webhooks on your own machine, install the Stripe CLI and forward them:

```
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Use the port your dev server is on, and make sure `NEXT_PUBLIC_SITE_URL` in `.env.local` names the same one: Stripe sends the GP back to that address. The command prints a `whsec_…` secret for that session: use it as `STRIPE_WEBHOOK_SECRET` in `.env.local`, beside a test key.

If you have no Stripe account yet, `stripe sandbox create` makes a sandbox (a Stripe test environment) with test keys and no registration.

Then walk it once, end to end:

1. Sign up as a GP on the site and pay with the test card.
2. You land on "You're signed up."
3. In the admin, **Waitlist → GPs**, the application shows **Fee paid** and "Sign-up fees collected" has gone up.
4. The confirmation email is in **System → Emails**.
5. Refund the payment in Stripe (below) and watch the application change to **Fee refunded**.

Also try leaving Stripe's page without paying: you should return to the pop-up with "Your payment wasn't completed, so nothing was taken."

## Refunding a fee

The site promises: *refunded in full if we can't verify your GMC registration or don't take you on.* Nothing refunds by itself. When either happens:

1. In the admin, open the GP's application and follow **Open the payment in Stripe**.
2. In Stripe, **Refund** the full amount.
3. The application changes to **Fee refunded** within a few seconds.

A part refund leaves the application marked paid: the promise is all of it or none.

## When something needs a person

Two things are flagged in the admin under **System → Technical → Recent errors**, each with the Stripe payment reference:

- **A fee paid twice.** A second payment arrived for a sign-up that was already paid. Refund the second one.
- **A fee paid for a sign-up that no longer exists.** The GP withdrew, or was erased, while their payment page was still open, and then paid. Refund it.

## Changing the fee

The amount is `GP_SIGNUP_FEE_PENCE` in `lib/gp-fee.ts`; every page, the pop-up, Stripe's page and the email read it from there. A payment page opened at the old amount and paid after the change is refused as "not the fee" and will not mark the application paid: check Stripe for payments around the time of the change and record or refund them by hand.

## Not yet decided

- Whether a GP who withdraws of their own accord gets the fee back. The withdraw page says only that withdrawing does not refund it by itself.
- Whether the fee carries VAT. Stripe Tax is off; the amount charged is the amount in `lib/gp-fee.ts`.
- The legal entity. Stripe needs one to take live payments, and the draft Terms and Privacy pages still bracket it.
