import { act, render, type RenderResult } from '@testing-library/react';
import type { ComponentType, ReactNode } from 'react';
import { nav, resetNav, setPathname } from './next-navigation';
import { installDomStubs, type DomStubOptions } from './dom-stubs';

export type RenderAtOptions = DomStubOptions & {
  pathname: string;
  query?: string;                                    // without the leading '?'
  providers?: ComponentType<{ children: ReactNode }>;
};

// pushState, as <Link> does: a spy on replaceState then sees only what the app wrote.
function setLocation(pathname: string, query?: string) {
  window.history.pushState(null, '', query ? `${pathname}?${query}` : pathname);
}

// Render `ui` as if the app router were at `pathname`: dom stubs installed, the
// navigation mock pointed there, window.location set so a post-mount read of the
// query finds it. Provider-agnostic — each surface's render helper wraps this.
export function renderAt(
  ui: ReactNode,
  { pathname, query, providers, ...stubs }: RenderAtOptions,
): RenderResult & { setPath: (next: string) => void } {
  installDomStubs(stubs);
  resetNav(pathname);
  setLocation(pathname, query?.replace(/^\?/, ''));
  const result = render(ui, { wrapper: providers });
  return Object.assign(result, {
    // A client navigation: the mocked usePathname changes and the tree re-renders,
    // which is what the providers' pathname-keyed effects run on. A <Link> goes to
    // exactly its href, so a query not in `next` is dropped — the case re-stamping exists for.
    setPath(next: string) {
      const url = new URL(next, window.location.origin);
      // window.location moves first, exactly as a real navigation would leave it
      // (the query dropped), so that when the pathname-keyed effects below run,
      // reading window.location.href finds the query already gone and writes it
      // back. setPathname (not a direct `nav.pathname =`) so every usePathname()
      // caller re-renders, not just whichever one an ancestor's own re-render
      // happens to reach — see next-navigation.ts.
      setLocation(url.pathname, url.search.slice(1) || undefined);
      act(() => { setPathname(url.pathname); });
      result.rerender(ui);
    },
  });
}

export { nav };
