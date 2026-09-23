// @vitest-environment jsdom
import { test, expect, vi, beforeEach, describe } from 'vitest';
import { StrictMode, type MouseEvent, type ReactNode } from 'react';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
vi.mock('next/navigation', () => import('./helpers/next-navigation'));
vi.mock('next/link', () => import('./helpers/next-link'));
vi.mock('sonner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('sonner')>();
  return { ...actual, toast: Object.assign(vi.fn(), { dismiss: vi.fn() }) };
});
import { toast, type Action } from 'sonner';
import { renderPatient, nav } from './helpers/render-patient';
import { renderAt } from './helpers/render-at';
import { setDocumentHidden } from './helpers/dom-stubs';
import { BookingFlow } from '@/components/patient/BookingFlow';
import { useBooking } from '@/components/patient/BookingProvider';
import { PatientProviders } from '@/components/patient/PatientProviders';
import { usePatient } from '@/components/patient/PatientProvider';
import { useDataMode } from '@/lib/data-mode';
import { AUTHORISE_MS, IDENTITY_CHECK_MS, type BookingScreen, type BookingState, type SavedPractice } from '@/lib/booking-flow';
import type { ConsultationRow } from '@/lib/booking';
import { CONSULTATIONS } from '@/lib/fixtures';

/* The provider's contracts: the URL follows the reducer, the reducer follows
   the URL only while nothing is held, the queue runs on the wall clock, the
   match interrupts a patient who has looked away (and only them), and what a
   booking produces lands in the account and nowhere else. */

const T0 = Date.parse('2026-08-28T14:00:00Z');
const SEEDED = 'data=seeded';

// Reads the booking and the account the way data-mode.test.tsx reads the mode:
// rendered into outputs beside the flow, so one query answers for the state.
function Probe() {
  const { state } = useBooking();
  const { history, identityVerified, identityChecked, saved } = usePatient();
  const { setMode } = useDataMode();
  return (
    <div data-testid="probe">
      <output data-testid="booking">{JSON.stringify(state)}</output>
      <output data-testid="account">{JSON.stringify({ history, identityVerified, identityChecked, saved })}</output>
      <button type="button" onClick={() => setMode('placeholder')}>Probe: switch to blank</button>
    </div>
  );
}

type Account = { history: ConsultationRow[]; identityVerified: boolean; identityChecked: boolean; saved: SavedPractice | null };
const booking = (): BookingState => JSON.parse(screen.getByTestId('booking').textContent ?? 'null');
const account = (): Account => JSON.parse(screen.getByTestId('account').textContent ?? 'null');

const ui = <><BookingFlow /><Probe /></>;
const land = (id: BookingScreen, query?: string) => renderPatient(ui, { pathname: `/patient/book/${id}`, query });

function StrictPatientProviders({ children }: { children: ReactNode }) {
  return <StrictMode><PatientProviders>{children}</PatientProviders></StrictMode>;
}
const landStrict = (id: BookingScreen, query?: string) =>
  renderAt(ui, { pathname: `/patient/book/${id}`, query, providers: StrictPatientProviders });

const startClock = () => { vi.useFakeTimers(); vi.setSystemTime(T0); };
const tick = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const root = () => document.querySelector<HTMLElement>('[data-screen]')!;
const shownScreen = () => root().dataset.screen;
const place = () => root().querySelector('[data-slot="stat-value"]')?.textContent;   // Finding's first tile: the ordinal
const quoteAmount = () => root().querySelector('[data-slot="quote-amount"]')?.textContent;
const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const choose = (label: string) => fireEvent.click(screen.getByText(label, { selector: '[data-slot="choice-row"] > span' }));
const readyTitle = () => document.head.querySelector('title[data-slot="ready-title"]');
const replaced = () => nav.router.replace.mock.calls.map(([href]) => href);

beforeEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.mocked(toast).mockClear();
  vi.mocked(toast.dismiss).mockClear();
  document.head.querySelectorAll('title').forEach((title) => title.remove());
});

test('the URL follows the reducer: Continue on symptoms replaces the URL with the next screen, query kept, exactly once, never a push', () => {
  land('symptoms', SEEDED);
  choose('Sore throat or cough');
  choose('Today');
  expect(nav.router.replace).not.toHaveBeenCalled();   // an answer is not a move
  press('Continue');
  expect(shownScreen()).toBe('safety-check');
  expect(nav.router.replace).toHaveBeenCalledTimes(1);
  expect(nav.router.replace).toHaveBeenCalledWith('/patient/book/safety-check?data=seeded');
  expect(nav.router.push).not.toHaveBeenCalled();
});

