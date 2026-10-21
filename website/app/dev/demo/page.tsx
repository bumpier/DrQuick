import { notFound } from 'next/navigation';
import { demoDeployment, demoMode } from '@/lib/demo';
import { DemoControls } from './DemoControls';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Dr Quick — demo',
  robots: { index: false, follow: false },
};

// The presenter's console for the investor demo: Reset, the three windows, the
// run sheet. Only while the demo runs (lib/demo.ts demoMode: development with
// NEXT_PUBLIC_DEMO=1, or the demo deployment behind its passcode, proxy.ts);
// /dev/* is noindex as well.
export default function Page() {
  if (!demoMode()) notFound();
  return <DemoControls signOut={demoDeployment()} />;
}
