// @vitest-environment jsdom
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { StrictMode } from 'react';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// A fake media server room; LiveKit's real key provider, events and enums.
const fake = vi.hoisted(() => ({ rooms: [] as unknown[], supported: true, worker: { terminate: vi.fn() } }));
vi.mock('livekit-client', async (importOriginal) => {
  const real = await importOriginal<typeof import('livekit-client')>();
  type FakePublication = {
    isEncrypted: boolean; source?: string; isMuted?: boolean; track?: { mediaStreamTrack: unknown };
    mute?: () => Promise<void>; unmute?: () => Promise<void>;
  };
  class FakeRoom {
    options: Record<string, unknown>;
    listeners = new Map<string, Array<(...args: unknown[]) => void>>();
    isE2EEEnabled = false;
    remoteParticipants = new Map<string, unknown>();
    calls: string[] = [];
    publications = new Map<string, FakePublication>();
    localParticipant = {
      trackPublications: this.publications,
      setMicrophoneEnabled: vi.fn(async () => { this.calls.push('mic'); }),
      setCameraEnabled: vi.fn(async () => { this.calls.push('camera'); }),
      getTrackPublication: vi.fn((source: string) => [...this.publications.values()].find((pub) => pub.source === source)),
      // A track handed in by the page, as the demo patient's picture is.
      publishTrack: vi.fn(async (track: unknown, options?: { source?: string }) => {
        this.calls.push('publish');
        const publication: FakePublication = {
          isEncrypted: true, source: options?.source, isMuted: false, track: { mediaStreamTrack: track },
          mute: vi.fn(async () => { publication.isMuted = true; }),
          unmute: vi.fn(async () => { publication.isMuted = false; }),
        };
        this.publications.set(`TR_${this.publications.size}`, publication);
        return publication;
      }),
    };
    registerRpcMethod = vi.fn();
    constructor(options: Record<string, unknown>) { this.options = options; fake.rooms.push(this); }
    on(event: string, fn: (...args: unknown[]) => void) { this.listeners.set(event, [...(this.listeners.get(event) ?? []), fn]); return this; }
    emit(event: string, ...args: unknown[]) { for (const fn of this.listeners.get(event) ?? []) fn(...args); }
    setE2EEEnabled = vi.fn(async (on: boolean) => { this.calls.push('e2ee'); this.isE2EEEnabled = on; });
    connect = vi.fn(async () => { this.calls.push('connect'); });
    disconnect = vi.fn(async () => { this.calls.push('disconnect'); });
  }
  return { ...real, Room: FakeRoom, isE2EESupported: () => fake.supported };
});
vi.mock('@/components/call/keys', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/call/keys')>()),
  createE2EEWorker: () => fake.worker,
}));
// The demo patient's generated picture; jsdom has no canvas to draw it.
const demo = vi.hoisted(() => ({ track: { kind: 'video', id: 'demo-patient' }, stop: vi.fn(), made: 0 }));
vi.mock('@/components/call/demoCamera', () => ({
  createDemoCamera: () => { demo.made += 1; return { track: demo.track, stop: demo.stop }; },
}));

import { DisconnectReason, RoomEvent, Track } from 'livekit-client';
import { CallView } from '@/components/call/CallView';
import { ParticipantKeyProvider } from '@/components/call/keys';
import { useEncryptedCall } from '@/components/call/useEncryptedCall';

type Mock = ReturnType<typeof vi.fn>;
type FakeRoom = {
  options: Record<string, unknown>; calls: string[]; isE2EEEnabled: boolean;
  remoteParticipants: Map<string, unknown>; listeners: Map<string, unknown[]>;
  emit: (event: string, ...args: unknown[]) => void; registerRpcMethod: Mock;
  disconnect: Mock;
  localParticipant: { setMicrophoneEnabled: Mock; setCameraEnabled: Mock; publishTrack: Mock; getTrackPublication: Mock };
};
const room = () => fake.rooms.at(-1) as FakeRoom;

const PASS = {
  url: 'wss://media.drquick.example', token: 'jwt', identity: 'ID_gp', peerIdentity: 'ID_patient',
  ownKey: randomBytes(32).toString('base64url'), peerKey: randomBytes(32).toString('base64url'),
};
const PATIENT_PASS = { ...PASS, identity: 'ID_patient', peerIdentity: 'ID_gp' };
const answer = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

