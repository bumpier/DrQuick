'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { COMPLAINTS } from '@/lib/booking';
import { COMPLAINT_IDS, DURATIONS, type ComplaintId, type Duration } from '@/lib/booking-flow';
import { useBooking } from '../BookingProvider';
import { ChoiceRow } from '../ChoiceRow';
import { FieldError } from '../FieldError';
import { FlowStep, focusFirstInvalid } from '../FlowStep';
import { RequestSummary } from '../RequestSummary';

// Nothing is chosen for the patient: a pre-selected symptom submitted by a
// tired thumb is worse for the GP than one more tap.
export function Symptoms() {
  const { state, act } = useBooking();
  const { errors } = state;
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { if (attempt > 0) focusFirstInvalid(); }, [attempt]);

  const submit = () => {
    act({ type: 'submitSymptoms' });
    setAttempt((n) => n + 1);
  };

  return (
    <FlowStep
      screen="symptoms"
      step="symptoms"
      back="/patient"
      title="Tell us what’s wrong"
      status={<RequestSummary />}
      statusOnPhone={false}
      urgent
      dock={<Button size="lg" className="min-h-13 w-full" onClick={submit}>Continue</Button>}
    >
      <div className="grid gap-3">
        <p id="complaint-label" className="text-label font-semibold">Main symptom</p>
        <RadioGroup
          aria-labelledby="complaint-label"
          aria-invalid={errors.complaint ? true : undefined}
          aria-describedby={errors.complaint ? 'complaint-error' : undefined}
          value={state.complaint ?? ''}
          onValueChange={(value) => act({ type: 'setComplaint', complaint: value as ComplaintId })}
        >
          {COMPLAINT_IDS.map((id) => (
            <ChoiceRow key={id} control={<RadioGroupItem value={id} />}>{COMPLAINTS[id].label}</ChoiceRow>
          ))}
        </RadioGroup>
        <FieldError id="complaint-error">{errors.complaint}</FieldError>
      </div>

      <div className="grid gap-3">
        <p id="duration-label" className="text-label font-semibold">How long have you had it?</p>
        <RadioGroup
          aria-labelledby="duration-label"
          aria-invalid={errors.duration ? true : undefined}
          aria-describedby={errors.duration ? 'duration-error' : undefined}
          className="grid-cols-3"
          value={state.duration ?? ''}
          onValueChange={(value) => act({ type: 'setDuration', duration: value as Duration })}
        >
          {DURATIONS.map((duration) => (
            <ChoiceRow key={duration} layout="tile" control={<RadioGroupItem value={duration} />}>{duration}</ChoiceRow>
          ))}
        </RadioGroup>
        <FieldError id="duration-error">{errors.duration}</FieldError>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="details">Anything else the GP should know?</Label>
        <Textarea
          id="details"
          rows={4}
          autoCapitalize="sentences"
          placeholder="In your own words"
          value={state.details}
          onChange={(event) => act({ type: 'setDetails', details: event.target.value })}
          aria-invalid={errors.details ? true : undefined}
          aria-describedby={errors.details ? 'details-hint details-error' : 'details-hint'}
        />
        <p id="details-hint" className="text-fine text-ink-2">
          {state.complaint === 'other' ? 'Needed when you pick ‘Something else’, so the GP knows what to expect.' : 'Optional.'}
        </p>
        <FieldError id="details-error">{errors.details}</FieldError>
      </div>
    </FlowStep>
  );
}
