'use client';

import { useEffect } from 'react';
import { staggerDelay, heroDelay } from '@/lib/reveal';

// A one-effect port of the flat page's behaviour script. The role switch and
// the reveal grammar must work on server-rendered static markup, so they stay
// DOM-level operations rather than becoming React state. Every listener,
// observer and timer registers a cleanup so a dev double-mount cannot double-bind.
export function LandingBehavior() {
  useEffect(() => {
    const cleanups: Array<() => void> = [];
    const on = (target: EventTarget, type: string, fn: EventListener) => {
      target.addEventListener(type, fn);
      cleanups.push(() => target.removeEventListener(type, fn));
    };
    const timer = (fn: () => void, ms: number) => {
      const id = window.setTimeout(fn, ms);
      cleanups.push(() => window.clearTimeout(id));
    };

    // ---- Reveal grammar -------------------------------------------------
    // Siblings inside a [data-stagger] group arrive in sequence, with the total
    // delay capped so a long list never turns into a queue. A mode is revealed
    // the first time it is shown, which is page load for one of them and the
    // first switch for the other.
    document.querySelectorAll('[data-stagger]').forEach((group) => {
      group.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el, i) => {
        el.style.setProperty('--d', `${staggerDelay(i)}ms`);
      });
    });

    const show = (el: Element) => el.classList.add('in');

    const io = 'IntersectionObserver' in window
      ? new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            show(entry.target);
            io!.unobserve(entry.target); // reveal once; never replay on scroll-back
          });
        }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' })
      : null;
    if (io) cleanups.push(() => io.disconnect());

    const revealMode = (scope: HTMLElement | null) => {
      if (!scope || scope.dataset.revealed) return;
      scope.dataset.revealed = 'true';
      // The flag stops a repeat switch replaying the reveal, but it must not
      // outlive this effect run: a dev double-mount cleans up the timer and the
      // observers below, and a re-run that then hit the flag would leave the
      // mode invisible. Clearing it on cleanup lets the re-run arm them again.
      cleanups.push(() => { delete scope.dataset.revealed; });

      // This mode's hero arrives on load rather than on scroll: it is already in view.
      const hero = scope.querySelectorAll<HTMLElement>('[data-reveal="load"], [data-line]');
      hero.forEach((el, i) => el.style.setProperty('--d', `${heroDelay(i)}ms`));
      // One painted frame at the start state, then release. A timer rather than
      // nested rAF so the reveal cannot stall in a background or throttled tab.
      timer(() => hero.forEach(show), 60);

      const rest = scope.querySelectorAll('[data-reveal]:not([data-reveal="load"])');
      if (!io) { rest.forEach(show); return; }
      rest.forEach((el) => io.observe(el));
    };

    // ---- Patient / GP modes ---------------------------------------------
    // Both modes are real URLs, so a link mailed to a GP opens the GP page and a
    // blocked script still renders both. The click is intercepted only to swap in
    // place, which keeps the reveal grammar and the reader's place in the tab.
    const root = document.documentElement;
    const panel: Record<'patient' | 'gp', HTMLElement | null> = {
      patient: document.querySelector('[data-mode="patient"]'),
      gp: document.querySelector('[data-mode="gp"]'),
    };
    const links = document.querySelectorAll<HTMLAnchorElement>('[data-mode-link]');
    const cta = document.getElementById('nav-cta');
    const ACTION = { patient: '#join', gp: '#gp-join' } as const;

    const setMode = (role: 'patient' | 'gp', switched: boolean) => {
      root.setAttribute('data-role', role);
      links.forEach((a) => {
        if (a.dataset.modeLink === role) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
      if (cta) { cta.setAttribute('href', ACTION[role]); cta.dataset.focus = ACTION[role].slice(1); }
      revealMode(panel[role]);
      if (!switched) return;
      // The whole page changed underneath the reader, so start them at its top
      // and put focus on the new headline rather than leaving it on the switch.
      try { history.replaceState(null, '', role === 'gp' ? '?role=gp' : location.pathname); } catch {}
      window.scrollTo(0, 0);
      const h1 = panel[role]?.querySelector<HTMLElement>('h1');
      if (h1) h1.focus({ preventScroll: true });
    };

    links.forEach((a) => on(a, 'click', (e) => {
      e.preventDefault();
      setMode(a.dataset.modeLink as 'patient' | 'gp', true);
    }));

    setMode(root.getAttribute('data-role') === 'gp' ? 'gp' : 'patient', false);

    // The illustration idles only while it is on screen; a decorative loop must not
    // burn battery behind the fold, least of all for someone reading this while ill.
    const art = document.querySelector('.hero-img');
    if (art) {
      if (!('IntersectionObserver' in window)) {
        art.classList.add('art-live');
      } else {
        const artIo = new IntersectionObserver(
          ([e]) => art.classList.toggle('art-live', e.isIntersecting),
          { threshold: 0 },
        );
        artIo.observe(art);
        cleanups.push(() => artIo.disconnect());
      }
    }

    // The bar only earns a hard edge once it is actually floating over content.
    const sentinel = document.getElementById('nav-sentinel');
    const nav = document.querySelector('nav');
    if (sentinel && nav && 'IntersectionObserver' in window) {
      const navIo = new IntersectionObserver(
        ([entry]) => nav.classList.toggle('is-floating', !entry.isIntersecting),
      );
      navIo.observe(sentinel);
      cleanups.push(() => navIo.disconnect());
    }

    // The nav CTA jumps to the active mode's form; put the caret where the action is.
    if (cta) on(cta, 'click', () => {
      const el = document.getElementById(cta.dataset.focus ?? '');
      if (el) timer(() => el.focus({ preventScroll: true }), 320);
    });

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
