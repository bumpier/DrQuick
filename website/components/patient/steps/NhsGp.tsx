'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBooking } from '../BookingProvider';
import { FieldError } from '../FieldError';
import { FlowStep, focusFirstInvalid } from '../FlowStep';
import { RequestSummary } from '../RequestSummary';

// The practice, and the one real decision on this screen: whether the GP may
// send a summary to it. The answer is a button either way, never a field the
// Enter key could submit, because consent to share a clinical summary has to
// be chosen, not defaulted. Refusing costs something (the GP may not
// prescribe without the record), so the screen says so before the choice.
export function NhsGp() {
  const { state, act } = useBooking();
  const { errors } = state;
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { if (attempt > 0) focusFirstInvalid(); }, [attempt]);

  const answer = (consent: boolean) => {
    act({ type: 'submitNhs', consent });
    setAttempt((n) => n + 1);
  };

  return (
    <FlowStep
      screen="nhs-gp"
      step="nhs-gp"
      back="action"
      title="Your NHS GP"
      status={<RequestSummary />}
      statusOnPhone={false}
      urgent
      dock={
        <>
          <Button size="lg" className="min-h-13 w-full" onClick={() => answer(true)}>Yes, share with my NHS GP</Button>
          <Button size="lg" variant="secondary" className="min-h-13 w-full" onClick={() => answer(false)}>No, don’t share</Button>
        </>
      }
    >
      <div className="grid gap-2">
        <Label htmlFor="practice">GP practice name</Label>
        <Input
          id="practice"
          autoComplete="organization"
          value={state.practice}
          onChange={(event) => act({ type: 'setPractice', practice: event.target.value })}
          aria-invalid={errors.practice ? true : undefined}
          aria-describedby={errors.practice ? 'practice-error' : undefined}
        />
        <FieldError id="practice-error">{errors.practice}</FieldError>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="postcode">Practice postcode</Label>
        <Input
          id="postcode"
          autoComplete="off"
          autoCapitalize="characters"
          placeholder="e.g. SW1A 1AA"
          className="max-w-[14rem]"
          value={state.postcode}
          onChange={(event) => act({ type: 'setPostcode', postcode: event.target.value })}
          aria-invalid={errors.postcode ? true : undefined}
          aria-describedby={errors.postcode ? 'postcode-error' : undefined}
        />
        <FieldError id="postcode-error">{errors.postcode}</FieldError>
      </div>
      <div className="grid gap-1">
        <p className="text-body font-semibold">May we send your NHS GP a summary of this consultation?</p>
        <p className="text-fine text-ink-2">Without it, the GP may be unable to prescribe some treatments safely.</p>
      </div>
    </FlowStep>
  );
}
