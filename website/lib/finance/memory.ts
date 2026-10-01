// A FinanceSource over rows held in memory: the demo generator's dataset, and
// the tests' cross-check against the database source. The rules here must
// match the SQL in lib/admin/queries/finance.ts exactly (the tests hold them
// to it): one payment per consultation, a succeeded one preferred.
import {
  CONSULTATION_STATUSES, clampPage, emptyPayoutTotals, emptyStatusMix, monthKey, monthWindow, pagesFor, paymentState,
  ZERO_SUMS, addSums,
  type ConsultationQuery, type ConsultationRow, type ConsultationStatus, type FinanceSource, type GpSummaryRow,
  type Page, type PayoutQuery, type PayoutRow, type PayoutStatus, type Sums, type Window,
} from '@/lib/finance/model';

export type Dataset = {
  gps: Array<{ id: string; name: string }>;
  consultations: Array<{
    id: string; gpId: string | null; status: ConsultationStatus; requestedAt: Date;
    pricePence: number; gpFeePence: number; platformFeePence: number;
  }>;
  payments: Array<{
    id: string; consultationId: string; amountPence: number;
    status: 'pending' | 'succeeded' | 'failed'; paidAt: Date | null; createdAt: Date;
  }>;
  refunds: Array<{ id: string; paymentId: string; amountPence: number; createdAt: Date }>;
  payouts: Array<{
    id: string; gpId: string; periodStart: Date; periodEnd: Date; amountPence: number;
    status: PayoutStatus; paidAt: Date | null;
  }>;
  payoutItems: Array<{ payoutId: string; consultationId: string }>;
};

const inWindow = (d: Date | null, w: Window) => d !== null && d >= w.from && d < w.to;
const cmp = (a: number | string, b: number | string) => (a < b ? -1 : a > b ? 1 : 0);

