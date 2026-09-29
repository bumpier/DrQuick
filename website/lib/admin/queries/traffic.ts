// The Traffic page. Server-only.
//
// Definitions (stated on the page too):
//   Visitors   the Overview's definition, reused (lib/admin/queries/overview.ts):
//              distinct consented visitors with a session in the range, plus
//              each cookieless page view.
//   Visits     consented sessions started in the range, plus each cookieless
//              page view (a cookieless view carries no id, so it is its own visit).
//   Page views every pageview event in the range except `after_consent` re-counts.
//   Bounce     a consented session with at most one page view and under 10s of
//              engaged time, as a share of consented sessions. Cookieless views
//              carry no engagement, so they are not in this rate.
//   Engaged    average engaged seconds per consented session.
// The source, device and browser tables count visits; the entry and exit
// tables count consented sessions only (a cookieless view has no session).
import { sql } from 'drizzle-orm';
import type { DB } from '@/lib/db';
import { rowsOf } from '@/lib/rate-limit';
import { bucketKeys, type Range, type Span } from '@/lib/admin/range';
import { visitorCount, visitorsPerBucket, type Series } from '@/lib/admin/queries/overview';
import { COOKIELESS, COUNTED_VIEW, hostText, inSpan, n } from '@/lib/admin/queries/analytics-sql';

export const BOUNCE_SECONDS = 10;
const TOP = 15;

export type TrafficKpis = {
  visitors: number;
  visits: number;
  pageviews: number;
  sessions: number;           // consented only
  bounceRate: number | null;  // of consented sessions
  avgEngaged: number | null;  // seconds per consented session
  identifiedShare: number | null; // of counted page views
};

export async function trafficKpis(db: DB, s: Span): Promise<TrafficKpis> {
  const [row] = rowsOf<{ sessions: number; bounces: number; engaged: number | null; pageviews: number; cookieless: number }>(await db.execute(sql`
    select
      (select count(*) from sessions where ${inSpan('started_at', s)})::int as sessions,
      (select count(*) from sessions where ${inSpan('started_at', s)}
        and pageviews <= 1 and engaged_seconds < ${BOUNCE_SECONDS})::int as bounces,
      (select avg(engaged_seconds) from sessions where ${inSpan('started_at', s)})::float as engaged,
      (select count(*) from events where type = 'pageview' and ${inSpan('ts', s)} and ${COUNTED_VIEW})::int as pageviews,
      (select count(*) from events where type = 'pageview' and ${inSpan('ts', s)} and ${COOKIELESS})::int as cookieless`));
  const sessions = n(row?.sessions);
  const pageviews = n(row?.pageviews);
  const cookieless = n(row?.cookieless);
  return {
    visitors: await visitorCount(db, s),
    visits: sessions + cookieless,
    pageviews,
    sessions,
    bounceRate: sessions > 0 ? n(row?.bounces) / sessions : null,
    avgEngaged: sessions > 0 && row?.engaged !== null ? n(row?.engaged) : null,
    identifiedShare: pageviews > 0 ? (pageviews - cookieless) / pageviews : null,
  };
}

export async function pageviewsPerBucket(db: DB, range: Range): Promise<Series> {
  const keys = bucketKeys(range);
  const fmt = range.bucket === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM';
  const rows = rowsOf<{ k: string; c: number }>(await db.execute(sql`
    select to_char(ts at time zone 'UTC', ${fmt}) as k, count(*)::int as c
    from events where type = 'pageview' and ${inSpan('ts', range)} and ${COUNTED_VIEW}
    group by 1`));
  const byKey = new Map(rows.map((r) => [r.k, n(r.c)]));
  return { keys, values: { pageviews: keys.map((k) => byKey.get(k) ?? 0) } };
}

export type PageRow = { path: string; views: number; visitors: number; avgEngaged: number | null };

// Views and visitors per page; average engaged time per consented view (the
// only views that report engagement).
export async function topPages(db: DB, s: Span, limit = 20): Promise<PageRow[]> {
  const rows = rowsOf<{ path: string; views: number; visitors: number; tracked: number; secs: number | null }>(await db.execute(sql`
    with v as (
      select path,
        count(*) filter (where ${COUNTED_VIEW})::int as views,
        (count(distinct visitor_id) filter (where visitor_id is not null and ${COUNTED_VIEW})
          + count(*) filter (where ${COOKIELESS}))::int as visitors,
        count(*) filter (where visitor_id is not null)::int as tracked
      from events where type = 'pageview' and ${inSpan('ts', s)}
      group by path
    ), e as (
      select path, sum(case when jsonb_typeof(props->'seconds') = 'number' then (props->>'seconds')::numeric else 0 end)::float as secs
      from events where type = 'engaged_time' and ${inSpan('ts', s)}
      group by path
    )
    select v.path, v.views, v.visitors, v.tracked, e.secs
    from v left join e on e.path = v.path
    where v.views > 0
    order by v.views desc, v.path asc
    limit ${limit}`));
  return rows.map((r) => ({
    path: r.path,
    views: n(r.views),
    visitors: n(r.visitors),
    avgEngaged: n(r.tracked) > 0 ? n(r.secs) / n(r.tracked) : null,
  }));
}

