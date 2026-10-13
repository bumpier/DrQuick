import { randomBytes } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { KeyProviderEvent, type KeyInfo } from 'livekit-client';
import { ParticipantKeyProvider, decodeKey, wipe } from '@/components/call/keys';

// The call's keys in the browser, through LiveKit's real key provider: one key
// per participant, 256 bits, given as raw bytes, never ratcheted.

describe('the key provider', () => {
  test('keeps a key per participant, 256 bits, never ratcheted or shared', () => {
    expect(new ParticipantKeyProvider().getOptions()).toMatchObject({
      sharedKey: false, keySize: 256, ratchetWindowSize: 0, failureTolerance: -1,
    });
  });

  // Raw bytes go through HKDF; a string would go through a passphrase KDF.
  test('sets each key under its own identity, from raw bytes', async () => {
    const provider = new ParticipantKeyProvider();
    const seen: KeyInfo[] = [];
    provider.on(KeyProviderEvent.SetKey, (info) => seen.push(info));
    await provider.setParticipantKey('ID_gp', new Uint8Array(randomBytes(32)).buffer);
    await provider.setParticipantKey('ID_patient', new Uint8Array(randomBytes(32)).buffer);
    expect(seen.map((info) => info.participantIdentity)).toEqual(['ID_gp', 'ID_patient']);
    for (const info of seen) expect(info.key.algorithm.name).toBe('HKDF');
  });

  test('refuses anything but one 256-bit key for one identity', async () => {
    const provider = new ParticipantKeyProvider();
    await expect(provider.setParticipantKey('ID_gp', new Uint8Array(16).buffer)).rejects.toThrow('a call key is 256 bits');
    await expect(provider.setParticipantKey('', new Uint8Array(32).buffer)).rejects.toThrow();
  });
});

describe('a key from the pass', () => {
  test('is 32 bytes of base64url, and nothing else', () => {
    const bytes = randomBytes(32);
    expect(Buffer.from(decodeKey(bytes.toString('base64url'))).equals(bytes)).toBe(true);
    for (const bad of ['', 'abc', randomBytes(16).toString('base64url'), `${bytes.toString('base64url')}x`, 'a'.repeat(42) + '!']) {
      expect(() => decodeKey(bad), bad).toThrow('not a call key');
    }
  });

  // The message names nothing about the key.
  test('a refusal does not echo the key', () => {
    const text = `${randomBytes(32).toString('base64url')}=`;
    try { decodeKey(text); expect.unreachable(); } catch (err) { expect((err as Error).message).not.toContain(text.slice(0, 10)); }
  });

  test('can be wiped after use', () => {
    const key = decodeKey(randomBytes(32).toString('base64url'));
    wipe(key);
    expect(new Uint8Array(key).every((b) => b === 0)).toBe(true);
  });
});
