'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { money } from '@/lib/format';
import { useBooking } from '../BookingProvider';
import { FlowStep } from '../FlowStep';

// Confirmation that nothing is owed: the place is given up and the hold is
// gone. There is no cancellation fee to mention, because there is none.
export function Cancelled() {
  const { state } = useBooking();
  const amount = money(state.hold.status === 'none' ? (state.quote ?? 0) : state.hold.amount);
  return (
    <FlowStep
      screen="cancelled"
      layout="column"
      title="Request cancelled"
      lead={`Your place in the queue is released and the ${amount} hold is gone. Nothing has been charged.`}
      urgent
      dock={
        <Button asChild size="lg" className="min-h-13 w-full">
          <Link href="/patient">Back to home</Link>
        </Button>
      }
    />
  );
}
