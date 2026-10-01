import type { Metadata } from 'next';
import { AdminPageHeader, NoDatabase } from '@/components/admin/AdminPageHeader';
import { Pagination } from '@/components/admin/DataTable';
import { Kpi, KpiRow } from '@/components/admin/Kpi';
import { EmptyState } from '@/components/app/EmptyState';
import { MyConsultationsTable, MyPayoutsTable } from '@/components/doctor/EarningsTables';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { fmtCount } from '@/lib/admin/format';
import { flatParams } from '@/lib/admin/url';
import { getDb } from '@/lib/db';
import { requireDoctor } from '@/lib/doctor-auth';
import { PAGE_SIZE, earningsSummary, myConsultations, myPayouts } from '@/lib/doctor/queries/earnings';
import { gpSharePercent, nextTier, tierFor } from '@/lib/finance/commission';
import { gbp } from '@/lib/money';

export const metadata: Metadata = { title: 'Earnings' };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
const BASE = '/doctor/earnings';

export default async function EarningsPage({ searchParams }: Props) {
  const doctor = await requireDoctor();
  const query = flatParams(await searchParams);
  const page = Math.max(1, Math.floor(Number(query.page)) || 1);

  const header = (
    <AdminPageHeader
      title="Earnings"
      description="A fee is yours once a consultation is completed and the patient’s payment has gone through. Payouts are sent by the team; this page shows where each one is."
    />
  );
  const db = await getDb();
  if (!db) return <>{header}<NoDatabase /></>;

  const now = new Date();
  const [summary, consultations, payouts] = await Promise.all([
    earningsSummary(db, doctor.id, now), myConsultations(db, doctor.id, page), myPayouts(db, doctor.id, 1),
  ]);
  const month = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' }).format(now);

  // Where the doctor stands on the commission ladder (lib/finance/commission.ts).
  const tier = tierFor(summary.completed);
  const next = nextTier(summary.completed);
  const progress = next ? Math.round(((summary.completed - tier.from) / (next.tier.from - tier.from)) * 100) : 100;

  return (
    <>
      {header}

      <KpiRow className="grid-cols-4 max-forms:grid-cols-2">
        <Kpi label="Awaiting payout" value={gbp(summary.awaitingPayout)} note="Earned, not yet in a payout" />
        <Kpi label="In a payout" value={gbp(summary.inPayout)} note="On its way to you" />
        <Kpi label="Paid to date" value={gbp(summary.paidToDate)} />
        <Kpi
          label={`Earned in ${month}`}
          value={gbp(summary.earnedThisMonth)}
          note={`${fmtCount(summary.consultsThisMonth)} ${summary.consultsThisMonth === 1 ? 'consultation' : 'consultations'}`}
        />
      </KpiRow>

      <Card size="sm" className="mt-4">
        <CardHeader>
          <CardTitle>You keep {gpSharePercent(tier)}% of each consultation</CardTitle>
          <CardDescription>
            {next
              ? `${fmtCount(summary.completed)} completed. ${fmtCount(next.remaining)} more and you keep ${gpSharePercent(next.tier)}%.`
              : `${fmtCount(summary.completed)} completed. This is the top rate.`}
          </CardDescription>
        </CardHeader>
        {next && (
          <CardContent>
            {/* No getValueLabel: a function cannot cross from this server component to the client one. */}
            <Progress
              value={progress}
              aria-label={`${fmtCount(summary.completed)} of ${fmtCount(next.tier.from)} completed consultations towards ${gpSharePercent(next.tier)}%`}
            />
          </CardContent>
        )}
      </Card>

      <h2 className="mt-8 mb-3 text-xl font-bold">Payouts</h2>
      {payouts.rows.length === 0
        ? <EmptyState>No payouts yet.</EmptyState>
        : <Card size="sm"><CardContent><MyPayoutsTable rows={payouts.rows} /></CardContent></Card>}

      <h2 className="mt-8 mb-3 text-xl font-bold">Consultations</h2>
      {consultations.total === 0 ? <EmptyState>No consultations yet.</EmptyState> : (
        <>
          <Card size="sm"><CardContent><MyConsultationsTable rows={consultations.rows} /></CardContent></Card>
          <Pagination
            page={consultations.page} pages={consultations.pages} total={consultations.total} pageSize={PAGE_SIZE}
            basePath={BASE} query={query} noun={['consultation', 'consultations']}
          />
        </>
      )}
    </>
  );
}
