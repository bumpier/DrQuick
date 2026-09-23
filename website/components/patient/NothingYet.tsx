'use client';

import { EmptyState } from '@/components/app/EmptyState';
import { Button } from '@/components/ui/button';
import { NOTHING_YET } from '@/lib/patient';
import { useBooking } from './BookingProvider';
import { FlowStep } from './FlowStep';
import { usePatient } from './PatientProvider';

// What a screen reached by URL shows when this session never produced the
// thing it describes: a sentence and a way to start, never an invented GP, a
// running clock or an outcome nobody decided. The heading says what is
// missing, so it never claims something happened. It carries the 999 line:
// someone who lands here has no consultation, and may need one urgently.
export function NothingYet({ screen, title }: { screen: string; title: string }) {
  const { act } = useBooking();
  const { saved } = usePatient();
  return (
    <FlowStep
      screen={screen}
      layout="column"
      title={title}
      urgent
      dock={
        <Button size="lg" className="min-h-13 w-full" onClick={() => act({ type: 'start', prefill: saved })}>
          Start a consultation
        </Button>
      }
    >
      <EmptyState>{NOTHING_YET}</EmptyState>
    </FlowStep>
  );
}
