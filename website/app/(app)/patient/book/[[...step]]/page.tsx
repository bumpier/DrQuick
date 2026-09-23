import type { Metadata } from 'next';
import { BookingFlow } from '@/components/patient/BookingFlow';
import { BOOKING_SCREENS } from '@/lib/booking-flow';

export const dynamic = 'force-static';
export const dynamicParams = false;   // anything not listed is a 404, in development and production

export const metadata: Metadata = { title: 'See a GP' };

// Every step and state is a static URL, so a reviewer can land on any of
// them. The bare route must be `{ step: [] }`: Next 16 coerces a present-but-
// empty optional catch-all to [], and a missing key throws E618 at build.
export function generateStaticParams(): Array<{ step: string[] }> {
  return [{ step: [] }, ...BOOKING_SCREENS.map((step) => ({ step: [step] }))];
}

// `params` is deliberately unused: the screen renders from the booking
// reducer, seeded from usePathname(), identically on the server and the
// client. The URL follows the reducer, never the reverse.
export default function Page(_props: { params: Promise<{ step?: string[] }> }) {
  return <BookingFlow />;
}
