import { Stars } from '@/components/app/Stars';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PUBLIC_MIN_RATINGS, formatRating, ratingsLabel } from '@/lib/rating-rules';
import type { RatingSummary } from '@/lib/ratings';

// A doctor's own rating: the average, how many patients gave one, and how they
// fall across the five stars. Never which consultation a rating came from.
export function RatingCard({ summary }: { summary: RatingSummary }) {
  const { average, count, distribution } = summary;
  const most = Math.max(1, ...distribution);

  return (
    <Card size="sm" data-slot="rating-card">
      <CardHeader>
        <CardTitle>Your rating</CardTitle>
        <CardDescription>
          {count < PUBLIC_MIN_RATINGS
            ? `Patients rate each completed consultation from one to five stars. They see your rating once you have ${PUBLIC_MIN_RATINGS}.`
            : 'The average of the stars patients gave your completed consultations. Patients see it when they are matched with you.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {average === null ? (
          <p className="text-body text-ink-2">No ratings yet.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
              <span className="font-display text-4xl font-bold leading-none tracking-[-.03em] tabular-nums">{formatRating(average)}</span>
              <span className="text-body text-ink-2">out of 5, from {ratingsLabel(count)}</span>
            </div>
            <Stars value={average} />
            <dl className="grid gap-1.5">
              {[5, 4, 3, 2, 1].map((stars) => {
                const n = distribution[stars - 1];
                return (
                  <div key={stars} className="grid grid-cols-[4.5rem_1fr_2.5rem] items-center gap-3 text-fine">
                    <dt className="text-ink-2">{stars} {stars === 1 ? 'star' : 'stars'}</dt>
                    <dd className="contents">
                      <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-pill bg-fill">
                        <span className="block h-full rounded-pill bg-primary-ink" style={{ width: `${(n / most) * 100}%` }} />
                      </span>
                      <span className="text-right tabular-nums">{n}</span>
                    </dd>
                  </div>
                );
              })}
            </dl>
          </>
        )}
      </CardContent>
    </Card>
  );
}
