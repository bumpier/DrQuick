import { vi } from 'vitest';
import { installIOStub } from './io-stub';

// jsdom 26 has no ResizeObserver and no matchMedia, a "not implemented" scrollTo
// and no pointer capture. hooks/use-mobile.ts calls matchMedia unguarded inside
// SidebarProvider, so every shell render throws until these are in place. Each
// stub records what it was given so a test can fire it by hand.
export class ResizeObserverStub {
  static instances: ResizeObserverStub[] = [];
  observed: Element[] = [];
  constructor(public cb: ResizeObserverCallback) { ResizeObserverStub.instances.push(this); }
  observe(el: Element) { this.observed.push(el); }
  unobserve(el: Element) { this.observed = this.observed.filter((e) => e !== el); }
  disconnect() { this.observed = []; }
  // ChartFrame reads entry.contentRect.width.
  resize(target: Element, width: number, height = 150) {
    this.cb(
      [{ target, contentRect: { width, height } } as unknown as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
  static forElement(el: Element) {
    return ResizeObserverStub.instances.find((ro) => ro.observed.includes(el));
  }
}

export function installMatchMedia(matches: Record<string, boolean> = {}) {
  vi.stubGlobal('matchMedia', vi.fn((query: string): MediaQueryList => ({
    matches: matches[query] ?? false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  })));
}

// `document.hidden` is a prototype getter tied to jsdom's pretendToBeVisual;
// override it on the instance and raise the event the live-interval hook listens for.
export function setDocumentHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  Object.defineProperty(document, 'visibilityState', {
    configurable: true, get: () => (hidden ? 'hidden' : 'visible'),
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

export type DomStubOptions = { mobile?: boolean; reducedMotion?: boolean; width?: number };

export function installDomStubs({ mobile = false, reducedMotion = false, width }: DomStubOptions = {}) {
  ResizeObserverStub.instances = [];
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  installIOStub();
  installMatchMedia({
    '(max-width: 899px)': mobile,                      // hooks/use-mobile.ts: MOBILE_BREAKPOINT - 1
    '(prefers-reduced-motion: reduce)': reducedMotion, // lib/live.ts startInterval
  });
  Object.defineProperty(window, 'innerWidth', {
    configurable: true, writable: true, value: width ?? (mobile ? 390 : 1440),
  });
  vi.stubGlobal('scrollTo', vi.fn());
  Element.prototype.scrollIntoView ??= vi.fn();          // Radix Select
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  // Put the prototype getters back in case a previous test overrode them.
  delete (document as unknown as Record<string, unknown>).hidden;
  delete (document as unknown as Record<string, unknown>).visibilityState;
  document.documentElement.className = 'js';
}
