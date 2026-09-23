'use client';

import { Facts } from '@/components/app/Facts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { complaintLabel } from '@/lib/booking-flow';
import { DASH } from '@/lib/placeholder';
import { useBooking } from './BookingProvider';

const PAST_SAFETY = new Set(['identity', 'nhs-gp', 'quote', 'consent-refused', 'payment-failed', 'finding', 'ready', 'call', 'outcome', 'ended-early', 'done']);

// The request so far, beside the step on a desk (the canvas the map fills in
// Uber). It never shows on a phone, where it would push the question down,
// and it carries no price: the price has one place, the quote.
export function RequestSummary() {
  const { state } = useBooking();
  const answered = state.nhsGpConsent !== null;
  return (
    <Card data-slot="request-summary" className="w-full max-w-[26rem]">
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>Your request</CardTitle>
      </CardHeader>
      <CardContent>
        <Facts
          items={[
            ['What’s wrong', complaintLabel(state.complaint) ?? DASH],
            ['How long', state.duration ?? DASH],
            ['Anything else', state.details.trim() || DASH],
            ['Safety check', PAST_SAFETY.has(state.screen) && state.flags.length === 0 ? 'None ticked' : DASH],
            ['Identity', state.identityVerified ? 'Verified' : DASH],
            ['NHS GP', answered && state.practice ? state.practice : DASH],
            ['Summary shared', answered ? (state.nhsGpConsent ? 'Yes' : 'No') : DASH],
          ]}
        />
      </CardContent>
    </Card>
  );
}