test('state follows the URL while the booking is open: a typed URL moves it, seeds the skipped steps, keeps an answer, and calls no router', () => {
  const { setPath } = land('symptoms', SEEDED);
  choose('Stomach pain');
  setPath('/patient/book/quote');
  expect(shownScreen()).toBe('quote');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Your price, in full');
  expect(booking()).toMatchObject({
    screen: 'quote',
    complaint: 'stomach',                     // the patient's own answer survives the seed
    duration: '2–3 days', identityVerified: true, nhsGpConsent: true, quote: 40,
    nav: 0,                                   // a jump is not a move, so there is nothing for the URL to follow
  });
  expect(quoteAmount()).toBe('£40');
  expect(nav.router.replace).not.toHaveBeenCalled();
  expect(nav.router.push).not.toHaveBeenCalled();
});

describe('the lock: while a hold is live a URL cannot move the booking', () => {
  test('on finding, a typed URL is put back with router.replace, the finding screen stays, and the queue keeps advancing', () => {
    startClock();
    const { setPath } = land('finding', SEEDED);
    expect(place()).toBe('3rd');
    setPath('/patient/book/quote');
    expect(replaced()).toEqual([expect.stringMatching(/^\/patient\/book\/finding(\?|$)/)]);
    expect(shownScreen()).toBe('finding');
    expect(booking()).toMatchObject({ screen: 'finding', quote: 40, hold: { status: 'authorised', amount: 40 } });
    tick(45_000);
    expect(place()).toBe('2nd');
    expect(nav.router.push).not.toHaveBeenCalled();
  });

  test.each(['ready', 'call', 'outcome', 'ended-early'] as const)(
    'a seeded %s has the payment captured, so a typed URL is put back there too',
    (id) => {
      const { setPath } = land(id, SEEDED);
      expect(booking().hold).toEqual({ status: 'captured', amount: 40 });
      setPath('/patient/book/symptoms');
      expect(shownScreen()).toBe(id);
      expect(replaced()).toEqual([expect.stringMatching(new RegExp(`^/patient/book/${id}(\\?|$)`))]);
    },
  );
});

test('a finished booking is not reopened by a URL: after a cancel, a typed URL starts afresh with nothing selected, and the cancel stays in history', () => {
  const { setPath } = land('finding', SEEDED);
  press('Cancel request');
  const dialog = screen.getByRole('dialog', { name: 'Cancel your request?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel request' }));
  expect(shownScreen()).toBe('cancelled');
  setPath('/patient/book/symptoms');
  expect(shownScreen()).toBe('symptoms');
  const radios = screen.getAllByRole('radio');
  expect(radios).toHaveLength(7);   // four symptoms, three durations
  for (const radio of radios) expect(radio).not.toBeChecked();
  expect(booking()).toMatchObject({ complaint: null, duration: null, flags: [], quote: null, hold: { status: 'none' }, record: null });
  expect(account().history[0]).toMatchObject({ id: 'C-0032', status: 'cancelled', cost: 0 });
});

describe('the queue runs on the wall clock', () => {
  test('blank: 1st in the queue, still finding at 44s, matched to GP-002 at 45s', () => {
    startClock();
    land('finding');
    expect(place()).toBe('1st');
    tick(44_000);
    expect(shownScreen()).toBe('finding');
    tick(1_000);
    expect(shownScreen()).toBe('ready');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Your GP is ready');
    expect(root()).toHaveTextContent('GP-002 has accepted your consultation and is waiting for you.');
    expect(booking()).toMatchObject({ gp: { ref: 'GP-002' }, hold: { status: 'captured', amount: 32 }, matchedAt: T0 + 45_000 });
  });

  test('seeded: 3rd, then 2nd at 45s, 1st at 90s, ready at 135s, and the URL follows the match', () => {
    startClock();
    land('finding', SEEDED);
    expect(place()).toBe('3rd');
    tick(44_000);
    expect(place()).toBe('3rd');
    tick(1_000);
    expect(place()).toBe('2nd');
    tick(44_000);
    expect(place()).toBe('2nd');
    tick(1_000);
    expect(place()).toBe('1st');
    tick(44_000);
    expect(shownScreen()).toBe('finding');
    tick(1_000);
    expect(shownScreen()).toBe('ready');
    expect(booking()).toMatchObject({ gp: { ref: 'GP-002' }, hold: { status: 'captured', amount: 40 }, matchedAt: T0 + 135_000 });
    expect(replaced()).toEqual(['/patient/book/ready?data=seeded']);
  });
});

