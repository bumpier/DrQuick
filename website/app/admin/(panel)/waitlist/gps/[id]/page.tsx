import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AdminPageHeader, NoDatabase } from '@/components/admin/AdminPageHeader';
import { SignupDetail } from '@/components/admin/SignupDetail';
import { requireAdmin } from '@/lib/admin-auth';
import { hostOf } from '@/lib/admin/format';
import { visitorJourney } from '@/lib/admin/queries/journey';
import { emailHistory, getSignup } from '@/lib/admin/queries/waitlist';
import { getDb } from '@/lib/db';
import { siteUrl } from '@/lib/site-url';

export const metadata: Metadata = { title: 'GP application' };

export default async function GpPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const back = { href: '/admin/waitlist/gps', label: 'All GP applications' };
  const db = await getDb();
  if (!db) return <><AdminPageHeader title="GP application" back={back} /><NoDatabase /></>;

  const signup = await getSignup(db, id, 'gp');
  if (!signup) notFound();
  const [emails, journey] = await Promise.all([emailHistory(db, signup.id), visitorJourney(db, signup.visitorId)]);

  return (
    <>
      <AdminPageHeader
        title={signup.name || signup.email}
        description="A GP who applied to join. Check their GMC registration, then move them along the pipeline."
        back={back}
      />
      <SignupDetail signup={signup} emails={emails} journey={journey} ownHost={hostOf(siteUrl().toString())} />
    </>
  );
}
