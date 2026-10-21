// @vitest-environment jsdom
import { StrictMode, createRef } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { CallState } from '@/components/call/useEncryptedCall';

// The call screen's states, with the encrypted call itself replaced: what a
// person sees, when the lock shows, and when the doctor's panel leaves.

const call = vi.hoisted(() => ({
  state: { status: 'idle', failure: null, badge: 'none', micOn: true, cameraOn: true, peerCameraOff: false, peerMicMuted: false } as CallState,
  start: vi.fn(), leave: vi.fn(), toggleMic: vi.fn(), toggleCamera: vi.fn(),
  // What the screen asked the hook for, last render.
  options: null as { demoPatient?: boolean } | null,
}));
vi.mock('@/components/call/useEncryptedCall', () => ({
  useEncryptedCall: (options: { demoPatient?: boolean }) => {
    call.options = options;
    return { ...call, remoteVideoRef: createRef(), remoteAudioRef: createRef(), localVideoRef: createRef() };
  },
}));
const shift = vi.hoisted(() => ({ kind: 'consultation' as string }));
vi.mock('@/components/doctor/ShiftProvider', () => ({ useShift: () => ({ state: { kind: shift.kind } }) }));

import { CallView } from '@/components/call/CallView';
import { CallPanel } from '@/components/doctor/CallPanel';
import { VideoFrame } from '@/components/patient/VideoFrame';

const set = (over: Partial<CallState>) => { call.state = { ...call.state, ...over }; };
const requestPass = () => Promise.resolve(new Response('{}'));

