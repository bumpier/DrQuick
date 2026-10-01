import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Wordmark } from '@/components/Wordmark';
import { currentDoctor } from '@/lib/doctor-auth';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage() {
  if (await currentDoctor()) redirect('/doctor');
  return (
    <main className="grid min-h-svh place-items-center px-4 py-10">
      <div className="w-full max-w-[420px] rounded-2xl bg-white p-10 shadow-card max-phone:p-7">
        <Wordmark className="text-2xl" />
        <h1 className="mt-8 text-headline max-phone:text-headline-sm">Doctor sign in</h1>
        <p className="mt-2 mb-8 text-body text-ink-2">For GPs who consult with Dr Quick.</p>
        <LoginForm />
        <p className="mt-6 text-body text-ink-2">
          First time here, or forgotten your password?{' '}
          <Link href="/doctor/register" className="font-semibold text-primary-ink">Get a sign-in link</Link>
        </p>
      </div>
    </main>
  );
}
