'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// Re-renders the server page every `seconds` while the tab is visible, and
// once straight away when it becomes visible again. Says when it last did.
export function AutoRefresh({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter();
  const [at, setAt] = useState<Date | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const tick = () => { router.refresh(); setAt(new Date()); };
    const start = () => { if (!timer) timer = setInterval(tick, seconds * 1000); };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') { tick(); start(); } else stop();
    };
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [router, seconds]);

  return (
    <p className="text-fine text-ink-2" aria-live="off">
      Refreshes every {seconds}s while this tab is open
      {at && <> · updated {at.toLocaleTimeString('en-GB', { timeZone: 'Europe/London' })}</>}
    </p>
  );
}
