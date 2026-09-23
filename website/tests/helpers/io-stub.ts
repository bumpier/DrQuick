import { vi } from 'vitest';

// jsdom has no IntersectionObserver. This stub records instances and lets a
// test fire entries by hand.
export class IOStub {
  static instances: IOStub[] = [];
  observed: Element[] = [];
  constructor(
    public cb: IntersectionObserverCallback,
    public opts?: IntersectionObserverInit,
  ) {
    IOStub.instances.push(this);
  }
  observe(el: Element) { this.observed.push(el); }
  unobserve(el: Element) { this.observed = this.observed.filter((e) => e !== el); }
  disconnect() { this.observed = []; }
  trigger(entries: Array<{ target: Element; isIntersecting: boolean }>) {
    this.cb(entries as IntersectionObserverEntry[], this as unknown as IntersectionObserver);
  }
}

export function installIOStub() {
  IOStub.instances = [];
  vi.stubGlobal('IntersectionObserver', IOStub);
}
