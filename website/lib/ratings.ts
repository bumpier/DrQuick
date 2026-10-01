// Ratings in the database: recording one, and a GP's summary. Server-only.
//
// recordRating() is the one way a rating is written. Nothing in production
// calls it yet: the patient surface is still a prototype with no real
// consultations. The real patient flow calls it when a patient rates the
// consultation they have just finished.
//
// A rating belongs to a consultation, so it can be given once, and only for a
// consultation that was completed. It carries no comment: free text about a
// consultation would be health data. A doctor is shown their average, count
// and spread (ratingSummary) and never which consultation a rating came from.
import { sql } from 'drizzle-orm';
import type { DB } from '@/lib/db';
import { rowsOf } from '@/lib/rate-limit';

export * from '@/lib/rating-rules';

export type RatingSummary = {
  average: number | null;                             // null with no ratings: not a zero
  count: number;
  distribution: [number, number, number, number, number];   // how many gave 1, 2, 3, 4 and 5 stars
};

export type RecordResult = { ok: true } | { ok: false; reason: 'invalid_stars' | 'not_found' | 'not_completed' | 'already_rated' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function recordRating(db: DB, consultationId: string, stars: number, now = new Date()): Promise<RecordResult> {
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return { ok: false, reason: 'invalid_stars' };
  if (!UUID.test(String(consultationId))) return { ok: false, reason: 'not_found' };

  // One statement: it is written only for a completed consultation that has a
  // GP, and only if it has not been rated before.
  const written = rowsOf(await db.execute(sql`
    insert into consultation_ratings (consultation_id, gp_id, stars, created_at)
    select c.id, c.gp_id, ${stars}, ${now.toISOString()}::timestamptz
    from consultations c where c.id = ${consultationId} and c.status = 'completed' and c.gp_id is not null
    on conflict (consultation_id) do nothing
    returning consultation_id`));
  if (written.length > 0) return { ok: true };

  const [c] = rowsOf<{ status: string; rated: boolean }>(await db.execute(sql`
    select c.status, exists (select 1 from consultation_ratings r where r.consultation_id = c.id) as rated
    from consultations c where c.id = ${consultationId}`));
  if (!c) return { ok: false, reason: 'not_found' };
  return { ok: false, reason: c.rated ? 'already_rated' : 'not_completed' };
}

export async function ratingSummary(db: DB, gpId: string): Promise<RatingSummary> {
  const rows = rowsOf<{ stars: number; n: number }>(await db.execute(
    sql`select stars, count(*)::int as n from consultation_ratings where gp_id = ${gpId} group by stars`));
  const distribution: RatingSummary['distribution'] = [0, 0, 0, 0, 0];
  for (const r of rows) {
    const stars = Number(r.stars);
    if (stars >= 1 && stars <= 5) distribution[stars - 1] = Number(r.n);
  }
  const count = distribution.reduce((sum, n) => sum + n, 0);
  const total = distribution.reduce((sum, n, i) => sum + n * (i + 1), 0);
  return { average: count > 0 ? total / count : null, count, distribution };
}
