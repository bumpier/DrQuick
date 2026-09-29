// The Visitors list and the Live view. Server-only.
//
// Visitors are the people who accepted analytics cookies (the visitors
// table); a visitor is "signed up" when a waitlist sign-up carries their id.
// Search is by that sign-up's email, so it only finds people who signed up.
import { sql, type SQL } from 'drizzle-orm';
import type { DB } from '@/lib/db';
import { rowsOf } from '@/lib/rate-limit';
import { param, type Params } from '@/lib/admin/range';
import { LIVE_WINDOW_MS } from '@/lib/admin/queries/overview';
import { COOKIELESS, iso, n } from '@/lib/admin/queries/analytics-sql';

export const VISITOR_SORTS = ['last', 'first', 'sessions', 'pageviews', 'engaged'] as const;
export type VisitorSort = (typeof VISITOR_SORTS)[number];
export const VISITOR_PAGE_SIZE = 25;

export type VisitorQuery = {
  q: string;
  signed: 'yes' | 'no' | null;
  sort: VisitorSort;
  dir: 'asc' | 'desc';
  page: number;
  pageSize: number;
};

export function parseVisitorQuery(params: Params): VisitorQuery {
  const sort = param(params, 'sort') as VisitorSort | undefined;
  const signed = param(params, 'signed');
  const page = Number.parseInt(param(params, 'page') ?? '1', 10);
  return {
    q: (param(params, 'q') ?? '').trim().slice(0, 100),
    signed: signed === 'yes' || signed === 'no' ? signed : null,
    sort: sort && VISITOR_SORTS.includes(sort) ? sort : 'last',
    dir: param(params, 'dir') === 'asc' ? 'asc' : 'desc',
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 10_000) : 1,
    pageSize: VISITOR_PAGE_SIZE,
  };
}

const SORT_SQL: Record<VisitorSort, string> = {
  last: 'v.last_seen',
  first: 'v.first_seen',
  sessions: 'v.sessions',
  pageviews: 'v.pageviews',
  engaged: 'v.engaged_seconds',
};

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export type VisitorRow = {
  id: string;
  firstSeen: Date;
  lastSeen: Date;
  sessions: number;
  pageviews: number;
  engagedSeconds: number;
  firstReferrer: string | null;
  firstUtmSource: string | null;
  device: string | null;
  signup: { id: string; email: string; role: 'patient' | 'gp' } | null;
};

type RawVisitor = {
  id: string; first_seen: string | Date; last_seen: string | Date; sessions: number; pageviews: number;
  engaged_seconds: number; first_referrer: string | null; first_utm_source: string | null; device: string | null;
  signup_id: string | null; email: string | null; role: 'patient' | 'gp' | null; total: number;
};

export async function listVisitors(db: DB, q: VisitorQuery): Promise<{ rows: VisitorRow[]; total: number; page: number; pages: number }> {
  const where: SQL[] = [sql`true`];
  if (q.q) where.push(sql`exists (select 1 from waitlist_signups ws where ws.visitor_id = v.id and ws.email ilike ${`%${likeEscape(q.q)}%`})`);
  if (q.signed === 'yes') where.push(sql`exists (select 1 from waitlist_signups ws where ws.visitor_id = v.id)`);
  if (q.signed === 'no') where.push(sql`not exists (select 1 from waitlist_signups ws where ws.visitor_id = v.id)`);
  const filter = sql.join(where, sql` and `);

  const [{ c }] = rowsOf<{ c: number }>(await db.execute(sql`select count(*)::int as c from visitors v where ${filter}`));
  const total = n(c);
  const pages = Math.max(1, Math.ceil(total / q.pageSize));
  const page = Math.min(q.page, pages);
  const rows = rowsOf<RawVisitor>(await db.execute(sql`
    select v.id, v.first_seen, v.last_seen, v.sessions, v.pageviews, v.engaged_seconds,
      v.first_referrer, v.first_utm_source, v.device, w.id as signup_id, w.email, w.role
    from visitors v
    left join lateral (
      select id, email, role from waitlist_signups ws where ws.visitor_id = v.id order by created_at asc limit 1
    ) w on true
    where ${filter}
    order by ${sql.raw(SORT_SQL[q.sort])} ${sql.raw(q.dir)}, v.id asc
    limit ${q.pageSize} offset ${(page - 1) * q.pageSize}`));
  return {
    total, page, pages,
    rows: rows.map((r) => ({
      id: r.id,
      firstSeen: new Date(r.first_seen),
      lastSeen: new Date(r.last_seen),
      sessions: n(r.sessions),
      pageviews: n(r.pageviews),
      engagedSeconds: n(r.engaged_seconds),
      firstReferrer: r.first_referrer,
      firstUtmSource: r.first_utm_source,
      device: r.device,
      signup: r.signup_id && r.email && r.role ? { id: r.signup_id, email: r.email, role: r.role } : null,
    })),
  };
}

// Every sign-up linked to a visitor (someone may have joined as both).
export async function signupsForVisitor(db: DB, visitorId: string) {
  return rowsOf<{ id: string; email: string; role: 'patient' | 'gp'; created_at: string | Date }>(await db.execute(sql`
    select id, email, role, created_at from waitlist_signups where visitor_id = ${visitorId} order by created_at asc`))
    .map((r) => ({ id: r.id, email: r.email, role: r.role, createdAt: new Date(r.created_at) }));
}

export type LiveSession = {
  id: string;
  visitorId: string | null;
  currentPath: string;
  entryPath: string;
  device: string;
  referrer: string | null;
  utmSource: string | null;
  pageviews: number;
  startedAt: Date;
  lastSeen: Date;
};

// Sessions active in the last five minutes (last_seen in the window), newest
// activity first, and the cookieless page views in the same window.
export async function liveNow(db: DB, now = new Date(), limit = 100): Promise<{ sessions: LiveSession[]; total: number; cookieless: number }> {
  const since = iso(new Date(now.getTime() - LIVE_WINDOW_MS));
  const until = iso(new Date(now.getTime() + 60_000));
  const rows = rowsOf<{
    id: string; visitor_id: string | null; current_path: string; entry_path: string; device: string;
    referrer: string | null; utm_source: string | null; pageviews: number;
    started_at: string | Date; last_seen: string | Date; total: number;
  }>(await db.execute(sql`
    select id, visitor_id, current_path, entry_path, device, referrer, utm_source, pageviews, started_at, last_seen,
      count(*) over ()::int as total
    from sessions where last_seen >= ${since} and last_seen < ${until}
    order by last_seen desc limit ${limit}`));
  const [cl] = rowsOf<{ c: number }>(await db.execute(sql`
    select count(*)::int as c from events
    where type = 'pageview' and ${COOKIELESS} and ts >= ${since} and ts < ${until}`));
  return {
    total: n(rows[0]?.total),
    cookieless: n(cl?.c),
    sessions: rows.map((r) => ({
      id: r.id, visitorId: r.visitor_id, currentPath: r.current_path, entryPath: r.entry_path, device: r.device,
      referrer: r.referrer, utmSource: r.utm_source, pageviews: n(r.pageviews),
      startedAt: new Date(r.started_at), lastSeen: new Date(r.last_seen),
    })),
  };
}
