// The Overview page's numbers. Server-only; every function takes the database
// and a range from lib/admin/range.ts and treats it as [from, to).
//
// "Visitors" is defined once, here: the distinct people who accepted analytics
// cookies and had a session in the range (a session with no visitor id counts
// once on its own), PLUS every cookieless page view in the range. Cookieless
// views carry no identifier by design, so each one is counted as one visit —
// the figure is an upper bound for those, and exact for everyone else.
import { desc, eq, sql } from 'drizzle-orm';
import type { DB } from '@/lib/db';
import { waitlistSignups } from '@/lib/db/schema';
import { rowsOf } from '@/lib/rate-limit';
import { bucketKeys, type Range, type Span } from '@/lib/admin/range';

const iso = (d: Date) => d.toISOString();
const n = (v: unknown) => Number(v ?? 0);

function bucketSql(range: Range, column: string) {
  const fmt = range.bucket === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM';
  return sql.raw(`to_char(${column} at time zone 'UTC', '${fmt}')`);
}

export async function signupCounts(db: DB, s: Span): Promise<{ patients: number; gps: number }> {
  const rows = rowsOf<{ role: string; c: number }>(await db.execute(sql`
    select role, count(*)::int as c from waitlist_signups
    where created_at >= ${iso(s.from)} and created_at < ${iso(s.to)}
    group by role`));
  const by = Object.fromEntries(rows.map((r) => [r.role, n(r.c)]));
  return { patients: by.patient ?? 0, gps: by.gp ?? 0 };
}

export async function visitorCount(db: DB, s: Span): Promise<number> {
  const [row] = rowsOf<{ people: number; cookieless: number }>(await db.execute(sql`
    select
      (select count(distinct coalesce(visitor_id::text, id::text)) from sessions
        where started_at >= ${iso(s.from)} and started_at < ${iso(s.to)})::int as people,
      (select count(*) from events
        where type = 'pageview' and visitor_id is null and session_id is null
          and ts >= ${iso(s.from)} and ts < ${iso(s.to)})::int as cookieless`));
  return n(row?.people) + n(row?.cookieless);
}

export type Series = { keys: string[]; values: Record<string, number[]> };

export async function signupsPerBucket(db: DB, range: Range): Promise<Series> {
  const keys = bucketKeys(range);
  const rows = rowsOf<{ k: string; role: string; c: number }>(await db.execute(sql`
    select ${bucketSql(range, 'created_at')} as k, role, count(*)::int as c from waitlist_signups
    where created_at >= ${iso(range.from)} and created_at < ${iso(range.to)}
    group by 1, 2`));
  const index = new Map(keys.map((k, i) => [k, i]));
  const patients = keys.map(() => 0);
  const gps = keys.map(() => 0);
  for (const r of rows) {
    const i = index.get(r.k);
    if (i === undefined) continue;
    (r.role === 'gp' ? gps : patients)[i] += n(r.c);
  }
  return { keys, values: { patients, gps } };
}

export async function visitorsPerBucket(db: DB, range: Range): Promise<Series> {
  const keys = bucketKeys(range);
  const rows = rowsOf<{ k: string; c: number }>(await db.execute(sql`
    select k, sum(c)::int as c from (
      select ${bucketSql(range, 'started_at')} as k, count(distinct coalesce(visitor_id::text, id::text)) as c
        from sessions where started_at >= ${iso(range.from)} and started_at < ${iso(range.to)} group by 1
      union all
      select ${bucketSql(range, 'ts')} as k, count(*) as c
        from events where type = 'pageview' and visitor_id is null and session_id is null
          and ts >= ${iso(range.from)} and ts < ${iso(range.to)} group by 1
    ) t group by k`));
  const byKey = new Map(rows.map((r) => [r.k, n(r.c)]));
  return { keys, values: { visitors: keys.map((k) => byKey.get(k) ?? 0) } };
}

export async function latestGpApplications(db: DB, limit = 5) {
  return db.select({
    id: waitlistSignups.id, name: waitlistSignups.name, gmc: waitlistSignups.gmc,
    status: waitlistSignups.status, createdAt: waitlistSignups.createdAt,
  }).from(waitlistSignups).where(eq(waitlistSignups.role, 'gp'))
    .orderBy(desc(waitlistSignups.createdAt)).limit(limit);
}

