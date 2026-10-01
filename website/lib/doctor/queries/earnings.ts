// What a doctor has earned, and where that money is. Server-only, read-only.
//
// The definitions are the admin's (lib/finance/model.ts), so a doctor and the
// team never see two different figures for the same thing: a fee is earned by
// a COMPLETED consultation whose payment SUCCEEDED, and it belongs to the month
// the patient paid in (UTC). A no-show, a cancelled consultation and one not
// yet paid for earn nothing. tests/doctor-earnings.test.ts holds this file to
// the admin's gpSummary over the same rows.
//
// Every earned penny is in exactly one of three places: paid to the doctor, in
// a payout that is on its way, or awaiting a payout. A payout that failed puts
// its fees back to awaiting.
//
// The lists are the admin's own queries (dbSource), filtered to one doctor,
// rather than a second copy of that SQL.
import { sql } from 'drizzle-orm';
import { dbSource } from '@/lib/admin/queries/finance';
import type { DB } from '@/lib/db';
import { monthWindow, type ConsultationRow, type Page, type PayoutRow } from '@/lib/finance/model';
import { rowsOf } from '@/lib/rate-limit';

export type EarningsSummary = {
  earnedAllTime: number;
  earnedThisMonth: number;
  consultsThisMonth: number;
  awaitingPayout: number;   // earned, in no payout yet (or only in one that failed)
  inPayout: number;         // payouts pending or processing
  paidToDate: number;       // payouts paid
  completed: number;        // completed consultations, ever: what the commission tier is counted on
};

export const PAGE_SIZE = 25;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const iso = (d: Date) => d.toISOString();
const n = (v: unknown) => Number(v ?? 0);

export async function earningsSummary(db: DB, gpId: string, now = new Date()): Promise<EarningsSummary> {
  const month = monthWindow(now);
  const [e] = rowsOf<{ all_time: number; this_month: number; consults: number; awaiting: number }>(await db.execute(sql`
    with earned as (
      select c.id, c.gp_fee_pence, p.paid_at
      from consultations c
      join lateral (
        select paid_at from payments where consultation_id = c.id and status = 'succeeded' order by paid_at desc limit 1
      ) p on true
      where c.gp_id = ${gpId} and c.status = 'completed'
    )
    select
      coalesce(sum(e.gp_fee_pence), 0)::bigint as all_time,
      coalesce(sum(e.gp_fee_pence) filter (
        where e.paid_at >= ${iso(month.from)}::timestamptz and e.paid_at < ${iso(month.to)}::timestamptz), 0)::bigint as this_month,
      (count(*) filter (
        where e.paid_at >= ${iso(month.from)}::timestamptz and e.paid_at < ${iso(month.to)}::timestamptz))::int as consults,
      coalesce(sum(e.gp_fee_pence) filter (where not exists (
        select 1 from payout_items i join payouts q on q.id = i.payout_id
        where i.consultation_id = e.id and q.status <> 'failed')), 0)::bigint as awaiting
    from earned e`));

  const [p] = rowsOf<{ in_payout: number; paid: number }>(await db.execute(sql`
    select
      coalesce(sum(amount_pence) filter (where status in ('pending', 'processing')), 0)::bigint as in_payout,
      coalesce(sum(amount_pence) filter (where status = 'paid'), 0)::bigint as paid
    from payouts where gp_id = ${gpId}`));

  const [c] = rowsOf<{ completed: number }>(await db.execute(
    sql`select count(*)::int as completed from consultations where gp_id = ${gpId} and status = 'completed'`));

  return {
    earnedAllTime: n(e?.all_time), earnedThisMonth: n(e?.this_month), consultsThisMonth: n(e?.consults),
    awaitingPayout: n(e?.awaiting), inPayout: n(p?.in_payout), paidToDate: n(p?.paid), completed: n(c?.completed),
  };
}

// Midnight in London on the day `now` falls on. A doctor's "today" is theirs,
// not UTC's. On the two days a year the clocks change it is an hour out, which
// a dashboard tile can live with.
function londonDayStart(now: Date): Date {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const intoDay = part('hour') * 3600 + part('minute') * 60 + part('second');
  return new Date(Math.floor(now.getTime() / 1000) * 1000 - intoDay * 1000);
}

/** Consultations completed since midnight in London, and what they have earned so far. */
export async function todaysWork(db: DB, gpId: string, now = new Date()): Promise<{ consultations: number; earnedPence: number }> {
  const [t] = rowsOf<{ done: number; earned: number }>(await db.execute(sql`
    select count(*)::int as done,
      coalesce(sum(c.gp_fee_pence) filter (where exists (
        select 1 from payments p where p.consultation_id = c.id and p.status = 'succeeded')), 0)::bigint as earned
    from consultations c
    where c.gp_id = ${gpId} and c.status = 'completed' and c.ended_at >= ${iso(londonDayStart(now))}::timestamptz`));
  return { consultations: n(t?.done), earnedPence: n(t?.earned) };
}

// What a row in a list shows as the doctor's fee. A consultation keeps the fee
// it was accepted at even when it ends as a no-show or is cancelled, and those
// earn nothing, so showing the figure would read as money owed.
export const feeFor = (row: Pick<ConsultationRow, 'status' | 'gpFeePence'>): number | null =>
  (row.status === 'no_show' || row.status === 'cancelled' ? null : row.gpFeePence);

const EVER = { from: new Date(0), to: new Date('9999-01-01T00:00:00Z') };

/** Every consultation the doctor has taken, newest first. */
export function myConsultations(db: DB, gpId: string, page: number): Promise<Page<ConsultationRow>> {
  return dbSource(db).consultations({ ...EVER, gp: gpId, sort: 'requested', dir: 'desc', page, pageSize: PAGE_SIZE });
}

/** The doctor's payouts, newest period first. */
export function myPayouts(db: DB, gpId: string, page: number): Promise<Page<PayoutRow>> {
  return dbSource(db).payouts({ gp: gpId, sort: 'period', dir: 'desc', page, pageSize: PAGE_SIZE });
}

/** One payout and the consultations in it, or null when it is not this doctor's. */
export async function myPayout(db: DB, gpId: string, id: string): Promise<{ payout: PayoutRow; consultations: ConsultationRow[] } | null> {
  if (!UUID.test(id)) return null;
  const found = await dbSource(db).payout(id);
  return found && found.payout.gpId === gpId ? found : null;
}
