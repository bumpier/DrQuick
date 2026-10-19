/* The investor demo (lib/demo.ts): the patient's booking becomes the real
   waiting request the demo doctor is offered in the portal. Reaching the queue
   with a hold on the card makes the request, once; while the patient waits, is
   matched or is in the call, the request is polled, and each poll runs the
   dispatcher (a patient's wait screen must: lib/doctor/dispatch.ts). The
   doctor's Accept is the match and the doctor's Complete ends the call. A
   request nobody can take any more, or one that could not be made, ends on
   the no-GP screen rather than an endless wait. A request the patient leaves
   while it waits is withdrawn, so the offer leaves the doctor's screen.
   Outside demo mode it does nothing at all.

   The poll is a plain interval, not useLiveInterval: the presenter switches
   to the doctor's window, which can hide this one, and the match must still
   land while they are there (the toast and the tab title carry it). */
import { useEffect, useEffectEvent, useRef } from 'react';
import { demoMode } from '@/lib/demo';
import { NO_GP_ONLINE, type BookingAction, type BookingScreen, type BookingState } from '@/lib/booking-flow';

export const DEMO_BOOKING_URL = '/dev/demo/booking';
export const DEMO_POLL_MS = 2000;

const POLLED = new Set<BookingScreen>(['finding', 'ready', 'call']);

// The request this booking made, keyed by when its queue started. The id is
// null until the POST answers.
type Made = { key: number; id: string | null };

const at = (id: string) => `${DEMO_BOOKING_URL}?id=${encodeURIComponent(id)}`;
const withdraw = (id: string) => { fetch(at(id), { method: 'DELETE' }).catch(() => {}); };

export function useDemoBooking(state: BookingState, act: (action: BookingAction) => void): void {
  const on = demoMode();
  // A ref, so StrictMode's second run of the effect below finds the request
  // already made and never makes a second one.
  const made = useRef<Made | null>(null);

  const queueKey = on && state.screen === 'finding' && state.hold.status === 'authorised'
    ? state.queue?.startedAt ?? null
    : null;

  // What the request's state means for the screen the patient is on. Ended
  // while waiting (the doctor declined or missed it, Reset cleared it, or it
  // was never made) is the no-GP screen: the hold released in full, 111, and
  // "Try again", which quotes afresh and makes a new request.
  const answer = useEffectEvent((status: string) => {
    const now = Date.now();
    if (status === 'matched' && state.screen === 'finding') act({ type: 'matchDoctor', now });
    else if (status === 'completed' && state.screen === 'call') act({ type: 'doctorCompleted', now });
    else if (status === 'ended' && state.screen === 'finding') {
      made.current = null;   // already gone: nothing to withdraw
      act({ type: 'skipWait', now, gps: NO_GP_ONLINE });
    }
  });

  const request = useEffectEvent((key: number) => {
    const body = {
      complaint: state.complaint ?? 'other',
      pricePence: Math.round((state.quote ?? 0) * 100),
      recordConsent: state.nhsGpConsent === true,
    };
    fetch(DEMO_BOOKING_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then((res) => (res.ok ? res.json() as Promise<{ consultationId?: string }> : null))
      .catch(() => null)
      .then((data) => {
        const id = data?.consultationId;
        if (made.current?.key !== key) {
          if (id) withdraw(id);   // the booking left the queue before the request existed
          return;
        }
        if (id) made.current.id = id;
        else answer('ended');     // refused or unreachable: no doctor will ever see it
      });
  });
  useEffect(() => {
    if (queueKey === null || made.current?.key === queueKey) return;
    made.current = { key: queueKey, id: null };
    request(queueKey);
  }, [queueKey]);

  // Leaving the request behind forgets it; leaving it while it waits (a
  // cancel) withdraws it.
  const shown = useRef(state.screen);
  useEffect(() => {
    const from = shown.current;
    shown.current = state.screen;
    if (from === state.screen || POLLED.has(state.screen)) return;
    const left = made.current;
    made.current = null;
    if (from === 'finding' && left?.id) withdraw(left.id);
  }, [state.screen]);

  const polling = on && POLLED.has(state.screen);
  useEffect(() => {
    if (!polling) return;
    // One poll at a time: a slow answer is never overtaken by the next.
    let asking = false;
    const timer = window.setInterval(() => {
      const id = made.current?.id;
      if (!id || asking) return;
      asking = true;
      fetch(at(id), { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() as Promise<{ status?: string }> : null))
        .then((data) => { if (data?.status && made.current?.id === id) answer(data.status); })
        .catch(() => {})
        .finally(() => { asking = false; });
    }, DEMO_POLL_MS);
    return () => window.clearInterval(timer);
  }, [polling]);
}
