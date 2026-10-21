// @vitest-environment jsdom
import { test, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { GpSignupDialog } from '@/components/GpSignupDialog';
import { GpSignupCta } from '@/components/GpSignupCta';
import { GP_FEE_ENABLED } from '@/lib/gp-fee';
import { PRIVACY_MD } from '@/app/(site)/privacy/content';
import { TERMS_MD } from '@/app/(site)/terms/content';
import { installDomStubs } from './helpers/dom-stubs';

// With the fee off, nothing a GP reads may ask for, or mention, a payment.
// The fee-flow tests mock GP_FEE_ENABLED on; this file runs with it as shipped.
const PAYMENT = /payment|stripe|card|£|one-off/i;

beforeEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  installDomStubs();
  window.history.replaceState(null, '', '/');
});

test('the fee is off', () => {
  expect(GP_FEE_ENABLED).toBe(false);
});

test('the sign-up pop-up has no payment step and ends in "Sign up"', () => {
  render(
    <>
      <button type="button" data-gp-signup="hero-gp">Sign up as a GP</button>
      <GpSignupDialog />
    </>,
  );
  fireEvent.click(screen.getByText('Sign up as a GP'));
  const dialog = screen.getByRole('dialog');
  expect(dialog.textContent).not.toMatch(PAYMENT);
  expect(dialog.querySelector('[aria-label="Sign-up steps"]')).toBeNull();
  expect(screen.getByRole('button', { name: 'Sign up' })).toBeInTheDocument();
});

test('the call to action names no fee', () => {
  const { container } = render(<GpSignupCta source="hero-gp" id="gp-join" />);
  expect(container.textContent).not.toMatch(/fee|£/i);
});

test('Privacy and Terms do not mention Stripe or a sign-up fee', () => {
  for (const md of [PRIVACY_MD, TERMS_MD]) {
    expect(md).not.toMatch(/stripe/i);
    expect(md).not.toMatch(/sign-up fee/i);
  }
});
