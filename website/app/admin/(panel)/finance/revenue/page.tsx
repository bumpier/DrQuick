import type { Metadata } from 'next';
import { DownloadIcon } from 'lucide-react';
import { EmptyState } from '@/components/app/EmptyState';
import { AdminPageHeader, NoDatabase } from '@/components/admin/AdminPageHeader';
import { DateRangePicker } from '@/components/admin/DateRangePicker';
import { DemoBadge } from '@/components/admin/DemoBadge';
import { DemoBanner, DemoToggle, NOT_LIVE, Titled } from '@/components/admin/DemoMode';
import { Kpi, KpiRow } from '@/components/admin/Kpi';
import { MoneyTrend } from '@/components/admin/MoneyTrend';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { requireAdmin } from '@/lib/admin-auth';
import { delta, fmtCount, fmtPct } from '@/lib/admin/format';
import { dbSource, isDemo, revenueLedger } from '@/lib/admin/queries/finance';
import { bucketLabel, parseRange } from '@/lib/admin/range';
import { flatParams, withQuery } from '@/lib/admin/url';
import { getDb } from '@/lib/db';
import { demoSource } from '@/lib/finance/demo';
import { figures, monthElapsed, monthWindow, runRate, type Figures } from '@/lib/finance/model';
import { gbp } from '@/lib/money';

