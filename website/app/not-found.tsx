import type { Metadata } from 'next';
import Link from 'next/link';
import { Wordmark } from '@/components/Wordmark';

export const metadata: Metadata = { title: 'Page not found' };

// Any address that matches nothing, under any section: the site's own page
// instead of the framework's. No navigation, since it must work from anywhere.
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-svh max-w-[40rem] flex-col items-start justify-center gap-6 px-6 py-16">
      <Link href="/" className="text-2xl no-underline" aria-label="Dr Quick, home"><Wordmark /></Link>
      <h1 className="text-headline">Page not found</h1>
      <p className="text-body text-ink-2">The address may have changed, or it may never have existed.</p>
      <Link href="/" className="font-bold text-primary-ink underline underline-offset-4">Go to the home page</Link>
    </main>
  );
}
