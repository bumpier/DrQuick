// The Funnels page. Server-only.
//
// The unit is the consented page view of the landing page (one `pv`): each
// step counts distinct views, and a view counts at a step only if it also
// reached every step before it, so the bars never grow. A later form step
// implies the earlier form steps (a submit means the form was seen and
// started, even if its form_view never arrived), and any form event of a role
// implies the view was in that mode. The optional GP step ("read the pay
// section") is never implied: with it on, the GP funnel follows only the
// views that read it.
//
// Views are those whose pageview falls in the range; their later events are
// read up to a day past its end. Segments: the pageview's device bucket, and
// the session's source — a utm_source value, or 'direct' (no campaign and no
// referrer).
//
// GP field drop-off: of GP views that started the form and never succeeded,
// the field last focused (none: they left before focusing one). Field errors
// count every field_error of the GP form in the segment.
import { sql, type SQL } from 'drizzle-orm';
import type { DB } from '@/lib/db';
import { rowsOf } from '@/lib/rate-limit';
import { param, type Params, type Span } from '@/lib/admin/range';
import { DEVICE_BUCKETS, type DeviceBucket, type Mode } from '@/lib/admin/analytics-labels';
import type { FunnelStep } from '@/lib/admin/charts';
import { inSpan, iso, n, spanPlusDay } from '@/lib/admin/queries/analytics-sql';

export type Segment = { device: DeviceBucket | null; source: string | null };

export function parseSegment(params: Params): Segment {
  const device = param(params, 'device') as DeviceBucket | undefined;
  const source = (param(params, 'source') ?? '').trim().slice(0, 100);
  return {
    device: device && DEVICE_BUCKETS.includes(device) ? device : null,
    source: source || null,
  };
}

const FUNNEL_TYPES = ['pageview', 'section_view', 'form_view', 'form_start', 'form_submit', 'form_success', 'field_focus'];

// One row per landing-page view in the range and segment, with the step flags
// for `role`. Used as a CTE named `pvs`.
function viewsCte(role: Mode, s: Span, seg: Segment): SQL {
  const late = spanPlusDay(s);
  const r = (type: string) => sql`bool_or(e.type = ${type} and e.props->>'role' = ${role})`;
  const device = seg.device ? sql`and v.device = ${seg.device}` : sql``;
  const source = seg.source === null ? sql``
    : seg.source === 'direct' ? sql`and s.utm_source is null and s.referrer is null`
      : sql`and s.utm_source = ${seg.source}`;
  return sql`
    select v.* from (
      select e.props->>'pv' as pv, min(e.session_id::text) as session_id,
        max(case when e.type = 'pageview' then e.props->>'device' end) as device,
        bool_or(e.type = 'pageview' and e.props->>'role' = ${role}) as landed,
        bool_or(e.type = 'section_view' and e.props->>'section' = 'gp-pay') as pay,
        ${r('form_view')} as seen, ${r('form_start')} as started,
        ${r('form_submit')} as submitted, ${r('form_success')} as success
      from events e
      where e.path = '/' and e.visitor_id is not null and e.props->>'pv' is not null
        and e.type in (${sql.join(FUNNEL_TYPES.map((t) => sql`${t}`), sql`, `)})
        and e.ts >= ${iso(s.from)} and e.ts < ${iso(late.to)}
      group by 1
      having bool_or(e.type = 'pageview' and ${inSpan('e.ts', s)})
    ) v left join sessions s on s.id::text = v.session_id
    where true ${device} ${source}`;
}

export type Funnel = { steps: FunnelStep[]; unit: 'views' };

