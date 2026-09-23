'use client';

/* The booking reducer, mounted in the patient layout so a request survives a
   trip to the home screen and back. Navigation always goes through the reducer
   and the URL follows it:

   - Follow: when an action moves the screen (`nav` bumps), the URL is
     replaced to match, while the patient is on the booking route. Elsewhere
     (the home screen, the history) the URL is left alone and the state keeps
     running.
   - Sync: when the URL names a different screen (a typed URL, the browser's
     Back, a link), the booking jumps there, unless a consultation is live, in
     which case the URL is put back. A URL can never move money.

   The queue and the call clock tick on wall-clock timestamps through
   useLiveInterval, which pauses while the tab is hidden and catches up on
   return. Nothing rendered reads window, document or Date.now(): every figure
   comes from state, and the clock is null until after mount, so the server
   HTML and the client's first render always agree. */
import {
  createContext, useContext, useEffect, useEffectEvent, useMemo, useReducer, useState, type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useLiveInterval } from '@/hooks/use-live-interval';
import { useDataMode } from '@/lib/data-mode';
import {
  BOOKING_ROOT, bookingHref, bookingReducer, bookingScreenFromPath, initialBooking, isLive,
  type BookingAction, type BookingState,
} from '@/lib/booking-flow';
import { usePatient } from './PatientProvider';

export const READY_TOAST_ID = 'gp-ready';
export const READY_TITLE = 'Your GP is ready — Dr Quick';

type BookingContextValue = {
  state: BookingState;
  act: (action: BookingAction) => void;
  callSeconds: number;
};

const BookingContext = createContext<BookingContextValue | null>(null);

export function BookingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { seeded } = useDataMode();
  const { addRecord, markIdentityChecked, rememberPractice } = usePatient();
  const onBookingRoute = pathname === BOOKING_ROOT || pathname.startsWith(`${BOOKING_ROOT}/`);

  // usePathname() is the concrete prerender path, so the server HTML for
  // /patient/book/quote already shows the quote and the client agrees. The
  // data mode is not known until after mount; it arrives through setMode.
  const [state, dispatch] = useReducer(bookingReducer, null, () =>
    initialBooking(bookingScreenFromPath(pathname), { seeded: false, now: Date.now() }));

  const follow = useEffectEvent(() => {
    if (!onBookingRoute) return;
    const href = bookingHref(state.screen);
    if (pathname !== href) router.replace(href + window.location.search);
  });
  useEffect(() => { if (state.nav > 0) follow(); }, [state.nav]);

  const sync = useEffectEvent(() => {
    const target = bookingScreenFromPath(pathname);
    if (!target || target === state.screen) return;
    if (isLive(state)) router.replace(bookingHref(state.screen) + window.location.search);
    else dispatch({ type: 'jump', screen: target, now: Date.now() });
  });
  useEffect(() => { sync(); }, [pathname]);

  useEffect(() => { dispatch({ type: 'setMode', seeded, now: Date.now() }); }, [seeded]);

  useLiveInterval(
    (now) => dispatch({ type: 'tickQueue', now }),
    1000,
    state.screen === 'finding' && state.queue !== null,
  );

  // The queue's end is a timeout of its own. The tick above pauses while the
  // tab is hidden, but a background tab still fires a timeout, so a patient
  // who has looked away learns of the match when it happens: the tab title
  // changes and a toast waits. The tick carries at least the end time, so a
  // wall clock a millisecond behind the timer cannot leave the queue one
  // second short with nothing left to tick it.
  const queueEnd = state.screen === 'finding' && state.queue !== null
    ? state.queue.startedAt + state.queue.totalSeconds * 1000
    : null;
  useEffect(() => {
    if (queueEnd === null) return;
    const id = window.setTimeout(
      () => dispatch({ type: 'tickQueue', now: Math.max(Date.now(), queueEnd) }),
      Math.max(0, queueEnd - Date.now()),
    );
    return () => window.clearTimeout(id);
  }, [queueEnd]);

  const [clock, setClock] = useState<number | null>(null);
  useLiveInterval(setClock, 1000, state.screen === 'call' && state.callStartedAt !== null);
  const callSeconds = clock !== null && state.callStartedAt !== null
    ? Math.max(0, Math.floor((clock - state.callStartedAt) / 1000))
    : 0;

  // The match. When the booking screen is in view the ready screen is the
  // interrupt; when the patient has looked away (another tab, or the home
  // screen) a toast carries it, once per match, never for a URL landing.
  const announce = useEffectEvent(() => {
    const gp = state.gp;
    if (!gp || (onBookingRoute && !document.hidden)) return;
    toast('Your GP is ready', {
      id: READY_TOAST_ID,
      description: `${gp.ref} has accepted your consultation.`,
      duration: Infinity,
      action: {
        label: 'Join',
        onClick: () => {
          dispatch({ type: 'join', now: Date.now() });
          router.push(bookingHref('call') + window.location.search);
        },
      },
    });
  });
  useEffect(() => { if (state.matchedAt !== null) announce(); }, [state.matchedAt]);
  useEffect(() => { if (state.screen !== 'ready') toast.dismiss(READY_TOAST_ID); }, [state.screen]);

  // The tab title is the only part of the interrupt a patient sees once they
  // have looked away, so it holds for as long as the GP is waiting. It is a
  // <title> of its own, kept first in <head> (the one the browser shows):
  // assigning document.title would overwrite the route's metadata title,
  // which Next re-renders after a navigation, and could not be restored.
  const waiting = state.screen === 'ready' && state.gp !== null;
  useEffect(() => {
    if (!waiting) return;
    const title = document.createElement('title');
    title.dataset.slot = 'ready-title';
    title.textContent = READY_TITLE;
    const keepFirst = () => { if (document.head.firstElementChild !== title) document.head.prepend(title); };
    keepFirst();
    const observer = new MutationObserver(keepFirst);
    observer.observe(document.head, { childList: true });
    return () => { observer.disconnect(); title.remove(); };
  }, [waiting]);

  // What this booking produced lands in the account.
  const keep = useEffectEvent(() => { if (state.record) addRecord(state.record); });
  useEffect(() => { keep(); }, [state.record]);
  useEffect(() => { if (state.identityChecked) markIdentityChecked(); }, [state.identityChecked, markIdentityChecked]);
  // Only a submitted NHS GP step is an answer. A URL landing seeds a consent
  // but never an answer, and each valid submit is a new object, so a
  // corrected practice replaces the one remembered.
  useEffect(() => { if (state.answered) rememberPractice(state.answered); }, [state.answered, rememberPractice]);

  const value = useMemo(() => ({ state, act: dispatch, callSeconds }), [state, callSeconds]);
  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export function useBooking(): BookingContextValue {
  const context = useContext(BookingContext);
  if (!context) throw new Error('useBooking outside BookingProvider');
  return context;
}
