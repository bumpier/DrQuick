'use client';
/* The reveal grammar for the marketing pages, on the landing page's rules:
   `.js [data-reveal]` is hidden until something adds `.in`. The hero
   ([data-reveal="load"]) arrives on load; everything else arrives as it scrolls
   in, staggered 70ms within each [data-stagger] group and capped at 300ms. The
   layout persists across client navigations, so the effect re-arms per path. */
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { heroDelay, staggerDelay } from '@/lib/reveal';

export function SiteReveal() {
  const pathname = usePathname();
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-site]');
    if (!root) return;
    const show = (el: Element) => el.classList.add('in');
    root.querySelectorAll<HTMLElement>('[data-stagger]').forEach((group) =>
      group.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el, i) =>
        el.style.setProperty('--d', `${staggerDelay(i)}ms`)));
    const hero = root.querySelectorAll<HTMLElement>('[data-reveal="load"]');
    hero.forEach((el, i) => el.style.setProperty('--d', `${heroDelay(i)}ms`));

    const rest = [...root.querySelectorAll<HTMLElement>('[data-reveal]:not([data-reveal="load"])')];
    // A timer rather than nested rAF so the release cannot stall in a throttled tab.
    const id = window.setTimeout(() => {
      hero.forEach(show);
      if (!('IntersectionObserver' in window)) rest.forEach(show);
    }, 60);
    const io = 'IntersectionObserver' in window
      ? new IntersectionObserver((entries) => entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          show(entry.target);
          io!.unobserve(entry.target);
        }), { threshold: 0.12, rootMargin: '0px 0px -8% 0px' })
      : null;
    rest.forEach((el) => io?.observe(el));
    return () => { window.clearTimeout(id); io?.disconnect(); };
  }, [pathname]);
  return null;
}
