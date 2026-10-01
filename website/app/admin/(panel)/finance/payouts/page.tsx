import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState } from '@/components/app/EmptyState';
import { AdminPageHeader, NoDatabase } from '@/components/admin/AdminPageHeader';
import { Pagination, SortHeader } from '@/components/admin/DataTable';
import { DemoBadge } from '@/components/admin/DemoBadge';
import { DemoBanner, DemoToggle, NOT_LIVE, Titled } from '@/components/admin/DemoMode';
import { PayoutBadge, periodLabel } from '@/components/admin/FinanceBadges';
import { Kpi, KpiRow } from '@/components/admin/Kpi';
import { QuerySelect } from '@/components/admin/QuerySelect';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { requireAdmin } from '@/lib/admin-auth';
import { fmtCount, fmtDate } from '@/lib/admin/format';
import { dbSource, isDemo, parsePayoutQuery } from '@/lib/admin/queries/finance';
import { flatParams, withQuery } from '@/lib/admin/url';
import { getDb } from '@/lib/db';
import { COMMISSION_TIERS, gpSharePercent, nextTier, tierFor } from '@/lib/finance/commission';
import { demoSource } from '@/lib/finance/demo';
import { PAYOUT_STATUSES, PAYOUT_STATUS_LABELS } from '@/lib/finance/model';
import { gbp } from '@/lib/money';

