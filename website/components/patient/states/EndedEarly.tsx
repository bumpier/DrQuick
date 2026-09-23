'use client';

import { Button } from '@/components/ui/button';
import { formatClock } from '@/lib/booking';
import { useBooking } from '../BookingProvider';
import { FlowStep } from '../FlowStep';
import { NothingYet } from '../NothingYet';

// A call under two minutes did not run its course, but the GP still writes
// the outcome. Nothing here speaks about money: whether a short call is
// refunded is a policy nobody has decided yet.
export function EndedEarly() {
  const { state, act } = useBooking();
  if (!state.gp) return <NothingYet screen="ended-early" title="No call yet" />;
  return (
    <FlowStep
      screen="ended-early"
      layout="column"
      title="The call ended early"
      lead={`The call lasted ${formatClock(state.seconds)}. Your GP will still complete your summary.`}
      dock={<Button size="lg" className="min-h-13 w-full" onClick={() => act({ type: 'continueToOutcome' })}>Continue</Button>}
    />
  );
}
