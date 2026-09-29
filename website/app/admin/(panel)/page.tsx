import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState } from '@/components/app/EmptyState';
import { AdminPageHeader, NoDatabase } from '@/components/admin/AdminPageHeader';
import { DateRangePicker } from '@/components/admin/DateRangePicker';
import { DemoBadge } from '@/components/admin/DemoBadge';
import { Kpi, KpiRow } from '@/components/admin/Kpi';
import { Sparkline } from '@/components/admin/Sparkline';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { TrendChart } from '@/components/admin/TrendChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireAdmin } from '@/lib/admin-auth';
import { ago, delta, fmtCount, fmtDate, fmtPct } from '@/lib/admin/format';
import { isDemo } from '@/lib/admin/queries/finance';
import { overview } from '@/lib/admin/queries/overview';
import { bucketLabel, parseRange } from '@/lib/admin/range';
import { getDb } from '@/lib/db';
import { demoSource } from '@/lib/finance/demo';
import { gbp } from '@/lib/money';

export const metadata: Metadata = { title: 'Overview' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function OverviewPage({ searchParams }: Props) {
  await requireAdmin();
  const now = new Date();
  const params = await searchParams;
  const range = parseRange(params, now);
  // ?demo=1 previews the two finance figures from the demo generator, as the
  // finance pages do; everything else on the page stays real.
  const demo = isDemo(params);
  const header = <AdminPageHeader title="Overview" description="How the waitlist and the site are doing, at a glance." />;
  const db = await getDb();
  if (!db) return <>{header}<NoDatabase /></>;

  const o = await overview(db, range, now, demo ? demoSource(now) : undefined);
  const labels = o.signupSeries.keys.map(bucketLabel);
  const per = range.bucket === 'day' ? 'day' : 'month';
  const anySignups = o.signups.patients + o.signups.gps > 0;
  const anyVisitors = o.visitors > 0;
  const paymentsLive = o.revenue !== 0 || o.prevRevenue !== 0;
  const badge = demo ? <DemoBadge /> : undefined;

  return (
    <>
      {header}
      <DateRangePicker range={range} basePath="/admin" keep={{ demo: demo ? '1' : undefined }} now={now} />

      <KpiRow>
        <Kpi label="Visitors" value={fmtCount(o.visitors)} change={delta(o.visitors, o.prevVisitors)}
          note="Consented visitors plus cookieless page views">
          <Sparkline values={o.visitorSeries.values.visitors} />
        </Kpi>
        <Kpi label="Patient sign-ups" value={fmtCount(o.signups.patients)} change={delta(o.signups.patients, o.prevSignups.patients)}>
          <Sparkline values={o.signupSeries.values.patients} />
        </Kpi>
        <Kpi label="GP sign-ups" value={fmtCount(o.signups.gps)} change={delta(o.signups.gps, o.prevSignups.gps)}>
          <Sparkline values={o.signupSeries.values.gps} />
        </Kpi>
        <Kpi label="Visitors who signed up" value={fmtPct(o.conversion)}
          change={o.conversion === null || o.prevConversion === null ? null : delta(o.conversion, o.prevConversion)}
          note="Sign-ups divided by visitors" />
        <Kpi label="Revenue this month" value={gbp(o.revenue)}
          change={paymentsLive ? delta(o.revenue, o.prevRevenue) : undefined}
          note={paymentsLive ? 'Payments taken, less refunds. Compared with last month.' : 'Payments are not live yet.'}>{badge}</Kpi>
        <Kpi label="GP payouts pending" value={gbp(o.payouts.pence)} goodWhen="down"
          note={o.payouts.count === 0 ? 'Nothing owed to GPs.' : `${fmtCount(o.payouts.count)} ${o.payouts.count === 1 ? 'payout' : 'payouts'} to send`}>{badge}</Kpi>
      </KpiRow>

      <div className="mt-4 grid grid-cols-[3fr_2fr] gap-4 max-forms:grid-cols-1">
        <Card className="block min-w-0 px-6 py-6 max-phone:px-4">
          <CardTitle>Sign-ups per {per}</CardTitle>
          <p className="mt-1 mb-4 text-fine text-ink-2">Patients and GPs who joined the waitlist.</p>
          {anySignups
            ? <TrendChart ariaLabel={`Sign-ups per ${per}, patients and GPs`} labels={labels} series={[
                { key: 'patients', label: 'Patients', values: o.signupSeries.values.patients },
                { key: 'gps', label: 'GPs', values: o.signupSeries.values.gps },
              ]} />
            : <EmptyState>No sign-ups in this range.</EmptyState>}
        </Card>
        <Card className="block min-w-0 px-6 py-6 max-phone:px-4">
          <CardTitle>Visitors per {per}</CardTitle>
          <p className="mt-1 mb-4 text-fine text-ink-2">Counted the same way as the Visitors figure.</p>
          {anyVisitors
            ? <TrendChart ariaLabel={`Visitors per ${per}`} labels={o.visitorSeries.keys.map(bucketLabel)}
                series={[{ key: 'visitors', label: 'Visitors', values: o.visitorSeries.values.visitors }]} />
            : <EmptyState>No visits recorded in this range.</EmptyState>}
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4 max-forms:grid-cols-2 max-cols:grid-cols-1">
        <Card size="sm" className="min-w-0">
          <CardHeader>
            <CardTitle>Latest GP applications</CardTitle>
          </CardHeader>
          <CardContent>
            {o.latestGps.length === 0 ? <EmptyState>No GP applications yet.</EmptyState> : (
              <ul className="grid gap-1">
                {o.latestGps.map((gp) => (
                  <li key={gp.id}>
                    <Link href={`/admin/waitlist/gps/${gp.id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2 no-underline hover:bg-surface-mid">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-ink">{gp.name || 'No name given'}</span>
                        <span className="block text-fine text-ink-2">GMC {gp.gmc || '—'} · {fmtDate(gp.createdAt)}</span>
                      </span>
                      <StatusBadge role="gp" status={gp.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/admin/waitlist/gps" className="mt-3 inline-block text-fine font-semibold text-primary-ink">All GP applications</Link>
          </CardContent>
        </Card>

        <Card size="sm" className="min-w-0">
          <CardHeader>
            <CardTitle>Top referrers</CardTitle>
          </CardHeader>
          <CardContent>
            {o.referrers.length === 0 ? <EmptyState>No referring sites in this range.</EmptyState> : (
              <ol className="grid gap-2">
                {o.referrers.map((r) => (
                  <li key={r.host} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate">{r.host}</span>
                    <span className="text-fine text-ink-2 tabular-nums">{fmtCount(r.sessions)} {r.sessions === 1 ? 'visit' : 'visits'}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card size="sm" className="min-w-0">
          <CardHeader>
            <CardTitle>On the site now</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-fine text-ink-2">
              <strong className="text-2xl font-bold text-ink tabular-nums">{fmtCount(o.live.total)}</strong>{' '}
              active in the last 5 minutes
            </p>
            {o.live.sessions.length === 0 ? <EmptyState>Nobody right now.</EmptyState> : (
              <ul className="grid gap-2">
                {o.live.sessions.map((s) => (
                  <li key={s.id} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate font-mono text-fine">{s.path}</span>
                    <span className="shrink-0 text-fine text-ink-2">{s.device} · {ago(s.lastSeen, now)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
