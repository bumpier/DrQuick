// The finance pages' data. Server-only. `dbSource` is the FinanceSource over
// Postgres; `financeSource` picks it or the demo generator from the URL
// (?demo=1). The definitions of every figure live in lib/finance/model.ts, and
// the in-memory source (lib/finance/memory.ts) must agree with this SQL row for
// row — tests/finance-queries.test.ts runs both over the same data.
import { sql, type SQL } from 'drizzle-orm';
import type { DB } from '@/lib/db';
import { rowsOf } from '@/lib/rate-limit';
import { param, type Params } from '@/lib/admin/range';
import { demoSource } from '@/lib/finance/demo';
import {
  CONSULTATION_SORTS, CONSULTATION_STATUSES, PAYMENT_STATES, PAYOUT_SORTS, PAYOUT_STATUSES,
  ZERO_SUMS, addSums, clampPage, emptyPayoutTotals, emptyStatusMix, figures, lastMonthKeys, monthWindow, pagesFor,
  type ConsultationQuery, type ConsultationRow, type ConsultationSort, type ConsultationStatus, type Figures, type FinanceSource,
  type PaymentState, type PayoutQuery, type PayoutRow, type PayoutSort, type PayoutStatus, type Sums, type Window,
} from '@/lib/finance/model';

const iso = (d: Date) => d.toISOString();
const n = (v: unknown) => Number(v ?? 0);
const date = (v: unknown) => new Date(v as string | Date);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ------------------------------------------------------------ reading */

export const isDemo = (params: Params) => param(params, 'demo') === '1';

export function financeSource(db: DB, params: Params, now = new Date()): FinanceSource {
  return isDemo(params) ? demoSource(now) : dbSource(db);
}

export const PAGE_SIZE = 25;

const pageOf = (params: Params) => Math.max(1, Math.floor(Number(param(params, 'page')) || 1));
const pick = <T extends string>(list: readonly T[], v: string | undefined): T | undefined =>
  list.includes(v as T) ? (v as T) : undefined;

export function parseConsultationQuery(params: Params, w: Window): ConsultationQuery {
  const gp = param(params, 'gp');
  return {
    from: w.from,
    to: w.to,
    status: pick(CONSULTATION_STATUSES, param(params, 'status')),
    payment: pick(PAYMENT_STATES, param(params, 'payment')),
    gp: gp && UUID.test(gp) ? gp.toLowerCase() : undefined,
    sort: pick(CONSULTATION_SORTS, param(params, 'sort')) ?? 'requested',
    dir: param(params, 'dir') === 'asc' ? 'asc' : 'desc',
    page: pageOf(params),
    pageSize: PAGE_SIZE,
  };
}

export function parsePayoutQuery(params: Params): PayoutQuery {
  const gp = param(params, 'gp');
  return {
    status: pick(PAYOUT_STATUSES, param(params, 'status')),
    gp: gp && UUID.test(gp) ? gp.toLowerCase() : undefined,
    sort: pick(PAYOUT_SORTS, param(params, 'sort')) ?? 'period',
    dir: param(params, 'dir') === 'asc' ? 'asc' : 'desc',
    page: pageOf(params),
    pageSize: PAGE_SIZE,
  };
}

/* ------------------------------------------------------------ the SQL */

const CONSULTATION_ORDER: Record<ConsultationSort, string> = {
  requested: 'requested_at',
  price: 'price_pence',
  gp_fee: 'gp_fee_pence',
  platform_fee: 'platform_fee_pence',
  status: 'status collate "C"',
};

const PAYOUT_ORDER: Record<PayoutSort, string> = {
  period: 'p.period_end',
  amount: 'p.amount_pence',
  paid: "coalesce(p.paid_at, 'epoch'::timestamptz)",
  gp: "coalesce(g.name, 'Unknown GP') collate \"C\"",
};

