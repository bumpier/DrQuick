// @vitest-environment jsdom
import { test, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { GpSignupForm } from '@/components/GpSignupForm';
import { GP_MESSAGES } from '@/lib/gp-signup';

beforeEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const jsonRes = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

// Where a successful submit sends the browser. A spy, so the hand-over to
// Stripe can be watched without jsdom trying to navigate.
const redirect = vi.fn<(url: string) => void>();

function renderForm() {
  redirect.mockClear();
  return render(<GpSignupForm source="hero-gp" inputId="gp-name" onRedirect={redirect} />);
}

const STRIPE_URL = 'https://checkout.stripe.com/c/pay/cs_test_a1b2c3';

const VALID = {
  'Full name': 'Dr Jane Okafor',
  Email: 'jane@example.com',
  'Mobile number': '07700 900123',
  'GMC number': '1234567',
} as const;

async function fill(overrides: Partial<Record<keyof typeof VALID, string>> = {}) {
  for (const [label, value] of Object.entries({ ...VALID, ...overrides })) {
    const field = screen.getByLabelText(label);
    await userEvent.clear(field);
    if (value) await userEvent.type(field, value);
  }
}

test('the four fields are labelled, in the order they are asked', () => {
  const { container } = renderForm();
  for (const label of Object.keys(VALID)) {
    expect(screen.getByLabelText(label)).toBeInTheDocument();
  }
  const visible = [...container.querySelectorAll('input')].filter((i) => !i.classList.contains('hp'));
  expect(visible.map((i) => i.getAttribute('name'))).toEqual(['name', 'email', 'mobile', 'gmc']);
  expect(visible[0]).toHaveAttribute('id', 'gp-name');
  // A GMC number is not something a browser holds, and a wrong autofill lands in
  // the one field we verify against.
  expect(screen.getByLabelText('GMC number')).toHaveAttribute('autocomplete', 'off');
});

// With four fields, "which one" is the whole message: focus lands on the field
// and the live region names the problem.
test.each([
  ['Full name', '', 'name'],
  ['Email', 'not-an-email', 'email'],
  ['Mobile number', '0161 496 0000', 'mobile'],
  ['GMC number', '12345', 'gmc'],
] as const)('a bad %s is stopped client-side, focused and named', async (label, bad, field) => {
  const fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetchMock);
  const { container } = renderForm();
  await fill({ [label]: bad });
  fireEvent.submit(container.querySelector('form')!);

  expect(await screen.findByText(GP_MESSAGES[field])).toBeInTheDocument();
  const input = screen.getByLabelText(label);
  expect(input).toHaveFocus();
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(fetchMock).not.toHaveBeenCalled();
});

test('the topmost problem wins, so focus never skips past a field the reader must fix', async () => {
  vi.stubGlobal('fetch', vi.fn<typeof fetch>());
  const { container } = renderForm();
  await fill({ 'Full name': '', Email: 'nope', 'GMC number': '1' });
  fireEvent.submit(container.querySelector('form')!);
  expect(await screen.findByText(GP_MESSAGES.name)).toBeInTheDocument();
  expect(screen.getByLabelText('Full name')).toHaveFocus();
});

