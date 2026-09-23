import { useCallback, useEffect, useRef, useState } from 'react';

/* A wait the prototype stages where a real service would answer: the ID
   check, the card hold. The control that starts it is pending until the callback
   lands, a second press while it is pending does nothing, and leaving the
   screen cancels it, so a late callback can never act on a screen the patient
   has already left. */
export function useDelayed(ms: number): { pending: boolean; run: (fn: () => void) => void } {
  const [pending, setPending] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const run = useCallback((fn: () => void) => {
    if (timer.current !== null) return;
    setPending(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setPending(false);
      fn();
    }, ms);
  }, [ms]);

  return { pending, run };
}
