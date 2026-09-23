'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SAFETY_FLAGS } from '@/lib/booking-flow';
import { useBooking } from '../BookingProvider';
import { ChoiceRow } from '../ChoiceRow';
import { FlowStep } from '../FlowStep';
import { RequestSummary } from '../RequestSummary';

// A checklist with one way forward. Ticking anything does not hide the
// button, it changes where the button goes and says so: a patient in trouble
// should never have to hunt for a second, differently worded control. The
// 999 number appears the moment a box is ticked, before anything is pressed.
export function SafetyCheck() {
  const { state, act } = useBooking();
  const flagged = state.flags.length > 0;
  return (
    <FlowStep
      screen="safety-check"
      step="safety-check"
      back="action"
      title="Quick safety check"
      lead="Tick anything that applies to you right now."
      status={<RequestSummary />}
      statusOnPhone={false}
      urgent={!flagged}
      dock={
        <Button size="lg" className="min-h-13 w-full" onClick={() => act({ type: 'submitSafety' })}>
          {flagged ? 'Continue — this needs emergency care' : 'None of these — continue'}
        </Button>
      }
    >
      <div role="group" aria-label="Signs that need emergency care" className="grid gap-2">
        {SAFETY_FLAGS.map((flag) => (
          <ChoiceRow
            key={flag.id}
            control={
              <Checkbox
                checked={state.flags.includes(flag.id)}
                onCheckedChange={() => act({ type: 'toggleFlag', flag: flag.id })}
              />
            }
          >
            {flag.label}
          </ChoiceRow>
        ))}
      </div>
      {flagged && (
        <div role="alert" data-slot="emergency-now" className="urgent">
          <p>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <circle cx="9" cy="9" r="7.6" stroke="currentColor" strokeWidth="2.1" />
              <path d="M9 5v4.6" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
              <circle cx="9" cy="12.7" r="1.2" fill="currentColor" />
            </svg>
            <span>
              This needs emergency care. <b><a className="tel" href="tel:999">Call 999</a> or go to A&amp;E now.</b>
            </span>
          </p>
        </div>
      )}
    </FlowStep>
  );
}
