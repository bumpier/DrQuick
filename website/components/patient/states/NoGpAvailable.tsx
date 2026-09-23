'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { money } from '@/lib/format';
import { useBooking } from '../BookingProvider';
import { FlowStep } from '../FlowStep';

// The state a demo would skip and the one most likely to be met with anger:
// it says plainly that the hold is gone and points somewhere useful. It
// promises no wait and never blames demand. "Try again" is a new
// request, quoted afresh, in full.
export function NoGpAvailable() {
  const { state, act } = useBooking();
  const amount = money(state.hold.status === 'none' ? (state.quote ?? 0) : state.hold.amount);
  return (
    <FlowStep
      screen="no-gp-available"
      layout="column"
      title="No GP available right now"
      lead={`The ${amount} hold on your card has been released in full. You have not been charged.`}
      urgent
      dock={
        <>
          <Button size="lg" className="min-h-13 w-full" onClick={() => act({ type: 'retry' })}>Try again</Button>
          <Button asChild size="lg" variant="secondary" className="min-h-13 w-full">
            <Link href="/patient">Back to home</Link>
          </Button>
        </>
      }
    >
      <Card size="sm">
        <CardContent className="grid gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-semibold">NHS 111</p>
              <p className="text-fine text-ink-2">Urgent medical advice, any time.</p>
            </div>
            <Button asChild size="sm" variant="secondary"><a href="tel:111">Call 111</a></Button>
          </div>
          <div className="flex items-start justify-between gap-4 border-t border-rule pt-4">
            <div className="min-w-0">
              <p className="font-semibold">111 online</p>
              <p className="text-fine text-ink-2">Answer questions online and get told where to go.</p>
            </div>
            <Button asChild size="sm" variant="secondary"><a href="https://111.nhs.uk/" rel="noopener">Open</a></Button>
          </div>
          <div className="border-t border-rule pt-4">
            <p className="font-semibold">Pharmacy First</p>
            <p className="text-fine text-ink-2">A pharmacist can treat some conditions without a GP appointment.</p>
          </div>
        </CardContent>
      </Card>
    </FlowStep>
  );
}
