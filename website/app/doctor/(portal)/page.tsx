import type { Metadata } from 'next';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { requireDoctor } from '@/lib/doctor-auth';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const doctor = await requireDoctor();
  return <AdminPageHeader title={`Hello, ${doctor.name}`} />;
}
