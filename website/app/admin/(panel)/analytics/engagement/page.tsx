import type { Metadata } from 'next';
import { EmptyState } from '@/components/app/EmptyState';
import { AdminPageHeader, NoDatabase } from '@/components/admin/AdminPageHeader';
import { DateRangePicker } from '@/components/admin/DateRangePicker';
import { Histogram } from '@/components/admin/Histogram';
import { Kpi, KpiRow } from '@/components/admin/Kpi';
import { Control, LinkToggle } from '@/components/admin/LinkToggle';
import { QuerySelect } from '@/components/admin/QuerySelect';
import { SectionReadThrough } from '@/components/admin/SectionReadThrough';
import { Card, CardTitle } from '@/components/ui/card';
import { requireAdmin } from '@/lib/admin-auth';
import { fmtDuration, type Mode } from '@/lib/admin/analytics-labels';
import { fmtCount, fmtPct } from '@/lib/admin/format';
import { engagement } from '@/lib/admin/queries/engagement';
import { param, parseRange } from '@/lib/admin/range';
import { flatParams, withQuery } from '@/lib/admin/url';
import { getDb } from '@/lib/db';

export const metadata: Metadata = { title: 'Engagement' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const BASE = '/admin/analytics/engagement';

export default async function EngagementPage({ searchParams }: Props) {
  await requireAdmin();
  const now = new Date();
  const params = await searchParams;
  const query = flatParams(params);
  const range = parseRange(params, now);
  const rawPath = (param(params, 'page') ?? '/').slice(0, 300);
  const path = rawPath.startsWith('/') ? rawPath : '/';
  const role: Mode | null = path === '/' ? (param(params, 'role') === 'gp' ? 'gp' : 'patient') : null;

  const header = <AdminPageHeader title="Engagement" description="How much of a page people read: how far they scroll, which sections they reach and how long they stay." />;
  const db = await getDb();
  if (!db) return <>{header}<NoDatabase /></>;

  const e = await engagement(db, { path, role }, range);
  const pageOptions = e.pages.some((p) => p.path === path) ? e.pages : [{ path, views: 0 }, ...e.pages];
  const empty = e.scroll.total === 0;
  const avgScroll = e.scroll.reach;
  const readAll = e.sections.sections.at(-1);

  return (
    <>
      {header}
      <DateRangePicker range={range} basePath={BASE} keep={{ page: query.page, role: query.role }} now={now} />

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <QuerySelect label="Page" name="page" value={path} basePath={BASE} query={query} clear={['role']}
          options={pageOptions.map((p) => ({ value: p.path, label: `${p.path} (${fmtCount(p.views)})` }))} />
        {path === '/' && (
          <Control label="Landing page mode">
            <LinkToggle label="Landing page mode" options={[
              { href: withQuery(BASE, query, { role: null }), label: 'Patients', current: role === 'patient' },
              { href: withQuery(BASE, query, { role: 'gp' }), label: 'GPs', current: role === 'gp' },
            ]} />
          </Control>
        )}
      </div>

      <KpiRow>
        <Kpi label="Page views measured" value={fmtCount(e.scroll.total)} note="Views by visitors who accepted analytics" />
        <Kpi label="Reached halfway" value={fmtPct(empty ? null : avgScroll[1].share)} note="Scrolled at least 50% of the page" />
        <Kpi label="Average time on page" value={fmtDuration(e.time.avgSeconds)} note="Engaged time: tab visible and in use" />
      </KpiRow>

      <Card className="mt-4 block min-w-0 px-6 py-6 max-phone:px-4">
        <CardTitle>Section read-through</CardTitle>
        <p className="mt-1 mb-5 max-w-[70ch] text-fine text-ink-2">
          {path === '/'
            ? `Share of ${role === 'gp' ? 'GP' : 'patient'}-mode views that had each section on screen for at least half a second, in page order, and where readers stopped.`
            : 'Share of views that had each tracked section on screen for at least half a second.'}
          {readAll && !empty && path === '/' && ` ${fmtPct(readAll.share)} reached the end.`}
        </p>
        {empty
          ? <EmptyState>No measured views of this page in this range.</EmptyState>
          : e.sections.sections.length === 0
            ? <EmptyState>This page has no tracked sections. Section tracking covers the landing page.</EmptyState>
            : <SectionReadThrough sections={e.sections.sections} total={e.sections.total} />}
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-4 max-cols:grid-cols-1">
        <Card className="block min-w-0 px-6 py-6 max-phone:px-4">
          <CardTitle>Scroll depth</CardTitle>
          <p className="mt-1 mb-4 text-fine text-ink-2">Share of views that scrolled at least this far down the page.</p>
          {empty ? <EmptyState>No measured views in this range.</EmptyState> : (
            <Histogram ariaLabel="Share of views reaching each scroll depth"
              bins={e.scroll.reach.map((r) => ({ label: `${r.depth}%`, value: Math.round(r.share * 1000) / 10 }))}
              suffix="%" />
          )}
        </Card>
        <Card className="block min-w-0 px-6 py-6 max-phone:px-4">
          <CardTitle>Time on page</CardTitle>
          <p className="mt-1 mb-4 text-fine text-ink-2">Views by engaged time on the page.</p>
          {empty ? <EmptyState>No measured views in this range.</EmptyState> : (
            <Histogram ariaLabel="Views by time on page"
              bins={e.time.bins.map((b) => ({ label: b.label, value: b.views }))}
              suffix=" views" />
          )}
        </Card>
      </div>
    </>
  );
}