export function memorySource(data: Dataset, demo = true): FinanceSource {
  const gpName = new Map(data.gps.map((g) => [g.id, g.name]));
  const consultById = new Map(data.consultations.map((c) => [c.id, c]));

  // The payment that speaks for each consultation.
  const paymentOf = new Map<string, Dataset['payments'][number]>();
  for (const p of data.payments) {
    const cur = paymentOf.get(p.consultationId);
    const rank = (x: { status: string }) => (x.status === 'succeeded' ? 1 : 0);
    if (!cur || rank(p) > rank(cur) || (rank(p) === rank(cur) && p.createdAt > cur.createdAt)) paymentOf.set(p.consultationId, p);
  }
  const refundedBy = new Map<string, number>();
  for (const r of data.refunds) refundedBy.set(r.paymentId, (refundedBy.get(r.paymentId) ?? 0) + r.amountPence);

  const itemsOf = new Map<string, string[]>();
  for (const it of data.payoutItems) {
    const list = itemsOf.get(it.payoutId) ?? [];
    list.push(it.consultationId);
    itemsOf.set(it.payoutId, list);
  }

  const succeeded = data.payments.filter((p) => p.status === 'succeeded' && p.paidAt);

  function sumsIn(w: Window, gpId?: string): Sums {
    let s = { ...ZERO_SUMS };
    const seen = new Set<string>();
    for (const p of succeeded) {
      if (!inWindow(p.paidAt, w)) continue;
      const c = consultById.get(p.consultationId);
      if (!c || (gpId && c.gpId !== gpId)) continue;
      s.gmv += p.amountPence;
      const first = !seen.has(c.id);
      seen.add(c.id);
      if (c.status === 'completed') s.gpFees += c.gpFeePence;
      if (first) {
        s.paidConsults += 1;
        if (c.status === 'completed') s.completed += 1;
      }
    }
    if (!gpId) for (const r of data.refunds) if (inWindow(r.createdAt, w)) s = { ...s, refunds: s.refunds + r.amountPence };
    return s;
  }

  function row(c: Dataset['consultations'][number]): ConsultationRow {
    const p = paymentOf.get(c.id);
    const refunded = p ? refundedBy.get(p.id) ?? 0 : 0;
    return {
      id: c.id, requestedAt: c.requestedAt, status: c.status, gpId: c.gpId, gpName: c.gpId ? gpName.get(c.gpId) ?? null : null,
      pricePence: c.pricePence, gpFeePence: c.gpFeePence, platformFeePence: c.platformFeePence,
      payment: paymentState(p?.status ?? null, p?.amountPence ?? 0, refunded), refundedPence: refunded,
    };
  }

  function payoutRow(p: Dataset['payouts'][number]): PayoutRow {
    return { ...p, gpName: gpName.get(p.gpId) ?? 'Unknown GP', consultations: itemsOf.get(p.id)?.length ?? 0 };
  }

  function paginate<T>(rows: T[], page: number, pageSize: number): Page<T> {
    const p = clampPage(page, rows.length, pageSize);
    return { rows: rows.slice((p - 1) * pageSize, p * pageSize), total: rows.length, page: p, pages: pagesFor(rows.length, pageSize) };
  }

  return {
    demo,
    async sums(w) { return sumsIn(w); },

    async monthlySums(w) {
      const out = new Map<string, Sums>();
      const bump = (k: string, add: Partial<Sums>) => out.set(k, addSums(out.get(k) ?? ZERO_SUMS, { ...ZERO_SUMS, ...add }));
      const seen = new Set<string>();
      for (const p of succeeded) {
        if (!inWindow(p.paidAt, w)) continue;
        const c = consultById.get(p.consultationId);
        if (!c) continue;
        const first = !seen.has(c.id);
        seen.add(c.id);
        const done = c.status === 'completed';
        bump(monthKey(p.paidAt!), {
          gmv: p.amountPence, gpFees: done ? c.gpFeePence : 0,
          paidConsults: first ? 1 : 0, completed: first && done ? 1 : 0,
        });
      }
      for (const r of data.refunds) if (inWindow(r.createdAt, w)) bump(monthKey(r.createdAt), { refunds: r.amountPence });
      return out;
    },

    async consultations(q: ConsultationQuery) {
      const rows = data.consultations
        .filter((c) => inWindow(c.requestedAt, q) && (!q.status || c.status === q.status) && (!q.gp || c.gpId === q.gp))
        .map(row)
        .filter((r) => !q.payment || r.payment === q.payment);
      const key = (r: ConsultationRow): number | string => {
        switch (q.sort) {
          case 'price': return r.pricePence;
          case 'gp_fee': return r.gpFeePence;
          case 'platform_fee': return r.platformFeePence;
          case 'status': return r.status;
          default: return r.requestedAt.getTime();
        }
      };
      const sign = q.dir === 'asc' ? 1 : -1;
      rows.sort((a, b) => sign * cmp(key(a), key(b))
        || -cmp(a.requestedAt.getTime(), b.requestedAt.getTime()) || cmp(a.id, b.id));
      return paginate(rows, q.page, q.pageSize);
    },

    async statusMix(w) {
      const mix = emptyStatusMix();
      for (const c of data.consultations) if (inWindow(c.requestedAt, w) && CONSULTATION_STATUSES.includes(c.status)) mix[c.status] += 1;
      return mix;
    },

    async gps() {
      return [...data.gps].sort((a, b) => cmp(a.name, b.name));
    },

    async payoutTotals() {
      const t = emptyPayoutTotals();
      for (const p of data.payouts) { t[p.status].pence += p.amountPence; t[p.status].count += 1; }
      return t;
    },

    async payouts(q: PayoutQuery) {
      const rows = data.payouts
        .filter((p) => (!q.status || p.status === q.status) && (!q.gp || p.gpId === q.gp))
        .map(payoutRow);
      const key = (r: PayoutRow): number | string => {
        switch (q.sort) {
          case 'amount': return r.amountPence;
          case 'paid': return r.paidAt ? r.paidAt.getTime() : 0;
          case 'gp': return r.gpName;
          default: return r.periodEnd.getTime();
        }
      };
      const sign = q.dir === 'asc' ? 1 : -1;
      rows.sort((a, b) => sign * cmp(key(a), key(b)) || -cmp(a.periodEnd.getTime(), b.periodEnd.getTime()) || cmp(a.id, b.id));
      return paginate(rows, q.page, q.pageSize);
    },

    async gpSummary(now) {
      const month = monthWindow(now);
      const served = new Map<string, number>();
      for (const c of data.consultations) {
        if (c.gpId && c.status === 'completed') served.set(c.gpId, (served.get(c.gpId) ?? 0) + 1);
      }
      const rows: GpSummaryRow[] = data.gps.map((g) => {
        const s = sumsIn(month, g.id);
        let pending = 0;
        let paidToDate = 0;
        for (const p of data.payouts) {
          if (p.gpId !== g.id) continue;
          if (p.status === 'pending' || p.status === 'processing') pending += p.amountPence;
          if (p.status === 'paid') paidToDate += p.amountPence;
        }
        return {
          gpId: g.id, name: g.name, earnedThisMonth: s.gpFees, consultsThisMonth: s.completed, pending, paidToDate,
          servedToDate: served.get(g.id) ?? 0,
        };
      });
      return rows.sort((a, b) => b.earnedThisMonth - a.earnedThisMonth || cmp(a.name, b.name));
    },

    async payout(id) {
      const p = data.payouts.find((x) => x.id === id);
      if (!p) return null;
      const consultations = (itemsOf.get(p.id) ?? [])
        .map((cid) => consultById.get(cid))
        .filter((c): c is NonNullable<typeof c> => Boolean(c))
        .map(row)
        .sort((a, b) => cmp(a.requestedAt.getTime(), b.requestedAt.getTime()) || cmp(a.id, b.id));
      return { payout: payoutRow(p), consultations };
    },
  };
}
