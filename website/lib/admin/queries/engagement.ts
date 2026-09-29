// The Engagement page: how far people read one page. Server-only.
//
// The unit is the consented page view (a pageview event with a visitor id and
// a `pv`), because only consented views report scrolling, sections and time.
// `after_consent` views are included here: they are the consented half of a
// page first counted as cookieless, and they carry that page's engagement.
// On '/', a role ('patient' | 'gp', from the pageview's props.role) narrows
// the set to one mode of the landing page.
//
//   Scroll reach     share of views whose deepest point (scroll max, scroll
//                    milestone or engaged_time max_scroll) reached 25/50/75/90/100%.
//   Read-through     per section, share of views with at least 500ms summed
//                    dwell on it (repeat section_view rows for one view are
//                    summed), in the page's reading order; drop-off is the
//                    share lost since the section before. Avg dwell is over
//                    the views that read it.
//   Time on page     summed engaged_time seconds per view, bucketed.
import { sql, type SQL } from 'drizzle-orm';
import type { DB } from '@/lib/db';
import { rowsOf } from '@/lib/rate-limit';
import type { Span } from '@/lib/admin/range';
import { sectionsFor, type Mode } from '@/lib/admin/analytics-labels';
import { inSpan, n, numProp, spanPlusDay } from '@/lib/admin/queries/analytics-sql';

export const SCROLL_MILESTONES = [25, 50, 75, 90, 100] as const;
export const TIME_BUCKETS = [
  { label: 'Under 10s', max: 10 },
  { label: '10–30s', max: 30 },
  { label: '30–60s', max: 60 },
  { label: '1–3 min', max: 180 },
  { label: '3 min+', max: Infinity },
] as const;
export const MIN_DWELL_MS = 500;

export type EngagementFilter = { path: string; role: Mode | null };

// The page views in scope, as a CTE body.
function viewsCte(f: EngagementFilter, s: Span): SQL {
  const role = f.role ? sql`and props->>'role' = ${f.role}` : sql``;
  return sql`select distinct props->>'pv' as pv from events
    where type = 'pageview' and path = ${f.path} and visitor_id is not null and props->>'pv' is not null
      and ${inSpan('ts', s)} ${role}`;
}

// Events of the in-scope views, of the given types, as a WHERE fragment on alias e.
function eventsOf(types: string[], f: EngagementFilter, s: Span): SQL {
  const late = spanPlusDay(s);
  return sql`e.path = ${f.path} and e.type in (${sql.join(types.map((t) => sql`${t}`), sql`, `)})
    and e.ts >= ${s.from.toISOString()} and e.ts < ${late.to.toISOString()}
    and e.props->>'pv' in (select pv from views)`;
}

export type ScrollReach = { total: number; reach: Array<{ depth: number; views: number; share: number }> };

export async function scrollReach(db: DB, f: EngagementFilter, s: Span): Promise<ScrollReach> {
  const [row] = rowsOf<Record<string, number>>(await db.execute(sql`
    with views as (${viewsCte(f, s)}),
    deepest as (
      select e.props->>'pv' as pv,
        max(greatest(${numProp('max', 'e')}, ${numProp('depth', 'e')}, ${numProp('max_scroll', 'e')})) as d
      from events e where ${eventsOf(['scroll', 'engaged_time'], f, s)}
      group by 1
    )
    select (select count(*) from views)::int as total,
      ${sql.join(SCROLL_MILESTONES.map((m) => sql`(select count(*) from deepest where d >= ${m})::int as ${sql.raw(`r${m}`)}`), sql`, `)}`));
  const total = n(row?.total);
  return {
    total,
    reach: SCROLL_MILESTONES.map((depth) => {
      const views = n(row?.[`r${depth}`]);
      return { depth, views, share: total > 0 ? views / total : 0 };
    }),
  };
}

export type SectionRow = {
  section: string;
  views: number;          // views that read it (≥500ms summed dwell)
  share: number;          // of all views in scope
  dropOff: number | null; // share lost since the section before; null for the first
  avgDwellMs: number | null;
};

