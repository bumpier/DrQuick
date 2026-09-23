import { useEffect, useEffectEvent } from 'react';
import { startInterval } from '@/lib/live';

/* One interval, paused while the tab is hidden. `fn` is read through an
   Effect Event, so a new closure on every render never restarts the timer;
   only `ms` or `active` do, and StrictMode's mount → cleanup → mount simply
   re-arms it. Every tick carries Date.now() and the callers compute elapsed
   time from a stored timestamp, so nothing drifts while paused: the moment
   the tab returns the hook ticks once to catch up, then resumes. It wraps
   startInterval so the reduced-motion rule is kept, though at the dashboards'
   1000ms it never bites. */
export function useLiveInterval(fn: (now: number) => void, ms: number, active = true): void {
  const tick = useEffectEvent(() => fn(Date.now()));
  useEffect(() => {
    if (!active) return;
    let stop = () => {};
    const run = () => { stop(); stop = startInterval(tick, ms); };
    const onVisibility = () => {
      if (document.hidden) { stop(); stop = () => {}; } else { tick(); run(); }
    };
    if (!document.hidden) run();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [ms, active]);
}
