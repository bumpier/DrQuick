import type { Metadata } from 'next';
import { EmptyState } from '@/components/app/EmptyState';
import { AdminPageHeader, NoDatabase } from '@/components/admin/AdminPageHeader';
import { DateRangePicker } from '@/components/admin/DateRangePicker';
import { HeatmapView } from '@/components/admin/HeatmapView';
import { Control, LinkToggle } from '@/components/admin/LinkToggle';
import { QuerySelect } from '@/components/admin/QuerySelect';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireAdmin } from '@/lib/admin-auth';
import { DEVICE_BUCKETS, DEVICE_LABELS, type DeviceBucket, type Mode } from '@/lib/admin/analytics-labels';
import { fmtCount, fmtPct } from '@/lib/admin/format';
import { BUCKET_WIDTHS, reachBands } from '@/lib/admin/heatmap';
import { clickPages, deepestScrolls, heatmapClicks, MAX_CLICKS, topElements } from '@/lib/admin/queries/heatmaps';
import { param, parseRange } from '@/lib/admin/range';
import { flatParams, withQuery } from '@/lib/admin/url';
import { getDb } from '@/lib/db';

export const metadata: Metadata = { title: 'Heatmaps' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const BASE = '/admin/analytics/heatmaps';

// Only a same-origin public page may be framed: a path, never //host, and
// never the admin or the API.
const SAFE_PATH = /^\/(?!\/)[^\s?#\\]*$/;
const framable = (p: string) => SAFE_PATH.test(p) && !/^\/(admin|api)(\/|$)/.test(p);

export default async function HeatmapsPage({ searchParams }: Props) {
  await requireAdmin();
  const now = new Date();
  const params = await searchParams;
  const query = flatParams(params);
  const range = parseRange(params, now);
  const device = (DEVICE_BUCKETS as readonly string[]).includes(param(params, 'device') ?? '') ? param(params, 'device') as DeviceBucket : 'desktop';
  const mode = param(params, 'mode') === 'scroll' ? 'scroll' : 'clicks';

  const header = <AdminPageHeader title="Heatmaps" description="Where people click on a page, and how far down it they get, drawn over the live page." />;
  const db = await getDb();
  if (!db) return <>{header}<NoDatabase /></>;

  const pages = await clickPages(db, range);
  const asked = param(params, 'page');
  const path = asked && framable(asked) ? asked : pages.find((p) => framable(p.path))?.path ?? '/';
  const role: Mode | null = path === '/' ? (param(params, 'role') === 'gp' ? 'gp' : 'patient') : null;
  const filter = { path, device, role };

  const [clicks, top, deepest] = await Promise.all([
    mode === 'clicks' ? heatmapClicks(db, filter, range) : Promise.resolve([]),
    mode === 'clicks' ? topElements(db, filter, range) : Promise.resolve({ total: 0, rows: [] }),
    mode === 'scroll' ? deepestScrolls(db, filter, range) : Promise.resolve([]),
  ]);
  const width = BUCKET_WIDTHS[device];
  const src = `${path}?dq_heatmap=1${role === 'gp' ? '&role=gp' : ''}`;
  const flat = clicks.flatMap((c) => [Math.round(c.x * 10) / 10, Math.round(c.y), Math.round(c.h)]);
  const bands = reachBands(deepest);
  const marks = [25, 50, 75, 100].map((d) => ({ depth: d, share: deepest.length ? deepest.filter((v) => v >= d).length / deepest.length : 0 }));
  const sample = mode === 'clicks' ? clicks.length : deepest.length;
  const pageOptions = pages.some((p) => p.path === path) ? pages : [{ path, clicks: 0 }, ...pages];

  return (
    <>
      {header}
      <DateRangePicker range={range} basePath={BASE} keep={{ page: query.page, device: query.device, mode: query.mode, role: query.role }} now={now} />

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <QuerySelect label="Page" name="page" value={path} basePath={BASE} query={query} clear={['role']}
          options={pageOptions.filter((p) => framable(p.path)).map((p) => ({ value: p.path, label: `${p.path} (${fmtCount(p.clicks)} clicks)` }))} />
        <Control label="Device">
          <LinkToggle label="Device" options={DEVICE_BUCKETS.map((d) => ({
            href: withQuery(BASE, query, { device: d === 'desktop' ? null : d }), label: `${DEVICE_LABELS[d]} ${BUCKET_WIDTHS[d]}`, current: device === d,
          }))} />
        </Control>
        <Control label="Show">
          <LinkToggle label="Show" options={[
            { href: withQuery(BASE, query, { mode: null }), label: 'Clicks', current: mode === 'clicks' },
            { href: withQuery(BASE, query, { mode: 'scroll' }), label: 'Scroll', current: mode === 'scroll' },
          ]} />
        </Control>
        {path === '/' && (
          <Control label="Landing page mode">
            <LinkToggle label="Landing page mode" options={[
              { href: withQuery(BASE, query, { role: null }), label: 'Patients', current: role === 'patient' },
              { href: withQuery(BASE, query, { role: 'gp' }), label: 'GPs', current: role === 'gp' },
            ]} />
          </Control>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_22rem] items-start gap-4 max-forms:grid-cols-1">
        <Card className="block min-w-0 px-6 py-6 max-phone:px-3">
          <CardTitle>{mode === 'clicks' ? 'Clicks' : 'Scroll reach'} on <span className="font-mono">{path}</span></CardTitle>
          <p className="mt-1 mb-4 text-fine text-ink-2">
            {mode === 'clicks'
              ? `${fmtCount(sample)} ${sample === 1 ? 'click' : 'clicks'} on ${DEVICE_LABELS[device].toLowerCase()} screens${sample >= MAX_CLICKS ? ' (the latest only)' : ''}. Darker is more clicked.`
              : `${fmtCount(sample)} ${sample === 1 ? 'view' : 'views'} on ${DEVICE_LABELS[device].toLowerCase()} screens. Darker bands were seen by more of them.`}
          </p>
          {sample === 0
            ? <EmptyState>{mode === 'clicks' ? 'No clicks recorded on this page and device in this range.' : 'No measured views of this page and device in this range.'}</EmptyState>
            : <HeatmapView src={src} width={width} mode={mode} clicks={flat} bands={bands} marks={marks} />}
        </Card>

        <Card size="sm" className="min-w-0">
          <CardHeader>
            <CardTitle>{mode === 'clicks' ? 'Most clicked' : 'How far people got'}</CardTitle>
          </CardHeader>
          <CardContent>
            {mode === 'clicks' ? (
              top.rows.length === 0 ? <EmptyState className="py-6">Nothing clicked yet.</EmptyState> : (
                <ol className="grid gap-3">
                  {top.rows.map((r) => (
                    <li key={`${r.sel}|${r.text}`} className="grid gap-0.5 border-t border-rule pt-3 first:border-t-0 first:pt-0">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate font-semibold">{r.text || (r.sel.includes('input') ? 'A form field' : 'An element with no text')}</span>
                        <span className="shrink-0 text-fine tabular-nums"><strong>{fmtCount(r.clicks)}</strong><span className="text-ink-2"> · {fmtPct(r.share)}</span></span>
                      </span>
                      <span className="truncate font-mono text-[12px] text-ink-2" title={r.sel}>{r.sel || '—'}</span>
                    </li>
                  ))}
                </ol>
              )
            ) : (
              deepest.length === 0 ? <EmptyState className="py-6">No measured views yet.</EmptyState> : (
                <ol className="grid gap-2">
                  {marks.map((m) => (
                    <li key={m.depth} className="flex items-baseline justify-between gap-3 border-t border-rule pt-2 first:border-t-0 first:pt-0">
                      <span>Reached {m.depth}% of the page</span>
                      <strong className="tabular-nums">{fmtPct(m.share)}</strong>
                    </li>
                  ))}
                </ol>
              )
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