// One row per consultation, with the payment that speaks for it (a succeeded
// one first, else the latest) and what has been refunded against that payment.
function consultationRowsSql(where: SQL, paymentFilter: SQL) {
  return sql`
    with base as (
      select c.id, c.requested_at, c.status, c.gp_id, g.name as gp_name,
        c.price_pence, c.gp_fee_pence, c.platform_fee_pence,
        p.status as pay_status, coalesce(p.amount_pence, 0) as pay_amount, coalesce(r.refunded, 0)::bigint as refunded
      from consultations c
      left join gps g on g.id = c.gp_id
      left join lateral (
        select id, status, amount_pence from payments where consultation_id = c.id
        order by (status = 'succeeded') desc, created_at desc limit 1
      ) p on true
      left join lateral (select sum(amount_pence) as refunded from refunds where payment_id = p.id) r on true
      where ${where}
    )
    select * from (
      select *, case
        when pay_status is null then 'none'
        when pay_status = 'succeeded' then case
          when refunded >= pay_amount and pay_amount > 0 then 'refunded'
          when refunded > 0 then 'part_refunded'
          else 'paid' end
        when pay_status = 'failed' then 'failed'
        else 'pending' end as payment
      from base
    ) t where ${paymentFilter}`;
}

type RawConsultation = {
  id: string; requested_at: string | Date; status: ConsultationStatus; gp_id: string | null; gp_name: string | null;
  price_pence: number; gp_fee_pence: number; platform_fee_pence: number; payment: PaymentState; refunded: number;
};

const toConsultation = (r: RawConsultation): ConsultationRow => ({
  id: r.id, requestedAt: date(r.requested_at), status: r.status, gpId: r.gp_id, gpName: r.gp_name,
  pricePence: n(r.price_pence), gpFeePence: n(r.gp_fee_pence), platformFeePence: n(r.platform_fee_pence),
  payment: r.payment, refundedPence: n(r.refunded),
});

type RawPayout = {
  id: string; gp_id: string; gp_name: string; period_start: string | Date; period_end: string | Date;
  amount_pence: number; status: PayoutStatus; paid_at: string | Date | null; items: number;
};

const toPayout = (r: RawPayout): PayoutRow => ({
  id: r.id, gpId: r.gp_id, gpName: r.gp_name, periodStart: date(r.period_start), periodEnd: date(r.period_end),
  amountPence: n(r.amount_pence), status: r.status, paidAt: r.paid_at ? date(r.paid_at) : null, consultations: n(r.items),
});

const PAYOUT_SELECT = sql`
  select p.id, p.gp_id, coalesce(g.name, 'Unknown GP') as gp_name, p.period_start, p.period_end, p.amount_pence,
    p.status, p.paid_at, (select count(*) from payout_items i where i.payout_id = p.id)::int as items
  from payouts p left join gps g on g.id = p.gp_id`;

function sumsSql(w: Window, gpId?: string) {
  const gp = gpId ? sql`and c.gp_id = ${gpId}` : sql``;
  return sql`
    select coalesce(sum(p.amount_pence), 0)::bigint as gmv,
      coalesce(sum(c.gp_fee_pence) filter (where c.status = 'completed'), 0)::bigint as gp_fees,
      count(distinct c.id)::int as paid_consults,
      count(distinct c.id) filter (where c.status = 'completed')::int as completed
    from payments p join consultations c on c.id = p.consultation_id
    where p.status = 'succeeded' and p.paid_at >= ${iso(w.from)} and p.paid_at < ${iso(w.to)} ${gp}`;
}

