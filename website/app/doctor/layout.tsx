import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';

// The doctor portal is never indexed: the X-Robots-Tag header in next.config.ts
// covers /doctor/*, and this is the second lock. Every page renders per
// request, because each one checks the session.
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: { default: 'Doctor portal', template: '%s · Dr Quick doctors' },
  robots: { index: false, follow: false },
};

export default function DoctorLayout({ children }: { children: ReactNode }) {
  return (
    <div data-doctor className="min-h-svh bg-surface">
      {children}
      <Toaster />
    </div>
  );
}
