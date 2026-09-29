import type { Metadata } from 'next';
import { EmptyState } from '@/components/app/EmptyState';
import { AdminPageHeader, NoDatabase } from '@/components/admin/AdminPageHeader';
import { DateRangePicker } from '@/components/admin/DateRangePicker';
import { Kpi, KpiRow } from '@/components/admin/Kpi';
import { RankTable } from '@/components/admin/RankTable';
import { Sparkline } from '@/components/admin/Sparkline';
import { TrendChart } from '@/components/admin/TrendChart';
import { Card, CardTitle } from '@/components/ui/card';
import { requireAdmin } from '@/lib/admin-auth';
import { fmtDuration } from '@/lib/admin/analytics-labels';
import { delta, fmtCount, fmtPct } from '@/lib/admin/format';
import { BOUNCE_SECONDS, traffic } from '@/lib/admin/queries/traffic';
import { bucketLabel, parseRange } from '@/lib/admin/range';
import { getDb } from '@/lib/db';

export const metadata: Metadata = { title: 'Traffic' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const mono = (path: string) => <span className="font-mono">{path}</span>;

export default async function TrafficPage({ searchParams }: Props) {
  await requireAdmin();
  const now = new Date();
  const range = parseRange(await searchParams, now);
  const header = <AdminPageHeader title="Traffic" description="How many people came to the site, where from, and which pages they saw." />;
  const db = await getDb();
  if (!db) return <>{header}<NoDatabase /></>;

  const t = await traffic(db, range);
  const k = t.kpis;
  const p = t.prev;
  const per = range.bucket === 'day' ? 'day' : 'month';
  const labels = t.visitorSeries.keys.map(bucketLabel);
  const ratioDelta = (a: number | null, b: number | null) => (a === null || b === null ? null : delta(a, b));

  return (
    <>
      {header}
      <DateRangePicker range={range} basePath="/admin/analytics/traffic" now={now} />

      <KpiRow className="grid-cols-5 max-forms:grid-cols-3">
        <Kpi label="Visitors" value={fmtCount(k.visitors)} change={delta(k.visitors, p.visitors)}>
          <Sparkline values={t.visitorSeries.values.visitors} />
        </Kpi>
        <Kpi label="Visits" value={fmtCount(k.visits)} change={delta(k.visits, p.visits)} />
        <Kpi label="Page views" value={fmtCount(k.pageviews)} change={delta(k.pageviews, p.pageviews)}>
          <Sparkline values={t.pageviewSeries.values.pageviews} />
        </Kpi>
        <Kpi label="Bounce rate" value={fmtPct(k.bounceRate)} goodWhen="down" change={ratioDelta(k.bounceRate, p.bounceRate)} />
        <Kpi label="Engaged time per visit" value={fmtDuration(k.avgEngaged)} change={ratioDelta(k.avgEngaged, p.avgEngaged)} />
      </KpiRow>

      <Card className="mt-4 block min-w-0 px-6 py-6 max-phone:px-4">
        <CardTitle>Visitors and page views per {per}</CardTitle>
        <p className="mt-1 mb-4 text-fine text-ink-2">Page views are the solid line; visitors are dashed.</p>
        {k.pageviews + k.visitors === 0
          ? <EmptyState>No visits recorded in this range.</EmptyState>
          : <TrendChart ariaLabel={`Page views and visitors per ${per}`} labels={labels} series={[
              { key: 'pageviews', label: 'Page views', values: t.pageviewSeries.values.pageviews },
              { key: 'visitors', label: 'Visitors', values: t.visitorSeries.values.visitors },
            ]} />}
      </Card>

      <div className="mt-4 grid grid-cols-[3fr_2fr] gap-4 max-forms:grid-cols-1">
        <RankTable
          title="Top pages"
          head="Page" valueLabel="Views" extraHeads={['Visitors', 'Engaged']}
          rows={t.pages.map((r) => ({
            key: r.path, label: mono(r.path), value: r.views,
            cells: [fmtCount(r.visitors), fmtDuration(r.avgEngaged)],
          }))}
          empty="No page views in this range."
        />
        <RankTable
          title="Where visits came from"
          description="The referring site. Direct means no referrer: typed in, a bookmark or most apps."
          head="Source" valueLabel="Visits"
          rows={t.refs.map((r) => ({ key: r.key, label: r.key, value: r.value }))}
          empty="No visits in this range."
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4 max-forms:grid-cols-2 max-cols:grid-cols-1">
        <RankTable
          title="Campaigns"
          description="Visits from links tagged with utm_source."
          head="Source · medium · campaign" valueLabel="Visits"
          rows={t.utm.map((r) => ({
            key: `${r.source}|${r.medium}|${r.campaign}`,
            label: [r.source, r.medium, r.campaign].filter(Boolean).join(' · '),
            value: r.visits,
          }))}
          empty="No tagged links used in this range."
        />
        <RankTable title="Devices" head="Device" valueLabel="Visits"
          rows={t.devices.map((r) => ({ key: r.key, label: cap(r.key), value: r.value }))} empty="No visits in this range." />
        <RankTable title="Browsers" head="Browser" valueLabel="Visits"
          rows={t.browsers.map((r) => ({ key: r.key, label: r.key, value: r.value }))} empty="No visits in this range." />
        <RankTable title="Operating systems" head="System" valueLabel="Visits"
          rows={t.systems.map((r) => ({ key: r.key, label: r.key, value: r.value }))} empty="No visits in this range." />
        <RankTable
          title="Entry pages"
          description="Where consented visits began."
          head="Page" valueLabel="Visits" extraHeads={['Bounced']}
          rows={t.entries.map((r) => ({ key: r.path, label: mono(r.path), value: r.sessions, cells: [fmtPct(r.bounceRate)] }))}
          empty="No consented visits in this range."
        />
        <RankTable
          title="Exit pages"
          description="The last page of each consented visit."
          head="Page" valueLabel="Visits"
          rows={t.exits.map((r) => ({ key: r.key, label: mono(r.key), value: r.value }))}
          empty="No consented visits in this range."
        />
      </div>

      <p className="mt-6 max-w-[80ch] text-fine text-ink-2">
        {k.identifiedShare === null
          ? 'No page views yet. '
          : `${fmtPct(k.identifiedShare)} of page views came from visitors who accepted analytics; the rest are anonymous counts. `}
        A visit is a consented session, or one anonymous page view (those carry no id, so visitors and visits are upper bounds for them).
        Bounce: a consented visit of one page and under {BOUNCE_SECONDS}s of engaged time. Engaged time and entry and exit pages cover consented visits only.
      </p>
    </>
  );
}
