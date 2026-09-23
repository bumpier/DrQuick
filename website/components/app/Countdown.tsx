'use client';

import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

/* The offer window as a GP hears it, not only as they see it. The preview put
   aria-live="assertive" on the ticking numeral, which interrupts a screen
   reader forty-five times. Here the numerals are hidden from assistive
   technology and one empty live region is filled four times — on arrival and
   at 30, 15 and 5 seconds — and emptied between, so the removals stay silent
   and only the additions are spoken. The bar drains linearly over each second
   so it reaches the next step as the next tick lands; the global
   reduced-motion rule zeroes that transition and leaves discrete steps. Error
   sits on the numerals for the last five seconds and nowhere else. */

const MILESTONES = new Set([30, 15, 5]);

function announcement(remaining: number, total: number): string {
  if (remaining === total) return `${total} seconds to accept`;
  if (MILESTONES.has(remaining)) return `${remaining} seconds left to accept`;
  return '';
}

export function Countdown({ remaining, total }: { remaining: number; total: number }) {
  // Filled after mount, never in render: a live region announces what is
  // added to it, not what it was born with, and the server HTML stays silent.
  const [said, setSaid] = useState('');
  useEffect(() => { setSaid(announcement(remaining, total)); }, [remaining, total]);

  const percent = Math.round((remaining / total) * 100);

  return (
    <div data-slot="countdown" className="grid gap-3">
      <span
        data-slot="countdown-value"
        aria-hidden="true"
        className={cn(
          'font-display text-4xl font-bold leading-none tracking-[-.03em] tabular-nums',
          remaining <= 5 && 'text-error',
        )}
      >
        {remaining}s
      </span>
      <Progress
        value={percent}
        aria-label="Time left to accept"
        // components/ui/progress.tsx now forwards value to Radix's Root, so
        // its own value→aria-valuenow/data-state wiring is live; only the
        // seconds phrasing needs spelling out, via getValueLabel.
        getValueLabel={() => `${remaining} seconds left`}
        className="[&_[data-slot=progress-indicator]]:duration-1000 [&_[data-slot=progress-indicator]]:ease-linear"
      />
      <p className="sr-only" aria-live="assertive" aria-atomic="true">{said}</p>
    </div>
  );
}
