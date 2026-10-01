// The rules a rating is shown by. Pure, so the doctor portal, the admin and the
// patient's card all read the same ones.
//
// A GP's rating is the average of the one-to-five-star ratings patients gave
// their completed consultations (decided by the user on 2026-10-01, reversing
// the earlier "no ratings"). It is only ever shown as an average and a count:
// never one rating on its own, and never beside a GP's name or face on a
// patient surface.

export type Rating = { average: number; count: number };

// A patient is shown a GP's rating only once this many patients have given
// one. One early score is not an average, and showing it would hang a GP's
// first impression on a single consultation.
export const PUBLIC_MIN_RATINGS = 5;

/** What a patient may be shown: the rating, or nothing until there are enough. */
export function publicRating(rating: { average: number | null; count: number } | null | undefined): Rating | null {
  if (!rating || rating.average === null || rating.count < PUBLIC_MIN_RATINGS) return null;
  return { average: rating.average, count: rating.count };
}

/**
 * The average as written. Rounded, except that it never rounds up to a
 * perfect five the GP does not have: 4.96 to one place is "4.9", not "5.0".
 */
export function formatRating(average: number, places = 2): string {
  const factor = 10 ** places;
  const rounded = Math.round(average * factor) / factor;
  const shown = rounded >= 5 && average < 5 ? Math.floor(average * factor) / factor : rounded;
  return shown.toFixed(places);
}

export const ratingsLabel = (count: number) => `${count.toLocaleString('en-GB')} ${count === 1 ? 'rating' : 'ratings'}`;
