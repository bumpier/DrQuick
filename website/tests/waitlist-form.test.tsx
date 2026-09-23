// @vitest-environment jsdom
import { test, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { WaitlistForm } from '@/components/WaitlistForm';

beforeEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const jsonRes = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

function renderPatient() {
  return render(<WaitlistForm role="patient" source="hero" cta="Join the waitlist" inputId="join" reveal="load" />);
}

test('an invalid email is stopped client-side with the exact copy', async () => {
  const fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetchMock);
  renderPatient();
  const input = screen.getByLabelText('Email address');
  await userEvent.type(input, 'not-an-email');
  fireEvent.submit(input.closest('form')!);
  expect(await screen.findByText('Enter a valid email address, like name@example.com.')).toBeInTheDocument();
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input).toHaveFocus();
  expect(fetchMock).not.toHaveBeenCalled();
});

test('success posts the contract, thanks the patient, collapses the capture and moves focus', async () => {
  const fetchMock = vi.fn<typeof fetch>(async () => jsonRes(200, { ok: true, alreadyJoined: false }));
  vi.stubGlobal('fetch', fetchMock);
  const { container } = renderPatient();
  const form = container.querySelector('form')!;
  const hp = container.querySelector('.hp') as HTMLInputElement;
  fireEvent.change(hp, { target: { value: '' } });
  await userEvent.type(screen.getByLabelText('Email address'), 'name@example.com');
  fireEvent.submit(form);
  expect(await screen.findByText("You're on the list. We'll email you the day Dr Quick opens.")).toBeInTheDocument();
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/waitlist');
  expect(JSON.parse(init!.body as string)).toEqual({
    email: 'name@example.com', role: 'patient', source: 'hero', company: '',
  });
  expect(form).toHaveClass('done');
  const status = container.querySelector('.status')!;
  await waitFor(() => expect(status).toHaveFocus());
  expect(status).toHaveClass('ok');
});

test('the honeypot value travels with the payload', async () => {
  const fetchMock = vi.fn<typeof fetch>(async () => jsonRes(200, { ok: true, alreadyJoined: false }));
  vi.stubGlobal('fetch', fetchMock);
  const { container } = renderPatient();
  fireEvent.change(container.querySelector('.hp')!, { target: { value: 'bot text' } });
  await userEvent.type(screen.getByLabelText('Email address'), 'name@example.com');
  fireEvent.submit(container.querySelector('form')!);
  await screen.findByText(/on the list/);
  expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string).company).toBe('bot text');
});

test('alreadyJoined and the GP variants use their own copy, and busy label differs by role', async () => {
  let release!: (r: Response) => void;
  const gate = new Promise<Response>((res) => { release = res; });
  vi.stubGlobal('fetch', vi.fn(() => gate));
  render(<WaitlistForm role="gp" source="hero-gp" cta="Register interest" inputId="gp-join" />);
  await userEvent.type(screen.getByLabelText('Email address'), 'gp@example.com');
  fireEvent.submit(screen.getByLabelText('Email address').closest('form')!);
  const button = screen.getByRole('button');
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute('aria-busy', 'true');
  expect(button).toHaveTextContent('Registering…');
  release(jsonRes(200, { ok: true, alreadyJoined: true }));
  expect(await screen.findByText("You're already on the list. We'll be in touch.")).toBeInTheDocument();
});

test('429 and network failure re-enable the form with their exact copy', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => jsonRes(429, { ok: false })));
  const { container } = renderPatient();
  const input = screen.getByLabelText('Email address');
  await userEvent.type(input, 'name@example.com');
  fireEvent.submit(container.querySelector('form')!);
  expect(await screen.findByText('That is a few too many tries. Give it a couple of minutes.')).toBeInTheDocument();
  expect(screen.getByRole('button')).toBeEnabled();
  expect(input).toHaveAttribute('aria-invalid', 'true');

  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down'); }));
  fireEvent.submit(container.querySelector('form')!);
  expect(await screen.findByText("Couldn't reach the server — try again in a moment.")).toBeInTheDocument();
  expect(container.querySelector('.status')).toHaveClass('err');
});
