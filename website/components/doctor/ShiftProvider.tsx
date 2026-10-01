'use client';
import { createContext, useContext, useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import type { ShiftState } from '@/lib/doctor/shift';

// The doctor's shift, live. Mounted in the portal layout so an offer reaches
// the doctor on whichever page they are on. The server is the authority: this
// holds the last state it sent and when it arrived, and counts down from there.
//
// The poll is a POST to /doctor/pulse, re-armed only after each answer, so two
// never overlap. It does not run at all while offline.
//
// It also stops while the tab is hidden, and fires at once when the tab is
// shown again. The poll is the heartbeat, and a doctor who cannot see the
// portal must not be offered a patient: the offer would run its whole window
// unseen while the patient waits, and could never be offered to that doctor
// again. Hidden, the server drops them from the rotation within seconds, and
// takes them offline after two minutes; back in view within that, they are in
// the rotation again with their place kept.
type Snapshot = { state: ShiftState; at: number | null };
type Shift = Snapshot & { apply: (state: ShiftState) => void; connected: boolean };

const ShiftContext = createContext<Shift | null>(null);

const POLL_MS = 3000;
const POLL_IN_CONSULTATION_MS = 10_000;
const BUILD = process.env.NEXT_PUBLIC_BUILD_SHA ?? '';

export function ShiftProvider({ initial, children }: { initial: ShiftState; children: ReactNode }) {
  // `at` is null until mounted: the server render and the first client render
  // must agree, and "now" is different on each.
  const [snap, setSnap] = useState<Snapshot>({ state: initial, at: null });
  // Bumped by every answer an action brings back. A poll that was already in
  // flight when the doctor clicked is older than the click, and is dropped.
  const generation = useRef(0);
  // Whether the last poll reached the server. While it has not, what is on
  // screen may be out of date and the doctor is not being offered anything.
  const [connected, setConnected] = useState(true);

  useEffect(() => { setSnap((s) => (s.at === null ? { ...s, at: Date.now() } : s)); }, []);

  const shift = useMemo<Shift>(() => ({
    ...snap,
    connected,
    apply: (state) => { generation.current += 1; setSnap({ state, at: Date.now() }); },
  }), [snap, connected]);

  const kind = snap.state.kind;
  const polling = kind !== 'offline' && kind !== 'unavailable';
  const slow = kind === 'consultation';

  const onPulse = useEffectEvent((body: { state?: ShiftState; build?: string }, startedAt: number) => {
    if (!body.state || generation.current !== startedAt) return;
    // A deploy happened under a long-open tab: reload once nothing is in hand.
    if (BUILD && body.build && body.build !== BUILD && (body.state.kind === 'idle' || body.state.kind === 'resting')) {
      window.location.reload();
      return;
    }
    // The server took them offline, not a click: say why, or it looks like a fault.
    if (body.state.kind === 'offline') toast('You were out of touch for a while, so you are now offline. Go online when you are ready.');
    setSnap({ state: body.state, at: Date.now() });
  });

  useEffect(() => {
    if (!polling) { setConnected(true); return; }
    const delay = slow ? POLL_IN_CONSULTATION_MS : POLL_MS;
    let stopped = false;
    let running = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (running || stopped || document.hidden) return;
      running = true;
      const startedAt = generation.current;
      try {
        const res = await fetch('/doctor/pulse', { method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(5000) });
        if (res.status === 401) { window.location.assign('/doctor/login'); return; }
        if (!stopped) {
          setConnected(res.ok);
          if (res.ok) onPulse(await res.json(), startedAt);
        }
      } catch {
        // Could not reach the server: keep the last state, say so, and try again.
        if (!stopped) setConnected(false);
      } finally {
        running = false;
      }
      if (!stopped && !document.hidden) timer = setTimeout(tick, delay);
    };

    timer = setTimeout(tick, delay);
    // Hidden: stop. Shown again: check in at once.
    const onVisibility = () => { clearTimeout(timer); if (!document.hidden) void tick(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', onVisibility); };
  }, [polling, slow]);

  return <ShiftContext.Provider value={shift}>{children}</ShiftContext.Provider>;
}

export function useShift(): Shift {
  const shift = useContext(ShiftContext);
  if (!shift) throw new Error('useShift needs a ShiftProvider above it');
  return shift;
}

// Milliseconds since the state arrived, ticking four times a second. Zero until
// mounted, so the first paint shows exactly what the server sent.
export function useElapsed(at: number | null, active: boolean): number {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [active]);
  return at !== null && now !== null ? Math.max(0, now - at) : 0;
}

// On every portal page: the portal has lost touch with the server, so what it
// shows may be stale and no offer can reach the doctor until it is back.
export function ConnectionNotice() {
  const { connected } = useShift();
  if (connected) return null;
  return (
    <div role="alert" className="mb-6 rounded-xl bg-surface-mid px-5 py-4 text-ink">
      <p className="font-semibold">Connection lost.</p>
      <p className="text-ink-2">You will not be offered consultations until it is back. Trying again every few seconds.</p>
    </div>
  );
}

// On every portal page but the dashboard: an offer is waiting, and where.
export function OfferNotice() {
  const { state, at } = useShift();
  const pathname = usePathname();
  const offer = state.kind === 'offer' ? state : null;
  const elapsed = useElapsed(at, offer !== null);
  if (!offer || pathname === '/doctor') return null;
  const seconds = Math.ceil(Math.max(0, offer.remainingMs - elapsed) / 1000);
  return (
    <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary px-5 py-4 text-ink">
      <p className="font-semibold">A patient is waiting for you. {seconds} seconds to answer.</p>
      <Link href="/doctor" className="font-bold text-ink underline underline-offset-4">See the offer</Link>
    </div>
  );
}
