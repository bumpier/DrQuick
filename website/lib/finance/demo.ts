// "Preview with demo data": a deterministic, in-memory year of trading for the
// finance pages, so the admin can be judged before a single payment exists.
// Nothing here is ever written to the database, and every screen that shows
// it carries a DemoBadge. These are invented numbers, not a forecast.
//
// The shape: launch at the start of the month eleven months before `now`,
// demand ramping from a handful of consultations a day to about seventy, the
// price from lib/pricing's placeholder rule (base plus a step per queue place,
// capped), a GP fee in PRODUCT.md's 24–33 pound band, about 3% of money
// refunded, 25 GPs joining over the year and paid weekly.
//
// Each day draws from its own seeded generator, so a day's consultations never
// change as `now` moves on; only today's live tail and the payout statuses do.
import { BASE_PRICE, PRICE_CAP, PRICE_STEP } from '@/lib/pricing';
import { memorySource, type Dataset } from '@/lib/finance/memory';
import { monthWindow, type ConsultationStatus, type FinanceSource, type PayoutStatus } from '@/lib/finance/model';

export const DEMO_SEED = 20260904;
export const DEMO_GPS = 25;

const DAY = 86_400_000;
const MIN = 60_000;

// mulberry32: small, fast and the same on every machine.
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mix = (...parts: number[]) => parts.reduce((h, p) => Math.imul(h ^ (p >>> 0), 2654435761) >>> 0, 2166136261);

