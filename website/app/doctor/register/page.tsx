import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Wordmark } from '@/components/Wordmark';
import { currentDoctor } from '@/lib/doctor-auth';
import { LINK_MINUTES } from '@/lib/doctor/account';
import { RegisterForm } from './RegisterForm';

export const metadata: Metadata = { title: 'Get a sign-in link' };

// One page for two jobs: a GP claiming their account for the first time, and a
// doctor who has forgotten their password. Both prove they own the address by
// opening the link it is sent.
export default async function RegisterPage() {
  if (await currentDoctor()) redirect('/doctor');
  return (
    <main className="grid min-h-svh place-items-center px-4 py-10">
      <div className="w-full max-w-[420px] rounded-2xl bg-white p-10 shadow-card max-phone:p-7">
        <Wordmark className="text-2xl" />
        <h1 className="mt-8 text-headline max-phone:text-headline-sm">Get a sign-in link</h1>
        <p className="mt-2 mb-8 text-body text-ink-2">
          Enter the email you signed up with. We will send a link to choose your password.
        </p>
        <RegisterForm minutes={LINK_MINUTES} />
        <p className="mt-6 text-body text-ink-2">
          Already have a password?{' '}
          <Link href="/doctor/login" className="font-semibold text-primary-ink">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
