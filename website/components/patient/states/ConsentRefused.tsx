'use client';

import { Button } from '@/components/ui/button';
import { useBooking } from '../BookingProvider';
import { FlowStep } from '../FlowStep';

// Refusing to share is allowed and costs something, and the cost is shown
// before any money moves, not discovered afterwards. The GP sees the same
// constraint on their side of the offer.
export function ConsentRefused() {
  const { act } = useBooking();
  return (
    <FlowStep
      screen="consent-refused"
      layout="column"
      back="action"
      title="Without your NHS record"
      lead="Your GP may not be able to prescribe safely without it, and may refer you to your NHS GP instead."
      urgent
      dock={
        <>
          <Button size="lg" className="min-h-13 w-full" onClick={() => act({ type: 'continueWithoutSharing' })}>
            Continue without sharing
          </Button>
          <Button size="lg" variant="secondary" className="min-h-13 w-full" onClick={() => act({ type: 'changeAnswer' })}>
            Change my answer
          </Button>
        </>
      }
    />
  );
}
