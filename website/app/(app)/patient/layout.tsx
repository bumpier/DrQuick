import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { PatientProviders } from '@/components/patient/PatientProviders';
import { PatientShell } from '@/components/patient/PatientShell';

export const dynamic = 'force-static';

// A prototype of a regulated clinical service must never be indexed: the
// X-Robots-Tag header in next.config.ts covers /patient/*, and this is the
// second lock.
export const metadata: Metadata = {
  title: { default: 'Dr Quick', template: '%s — Dr Quick' },
  robots: { index: false, follow: false },
};

export default function PatientLayout({ children }: { children: ReactNode }) {
  return (
    <PatientProviders>
      <PatientShell>{children}</PatientShell>
    </PatientProviders>
  );
}
