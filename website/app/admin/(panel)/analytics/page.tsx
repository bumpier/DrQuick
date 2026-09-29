import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin-auth';

// /admin/analytics has no page of its own; Traffic is its front door.
export default async function AnalyticsIndex() {
  await requireAdmin();
  redirect('/admin/analytics/traffic');
}
