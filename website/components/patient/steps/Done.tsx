'use client';

import Link from 'next/link';
import { Facts } from '@/components/app/Facts';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { money } from '@/lib/format';
import { useBooking } from '../BookingProvider';
import { FlowStep } from '../FlowStep';
import { NothingYet } from '../NothingYet';
import { usePatient } from '../PatientProvider';
import { RateConsultation } from '../RateConsultation';

const minutesLabel = (n: number) => `${n} minute${n === 1 ? '' : 's'}`;

// The receipt, and the end. A seeded landing on this URL previews the receipt
// the worked example would leave, but a URL never writes history, so only a
// consultation the patient really finished says it was saved, and only that
// one is asked for its one-to-five-star rating (since 2026-10-01).
export function Done() {
  const { state } = useBooking();
  const { nextId } = usePatient();

  const record = state.record;
  const preview = !record && state.seeded && state.gp
    ? { id: nextId, gp: state.gp.ref, minutes: Math.max(1, Math.round(state.seconds / 60)), cost: state.quote ?? 0 }
    : null;
  const receipt = record ? { id: record.id, gp: record.gp ?? '', minutes: record.minutes, cost: record.cost } : preview;
  if (!receipt) return <NothingYet screen="done" title="Nothing to show yet" />;

  return (
    <FlowStep
      screen="done"
      layout="column"
      title="All done"
      lead={record ? `Saved to your account as ${record.id}. You’ll get a summary by email.` : 'You’ll get a summary by email.'}
      dock={
        <Button asChild size="lg" className="min-h-13 w-full">
          <Link href="/patient">Back to home</Link>
        </Button>
      }
    >
      <Card>
        <CardContent>
          <Facts
            items={[
              ['Reference', receipt.id],
              ['GP', receipt.gp],
              ['Length', minutesLabel(receipt.minutes)],
              ['Paid', money(receipt.cost)],
              ['Recording', 'Not recorded'],
            ]}
          />
        </CardContent>
      </Card>
      <p className="text-body text-ink-2">
        {`Your ${money(receipt.cost)} covered the consultation and writing any prescription you need. The pharmacy charges separately for the medicine itself.`}
      </p>
      {record && <RateConsultation />}
    </FlowStep>
  );
}
