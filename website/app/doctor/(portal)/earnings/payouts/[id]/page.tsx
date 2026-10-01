import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AdminPageHeader, NoDatabase } from '@/components/admin/AdminPageHeader';
import { PayoutBadge, periodLabel } from '@/components/admin/FinanceBadges';
import { Kpi, KpiRow } from '@/components/admin/Kpi';
import { EmptyState } from '@/components/app/EmptyState';
import { MyConsultationsTable } from '@/components/doctor/EarningsTables';
import { Card, CardContent } from '@/components/ui/card';
import { fmtCount, fmtDate } from '@/lib/admin/format';
import { getDb } from '@/lib/db';
import { requireDoctor } from '@/lib/doctor-auth';
import { myPayout } from '@/lib/doctor/queries/earnings';
import { gbp } from '@/lib/money';

export const metadata: Metadata = { title: 'Payout' };

const back = { href: '/doctor/earnings', label: 'Earnings' };

// One payout and the consultations it pays for. Another doctor's payout, or an
// id that is not one, is simply not found.
export default async function PayoutPage({ params }: { params: Promise<{ id: string }> }) {
  const doctor = await requireDoctor();
  const { id } = await params;
  const db = await getDb();
  if (!db) return <><AdminPageHeader title="Payout" back={back} /><NoDatabase /></>;

  const found = await myPayout(db, doctor.id, id);
  if (!found) notFound();
  const { payout, consultations } = found;

  return (
    <>
      <AdminPageHeader title={periodLabel(payout)} description="The consultations this payout covers." back={back} />
      <KpiRow>
        <Kpi label="Amount" value={gbp(payout.amountPence)} />
        <Kpi label="Status" value={payout.paidAt ? `Paid ${fmtDate(payout.paidAt)}` : 'Not yet paid'}>
          <PayoutBadge status={payout.status} />
        </Kpi>
        <Kpi label="Consultations" value={fmtCount(consultations.length)} />
      </KpiRow>
      <div className="mt-4">
        {consultations.length === 0
          ? <EmptyState>No consultations are recorded against this payout.</EmptyState>
          : <Card size="sm"><CardContent><MyConsultationsTable rows={consultations} /></CardContent></Card>}
      </div>
    </>
  );
}
