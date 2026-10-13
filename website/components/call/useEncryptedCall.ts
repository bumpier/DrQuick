'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DisconnectReason, Room, RoomEvent, Track, isE2EESupported } from 'livekit-client';
import type { RemoteParticipant, RemoteTrack, RemoteTrackPublication } from 'livekit-client';
import { ParticipantKeyProvider, createE2EEWorker, decodeKey, wipe } from './keys';
import { mayPlay, verifyEncryption, type CallFailure, type RemoteTrackInfo } from './verify';

// The browser's half of an encrypted call (docs/superpowers/specs/2026-10-13-
// encrypted-video-calls-design.md). It never trusts the media server about
// encryption:
//
// - A browser that cannot encrypt never asks for a pass, so keys never reach it.
// - Both keys go in as raw bytes before encryption is turned on, and encryption
//   is on before connecting, with LiveKit's current `encryption` option (its
//   deprecated `e2ee` option leaves data messages unencrypted).
// - A remote track reaches the screen only through attachVerified, which plays
//   only the other person's camera or microphone, marked encrypted. Anything
//   else (an unencrypted track, a stranger, encryption that stops) ends the call.
// - "Encrypted end to end" shows only while the other person's media is really
//   decoding: with E2EE a frame that fails to decrypt never reaches the decoder,
//   so rising decoded-frame and decoded-sample counts are the proof LiveKit
//   does not give.
// - No data channel and no remote calls: nothing listens for either.

export type CallStatus = 'idle' | 'unsupported' | 'connecting' | 'waiting' | 'connected' | 'reconnecting' | 'peer_left' | 'ended' | 'failed';
export type CallFailureReason =
  | CallFailure | 'opened_elsewhere' | 'media_blocked' | 'video_off' | 'no_consultation' | 'signed_out' | 'unavailable';
export type CallState = { status: CallStatus; failure: CallFailureReason | null; badge: 'verified' | 'checking' | 'none'; micOn: boolean; cameraOn: boolean };

type Pass = { url: string; token: string; identity: string; peerIdentity: string; ownKey: string; peerKey: string };

const INITIAL: CallState = { status: 'idle', failure: null, badge: 'none', micOn: true, cameraOn: true };
const REFUSALS: Record<number, CallFailureReason> = { 401: 'signed_out', 409: 'no_consultation', 501: 'video_off' };
const STATS_MS = 1_000;

type Counters = { frames: number; samples: number };

