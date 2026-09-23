'use client';

/* Which figures a dashboard may show. The mode is provider state seeded from
   `?data=seeded` once after mount — never a render-time read of the URL, so the
   static shell and the client's first render agree on blank — and stamped back
   onto the URL after every client navigation, so a reload or a copied link
   keeps it. Each surface mounts its own provider in its layout; there is no
   global, and the admin surface cannot see the doctor's mode. */

import {
  createContext, useCallback, useContext, useEffect, useEffectEvent, useMemo, useState, type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { DASH, live, type DataMode } from '@/lib/placeholder';

export type { DataMode };

function writeQuery(key: string, value: string | null) {
  const url = new URL(window.location.href);
  if ((url.searchParams.get(key) ?? null) === value) return;   // no-op → no ACTION_RESTORE
  if (value === null) url.searchParams.delete(key);
  else url.searchParams.set(key, value);
  // `null`, not history.state: Next's patched replaceState re-attaches __NA and the
  // router tree when data is null and dispatches ACTION_RESTORE, so usePathname agrees;
  // passing the existing state, which carries __NA, makes it skip that sync. A restore
  // never scrolls.
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
}

export function usePersistedQuery(key: string): [value: string | null, set: (v: string | null) => void] {
  const pathname = usePathname();
  const [value, setValue] = useState<string | null>(null);   // server and first client render: null
  const [ready, setReady] = useState(false);

  // Read once after mount. Never write here: on the hydration commit this runs before
  // AppRouter's effect has patched history.replaceState, and a native write with null
  // state would strip __NA — Back to this entry would then dead-end (app-router.js onPopState).
  useEffect(() => {
    setValue(new URLSearchParams(window.location.search).get(key));
    setReady(true);
  }, [key]);

  // Re-stamp after every client navigation: <Link> navigates to exactly its href, so the
  // query is dropped. `ready` is false throughout the mount commit and StrictMode's re-run
  // of it, so the first write can only follow a real navigation, once the patch is in.
  const restamp = useEffectEvent(() => { if (ready) writeQuery(key, value); });
  useEffect(() => { restamp(); }, [pathname]);

  const set = useCallback((v: string | null) => { setValue(v); writeQuery(key, v); }, [key]);
  return [value, set];
}

type DataModeContextValue = { mode: DataMode; seeded: boolean; setMode: (m: DataMode) => void };
const DataModeContext = createContext<DataModeContextValue | null>(null);

export function DataModeProvider({ children }: { children: ReactNode }) {
  const [data, setData] = usePersistedQuery('data');
  const mode: DataMode = data === 'seeded' ? 'seeded' : 'placeholder';
  const setMode = useCallback((m: DataMode) => setData(m === 'seeded' ? 'seeded' : null), [setData]);

  // The port of markDocument. Named `figures`, not `mode`, so the landing page's
  // `[data-mode="gp"]` rules (globals.css:440) can never match a dashboard element.
  // Server HTML carries no stamp, so it doubles as the screenshot script's hydration
  // signal; leaving the surface takes it with it.
  useEffect(() => {
    document.documentElement.dataset.figures = mode;
    return () => { delete document.documentElement.dataset.figures; };
  }, [mode]);

  const value = useMemo(() => ({ mode, seeded: mode === 'seeded', setMode }), [mode, setMode]);
  return <DataModeContext.Provider value={value}>{children}</DataModeContext.Provider>;
}

export function useDataMode(): DataModeContextValue {
  const context = useContext(DataModeContext);
  if (!context) throw new Error('useDataMode outside DataModeProvider');
  return context;
}

// shown() and seedList() bound to this surface's mode. A figure only a running
// platform could produce is a dash until seeded; live() is what this session
// produced and passes through as it is (zero is still a dash).
export function useFigures(): {
  seeded: boolean;
  DASH: string;
  shown: <T>(v: T, f?: (v: T) => string) => string;
  live: typeof live;
  seedList: <T>(l: readonly T[]) => T[];
} {
  const { seeded } = useDataMode();
  return useMemo(() => ({
    seeded,
    DASH,
    shown: <T,>(v: T, f?: (v: T) => string) => (seeded ? live(v, f) : DASH),
    live,
    seedList: <T,>(l: readonly T[]) => (seeded ? [...l] : []),
  }), [seeded]);
}
