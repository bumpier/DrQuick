'use client';

import { Facts } from '@/components/app/Facts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatClock, outcomeFor } from '@/lib/booking';
import { complaintLabel } from '@/lib/booking-flow';
import { TODAY_LABEL } from '@/lib/fixtures';
import { useBooking } from '../BookingProvider';
import { FlowStep } from '../FlowStep';
import { NothingYet } from '../NothingYet';
import { usePatient } from '../PatientProvider';
import { RequestSummary } from '../RequestSummary';

// What the GP decided, derived from what the patient told us and whether they
// shared their record, so no path promises a prescription and refusing to
// share really costs one. No price here: the price was the quote.
export function Outcome() {
  const { state, act } = useBooking();
  const { nextId, pharmacy } = usePatient();
  const gp = state.gp;
  if (!gp) return <NothingYet screen="outcome" title="No outcome yet" />;

  const outcome = outcomeFor({ complaint: state.complaint ?? 'other', nhsGpConsent: state.nhsGpConsent });
  const where = outcome.prescription
    ? (pharmacy
      ? `It has been sent to ${pharmacy}. The pharmacy charges you separately for the medicine itself.`
      : 'The pharmacy charges you separately for the medicine itself.')
    : null;
  const summary = outcome.sharedWithNhsGp
    ? `Sent to ${state.practice || 'your NHS GP'}`
    : state.nhsGpConsent === false ? 'Not sent. You chose not to share.' : 'Not sent.';

  return (
    <FlowStep
      screen="outcome"
      title="Your outcome"
      lead={`${gp.ref} · ${complaintLabel(state.complaint) ?? 'Something else'} · ${formatClock(state.seconds)}`}
      status={<RequestSummary />}
      statusOnPhone={false}
      dock={
        <Button size="lg" className="min-h-13 w-full" onClick={() => act({ type: 'complete', id: nextId, date: TODAY_LABEL })}>
          Continue
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>{outcome.note}</CardTitle>
          {where && <CardDescription>{where}</CardDescription>}
        </CardHeader>
        <CardContent>
          <Facts
            items={[
              ['Prescription', outcome.prescription ? (pharmacy ? 'Sent to your pharmacy' : 'Written') : 'None issued'],
              ['Fit note', outcome.fitNote ? 'Issued' : 'Not issued'],
              ['Referral', outcome.referral ? 'To your NHS GP' : 'None needed'],
              ['NHS GP summary', summary],
            ]}
          />
        </CardContent>
      </Card>
    </FlowStep>
  );
}
