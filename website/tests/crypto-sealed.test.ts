import { randomBytes } from 'node:crypto';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { SealError, open, seal, sealingSecret } from '@/lib/crypto/sealed';

// Sealing the video call's keys at rest (lib/crypto/sealed.ts): AES-256-GCM,
// a key derived from CALL_KEY_SECRET for one purpose, and each sealed value
// bound to the row and role it belongs to.

const SECRET = randomBytes(32);
const OTHER = randomBytes(32);
const AT = { secret: SECRET, label: 'dq/call-key/v1', aad: 'c5a0b7e2-0000-4000-8000-000000000001|gp' };
const KEY = randomBytes(32);

const flip = (sealed: string, part: number) => {
  const parts = sealed.split('.');
  const bytes = Buffer.from(parts[part], 'base64url');
  bytes[0] ^= 0x01;
  parts[part] = bytes.toString('base64url');
  return parts.join('.');
};

describe('sealing', () => {
  test('a key comes back exactly as it went in', () => {
    expect(open(seal(KEY, AT), AT).equals(KEY)).toBe(true);
  });

  test('every seal is different, even of the same key', () => {
    const seals = Array.from({ length: 1000 }, () => seal(KEY, AT));
    expect(new Set(seals).size).toBe(1000);
    expect(new Set(seals.map((s) => s.split('.')[1])).size).toBe(1000);
    expect(seals[0]).toMatch(/^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{22}$/);
  });

  test('a changed byte anywhere is refused', () => {
    const sealed = seal(KEY, AT);
    for (const part of [1, 2, 3]) expect(() => open(flip(sealed, part), AT), `part ${part}`).toThrow(SealError);
  });

  // Bound to the purpose, the row and the role: a sealed key copied into
  // another consultation, or from the GP's column to the patient's, opens nowhere.
  test('the wrong secret, purpose or place is refused', () => {
    const sealed = seal(KEY, AT);
    expect(() => open(sealed, { ...AT, secret: OTHER })).toThrow(SealError);
    expect(() => open(sealed, { ...AT, label: 'dq/other/v1' })).toThrow(SealError);
    expect(() => open(sealed, { ...AT, aad: 'c5a0b7e2-0000-4000-8000-000000000001|patient' })).toThrow(SealError);
    expect(() => open(sealed, { ...AT, aad: 'c5a0b7e2-0000-4000-8000-000000000002|gp' })).toThrow(SealError);
  });

  test('anything not a whole v1 seal is refused', () => {
    const sealed = seal(KEY, AT);
    const [, iv, body, tag] = sealed.split('.');
    for (const bad of [
      '', 'v1', `v1.${iv}.${body}`, `v2.${iv}.${body}.${tag}`, `v1.${iv}.${body}.${tag}.x`,
      `v1.${iv.slice(2)}.${body}.${tag}`, `v1.${iv}.${body}.${tag.slice(2)}`, `v1.${iv}..${tag}`, 'not a seal at all',
    ]) expect(() => open(bad, AT), bad).toThrow(SealError);
  });

  // An error must never carry the key, the seal or where it belongs into a
  // log, a response or app_errors.
  test('a refusal says nothing about what was refused', () => {
    const sealed = seal(KEY, AT);
    try {
      open(flip(sealed, 2), AT);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(SealError);
      expect((err as Error).message).toBe('sealed value rejected');
      expect(String((err as Error).stack)).not.toContain(sealed.split('.')[2]);
      expect(String((err as Error).stack)).not.toContain(AT.aad);
    }
  });

  test('a seal must say where it belongs', () => {
    expect(() => seal(KEY, { ...AT, aad: '' })).toThrow(TypeError);
    expect(() => seal(KEY, { ...AT, label: '' })).toThrow(TypeError);
    expect(() => open(seal(KEY, AT), { ...AT, aad: '' })).toThrow(TypeError);
  });
});

describe('the sealing secret', () => {
  afterEach(() => vi.unstubAllEnvs());
  const b64 = (bytes: Buffer) => bytes.toString('base64');

  test('is CALL_KEY_SECRET: at least 32 random bytes, base64 or base64url', () => {
    vi.stubEnv('CALL_KEY_SECRET', b64(SECRET));
    expect(sealingSecret()?.equals(SECRET)).toBe(true);
    vi.stubEnv('CALL_KEY_SECRET', SECRET.toString('base64url'));
    expect(sealingSecret()?.equals(SECRET)).toBe(true);
  });

  test('is refused when missing, short, not base64, or another secret reused', () => {
    for (const value of ['', b64(randomBytes(16)), 'correct horse battery staple correct horse battery', `${b64(SECRET)}!`]) {
      vi.stubEnv('CALL_KEY_SECRET', value);
      expect(sealingSecret(), value).toBeNull();
    }
    vi.stubEnv('CALL_KEY_SECRET', b64(SECRET));
    vi.stubEnv('DOCTOR_SESSION_SECRET', b64(SECRET));
    expect(sealingSecret()).toBeNull();
    vi.stubEnv('DOCTOR_SESSION_SECRET', '');
    vi.stubEnv('ADMIN_SESSION_SECRET', b64(SECRET));
    expect(sealingSecret()).toBeNull();
  });
});
