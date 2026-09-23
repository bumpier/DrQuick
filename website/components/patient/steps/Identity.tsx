'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDelayed } from '@/hooks/use-delayed';
import { IDENTITY_CHECK_MS } from '@/lib/booking-flow';
import { useBooking } from '../BookingProvider';
import { FlowStep } from '../FlowStep';
import { usePatient } from '../PatientProvider';
import { RequestSummary } from '../RequestSummary';

// The regulator's online-provider programme expects identity checked for every
// consultation and says outright that a payment card is not ID. A returning
// patient's check is on file; a first patient walks it (the prototype stages
// the wait a real check takes).
export function Identity() {
  const { act } = useBooking();
  const { identityVerified: onFile, identityChecked, account } = usePatient();
  const check = useDelayed(IDENTITY_CHECK_MS);

  const title = onFile ? 'Photo ID already verified' : 'Photo ID and a selfie';
  const note = onFile
    ? (identityChecked ? 'Checked earlier today. Nothing to do.' : `Checked when you joined in ${account.memberSince}. Nothing to do.`)
    : 'You’ll photograph your ID and take a quick selfie.';

  return (
    <FlowStep
      screen="identity"
      step="identity"
      back="action"
      title="Verify it’s you"
      lead="Stripe Identity checks a photo ID (a passport or driving licence, not a payment card). It takes about a minute."
      status={<RequestSummary />}
      statusOnPhone={false}
      urgent
      dock={
        onFile ? (
          <Button size="lg" className="min-h-13 w-full" onClick={() => act({ type: 'confirmIdentity' })}>Continue</Button>
        ) : (
          <Button
            size="lg"
            className="min-h-13 w-full"
            disabled={check.pending}
            aria-busy={check.pending || undefined}
            onClick={() => check.run(() => act({ type: 'verifyIdentity' }))}
          >
            {check.pending ? 'Checking your ID…' : 'Verify identity'}
          </Button>
        )
      }
    >
      <Card size="sm">
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>{title}</CardTitle>
          <CardDescription>{note}</CardDescription>
          <CardAction>
            <Badge variant={onFile ? 'success' : 'secondary'}>{onFile ? 'Verified' : check.pending ? 'Checking' : 'Not started'}</Badge>
          </CardAction>
        </CardHeader>
      </Card>
    </FlowStep>
  );
}
