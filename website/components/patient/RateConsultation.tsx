'use client';

import { useState } from 'react';
import { StarIcon } from 'lucide-react';

// One to five stars for the consultation that has just finished, asked once.
// In this prototype the answer is held on the screen and goes nowhere; the real
// flow hands it to recordRating() in lib/ratings.ts. There is no comment box:
// free text about a consultation would be health information.
export function RateConsultation() {
  const [stars, setStars] = useState<number | null>(null);

  if (stars !== null) {
    return (
      <p role="status" className="text-body">
        Thank you. You gave this consultation {stars} out of 5.
      </p>
    );
  }

  return (
    <div data-slot="rate-consultation" className="grid gap-2">
      <p id="rate-consultation-label" className="text-body font-semibold">How was your consultation?</p>
      <div role="radiogroup" aria-labelledby="rate-consultation-label" className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={false}
            aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}
            onClick={() => setStars(n)}
            className="grid size-12 cursor-pointer place-items-center rounded-pill text-ink-2 hover:bg-surface-mid hover:text-primary-ink"
          >
            <StarIcon strokeWidth={2} aria-hidden="true" className="size-7" />
          </button>
        ))}
      </div>
      <p className="text-fine text-ink-2">Your GP sees their average, never who gave which rating.</p>
    </div>
  );
}
