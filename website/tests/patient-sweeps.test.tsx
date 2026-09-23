// @vitest-environment jsdom
import { test, expect, describe, beforeEach, afterAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
vi.mock('next/navigation', () => import('./helpers/next-navigation'));
vi.mock('next/link', () => import('./helpers/next-link'));
import type { ReactNode } from 'react';
import { renderPatient, renderBooking } from './helpers/render-patient';
import { PatientHome } from '@/components/patient/PatientHome';
import { Consultations } from '@/components/patient/Consultations';
import { ConsultationDetail } from '@/components/patient/ConsultationDetail';
import { Prescriptions } from '@/components/patient/Prescriptions';
import { Account } from '@/components/patient/Account';
import { BOOKING_SCREENS, type BookingScreen } from '@/lib/booking-flow';

/* Every patient route, in both data modes, inside the shell: the rules that
   hold on every screen whatever it shows. A route is mounted as the layout
   mounts it (providers, shell, the state jumper) and read as a whole page. */

beforeEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
afterAll(() => { cleanup(); });

const RIBBON = 'Prototype. Not a live service — no real patients, GPs, or data.';

// Time pressure, paid priority, guarantees, UK-wide claims, recording claims,
// CQC, price ranges, scores and GP counts. "not recorded" and "skip the wait"
// (a prototype control) are allowed and do not match.
const BANNED = /\bsurge\b|\bpriority\b|\bbusier\b|(?<![-\w])busy\b|\bhurry\b|act now|limited time|jump the queue|skip the queue|guarantee|prescriptions included|UK-wide|across the UK|any UK pharmacy|\b(is|are|will be|being) recorded\b|\bCQC\b|from £\d|up to £\d|(urgency|triage|severity|risk) score|\d+\s*GPs?\s+online/i;

// What a patient can read or hear: every text node, joined with a space so
// adjacent elements cannot run their words together, plus the attributes
// assistive technology reads out.
function readable(root: Element): string {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
  root.querySelectorAll('[aria-label], [title], [placeholder], [alt]').forEach((el) => {
    for (const attribute of ['aria-label', 'title', 'placeholder', 'alt']) {
      const value = el.getAttribute(attribute);
      if (value) parts.push(value);
    }
  });
  return parts.join(' ').replace(/\s+/g, ' ');
}

type Route = { path: string; screen?: BookingScreen; ui?: () => ReactNode };
const ROUTES: Route[] = [
  { path: '/patient', ui: () => <PatientHome /> },
  ...BOOKING_SCREENS.map((screen) => ({ path: `/patient/book/${screen}`, screen })),
  { path: '/patient/consultations', ui: () => <Consultations /> },
  { path: '/patient/consultations/C-0031', ui: () => <ConsultationDetail /> },
  { path: '/patient/consultations/C-0009', ui: () => <ConsultationDetail /> },
  { path: '/patient/prescriptions', ui: () => <Prescriptions /> },
  { path: '/patient/account', ui: () => <Account /> },
];
const MODES = [
  { mode: 'blank', query: undefined, figures: 'placeholder' },
  { mode: 'seeded', query: 'data=seeded', figures: 'seeded' },
] as const;
type Case = Route & (typeof MODES)[number];
const CASES: Case[] = ROUTES.flatMap((route) => MODES.map((mode) => ({ ...route, ...mode })));

function mount({ path, screen, ui, query }: Case) {
  const result = screen
    ? renderBooking(screen, { shell: true, query })
    : renderPatient(ui!(), { pathname: path, shell: true, query });
  const shell = result.container.querySelector<HTMLElement>('[data-surface="patient"]')!;
  return { ...result, shell };
}

// Every screen before the call, the home, the account and the 999 screen
// itself: somewhere a patient may realise this is an emergency.
const NEEDS_999 = new Set([
  '/patient', '/patient/account',
  ...(['symptoms', 'safety-check', 'identity', 'nhs-gp', 'quote', 'finding', 'ready', 'consent-refused', 'payment-failed', 'red-flag'] as const)
    .map((screen) => `/patient/book/${screen}`),
]);

test('the sweep covers the 22 patient routes in both modes', () => {
  expect(ROUTES).toHaveLength(22);
  expect(CASES).toHaveLength(44);
  expect(NEEDS_999.size).toBe(12);
});

describe('the sweep\'s own checkers bite', () => {
  test('the banned list catches each kind of claim', () => {
    for (const sample of [
      'Surge pricing', 'Priority queue', 'Busier than usual', 'GPs are busy', 'Hurry', 'Act now', 'For a limited time',
      'Jump the queue', 'Skip the queue', 'Guaranteed prescription', 'Prescriptions included', 'A UK-wide service',
      'Available across the UK', 'Any UK pharmacy', 'Calls are recorded', 'This call will be recorded', 'CQC registered',
      'from £32', 'up to £48', 'Your urgency score', 'triage score', '3 GPs online', '1 GP online',
    ]) {
      expect(sample, sample).toMatch(BANNED);
    }
  });

  test('the banned list lets the honest sentences through', () => {
    for (const sample of [
      'aria-busy', 'surgery', 'This call is not recorded.', 'Calls are never recorded', 'Not recorded',
      'Prototype: skip the wait', 'GPs online now', '£40 held on your card. Taken only when a GP accepts.',
      'Your price is still £32.', 'Dr Quick is for urgent but non-emergency care.',
    ]) {
      expect(sample, sample).not.toMatch(BANNED);
    }
  });

  test('the reader joins adjacent elements with a space and reads labels', () => {
    const root = document.createElement('div');
    root.innerHTML = '<span>3</span><span>GPs online</span><button aria-label="Priority queue"></button>';
    expect(readable(root)).toMatch(/3 GPs online/);
    expect(readable(root)).toContain('Priority queue');
  });
});

describe('every route, both modes: the frame', () => {
  test.each(CASES)('$path ($mode): the ribbon verbatim, exactly one h1, at most one band card, the jumper last', (c) => {
    const { shell } = mount(c);
    // The mode really applied: the sweep must not quietly test blank twice.
    expect(document.documentElement.dataset.figures).toBe(c.figures);

    const ribbons = shell.querySelectorAll('[data-slot="ribbon"]');
    expect(ribbons).toHaveLength(1);
    expect(ribbons[0].textContent).toBe(RIBBON);

    expect(document.querySelectorAll('h1')).toHaveLength(1);
    expect(document.querySelectorAll('[data-slot="card"][data-variant="band"]').length).toBeLessThanOrEqual(1);

    const last = shell.lastElementChild;
    expect(last?.matches('nav[aria-label="Prototype navigation"]'), `last in the shell: ${last?.outerHTML.slice(0, 80)}`).toBe(true);
  });
});

describe('every route, both modes: the copy and the controls', () => {
  test.each(CASES)('$path ($mode): no banned wording, no named control, no form action, and tel: dials only 999 or 111', (c) => {
    mount(c);
    const text = readable(document.body);
    expect(text.match(BANNED)?.[0] ?? null).toBeNull();

    const named = [...document.querySelectorAll('input[name], textarea[name], select[name], button[name]')];
    expect(named.map((el) => el.outerHTML)).toEqual([]);
    expect(document.querySelectorAll('form[action]')).toHaveLength(0);

    const dialled = [...document.querySelectorAll('a[href^="tel:"]')].map((a) => a.getAttribute('href'));
    expect(dialled.filter((href) => href !== 'tel:999' && href !== 'tel:111')).toEqual([]);
  });
});

describe('every route that must carry 999 does, in both modes', () => {
  test.each(CASES.filter((c) => NEEDS_999.has(c.path)))('$path ($mode): a tel:999 link', (c) => {
    mount(c);
    expect(document.querySelector('a[href="tel:999"]')).not.toBeNull();
  });
});
