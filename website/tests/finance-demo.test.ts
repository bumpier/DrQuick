import { describe, expect, test } from 'vitest';
import { DEMO_GPS, demoDataset, demoSource, prng } from '@/lib/finance/demo';
import { COMMISSION_TIERS, gpSharePercent, splitPrice, tierFor } from '@/lib/finance/commission';
import { figures, lastMonthKeys, monthWindow } from '@/lib/finance/model';
import { BASE_PRICE, PRICE_CAP } from '@/lib/pricing';

const NOW = new Date('2026-09-20T12:00:00Z');

describe('the demo generator', () => {
  test('is deterministic: the same seed and time give the same data', () => {
    expect(demoDataset(NOW)).toEqual(demoDataset(NOW));
    expect(demoDataset(NOW, 1)).not.toEqual(demoDataset(NOW, 2));
    const r = prng(42);
    const s = prng(42);
    expect([r(), r(), r()]).toEqual([s(), s(), s()]);
  });

  test('a day, once past, never changes as time moves on', () => {
    const earlier = demoDataset(NOW);
    const later = demoDataset(new Date('2026-09-25T12:00:00Z'));
    const before = (d: { requestedAt: Date }) => d.requestedAt < new Date('2026-09-19T00:00:00Z');
    expect(later.consultations.filter(before)).toEqual(earlier.consultations.filter(before));
  });

  // One assertion over collected faults rather than six per row: there are
  // thousands of rows, and a per-row expect ran this test close to its timeout.
  test('stays within the pricing rule and the past, and every price is split to the penny', () => {
    const d = demoDataset(NOW);
    expect(d.gps).toHaveLength(DEMO_GPS);
    expect(d.consultations.length).toBeGreaterThan(5000);
    const faults: string[] = [];
    for (const c of d.consultations) {
      if (c.pricePence < BASE_PRICE * 100 || c.pricePence > PRICE_CAP * 100) faults.push(`${c.id}: price ${c.pricePence}`);
      if (c.platformFeePence !== c.pricePence - c.gpFeePence) faults.push(`${c.id}: the split does not add up`);
      if (c.requestedAt.getTime() > NOW.getTime()) faults.push(`${c.id}: requested in the future`);
    }
    for (const r of d.refunds) if (r.createdAt.getTime() > NOW.getTime()) faults.push(`${r.id}: refunded in the future`);
    for (const p of d.payments) if (p.paidAt && p.paidAt.getTime() > NOW.getTime()) faults.push(`${p.id}: paid in the future`);
    expect(faults).toEqual([]);
  });

  // The commission rule (lib/finance/commission.ts): a GP keeps 60% of a
  // consultation until they have completed 100, then 70%, then 75% from 500.
  test('each GP is paid by the commission tier they held going into the consultation', () => {
    const d = demoDataset(NOW);
    const served = new Map<string, number>();
    const shares = new Set<number>();
    const faults: string[] = [];
    for (const c of d.consultations) {
      // A request still queued or cancelled has no GP in the data; its fee was
      // still set by a tier, checked against all three below.
      if (!c.gpId) {
        if (!COMMISSION_TIERS.some((t) => splitPrice(c.pricePence, t.from).gpFeePence === c.gpFeePence)) faults.push(`${c.id}: fee on no tier`);
        continue;
      }
      const before = served.get(c.gpId) ?? 0;
      if (splitPrice(c.pricePence, before).gpFeePence !== c.gpFeePence) faults.push(`${c.id}: not the tier held after ${before}`);
      shares.add(gpSharePercent(tierFor(before)));
      if (c.status === 'completed') served.set(c.gpId, before + 1);
    }
    expect(faults).toEqual([]);
    // A year of demo trading takes the busiest GPs through all three tiers.
    expect([...shares].sort()).toEqual([60, 70, 75]);
    expect(Math.max(...served.values())).toBeGreaterThan(500);
  });

  test('is internally consistent: net = gross − refunds − fees, month by month and in total', async () => {
    const src = demoSource(NOW);
    const year = { from: monthWindow(NOW, -11).from, to: monthWindow(NOW).to };
    const months = await src.monthlySums(year);
    expect([...months.keys()].sort()).toEqual(lastMonthKeys(NOW, 12));
    let gmv = 0; let refunds = 0; let fees = 0; let net = 0;
    for (const s of months.values()) {
      const f = figures(s);
      expect(f.net).toBe(s.gmv - s.refunds - s.gpFees);
      gmv += s.gmv; refunds += s.refunds; fees += s.gpFees; net += f.net;
    }
    const total = figures(await src.sums(year));
    expect(total).toMatchObject({ gmv, refunds, gpFees: fees, net });
    // About 3% refunded, and a platform take that is positive but modest.
    expect(refunds / gmv).toBeGreaterThan(0.015);
    expect(refunds / gmv).toBeLessThan(0.05);
    expect(total.takeRate!).toBeGreaterThan(0.1);
    expect(total.takeRate!).toBeLessThan(0.35);
    // Demand ramps: the last full month is well above the first.
    const keys = lastMonthKeys(NOW, 12);
    expect(months.get(keys[10])!.paidConsults).toBeGreaterThan(months.get(keys[0])!.paidConsults * 5);
  });

  test('each payout is the fees of its consultations, and together they cover every completed, paid consultation', () => {
    const d = demoDataset(NOW);
    const byId = new Map(d.consultations.map((c) => [c.id, c]));
    const items = new Map<string, string[]>();
    for (const it of d.payoutItems) items.set(it.payoutId, [...(items.get(it.payoutId) ?? []), it.consultationId]);
    for (const p of d.payouts) {
      const list = items.get(p.id) ?? [];
      expect(list.length).toBeGreaterThan(0);
      expect(p.amountPence).toBe(list.reduce((s, id) => s + byId.get(id)!.gpFeePence, 0));
      for (const id of list) expect(byId.get(id)!.gpId).toBe(p.gpId);
      if (p.status === 'paid') expect(p.paidAt!.getTime()).toBeLessThanOrEqual(NOW.getTime());
      if (p.status === 'pending') expect(p.periodEnd.getTime()).toBeGreaterThan(NOW.getTime());
    }
    const paidConsults = new Set(d.payments.filter((p) => p.status === 'succeeded').map((p) => p.consultationId));
    const owed = d.consultations.filter((c) => c.status === 'completed' && paidConsults.has(c.id));
    expect(new Set(d.payoutItems.map((i) => i.consultationId))).toEqual(new Set(owed.map((c) => c.id)));
    const totalPayouts = d.payouts.reduce((s, p) => s + p.amountPence, 0);
    expect(totalPayouts).toBe(owed.reduce((s, c) => s + c.gpFeePence, 0));
  });

  test('the demo source reports itself as demo and pages like the real one', async () => {
    const src = demoSource(NOW);
    expect(src.demo).toBe(true);
    const t = await src.payoutTotals();
    expect(t.paid.count).toBeGreaterThan(0);
    expect(t.pending.count).toBeGreaterThan(0);
    const [first] = (await src.payouts({ sort: 'period', dir: 'desc', page: 1, pageSize: 5 })).rows;
    const detail = await src.payout(first.id);
    expect(detail!.consultations).toHaveLength(first.consultations);
  });
});
