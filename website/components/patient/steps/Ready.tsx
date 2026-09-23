'use client';

import { Button } from '@/components/ui/button';
import { money } from '@/lib/format';
import { Announce } from '../Announce';
import { useBooking } from '../BookingProvider';
import { FlowStep } from '../FlowStep';
import { GpCard } from '../GpCard';
import { NothingYet } from '../NothingYet';

// The interrupt. The queue moved the patient here, so focus is on the heading
// and the GP's reference follows it into the reader; the price that was held
// is now taken, and it is the price they were shown.
export function Ready() {
  const { state, act } = useBooking();
  const gp = state.gp;
  if (!gp) return <NothingYet screen="ready" title="No GP matched yet" />;

  return (
    <FlowStep
      screen="ready"
      title="Your GP is ready"
      lead={`${gp.ref} has accepted your consultation and is waiting for you.`}
      status={<GpCard gp={gp} consent={state.nhsGpConsent} />}
      urgent
      dock={<Button size="lg" className="min-h-13 w-full" onClick={() => act({ type: 'join', now: Date.now() })}>Join the call</Button>}
    >
      <p className="text-body">{`${money(state.quote ?? 0)} taken from your card, the price you were shown.`}</p>
      <Announce text={`${gp.ref} has accepted your consultation.`} />
    </FlowStep>
  );
}