export function useEncryptedCall({ requestPass }: { requestPass: () => Promise<Response> }) {
  const [state, setState] = useState<CallState>(INITIAL);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  const room = useRef<Room | null>(null);
  const worker = useRef<Worker | null>(null);
  const peer = useRef('');
  const finished = useRef(false);
  const attached = useRef(new Set<RemoteTrack>());
  const counters = useRef(new Map<RemoteTrack, Counters>());
  const decoded = useRef({ lastVideoFrameAt: null as number | null, lastAudioAt: null as number | null });
  const errors = useRef({ streakStartedAt: null as number | null, lastAt: null as number | null });
  const stats = useRef<ReturnType<typeof setInterval> | null>(null);

  const info = (publication: RemoteTrackPublication, participant: RemoteParticipant): RemoteTrackInfo =>
    ({ identity: participant.identity, source: String(publication.source), encrypted: publication.isEncrypted });

  const cleanup = useCallback(() => {
    if (stats.current) clearInterval(stats.current);
    stats.current = null;
    for (const track of attached.current) track.detach();
    attached.current.clear();
    counters.current.clear();
    for (const element of [remoteVideoRef.current, remoteAudioRef.current, localVideoRef.current]) {
      if (element) element.srcObject = null;
    }
    const current = room.current;
    room.current = null;
    void current?.disconnect();
    worker.current?.terminate();
    worker.current = null;
  }, []);

  const fail = useCallback((failure: CallFailureReason) => {
    if (finished.current) return;
    finished.current = true;
    cleanup();
    setState((s) => ({ ...s, status: 'failed', failure, badge: 'none' }));
  }, [cleanup]);

  // The one place a remote track reaches the screen.
  function attachVerified(track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant): 'played' | 'refused' | 'no_screen' {
    if (!mayPlay(info(publication, participant), peer.current)) return 'refused';
    const element = track.kind === Track.Kind.Video ? remoteVideoRef.current : remoteAudioRef.current;
    if (!element) return 'no_screen';
    track.attach(element);
    attached.current.add(track);
    return 'played';
  }

  const evaluate = useCallback(() => {
    const current = room.current;
    if (!current || finished.current) return;
    const participants = [...current.remoteParticipants.values()];
    const remote = participants.flatMap((p) => [...p.trackPublications.values()].map((pub) => info(pub, p)));
    const peerParticipant = participants.find((p) => p.identity === peer.current);
    const camera = peerParticipant && [...peerParticipant.trackPublications.values()].find((pub) => pub.source === Track.Source.Camera);
    const now = Date.now();
    const verdict = verifyEncryption({
      now, e2eeEnabled: current.isE2EEEnabled,
      localEncrypted: [...current.localParticipant.trackPublications.values()].every((pub) => pub.isEncrypted),
      peerIdentity: peer.current, remoteParticipants: participants.map((p) => p.identity), remote,
      lastVideoFrameAt: decoded.current.lastVideoFrameAt, lastAudioAt: decoded.current.lastAudioAt,
      peerCameraOff: !camera || camera.isMuted,
      errorStreakStartedAt: errors.current.streakStartedAt, lastErrorAt: errors.current.lastAt,
    });
    if (verdict.failure) {
      fail(verdict.failure);
      return;
    }
    setState((s) => ({
      ...s, badge: verdict.badge,
      status: s.status === 'reconnecting' ? s.status : peerParticipant ? 'connected' : s.status === 'peer_left' ? 'peer_left' : 'waiting',
    }));
  }, [fail]);

  // Decoded media is the proof of decryption: a frame that fails to decrypt
  // never reaches the decoder.
  const readStats = useCallback(async () => {
    const now = Date.now();
    for (const track of attached.current) {
      let report: RTCStatsReport | undefined;
      try { report = await track.getRTCStatsReport(); } catch { continue; }
      let frames = 0;
      let samples = 0;
      report?.forEach((stat) => {
        if (stat.type !== 'inbound-rtp') return;
        frames += Number(stat.framesDecoded ?? 0);
        samples += Number(stat.totalSamplesReceived ?? 0) - Number(stat.concealedSamples ?? 0);
      });
      const before = counters.current.get(track) ?? { frames: 0, samples: 0 };
      if (track.kind === Track.Kind.Video && frames > before.frames) decoded.current.lastVideoFrameAt = now;
      if (track.kind === Track.Kind.Audio && samples > before.samples) decoded.current.lastAudioAt = now;
      counters.current.set(track, { frames, samples });
    }
    evaluate();
  }, [evaluate]);

  const start = useCallback(async () => {
    if (!isE2EESupported()) {
      setState({ ...INITIAL, status: 'unsupported' });
      return;
    }
    finished.current = false;
    setState({ ...INITIAL, status: 'connecting' });

    let pass: Pass;
    try {
      const response = await requestPass();
      if (!response.ok) {
        fail(REFUSALS[response.status] ?? 'unavailable');
        return;
      }
      pass = await response.json();
    } catch {
      fail('unavailable');
      return;
    }
    peer.current = pass.peerIdentity;

    const keys = new ParticipantKeyProvider();
    try {
      const own = decodeKey(pass.ownKey);
      const theirs = decodeKey(pass.peerKey);
      await keys.setParticipantKey(pass.identity, own);
      await keys.setParticipantKey(pass.peerIdentity, theirs);
      wipe(own);
      wipe(theirs);
    } catch {
      fail('unavailable');
      return;
    }
    pass.ownKey = '';
    pass.peerKey = '';

    worker.current = createE2EEWorker();
    const current = new Room({
      encryption: { keyProvider: keys, worker: worker.current },
      adaptiveStream: true,
      dynacast: true,
      publishDefaults: { videoCodec: 'vp9', backupCodec: { codec: 'vp8' } },
    });
    room.current = current;

    current
      .on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (attachVerified(track, publication, participant) === 'refused') {
          fail(participant.identity === peer.current ? 'not_encrypted' : 'unexpected_participant');
          return;
        }
        evaluate();
      })
      .on(RoomEvent.TrackPublished, () => evaluate())
      .on(RoomEvent.TrackUnsubscribed, (track) => { track.detach(); attached.current.delete(track); evaluate(); })
      .on(RoomEvent.ParticipantConnected, (participant) => {
        if (participant.identity !== peer.current) {
          fail('unexpected_participant');
          return;
        }
        evaluate();
      })
      .on(RoomEvent.ParticipantDisconnected, (participant) => {
        if (participant.identity === peer.current) setState((s) => ({ ...s, status: 'peer_left', badge: 'none' }));
        evaluate();
      })
      .on(RoomEvent.ParticipantEncryptionStatusChanged, () => evaluate())
      .on(RoomEvent.EncryptionError, () => {
        const now = Date.now();
        if (errors.current.lastAt === null || now - errors.current.lastAt > 2_000) errors.current.streakStartedAt = now;
        errors.current.lastAt = now;
        evaluate();
      })
      .on(RoomEvent.Reconnecting, () => setState((s) => ({ ...s, status: 'reconnecting', badge: 'none' })))
      .on(RoomEvent.Reconnected, () => { setState((s) => ({ ...s, status: 'waiting' })); evaluate(); })
      .on(RoomEvent.Disconnected, (reason) => {
        if (finished.current) return;
        finished.current = true;
        cleanup();
        setState((s) => (reason === DisconnectReason.DUPLICATE_IDENTITY
          ? { ...s, status: 'failed', failure: 'opened_elsewhere', badge: 'none' }
          : { ...s, status: 'ended', failure: null, badge: 'none' }));
      });

    try {
      await current.setE2EEEnabled(true);
      await current.connect(pass.url, pass.token);
    } catch {
      fail('unavailable');
      return;
    }
    if (finished.current) return;
    try {
      await current.localParticipant.setMicrophoneEnabled(true);
      await current.localParticipant.setCameraEnabled(true);
    } catch {
      fail('media_blocked');
      return;
    }
    const camera = current.localParticipant.getTrackPublication(Track.Source.Camera)?.track?.mediaStreamTrack;
    if (camera && localVideoRef.current && typeof MediaStream !== 'undefined') localVideoRef.current.srcObject = new MediaStream([camera]);
    stats.current = setInterval(() => { void readStats(); }, STATS_MS);
    evaluate();
  }, [requestPass, fail, evaluate, readStats, cleanup]);

  const leave = useCallback(async () => {
    finished.current = true;
    cleanup();
    setState((s) => ({ ...s, status: 'ended', failure: null, badge: 'none' }));
  }, [cleanup]);

  const toggleMic = useCallback(async () => {
    const current = room.current;
    if (!current) return;
    const on = !current.localParticipant.isMicrophoneEnabled;
    await current.localParticipant.setMicrophoneEnabled(on);
    setState((s) => ({ ...s, micOn: on }));
  }, []);

  const toggleCamera = useCallback(async () => {
    const current = room.current;
    if (!current) return;
    const on = !current.localParticipant.isCameraEnabled;
    await current.localParticipant.setCameraEnabled(on);
    setState((s) => ({ ...s, cameraOn: on }));
  }, []);

  useEffect(() => () => { finished.current = true; cleanup(); }, [cleanup]);

  return { state, start, leave, toggleMic, toggleCamera, remoteVideoRef, remoteAudioRef, localVideoRef };
}
