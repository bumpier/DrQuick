'use client';

import { StatTile } from '@/components/app/StatTile';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { NO_GP_ONLINE } from '@/lib/booking-flow';
import { TODAY_LABEL } from '@/lib/fixtures';
import { money, ordinal } from '@/lib/format';
import { formatEta } from '@/lib/live';
import { Announce } from '../Announce';
import { useBooking } from '../BookingProvider';
import { ConfirmDialog } from '../ConfirmDialog';
import { FlowStep } from '../FlowStep';
import { usePatient } from '../PatientProvider';
import { ProtoAction, ProtoNote } from '../ProtoNote';
import { SearchPulse } from '../SearchPulse';

// Uber's "connecting you to a driver". There is nothing to decide here, so
// there is no primary action: the one control is the way out, and it asks
// first. The place and the wait are the queue this patient is really in, so
// they are real numbers in both data modes. A screen reader hears the place
// when it changes and the wait when it crosses a minute, never every second.
export function Finding() {
  const { state, act } = useBooking();
  const { nextId } = usePatient();
  const amount = money(state.quote ?? 0);
  const total = state.queue?.totalSeconds ?? 0;
  const progress = total > 0 ? Math.round((1 - state.etaSeconds / total) * 100) : 0;
  const wait = formatEta(state.etaSeconds);

  return (
    <FlowStep
      screen="finding"
      title="Finding your GP"
      lead="Keep this tab open. We’ll tell you the moment a GP accepts."
      status={<SearchPulse />}
      urgent
      dock={
        <ConfirmDialog
          trigger={<Button size="lg" variant="secondary" className="min-h-13 w-full">Cancel request</Button>}
          title="Cancel your request?"
          description={`Your place goes to the next patient. The ${amount} hold on your card is released in full, so nothing is charged.`}
          cancelLabel="Keep waiting"
          confirmLabel="Cancel request"
          onConfirm={() => act({ type: 'cancel', id: nextId, date: TODAY_LABEL })}
        />
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <StatTile value={ordinal(state.position)} label="in the queue" />
        <StatTile size="sm" value={wait} label="Estimated wait" />
      </div>
      <Progress
        value={progress}
        aria-label="Progress to the front of the queue"
        getValueLabel={() => `${wait} left`}
      />
      <p className="text-body">{`${amount} held on your card. Taken only when a GP accepts.`}</p>
      <Announce text={`${ordinal(state.position)} in the queue, ${wait}.`} />
      <ProtoNote>
        <ProtoAction onClick={() => act({ type: 'skipWait', now: Date.now() })}>Prototype: skip the wait</ProtoAction>
        <ProtoAction onClick={() => act({ type: 'skipWait', now: Date.now(), gps: NO_GP_ONLINE })}>Prototype: no GP available</ProtoAction>
      </ProtoNote>
    </FlowStep>
  );
}
