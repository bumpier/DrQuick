import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';

// The admin is never indexed: the X-Robots-Tag header in next.config.ts covers
// /admin/*, and this is the second lock. Every admin page renders per request,
// because each one checks the session.
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · Dr Quick admin' },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div data-admin className="min-h-svh bg-surface">
      {children}
      <Toaster />
    </div>
  );
}
