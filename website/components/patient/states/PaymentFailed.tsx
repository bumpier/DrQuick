'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { money } from '@/lib/format';
import { useBooking } from '../BookingProvider';
import { FlowStep } from '../FlowStep';

// A declined card, before any hold existed: nothing was taken, there was no
// place to lose, and the price the patient was shown still stands.
export function PaymentFailed() {
  const { state, act } = useBooking();
  const amount = money(state.quote ?? 0);
  return (
    <FlowStep
      screen="payment-failed"
      layout="column"
      back="action"
      title="Payment didn’t go through"
      lead={`Your card was declined and nothing has been taken. Your price is still ${amount}.`}
      urgent
      dock={
        <>
          <Button size="lg" className="min-h-13 w-full" onClick={() => act({ type: 'retryCard' })}>Try another card</Button>
          <Button asChild size="lg" variant="secondary" className="min-h-13 w-full">
            <Link href="/patient">Back to home</Link>
          </Button>
        </>
      }
    />
  );
}