describe('a hidden tab neither stretches nor stalls the queue', () => {
  test('while hidden the place does not tick, but the match lands on time: the title changes and one toast waits', () => {
    startClock();
    land('finding', SEEDED);
    act(() => setDocumentHidden(true));
    tick(134_000);
    expect(shownScreen()).toBe('finding');
    expect(place()).toBe('3rd');              // nobody is looking, so nothing re-renders per second
    expect(readyTitle()).toBeNull();
    tick(1_000);
    expect(shownScreen()).toBe('ready');
    expect(booking().matchedAt).toBe(T0 + 135_000);
    expect(readyTitle()).not.toBeNull();      // what a patient in another tab actually sees
    expect(toast).toHaveBeenCalledTimes(1);
    act(() => setDocumentHidden(false));
    expect(shownScreen()).toBe('ready');
    expect(toast).toHaveBeenCalledTimes(1);
  });

  test('under StrictMode a match while hidden still lands once, with one toast', () => {
    startClock();
    landStrict('finding');
    act(() => setDocumentHidden(true));
    tick(45_000);
    expect(shownScreen()).toBe('ready');
    expect(toast).toHaveBeenCalledTimes(1);
  });

  test('the hidden time counts: back after 60s the patient is 2nd, not still 3rd', () => {
    startClock();
    land('finding', SEEDED);
    act(() => setDocumentHidden(true));
    tick(60_000);
    expect(place()).toBe('3rd');
    act(() => setDocumentHidden(false));
    expect(place()).toBe('2nd');
  });
});

describe('the toast fires only when the patient is away', () => {
  test('matched while the booking is in view: the ready screen is the interrupt, no toast', () => {
    startClock();
    land('finding');
    tick(45_000);
    expect(shownScreen()).toBe('ready');
    expect(toast).not.toHaveBeenCalled();
  });

  test('matched while the tab is hidden: one toast naming GP-002; leaving ready dismisses it', () => {
    land('finding');
    act(() => setDocumentHidden(true));
    press('Prototype: skip the wait');
    expect(shownScreen()).toBe('ready');
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith('Your GP is ready', expect.objectContaining({
      id: 'gp-ready', description: expect.stringContaining('GP-002'),
    }));
    act(() => setDocumentHidden(false));
    expect(toast).toHaveBeenCalledTimes(1);   // once per match, not once per look
    vi.mocked(toast.dismiss).mockClear();     // it is also called on every screen that is not ready
    press('Join the call');
    expect(shownScreen()).toBe('call');
    expect(toast.dismiss).toHaveBeenCalledWith('gp-ready');
  });

  test('matched while on another patient page: one toast and the URL left alone; the toast’s Join opens the call', () => {
    startClock();
    const { setPath } = land('finding');
    setPath('/patient');
    tick(45_000);
    expect(booking().screen).toBe('ready');
    expect(toast).toHaveBeenCalledTimes(1);
    expect(nav.router.replace).not.toHaveBeenCalled();   // off the booking route the URL is not followed
    const action = vi.mocked(toast).mock.calls[0][1]?.action as Action;
    expect(action.label).toBe('Join');
    act(() => action.onClick({} as MouseEvent<HTMLButtonElement>));
    expect(booking().screen).toBe('call');
    expect(nav.router.push).toHaveBeenCalledWith('/patient/book/call');
    expect(toast.dismiss).toHaveBeenLastCalledWith('gp-ready');
  });

  test('under StrictMode a match while away still toasts exactly once', () => {
    startClock();
    const { setPath } = landStrict('finding');
    setPath('/patient');
    tick(45_000);
    expect(booking().screen).toBe('ready');
    expect(toast).toHaveBeenCalledTimes(1);
  });
});

