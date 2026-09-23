import { useSyncExternalStore } from 'react';
import { vi } from 'vitest';

// The mock module for 'next/navigation'. vi.mock is hoisted per test file, so each
// file registers it: vi.mock('next/navigation', () => import('./helpers/next-navigation')).
// One router object for the whole file: an effect keyed on `router` must never see a new one.
export const nav = {
  pathname: '/doctor',
  router: {
    replace: vi.fn<(href: string) => void>(),
    push: vi.fn<(href: string) => void>(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  },
};

// The real usePathname is fed by the App Router's own context, so every consumer
// re-renders on navigation regardless of where it sits in the tree — including a
// sibling of whatever provider a test's `renderAt` wrapper happens to force-refresh.
// A bare `() => nav.pathname` read would only update on a render some ancestor was
// already going to do for its own reasons, which silently drops any component whose
// nearest re-rendering ancestor isn't itself pathname-keyed. useSyncExternalStore
// gives every caller that same unconditional refresh; setPathname() is how renderAt's
// setPath announces a navigation.
const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function getSnapshot() {
  return nav.pathname;
}

export function setPathname(pathname: string) {
  nav.pathname = pathname;
  listeners.forEach((listener) => listener());
}

export function resetNav(pathname = '/doctor') {
  nav.pathname = pathname;
  nav.router.replace.mockReset();
  nav.router.push.mockReset();
}

export const usePathname = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
export const useRouter = () => nav.router;

// The static shell forbids it (it bails the route to client rendering), so the
// mock refuses it too rather than quietly handing back the query.
export const useSearchParams = () => {
  throw new Error('useSearchParams is banned (static shell)');
};

export function notFound(): never {
  const error = new Error('NEXT_HTTP_ERROR_FALLBACK;404') as Error & { digest: string };
  error.digest = 'NEXT_HTTP_ERROR_FALLBACK;404';
  throw error;
}
