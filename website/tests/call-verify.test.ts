import { describe, expect, test } from 'vitest';
import { mayPlay, verifyEncryption, type EncryptionSnapshot } from '@/components/call/verify';

// What the call screen may play, and when it may say "Encrypted end to end".
// The browser decides for itself: LiveKit's own receiver plays a track the
// server says is unencrypted, so a compromised server could show plaintext.

const NOW = 1_000_000;
const PEER = 'ID_patient';
const encrypted = (source = 'camera') => ({ identity: PEER, source, encrypted: true });
const base = (over: Partial<EncryptionSnapshot> = {}): EncryptionSnapshot => ({
  now: NOW, e2eeEnabled: true, localEncrypted: true, peerIdentity: PEER,
  remoteParticipants: [PEER], remote: [encrypted('camera'), encrypted('microphone')],
  lastVideoFrameAt: NOW - 500, peerCameraOff: false, lastAudioAt: NOW - 500,
  errorStreakStartedAt: null, lastErrorAt: null, ...over,
});

describe('a remote track may play only if', () => {
  test('it is the other person’s camera or microphone, and marked encrypted', () => {
    expect(mayPlay(encrypted('camera'), PEER)).toBe(true);
    expect(mayPlay(encrypted('microphone'), PEER)).toBe(true);
    expect(mayPlay({ ...encrypted(), encrypted: false }, PEER)).toBe(false);
    expect(mayPlay({ ...encrypted(), identity: 'ID_stranger' }, PEER)).toBe(false);
    for (const source of ['screen_share', 'screen_share_audio', 'unknown']) expect(mayPlay(encrypted(source), PEER), source).toBe(false);
  });
});

describe('the verdict', () => {
  test('verified: encryption on both ways, and the other person’s video decoding now', () => {
    expect(verifyEncryption(base())).toEqual({ failure: null, badge: 'verified' });
  });

  test('verified with their camera off, while their audio decodes', () => {
    expect(verifyEncryption(base({ peerCameraOff: true, lastVideoFrameAt: null, remote: [encrypted('microphone')] })).badge).toBe('verified');
    expect(verifyEncryption(base({ peerCameraOff: true, lastVideoFrameAt: null, lastAudioAt: NOW - 3000 })).badge).toBe('checking');
  });

  test('never verified while anything is missing', () => {
    expect(verifyEncryption(base({ e2eeEnabled: false })).badge).toBe('none');
    expect(verifyEncryption(base({ localEncrypted: false })).badge).toBe('none');
    expect(verifyEncryption(base({ remote: [], remoteParticipants: [] })).badge).toBe('none');
    expect(verifyEncryption(base({ lastVideoFrameAt: NOW - 3000 })).badge).toBe('checking');
    expect(verifyEncryption(base({ lastVideoFrameAt: null })).badge).toBe('checking');
  });

  test('checking while a decryption error is recent', () => {
    expect(verifyEncryption(base({ errorStreakStartedAt: NOW - 1000, lastErrorAt: NOW - 1000 }))).toEqual({ failure: null, badge: 'checking' });
    expect(verifyEncryption(base({ errorStreakStartedAt: NOW - 20_000, lastErrorAt: NOW - 11_000 })).badge).toBe('verified');
  });

  // Fail closed: anything that is not the other person, encrypted, ends the call.
  test('fails on an unencrypted track, a stranger, or errors that do not stop', () => {
    expect(verifyEncryption(base({ remote: [{ ...encrypted(), encrypted: false }] })).failure).toBe('not_encrypted');
    expect(verifyEncryption(base({ remote: [encrypted('screen_share')] })).failure).toBe('not_encrypted');
    expect(verifyEncryption(base({ remoteParticipants: [PEER, 'ID_stranger'] })).failure).toBe('unexpected_participant');
    expect(verifyEncryption(base({ remote: [{ ...encrypted(), identity: 'ID_stranger' }] })).failure).toBe('unexpected_participant');
    expect(verifyEncryption(base({ errorStreakStartedAt: NOW - 10_500, lastErrorAt: NOW - 200 })).failure).toBe('encryption_failed');
  });
});
