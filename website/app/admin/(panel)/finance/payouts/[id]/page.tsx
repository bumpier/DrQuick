import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AdminPageHeader, NoDatabase } from '@/components/admin/AdminPageHeader';
import { ConsultationTable } from '@/components/admin/ConsultationTable';
import { DemoBanner, Titled } from '@/components/admin/DemoMode';
import { PayoutBadge, periodLabel } from '@/components/admin/FinanceBadges';
import { Kpi, KpiRow } from '@/components/admin/Kpi';
import { DemoBadge } from '@/components/admin/DemoBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireAdmin } from '@/lib/admin-auth';
import { fmtCount, fmtDate } from '@/lib/admin/format';
import { dbSource, isDemo } from '@/lib/admin/queries/finance';
import { withQuery } from '@/lib/admin/url';
import { getDb } from '@/lib/db';
import { demoSource } from '@/lib/finance/demo';
import { gbp } from '@/lib/money';

export const metadata: Metadata = { title: 'Payout' };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PayoutPage({ params, searchParams }: Props) {
  await requireAdmin();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const demo = isDemo(query);
  const back = { href: withQuery('/admin/finance/payouts', { demo: demo ? '1' : undefined }), label: 'Payouts' };
  const db = await getDb();
  if (!db && !demo) return <><AdminPageHeader title="Payout" back={back} /><NoDatabase /></>;
  const source = demo ? demoSource() : dbSource(db!);

  const found = await source.payout(id);
  if (!found) notFound();
  const { payout, consultations } = found;
  const fees = consultations.reduce((s, c) => s + (c.status === 'completed' ? c.gpFeePence : 0), 0);
  const badge = demo ? <DemoBadge /> : undefined;

  return (
    <>
      <AdminPageHeader
        title={`${payout.gpName}, ${periodLabel(payout)}`}
        description="One GP's fees for the completed consultations paid for in this period."
        back={back}
        actions={<PayoutBadge status={payout.status} />}
      />
      {demo && <DemoBanner />}
      <KpiRow>
        <Kpi label="Amount" value={gbp(payout.amountPence)}
          note={fees === payout.amountPence ? 'Matches the fees below' : `The fees below add up to ${gbp(fees)}`}>{badge}</Kpi>
        <Kpi label="Consultations" value={fmtCount(consultations.length)}>{badge}</Kpi>
        <Kpi label="Paid" value={payout.paidAt ? fmtDate(payout.paidAt) : 'Not yet'}
          note={payout.status === 'failed' ? 'The transfer did not arrive' : undefined}>{badge}</Kpi>
      </KpiRow>
      <Card size="sm" className="mt-4 min-w-0">
        <CardHeader><CardTitle><Titled title="Consultations in this payout" demo={demo} /></CardTitle></CardHeader>
        <CardContent><ConsultationTable rows={consultations} /></CardContent>
      </Card>
    </>
  );
}