export function dbSource(db: DB): FinanceSource {
  return {
    demo: false,

    async sums(w) {
      const [s] = rowsOf<Record<string, number>>(await db.execute(sumsSql(w)));
      const [r] = rowsOf<{ refunds: number }>(await db.execute(sql`
        select coalesce(sum(amount_pence), 0)::bigint as refunds from refunds
        where created_at >= ${iso(w.from)} and created_at < ${iso(w.to)}`));
      return {
        gmv: n(s?.gmv), refunds: n(r?.refunds), gpFees: n(s?.gp_fees),
        paidConsults: n(s?.paid_consults), completed: n(s?.completed),
      };
    },

    async monthlySums(w) {
      const rows = rowsOf<{ k: string; gmv: number; gp_fees: number; paid_consults: number; completed: number; refunds: number }>(
        await db.execute(sql`
          with paid as (
            select to_char(p.paid_at at time zone 'UTC', 'YYYY-MM') as k,
              sum(p.amount_pence) as gmv,
              coalesce(sum(c.gp_fee_pence) filter (where c.status = 'completed'), 0) as gp_fees,
              count(distinct c.id) as paid_consults,
              count(distinct c.id) filter (where c.status = 'completed') as completed
            from payments p join consultations c on c.id = p.consultation_id
            where p.status = 'succeeded' and p.paid_at >= ${iso(w.from)} and p.paid_at < ${iso(w.to)}
            group by 1
          ), back as (
            select to_char(created_at at time zone 'UTC', 'YYYY-MM') as k, sum(amount_pence) as refunds
            from refunds where created_at >= ${iso(w.from)} and created_at < ${iso(w.to)} group by 1
          )
          select coalesce(paid.k, back.k) as k,
            coalesce(paid.gmv, 0)::bigint as gmv, coalesce(paid.gp_fees, 0)::bigint as gp_fees,
            coalesce(paid.paid_consults, 0)::int as paid_consults, coalesce(paid.completed, 0)::int as completed,
            coalesce(back.refunds, 0)::bigint as refunds
          from paid full join back on back.k = paid.k`));
      return new Map<string, Sums>(rows.map((r) => [r.k, {
        gmv: n(r.gmv), refunds: n(r.refunds), gpFees: n(r.gp_fees), paidConsults: n(r.paid_consults), completed: n(r.completed),
      }]));
    },

    async consultations(q: ConsultationQuery) {
      const conds: SQL[] = [sql`c.requested_at >= ${iso(q.from)}`, sql`c.requested_at < ${iso(q.to)}`];
      if (q.status) conds.push(sql`c.status = ${q.status}`);
      if (q.gp) conds.push(sql`c.gp_id = ${q.gp}`);
      const where = sql.join(conds, sql` and `);
      const paymentFilter = q.payment ? sql`payment = ${q.payment}` : sql`true`;
      const [{ total } = { total: 0 }] = rowsOf<{ total: number }>(await db.execute(
        sql`select count(*)::int as total from (${consultationRowsSql(where, paymentFilter)}) x`));
      const page = clampPage(q.page, n(total), q.pageSize);
      const order = sql.raw(`${CONSULTATION_ORDER[q.sort]} ${q.dir === 'asc' ? 'asc' : 'desc'}, requested_at desc, id asc`);
      const rows = rowsOf<RawConsultation>(await db.execute(sql`
        ${consultationRowsSql(where, paymentFilter)} order by ${order}
        limit ${q.pageSize} offset ${(page - 1) * q.pageSize}`));
      return { rows: rows.map(toConsultation), total: n(total), page, pages: pagesFor(n(total), q.pageSize) };
    },

    async statusMix(w) {
      const mix = emptyStatusMix();
      const rows = rowsOf<{ status: ConsultationStatus; c: number }>(await db.execute(sql`
        select status, count(*)::int as c from consultations
        where requested_at >= ${iso(w.from)} and requested_at < ${iso(w.to)} group by status`));
      for (const r of rows) if (r.status in mix) mix[r.status] = n(r.c);
      return mix;
    },

    async gps() {
      return rowsOf<{ id: string; name: string }>(await db.execute(sql`select id, name from gps order by name collate "C"`));
    },

    async payoutTotals() {
      const t = emptyPayoutTotals();
      const rows = rowsOf<{ status: PayoutStatus; pence: number; c: number }>(await db.execute(sql`
        select status, coalesce(sum(amount_pence), 0)::bigint as pence, count(*)::int as c from payouts group by status`));
      for (const r of rows) if (r.status in t) t[r.status] = { pence: n(r.pence), count: n(r.c) };
      return t;
    },

    async payouts(q: PayoutQuery) {
      const conds: SQL[] = [sql`true`];
      if (q.status) conds.push(sql`p.status = ${q.status}`);
      if (q.gp) conds.push(sql`p.gp_id = ${q.gp}`);
      const where = sql.join(conds, sql` and `);
      const [{ total } = { total: 0 }] = rowsOf<{ total: number }>(await db.execute(
        sql`select count(*)::int as total from payouts p where ${where}`));
      const page = clampPage(q.page, n(total), q.pageSize);
      const order = sql.raw(`${PAYOUT_ORDER[q.sort]} ${q.dir === 'asc' ? 'asc' : 'desc'}, p.period_end desc, p.id asc`);
      const rows = rowsOf<RawPayout>(await db.execute(sql`
        ${PAYOUT_SELECT} where ${where} order by ${order} limit ${q.pageSize} offset ${(page - 1) * q.pageSize}`));
      return { rows: rows.map(toPayout), total: n(total), page, pages: pagesFor(n(total), q.pageSize) };
    },

    async gpSummary(now) {
      const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      const rows = rowsOf<{ id: string; name: string; earned: number; consults: number; pending: number; paid: number; served: number }>(
        await db.execute(sql`
          select g.id, g.name, coalesce(e.fees, 0)::bigint as earned, coalesce(e.n, 0)::int as consults,
            coalesce(q.pending, 0)::bigint as pending, coalesce(q.paid, 0)::bigint as paid,
            coalesce(s.served, 0)::int as served
          from gps g
          left join (
            select gp_id, count(*) as served from consultations where status = 'completed' group by gp_id
          ) s on s.gp_id = g.id
          left join (
            select c.gp_id, sum(c.gp_fee_pence) as fees, count(distinct c.id) as n
            from payments p join consultations c on c.id = p.consultation_id
            where p.status = 'succeeded' and c.status = 'completed'
              and p.paid_at >= ${iso(from)} and p.paid_at < ${iso(to)}
            group by c.gp_id
          ) e on e.gp_id = g.id
          left join (
            select gp_id,
              sum(amount_pence) filter (where status in ('pending', 'processing')) as pending,
              sum(amount_pence) filter (where status = 'paid') as paid
            from payouts group by gp_id
          ) q on q.gp_id = g.id
          order by earned desc, g.name collate "C" asc`));
      return rows.map((r) => ({
        gpId: r.id, name: r.name, earnedThisMonth: n(r.earned), consultsThisMonth: n(r.consults),
        pending: n(r.pending), paidToDate: n(r.paid), servedToDate: n(r.served),
      }));
    },

    async payout(id) {
      if (!UUID.test(id)) return null;
      const [p] = rowsOf<RawPayout>(await db.execute(sql`${PAYOUT_SELECT} where p.id = ${id}`));
      if (!p) return null;
      const rows = rowsOf<RawConsultation>(await db.execute(sql`
        ${consultationRowsSql(sql`c.id in (select consultation_id from payout_items where payout_id = ${id})`, sql`true`)}
        order by requested_at asc, id asc`));
      return { payout: toPayout(p), consultations: rows.map(toConsultation) };
    },
  };
}

