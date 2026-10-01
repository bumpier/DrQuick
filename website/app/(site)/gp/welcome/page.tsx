import type { Metadata } from 'next';
import { Button } from '@/components/ui/button';
import { InfoTile, NumberedTile, PageHero, SiteSection } from '@/components/site/PageParts';
import { getDb } from '@/lib/db';
import { emailConfigured } from '@/lib/email';
import { GP_FEE_LABEL, GP_FEE_REFUND } from '@/lib/gp-fee';
import { fulfilFee, type FeeOutcome } from '@/lib/gp-fee-store';
import { readFeeCheckout } from '@/lib/stripe';

// Where Stripe sends a GP after the sign-up fee (lib/stripe.ts, success_url).
// It reads the session back from Stripe rather than trusting the URL, and
// records the payment through the same idempotent write the webhook uses, so a
// doctor sees "signed up" the moment they land even if the webhook is a second
// behind. The webhook remains the path that cannot be missed: someone who pays
// and closes the tab never loads this page.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'GP sign-up',
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const NEXT_STEPS = [
  { title: 'We check the register.', body: 'Your reference number is checked against the GMC register, along with your licence to practise.' },
  { title: 'We get in touch.', body: 'By email or phone, to talk through sessions, indemnity and pay, and to show you the contractor terms.' },
  { title: 'You go on the rota.', body: 'Once your checks are complete, you choose when you are available. No consultation happens before we open.' },
];

export default async function GpWelcomePage({ searchParams }: Props) {
  const params = await searchParams;
  const sessionId = typeof params.session_id === 'string' ? params.session_id : null;
  const checkout = await readFeeCheckout(sessionId);

  if (checkout.state === 'paid') {
    let outcome: FeeOutcome | null = null;
    try {
      const db = await getDb();
      if (db) outcome = await fulfilFee(db, checkout.payment);
    } catch (err) {
      // The webhook will record it; this page must still confirm the payment.
      console.error('Recording the sign-up fee from the welcome page failed:', (err as Error).message);
    }

    // The payment went through, but there is nothing to attach it to: the
    // sign-up was withdrawn or erased while the checkout was still open. Saying
    // "you're signed up" would be untrue. The webhook has flagged it for a refund.
    if (outcome === 'missing') {
      return (
        <div className="pb-section">
          <PageHero
            title="Your payment went through, but your sign-up is gone."
            lead="Your details were deleted before this payment arrived, so we have nothing to attach it to. Get in touch and we will refund it."
          >
            <Button asChild size="lg"><a href="/contact" data-cta="welcome-contact">Contact us</a></Button>
          </PageHero>
        </div>
      );
    }

    return (
      <>
        <PageHero
          title="You’re signed up."
          lead={`Your ${GP_FEE_LABEL} sign-up fee is paid.${emailConfigured() ? ' A confirmation is on its way to your email address.' : ''}`}
        />
        {outcome === 'paid_twice' && (
          <div className="wrap pt-4">
            <p className="rounded-xl bg-stone px-6 py-4 text-body font-semibold" data-notice="paid-twice">
              This sign-up was already paid for, so this was a second payment.{' '}
              <a href="/contact" className="text-primary-ink underline underline-offset-4 decoration-2 hover:text-ink">Get in touch</a>{' '}
              and we will refund it.
            </p>
          </div>
        )}
        <SiteSection title="What happens next.">
          <div className="grid grid-cols-3 gap-4 max-cols:grid-cols-1" data-stagger>
            {NEXT_STEPS.map((tile, i) => (
              <NumberedTile key={tile.title} n={i + 1} tile={tile} tone={i === 2 ? 'band' : i === 0 ? 'wash' : 'default'} />
            ))}
          </div>
        </SiteSection>
        <SiteSection title="Your fee is safe." className="pb-section">
          <InfoTile tone="stone" title={GP_FEE_REFUND}
            body="If either happens, the whole fee goes back to the card you paid with." />
        </SiteSection>
      </>
    );
  }

  if (checkout.state === 'processing') {
    return (
      <div className="pb-section">
        <PageHero
          title="Your payment is on its way."
          lead="Your bank is still confirming it. There is nothing else you need to do: you are signed up as soon as it clears, and we will email you then."
        />
      </div>
    );
  }

  return (
    <div className="pb-section">
      <PageHero
        title="We couldn’t confirm a payment."
        lead="If you paid, your sign-up is safe: it is recorded directly from Stripe, and we will email you. If you left before paying, nothing was taken, and you can pick up where you left off."
      >
        <Button asChild size="lg"><a href="/#gp-join" data-cta="welcome-retry">Go to GP sign-up</a></Button>
      </PageHero>
    </div>
  );
}
