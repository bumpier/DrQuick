import type { Metadata } from 'next';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { PasswordForm, ProfileForm } from '@/components/doctor/ProfileForms';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireDoctor } from '@/lib/doctor-auth';
import { PASSWORD_MIN } from '@/lib/doctor/account';

export const metadata: Metadata = { title: 'Profile' };

export default async function ProfilePage() {
  const doctor = await requireDoctor();
  return (
    <>
      <AdminPageHeader title="Profile" />
      <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start gap-4 max-forms:grid-cols-1">
        <Card>
          <CardHeader><CardTitle>Your details</CardTitle></CardHeader>
          <CardContent>
            <ProfileForm initial={{ name: doctor.name, mobile: doctor.mobile ?? '', bio: doctor.bio, languages: doctor.languages }} />
          </CardContent>
        </Card>
        <div className="grid min-w-0 gap-4">
          <Card size="sm">
            <CardHeader>
              <CardTitle>Sign-in and registration</CardTitle>
              <CardDescription>To change either of these, contact the team.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3">
                <div>
                  <dt className="text-fine font-semibold text-ink-2">Email</dt>
                  <dd className="break-all">{doctor.email}</dd>
                </div>
                <div>
                  <dt className="text-fine font-semibold text-ink-2">GMC number</dt>
                  <dd className="tabular-nums">{doctor.gmc}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardHeader><CardTitle>Password</CardTitle></CardHeader>
            <CardContent><PasswordForm minLength={PASSWORD_MIN} /></CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
