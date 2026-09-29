import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { resetDb, useTestDb } from './helpers/db';
import { setDb, type DB } from '@/lib/db';
import { consultations, events, patients, payments, payouts, refunds, sessions, waitlistSignups } from '@/lib/db/schema';
import { newToken } from '@/lib/waitlist';
import { parseRange } from '@/lib/admin/range';
import { overview, topReferrers, visitorCount } from '@/lib/admin/queries/overview';

let db: DB;
beforeAll(async () => { db = await useTestDb(); });
beforeEach(async () => { setDb(db); await resetDb(db); });

const NOW = new Date('2026-09-29T12:00:00Z');
const at = (iso: string) => new Date(iso);
const range = () => parseRange({ from: '2026-09-23', to: '2026-09-29' }, NOW); // prev: 16–22 Sept

async function signup(role: 'patient' | 'gp', email: string, createdAt: string, extra: Partial<typeof waitlistSignups.$inferInsert> = {}) {
  await db.insert(waitlistSignups).values({
    role, email, source: role === 'gp' ? 'hero-gp' : 'hero', status: role === 'gp' ? 'new' : 'subscribed',
    unsubscribeToken: newToken(), createdAt: at(createdAt), ...extra,
  });
}

let sid = 0;
async function session(visitorId: string | null, startedAt: string, extra: Partial<typeof sessions.$inferInsert> = {}) {
  sid += 1;
  const id = `00000000-0000-4000-8000-${String(sid).padStart(12, '0')}`;
  await db.insert(sessions).values({
    id, visitorId, startedAt: at(startedAt), lastSeen: at(startedAt), entryPath: '/', exitPath: '/', currentPath: '/',
    device: 'mobile', browser: 'Safari', os: 'iOS', ...extra,
  });
}

const V1 = '11111111-1111-4111-8111-111111111111';
const V2 = '22222222-2222-4222-8222-222222222222';

describe('with no data at all', () => {
  test('every figure is zero and every list empty, and nothing throws', async () => {
    const o = await overview(db, range(), NOW);
    expect(o.visitors).toBe(0);
    expect(o.signups).toEqual({ patients: 0, gps: 0 });
    expect(o.conversion).toBeNull();
    expect(o.revenue).toBe(0);
    expect(o.payouts).toEqual({ pence: 0, count: 0 });
    expect(o.latestGps).toEqual([]);
    expect(o.referrers).toEqual([]);
    expect(o.live).toEqual({ total: 0, sessions: [] });
    expect(o.signupSeries.keys).toHaveLength(7);
    expect(o.signupSeries.values.patients.every((v) => v === 0)).toBe(true);
  });
});

test('sign-ups are counted per role, per day, against the previous period', async () => {
  await signup('patient', 'a@x.test', '2026-09-23T09:00:00Z');
  await signup('patient', 'b@x.test', '2026-09-29T23:59:00Z');
  await signup('gp', 'c@x.test', '2026-09-25T10:00:00Z', { name: 'Dr C', gmc: '7654321' });
  await signup('patient', 'old@x.test', '2026-09-20T10:00:00Z');      // previous period
  await signup('patient', 'older@x.test', '2026-09-01T10:00:00Z');    // outside both
  await signup('patient', 'future@x.test', '2026-09-30T00:00:00Z');   // after the range

  const o = await overview(db, range(), NOW);
  expect(o.signups).toEqual({ patients: 2, gps: 1 });
  expect(o.prevSignups).toEqual({ patients: 1, gps: 0 });
  expect(o.signupSeries.keys[0]).toBe('2026-09-23');
  expect(o.signupSeries.values.patients).toEqual([1, 0, 0, 0, 0, 0, 1]);
  expect(o.signupSeries.values.gps).toEqual([0, 0, 1, 0, 0, 0, 0]);
  expect(o.latestGps.map((g) => g.name)).toEqual(['Dr C']);
});