/* --------------------------------------------------- for the Overview */

// Money taken in the window, less refunds made in it — the Overview's
// "Revenue this month". Not net revenue: GP fees are still to come out.
export async function collectedRevenue(source: FinanceSource, w: Window): Promise<number> {
  const s = await source.sums(w);
  return s.gmv - s.refunds;
}

// Payouts owed but not yet sent (status pending).
export async function pendingPayouts(source: FinanceSource): Promise<{ pence: number; count: number }> {
  return (await source.payoutTotals()).pending;
}

/* ------------------------------------------------ the monthly ledger */

export type LedgerRow = { key: string; figures: Figures; toDate: boolean };

// The last twelve calendar months (newest first), their total, and the
// calendar year to date. Shared by the Revenue page and its CSV.
export async function revenueLedger(source: FinanceSource, now: Date) {
  const keys = lastMonthKeys(now, 12);
  const window = { from: monthWindow(now, -11).from, to: monthWindow(now).to };
  const sums = await source.monthlySums(window);
  const at = (k: string) => sums.get(k) ?? ZERO_SUMS;
  const thisMonth = keys[keys.length - 1];
  const rows: LedgerRow[] = [...keys].reverse().map((k) => ({ key: k, figures: figures(at(k)), toDate: k === thisMonth }));
  const total = figures(keys.reduce((s, k) => addSums(s, at(k)), ZERO_SUMS));
  const year = String(now.getUTCFullYear());
  const ytd = figures(keys.filter((k) => k.startsWith(`${year}-`)).reduce((s, k) => addSums(s, at(k)), ZERO_SUMS));
  const empty = keys.every((k) => at(k).gmv === 0 && at(k).refunds === 0);
  return { rows, total, ytd, year, empty };
}
