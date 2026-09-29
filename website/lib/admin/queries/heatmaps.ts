// The Heatmaps page. Server-only. Clicks come from consented views only (the
// only ones that record them), filtered by the viewport bucket the click was
// made in (props.vp); scroll depth by the pageview's device bucket. On '/', a
// role narrows both to one mode through the pageview that owns the event.
// Clicks are capped at the latest MAX_CLICKS so the page stays fast.
import { sql, type SQL } from 'drizzle-orm';
import type { DB } from '@/lib/db';
import { rowsOf } from '@/lib/rate-limit';
import type { Span } from '@/lib/admin/range';
import type { DeviceBucket, Mode } from '@/lib/admin/analytics-labels';
import { inSpan, iso, n, numProp, spanPlusDay } from '@/lib/admin/queries/analytics-sql';
import type { StoredClick } from '@/lib/admin/heatmap';

export const MAX_CLICKS = 20_000;
export const MAX_VIEWS = 20_000;

export type HeatmapFilter = { path: string; device: DeviceBucket; role: Mode | null };

// Only events whose pageview was in the chosen mode (landing page only).
function roleFilter(f: HeatmapFilter, s: Span): SQL {
  if (!f.role || f.path !== '/') return sql``;
  return sql`and props->>'pv' in (
    select props->>'pv' from events
    where type = 'pageview' and path = ${f.path} and visitor_id is not null
      and props->>'role' = ${f.role} and ${inSpan('ts', s)})`;
}

export async function clickPages(db: DB, s: Span): Promise<Array<{ path: string; clicks: number }>> {
  const rows = rowsOf<{ path: string; c: number }>(await db.execute(sql`
    select path, count(*)::int as c from events where type = 'click' and ${inSpan('ts', s)}
    group by path order by c desc, path asc limit 30`));
  return rows.map((r) => ({ path: r.path, clicks: n(r.c) }));
}

export async function heatmapClicks(db: DB, f: HeatmapFilter, s: Span): Promise<StoredClick[]> {
  const rows = rowsOf<{ x: number; y: number; h: number }>(await db.execute(sql`
    select ${numProp('x')} as x, ${numProp('y')} as y, ${numProp('h')} as h from events
    where type = 'click' and path = ${f.path} and props->>'vp' = ${f.device} and ${inSpan('ts', s)} ${roleFilter(f, s)}
    order by ts desc limit ${MAX_CLICKS}`));
  return rows.map((r) => ({ x: n(r.x), y: n(r.y), h: n(r.h) }));
}

export type ElementRow = { sel: string; text: string; clicks: number; share: number };

// The most-clicked elements among the same clicks the map draws.
export async function topElements(db: DB, f: HeatmapFilter, s: Span, limit = 15): Promise<{ total: number; rows: ElementRow[] }> {
  const rows = rowsOf<{ sel: string | null; text: string | null; c: number; total: number }>(await db.execute(sql`
    with c as (
      select props->>'sel' as sel, props->>'text' as text from events
      where type = 'click' and path = ${f.path} and props->>'vp' = ${f.device} and ${inSpan('ts', s)} ${roleFilter(f, s)}
      order by ts desc limit ${MAX_CLICKS}
    )
    select sel, text, count(*)::int as c, (select count(*) from c)::int as total
    from c group by sel, text order by c desc, sel asc limit ${limit}`));
  const total = n(rows[0]?.total);
  return {
    total,
    rows: rows.map((r) => ({ sel: r.sel ?? '', text: r.text ?? '', clicks: n(r.c), share: total > 0 ? n(r.c) / total : 0 })),
  };
}

// Each view's deepest scroll %, for the scroll map. Views that never reported
// a scroll count at 0.
export async function deepestScrolls(db: DB, f: HeatmapFilter, s: Span): Promise<number[]> {
  const late = spanPlusDay(s);
  const role = f.role && f.path === '/' ? sql`and props->>'role' = ${f.role}` : sql``;
  const rows = rowsOf<{ d: number }>(await db.execute(sql`
    with views as (
      select props->>'pv' as pv from events
      where type = 'pageview' and path = ${f.path} and visitor_id is not null and props->>'pv' is not null
        and props->>'device' = ${f.device} and ${inSpan('ts', s)} ${role}
      order by ts desc limit ${MAX_VIEWS}
    ), deepest as (
      select props->>'pv' as pv, max(greatest(${numProp('max')}, ${numProp('depth')}, ${numProp('max_scroll')})) as d
      from events
      where path = ${f.path} and type in ('scroll', 'engaged_time')
        and ts >= ${iso(s.from)} and ts < ${iso(late.to)} and props->>'pv' in (select pv from views)
      group by 1
    )
    select least(100, coalesce(deepest.d, 0))::float as d from views left join deepest on deepest.pv = views.pv`));
  return rows.map((r) => n(r.d));
}
