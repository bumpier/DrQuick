import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Wordmark } from '@/components/Wordmark';
import { currentAdmin } from '@/lib/admin-auth';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage() {
  if (await currentAdmin()) redirect('/admin/blog');
  return (
    <main className="grid min-h-svh place-items-center px-4 py-10">
      <div className="w-full max-w-[420px] rounded-2xl bg-white p-10 shadow-card max-phone:p-7">
        <Wordmark className="text-2xl" />
        <h1 className="mt-8 text-headline max-phone:text-headline-sm">Admin sign in</h1>
        <p className="mt-2 mb-8 text-body text-ink-2">For the Dr Quick team, to write and publish the blog.</p>
        <LoginForm />
      </div>
    </main>
  );
}
