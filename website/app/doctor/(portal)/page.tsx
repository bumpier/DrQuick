import type { Metadata } from 'next';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { Kpi, KpiRow } from '@/components/admin/Kpi';
import { ShiftPanel } from '@/components/doctor/ShiftPanel';
import { fmtCount } from '@/lib/admin/format';
import { getDb } from '@/lib/db';
import { requireDoctor } from '@/lib/doctor-auth';
import { earningsSummary, todaysWork } from '@/lib/doctor/queries/earnings';
import { gbp } from '@/lib/money';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const doctor = await requireDoctor();
  const db = await getDb();
  const now = new Date();
  const [today, summary] = db
    ? await Promise.all([todaysWork(db, doctor.id, now), earningsSummary(db, doctor.id, now)])
    : [null, null];

  return (
    <>
      <AdminPageHeader title={`Hello, ${doctor.name}`} />
      <ShiftPanel />
      {today && summary && (
        <KpiRow className="mt-4">
          <Kpi label="Completed today" value={fmtCount(today.consultations)} />
          <Kpi label="Earned today" value={gbp(today.earnedPence)} />
          <Kpi label="Awaiting payout" value={gbp(summary.awaitingPayout)} />
        </KpiRow>
      )}
    </>
  );
}