// Referring sites for sessions in the range, by host. Sessions with no
// referrer (typed in, bookmarks, most apps) are not listed.
export async function topReferrers(db: DB, s: Span, limit = 6): Promise<Array<{ host: string; sessions: number }>> {
  const rows = rowsOf<{ host: string; c: number }>(await db.execute(sql`
    select host, count(*)::int as c from (
      select lower(regexp_replace(substring(referrer from '^(?:[a-zA-Z]+://)?([^/:?#]+)'), '^www\\.', '')) as host
      from sessions
      where referrer is not null and started_at >= ${iso(s.from)} and started_at < ${iso(s.to)}
    ) t where host is not null and host <> ''
    group by host order by c desc, host asc limit ${limit}`));
  return rows.map((r) => ({ host: r.host, sessions: n(r.c) }));
}

export const LIVE_WINDOW_MS = 5 * 60_000;

export async function liveSessions(db: DB, now = new Date(), limit = 10) {
  const since = new Date(now.getTime() - LIVE_WINDOW_MS);
  const rows = rowsOf<{ id: string; current_path: string; device: string; last_seen: string | Date; started_at: string | Date; total: number }>(
    await db.execute(sql`
      select id, current_path, device, last_seen, started_at, count(*) over ()::int as total
      from sessions where last_seen >= ${iso(since)}
      order by last_seen desc limit ${limit}`));
  return {
    total: n(rows[0]?.total),
    sessions: rows.map((r) => ({
      id: r.id, path: r.current_path, device: r.device,
      lastSeen: new Date(r.last_seen), startedAt: new Date(r.started_at),
    })),
  };
}

export function monthSpan(now: Date, offset = 0): Span {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 1));
  return { from, to, fromDay: from.toISOString().slice(0, 10), toDay: new Date(to.getTime() - 86_400_000).toISOString().slice(0, 10) };
}

// Net revenue in pence: succeeded payments paid in the span, less refunds
// made in it.
export async function netRevenue(db: DB, s: Span): Promise<number> {
  const [row] = rowsOf<{ paid: number; refunded: number }>(await db.execute(sql`
    select
      (select coalesce(sum(amount_pence), 0) from payments
        where status = 'succeeded' and paid_at >= ${iso(s.from)} and paid_at < ${iso(s.to)})::bigint as paid,
      (select coalesce(sum(amount_pence), 0) from refunds
        where created_at >= ${iso(s.from)} and created_at < ${iso(s.to)})::bigint as refunded`));
  return n(row?.paid) - n(row?.refunded);
}

export async function pendingPayouts(db: DB): Promise<{ pence: number; count: number }> {
  const [row] = rowsOf<{ pence: number; c: number }>(await db.execute(sql`
    select coalesce(sum(amount_pence), 0)::bigint as pence, count(*)::int as c from payouts where status = 'pending'`));
  return { pence: n(row?.pence), count: n(row?.c) };
}

export async function overview(db: DB, range: Range, now = new Date()) {
  const [signups, prevSignups, visitors, prevVisitors, signupSeries, visitorSeries, latestGps, referrers, live, revenue, prevRevenue, payouts] =
    await Promise.all([
      signupCounts(db, range),
      signupCounts(db, range.prev),
      visitorCount(db, range),
      visitorCount(db, range.prev),
      signupsPerBucket(db, range),
      visitorsPerBucket(db, range),
      latestGpApplications(db),
      topReferrers(db, range),
      liveSessions(db, now),
      netRevenue(db, monthSpan(now)),
      netRevenue(db, monthSpan(now, -1)),
      pendingPayouts(db),
    ]);
  const conversion = (s: { patients: number; gps: number }, v: number) => (v > 0 ? (s.patients + s.gps) / v : null);
  return {
    signups, prevSignups, visitors, prevVisitors,
    conversion: conversion(signups, visitors),
    prevConversion: conversion(prevSignups, prevVisitors),
    signupSeries, visitorSeries, latestGps, referrers, live,
    revenue, prevRevenue, payouts,
  };
}

