// @vitest-environment jsdom
import { test, expect, beforeEach, vi } from 'vitest';
import { StrictMode } from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { LandingBehavior } from '@/components/LandingBehavior';
import { IOStub, installIOStub } from './helpers/io-stub';

function fixture() {
  return (
    <>
      <span id="nav-sentinel" aria-hidden="true" />
      <nav>
        <a href="?role=patient" data-mode-link="patient">Patients</a>
        <a href="?role=gp" data-mode-link="gp">GPs</a>
        <a id="nav-cta" href="#join" data-focus="join">Join</a>
      </nav>
      <div className="mode" data-mode="patient">
        <h1 tabIndex={-1}>See a GP</h1>
        <div data-stagger>
          <div data-reveal />
          <div data-reveal />
          <div data-reveal />
          <div data-reveal />
          <div data-reveal />
          <div data-reveal />
        </div>
        <div className="hero-art" data-reveal="load" />
        <input id="join" />
      </div>
      <div className="mode" data-mode="gp">
        <h1 tabIndex={-1}>Consult</h1>
        <input id="gp-join" />
      </div>
      <LandingBehavior />
    </>
  );
}

beforeEach(() => {
  cleanup();
  vi.useRealTimers();
  installIOStub();
  vi.stubGlobal('scrollTo', vi.fn());
  document.documentElement.className = 'js';
  document.documentElement.setAttribute('data-role', 'patient');
  window.history.replaceState(null, '', '/');
});

test('mount reveals only the active mode and stamps the capped stagger', async () => {
  vi.useFakeTimers();
  const { container } = render(fixture());
  const patient = container.querySelector('[data-mode="patient"]') as HTMLElement;
  const gp = container.querySelector('[data-mode="gp"]') as HTMLElement;
  expect(patient.dataset.revealed).toBe('true');
  expect(gp.dataset.revealed).toBeUndefined();
  const staggered = [...patient.querySelectorAll('[data-stagger] [data-reveal]')] as HTMLElement[];
  expect(staggered[0].style.getPropertyValue('--d')).toBe('0ms');
  expect(staggered[4].style.getPropertyValue('--d')).toBe('280ms');
  expect(staggered[5].style.getPropertyValue('--d')).toBe('300ms');
  vi.advanceTimersByTime(80); // the 60ms release timer
  expect((patient.querySelector('[data-reveal="load"]') as HTMLElement).classList.contains('in')).toBe(true);
  expect(patient.querySelector('[data-mode-link]')).toBeNull(); // sanity: links live in nav
  expect(document.querySelector('[data-mode-link="patient"]')!.getAttribute('aria-current')).toBe('page');
});

test('switching to GP swaps role, CTA, URL and focus', () => {
  const { container } = render(fixture());
  const gpLink = document.querySelector('[data-mode-link="gp"]') as HTMLElement;
  fireEvent.click(gpLink);
  expect(document.documentElement.getAttribute('data-role')).toBe('gp');
  expect(gpLink.getAttribute('aria-current')).toBe('page');
  expect(document.querySelector('[data-mode-link="patient"]')!.hasAttribute('aria-current')).toBe(false);
  const cta = document.getElementById('nav-cta') as HTMLAnchorElement;
  expect(cta.getAttribute('href')).toBe('#gp-join');
  expect(cta.dataset.focus).toBe('gp-join');
  expect(window.location.search).toBe('?role=gp');
  expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  const gp = container.querySelector('[data-mode="gp"]') as HTMLElement;
  expect(gp.dataset.revealed).toBe('true');
  expect(document.activeElement).toBe(gp.querySelector('h1'));
  // Switching back to patient strips the query again.
  fireEvent.click(document.querySelector('[data-mode-link="patient"]') as HTMLElement);
  expect(window.location.search).toBe('');
});

test('the nav floats only once the sentinel has scrolled away', () => {
  render(fixture());
  const nav = document.querySelector('nav') as HTMLElement;
  const sentinel = document.getElementById('nav-sentinel') as HTMLElement;
  const navIo = IOStub.instances.find((io) => io.observed.includes(sentinel))!;
  navIo.trigger([{ target: sentinel, isIntersecting: false }]);
  expect(nav.classList.contains('is-floating')).toBe(true);
  navIo.trigger([{ target: sentinel, isIntersecting: true }]);
  expect(nav.classList.contains('is-floating')).toBe(false);
});

test('the nav CTA moves the caret to the active form', () => {
  vi.useFakeTimers();
  render(fixture());
  const cta = document.getElementById('nav-cta') as HTMLElement;
  fireEvent.click(cta);
  vi.advanceTimersByTime(330);
  expect(document.activeElement).toBe(document.getElementById('join'));
});

test('a dev double-mount (StrictMode) still reveals the active mode', () => {
  vi.useFakeTimers();
  const { container } = render(<StrictMode>{fixture()}</StrictMode>);
  const patient = container.querySelector('[data-mode="patient"]') as HTMLElement;
  vi.advanceTimersByTime(80);
  // The first effect run arms the timer and the observers; StrictMode's cleanup
  // tears them down; the second run must arm them again rather than hit the
  // "already revealed" guard and leave the page invisible.
  expect((patient.querySelector('[data-reveal="load"]') as HTMLElement).classList.contains('in')).toBe(true);
  const staggered = patient.querySelector('[data-stagger] [data-reveal]')!;
  const live = IOStub.instances.filter((io) => io.observed.includes(staggered));
  expect(live.length).toBeGreaterThan(0);
});
