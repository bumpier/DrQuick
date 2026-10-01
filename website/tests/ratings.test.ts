import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { randomUUID } from 'node:crypto';
import { resetDb, useTestDb } from './helpers/db';
import { setDb, type DB } from '@/lib/db';
import { consultationRatings, consultations, gps } from '@/lib/db/schema';
import { PUBLIC_MIN_RATINGS, formatRating, publicRating, ratingSummary, recordRating } from '@/lib/ratings';

const NOW = new Date('2026-10-01T09:00:00Z');

let db: DB;
beforeAll(async () => { db = await useTestDb(); });

let me: string;
let other: string;
beforeEach(async () => {
  setDb(db);
  await resetDb(db);
  const [a, b] = await db.insert(gps).values([
    { name: 'GP One', email: 'one@example.com', gmc: '7000001', status: 'active' },
    { name: 'GP Two', email: 'two@example.com', gmc: '7000002', status: 'active' },
  ]).returning();
  me = a.id;
  other = b.id;
});

type Status = 'completed' | 'in_progress' | 'no_show' | 'requested';
async function consultation(status: Status = 'completed', gpId: string | null = me) {
  const [row] = await db.insert(consultations).values({
    patientId: randomUUID(), gpId, status, requestedAt: NOW, pricePence: 4000, gpFeePence: 2400, platformFeePence: 1600,
  }).returning();
  return row.id;
}
const rate = async (stars: number[], gpId = me) => {
  for (const s of stars) expect(await recordRating(db, await consultation('completed', gpId), s, NOW)).toEqual({ ok: true });
};

describe('recording a rating', () => {
  test('a completed consultation is rated once, for the doctor who took it', async () => {
    const id = await consultation();
    expect(await recordRating(db, id, 5, NOW)).toEqual({ ok: true });
    expect(await db.select().from(consultationRatings)).toMatchObject([{ consultationId: id, gpId: me, stars: 5 }]);
  });

  test('a second rating for the same consultation is refused and the first stands', async () => {
    const id = await consultation();
    await recordRating(db, id, 5, NOW);
    expect(await recordRating(db, id, 1, NOW)).toEqual({ ok: false, reason: 'already_rated' });
    expect((await db.select().from(consultationRatings))[0].stars).toBe(5);
  });

  test.each(['in_progress', 'no_show', 'requested'] as const)('a consultation that is %s cannot be rated', async (status) => {
    const id = await consultation(status, status === 'requested' ? null : me);
    expect(await recordRating(db, id, 4, NOW)).toEqual({ ok: false, reason: 'not_completed' });
  });

  test('a consultation that does not exist, or an id that is not one, cannot be rated', async () => {
    expect(await recordRating(db, randomUUID(), 4, NOW)).toEqual({ ok: false, reason: 'not_found' });
    expect(await recordRating(db, 'not-a-uuid', 4, NOW)).toEqual({ ok: false, reason: 'not_found' });
  });

  test.each([0, 6, 4.5, -1, Number.NaN])('%s stars is not a rating', async (stars) => {
    expect(await recordRating(db, await consultation(), stars, NOW)).toEqual({ ok: false, reason: 'invalid_stars' });
    expect(await db.select().from(consultationRatings)).toHaveLength(0);
  });
});

describe('a doctor’s rating', () => {
  test('is the average of their own ratings, with how many and how they fall', async () => {
    await rate([5, 5, 4, 3]);
    await rate([1, 1], other);
    expect(await ratingSummary(db, me)).toEqual({ average: 4.25, count: 4, distribution: [0, 0, 1, 1, 2] });
  });

  test('with no ratings there is no average, not a zero', async () => {
    expect(await ratingSummary(db, me)).toEqual({ average: null, count: 0, distribution: [0, 0, 0, 0, 0] });
  });
});

describe('what a patient is shown', () => {
  test('nothing until there are enough ratings for an average to mean something', () => {
    expect(PUBLIC_MIN_RATINGS).toBe(5);
    expect(publicRating({ average: 5, count: 4 })).toBeNull();
    expect(publicRating({ average: null, count: 0 })).toBeNull();
    expect(publicRating(null)).toBeNull();
    expect(publicRating({ average: 4.25, count: 5 })).toEqual({ average: 4.25, count: 5 });
  });

  test('the figure is written to a fixed number of places, and never rounds up to a score nobody gave', () => {
    expect(formatRating(4.25)).toBe('4.25');
    expect(formatRating(5)).toBe('5.00');
    expect(formatRating(4.866666)).toBe('4.87');
    expect(formatRating(4.9, 1)).toBe('4.9');
    // 4.96 to one place would read "5.0": a perfect score the doctor does not have.
    expect(formatRating(4.96, 1)).toBe('4.9');
    expect(formatRating(4.999)).toBe('4.99');
  });
});