function remote(identity: string, { encrypted = true, source = Track.Source.Camera, kind = Track.Kind.Video } = {}) {
  // Like LiveKit's attach, which unmutes an element that is given sound.
  const attach = vi.fn((element: HTMLMediaElement) => { element.muted = kind !== Track.Kind.Audio; });
  const track = { kind, attach, detach: vi.fn(), getRTCStatsReport: vi.fn(async () => new Map()) };
  const publication = { isEncrypted: encrypted, source, kind, track, isMuted: false };
  const participant = { identity, trackPublications: new Map([['TR', publication]]) };
  return { track, publication, participant };
}

async function started(requestPass = () => answer(PASS), options: { demoPatient?: boolean } = {}) {
  const hook = renderHook(() => useEncryptedCall({ requestPass, ...options }));
  hook.result.current.remoteVideoRef.current = document.createElement('video');
  hook.result.current.remoteAudioRef.current = document.createElement('audio');
  await act(async () => { await hook.result.current.start(); });
  return hook;
}

beforeEach(() => {
  fake.rooms.length = 0; fake.supported = true; fake.worker.terminate.mockClear();
  demo.made = 0; demo.stop.mockClear();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe('starting a call', () => {
  // Keys must never reach a browser that cannot encrypt.
  test('in a browser that cannot encrypt, never asks for a pass', async () => {
    fake.supported = false;
    const requestPass = vi.fn(() => answer(PASS));
    const hook = await started(requestPass);
    expect(requestPass).not.toHaveBeenCalled();
    expect(hook.result.current.state).toMatchObject({ status: 'unsupported' });
    expect(fake.rooms).toHaveLength(0);
  });

  test('sets both keys as raw bytes, turns encryption on, then connects, with the current option', async () => {
    const setKey = vi.spyOn(ParticipantKeyProvider.prototype, 'setParticipantKey');
    await started();
    expect(setKey.mock.calls.map(([identity, key]) => [identity, key instanceof ArrayBuffer && key.byteLength])).toEqual([
      ['ID_gp', 32], ['ID_patient', 32],
    ]);
    expect(room().options.encryption).toMatchObject({ worker: fake.worker });
    expect(room().options.encryption).toHaveProperty('keyProvider');
    expect(room().options).not.toHaveProperty('e2ee');
    expect(room().calls.slice(0, 2)).toEqual(['e2ee', 'connect']);
    expect(room().isE2EEEnabled).toBe(true);
  });

  // The presenter switches windows; a paused background video would show
  // "Checking encryption…" on the GP's screen for a moment on the way back.
  test('in the investor demo, keeps the other person’s video playing in a background window', async () => {
    await started();
    expect(room().options.adaptiveStream).toBe(true);
    vi.stubEnv('NEXT_PUBLIC_DEMO', '1');
    await started();
    expect(room().options.adaptiveStream).toEqual({ pauseVideoInBackground: false });
  });

  test('sends video as VP9 or VP8, never AV1', async () => {
    await started();
    expect(room().options.publishDefaults).toMatchObject({ videoCodec: 'vp9', backupCodec: { codec: 'vp8' } });
    expect(JSON.stringify(room().options)).not.toMatch(/av1|h265/i);
  });

  test('a refused pass is a failure with its reason, and no room', async () => {
    const hook = await started(() => answer({ error: 'video_off' }, 501));
    expect(hook.result.current.state).toMatchObject({ status: 'failed', failure: 'video_off' });
    expect(fake.rooms).toHaveLength(0);
  });

  test('listens for no data and answers no remote calls', async () => {
    await started();
    expect(room().listeners.has(RoomEvent.DataReceived)).toBe(false);
    expect(room().registerRpcMethod).not.toHaveBeenCalled();
  });
});

describe('what plays', () => {
  test('the other person’s encrypted camera plays', async () => {
    const hook = await started();
    const { track, publication, participant } = remote('ID_patient');
    await act(async () => { room().emit(RoomEvent.TrackSubscribed, track, publication, participant); });
    expect(track.attach).toHaveBeenCalledWith(hook.result.current.remoteVideoRef.current);
    expect(hook.result.current.state.status).not.toBe('failed');
  });

  // LiveKit would play this; we never do, and the call ends.
  test('a track the server says is unencrypted never plays, and ends the call', async () => {
    const hook = await started();
    const { track, publication, participant } = remote('ID_patient', { encrypted: false });
    await act(async () => { room().emit(RoomEvent.TrackSubscribed, track, publication, participant); });
    expect(track.attach).not.toHaveBeenCalled();
    expect(room().disconnect).toHaveBeenCalled();
    expect(hook.result.current.state).toMatchObject({ status: 'failed', failure: 'not_encrypted' });
    expect(fake.worker.terminate).toHaveBeenCalled();
  });

  test('a stranger in the room ends the call', async () => {
    const hook = await started();
    await act(async () => { room().emit(RoomEvent.ParticipantConnected, { identity: 'ID_stranger', trackPublications: new Map() }); });
    expect(hook.result.current.state).toMatchObject({ status: 'failed', failure: 'unexpected_participant' });
  });

  test('encryption that stops mid-call ends it', async () => {
    const hook = await started();
    const { track, publication, participant } = remote('ID_patient');
    room().remoteParticipants.set('ID_patient', participant);
    await act(async () => { room().emit(RoomEvent.TrackSubscribed, track, publication, participant); });
    publication.isEncrypted = false;
    await act(async () => { room().emit(RoomEvent.ParticipantEncryptionStatusChanged, false, participant); });
    expect(track.detach).toHaveBeenCalled();
    expect(hook.result.current.state).toMatchObject({ status: 'failed', failure: 'not_encrypted' });
  });

  test('the other person’s encrypted microphone plays, unmuted', async () => {
    const hook = await started();
    const { track, publication, participant } = remote('ID_patient', { source: Track.Source.Microphone, kind: Track.Kind.Audio });
    await act(async () => { room().emit(RoomEvent.TrackSubscribed, track, publication, participant); });
    expect(track.attach).toHaveBeenCalledWith(hook.result.current.remoteAudioRef.current);
    expect(hook.result.current.remoteAudioRef.current?.muted).toBe(false);
  });

  test('a screen share never plays', async () => {
    const hook = await started();
    const { track, publication, participant } = remote('ID_patient', { source: Track.Source.ScreenShare });
    await act(async () => { room().emit(RoomEvent.TrackSubscribed, track, publication, participant); });
    expect(track.attach).not.toHaveBeenCalled();
    expect(hook.result.current.state.status).toBe('failed');
  });
});

describe('how a call ends', () => {
  test('opened somewhere else is a failure the screen explains', async () => {
    const hook = await started();
    await act(async () => { room().emit(RoomEvent.Disconnected, DisconnectReason.DUPLICATE_IDENTITY); });
    expect(hook.result.current.state).toMatchObject({ status: 'failed', failure: 'opened_elsewhere' });
  });

  test('the room closing ends the call', async () => {
    const hook = await started();
    await act(async () => { room().emit(RoomEvent.Disconnected, DisconnectReason.ROOM_DELETED); });
    expect(hook.result.current.state).toMatchObject({ status: 'ended', failure: null });
  });

  // A screen that joins by itself can close before its pass arrives.
  test('a screen closed while the pass is on its way never joins', async () => {
    let release!: (response: Response) => void;
    const requestPass = () => new Promise<Response>((resolve) => { release = resolve; });
    const hook = renderHook(() => useEncryptedCall({ requestPass }));
    let pending!: Promise<void>;
    act(() => { pending = hook.result.current.start(); });
    hook.unmount();
    await act(async () => { release(new Response(JSON.stringify(PASS))); await pending; });
    expect(fake.rooms).toHaveLength(0);
  });

  test('leaving disconnects and ends the worker', async () => {
    const hook = await started();
    await act(async () => { await hook.result.current.leave(); });
    expect(room().disconnect).toHaveBeenCalled();
    expect(fake.worker.terminate).toHaveBeenCalled();
    expect(hook.result.current.state.status).toBe('ended');
  });
});

// The investor demo: one presenter plays both sides on one laptop. The patient's
// side sends a generated picture and no microphone, and never plays the GP's
// voice, so the two windows neither echo nor fight over the camera.
describe('the demo patient', () => {
  const demoCall = () => started(() => answer(PATIENT_PASS), { demoPatient: true });
  // The camera is loaded only in a build made with the demo flag (Next inlines it).
  beforeEach(() => { vi.stubEnv('NEXT_PUBLIC_DEMO', '1'); });

  test('a build without the demo flag never loads the generated picture, whatever it is asked', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO', '');
    await demoCall();
    expect(demo.made).toBe(0);
    expect(room().localParticipant.publishTrack).not.toHaveBeenCalled();
  });

  test('sends the generated picture as its camera, and asks for no microphone or camera', async () => {
    const hook = await demoCall();
    const local = room().localParticipant;
    expect(local.publishTrack).toHaveBeenCalledTimes(1);
    expect(local.publishTrack).toHaveBeenCalledWith(demo.track, expect.objectContaining({ source: Track.Source.Camera }));
    expect(local.setMicrophoneEnabled).not.toHaveBeenCalled();
    expect(local.setCameraEnabled).not.toHaveBeenCalled();
    expect(room().calls).toEqual(['e2ee', 'connect', 'publish']);
    expect(hook.result.current.state).toMatchObject({ status: 'waiting', micOn: false, cameraOn: true });
  });

  test('never plays the GP’s voice: the audio element stays muted', async () => {
    const hook = await demoCall();
    const { track, publication, participant } = remote('ID_gp', { source: Track.Source.Microphone, kind: Track.Kind.Audio });
    await act(async () => { room().emit(RoomEvent.TrackSubscribed, track, publication, participant); });
    expect(track.attach).toHaveBeenCalledWith(hook.result.current.remoteAudioRef.current);
    expect(hook.result.current.remoteAudioRef.current?.muted).toBe(true);
    expect(hook.result.current.state.status).not.toBe('failed');
  });

  test('the camera switch mutes and unmutes the same generated picture', async () => {
    const hook = await demoCall();
    const publication = room().localParticipant.getTrackPublication(Track.Source.Camera);
    await act(async () => { await hook.result.current.toggleCamera(); });
    expect(publication.mute).toHaveBeenCalledTimes(1);
    expect(hook.result.current.state.cameraOn).toBe(false);
    await act(async () => { await hook.result.current.toggleCamera(); });
    expect(publication.unmute).toHaveBeenCalledTimes(1);
    expect(hook.result.current.state.cameraOn).toBe(true);
    expect(room().localParticipant.setCameraEnabled).not.toHaveBeenCalled();
    expect(demo.made).toBe(1);
  });

  test('has no microphone to switch on', async () => {
    const hook = await demoCall();
    await act(async () => { await hook.result.current.toggleMic(); });
    expect(room().localParticipant.setMicrophoneEnabled).not.toHaveBeenCalled();
    expect(hook.result.current.state.micOn).toBe(false);
  });

  test('leaving stops the generated picture', async () => {
    const hook = await demoCall();
    expect(demo.stop).not.toHaveBeenCalled();
    await act(async () => { await hook.result.current.leave(); });
    expect(demo.stop).toHaveBeenCalled();
  });

  test('an ordinary call never makes one', async () => {
    await started();
    expect(demo.made).toBe(0);
    expect(room().localParticipant.publishTrack).not.toHaveBeenCalled();
    expect(room().calls).toEqual(['e2ee', 'connect', 'mic', 'camera']);
  });
});

// The real hook behind the real screen: React mounts every effect twice in
// development, and a screen that joins by itself must still join once, all the
// way to its media. (A ref guard alone starts the call in the first mount, whose
// unmount cleanup then marks it finished, so it never gets a room.)
describe('a screen that joins by itself, under StrictMode', () => {
  const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  beforeEach(() => { vi.stubEnv('NEXT_PUBLIC_DEMO', '1'); });

  test('the demo patient publishes its picture exactly once', async () => {
    const requestPass = vi.fn(() => answer(PATIENT_PASS));
    const view = render(<StrictMode><CallView who="patient" active autoStart demoPatient requestPass={requestPass} /></StrictMode>);
    await waitFor(() => expect(room()?.calls).toContain('publish'));
    await settle();
    expect(requestPass).toHaveBeenCalledTimes(1);
    expect(fake.rooms).toHaveLength(1);
    expect(room().calls).toEqual(['e2ee', 'connect', 'publish']);
    expect(screen.getByText('Your GP will join shortly')).toBeTruthy();
    view.unmount();
    expect(demo.stop).toHaveBeenCalled();
  });

  test('an ordinary patient turns on the microphone and camera exactly once', async () => {
    const requestPass = vi.fn(() => answer(PATIENT_PASS));
    const view = render(<StrictMode><CallView who="patient" active autoStart requestPass={requestPass} /></StrictMode>);
    await waitFor(() => expect(room()?.calls).toContain('camera'));
    await settle();
    expect(requestPass).toHaveBeenCalledTimes(1);
    expect(fake.rooms).toHaveLength(1);
    expect(room().calls).toEqual(['e2ee', 'connect', 'mic', 'camera']);
    view.unmount();
  });
});

// Every remote track reaches the screen through one function, which asks mayPlay first.
test('a track is attached in exactly one place, behind the encryption check', () => {
  const source = readFileSync(join(__dirname, '../components/call/useEncryptedCall.ts'), 'utf8');
  expect(source.match(/\.attach\(/g)).toHaveLength(1);
  const guarded = source.slice(source.indexOf('function attachVerified'), source.indexOf('.attach('));
  expect(guarded).toContain('mayPlay(');
});
