// @vitest-environment jsdom
import { test, expect, describe, beforeEach, afterAll, vi } from 'vitest';
import { screen, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
vi.mock('next/navigation', () => import('./helpers/next-navigation'));
vi.mock('next/link', () => import('./helpers/next-link'));
vi.mock('sonner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('sonner')>();
  return { ...actual, toast: Object.assign(vi.fn(), { dismiss: vi.fn() }) };
});
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { usePathname } from 'next/navigation';
import { renderPatient, renderBooking, nav } from './helpers/render-patient';
import { PatientHome } from '@/components/patient/PatientHome';
import { Consultations } from '@/components/patient/Consultations';
import { ConsultationDetail } from '@/components/patient/ConsultationDetail';
import { Prescriptions } from '@/components/patient/Prescriptions';
import { Account } from '@/components/patient/Account';
import { BookingFlow } from '@/components/patient/BookingFlow';
import { useBooking } from '@/components/patient/BookingProvider';
import { BOOKING_SCREENS, initialBooking, type BookingState } from '@/lib/booking-flow';

/* The patient surface's destinations: the home, the history and its detail,
   prescriptions and the account, in both data modes, and the navigation that
   joins them. Blank mode is the first patient (nothing on file, every figure a
   dash); seeded is the returning one, read from the fixtures after mount. */

beforeEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.mocked(toast).mockClear(); });
afterAll(() => { cleanup(); });

const SEEDED = { query: 'data=seeded' };
const RIBBON = 'Prototype. Not a live service — no real patients, GPs, or data.';
const EMPTY_HISTORY = 'No consultations yet. Your first one will appear here.';

// Every text node, joined with a space, so two adjacent elements cannot run
// their words together (or apart) in what a pattern sees.
function spokenText(root: Node): string {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) parts.push(node.textContent ?? '');
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

// A StatTile's value, found by its label.
function tile(root: ParentNode, label: string): string {
  const match = [...root.querySelectorAll('[data-slot="stat-tile"]')].find(
    (el) => el.querySelector('[data-slot="stat-value"]')?.nextElementSibling?.textContent === label,
  );
  if (!match) throw new Error(`no stat tile labelled "${label}"`);
  return match.querySelector('[data-slot="stat-value"]')!.textContent ?? '';
}

// Every Facts row under `root`, label to value.
function facts(root: ParentNode): Record<string, string> {
  const rows: Record<string, string> = {};
  root.querySelectorAll('[data-slot="facts"] > div').forEach((row) => {
    const label = row.querySelector('dt')?.textContent;
    if (label) rows[label] = row.querySelector('dd')?.textContent ?? '';
  });
  return rows;
}

// Reads the booking the provider holds, as the next render sees it.
function bookingProbe() {
  const seen: { state: BookingState | null } = { state: null };
  function Probe() {
    seen.state = useBooking().state;
    return null;
  }
  return { Probe, state: () => seen.state! };
}

// The layout's children as the router would pick them: the booking route
// renders the flow, anything else the home. Lets one mounted provider carry a
// booking from its screen to the home and back, as the real layout does.
function PatientRoutes() {
  return usePathname().startsWith('/patient/book') ? <BookingFlow /> : <PatientHome />;
}

const h1 = () => screen.getByRole('heading', { level: 1 });

