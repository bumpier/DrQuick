'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PageHero } from '@/components/site/PageParts';
import { confirmUnsubscribe, type UnsubscribeResult } from './actions';

// The confirm step. Nothing happens until the button is pressed: email
// scanners open every link in a message, so arriving here changes nothing.
export function UnsubscribeConfirm({ token, role, email }: { token: string; role: 'patient' | 'gp'; email: string }) {
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
