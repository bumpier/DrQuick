'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CommissionLadder } from '@/components/CommissionLadder';
import { GpSignupForm, type GpSignupSource } from '@/components/GpSignupForm';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { COMMISSION_TIERS, gpSharePercent } from '@/lib/finance/commission';

const SOURCES: readonly GpSignupSource[] = ['hero-gp', 'recap-gp', 'nav-gp'];

// What the forest panel says besides the ladder. Each line is already on the
// page in a fuller form (GP_FAQ, GP_COVERS); this is the short version.
const POINTS = [
  'No minimum hours and no rota',
  'Your NHS and locum work carries on',
  'What each consultation pays, shown before you accept',
];

const FIRST_FIELD = 'gp-name';

const CANCELLED ='Your payment wasn’t completed, so nothing was taken. Enter your details to try again.';

// The GP sign-up pop-up. Always opened by the reader: a click on anything
// carrying `data-gp-signup` (the hero, the closing band, the nav), or a link to
// #gp-join from another page or from Stripe's "back" arrow. Never on a timer,
// on scroll or on leaving.
//
// Two cells, like the page's bento: the forest one carries what a GP keeps (the
// payoff), the white one carries the ask (four fields, the fee, one button).
// The fee and its refund promise sit directly above the button, so the price is
// read at the moment of deciding. Paying happens on Stripe's page; this pop-up
// never sees a card.
export function GpSignupDialog() {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<GpSignupSource>('hero-gp');
  const [notice, setNotice] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const trigger = (e.target as Element | null)?.closest?.('[data-gp-signup]');
      if (!trigger) return;
      e.preventDefault();
      const from = trigger.getAttribute('data-gp-signup') as GpSignupSource;
      setSource(SOURCES.includes(from) ? from : 'hero-gp');
      setNotice(null);
      setOpen(true);
    };
    // A link to #gp-join is a request for the sign-up: from another page's
    // button, or coming back from Stripe without paying.
    const fromHash = () => {
      if (location.hash !== '#gp-join') return;
      const cancelled = new URLSearchParams(location.search).get('checkout') === 'cancelled';
      setSource('link-gp');
      setNotice(cancelled ? CANCELLED : null);
      setOpen(true);
    };
    document.addEventListener('click', onClick);
    window.addEventListener('hashchange', fromHash);
    fromHash();
    return () => {
      document.removeEventListener('click', onClick);
      window.removeEventListener('hashchange', fromHash);
    };
  }, []);

  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (next) return;
    // Closing takes the request out of the address, so a refresh does not
    // reopen the pop-up. The role in the query string is kept.
    try {
      const url = new URL(location.href);
      if (url.hash !== '#gp-join' && !url.searchParams.has('checkout')) return;
      url.searchParams.delete('checkout');
      history.replaceState(null, '', `${url.pathname}${url.search}`);
    } catch {}
  }, []);

  const [start, , top] = COMMISSION_TIERS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={contentRef}
        showCloseButton={false}
        data-gp-signup-dialog=""
        // Focus goes to the first field, not the close mark that precedes it.
        // On a phone the field's keyboard would cover the fee and the offer
        // before either had been read, so there the panel itself takes it.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          const phone = window.matchMedia?.('(max-width: 899px)').matches;
          (phone ? contentRef.current : document.getElementById(FIRST_FIELD) ?? contentRef.current)?.focus();
        }}
        className="max-h-[calc(100dvh-1.5rem)] max-w-[calc(100%-1.5rem)] grid-cols-1 gap-0 overflow-y-auto rounded-2xl p-0 sm:max-w-[34rem] md:max-w-[60rem] md:grid-cols-[minmax(0,.8fr)_minmax(0,1fr)]"
      >
        {/* A zero-height sticky row, so the close mark stays in reach while a
            phone scrolls the form under it. */}
        <div className="sticky top-0 z-10 col-span-full h-0">
          <DialogClose
            className="absolute top-3 right-3 grid size-10 cursor-pointer place-items-center rounded-pill bg-white text-ink shadow-card transition-colors duration-160 ease-(--ease) hover:bg-surface-mid"
            aria-label="Close sign-up"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="2.3" fill="none" strokeLinecap="round" />
            </svg>
          </DialogClose>
        </div>

        <div className="band-grid flex flex-col gap-5 bg-band px-6 pt-6 pb-5 text-white md:gap-8 md:p-10">
          <div>
            {/* Clear of the close button, which sits over this cell on a phone. */}
            <p className="max-w-[13ch] pr-10 font-display text-headline-sm font-extrabold md:pr-0 md:text-headline">
              Keep {gpSharePercent(start)}% of every consultation.
            </p>
            <p className="mt-3 hidden text-body text-band-ink-2 md:block">
              Your share of the price the patient pays, rising to {gpSharePercent(top)}% with the consultations you complete.
            </p>
          </div>
          <ul className="hidden gap-3 text-body md:grid">
            {POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <svg width="20" height="20" className="mt-0.5 shrink-0 text-primary" aria-hidden="true"><use href="#i-yes" /></svg>
                {point}
              </li>
            ))}
          </ul>
          {/* The steps stand on the floor of the cell. */}
          <CommissionLadder size="panel" className="md:mt-auto" />
        </div>

        <div className="p-6 md:p-10">
          <ol className="flex items-center gap-2 text-fine font-bold" aria-label="Sign-up steps">
            <li aria-current="step" className="rounded-pill bg-primary px-3 py-1.5 text-ink">1. Your details</li>
            <li className="rounded-pill bg-fill px-3 py-1.5 text-ink-2">2. Payment</li>
          </ol>
          <DialogTitle className="mt-5 font-display text-headline-sm font-extrabold md:text-headline">Sign up as a GP</DialogTitle>
          <DialogDescription className="mt-2 text-body text-ink-2">
            Four details, then one payment on Stripe’s secure page.
          </DialogDescription>
          {notice && (
            <p className="mt-5 rounded-lg bg-surface-mid px-4 py-3 text-fine font-semibold text-ink" data-notice="">{notice}</p>
          )}
          <GpSignupForm source={source} inputId={FIRST_FIELD} />
        </div>

      </DialogContent>
    </Dialog>
  );
}