export type CountRow = { key: string; value: number };

// Visits by one dimension: the consented session's column, and the same fact
// from each cookieless page view's props.
async function visitsBy(db: DB, s: Span, sessionExpr: string, propExpr: string, limit = TOP): Promise<CountRow[]> {
  const rows = rowsOf<{ k: string | null; c: number }>(await db.execute(sql`
    select k, count(*)::int as c from (
      select ${sql.raw(sessionExpr)} as k from sessions where ${inSpan('started_at', s)}
      union all
      select ${sql.raw(propExpr)} as k from events where type = 'pageview' and ${COOKIELESS} and ${inSpan('ts', s)}
    ) t group by k order by c desc, k asc nulls first limit ${limit}`));
  return rows.map((r) => ({ key: r.k ?? '', value: n(r.c) }));
}

// Referring sites by host; no referrer is "Direct".
export async function referrers(db: DB, s: Span): Promise<CountRow[]> {
  const rows = await visitsBy(db, s, hostText('referrer'), hostText(`props->>'ref'`));
  return rows.map((r) => ({ key: r.key || 'Direct', value: r.value }));
}

export const devices = (db: DB, s: Span) => visitsBy(db, s, 'device', `props->>'device'`)
  .then((rows) => rows.map((r) => ({ key: r.key || 'Unknown', value: r.value })));
export const browsers = (db: DB, s: Span) => visitsBy(db, s, 'browser', `props->>'browser'`)
  .then((rows) => rows.map((r) => ({ key: r.key || 'Unknown', value: r.value })));
export const systems = (db: DB, s: Span) => visitsBy(db, s, 'os', `props->>'os'`)
  .then((rows) => rows.map((r) => ({ key: r.key || 'Unknown', value: r.value })));

export type UtmRow = { source: string; medium: string | null; campaign: string | null; visits: number };

// Campaign-tagged visits. Cookieless views keep only the source.
export async function campaigns(db: DB, s: Span): Promise<UtmRow[]> {
  const rows = rowsOf<{ source: string; medium: string | null; campaign: string | null; c: number }>(await db.execute(sql`
    select source, medium, campaign, count(*)::int as c from (
      select utm_source as source, utm_medium as medium, utm_campaign as campaign
        from sessions where ${inSpan('started_at', s)} and utm_source is not null
      union all
      select props->>'utm_source', null, null
        from events where type = 'pageview' and ${COOKIELESS} and ${inSpan('ts', s)} and props->>'utm_source' is not null
    ) t group by 1, 2, 3 order by c desc, source asc limit ${TOP}`));
  return rows.map((r) => ({ source: r.source, medium: r.medium, campaign: r.campaign, visits: n(r.c) }));
}

export type EntryRow = { path: string; sessions: number; bounceRate: number };

export async function entryPages(db: DB, s: Span): Promise<EntryRow[]> {
  const rows = rowsOf<{ path: string; c: number; b: number }>(await db.execute(sql`
    select entry_path as path, count(*)::int as c,
      count(*) filter (where pageviews <= 1 and engaged_seconds < ${BOUNCE_SECONDS})::int as b
    from sessions where ${inSpan('started_at', s)}
    group by 1 order by c desc, path asc limit ${TOP}`));
  return rows.map((r) => ({ path: r.path, sessions: n(r.c), bounceRate: n(r.c) > 0 ? n(r.b) / n(r.c) : 0 }));
}

export async function exitPages(db: DB, s: Span): Promise<CountRow[]> {
  const rows = rowsOf<{ path: string; c: number }>(await db.execute(sql`
    select exit_path as path, count(*)::int as c from sessions where ${inSpan('started_at', s)}
    group by 1 order by c desc, path asc limit ${TOP}`));
  return rows.map((r) => ({ key: r.path, value: n(r.c) }));
}

export async function traffic(db: DB, range: Range) {
  const [kpis, prev, visitorSeries, pageviewSeries, pages, refs, utm, dev, br, os, entries, exits] = await Promise.all([
    trafficKpis(db, range),
    trafficKpis(db, range.prev),
    visitorsPerBucket(db, range),
    pageviewsPerBucket(db, range),
    topPages(db, range),
    referrers(db, range),
    campaigns(db, range),
    devices(db, range),
    browsers(db, range),
    systems(db, range),
    entryPages(db, range),
    exitPages(db, range),
  ]);
  return { kpis, prev, visitorSeries, pageviewSeries, pages, refs, utm, devices: dev, browsers: br, systems: os, entries, exits };
}