// The strictly nested counts. `pay` inserts the GP pay-section step after landing.
export async function funnel(db: DB, role: Mode, s: Span, seg: Segment, pay = false): Promise<Funnel> {
  const success = sql.raw('success');
  const submitted = sql`(submitted or ${success})`;
  const started = sql`(started or ${submitted})`;
  const seen = sql`(seen or ${started})`;
  const landed = sql`(landed or ${seen})`;
  const defs: Array<{ label: string; cond: SQL }> = [
    { label: role === 'gp' ? 'Visited the GP page' : 'Visited the patient page', cond: landed },
    ...(pay ? [{ label: 'Read the pay section', cond: sql.raw('pay') }] : []),
    { label: role === 'gp' ? 'Saw the GP form' : 'Saw a sign-up form', cond: seen },
    { label: 'Started the form', cond: started },
    { label: 'Submitted', cond: submitted },
    { label: 'Joined the waitlist', cond: sql`${success}` },
  ];
  const selects = defs.map((_, i) => {
    const all = sql.join(defs.slice(0, i + 1).map((d) => sql`coalesce(${d.cond}, false)`), sql` and `);
    return sql`count(*) filter (where ${all})::int as ${sql.raw(`s${i}`)}`;
  });
  const [row] = rowsOf<Record<string, number>>(await db.execute(sql`
    with pvs as (${viewsCte(role, s, seg)})
    select ${sql.join(selects, sql`, `)} from pvs`));
  return { steps: defs.map((d, i) => ({ label: d.label, value: n(row?.[`s${i}`]) })), unit: 'views' };
}

export type FieldRow = { field: string | null; views: number };

export async function gpLastField(db: DB, s: Span, seg: Segment): Promise<{ abandoned: number; fields: FieldRow[] }> {
  const late = spanPlusDay(s);
  const rows = rowsOf<{ field: string | null; c: number }>(await db.execute(sql`
    with pvs as (${viewsCte('gp', s, seg)}),
    last as (
      select distinct on (props->>'pv') props->>'pv' as pv, props->>'field' as field
      from events
      where type = 'field_focus' and path = '/' and props->>'role' = 'gp'
        and ts >= ${iso(s.from)} and ts < ${iso(late.to)}
        and props->>'pv' in (select pv from pvs)
      order by props->>'pv', ts desc, id desc
    )
    select last.field, count(*)::int as c
    from pvs left join last on last.pv = pvs.pv
    where (pvs.started or pvs.submitted) and not coalesce(pvs.success, false)
    group by 1 order by c desc, field asc nulls last`));
  const fields = rows.map((r) => ({ field: r.field, views: n(r.c) }));
  return { abandoned: fields.reduce((a, f) => a + f.views, 0), fields };
}

export type ErrorRow = { field: string; error: string; count: number };

export async function gpFieldErrors(db: DB, s: Span, seg: Segment): Promise<ErrorRow[]> {
  const late = spanPlusDay(s);
  const rows = rowsOf<{ field: string | null; error: string | null; c: number }>(await db.execute(sql`
    with pvs as (${viewsCte('gp', s, seg)})
    select props->>'field' as field, props->>'error' as error, count(*)::int as c
    from events
    where type = 'field_error' and path = '/' and props->>'role' = 'gp'
      and ts >= ${iso(s.from)} and ts < ${iso(late.to)}
      and props->>'pv' in (select pv from pvs)
    group by 1, 2 order by c desc, field asc, error asc limit 20`));
  return rows.map((r) => ({ field: r.field ?? '', error: r.error ?? '', count: n(r.c) }));
}

// The campaign sources seen on landing-page sessions in the range, for the filter.
export async function sourceOptions(db: DB, s: Span): Promise<string[]> {
  const rows = rowsOf<{ source: string }>(await db.execute(sql`
    select distinct utm_source as source from sessions
    where utm_source is not null and ${inSpan('started_at', s)}
    order by 1 limit 50`));
  return rows.map((r) => r.source);
}

export async function funnels(db: DB, s: Span, seg: Segment, pay: boolean) {
  const [patient, gp, lastField, errors, sources] = await Promise.all([
    funnel(db, 'patient', s, seg),
    funnel(db, 'gp', s, seg, pay),
    gpLastField(db, s, seg),
    gpFieldErrors(db, s, seg),
    sourceOptions(db, s),
  ]);
  return { patient, gp, lastField, errors, sources };
}
