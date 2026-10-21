import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/admin-auth';

// /admin/waitlist has no page of its own; the patient list is its first section.
export default async function WaitlistIndex() {
  await requireAdmin('waitlist');
  redirect('/admin/waitlist/patients');
}
