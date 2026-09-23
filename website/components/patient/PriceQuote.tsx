import { StatTile } from '@/components/app/StatTile';
import { Card, CardContent } from '@/components/ui/card';
import { PRICE } from '@/lib/fixtures';
import { money } from '@/lib/format';

// The price in full, with the wait it is quoted beside: a patient decides on
// the two together, never on the price and then the queue. What it covers and
// what it does not sits under the figure, not after it, and nothing here is
// framed as time pressure.
export function PriceQuote({ amount, wait }: { amount: number; wait: string }) {
  return (
    <Card data-slot="price-quote">
      <CardContent className="grid gap-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="grid min-w-0 content-start gap-1">
            <span data-slot="quote-amount" className="font-display text-4xl leading-none font-bold tracking-[-.03em] tabular-nums">
              {money(amount)}
            </span>
            <span className="text-fine text-ink-2">Consultation and any prescription you need</span>
          </div>
          <StatTile size="sm" value={wait} label="Estimated wait" />
        </div>
        <p className="text-body text-ink-2">{PRICE.note}</p>
      </CardContent>
    </Card>
  );
}
