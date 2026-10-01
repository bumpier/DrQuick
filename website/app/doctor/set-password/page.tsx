import type { Metadata } from 'next';
import Link from 'next/link';
import { Wordmark } from '@/components/Wordmark';
import { Button } from '@/components/ui/button';
import { getDb } from '@/lib/db';
import { PASSWORD_MIN, linkIsLive } from '@/lib/doctor/account';
import { SetPasswordForm } from './SetPasswordForm';

export const metadata: Metadata = { title: 'Choose your password' };

// Where the emailed link lands. Opening it changes nothing (mail scanners fetch
// every link in a message); only submitting the form spends the link.
export default async function SetPasswordPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await searchParams).token;
  const token = typeof raw === 'string' ? raw.slice(0, 200) : '';
  const db = await getDb();
  const live = Boolean(db && token && (await linkIsLive(db, token)));

  return (
    <main className="grid min-h-svh place-items-center px-4 py-10">
      <div className="w-full max-w-[420px] rounded-2xl bg-white p-10 shadow-card max-phone:p-7">
        <Wordmark className="text-2xl" />
        {live ? (
          <>
            <h1 className="mt-8 text-headline max-phone:text-headline-sm">Choose your password</h1>
            <p className="mt-2 mb-8 text-body text-ink-2">At least {PASSWORD_MIN} characters.</p>
            <SetPasswordForm token={token} />
          </>
        ) : (
          <>
            <h1 className="mt-8 text-headline max-phone:text-headline-sm">This link has expired</h1>
            <p className="mt-2 mb-8 text-body text-ink-2">
              A link works once and for a limited time. Ask for a new one and it will arrive in a minute.
            </p>
            <Button asChild size="lg" className="w-full">
              <Link href="/doctor/register">Get a new link</Link>
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