test('the tab title: while the GP waits a ready <title> is kept first in <head>, even over a route title; joining removes it', async () => {
  land('finding');
  expect(readyTitle()).toBeNull();
  press('Prototype: skip the wait');
  expect(document.title).toBe('Your GP is ready — Dr Quick');
  expect(readyTitle()).not.toBeNull();
  expect(document.head.firstElementChild).toBe(readyTitle());
  // Next re-renders the route's metadata title after a navigation.
  const routeTitle = document.createElement('title');
  routeTitle.textContent = 'See a GP — Dr Quick';
  document.head.prepend(routeTitle);
  expect(document.head.firstElementChild).toBe(routeTitle);   // displaced, until the observer puts it back
  await waitFor(() => expect(document.head.firstElementChild).toBe(readyTitle()));
  expect(document.title).toBe('Your GP is ready — Dr Quick');
  press('Join the call');
  expect(shownScreen()).toBe('call');
  expect(readyTitle()).toBeNull();
  expect(document.title).toBe('See a GP — Dr Quick');
});

// A link opened in a background tab: the page mounts with the document already
// hidden. renderAt clears instance overrides, so this one sits on the prototype.
function inBackgroundTab(run: () => void) {
  const visible = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
  if (!visible) throw new Error('jsdom no longer defines Document.prototype.hidden');
  Object.defineProperty(Document.prototype, 'hidden', { configurable: true, get: () => true });
  try { run(); } finally { Object.defineProperty(Document.prototype, 'hidden', visible); }
}

describe('landing on /patient/book/ready?data=seeded by URL never toasts', () => {
  test('not when it opens in a background tab', () => {
    inBackgroundTab(() => {
      land('ready', SEEDED);
      expect(document.hidden).toBe(true);
      expect(root()).toHaveTextContent('GP-002 has accepted your consultation and is waiting for you.');
      expect(booking().matchedAt).toBeNull();
      expect(toast).not.toHaveBeenCalled();
    });
  });

  test('not when the patient then looks away or goes elsewhere', () => {
    const { setPath } = land('ready', SEEDED);
    expect(booking().gp?.ref).toBe('GP-002');
    act(() => setDocumentHidden(true));
    setPath('/patient');
    expect(toast).not.toHaveBeenCalled();
  });
});

describe('what a booking produces lands in the account', () => {
  test('Continue on a seeded outcome puts C-0032 first in history at £40, and it is the only new row', () => {
    land('outcome', SEEDED);
    press('Continue');
    expect(shownScreen()).toBe('done');
    const { history } = account();
    expect(history[0]).toMatchObject({ id: 'C-0032', cost: 40, isNew: true, status: 'completed', gp: 'GP-002' });
    expect(history.filter((row) => row.isNew)).toHaveLength(1);
    expect(history.slice(1).map((row) => row.id)).toEqual(CONSULTATIONS.map((row) => row.id));
  });

  test('under StrictMode the record is written once', () => {
    landStrict('outcome', SEEDED);
    press('Continue');
    expect(shownScreen()).toBe('done');
    const { history } = account();
    expect(history.filter((row) => row.id === 'C-0032')).toHaveLength(1);
    expect(history).toHaveLength(CONSULTATIONS.length + 1);
  });
});

describe('identity reaches the account only when the check runs', () => {
  test('blank: the ID check marks the account verified when it lands after IDENTITY_CHECK_MS, not before', () => {
    startClock();
    land('identity');
    expect(account()).toMatchObject({ identityVerified: false, identityChecked: false });
    press('Verify identity');
    tick(IDENTITY_CHECK_MS - 1);
    expect(account().identityVerified).toBe(false);
    tick(1);
    expect(shownScreen()).toBe('nhs-gp');
    expect(account()).toMatchObject({ identityVerified: true, identityChecked: true });
  });

  test('a landing past identity checks nothing: seeded is on file but not identityChecked; blank is neither', () => {
    land('quote', SEEDED);
    expect(booking()).toMatchObject({ identityVerified: true, identityChecked: false });
    expect(account()).toMatchObject({ identityVerified: true, identityChecked: false });
    cleanup();
    land('quote');
    expect(booking()).toMatchObject({ identityVerified: true, identityChecked: false });
    expect(account()).toMatchObject({ identityVerified: false, identityChecked: false });
  });
});

