import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { requireAdmin } from '@/lib/admin-auth';

export const metadata: Metadata = { title: 'Not part of your role' };

// Where a page outside your role sends you. Every role reaches the overview,
// so this guard cannot send anyone round in a circle.
export default async function NoAccessPage() {
  await requireAdmin('overview');
  return (
    <>
      <AdminPageHeader
        title="Not part of your role"
        description="This section is not part of your role. Ask an Admin if you need it."
      />
      <Link href="/admin" className="font-semibold text-ink underline underline-offset-4">Back to the overview</Link>
    </>
  );
}