describe('home', () => {
  test('blank: a first patient is welcomed with nothing claimed — "Not live yet", a dash for the wait, the empty history', () => {
    const { container } = renderPatient(<PatientHome />);
    expect(h1()).toHaveTextContent(/^Welcome$/);
    expect(screen.getByText('Not live yet')).toBeInTheDocument();
    expect(tile(container.querySelector('[data-slot="start-card"]')!, 'Estimated wait')).toBe('—');
    expect(screen.getByText(EMPTY_HISTORY)).toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="consult-row"]')).toHaveLength(0);
  });

  test('blank: no price and no count of GPs anywhere on the home', () => {
    const { container } = renderPatient(<PatientHome />);
    const text = spokenText(container);
    expect(text).not.toContain('£');
    expect(text).not.toMatch(/\d+\s*GPs?\s+online/i);
  });

  test('the landing page\'s 999 sentence sits on the home as a real tel:999 link', () => {
    const { container } = renderPatient(<PatientHome />);
    const band = container.querySelector<HTMLElement>('[data-slot="urgent-line"]')!;
    expect(band).toHaveTextContent(
      'Dr Quick is for urgent but non-emergency care. If something is serious or life-threatening, call 999 or go to A&E.',
    );
    expect(within(band).getByRole('link', { name: 'call 999' })).toHaveAttribute('href', 'tel:999');
  });

  test('"See a GP now" dispatches a fresh booking and pushes to /patient/book/symptoms', () => {
    const probe = bookingProbe();
    const { setPath } = renderPatient(<><PatientHome /><probe.Probe /></>, { pathname: '/patient/book/quote' });
    // A booking already quoted, then left for the home.
    expect(probe.state().screen).toBe('quote');
    expect(probe.state().quote).toBe(32);
    setPath('/patient');

    fireEvent.click(screen.getByRole('button', { name: 'See a GP now' }));

    expect(probe.state()).toEqual({ ...initialBooking(null, { seeded: false, now: 0 }), nav: 1 });
    expect(nav.router.push).toHaveBeenCalledTimes(1);
    expect(nav.router.push).toHaveBeenCalledWith('/patient/book/symptoms');
    expect(nav.router.replace).not.toHaveBeenCalled();
  });

  test('seeded: a returning patient — "Welcome back", "GPs online now" (never a count) and the wait', () => {
    const { container } = renderPatient(<PatientHome />, SEEDED);
    expect(h1()).toHaveTextContent(/^Welcome back$/);
    expect(screen.getByText('GPs online now')).toBeInTheDocument();
    expect(tile(container.querySelector('[data-slot="start-card"]')!, 'Estimated wait')).toBe('about 3 minutes');
    expect(spokenText(container)).not.toMatch(/\d+\s*GPs?\s+online/i);
  });

  test('seeded: the three most recent consultations, newest first, none marked New', () => {
    const { container } = renderPatient(<PatientHome />, SEEDED);
    const rows = [...container.querySelectorAll('[data-slot="consult-row"]')];
    expect(rows.map((row) => row.getAttribute('href'))).toEqual([
      '/patient/consultations/C-0031', '/patient/consultations/C-0022', '/patient/consultations/C-0014',
    ]);
    expect(screen.queryByText('New')).toBeNull();
    expect(screen.getByRole('link', { name: 'See all' })).toHaveAttribute('href', '/patient/consultations');
  });

  test('seeded: "What needs you" lists the waiting prescription, the unshared summary and the practice, each linked', () => {
    renderPatient(<PatientHome />, SEEDED);
    const items = within(screen.getByRole('region', { name: 'What needs you' })).getAllByRole('listitem');
    const read = items.map((item) => {
      const link = within(item).getByRole('link');
      return { title: item.querySelector('p')?.textContent, action: link.textContent, href: link.getAttribute('href') };
    });
    expect(read).toEqual([
      { title: 'A prescription is waiting at your pharmacy', action: 'Track', href: '/patient/prescriptions' },
      { title: 'One consultation was never sent to your NHS GP', action: 'Review', href: '/patient/consultations' },
      { title: 'Confirm your NHS GP practice', action: 'Check', href: '/patient/account' },
    ]);
  });

  test('blank: nothing needs a first patient, so the to-do list is not drawn', () => {
    renderPatient(<PatientHome />);
    expect(screen.queryByRole('region', { name: 'What needs you' })).toBeNull();
  });

  test('while a consultation is live the start card is the way back to it, never a second start', () => {
    const { container, setPath } = renderPatient(<PatientRoutes />, { pathname: '/patient/book/finding' });
    expect(h1()).toHaveTextContent('Finding your GP');

    setPath('/patient');

    expect(h1()).toHaveTextContent(/^Welcome$/);
    const resume = container.querySelector<HTMLElement>('[data-slot="resume-card"]')!;
    expect(resume).not.toBeNull();
    expect(within(resume).getByRole('heading', { name: 'Finding your GP' })).toBeInTheDocument();
    expect(within(resume).getByRole('link', { name: 'Back to your request' })).toHaveAttribute('href', '/patient/book/finding');
    expect(container.querySelector('[data-slot="start-card"]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'See a GP now' })).toBeNull();
    // Leaving the booking route never moved the URL or the booking.
    expect(nav.router.replace).not.toHaveBeenCalled();
    expect(nav.router.push).not.toHaveBeenCalled();
  });
});

describe('consultations', () => {
  const YEAR = ['Consultations', 'Paid to Dr Quick', 'Summaries sent to your NHS GP'];
  const rowsIn = (root: ParentNode) => [...root.querySelectorAll<HTMLAnchorElement>('[data-slot="consult-row"]')];

  test('blank: the empty sentence, and the year\'s three figures are dashes', () => {
    const { container } = renderPatient(<Consultations />, { pathname: '/patient/consultations' });
    expect(screen.getByText(EMPTY_HISTORY)).toBeInTheDocument();
    expect(YEAR.map((label) => tile(container, label))).toEqual(['—', '—', '—']);
    expect(rowsIn(container)).toHaveLength(0);
  });

  test('seeded: four rows, and this year is 3 · £137 · 2 — money summed from what each one cost', () => {
    const { container } = renderPatient(<Consultations />, { pathname: '/patient/consultations', ...SEEDED });
    expect(rowsIn(container)).toHaveLength(4);
    expect(YEAR.map((label) => tile(container, label))).toEqual(['3', '£137', '2']);
  });

  test('the filter is three aria-pressed buttons in a labelled group, All pressed first', () => {
    renderPatient(<Consultations />, { pathname: '/patient/consultations', ...SEEDED });
    const buttons = within(screen.getByRole('group', { name: 'Filter consultations' })).getAllByRole('button');
    expect(buttons.map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['All', 'true'], ['Completed', 'false'], ['Cancelled', 'false'],
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Completed' }));
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
  });

  test('Completed shows the three completed rows', () => {
    const { container } = renderPatient(<Consultations />, { pathname: '/patient/consultations', ...SEEDED });
    fireEvent.click(screen.getByRole('button', { name: 'Completed' }));
    expect(rowsIn(container).map((row) => row.getAttribute('href'))).toEqual([
      '/patient/consultations/C-0031', '/patient/consultations/C-0022', '/patient/consultations/C-0014',
    ]);
  });

  test('Cancelled shows the one that never started, at no charge', () => {
    const { container } = renderPatient(<Consultations />, { pathname: '/patient/consultations', ...SEEDED });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelled' }));
    const rows = rowsIn(container);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Cancelled before it started');
    expect(rows[0]).toHaveTextContent('No charge');
    expect(rows[0]).not.toHaveTextContent('£');
  });

  test('every row links to its own consultation', () => {
    const { container } = renderPatient(<Consultations />, { pathname: '/patient/consultations', ...SEEDED });
    expect(rowsIn(container).map((row) => row.getAttribute('href'))).toEqual(
      ['C-0031', 'C-0022', 'C-0014', 'C-0009'].map((id) => `/patient/consultations/${id}`),
    );
    expect(rowsIn(container)[0]).toHaveTextContent('£46');
  });
});

describe('consultation detail', () => {
  test('seeded C-0031: reference, GP, length and "The call was not recorded"', () => {
    const { container } = renderPatient(<ConsultationDetail />, { pathname: '/patient/consultations/C-0031', ...SEEDED });
    expect(facts(container)).toMatchObject({
      Reference: 'C-0031', GP: 'GP-002', Length: '9 minutes', Recording: 'The call was not recorded',
    });
  });

  test('seeded C-0031: the outcome — sent to the pharmacy, shared as agreed', () => {
    const { container } = renderPatient(<ConsultationDetail />, { pathname: '/patient/consultations/C-0031', ...SEEDED });
    expect(facts(container)).toMatchObject({
      Prescription: 'Sent to your pharmacy', 'Shared with your NHS GP': 'Yes, as you agreed',
    });
  });

  test('seeded C-0031: the receipt is what it cost, and names the pharmacy charge', () => {
    renderPatient(<ConsultationDetail />, { pathname: '/patient/consultations/C-0031', ...SEEDED });
    const receipt = screen.getByRole('region', { name: 'Receipt' });
    expect(receipt).toHaveTextContent('£46');
    expect(receipt).toHaveTextContent('The pharmacy charges separately for the medicine.');
  });

  test('seeded C-0009, cancelled: no GP accepted, no length, no call, no outcome, no charge', () => {
    const { container } = renderPatient(<ConsultationDetail />, { pathname: '/patient/consultations/C-0009', ...SEEDED });
    expect(facts(container)).toMatchObject({
      GP: 'None — no GP accepted', Length: '—', Recording: 'No call took place',
    });
    expect(screen.getByText('No outcome. This consultation was cancelled before a GP accepted it.')).toBeInTheDocument();
    const receipt = screen.getByRole('region', { name: 'Receipt' });
    expect(receipt).toHaveTextContent('No charge');
    expect(receipt).not.toHaveTextContent('£');
  });

  test.each([
    { name: 'an unknown id', id: 'C-9999', query: SEEDED.query },
    { name: 'C-0031 in blank mode', id: 'C-0031', query: undefined },
  ])('$name shows the honest placeholder and never echoes the id', ({ id, query }) => {
    const { container } = renderPatient(<ConsultationDetail />, { pathname: `/patient/consultations/${id}`, query });
    expect(h1()).toHaveTextContent('No consultation selected');
    expect(facts(container)).toMatchObject({ Reference: '—', GP: '—', Recording: 'Calls are never recorded' });
    expect(container.textContent).not.toContain(id);
  });

  test('a "Back to consultations" link leads to the list', () => {
    renderPatient(<ConsultationDetail />, { pathname: '/patient/consultations/C-0031', ...SEEDED });
    expect(screen.getByRole('link', { name: 'Back to consultations' })).toHaveAttribute('href', '/patient/consultations');
  });
});

describe('prescriptions', () => {
  const cardsIn = (root: ParentNode) => [...root.querySelectorAll<HTMLElement>('[data-slot="prescription"]')];

  test('blank: the empty sentence', () => {
    const { container } = renderPatient(<Prescriptions />, { pathname: '/patient/prescriptions' });
    expect(screen.getByText('No prescriptions yet. Any a GP writes for you will appear here.')).toBeInTheDocument();
    expect(cardsIn(container)).toHaveLength(0);
  });

  test('seeded: two cards, "With your pharmacy" and "Collected", each at Example Pharmacy, London N1', () => {
    const { container } = renderPatient(<Prescriptions />, { pathname: '/patient/prescriptions', ...SEEDED });
    const cards = cardsIn(container);
    expect(cards.map((card) => card.dataset.rx)).toEqual(['RX-0031', 'RX-0014']);
    expect(cards.map((card) => within(card).getByRole('heading', { level: 2 }).textContent)).toEqual(['With your pharmacy', 'Collected']);
    for (const card of cards) expect(card).toHaveTextContent('Example Pharmacy, London N1');
  });

  test('seeded: the step a prescription is on carries aria-current="step" — "Ready to collect" on RX-0031, none once collected', () => {
    const { container } = renderPatient(<Prescriptions />, { pathname: '/patient/prescriptions', ...SEEDED });
    const [open, collected] = cardsIn(container);
    const current = open.querySelectorAll('[aria-current="step"]');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('Ready to collect');
    expect(collected.querySelectorAll('[aria-current]')).toHaveLength(0);
  });

  test('seeded: each card says what its own consultation\'s price covered, and that the pharmacy charges separately', () => {
    const { container } = renderPatient(<Prescriptions />, { pathname: '/patient/prescriptions', ...SEEDED });
    const [open, collected] = cardsIn(container);
    const line = (amount: string) =>
      `Your ${amount} covered the consultation and writing this prescription. The pharmacy charges you separately for the medicine.`;
    expect(open).toHaveTextContent(line('£46'));
    expect(collected).toHaveTextContent(line('£52'));
  });

  test('the lead names the pharmacy charge and states no figure', () => {
    const { container } = renderPatient(<Prescriptions />, { pathname: '/patient/prescriptions', ...SEEDED });
    const lead = container.querySelector('[data-slot="page-header"] p')!;
    expect(lead).toHaveTextContent('The pharmacy charges you separately for the medicine itself.');
    expect(lead.textContent).not.toMatch(/£|\d/);
  });
});

describe('account', () => {
  test('blank: nothing on file — a dash for member since, not yet checked, no practice, no card, England only', () => {
    const { container } = renderPatient(<Account />, { pathname: '/patient/account' });
    expect(facts(container)).toMatchObject({ 'Member since': '—', 'Available in': 'England only' });
    expect(screen.getByText('Not yet checked')).toBeInTheDocument();
    expect(screen.getByText('No practice saved')).toBeInTheDocument();
    expect(screen.getByText('No card saved')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a card' })).toBeInTheDocument();
  });

  test('the sharing switch is on by default, and the sentence beside it says what each position does', () => {
    renderPatient(<Account />, { pathname: '/patient/account' });
    const share = screen.getByRole('switch', { name: 'Share summaries' });
    expect(share).toBeChecked();
    const consequence = screen.getByText('Each consultation summary is sent here.');
    expect(consequence).toHaveAttribute('aria-live', 'polite');

    fireEvent.click(share);

    expect(share).not.toBeChecked();
    expect(screen.getByText('Nothing is sent. A GP may be unable to prescribe some treatments without your records.')).toBe(consequence);
    expect(screen.queryByText('Each consultation summary is sent here.')).toBeNull();
  });

  test.each([
    { label: 'Add a card', nothing: 'Nothing was changed.' },
    { label: 'Request', nothing: 'Nothing was sent.' },
    { label: 'Delete', nothing: 'Nothing was deleted.' },
  ])('$label is no dead click: it toasts "Not in the prototype" and says nothing happened', ({ label, nothing }) => {
    renderPatient(<Account />, { pathname: '/patient/account' });
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith('Not in the prototype', { description: expect.stringContaining(nothing) });
  });

  test('seeded: a returning patient — member since March 2026, verified, their practice and their card', () => {
    const { container } = renderPatient(<Account />, { pathname: '/patient/account', ...SEEDED });
    expect(facts(container)).toMatchObject({ 'Member since': 'March 2026', 'Available in': 'England only' });
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.queryByText('Not yet checked')).toBeNull();
    expect(screen.getByText('Example Medical Centre, London')).toBeInTheDocument();
    expect(screen.getByText('Visa ending 4242')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replace' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add a card' })).toBeNull();
  });

  test('"Replace" is no dead click either', () => {
    renderPatient(<Account />, { pathname: '/patient/account', ...SEEDED });
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
    expect(toast).toHaveBeenCalledWith('Not in the prototype', { description: expect.stringContaining('Nothing was changed.') });
  });

  test('a tel:999 link sits at the foot of the account', () => {
    const { container } = renderPatient(<Account />, { pathname: '/patient/account' });
    const urgent = container.querySelector('[data-slot="urgent-line"]')!;
    expect(urgent.parentElement!.lastElementChild).toBe(urgent);
    expect(urgent.querySelector('a[href="tel:999"]')).not.toBeNull();
  });
});

