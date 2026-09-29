import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { resetDb, useTestDb } from './helpers/db';
import { setDb, type DB } from '@/lib/db';
import { consultations, gps, patients, payments, payoutItems, payouts, refunds } from '@/lib/db/schema';
import { dbSource, parseConsultationQuery, parsePayoutQuery } from '@/lib/admin/queries/finance';
import { memorySource, type Dataset } from '@/lib/finance/memory';
import {
  figures, lastMonthKeys, monthElapsed, monthWindow, paymentState, runRate, ZERO_SUMS, type FinanceSource,
} from '@/lib/finance/model';

let db: DB;
beforeAll(async () => { db = await useTestDb(); });
beforeEach(async () => { setDb(db); await resetDb(db); });

const at = (s: string) => new Date(s);
const NOW = at('2026-09-20T12:00:00Z');
const id = (kind: string, n: number) => `${kind}0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

// A small, hand-checked month and a half of trading, as rows for both sources.
function dataset(): Dataset {
  const g1 = id('e', 1);
  const g2 = id('e', 2);
  return {
    gps: [{ id: g1, name: 'Alpha GP' }, { id: g2, name: 'Beta GP' }],
    consultations: [
      // August: one completed, paid 40.00, fee 28.00
      { id: id('c', 1), gpId: g1, status: 'completed', requestedAt: at('2026-08-10T10:00:00Z'), pricePence: 4000, gpFeePence: 2800, platformFeePence: 1200 },
      // September: two completed, one refunded in part; one no-show refunded in full; one cancelled (failed card)
      { id: id('c', 2), gpId: g1, status: 'completed', requestedAt: at('2026-09-02T10:00:00Z'), pricePence: 3200, gpFeePence: 2400, platformFeePence: 800 },
      { id: id('c', 3), gpId: g2, status: 'completed', requestedAt: at('2026-09-05T10:00:00Z'), pricePence: 4800, gpFeePence: 3300, platformFeePence: 1500 },
      { id: id('c', 4), gpId: g2, status: 'no_show', requestedAt: at('2026-09-06T10:00:00Z'), pricePence: 3600, gpFeePence: 2600, platformFeePence: 1000 },
      { id: id('c', 5), gpId: null, status: 'cancelled', requestedAt: at('2026-09-07T10:00:00Z'), pricePence: 3200, gpFeePence: 2400, platformFeePence: 800 },
      { id: id('c', 6), gpId: g1, status: 'requested', requestedAt: at('2026-09-20T11:59:00Z'), pricePence: 4000, gpFeePence: 2800, platformFeePence: 1200 },
    ],
    payments: [
      { id: id('a', 1), consultationId: id('c', 1), amountPence: 4000, status: 'succeeded', paidAt: at('2026-08-10T10:05:00Z'), createdAt: at('2026-08-10T10:00:00Z') },
      { id: id('a', 2), consultationId: id('c', 2), amountPence: 3200, status: 'succeeded', paidAt: at('2026-09-02T10:05:00Z'), createdAt: at('2026-09-02T10:00:00Z') },
      { id: id('a', 3), consultationId: id('c', 3), amountPence: 4800, status: 'succeeded', paidAt: at('2026-09-05T10:05:00Z'), createdAt: at('2026-09-05T10:00:00Z') },
      { id: id('a', 4), consultationId: id('c', 4), amountPence: 3600, status: 'succeeded', paidAt: at('2026-09-06T10:05:00Z'), createdAt: at('2026-09-06T10:00:00Z') },
      { id: id('a', 5), consultationId: id('c', 5), amountPence: 3200, status: 'failed', paidAt: null, createdAt: at('2026-09-07T10:00:00Z') },
      { id: id('a', 6), consultationId: id('c', 6), amountPence: 4000, status: 'pending', paidAt: null, createdAt: at('2026-09-20T11:59:00Z') },
    ],
    refunds: [
      { id: id('b', 1), paymentId: id('a', 3), amountPence: 2400, createdAt: at('2026-09-06T09:00:00Z') },
      { id: id('b', 2), paymentId: id('a', 4), amountPence: 3600, createdAt: at('2026-09-06T12:00:00Z') },
    ],
    payouts: [
      { id: id('d', 1), gpId: g1, periodStart: at('2026-08-10T00:00:00Z'), periodEnd: at('2026-08-17T00:00:00Z'), amountPence: 2800, status: 'paid', paidAt: at('2026-08-19T00:00:00Z') },
      { id: id('d', 2), gpId: g1, periodStart: at('2026-08-31T00:00:00Z'), periodEnd: at('2026-09-07T00:00:00Z'), amountPence: 2400, status: 'processing', paidAt: null },
      { id: id('d', 3), gpId: g2, periodStart: at('2026-08-31T00:00:00Z'), periodEnd: at('2026-09-07T00:00:00Z'), amountPence: 3300, status: 'pending', paidAt: null },
    ],
    payoutItems: [
      { payoutId: id('d', 1), consultationId: id('c', 1) },
      { payoutId: id('d', 2), consultationId: id('c', 2) },
      { payoutId: id('d', 3), consultationId: id('c', 3) },
    ],
  };
}

async function seed(data: Dataset) {
  const [p] = await db.insert(patients).values({ email: 'p@example.com' }).returning();
  await db.insert(gps).values(data.gps.map((g, i) => ({ ...g, email: `gp${i}@example.com`, gmc: `700000${i}` })));
  await db.insert(consultations).values(data.consultations.map((c) => ({ ...c, patientId: p.id })));
  await db.insert(payments).values(data.payments);
  await db.insert(refunds).values(data.refunds);
  await db.insert(payouts).values(data.payouts);
  await db.insert(payoutItems).values(data.payoutItems);
}

const SEPT = monthWindow(NOW);
const AUG = monthWindow(NOW, -1);

describe('the figures', () => {
  test('net is gross less refunds less GP fees for completed consultations; take and average follow', async () => {
    await seed(dataset());
    const s = await dbSource(db).sums(SEPT);
    // Paid in September: 32 + 48 + 36 = 116. Refunds: 24 + 36 = 60. GP fees (completed only): 24 + 33 = 57.
    expect(s).toEqual({ gmv: 11600, refunds: 6000, gpFees: 5700, paidConsults: 3, completed: 2 });
    const f = figures(s);
    expect(f.net).toBe(11600 - 6000 - 5700);
    expect(f.takeRate).toBeCloseTo(-100 / 11600);
    expect(f.avgPrice).toBe(Math.round(11600 / 3));
    expect(figures(ZERO_SUMS)).toMatchObject({ net: 0, takeRate: null, avgPrice: null });
  });

  test('months bucket by paid time, refunds by their own time', async () => {
    await seed(dataset());
    const m = await dbSource(db).monthlySums({ from: AUG.from, to: SEPT.to });
    expect(m.get('2026-08')).toEqual({ gmv: 4000, refunds: 0, gpFees: 2800, paidConsults: 1, completed: 1 });
    expect(m.get('2026-09')).toEqual({ gmv: 11600, refunds: 6000, gpFees: 5700, paidConsults: 3, completed: 2 });
    // A range boundary excludes what falls outside it.
    const aug = await dbSource(db).sums(AUG);
    expect(aug.gmv).toBe(4000);
  });

  test('the run-rate scales month-to-date by the share of the month gone', () => {
    const elapsed = monthElapsed(NOW);
    expect(elapsed).toBeCloseTo((19.5) / 30);
    const r = runRate({ gmv: 1950, refunds: 0, gpFees: 0, paidConsults: 1, completed: 1 }, NOW)!;
    expect(r.gmv).toBe(3000);
    expect(lastMonthKeys(NOW, 3)).toEqual(['2026-07', '2026-08', '2026-09']);
  });

  test('payment state reads the payment and its refunds', () => {
    expect(paymentState(null, 0, 0)).toBe('none');
    expect(paymentState('pending', 100, 0)).toBe('pending');
    expect(paymentState('succeeded', 100, 0)).toBe('paid');
    expect(paymentState('succeeded', 100, 50)).toBe('part_refunded');
    expect(paymentState('succeeded', 100, 100)).toBe('refunded');
    expect(paymentState('failed', 100, 0)).toBe('failed');
  });
});

describe('the lists', () => {
  test('consultations filter, sort and page; payment state is derived', async () => {
    await seed(dataset());
    const src = dbSource(db);
    const all = await src.consultations(parseConsultationQuery({}, SEPT));
    expect(all.total).toBe(5);
    expect(all.rows[0].id).toBe(id('c', 6)); // newest first
    const byId = Object.fromEntries(all.rows.map((r) => [r.id, r]));
    expect(byId[id('c', 3)]).toMatchObject({ payment: 'part_refunded', refundedPence: 2400, gpName: 'Beta GP' });
    expect(byId[id('c', 4)].payment).toBe('refunded');
    expect(byId[id('c', 5)]).toMatchObject({ payment: 'failed', gpName: null });
    expect(byId[id('c', 6)].payment).toBe('pending');

    const refunded = await src.consultations(parseConsultationQuery({ payment: 'refunded' }, SEPT));
    expect(refunded.rows.map((r) => r.id)).toEqual([id('c', 4)]);
    const cheap = await src.consultations(parseConsultationQuery({ sort: 'price', dir: 'asc' }, SEPT));
    expect(cheap.rows.map((r) => r.pricePence)).toEqual([3200, 3200, 3600, 4000, 4800]);
    const gp = await src.consultations(parseConsultationQuery({ gp: id('e', 2) }, SEPT));
    expect(gp.total).toBe(2);
    // A junk gp id is ignored rather than sent to Postgres.
    expect(parseConsultationQuery({ gp: "x'; drop" }, SEPT).gp).toBeUndefined();
    const paged = await src.consultations({ ...parseConsultationQuery({ page: '9' }, SEPT), pageSize: 2 });
    expect(paged).toMatchObject({ page: 3, pages: 3, total: 5 });
    expect(paged.rows).toHaveLength(1);

    const mix = await src.statusMix(SEPT);
    expect(mix).toEqual({ requested: 1, in_progress: 0, completed: 2, cancelled: 1, no_show: 1 });
  });

  test('payouts: totals, list, per-GP summary and detail', async () => {
    await seed(dataset());
    const src = dbSource(db);
    const t = await src.payoutTotals();
    expect(t).toEqual({
      pending: { pence: 3300, count: 1 }, processing: { pence: 2400, count: 1 },
      paid: { pence: 2800, count: 1 }, failed: { pence: 0, count: 0 },
    });
    const list = await src.payouts(parsePayoutQuery({ sort: 'amount', dir: 'desc' }));
    expect(list.rows.map((r) => r.amountPence)).toEqual([3300, 2800, 2400]);
    expect(list.rows[0]).toMatchObject({ gpName: 'Beta GP', consultations: 1 });
    const summary = await src.gpSummary(NOW);
    expect(summary).toEqual([
      { gpId: id('e', 2), name: 'Beta GP', earnedThisMonth: 3300, consultsThisMonth: 1, pending: 3300, paidToDate: 0 },
      { gpId: id('e', 1), name: 'Alpha GP', earnedThisMonth: 2400, consultsThisMonth: 1, pending: 2400, paidToDate: 2800 },
    ]);
    const detail = await src.payout(id('d', 3));
    expect(detail?.consultations.map((c) => c.id)).toEqual([id('c', 3)]);
    expect(await src.payout('not-a-uuid')).toBeNull();
    expect(await src.payout(id('d', 9))).toBeNull();
  });
});

describe('the database and the in-memory source agree', () => {
  const compare = async (a: FinanceSource, b: FinanceSource) => {
    const wide = { from: AUG.from, to: SEPT.to };
    expect(await a.sums(SEPT)).toEqual(await b.sums(SEPT));
    expect(Object.fromEntries(await a.monthlySums(wide))).toEqual(Object.fromEntries(await b.monthlySums(wide)));
    for (const sort of ['requested', 'price', 'gp_fee', 'platform_fee', 'status']) {
      for (const dir of ['asc', 'desc']) {
        expect(await a.consultations(parseConsultationQuery({ sort, dir }, wide)))
          .toEqual(await b.consultations(parseConsultationQuery({ sort, dir }, wide)));
      }
    }
    for (const sort of ['period', 'amount', 'paid', 'gp']) {
      expect(await a.payouts(parsePayoutQuery({ sort, dir: 'asc' }))).toEqual(await b.payouts(parsePayoutQuery({ sort, dir: 'asc' })));
    }
    expect(await a.statusMix(wide)).toEqual(await b.statusMix(wide));
    expect(await a.payoutTotals()).toEqual(await b.payoutTotals());
    expect(await a.gpSummary(NOW)).toEqual(await b.gpSummary(NOW));
    expect(await a.payout(id('d', 2))).toEqual(await b.payout(id('d', 2)));
    expect(await a.gps()).toEqual(await b.gps());
  };

  test('on the same rows, every method returns the same answer', async () => {
    const data = dataset();
    await seed(data);
    await compare(dbSource(db), memorySource(data, false));
  });

  test('an empty database answers zeros and empty lists', async () => {
    const src = dbSource(db);
    expect(await src.sums(SEPT)).toEqual(ZERO_SUMS);
    expect((await src.monthlySums(SEPT)).size).toBe(0);
    expect((await src.consultations(parseConsultationQuery({}, SEPT))).total).toBe(0);
    expect(await src.gpSummary(NOW)).toEqual([]);
    await compare(src, memorySource({ gps: [], consultations: [], payments: [], refunds: [], payouts: [], payoutItems: [] }, false));
  });
});
