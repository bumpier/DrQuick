// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/navigation', () => import('./helpers/next-navigation'));
vi.mock('next/link', () => import('./helpers/next-link'));
const toast = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), message: vi.fn() }));
vi.mock('sonner', () => ({ toast }));
// The server actions: here, what the server answered, or that it could not be reached.
const actions = vi.hoisted(() => ({
  goOnlineAction: vi.fn(), goOfflineAction: vi.fn(), backOnlineAction: vi.fn(), acceptAction: vi.fn(),
  declineAction: vi.fn(), completeAction: vi.fn(), noShowAction: vi.fn(),
}));
vi.mock('@/app/doctor/(portal)/shift-actions', () => actions);

import { ShiftPanel } from '@/components/doctor/ShiftPanel';
import { ConnectionNotice, ShiftProvider } from '@/components/doctor/ShiftProvider';
import type { ShiftState } from '@/lib/doctor/shift';

const OFFLINE: ShiftState = { kind: 'offline' };
const IDLE: ShiftState = { kind: 'idle', onlineMs: 0 };
const OFFER: ShiftState = {
  kind: 'offer', offerId: '11111111-1111-4111-8111-111111111111', feePence: 2880,
  reason: 'Sore throat, three days', ageBand: '30 to 39', recordConsent: true, remainingMs: 45_000, windowSeconds: 45,
};

const answer = (state: ShiftState, status = 200) => new Response(JSON.stringify({ state, build: '' }), { status });
const poll = vi.fn<() => Promise<Response>>();
const location = { assign: vi.fn(), reload: vi.fn() };

// The tab's visibility, as the browser reports it.
let hidden = false;
const show = (visible: boolean) => act(() => {
  hidden = !visible;
  document.dispatchEvent(new Event('visibilitychange'));
});
const wait = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const click = (name: string) => act(async () => { fireEvent.click(screen.getByRole('button', { name })); });
const heading = () => screen.getByRole('heading', { level: 2 }).textContent;
// As the portal layout mounts them: the notice, then the page.
const renderShift = (initial: ShiftState) =>
  render(<ShiftProvider initial={initial}><ConnectionNotice /><ShiftPanel /></ShiftProvider>);

beforeEach(() => {
  cleanup();
  vi.useFakeTimers();
  vi.clearAllMocks();
  hidden = false;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  poll.mockReset();
  poll.mockImplementation(async () => answer(IDLE));
  vi.stubGlobal('fetch', poll);
  vi.stubGlobal('location', location);
});

describe('the panel', () => {
  test('an offer shows what it pays and the three things a doctor may know, and Accept names that offer', async () => {
    actions.acceptAction.mockResolvedValue({ ok: true, state: { kind: 'consultation', consultationId: 'c', feePence: 2880, reason: null, ageBand: null, elapsedMs: 0 } });
    renderShift(OFFER);
    expect(heading()).toBe('A patient is waiting');
    expect(screen.getByText('You are paid £28.80 for this consultation.')).toBeInTheDocument();
    for (const fact of ['Sore throat, three days', '30 to 39', 'Shared with you']) expect(screen.getByText(fact)).toBeInTheDocument();
    await click('Accept');
    expect(actions.acceptAction).toHaveBeenCalledWith(OFFER.offerId);
    expect(heading()).toBe('Consultation in progress');
  });

  test('when its time is up, an offer can no longer be answered', async () => {
    renderShift({ ...OFFER, remainingMs: 0 });
    expect(screen.getByRole('button', { name: 'Accept' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeDisabled();
  });

  test('a refusal from the server is said in its words', async () => {
    actions.goOnlineAction.mockResolvedValue({ ok: false, error: 'Your account is paused. Contact the team.', state: OFFLINE });
    renderShift(OFFLINE);
    await click('Go online');
    expect(toast.error).toHaveBeenCalledWith('Your account is paused. Contact the team.');
  });

  // Without this the click throws into the framework's error screen, which
  // replaces the whole portal and stops the poll with it.
  test('a click that never reaches the server says so and leaves the panel standing', async () => {
    actions.goOnlineAction.mockRejectedValue(new Error('Failed to fetch'));
    renderShift(OFFLINE);
    await click('Go online');
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/did not go through/i));
    expect(heading()).toBe('You’re offline');
    expect(screen.getByRole('button', { name: 'Go online' })).toBeEnabled();
  });
});

describe('the poll', () => {
  test('an online doctor’s portal checks in every few seconds; an offline one never does', async () => {
    renderShift(IDLE);
    await wait(3000);
    expect(poll).toHaveBeenCalledTimes(1);
    expect(poll).toHaveBeenCalledWith('/doctor/pulse', expect.objectContaining({ method: 'POST' }));
    cleanup();
    poll.mockClear();
    renderShift(OFFLINE);
    await wait(30_000);
    expect(poll).not.toHaveBeenCalled();
  });

  test('what the server answers is what the panel shows', async () => {
    poll.mockImplementation(async () => answer(OFFER));
    renderShift(IDLE);
    await wait(3000);
    expect(heading()).toBe('A patient is waiting');
  });

  // A doctor who is not looking must not be offered a patient: the offer would
  // run its whole window unseen while the patient waits.
  test('while the tab is hidden the portal does not check in, and it does at once when shown again', async () => {
    renderShift(IDLE);
    await show(false);
    await wait(20_000);
    expect(poll).not.toHaveBeenCalled();
    await show(true);
    await wait(0);
    expect(poll).toHaveBeenCalledTimes(1);
  });

  test('when the server cannot be reached the doctor is told, and the notice clears when it is back', async () => {
    poll.mockRejectedValueOnce(new Error('Failed to fetch'));
    renderShift(IDLE);
    await wait(3000);
    expect(screen.getByRole('alert')).toHaveTextContent(/connection lost/i);
    await wait(3000);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(heading()).toBe('You’re online');
  });

  test('a session that has ended sends the doctor to sign in', async () => {
    poll.mockImplementation(async () => answer(OFFLINE, 401));
    renderShift(IDLE);
    await wait(3000);
    expect(location.assign).toHaveBeenCalledWith('/doctor/login');
  });

  test('an answer to a poll that was already in flight when the doctor clicked is dropped', async () => {
    let release!: (response: Response) => void;
    poll.mockImplementationOnce(() => new Promise<Response>((resolve) => { release = resolve; }));
    actions.goOfflineAction.mockResolvedValue({ ok: true, state: OFFLINE });
    renderShift(IDLE);
    await wait(3000);
    await click('Go offline');
    expect(heading()).toBe('You’re offline');
    await act(async () => { release(answer(IDLE)); });
    expect(heading()).toBe('You’re offline');
  });
});
