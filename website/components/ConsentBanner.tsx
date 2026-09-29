'use client';

// The analytics cookie choice (UK PECR). A forest bar fixed to the bottom of
// the public pages, shown until the visitor chooses and again whenever they
// press "Cookie settings" in the footer. Decline sits beside Accept at the same
// size and weight: refusing must be as easy as agreeing. Until a choice is
// made, only anonymous pageviews are counted (lib/analytics/track.ts).
//
// It renders after hydration, fixed over the page, so it never moves the
// forms; a spacer of its own height keeps the footer (and its 999 link)
// scrollable clear of it. Hidden on the admin, the prototypes, /dev and inside
// the admin's heatmap iframe. A browser sending Global Privacy Control or Do
// Not Track is not asked: that signal already says no.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  OPEN_CONSENT_EVENT, isHeatmapView, isTrackedPath, openConsentSettings, privacySignal, readConsent, setConsent,
} from '@/lib/analytics/track';

export function ConsentBanner() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isHeatmapView()) return;
    // Reading the cookie can only happen in the browser, after hydration.
    if (readConsent() === null && !privacySignal()) setOpen(true);
    const show = () => setOpen(true);
    window.addEventListener(OPEN_CONSENT_EVENT, show);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, show);
  }, []);

  useEffect(() => {
    const bar = barRef.current;
    if (!open || !bar || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setHeight(bar.offsetHeight));
    ro.observe(bar);
    return () => ro.disconnect();
  }, [open, pathname]);

  if (!open || !isTrackedPath(pathname)) return null;

  const choose = (choice: 'granted' | 'denied') => {
    setConsent(choice);
    setOpen(false);
  };

  return (
    <>
      <div aria-hidden="true" style={{ height }} />
      <div
        ref={barRef}
        role="region"
        aria-label="Cookie choice"
        className="fixed inset-x-0 bottom-0 z-30 bg-band text-white shadow-pop"
      >
        <div className="wrap flex items-center gap-x-8 gap-y-3 py-4 max-cols:flex-col max-cols:items-stretch">
          <p className="flex-1 text-fine text-band-ink-2">
            <span className="font-semibold text-white">Can we use analytics cookies?</span>{' '}
            They show us which parts of the site help people, and stay with Dr Quick.{' '}
            <Link href="/privacy" className="font-semibold text-primary underline underline-offset-2">Privacy notice</Link>
          </p>
          <div className="flex gap-3 max-cols:grid max-cols:grid-cols-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => choose('denied')}>Decline</Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => choose('granted')}>Accept analytics</Button>
          </div>
        </div>
      </div>
    </>
  );
}

// The footer's way back to the choice, on every public page.
export function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={openConsentSettings}>
      Cookie settings
    </button>
  );
}