export async function sectionReadThrough(db: DB, f: EngagementFilter, s: Span, order?: readonly string[]): Promise<{ total: number; sections: SectionRow[] }> {
  const rows = rowsOf<{ section: string; c: number; avg_ms: number | null; total: number }>(await db.execute(sql`
    with views as (${viewsCte(f, s)}),
    per_view as (
      select e.props->>'pv' as pv, e.props->>'section' as section, sum(${numProp('dwell_ms', 'e')}) as ms
      from events e where ${eventsOf(['section_view'], f, s)} and e.props->>'section' is not null
      group by 1, 2
      having sum(${numProp('dwell_ms', 'e')}) >= ${MIN_DWELL_MS}
    )
    select section, count(*)::int as c, avg(ms)::float as avg_ms, (select count(*) from views)::int as total
    from per_view group by section`));
  const total = n(rows[0]?.total) || (await viewCount(db, f, s));
  const bySection = new Map(rows.map((r) => [r.section, r]));
  // A known reading order when there is one; otherwise the sections seen, most read first.
  const names = order ?? rows.slice().sort((a, b) => n(b.c) - n(a.c) || a.section.localeCompare(b.section)).map((r) => r.section);
  const out: SectionRow[] = [];
  names.forEach((section, i) => {
    const r = bySection.get(section);
    const views = n(r?.c);
    const share = total > 0 ? views / total : 0;
    const prev = i === 0 ? null : out[i - 1].share;
    out.push({
      section,
      views,
      share,
      dropOff: prev === null ? null : prev > 0 ? Math.max(0, (prev - share) / prev) : 0,
      avgDwellMs: r?.avg_ms === null || r?.avg_ms === undefined ? null : n(r.avg_ms),
    });
  });
  return { total, sections: out };
}

async function viewCount(db: DB, f: EngagementFilter, s: Span): Promise<number> {
  const [row] = rowsOf<{ c: number }>(await db.execute(sql`with views as (${viewsCte(f, s)}) select count(*)::int as c from views`));
  return n(row?.c);
}

export type TimeOnPage = { total: number; avgSeconds: number | null; bins: Array<{ label: string; views: number }> };

export async function timeOnPage(db: DB, f: EngagementFilter, s: Span): Promise<TimeOnPage> {
  const rows = rowsOf<{ secs: number }>(await db.execute(sql`
    with views as (${viewsCte(f, s)}),
    t as (
      select e.props->>'pv' as pv, sum(${numProp('seconds', 'e')}) as secs
      from events e where ${eventsOf(['engaged_time'], f, s)}
      group by 1
    )
    select coalesce(t.secs, 0)::float as secs from views left join t on t.pv = views.pv`));
  const secs = rows.map((r) => n(r.secs));
  const bins = TIME_BUCKETS.map((b) => ({ label: b.label, views: 0 }));
  for (const v of secs) bins[TIME_BUCKETS.findIndex((b) => v < b.max)].views += 1;
  return { total: secs.length, avgSeconds: secs.length ? secs.reduce((a, b) => a + b, 0) / secs.length : null, bins };
}

// Pages with consented views in the range, most viewed first: the page picker.
export async function engagedPages(db: DB, s: Span, limit = 30): Promise<Array<{ path: string; views: number }>> {
  const rows = rowsOf<{ path: string; c: number }>(await db.execute(sql`
    select path, count(*)::int as c from events
    where type = 'pageview' and visitor_id is not null and ${inSpan('ts', s)}
    group by path order by c desc, path asc limit ${limit}`));
  return rows.map((r) => ({ path: r.path, views: n(r.c) }));
}

export async function engagement(db: DB, f: EngagementFilter, s: Span) {
  const order = f.path === '/' ? sectionsFor(f.role ?? 'patient') : undefined;
  const [scroll, sections, time, pages] = await Promise.all([
    scrollReach(db, f, s),
    sectionReadThrough(db, f, s, order),
    timeOnPage(db, f, s),
    engagedPages(db, s),
  ]);
  return { scroll, sections, time, pages };
}
