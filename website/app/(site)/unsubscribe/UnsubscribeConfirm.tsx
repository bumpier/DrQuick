'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PageHero } from '@/components/site/PageParts';
import { confirmUnsubscribe, type UnsubscribeResult } from './actions';

// The confirm step. Nothing happens until the button is pressed: email
// scanners open every link in a message, so arriving here changes nothing.
//
// `feePaid` is a GP whose sign-up fee has been paid. Deleting their details
// does not move any money, and afterwards the payment can no longer be matched
// to them here, so they are told before they press the button. Whether a GP who
// withdraws gets the fee back is a decision for the business (PRODUCT.md), not
// something this page promises either way.
export function UnsubscribeConfirm({ token, role, email, feePaid = false }: {
  token: string; role: 'patient' | 'gp'; email: string; feePaid?: boolean;
}) {
  const [result, setResult] = useState<UnsubscribeResult | null>(null);
  const [pending, start] = useTransition();

  if (result?.done) {
    return (
      <PageHero title="Done. Your details are deleted." lead="We will not email you again. If you change your mind, you can join again from the home page.">
        <Button asChild size="lg" variant="secondary"><Link href="/">Go to the home page</Link></Button>
      </PageHero>
    );
  }

  const gp = role === 'gp';
  return (
    <PageHero
      title={gp ? 'Withdraw your application?' : 'Leave the waitlist?'}
      lead={gp
        ? `We will delete everything you gave us: your name, ${email}, your mobile and your GMC number.`
        : `We will delete ${email} and stop emailing you.`}
    >
      <Button size="lg" aria-busy={pending || undefined} disabled={pending} onClick={() => start(async () => setResult(await confirmUnsubscribe(token)))}>
        {gp ? 'Withdraw and delete my details' : 'Unsubscribe and delete my details'}
      </Button>
      <Button asChild size="lg" variant="secondary"><Link href="/">Keep me on the list</Link></Button>
      {gp && feePaid && (
        <p className="basis-full text-body text-ink-2" data-fee-notice="">
          Withdrawing does not refund your sign-up fee by itself. If you want to ask about the fee,{' '}
          <Link href="/contact" className="font-semibold text-primary-ink underline underline-offset-4 decoration-2 hover:text-ink">contact us</Link>{' '}
          before you withdraw: once your details are deleted we can no longer match the payment to you.
        </p>
      )}
      {result && !result.done && (
        <p role="alert" className="basis-full text-body text-ink">
          {result.error === 'invalid'
            ? 'This link has already been used, so your details may already be deleted.'
            : 'We could not do that just now. Please try again later.'}
        </p>
      )}
    </PageHero>
  );
}