export const metadata: Metadata = { title: 'Revenue' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const BASE = '/admin/finance/revenue';

const DESCRIPTION = 'Money taken for consultations and what Dr Quick keeps. Net revenue is gross (payments taken) less refunds, '
  + 'less the GP fee for each completed consultation — before Stripe’s fees and other costs. Each figure falls in the month '
  + 'the money moved (UTC).';

const price = (v: number | null) => (v === null ? '—' : gbp(v));

// The rows of the month comparison and the monthly ledger, one definition each.
const METRICS: Array<{ label: string; value: (f: Figures) => string; raw: (f: Figures) => number | null; goodWhen?: 'down' }> = [
  { label: 'Gross', value: (f) => gbp(f.gmv), raw: (f) => f.gmv },
  { label: 'Refunds', value: (f) => gbp(f.refunds), raw: (f) => f.refunds, goodWhen: 'down' },
  { label: 'GP fees', value: (f) => gbp(f.gpFees), raw: (f) => f.gpFees },
  { label: 'Net revenue', value: (f) => gbp(f.net), raw: (f) => f.net },
  { label: 'Take rate', value: (f) => fmtPct(f.takeRate), raw: (f) => f.takeRate },
  { label: 'Consultations completed', value: (f) => fmtCount(f.completed), raw: (f) => f.completed },
  { label: 'Average price', value: (f) => price(f.avgPrice), raw: (f) => f.avgPrice },
];

function change(a: number | null, b: number | null): string {
  if (a === null || b === null) return '—';
  const d = delta(a, b);
  if (d === null) return '—';
  if (Math.abs(d) < 0.0005) return 'No change';
  return `${d > 0 ? 'Up' : 'Down'} ${fmtPct(Math.abs(d))}`;
}

export default async function RevenuePage({ searchParams }: Props) {
  await requireAdmin();
  const now = new Date();
  const params = await searchParams;
  const query = flatParams(params);
  const range = parseRange(params, now);
  const demo = isDemo(params);

  const header = (
    <AdminPageHeader
      title="Revenue"
      description={DESCRIPTION}
      actions={<>
        <DemoToggle basePath={BASE} query={query} demo={demo} />
        <a href={withQuery(`${BASE}/export`, { demo: demo ? '1' : undefined })} download
          className="inline-flex h-12 items-center gap-2 rounded-pill bg-white px-5 font-semibold text-ink no-underline ring-2 ring-ink ring-inset hover:bg-surface-mid">
          <DownloadIcon strokeWidth={2} className="size-5" aria-hidden="true" />
          Download CSV
        </a>
      </>}
    />
  );
  const db = await getDb();
  if (!db && !demo) return <>{header}<NoDatabase /></>;
  const source = demo ? demoSource(now) : dbSource(db!);

  const month = monthWindow(now);
  const last = monthWindow(now, -1);
  // The same stretch of last month as has passed of this one, for a fair change.
  const samePoint = { from: last.from, to: new Date(last.from.getTime() + (now.getTime() - month.from.getTime())) };
  const [cur, prev, mtd, lastSame, lastFull, ledger] = await Promise.all([
    source.sums(range), source.sums(range.prev),
    source.sums({ from: month.from, to: now }), source.sums(samePoint), source.sums(last),
    revenueLedger(source, now),
  ]);
  const f = figures(cur);
  const p = figures(prev);
  const thisMonth = figures(mtd);
  const projected = runRate(mtd, now);
  const live = demo || !ledger.empty || f.gmv > 0;
  const badge = demo ? <DemoBadge /> : undefined;
  const pct = Math.round(monthElapsed(now) * 100);

  return (
    <>
      {header}
      {demo && <DemoBanner />}
      <DateRangePicker range={range} basePath={BASE} keep={{ demo: query.demo }} now={now} />

      <KpiRow className="grid-cols-4 max-forms:grid-cols-2">
        <Kpi label="Gross" value={gbp(f.gmv)} change={live ? delta(f.gmv, p.gmv) : undefined} note="Payments taken">{badge}</Kpi>
        <Kpi label="Refunds" value={gbp(f.refunds)} change={live ? delta(f.refunds, p.refunds) : undefined} goodWhen="down" note="Money returned to patients">{badge}</Kpi>
        <Kpi label="GP fees" value={gbp(f.gpFees)} change={live ? delta(f.gpFees, p.gpFees) : undefined} note="Owed for completed consultations">{badge}</Kpi>
        <Kpi label="Net revenue" value={gbp(f.net)} change={live ? delta(f.net, p.net) : undefined} note="Gross less refunds and GP fees">{badge}</Kpi>
      </KpiRow>
      <KpiRow className="mt-4">
        <Kpi label="Take rate" value={fmtPct(f.takeRate)}
          change={live && f.takeRate !== null && p.takeRate !== null ? delta(f.takeRate, p.takeRate) : undefined}
          note="Net revenue as a share of gross">{badge}</Kpi>
        <Kpi label="Consultations completed" value={fmtCount(f.completed)} change={live ? delta(f.completed, p.completed) : undefined}
          note={`${fmtCount(f.paidConsults)} paid for in all`}>{badge}</Kpi>
        <Kpi label="Average price" value={price(f.avgPrice)}
          change={live && f.avgPrice !== null && p.avgPrice !== null ? delta(f.avgPrice, p.avgPrice) : undefined}
          note="Gross per consultation paid for">{badge}</Kpi>
      </KpiRow>

      {!live ? (
        <Card className="mt-4 block px-6 py-6 max-phone:px-4">
          <EmptyState>{NOT_LIVE}</EmptyState>
        </Card>
      ) : (
        <>
          <Card size="sm" className="mt-4 min-w-0">
            <CardHeader>
              <CardTitle><Titled title="This month against last" demo={demo} /></CardTitle>
              <p className="text-fine text-ink-2">
                {pct}% of the month has gone. The change compares with the same point last month. The projection assumes the rest
                of the month runs at the same pace — an estimate, not a forecast.
              </p>
            </CardHeader>
            <CardContent>
              <Table stack="cols">
                <TableHeader>
                  <TableRow>
                    <TableHead>Figure</TableHead>
                    <TableHead className="text-right">This month so far</TableHead>
                    <TableHead className="text-right">Same point last month</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                    <TableHead className="text-right">All of last month</TableHead>
                    <TableHead className="text-right">This month, projected (estimate)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {METRICS.map((m) => (
                    <TableRow key={m.label}>
                      <th scope="row" className="px-3 py-2 text-left font-semibold">{m.label}</th>
                      <TableCell data-label="So far" className="text-right tabular-nums">{m.value(thisMonth)}</TableCell>
                      <TableCell data-label="Same point" className="text-right tabular-nums">{m.value(figures(lastSame))}</TableCell>
                      <TableCell data-label="Change" className="text-right text-ink-2">{change(m.raw(thisMonth), m.raw(figures(lastSame)))}</TableCell>
                      <TableCell data-label="Last month" className="text-right tabular-nums">{m.value(figures(lastFull))}</TableCell>
                      <TableCell data-label="Projected" className="text-right tabular-nums text-ink-2">{projected ? m.value(projected) : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="mt-4 block min-w-0 px-6 py-6 max-phone:px-4">
            <CardTitle><Titled title="Gross and net revenue per month" demo={demo} /></CardTitle>
            <p className="mt-1 mb-4 text-fine text-ink-2">The last twelve months. The latest month is still running.</p>
            <MoneyTrend
              ariaLabel="Gross and net revenue per month, last twelve months"
              labels={[...ledger.rows].reverse().map((r) => bucketLabel(r.key))}
              series={[
                { key: 'gmv', label: 'Gross', values: [...ledger.rows].reverse().map((r) => r.figures.gmv) },
                { key: 'net', label: 'Net revenue', values: [...ledger.rows].reverse().map((r) => r.figures.net) },
              ]}
            />
          </Card>

          <Card size="sm" className="mt-4 min-w-0">
            <CardHeader>
              <CardTitle><Titled title="Month by month" demo={demo} /></CardTitle>
            </CardHeader>
            <CardContent>
              <Table stack="cols">
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Refunds</TableHead>
                    <TableHead className="text-right">GP fees</TableHead>
                    <TableHead className="text-right">Net revenue</TableHead>
                    <TableHead className="text-right">Take rate</TableHead>
                    <TableHead className="text-right">Completed</TableHead>
                    <TableHead className="text-right">Avg price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.rows.map((r) => <LedgerLine key={r.key} label={`${bucketLabel(r.key)}${r.toDate ? ' (so far)' : ''}`} f={r.figures} />)}
                </TableBody>
                <TableFooter>
                  <LedgerLine label="Twelve months" f={ledger.total} />
                  <LedgerLine label={`${ledger.year} to date`} f={ledger.ytd} />
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}

function LedgerLine({ label, f }: { label: string; f: Figures }) {
  return (
    <TableRow>
      <th scope="row" className="px-3 py-2 text-left font-semibold whitespace-nowrap">{label}</th>
      <TableCell data-label="Gross" className="text-right tabular-nums">{gbp(f.gmv)}</TableCell>
      <TableCell data-label="Refunds" className="text-right tabular-nums">{gbp(f.refunds)}</TableCell>
      <TableCell data-label="GP fees" className="text-right tabular-nums">{gbp(f.gpFees)}</TableCell>
      <TableCell data-label="Net" className="text-right font-semibold tabular-nums">{gbp(f.net)}</TableCell>
      <TableCell data-label="Take rate" className="text-right tabular-nums">{fmtPct(f.takeRate)}</TableCell>
      <TableCell data-label="Completed" className="text-right tabular-nums">{fmtCount(f.completed)}</TableCell>
      <TableCell data-label="Avg price" className="text-right tabular-nums">{price(f.avgPrice)}</TableCell>
    </TableRow>
  );
}
