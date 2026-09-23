'use client';

import { Facts } from '@/components/app/Facts';
import { Button } from '@/components/ui/button';
import { useDelayed } from '@/hooks/use-delayed';
import { waitEstimate } from '@/lib/booking';
import { AUTHORISE_MS } from '@/lib/booking-flow';
import { useFigures } from '@/lib/data-mode';
import { money } from '@/lib/format';
import { formatEta } from '@/lib/live';
import { floorFor } from '@/lib/pricing';
import { useBooking } from '../BookingProvider';
import { FlowStep } from '../FlowStep';
import { usePatient } from '../PatientProvider';
import { PriceQuote } from '../PriceQuote';
import { ProtoAction, ProtoNote } from '../ProtoNote';
import { RequestSummary } from '../RequestSummary';

// The commit. The price was fixed when this screen was first reached and is
// shown in full, with what it covers, beside the wait: the whole decision on
// one screen. Nothing here counts down, and nothing explains the price by
// demand. The wait quoted before booking is a claim about a floor of GPs
// that does not exist yet, so in blank mode it is a dash.
export function Quote() {
  const { state, act } = useBooking();
  const { card } = usePatient();
  const { shown } = useFigures();
  const hold = useDelayed(AUTHORISE_MS);

  const amount = money(state.quote ?? 0);
  const wait = shown(waitEstimate(floorFor(state.seeded)).etaSeconds, formatEta);
  const payWith = state.card === 'declined'
    ? 'Test card that will be declined'
    : card ? `${card.brand} ending ${card.last4}` : 'Test card';

  return (
    <FlowStep
      screen="quote"
      step="quote"
      back="action"
      title="Your price, in full"
      lead="Fixed the moment you confirm. Nothing else to pay Dr Quick."
      status={<RequestSummary />}
      statusOnPhone={false}
      urgent
      dock={
        <Button
          size="lg"
          className="min-h-13 w-full"
          disabled={hold.pending}
          aria-busy={hold.pending || undefined}
          onClick={() => hold.run(() => act({ type: 'authorise', now: Date.now() }))}
        >
          {hold.pending ? `Holding ${amount}…` : `Request a GP for ${amount}`}
        </Button>
      }
    >
      <PriceQuote amount={state.quote ?? 0} wait={wait} />
      <Facts items={[['Pay with', payWith]]} />
      <p className="text-body">
        {`${amount} is held on your card now, taken only when a GP accepts, and released in full if no GP is available.`}
      </p>
      <ProtoNote>
        <ProtoAction onClick={() => act({ type: 'setCard', card: state.card === 'declined' ? 'ok' : 'declined' })}>
          {state.card === 'declined' ? 'Prototype: use a card that will be accepted' : 'Prototype: use a card that will be declined'}
        </ProtoAction>
      </ProtoNote>
    </FlowStep>
  );
}