// The fee is read at the moment of deciding: the amount, that it is paid once,
// and how it comes back, directly above the button that leads to paying it.
test('the fee and its refund promise sit with the button, which says what it does', () => {
  const { container } = renderForm();
  const fee = container.querySelector('.fee')!;
  expect(fee).toHaveTextContent('Sign-up fee, paid once');
  expect(fee).toHaveTextContent('£50');
  expect(fee).toHaveTextContent('Refunded in full if we can’t verify your GMC registration or don’t take you on.');
  const button = screen.getByRole('button', { name: 'Continue to payment' });
  expect(button).toHaveAttribute('type', 'submit');
  expect(button).toHaveAttribute('aria-describedby', fee.id);
  expect(fee.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(container.querySelector('.note')).toHaveTextContent('Dr Quick never sees your card details');
});

test('submit posts the normalised details to the paid sign-up and hands the browser to Stripe', async () => {
  const fetchMock = vi.fn<typeof fetch>(async () => jsonRes(200, { ok: true, url: STRIPE_URL }));
  vi.stubGlobal('fetch', fetchMock);
  const { container } = renderForm();
  const form = container.querySelector('form')!;
  await fill({ 'Full name': '  Dr   Jane  Okafor ', 'Mobile number': '+44 7700 900123' });
  fireEvent.submit(form);

  await waitFor(() => expect(redirect).toHaveBeenCalledWith(STRIPE_URL));
  expect(redirect).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/gp-signup');
  expect(JSON.parse(init!.body as string)).toEqual({
    name: 'Dr Jane Okafor',        // whitespace collapsed
    email: 'jane@example.com',
    mobile: '07700900123',         // +44 folded to the 07 national form
    gmc: '1234567',
    source: 'hero-gp',
    company: '',
    landingPath: '/',           // attribution; no visitorId without consent
  });
  // The page is about to be replaced: the button stays busy, the form does not
  // claim to be finished, and a second press cannot start a second checkout.
  const button = screen.getByRole('button', { name: 'Opening Stripe…' });
  expect(button).toBeDisabled();
  expect(form).not.toHaveClass('done');
  fireEvent.submit(form);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('an address that has already paid is told so, and is not sent to pay again', async () => {
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => jsonRes(200, { ok: true, alreadyPaid: true })));
  const { container } = renderForm();
  await fill();
  fireEvent.submit(container.querySelector('form')!);
  expect(await screen.findByText('This email address has already signed up and paid. We’ll be in touch before we open.')).toBeInTheDocument();
  expect(redirect).not.toHaveBeenCalled();
  expect(container.querySelector('form')).toHaveClass('done');
  const status = container.querySelector('.status')!;
  await waitFor(() => expect(status).toHaveFocus());
  expect(status).toHaveClass('ok');
});

// Each failure says what happened and that no money moved, and leaves the form
// ready for another try.
test.each([
  [503, 'payments_unavailable', 'Sign-up payments aren’t switched on yet. Nothing was taken. Try again soon.'],
  [502, 'checkout_failed', 'We couldn’t open the payment page. Nothing was taken. Try again in a moment.'],
  [503, 'store_unavailable', "Couldn't reach the server — try again in a moment."],
] as const)('a %i %s is explained and leaves the form usable', async (status, error, message) => {
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => jsonRes(status, { ok: false, error })));
  const { container } = renderForm();
  await fill();
  fireEvent.submit(container.querySelector('form')!);
  expect(await screen.findByText(message)).toBeInTheDocument();
  expect(redirect).not.toHaveBeenCalled();
  expect(container.querySelector('form')).not.toHaveClass('done');
  expect(screen.getByRole('button', { name: 'Continue to payment' })).toBeEnabled();
});

// The address this hands over to takes a card, so only a secure one is followed.
test('a reply with no payment address, or one that is not https, is not followed', async () => {
  for (const body of [{ ok: true }, { ok: true, url: 'http://checkout.example/pay' }, { ok: true, url: 'javascript:alert(1)' }]) {
    cleanup();
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => jsonRes(200, body)));
    const { container } = renderForm();
    await fill();
    fireEvent.submit(container.querySelector('form')!);
    expect(await screen.findByText('We couldn’t open the payment page. Nothing was taken. Try again in a moment.')).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  }
});

test('the honeypot value travels with the payload', async () => {
  const fetchMock = vi.fn<typeof fetch>(async () => jsonRes(200, { ok: true, url: STRIPE_URL }));
  vi.stubGlobal('fetch', fetchMock);
  const { container } = renderForm();
  fireEvent.change(container.querySelector('.hp')!, { target: { value: 'bot text' } });
  await fill();
  fireEvent.submit(container.querySelector('form')!);
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string).company).toBe('bot text');
});

// The route validates again. If it rejects a field the client let through, point
// at that field rather than showing a generic failure over a fixable form.
test('a server field rejection lands on that field', async () => {
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => jsonRes(400, { ok: false, error: 'invalid_gmc' })));
  const { container } = renderForm();
  await fill();
  fireEvent.submit(container.querySelector('form')!);
  expect(await screen.findByText(GP_MESSAGES.gmc)).toBeInTheDocument();
  expect(screen.getByLabelText('GMC number')).toHaveFocus();
  expect(container.querySelector('form')).not.toHaveClass('done');
});

test('a rate limit and an unreachable server each leave the form usable', async () => {
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => jsonRes(429, { ok: false, error: 'rate_limited' })));
  const { container } = renderForm();
  await fill();
  fireEvent.submit(container.querySelector('form')!);
  expect(await screen.findByText('That is a few too many tries. Give it a couple of minutes.')).toBeInTheDocument();
  expect(container.querySelector('form')).not.toHaveClass('done');

  cleanup();
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => { throw new Error('offline'); }));
  const second = renderForm();
  await fill();
  fireEvent.submit(second.container.querySelector('form')!);
  expect(await screen.findByText("Couldn't reach the server — try again in a moment.")).toBeInTheDocument();
  expect(second.container.querySelector('form')).not.toHaveClass('done');
});
