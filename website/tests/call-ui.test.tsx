// @vitest-environment jsdom
import { createRef } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { CallState } from '@/components/call/useEncryptedCall';

// The call screen's states, with the encrypted call itself replaced: what a
// person sees, when the lock shows, and when the doctor's panel leaves.

const call = vi.hoisted(() => ({
  state: { status: 'idle', failure: null, badge: 'none', micOn: true, cameraOn: true } as CallState,
  start: vi.fn(), leave: vi.fn(), toggleMic: vi.fn(), toggleCamera: vi.fn(),
}));
vi.mock('@/components/call/useEncryptedCall', () => ({
  useEncryptedCall: () => ({ ...call, remoteVideoRef: createRef(), remoteAudioRef: createRef(), localVideoRef: createRef() }),
}));
const shift = vi.hoisted(() => ({ kind: 'consultation' as string }));
vi.mock('@/components/doctor/ShiftProvider', () => ({ useShift: () => ({ state: { kind: shift.kind } }) }));

import { CallView } from '@/components/call/CallView';
import { CallPanel } from '@/components/doctor/CallPanel';
import { VideoFrame } from '@/components/patient/VideoFrame';

const set = (over: Partial<CallState>) => { call.state = { ...call.state, ...over }; };
const requestPass = () => Promise.resolve(new Response('{}'));

beforeEach(() => {
  call.state = { status: 'idle', failure: null, badge: 'none', micOn: true, cameraOn: true };
  for (const fn of [call.start, call.leave, call.toggleMic, call.toggleCamera]) fn.mockClear();
  shift.kind = 'consultation';
});
afterEach(cleanup);

describe('the call screen', () => {
  test('starts on a click: Start video for the GP, Join video for the patient', () => {
    render(<CallView who="gp" active requestPass={requestPass} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start video' }));
    expect(call.start).toHaveBeenCalled();
    cleanup();
    render(<CallView who="patient" active requestPass={requestPass} />);
    expect(screen.getByRole('button', { name: 'Join video' })).toBeInTheDocument();
  });

  // The lock is a promise: it shows only when the browser has proved it.
  test('shows the lock only when encryption is verified', () => {
    set({ status: 'connected', badge: 'verified' });
    const { rerender } = render(<CallView who="gp" active requestPass={requestPass} />);
    expect(screen.getByText('Encrypted end to end · Not recorded')).toBeInTheDocument();
    set({ badge: 'checking' });
    rerender(<CallView who="gp" active requestPass={requestPass} />);
    expect(screen.queryByText(/Encrypted end to end/)).toBeNull();
    expect(screen.getByText('Checking encryption…')).toBeInTheDocument();
    set({ badge: 'none' });
    rerender(<CallView who="gp" active requestPass={requestPass} />);
    expect(screen.queryByText(/Encrypted end to end/)).toBeNull();
  });

  test('says who it is waiting for', () => {
    set({ status: 'waiting' });
    render(<CallView who="gp" active requestPass={requestPass} />);
    expect(screen.getByText('Waiting for the patient…')).toBeInTheDocument();
    cleanup();
    render(<CallView who="patient" active requestPass={requestPass} />);
    expect(screen.getByText('Your GP will join shortly')).toBeInTheDocument();
  });

  test.each([
    ['unsupported', null, 'This browser can’t make an encrypted call. Update to the latest Safari or Chrome.'],
    ['failed', 'media_blocked', 'Allow the camera and microphone for this site, then try again.'],
    ['failed', 'opened_elsewhere', 'This call was opened somewhere else.'],
    ['failed', 'not_encrypted', 'The call ended because its encryption couldn’t be confirmed.'],
    ['failed', 'unexpected_participant', 'The call ended because its encryption couldn’t be confirmed.'],
    ['failed', 'video_off', 'Video calls are not set up on this server.'],
    ['failed', 'unavailable', 'The video service can’t be reached. Try again.'],
  ] as const)('%s (%s) says what to do', (status, failure, words) => {
    set({ status, failure });
    render(<CallView who="gp" active requestPass={requestPass} />);
    expect(screen.getByText(words)).toBeInTheDocument();
  });

  test('mutes, turns the camera off, and leaves', () => {
    set({ status: 'connected' });
    render(<CallView who="gp" active requestPass={requestPass} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mute' }));
    fireEvent.click(screen.getByRole('button', { name: 'Camera off' }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave video' }));
    expect(call.toggleMic).toHaveBeenCalled();
    expect(call.toggleCamera).toHaveBeenCalled();
    expect(call.leave).toHaveBeenCalled();
  });
});

describe('the doctor’s call panel', () => {
  test('shows during a consultation and waits, hidden, otherwise', () => {
    const { container, rerender } = render(<CallPanel />);
    expect(container.querySelector('[data-slot="call-panel"]')).toBeVisible();
    shift.kind = 'idle';
    rerender(<CallPanel />);
    expect(container.querySelector('[data-slot="call-panel"]')).not.toBeVisible();
  });

  // The consultation has ended: the server deletes the room, and this browser leaves too.
  test('leaves the call when the consultation ends', async () => {
    set({ status: 'connected' });
    const { rerender } = render(<CallPanel />);
    shift.kind = 'resting';
    await act(async () => { rerender(<CallPanel />); });
    expect(call.leave).toHaveBeenCalled();
  });
});

describe('the patient prototype’s call', () => {
  test('is the placeholder unless video calls are set up on this machine', async () => {
    const { container } = render(<VideoFrame gpRef="GP-002" />);
    expect(container.querySelector('[data-slot="video-frame"]')).toHaveTextContent('GP-002 · connected');
    expect(screen.queryByRole('button', { name: 'Join video' })).toBeNull();
    cleanup();
    render(<VideoFrame gpRef="GP-002" videoCalls />);
    expect(await screen.findByRole('button', { name: 'Join video' })).toBeInTheDocument();
  });
});
