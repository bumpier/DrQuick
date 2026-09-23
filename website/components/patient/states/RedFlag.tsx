'use client';

import Link from 'next/link';
import { CircleAlertIcon, PhoneIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SAFETY_FLAGS } from '@/lib/booking-flow';
import { useBooking } from '../BookingProvider';
import { FlowStep } from '../FlowStep';

// The hard stop, full bleed on the one dark fill it is allowed. The number is
// a real tel: link and the first thing focus reaches after the heading, with
// nothing to scroll past on any phone. The screen names back what the patient
// ticked, so they know why they are here. Nothing has been charged: no hold
// exists before the quote.
export function RedFlag() {
  const { state } = useBooking();
  const ticked = SAFETY_FLAGS.filter((flag) => state.flags.includes(flag.id));
  return (
    <FlowStep
      screen="red-flag"
      layout="band"
      back="action"
      title="Call 999 now"
      lead={ticked.length > 0
        ? 'What you told us needs emergency care, not a video consultation.'
        : 'Anything on the safety check needs emergency care, not a video consultation.'}
    >
      {ticked.length > 0 && (
        <div>
          <p className="font-semibold">You told us:</p>
          <ul className="mt-3 grid gap-2">
            {ticked.map((flag) => (
              <li key={flag.id} className="flex items-start gap-2 text-body">
                <CircleAlertIcon strokeWidth={2} aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-error" />
                <span>{flag.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Button asChild size="lg" variant="secondary" className="min-h-14 w-full text-lg">
        <a href="tel:999">
          <PhoneIcon strokeWidth={2} aria-hidden="true" className="text-error" />
          Call 999
        </a>
      </Button>
      <p className="text-body text-band-muted">Or go to your nearest A&amp;E. Nothing has been charged.</p>
      <Button asChild variant="ghost" className="justify-self-start text-white hover:bg-white/10">
        <Link href="/patient">Back to home</Link>
      </Button>
    </FlowStep>
  );
}
