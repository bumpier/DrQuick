'use client';
import { createContext, useContext, useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ShiftState } from '@/lib/doctor/shift';

// The doctor's shift, live. Mounted in the portal layout so an offer reaches
// the doctor on whichever page they are on. The server is the authority: this
// holds the last state it sent and when it arrived, and counts down from there.
//
// The poll is a POST to /doctor/pulse, re-armed only after each answer, so two
// never overlap. It keeps going while the tab is hidden (a doctor reading
// another tab must not silently drop out of the rotation; browsers slow hidden
// timers, and the server takes a silent doctor out safely) and fires at once
// when the tab is shown again. It does not run at all while offline.
type Snapshot = { state: ShiftState; at: number | null };
type Shift = Snapshot & { apply: (state: ShiftState) => void };

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

  useEffect(() => { setSnap((s) => (s.at === null ? { ...s, at: Date.now() } : s)); }, []);

  const shift = useMemo<Shift>(() => ({
    ...snap,
    apply: (state) => { generation.current += 1; setSnap({ state, at: Date.now() }); },
  }), [snap]);

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
    setSnap({ state: body.state, at: Date.now() });
  });

  useEffect(() => {
    if (!polling) return;
    const delay = slow ? POLL_IN_CONSULTATION_MS : POLL_MS;
    let stopped = false;
    let running = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (running || stopped) return;
      running = true;
      const startedAt = generation.current;
      try {
        const res = await fetch('/doctor/pulse', { method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(5000) });
        if (res.status === 401) { window.location.assign('/doctor/login'); return; }
        if (res.ok && !stopped) onPulse(await res.json(), startedAt);
      } catch {
        // Offline or slow: keep showing the last state and try again.
      } finally {
        running = false;
      }
      if (!stopped) timer = setTimeout(tick, delay);
    };

    timer = setTimeout(tick, delay);
    const onVisible = () => { if (!document.hidden) { clearTimeout(timer); void tick(); } };
    document.addEventListener('visibilitychange', onVisible);
    return () => { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible); };
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
