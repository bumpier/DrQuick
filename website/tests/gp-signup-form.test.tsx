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

function renderForm() {
  return render(<GpSignupForm source="hero-gp" cta="Sign up" inputId="gp-join" reveal="load" />);
}

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

test('the four fields are labelled and the first one owns the nav CTA target', () => {
  const { container } = renderForm();
  for (const label of Object.keys(VALID)) {
    expect(screen.getByLabelText(label)).toBeInTheDocument();
  }
  const visible = [...container.querySelectorAll('input')].filter((i) => !i.classList.contains('hp'));
  expect(visible.map((i) => i.getAttribute('name'))).toEqual(['name', 'email', 'mobile', 'gmc']);
  expect(visible[0]).toHaveAttribute('id', 'gp-join');
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

test('success posts the normalised contract, collapses the capture and moves focus', async () => {
  const fetchMock = vi.fn<typeof fetch>(async () => jsonRes(200, { ok: true, alreadyJoined: false }));
  vi.stubGlobal('fetch', fetchMock);
  const { container } = renderForm();
  const form = container.querySelector('form')!;
  await fill({ 'Full name': '  Dr   Jane  Okafor ', 'Mobile number': '+44 7700 900123' });
  fireEvent.submit(form);

  expect(
    await screen.findByText("You're signed up. We check your GMC registration, then get in touch before we open."),
  ).toBeInTheDocument();
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/waitlist');
  expect(JSON.parse(init!.body as string)).toEqual({
    name: 'Dr Jane Okafor',        // whitespace collapsed
    email: 'jane@example.com',
    mobile: '07700900123',         // +44 folded to the 07 national form
    gmc: '1234567',
    role: 'gp',
    source: 'hero-gp',
    company: '',
    landingPath: '/',           // attribution; no visitorId without consent
  });
  expect(form).toHaveClass('done');
  const status = container.querySelector('.status')!;
  await waitFor(() => expect(status).toHaveFocus());
  expect(status).toHaveClass('ok');
});

test('a repeat sign-up says so rather than pretending it is new', async () => {
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => jsonRes(200, { ok: true, alreadyJoined: true })));
  const { container } = renderForm();
  await fill();
  fireEvent.submit(container.querySelector('form')!);
  expect(await screen.findByText("You're already signed up. We'll be in touch before we open.")).toBeInTheDocument();
});

test('the honeypot value travels with the payload', async () => {
  const fetchMock = vi.fn<typeof fetch>(async () => jsonRes(200, { ok: true, alreadyJoined: false }));
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
