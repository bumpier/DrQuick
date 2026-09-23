'use client';

import { PhoneOffIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Announce } from '../Announce';
import { useBooking } from '../BookingProvider';
import { ConfirmDialog } from '../ConfirmDialog';
import { FlowStep } from '../FlowStep';
import { NothingYet } from '../NothingYet';
import { CallClock, VideoFrame } from '../VideoFrame';

// The consultation. The video is a placeholder that says what it is and that
// nothing is kept; the clock counts up from the moment the patient
// joined. Ending is confirmed, and it is not red: on this surface red is 999.
export function Call() {
  const { state, act, callSeconds } = useBooking();
  const gp = state.gp;
  if (!gp || state.callStartedAt === null) return <NothingYet screen="call" title="No consultation in progress" />;

  return (
    <FlowStep
      screen="call"
      title="Your consultation"
      lead="This call is not recorded."
      status={<VideoFrame gpRef={gp.ref} />}
      dock={
        <ConfirmDialog
          trigger={
            <Button size="lg" variant="secondary" className="min-h-13 w-full">
              <PhoneOffIcon strokeWidth={2} aria-hidden="true" />
              End call
            </Button>
          }
          title="End the call?"
          description="Your GP will finish your summary after the call."
          cancelLabel="Back to the call"
          confirmLabel="End call"
          onConfirm={() => act({ type: 'endCall', now: Date.now() })}
        />
      }
    >
      <CallClock seconds={callSeconds} gpRef={gp.ref} />
      <Announce text={`Connected to ${gp.ref}.`} />
    </FlowStep>
  );
}