export const metadata: Metadata = { title: 'Payouts' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const BASE = '/admin/finance/payouts';

const NOTES: Record<string, string> = {
  pending: 'Earned, not yet sent',
  processing: 'Sent, on its way to the GP',
  paid: 'Arrived with the GP',
  failed: 'Did not arrive — needs a look',
};

// The commission rule in a sentence, and where one GP stands on it. Both read
// lib/finance/commission.ts, the rule consultations are split by.
const TIER_RULE = COMMISSION_TIERS
  .map((t) => (t.from === 0 ? `${gpSharePercent(t)}% to start` : `${gpSharePercent(t)}% after ${fmtCount(t.from)} completed`))
  .join(', ');

function shareNote(served: number): string {
  const next = nextTier(served);
  const done = `${fmtCount(served)} completed`;
  return next ? `${done}, ${fmtCount(next.remaining)} to ${gpSharePercent(next.tier)}%` : `${done}, top rate`;
}

export default async function PayoutsPage({ searchParams }: Props) {
  await requireAdmin();
  const now = new Date();
  const params = await searchParams;
  const query = flatParams(params);
  const demo = isDemo(params);

  const header = (
    <AdminPageHeader
      title="Payouts"
      description="What GPs are owed and have been paid. A payout is one GP's fees for the completed consultations in its period. Payouts are sent through Stripe once payments are live; this page shows their status only."
      actions={<DemoToggle basePath={BASE} query={query} demo={demo} />}
    />
  );
  const db = await getDb();
  if (!db && !demo) return <>{header}<NoDatabase /></>;
  const source = demo ? demoSource(now) : dbSource(db!);

  const list = parsePayoutQuery(params);
  const [totals, result, summary, gps] = await Promise.all([
    source.payoutTotals(), source.payouts(list), source.gpSummary(now), source.gps(),
  ]);
  const filtered = Boolean(list.status || list.gp);
  const sortProps = { basePath: BASE, query: { ...query, sort: list.sort } };
  const shown = summary.filter((g) => g.earnedThisMonth || g.pending || g.paidToDate);
  const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' }).format(now);

  return (
    <>
      {header}
      {demo && <DemoBanner />}

      <KpiRow className="grid-cols-4 max-forms:grid-cols-2">
        {PAYOUT_STATUSES.map((s) => (
          <Kpi key={s} label={PAYOUT_STATUS_LABELS[s]} value={gbp(totals[s].pence)}
            note={`${fmtCount(totals[s].count)} ${totals[s].count === 1 ? 'payout' : 'payouts'} · ${NOTES[s]}`}>
            {demo ? <DemoBadge /> : undefined}
          </Kpi>
        ))}
      </KpiRow>

      <Card size="sm" className="mt-4 min-w-0">
        <CardHeader>
          <CardTitle><Titled title="By GP" demo={demo} /></CardTitle>
          <p className="text-fine text-ink-2">
            Earned in {monthName} is the fees for completed consultations paid for this month (UTC).
            Their share is what the GP keeps of each consultation now: {TIER_RULE}.
          </p>
        </CardHeader>
        <CardContent>
          {shown.length === 0 ? <EmptyState>{NOT_LIVE}</EmptyState> : (
            <Table stack="cols">
              <TableHeader>
                <TableRow>
                  <TableHead>GP</TableHead>
                  <TableHead className="text-right">Earned in {monthName}</TableHead>
                  <TableHead className="text-right">Consultations</TableHead>
                  <TableHead className="text-right">Their share</TableHead>
                  <TableHead className="text-right">Owed (pending or processing)</TableHead>
                  <TableHead className="text-right">Paid to date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((g) => (
                  <TableRow key={g.gpId}>
                    <th scope="row" className="px-3 py-2 text-left font-semibold">
                      <Link href={withQuery(BASE, query, { gp: g.gpId, page: null })} className="text-ink no-underline hover:underline">{g.name}</Link>
                    </th>
                    <TableCell data-label="Earned" className="text-right tabular-nums">{gbp(g.earnedThisMonth)}</TableCell>
                    <TableCell data-label="Consultations" className="text-right tabular-nums">{fmtCount(g.consultsThisMonth)}</TableCell>
                    <TableCell data-label="Their share" className="text-right tabular-nums">
                      {gpSharePercent(tierFor(g.servedToDate))}%
                      <span className="block text-fine text-ink-2">{shareNote(g.servedToDate)}</span>
                    </TableCell>
                    <TableCell data-label="Owed" className="text-right tabular-nums">{gbp(g.pending)}</TableCell>
                    <TableCell data-label="Paid to date" className="text-right tabular-nums">{gbp(g.paidToDate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <h2 className="mt-8 mb-3 text-xl font-bold"><Titled title="Every payout" demo={demo} /></h2>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <QuerySelect label="Status" name="status" value={list.status ?? null} basePath={BASE} query={query} allLabel="All" clear={['page']}
          options={PAYOUT_STATUSES.map((s) => ({ value: s, label: PAYOUT_STATUS_LABELS[s] }))} />
        <QuerySelect label="GP" name="gp" value={list.gp ?? null} basePath={BASE} query={query} allLabel="All GPs" clear={['page']}
          options={gps.map((g) => ({ value: g.id, label: g.name }))} />
        {filtered && (
          <Link href={withQuery(BASE, query, { status: null, gp: null, page: null })} className="inline-flex h-12 items-center text-fine font-semibold text-primary-ink">
            Clear filters
          </Link>
        )}
      </div>
      <Card className="block px-4 py-3 max-phone:px-2">
        {result.total === 0 ? (
          <EmptyState className="my-2">{filtered ? 'No payouts match these filters.' : NOT_LIVE}</EmptyState>
        ) : (
          <Table stack="cols">
            <TableHeader>
              <TableRow>
                <SortHeader label="GP" column="gp" {...sortProps} />
                <SortHeader label="Period" column="period" defaultDir="desc" {...sortProps} />
                <SortHeader label="Amount" column="amount" defaultDir="desc" className="text-right" {...sortProps} />
                <TableHead>Status</TableHead>
                <SortHeader label="Paid" column="paid" defaultDir="desc" {...sortProps} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell data-label="GP" className="whitespace-normal">
                    <Link href={withQuery(`${BASE}/${p.id}`, { demo: demo ? '1' : undefined })} className="font-semibold text-primary-ink">
                      {p.gpName}
                    </Link>
                  </TableCell>
                  <TableCell data-label="Period" className="tabular-nums">{periodLabel(p)}</TableCell>
                  <TableCell data-label="Amount" className="text-right tabular-nums">
                    {gbp(p.amountPence)}
                    <span className="block text-fine text-ink-2">{fmtCount(p.consultations)} {p.consultations === 1 ? 'consultation' : 'consultations'}</span>
                  </TableCell>
                  <TableCell data-label="Status"><PayoutBadge status={p.status} /></TableCell>
                  <TableCell data-label="Paid" className="tabular-nums text-ink-2">{p.paidAt ? fmtDate(p.paidAt) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <Pagination page={result.page} pages={result.pages} total={result.total} pageSize={list.pageSize}
        basePath={BASE} query={query} noun={['payout', 'payouts']} />
    </>
  );
}