// Ids shaped like uuids (the payout detail route expects one), prefixed by kind.
const uid = (kind: string, n: number) => `${kind}0000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;

const round50 = (pence: number) => Math.round(pence / 50) * 50;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function queuePrice(r: number): number {
  const position = r < 0.45 ? 1 : r < 0.7 ? 2 : r < 0.85 ? 3 : r < 0.93 ? 4 : r < 0.97 ? 5 : 6;
  return Math.min(PRICE_CAP, BASE_PRICE + PRICE_STEP * (position - 1)) * 100;
}

// Monday 00:00 UTC of the week holding `d`.
function weekStart(d: Date): Date {
  const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const dow = (new Date(day).getUTCDay() + 6) % 7;
  return new Date(day - dow * DAY);
}

export function demoDataset(now = new Date(), seed = DEMO_SEED): Dataset {
  const launch = monthWindow(now, -11).from;
  const gps = Array.from({ length: DEMO_GPS }, (_, i) => ({ id: uid('e', i + 1), name: `Demo GP ${String(i + 1).padStart(2, '0')}` }));
  const data: Dataset = { gps, consultations: [], payments: [], refunds: [], payouts: [], payoutItems: [] };

  let nc = 0;
  let np = 0;
  let nr = 0;
  const days = Math.floor((now.getTime() - launch.getTime()) / DAY);
  for (let d = 0; d <= days; d += 1) {
    const rng = prng(mix(seed, d));
    const dayStart = launch.getTime() + d * DAY;
    const t = Math.min(1, d / 335);
    const weekend = [0, 6].includes(new Date(dayStart).getUTCDay()) ? 1.15 : 1;
    const count = Math.round((4 + 66 * t ** 1.6) * weekend * (0.85 + 0.3 * rng()));
    const available = Math.min(DEMO_GPS, 3 + Math.floor(d / 15));

    for (let i = 0; i < count; i += 1) {
      // Every draw happens whether or not the consultation is kept, so the
      // sequence for a day never depends on the time of day it is read.
      const requestedAt = new Date(dayStart + (7 * 60 + rng() * 16 * 60) * MIN);
      const price = queuePrice(rng());
      const gpFee = clamp(round50(2400 + (price - 3200) * 0.55 + rng() * 300), 2400, 3300);
      const gpId = gps[Math.floor(rng() * available)].id;
      const outcome = rng();
      const startedAt = new Date(requestedAt.getTime() + (1 + rng() * 6) * MIN);
      const endedAt = new Date(startedAt.getTime() + (8 + rng() * 9) * MIN);
      const refundDraw = rng();
      const refundDelay = (0.5 + rng() * 71.5) * 3_600_000;
      const partial = rng() < 0.5;
      if (requestedAt > now) continue;

      nc += 1;
      const id = uid('c', nc);
      let status: ConsultationStatus = outcome < 0.035 ? 'cancelled' : outcome < 0.045 ? 'no_show' : 'completed';
      if (status === 'completed' && startedAt > now) status = 'requested';
      else if (status === 'completed' && endedAt > now) status = 'in_progress';
      data.consultations.push({
        id, gpId: status === 'requested' || status === 'cancelled' ? null : gpId, status, requestedAt,
        pricePence: price, gpFeePence: gpFee, platformFeePence: price - gpFee,
      });

      // Cancelled: the hold is released (no payment) or the card was declined.
      if (status === 'cancelled') {
        if (refundDraw < 0.4) {
          np += 1;
          data.payments.push({ id: uid('a', np), consultationId: id, amountPence: price, status: 'failed', paidAt: null, createdAt: requestedAt });
        }
        continue;
      }
      // Captured at the match; a request still in the queue is only held.
      const captured = status !== 'requested';
      np += 1;
      const payment = {
        id: uid('a', np), consultationId: id, amountPence: price,
        status: captured ? 'succeeded' as const : 'pending' as const,
        paidAt: captured ? startedAt : null, createdAt: requestedAt,
      };
      data.payments.push(payment);

      // No-shows are refunded in full; about 2% of completed calls in part or in full.
      const refund = status === 'no_show' ? price : status === 'completed' && refundDraw < 0.02 ? (partial ? round50(price / 2) : price) : 0;
      const refundAt = new Date(startedAt.getTime() + refundDelay);
      if (refund > 0 && refundAt <= now) {
        nr += 1;
        data.refunds.push({ id: uid('b', nr), paymentId: payment.id, amountPence: refund, createdAt: refundAt });
      }
    }
  }

  // Weekly payouts, Monday to Monday: each GP is paid the fees for the
  // completed consultations paid for in that week, on the Wednesday after.
  const consultById = new Map(data.consultations.map((c) => [c.id, c]));
  const weeks = new Map<number, Map<string, string[]>>();
  for (const p of data.payments) {
    if (p.status !== 'succeeded' || !p.paidAt) continue;
    const c = consultById.get(p.consultationId)!;
    if (c.status !== 'completed' || !c.gpId) continue;
    const w = weekStart(p.paidAt).getTime();
    const byGp = weeks.get(w) ?? new Map<string, string[]>();
    byGp.set(c.gpId, [...(byGp.get(c.gpId) ?? []), c.id]);
    weeks.set(w, byGp);
  }
  let nq = 0;
  for (const w of [...weeks.keys()].sort((a, b) => a - b)) {
    const byGp = weeks.get(w)!;
    for (const gp of gps) {
      const items = byGp.get(gp.id);
      if (!items) continue;
      nq += 1;
      const periodStart = new Date(w);
      const periodEnd = new Date(w + 7 * DAY);
      const due = new Date(periodEnd.getTime() + 2 * DAY);
      const failed = prng(mix(seed, w / DAY, nq))() < 0.01;
      const status: PayoutStatus = periodEnd > now ? 'pending' : due > now ? 'processing' : failed ? 'failed' : 'paid';
      const id = uid('d', nq);
      data.payouts.push({
        id, gpId: gp.id, periodStart, periodEnd, status,
        amountPence: items.reduce((s, cid) => s + consultById.get(cid)!.gpFeePence, 0),
        paidAt: status === 'paid' ? due : null,
      });
      for (const cid of items) data.payoutItems.push({ payoutId: id, consultationId: cid });
    }
  }
  return data;
}

export function demoSource(now = new Date(), seed = DEMO_SEED): FinanceSource {
  return memorySource(demoDataset(now, seed), true);
}