describe('navigation and the shell', () => {
  type Destination = { path: string; ui: () => ReactNode; current: string };
  const DESTINATIONS: Destination[] = [
    { path: '/patient', ui: () => <PatientHome />, current: 'Home' },
    { path: '/patient/consultations', ui: () => <Consultations />, current: 'Consultations' },
    { path: '/patient/prescriptions', ui: () => <Prescriptions />, current: 'Prescriptions' },
    { path: '/patient/account', ui: () => <Account />, current: 'Account' },
    { path: '/patient/consultations/C-0031', ui: () => <ConsultationDetail />, current: 'Consultations' },
  ];
  const shellOf = (container: HTMLElement) => container.querySelector<HTMLElement>('[data-surface="patient"]')!;

  test('there is exactly one account nav, "Your account", with Home, Consultations, Prescriptions and Account', () => {
    const { container } = renderPatient(<PatientHome />, { shell: true });
    const navs = screen.getAllByRole('navigation', { name: 'Your account' });
    expect(navs).toHaveLength(1);
    expect(container.querySelectorAll('[data-slot="patient-nav"]')).toHaveLength(1);
    const links = within(navs[0]).getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Home', '/patient'],
      ['Consultations', '/patient/consultations'],
      ['Prescriptions', '/patient/prescriptions'],
      ['Account', '/patient/account'],
    ]);
  });

  test.each(DESTINATIONS)('$path: aria-current="page" on $current alone, in a dashboard area', ({ path, ui, current }) => {
    const { container } = renderPatient(ui(), { pathname: path, shell: true });
    const links = within(screen.getByRole('navigation', { name: 'Your account' })).getAllByRole('link');
    expect(links.filter((link) => link.getAttribute('aria-current') === 'page').map((link) => link.textContent)).toEqual([current]);
    expect(links.filter((link) => link.hasAttribute('aria-current'))).toHaveLength(1);
    expect(shellOf(container)).toHaveAttribute('data-area', 'dash');
  });

  test('/patient/book: the account nav steps aside and the shell is a flow area', () => {
    const { container } = renderPatient(<BookingFlow />, { pathname: '/patient/book', shell: true });
    expect(screen.queryByRole('navigation', { name: 'Your account' })).toBeNull();
    expect(container.querySelector('[data-slot="patient-nav"]')).toBeNull();
    expect(shellOf(container)).toHaveAttribute('data-area', 'flow');
  });

  test.each(BOOKING_SCREENS)('/patient/book/%s: the account nav steps aside and the shell is a flow area', (bookingScreen) => {
    const { container } = renderBooking(bookingScreen, { shell: true });
    expect(screen.queryByRole('navigation', { name: 'Your account' })).toBeNull();
    expect(container.querySelector('[data-slot="patient-nav"]')).toBeNull();
    expect(shellOf(container)).toHaveAttribute('data-area', 'flow');
  });

  test.each([
    { name: 'a destination', mount: () => renderPatient(<PatientHome />, { shell: true }) },
    { name: 'a booking screen', mount: () => renderBooking('symptoms', { shell: true }) },
  ])('on $name the ribbon opens the sticky header and reads exactly the prototype sentence', ({ mount }) => {
    const { container } = mount();
    const ribbon = container.querySelector('[data-slot="ribbon"]')!;
    const header = container.querySelector('[data-slot="top-bar"]')!.parentElement!;
    expect(header).toHaveClass('sticky');
    expect(header.firstElementChild).toBe(ribbon);
    expect(ribbon.textContent).toBe(RIBBON);
    expect(container.querySelectorAll('[data-slot="ribbon"]')).toHaveLength(1);
  });

  test('the skip link comes first in the shell and targets #main', () => {
    const { container } = renderPatient(<PatientHome />, { shell: true });
    const skip = screen.getByRole('link', { name: 'Skip to content' });
    expect(skip).toHaveAttribute('href', '#main');
    expect(shellOf(container).firstElementChild).toBe(skip);
    expect(container.querySelector('#main')).toBe(container.querySelector('main'));
  });
});
