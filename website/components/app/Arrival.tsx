'use client';
/* The arrival grammar for the signed-in surfaces. `.js [data-reveal]` is hidden
   globally and only LandingBehavior, mounted on / alone, ever adds `.in`, so
   without this a dashboard's headline would stay invisible for good. It stamps
   the capped stagger on the tiles of each [data-stagger] group (the landing
   convention — never every data-reveal on the page), releases everything present
   after one painted frame, and marks the shell arrived in the same tick, so
   whatever mounts later — a session screen, a tab, the seeded flip — renders
   visible and still under the one rule in app/globals.css (Decision 13). */
import { useEffect } from 'react';
import { staggerDelay } from '@/lib/reveal';

export function Arrival() {
  useEffect(() => {
    const shell = document.querySelector<HTMLElement>('[data-surface]');
    if (!shell) return;
    shell.querySelectorAll<HTMLElement>('[data-stagger]').forEach((group) =>
      group.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el, i) =>
        el.style.setProperty('--d', `${staggerDelay(i)}ms`)));
    // A timer rather than nested rAF so the release cannot stall in a throttled tab.
    const id = window.setTimeout(() => {
      shell.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('in'));
      shell.dataset.arrived = 'true';
    }, 60);
    // StrictMode runs mount → cleanup → mount: clear both so the second run re-arms.
    return () => { window.clearTimeout(id); delete shell.dataset.arrived; };
  }, []);
  return null;
}
