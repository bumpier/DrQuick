import type { Metadata } from 'next';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { Kpi, KpiRow } from '@/components/admin/Kpi';
import { ShiftPanel } from '@/components/doctor/ShiftPanel';
import { fmtCount } from '@/lib/admin/format';
import { getDb } from '@/lib/db';
import { requireDoctor } from '@/lib/doctor-auth';
import { earningsSummary, todaysWork } from '@/lib/doctor/queries/earnings';
import { gbp } from '@/lib/money';
import { formatRating, ratingSummary, ratingsLabel } from '@/lib/ratings';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const doctor = await requireDoctor();
  const db = await getDb();
  const now = new Date();
  const figures = db
    ? await Promise.all([todaysWork(db, doctor.id, now), earningsSummary(db, doctor.id, now), ratingSummary(db, doctor.id)])
    : null;

  return (
    <>
      <AdminPageHeader title={`Hello, ${doctor.name}`} />
      <ShiftPanel />
      {figures && (
        <KpiRow className="mt-4 grid-cols-4 max-forms:grid-cols-2">
          <Kpi label="Completed today" value={fmtCount(figures[0].consultations)} />
          <Kpi label="Earned today" value={gbp(figures[0].earnedPence)} />
          <Kpi label="Awaiting payout" value={gbp(figures[1].awaitingPayout)} />
          <Kpi
            label="Your rating"
            value={figures[2].average === null ? '—' : formatRating(figures[2].average)}
            note={figures[2].count === 0 ? 'No ratings yet' : `Out of 5, from ${ratingsLabel(figures[2].count)}`}
          />
        </KpiRow>
      )}
    </>
  );
}