test('visitors: distinct consented visitors plus each cookieless page view', async () => {
  await session(V1, '2026-09-24T10:00:00Z');
  await session(V1, '2026-09-25T10:00:00Z');                // same person, second visit
  await session(V2, '2026-09-25T11:00:00Z');
  await session(null, '2026-09-26T11:00:00Z');              // a session with no visitor counts once
  await session(V2, '2026-09-10T11:00:00Z');                // outside the range
  await db.insert(events).values([
    { type: 'pageview', path: '/', ts: at('2026-09-25T12:00:00Z') },
    { type: 'pageview', path: '/pricing', ts: at('2026-09-26T12:00:00Z') },
    { type: 'click', path: '/', ts: at('2026-09-26T12:00:00Z') },                        // not a page view
    { type: 'pageview', path: '/', ts: at('2026-09-26T12:00:00Z'), visitorId: V1 },       // tracked, already counted
  ]);
  expect(await visitorCount(db, range())).toBe(3 + 2);
  const o = await overview(db, range(), NOW);
  expect(o.visitorSeries.values.visitors).toEqual([0, 1, 3, 2, 0, 0, 0]);

  await signup('patient', 'a@x.test', '2026-09-24T09:00:00Z');
  const again = await overview(db, range(), NOW);
  expect(again.conversion).toBeCloseTo(1 / 5);
});

test('top referrers group by host without www, and live means seen in the last five minutes', async () => {
  await session(V1, '2026-09-24T10:00:00Z', { referrer: 'https://www.google.com/search?q=gp' });
  await session(V2, '2026-09-25T10:00:00Z', { referrer: 'https://google.com/' });
  await session(null, '2026-09-25T10:00:00Z', { referrer: 'https://news.ycombinator.com/item?id=1' });
  await session(null, '2026-09-29T11:57:00Z', { lastSeen: at('2026-09-29T11:58:00Z'), currentPath: '/pricing' });
  await session(null, '2026-09-29T11:00:00Z', { lastSeen: at('2026-09-29T11:50:00Z') });
  expect(await topReferrers(db, range())).toEqual([
    { host: 'google.com', sessions: 2 },
    { host: 'news.ycombinator.com', sessions: 1 },
  ]);
  const o = await overview(db, range(), NOW);
  expect(o.live.total).toBe(1);
  expect(o.live.sessions[0].path).toBe('/pricing');
});

test('revenue this month is payments succeeded less refunds; payouts pending sum in pence', async () => {
  const [p] = await db.insert(patients).values({ email: 'p@x.test' }).returning();
  const [c] = await db.insert(consultations).values({
    patientId: p.id, status: 'completed', requestedAt: at('2026-09-10T10:00:00Z'), pricePence: 4000, gpFeePence: 2800, platformFeePence: 1200,
  }).returning();
  const [pay] = await db.insert(payments).values([
    { consultationId: c.id, amountPence: 4000, status: 'succeeded', paidAt: at('2026-09-10T10:00:00Z') },
    { consultationId: c.id, amountPence: 3600, status: 'succeeded', paidAt: at('2026-08-10T10:00:00Z') },
    { consultationId: c.id, amountPence: 9999, status: 'failed', paidAt: at('2026-09-10T10:00:00Z') },
  ]).returning();
  await db.insert(refunds).values({ paymentId: pay.id, amountPence: 500, createdAt: at('2026-09-11T10:00:00Z') });
  const gp = '33333333-3333-4333-8333-333333333333';
  await db.insert(payouts).values([
    { gpId: gp, periodStart: at('2026-09-01'), periodEnd: at('2026-09-07'), amountPence: 2800, status: 'pending' },
    { gpId: gp, periodStart: at('2026-08-01'), periodEnd: at('2026-08-07'), amountPence: 5000, status: 'paid' },
  ]);
  const o = await overview(db, range(), NOW);
  expect(o.revenue).toBe(3500);
  expect(o.prevRevenue).toBe(3600);
  expect(o.payouts).toEqual({ pence: 2800, count: 1 });
});