describe('the practice a patient answers is remembered', () => {
  const answer = (practice: string, postcode: string) => {
    fireEvent.change(screen.getByLabelText('GP practice name'), { target: { value: practice } });
    fireEvent.change(screen.getByLabelText('Practice postcode'), { target: { value: postcode } });
    press('Yes, share with my NHS GP');
  };

  test('a first patient’s answer is remembered, trimmed, with the postcode normalised', () => {
    land('nhs-gp');
    expect(account().saved).toBeNull();
    answer('  Example Surgery ', 'n19aa');
    expect(shownScreen()).toBe('quote');
    expect(account().saved).toEqual({ practice: 'Example Surgery', postcode: 'N1 9AA' });
  });

  test('the latest answer wins: a practice corrected after reaching the quote replaces the one remembered', () => {
    land('nhs-gp');
    answer('Exmaple Surgery', 'N1 9AA');
    expect(account().saved).toEqual({ practice: 'Exmaple Surgery', postcode: 'N1 9AA' });
    press('Back');                            // the patient spots the typo on the quote's summary
    answer('Example Surgery', 'N1 9AA');
    expect(shownScreen()).toBe('quote');
    expect(booking().practice).toBe('Example Surgery');
    expect(account().saved).toEqual({ practice: 'Example Surgery', postcode: 'N1 9AA' });
  });

  test('a URL landing is not an answer: after a seeded landing on quote, a flip to blank leaves no practice saved', () => {
    land('quote', SEEDED);
    expect(booking().nav).toBe(0);            // nothing was answered: the landing seeded the consent
    press('Probe: switch to blank');
    expect(account().saved).toEqual(null);
  });

  test('a typed URL is not an answer either: a practice typed but never submitted is not remembered', () => {
    const { setPath } = land('nhs-gp');
    fireEvent.change(screen.getByLabelText('GP practice name'), { target: { value: 'Example Surgery' } });
    fireEvent.change(screen.getByLabelText('Practice postcode'), { target: { value: 'n19aa' } });
    setPath('/patient/book/consent-refused');
    expect(shownScreen()).toBe('consent-refused');
    expect(account().saved).toEqual(null);
  });
});

test('nothing is persisted: a walk from symptoms to finding writes no storage, no cookie, and no answer into a URL', () => {
  startClock();
  const setItem = vi.spyOn(Storage.prototype, 'setItem');
  land('symptoms');
  choose('Something else');
  choose('Over a week');
  fireEvent.change(screen.getByLabelText('Anything else the GP should know?'), { target: { value: 'Ringing in one ear' } });
  press('Continue');
  press('None of these — continue');
  press('Verify identity');
  tick(IDENTITY_CHECK_MS);
  fireEvent.change(screen.getByLabelText('GP practice name'), { target: { value: 'Example Surgery' } });
  fireEvent.change(screen.getByLabelText('Practice postcode'), { target: { value: 'N1 9AA' } });
  press('Yes, share with my NHS GP');
  press('Request a GP for £32');
  tick(AUTHORISE_MS);
  expect(shownScreen()).toBe('finding');
  expect(setItem).not.toHaveBeenCalled();
  expect(document.cookie).toBe('');
  // The URL names the screen and nothing else: no symptom, no free text, no practice, no postcode.
  expect(replaced()).toEqual([
    '/patient/book/safety-check', '/patient/book/identity', '/patient/book/nhs-gp', '/patient/book/quote', '/patient/book/finding',
  ]);
  expect(nav.router.push).not.toHaveBeenCalled();
  expect(window.location.search).toBe('');
});

describe('the data mode arrives after mount', () => {
  test('it re-seeds an untouched landing: /patient/book/quote?data=seeded quotes £40, not £32', () => {
    land('quote', SEEDED);
    expect(quoteAmount()).toBe('£40');
    expect(screen.getByRole('button', { name: 'Request a GP for £40' })).toBeInTheDocument();
    expect(booking()).toMatchObject({ seeded: true, quote: 40, nav: 0 });
  });

  test('once the patient has acted, a mode change keeps the booking and its frozen quote', () => {
    land('quote', SEEDED);
    press('Back');
    expect(shownScreen()).toBe('nhs-gp');
    press('Probe: switch to blank');
    expect(booking()).toMatchObject({ seeded: false, screen: 'nhs-gp', complaint: 'sore-throat', quote: 40 });
    press('Yes, share with my NHS GP');
    expect(shownScreen()).toBe('quote');
    expect(quoteAmount()).toBe('£40');
  });
});
