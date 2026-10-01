// @vitest-environment jsdom
import { test, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { GpSignupDialog } from '@/components/GpSignupDialog';
import { installDomStubs } from './helpers/dom-stubs';

beforeEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  installDomStubs();
  window.history.replaceState(null, '', '/');
});

// The page's three ways in, as app/page.tsx and components/Nav.tsx author them,
// beside the pop-up they open.
function page() {
  return render(
    <>
      <a id="nav-cta" href="#gp-join" data-gp-signup="nav-gp">Sign up</a>
      <button type="button" id="gp-join" data-gp-signup="hero-gp">Sign up as a GP</button>
      <button type="button" id="gp-join2" data-gp-signup="recap-gp"><span>Sign up as a GP</span></button>
      <a id="elsewhere" href="#gp-pay-title">See what you keep</a>
      <GpSignupDialog />
    </>,
  );
}

const dialog = () => screen.queryByRole('dialog');
const source = () => document.querySelector('[role="dialog"] form')?.getAttribute('data-source');

test('nothing opens by itself: no timer, no scroll, no pop-up on arrival', () => {
  vi.useFakeTimers();
  page();
  vi.advanceTimersByTime(120_000);
  fireEvent.scroll(window, { target: { scrollY: 4000 } });
  expect(dialog()).toBeNull();
  vi.useRealTimers();
});

test.each([
  ['#nav-cta', 'nav-gp'],
  ['#gp-join', 'hero-gp'],
  ['#gp-join2 span', 'recap-gp'], // a click on what is inside the button counts
] as const)('a click on %s opens the sign-up and records where it came from', (selector, from) => {
  page();
  fireEvent.click(document.querySelector(selector)!);
  expect(dialog()).toBeInTheDocument();
  expect(source()).toBe(from);
});

test('a link that is not a sign-up, and a modified click on one that is, are left alone', () => {
  page();
  fireEvent.click(document.getElementById('elsewhere')!);
  expect(dialog()).toBeNull();
  // Ctrl or Cmd click is "open in a new tab": not ours to take.
  const allowed = fireEvent.click(document.getElementById('nav-cta')!, { ctrlKey: true });
  expect(allowed).toBe(true);
  expect(dialog()).toBeNull();
});

test('the pop-up is a named dialog carrying the offer, the four fields, the fee and one action', () => {
  page();
  fireEvent.click(document.getElementById('gp-join')!);
  const d = screen.getByRole('dialog', { name: 'Sign up as a GP' });
  expect(d).toHaveAccessibleDescription('Four details, then one payment on Stripe’s secure page.');

  // What a GP keeps, as the three steps of lib/finance/commission.ts.
  expect(d).toHaveTextContent('Keep 60% of every consultation.');
  const steps = [...d.querySelectorAll('.commission-ladder li')].map((li) => li.textContent);
  expect(steps).toEqual([
    '60%To start, from your first consultation',
    '70%After 100 completed consultations',
    '75%After 500 completed consultations',
  ]);

  // Where the reader is: details now, payment next.
  const progress = within(d).getByRole('list', { name: 'Sign-up steps' });
  expect([...progress.querySelectorAll('li')].map((li) => [li.textContent, li.getAttribute('aria-current')]))
    .toEqual([['1. Your details', 'step'], ['2. Payment', null]]);

  for (const label of ['Full name', 'Email', 'Mobile number', 'GMC number']) {
    expect(within(d).getByLabelText(label)).toBeInTheDocument();
  }
  expect(d.querySelector('.fee')).toHaveTextContent('£50');
  expect(d.querySelector('.fee')).toHaveTextContent('Refunded in full');
  // One action, plus the way out.
  expect(within(d).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent))
    .toEqual(['Close sign-up', 'Continue to payment']);
});

test('on a computer the first field takes the focus; on a phone the panel does, so no keyboard covers the offer', async () => {
  page();
  fireEvent.click(document.getElementById('gp-join')!);
  await waitFor(() => expect(screen.getByLabelText('Full name')).toHaveFocus());

  cleanup();
  installDomStubs({ mobile: true });
  page();
  fireEvent.click(document.getElementById('gp-join')!);
  await waitFor(() => expect(screen.getByRole('dialog')).toHaveFocus());
  expect(screen.getByLabelText('Full name')).not.toHaveFocus();
});

test('Escape and the close mark both dismiss it', async () => {
  page();
  fireEvent.click(document.getElementById('gp-join')!);
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await waitFor(() => expect(dialog()).toBeNull());

  fireEvent.click(document.getElementById('gp-join')!);
  fireEvent.click(screen.getByRole('button', { name: 'Close sign-up' }));
  await waitFor(() => expect(dialog()).toBeNull());
});

// Other pages link here with #gp-join ("I'm a GP"), and Stripe's back arrow
// returns to it. Either is a request for the sign-up.
test('arriving on #gp-join opens the sign-up, and closing it tidies the address but keeps the role', async () => {
  window.history.replaceState(null, '', '/?role=gp#gp-join');
  page();
  expect(dialog()).toBeInTheDocument();
  expect(source()).toBe('link-gp');
  expect(document.querySelector('[data-notice]')).toBeNull();

  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await waitFor(() => expect(dialog()).toBeNull());
  expect(`${location.pathname}${location.search}${location.hash}`).toBe('/?role=gp');
});

test('coming back from Stripe without paying says so, and that nothing was taken', async () => {
  window.history.replaceState(null, '', '/?checkout=cancelled#gp-join');
  page();
  expect(document.querySelector('[data-notice]'))
    .toHaveTextContent('Your payment wasn’t completed, so nothing was taken. Enter your details to try again.');

  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await waitFor(() => expect(dialog()).toBeNull());
  expect(`${location.pathname}${location.search}${location.hash}`).toBe('/');

  // Opened again by hand, the notice from the earlier visit is gone.
  fireEvent.click(document.getElementById('gp-join')!);
  expect(document.querySelector('[data-notice]')).toBeNull();
});

test('a hash that changes to #gp-join while the page is open opens it too', () => {
  page();
  expect(dialog()).toBeNull();
  window.history.replaceState(null, '', '/#gp-join');
  fireEvent(window, new HashChangeEvent('hashchange'));
  expect(dialog()).toBeInTheDocument();
});

test('a click-opened pop-up leaves the address alone when it closes', async () => {
  window.history.replaceState(null, '', '/?role=patient');
  page();
  fireEvent.click(document.getElementById('gp-join')!);
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await waitFor(() => expect(dialog()).toBeNull());
  expect(`${location.pathname}${location.search}`).toBe('/?role=patient');
});
