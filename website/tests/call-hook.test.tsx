// @vitest-environment jsdom
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// A fake media server room; LiveKit's real key provider, events and enums.
const fake = vi.hoisted(() => ({ rooms: [] as unknown[], supported: true, worker: { terminate: vi.fn() } }));
vi.mock('livekit-client', async (importOriginal) => {
  const real = await importOriginal<typeof import('livekit-client')>();
  class FakeRoom {
    options: Record<string, unknown>;
    listeners = new Map<string, Array<(...args: unknown[]) => void>>();
    isE2EEEnabled = false;
    remoteParticipants = new Map<string, unknown>();
    calls: string[] = [];
    localParticipant = {
      trackPublications: new Map<string, { isEncrypted: boolean; track?: { mediaStreamTrack: unknown } }>(),
      setMicrophoneEnabled: vi.fn(async () => { this.calls.push('mic'); }),
      setCameraEnabled: vi.fn(async () => { this.calls.push('camera'); }),
      getTrackPublication: vi.fn(() => undefined),
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

import { DisconnectReason, RoomEvent, Track } from 'livekit-client';
import { ParticipantKeyProvider } from '@/components/call/keys';
import { useEncryptedCall } from '@/components/call/useEncryptedCall';

type FakeRoom = {
  options: Record<string, unknown>; calls: string[]; isE2EEEnabled: boolean;
  remoteParticipants: Map<string, unknown>; listeners: Map<string, unknown[]>;
  emit: (event: string, ...args: unknown[]) => void; registerRpcMethod: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};
const room = () => fake.rooms.at(-1) as FakeRoom;

const PASS = {
  url: 'wss://media.drquick.example', token: 'jwt', identity: 'ID_gp', peerIdentity: 'ID_patient',
  ownKey: randomBytes(32).toString('base64url'), peerKey: randomBytes(32).toString('base64url'),
};
const answer = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

function remote(identity: string, { encrypted = true, source = Track.Source.Camera, kind = Track.Kind.Video } = {}) {
  const track = { kind, attach: vi.fn(), detach: vi.fn(), getRTCStatsReport: vi.fn(async () => new Map()) };
  const publication = { isEncrypted: encrypted, source, kind, track, isMuted: false };
  const participant = { identity, trackPublications: new Map([['TR', publication]]) };
  return { track, publication, participant };
}

async function started(requestPass = () => answer(PASS)) {
  const hook = renderHook(() => useEncryptedCall({ requestPass }));
  hook.result.current.remoteVideoRef.current = document.createElement('video');
  hook.result.current.remoteAudioRef.current = document.createElement('audio');
  await act(async () => { await hook.result.current.start(); });
  return hook;
}

beforeEach(() => { fake.rooms.length = 0; fake.supported = true; fake.worker.terminate.mockClear(); });
afterEach(() => vi.restoreAllMocks());

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

  test('leaving disconnects and ends the worker', async () => {
    const hook = await started();
    await act(async () => { await hook.result.current.leave(); });
    expect(room().disconnect).toHaveBeenCalled();
    expect(fake.worker.terminate).toHaveBeenCalled();
    expect(hook.result.current.state.status).toBe('ended');
  });
});

// Every remote track reaches the screen through one function, which asks mayPlay first.
test('a track is attached in exactly one place, behind the encryption check', () => {
  const source = readFileSync(join(__dirname, '../components/call/useEncryptedCall.ts'), 'utf8');
  expect(source.match(/\.attach\(/g)).toHaveLength(1);
  const guarded = source.slice(source.indexOf('function attachVerified'), source.indexOf('.attach('));
  expect(guarded).toContain('mayPlay(');
});
