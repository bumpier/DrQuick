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
//
// `portal` is what confirming does to a doctor portal account at this address
// (erasureEffect in lib/waitlist.ts). A GP who has taken consultations keeps
// their name and GMC number against the records of what they were paid, so
// this page must not tell them everything is deleted.
export function UnsubscribeConfirm({ token, role, email, feePaid = false, portal = 'none' }: {
  token: string; role: 'patient' | 'gp'; email: string; feePaid?: boolean; portal?: 'none' | 'deleted' | 'kept';
}) {
  const [result, setResult] = useState<UnsubscribeResult | null>(null);
  const [pending, start] = useTransition();
  const kept = portal === 'kept';

  if (result?.done) {
    return (
      <PageHero
        title={kept ? 'Done. Your account is closed.' : 'Done. Your details are deleted.'}
        lead={kept
          ? 'We have kept your name and GMC number with the records of your consultations, and deleted the rest. We will not email you again.'
          : 'We will not email you again. If you change your mind, you can join again from the home page.'}
      >
        <Button asChild size="lg" variant="secondary"><Link href="/">Go to the home page</Link></Button>
      </PageHero>
    );
  }

  const gp = role === 'gp';
  const everything = `We will delete everything you gave us: your name, ${email}, your mobile and your GMC number.`;
  const whatIsKept = `We will close your doctor portal account and delete your sign-in, ${email}, your mobile and your profile. `
    + 'We keep your name and GMC number with the records of the consultations you were paid for.';
  const lead = kept ? whatIsKept
    : gp ? `${everything}${portal === 'deleted' ? ' Your doctor portal account is deleted with them.' : ''}`
    : `We will delete ${email} and stop emailing you.${portal === 'deleted' ? ' The doctor portal account at this address is deleted too.' : ''}`;
  return (
    <PageHero title={gp ? 'Withdraw your application?' : 'Leave the waitlist?'} lead={lead}>
      <Button size="lg" aria-busy={pending || undefined} disabled={pending} onClick={() => start(async () => setResult(await confirmUnsubscribe(token)))}>
        {kept ? 'Withdraw and close my account' : gp ? 'Withdraw and delete my details' : 'Unsubscribe and delete my details'}
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
