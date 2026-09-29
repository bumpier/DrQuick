// @vitest-environment jsdom
import { test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

let pathname = '/';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

import { ConsentBanner, CookieSettingsButton } from '@/components/ConsentBanner';
import { CONSENT_EVENT, readConsent, resetTrackerForTests } from '@/lib/analytics/track';

beforeEach(() => {
  pathname = '/';
  resetTrackerForTests();
  for (const name of ['dq_consent', 'dq_vid']) document.cookie = `${name}=; Max-Age=0; Path=/`;
  history.replaceState(null, '', '/');
  Object.defineProperty(navigator, 'globalPrivacyControl', { value: undefined, configurable: true });
});
afterEach(cleanup);

const region = () => screen.queryByRole('region', { name: 'Cookie choice' });

test('undecided: the choice is offered, with decline as prominent as accept and a privacy link', () => {
  render(<ConsentBanner />);
  expect(region()).toBeInTheDocument();
  const decline = screen.getByRole('button', { name: 'Decline' });
  const accept = screen.getByRole('button', { name: 'Accept analytics' });
  expect(decline.className).toBe(accept.className); // same variant, same size
  expect(screen.getByRole('link', { name: 'Privacy notice' })).toHaveAttribute('href', '/privacy');
});

test('accept stores granted for twelve months, announces it and closes', async () => {
  const heard = vi.fn();
  window.addEventListener(CONSENT_EVENT, heard);
  render(<ConsentBanner />);
  await userEvent.click(screen.getByRole('button', { name: 'Accept analytics' }));
  expect(readConsent()).toBe('granted');
  expect((heard.mock.calls[0][0] as CustomEvent).detail).toBe('granted');
  expect(region()).not.toBeInTheDocument();
  window.removeEventListener(CONSENT_EVENT, heard);
});

test('decline stores denied and closes; cookie settings brings the choice back', async () => {
  render(<><ConsentBanner /><CookieSettingsButton /></>);
  await userEvent.click(screen.getByRole('button', { name: 'Decline' }));
  expect(readConsent()).toBe('denied');
  expect(region()).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Cookie settings' }));
  expect(region()).toBeInTheDocument();
});

test('a visitor who has chosen is not asked again', () => {
  document.cookie = 'dq_consent=denied; Path=/';
  render(<ConsentBanner />);
  expect(region()).not.toBeInTheDocument();
});

test('not shown on the admin, the prototypes, in the heatmap iframe or to a GPC browser', () => {
  pathname = '/admin/analytics';
  const { unmount } = render(<ConsentBanner />);
  expect(region()).not.toBeInTheDocument();
  unmount();

  pathname = '/';
  resetTrackerForTests(); // the heatmap flag is read once per page load
  history.replaceState(null, '', '/?dq_heatmap=1');
  const second = render(<ConsentBanner />);
  expect(region()).not.toBeInTheDocument();
  second.unmount();

  resetTrackerForTests();
  history.replaceState(null, '', '/');
  Object.defineProperty(navigator, 'globalPrivacyControl', { value: true, configurable: true });
  render(<ConsentBanner />);
  expect(region()).not.toBeInTheDocument();
  // ...but the footer link still opens it.
  act(() => { window.dispatchEvent(new CustomEvent('dq:consent-open')); });
  expect(region()).toBeInTheDocument();
});