beforeEach(() => {
  call.state = { status: 'idle', failure: null, badge: 'none', micOn: true, cameraOn: true, peerCameraOff: false, peerMicMuted: false };
  for (const fn of [call.start, call.leave, call.toggleMic, call.toggleCamera]) fn.mockClear();
  call.options = null;
  shift.kind = 'consultation';
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

const nextTick = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

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

  // The icon is a picture, so each carries words for a screen reader.
  test('covers a camera that is off and badges a mic that is muted, on both pictures', () => {
    set({ status: 'connected' });
    const { rerender } = render(<CallView who="gp" active requestPass={requestPass} />);
    for (const words of [/camera is off/, /muted/]) expect(screen.queryByText(words)).toBeNull();

    set({ cameraOn: false, micOn: false });
    rerender(<CallView who="gp" active requestPass={requestPass} />);
    expect(screen.getByText('Your camera is off')).toBeInTheDocument();
    expect(screen.getByText('You are muted')).toBeInTheDocument();

    set({ cameraOn: true, micOn: true, peerCameraOff: true, peerMicMuted: true });
    rerender(<CallView who="gp" active requestPass={requestPass} />);
    expect(screen.getByText('The patient’s camera is off')).toBeInTheDocument();
    expect(screen.getByText('The patient is muted')).toBeInTheDocument();
    cleanup();
    render(<CallView who="patient" active requestPass={requestPass} />);
    expect(screen.getByText('Your GP’s camera is off')).toBeInTheDocument();
    expect(screen.getByText('Your GP is muted')).toBeInTheDocument();
  });

  test('shows no icons for the other person before a call is joined', () => {
    set({ status: 'idle', peerCameraOff: true, peerMicMuted: true });
    render(<CallView who="gp" active requestPass={requestPass} />);
    expect(screen.queryByText('The patient’s camera is off')).toBeNull();
    expect(screen.queryByText('The patient is muted')).toBeNull();
  });

  // Before the call the frame is never a blank block.
  test('before the call, the frame says what happens next, over a large start button', () => {
    const { container } = render(<CallView who="gp" active requestPass={requestPass} />);
    const idle = container.querySelector<HTMLElement>('[data-slot="call-idle"]')!;
    expect(within(idle).getByText('Start the video when you’re ready.')).toBeInTheDocument();
    expect(idle.querySelector('svg.lucide-video')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Start video' })).toHaveAttribute('data-size', 'lg');
    cleanup();

    const patient = render(<CallView who="patient" active requestPass={requestPass} />);
    const patientIdle = patient.container.querySelector<HTMLElement>('[data-slot="call-idle"]')!;
    expect(within(patientIdle).getByText('Join the video when you’re ready.')).toBeInTheDocument();
    expect(patientIdle.querySelector('svg.lucide-video')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Join video' })).toHaveAttribute('data-size', 'lg');

    set({ status: 'connecting' });
    patient.rerender(<CallView who="patient" active requestPass={requestPass} />);
    expect(patient.container.querySelector('[data-slot="call-idle"]')).toBeNull();
  });

  test('a patient screen that joins by itself says it is connecting', () => {
    render(<CallView who="patient" active autoStart requestPass={requestPass} />);
    expect(screen.getByText('Connecting you to your GP…')).toBeInTheDocument();
    expect(screen.queryByText('Join the video when you’re ready.')).toBeNull();
  });

  // React mounts twice in development; the call must still start once.
  test('autoStart joins by itself, exactly once, with no button to press first', async () => {
    const { rerender } = render(<StrictMode><CallView who="patient" active autoStart requestPass={requestPass} /></StrictMode>);
    expect(screen.queryByRole('button', { name: 'Join video' })).toBeNull();
    await nextTick();
    rerender(<StrictMode><CallView who="patient" active autoStart requestPass={requestPass} /></StrictMode>);
    await nextTick();
    expect(call.start).toHaveBeenCalledTimes(1);

    set({ status: 'failed', failure: 'unavailable' });
    rerender(<StrictMode><CallView who="patient" active autoStart requestPass={requestPass} /></StrictMode>);
    expect(screen.getByRole('button', { name: 'Rejoin video' })).toBeInTheDocument();
    expect(call.start).toHaveBeenCalledTimes(1);
  });

  test('without autoStart nothing starts until the button is pressed', async () => {
    render(<CallView who="gp" active requestPass={requestPass} />);
    await nextTick();
    expect(call.start).not.toHaveBeenCalled();
  });

  // The demo patient has no microphone, and its picture is not a mirror.
  test('demoPatient tells the call, hides Mute and does not mirror its own picture', () => {
    set({ status: 'connected' });
    render(<CallView who="patient" active demoPatient requestPass={requestPass} />);
    expect(call.options).toMatchObject({ demoPatient: true });
    expect(screen.queryByRole('button', { name: /Mute|Unmute/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Camera off' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Leave video' })).toBeInTheDocument();
    expect(screen.getByLabelText('Your camera')).not.toHaveClass('-scale-x-100');
    cleanup();

    render(<CallView who="patient" active requestPass={requestPass} />);
    expect(call.options).toMatchObject({ demoPatient: false });
    expect(screen.getByRole('button', { name: 'Mute' })).toBeInTheDocument();
    expect(screen.getByLabelText('Your camera')).toHaveClass('-scale-x-100');
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
  // The first test to render the real call: until its code arrives, the frame
  // already holds its place (the call module loads only once per file, so a
  // later render would never see the placeholder).
  test('is the placeholder unless video calls are set up on this machine, and holds its place while loading', async () => {
    const { container } = render(<VideoFrame gpRef="GP-002" />);
    expect(container.querySelector('[data-slot="video-frame"]')).toHaveTextContent('GP-002 · connected');
    expect(screen.queryByRole('button', { name: 'Join video' })).toBeNull();
    cleanup();
    const view = render(<VideoFrame gpRef="GP-002" videoCalls />);
    const loading = view.container.querySelector('[data-slot="call-loading"]');
    expect(loading).not.toBeNull();
    expect(loading).toHaveClass('bg-band', 'h-[55svh]');
    expect(await screen.findByRole('button', { name: 'Join video' })).toBeInTheDocument();
    expect(view.container.querySelector('[data-slot="call-loading"]')).toBeNull();
  });

  // Outside the demo the patient joins with a press, as before.
  test('waits for the patient to join, and keeps “Not recorded” in view', async () => {
    render(<VideoFrame gpRef="GP-002" videoCalls />);
    expect(await screen.findByText('Join the video when you’re ready.')).toBeInTheDocument();
    await nextTick();
    expect(call.start).not.toHaveBeenCalled();
    expect(call.options).toMatchObject({ demoPatient: false });
    expect(screen.getByText('Not recorded')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Join video' }));
    expect(call.start).toHaveBeenCalledTimes(1);
    cleanup();

    set({ status: 'connected', badge: 'verified' });
    render(<VideoFrame gpRef="GP-002" videoCalls />);
    expect(await screen.findByText('Encrypted end to end')).toBeInTheDocument();
    expect(screen.getByText('Not recorded')).toBeVisible();
  });

  // The investor demo: the patient's side joins by itself and sends the generated picture.
  test('in the investor demo, joins by itself as the demo patient', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO', '1');
    render(<VideoFrame gpRef="GP-002" videoCalls />);
    expect(await screen.findByText('Connecting you to your GP…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Join video' })).toBeNull();
    await nextTick();
    expect(call.start).toHaveBeenCalledTimes(1);
    expect(call.options).toMatchObject({ demoPatient: true });
    expect(screen.getByText('Not recorded')).toBeVisible();
  });
});
