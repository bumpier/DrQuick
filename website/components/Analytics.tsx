'use client';

// Mounted once in the root layout. Starts the first-party tracker
// (lib/analytics/track.ts) for the page's lifetime and turns every app-router
// route change into a pageview. The tracker itself decides what, if anything,
// may be recorded: nothing on the admin, the prototypes or /dev, nothing in the
// heatmap iframe, and only anonymous pageviews without analytics consent.
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { pageview, startTracker } from '@/lib/analytics/track';

export function Analytics() {
  const pathname = usePathname();
  useEffect(() => {
    startTracker();
    pageview(pathname);
  }, [pathname]);
  return null;
}
