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

export const metadata: Metadata = { title: 'Patient' };

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const back = { href: '/admin/waitlist/patients', label: 'All patients' };
  const db = await getDb();
  if (!db) return <><AdminPageHeader title="Patient" back={back} /><NoDatabase /></>;

  const signup = await getSignup(db, id, 'patient');
  if (!signup) notFound();
  const [emails, journey] = await Promise.all([emailHistory(db, signup.id), visitorJourney(db, signup.visitorId)]);

  return (
    <>
      <AdminPageHeader title={signup.email} description="A patient on the waitlist." back={back} />
      <SignupDetail signup={signup} emails={emails} journey={journey} ownHost={hostOf(siteUrl().toString())} />
    </>
  );
}
