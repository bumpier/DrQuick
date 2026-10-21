import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Wordmark } from '@/components/Wordmark';
import { demoMode } from '@/lib/demo';
import { safeNext } from '@/lib/demo/session';
import { DemoAccessForm } from './DemoAccessForm';

// The demo deployment's passcode page (lib/demo/session.ts): the one page of
// demo.drquick.co.uk that opens without the session (proxy.ts). A 404 wherever
// the demo is not running, so the real site has no such page.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Dr Quick — demo',
  robots: { index: false, follow: false },
};

export default async function DemoAccessPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!demoMode()) notFound();
  const { next } = await searchParams;
  return (
    <main className="grid min-h-svh place-items-center px-4 py-10">
      <div className="w-full max-w-[420px] rounded-2xl bg-white p-10 shadow-card max-phone:p-7">
        <Wordmark className="text-2xl" />
        <h1 className="mt-8 mb-8 text-headline max-phone:text-headline-sm">Demo</h1>
        <DemoAccessForm next={safeNext(next)} />
      </div>
    </main>
  );
}
