import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { ROLE_SCRIPT } from '@/lib/role-script';
import { ROLE_SCRIPT_HASH, doctorCsp, livekitOrigin, newNonce } from '@/lib/csp';

// The doctor portal's policy, and in development the patient prototype's: the
// video call's keys live in these pages, so a script injected there would read
// them (docs/superpowers/specs/2026-10-13-encrypted-video-calls-design.md).

const directives = (csp: string) => Object.fromEntries(
  csp.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
    const [name, ...values] = d.split(/\s+/);
    return [name, values];
  }),
);
const NONCE = 'AAAAAAAAAAAAAAAAAAAAAA==';
const MEDIA = 'wss://media.drquick.example';

describe('the media server the portal may connect to', () => {
  test('is a bare wss:// origin', () => {
    expect(livekitOrigin(MEDIA)).toBe(MEDIA);
    expect(livekitOrigin(`${MEDIA}/`)).toBe(MEDIA);
    expect(livekitOrigin('wss://drquick-abc123.livekit.cloud')).toBe('wss://drquick-abc123.livekit.cloud');
    expect(livekitOrigin(`${MEDIA}:7880`)).toBe(`${MEDIA}:7880`);
  });

  // A setting that is not a plain encrypted origin is ignored rather than
  // allowed to widen the policy.
  test('refuses anything else', () => {
    for (const url of [
      undefined, '', 'media.drquick.example', 'ws://media.drquick.example', 'https://media.drquick.example',
      `${MEDIA}/rtc`, `${MEDIA}?x=1`, `${MEDIA}#a`, 'wss://user:pass@media.drquick.example',
      "wss://a.example; script-src 'unsafe-inline'", 'wss://a.example b.example', 'wss://*.livekit.cloud',
      'javascript:alert(1)',
    ]) expect(livekitOrigin(url), String(url)).toBeNull();
  });
});

describe('the policy', () => {
  test('runs only scripts Next has nonced, and the role script by its hash', () => {
    const d = directives(doctorCsp({ nonce: NONCE, livekitOrigin: MEDIA, dev: false }));
    expect(d['script-src']).toEqual(["'self'", `'nonce-${NONCE}'`, "'strict-dynamic'", ROLE_SCRIPT_HASH]);
    expect(d['script-src']).not.toContain("'unsafe-inline'");
    expect(d['script-src']).not.toContain("'unsafe-eval'");
  });

  test('connects only to this site and the media server', () => {
    expect(directives(doctorCsp({ nonce: NONCE, livekitOrigin: MEDIA, dev: false }))['connect-src'])
      .toEqual(["'self'", MEDIA, 'https://media.drquick.example']);
    expect(directives(doctorCsp({ nonce: NONCE, livekitOrigin: null, dev: false }))['connect-src']).toEqual(["'self'"]);
  });

  test('locks everything else down', () => {
    const d = directives(doctorCsp({ nonce: NONCE, livekitOrigin: MEDIA, dev: false }));
    expect(d['default-src']).toEqual(["'self'"]);
    expect(d['worker-src']).toEqual(["'self'"]);
    expect(d['object-src']).toEqual(["'none'"]);
    expect(d['base-uri']).toEqual(["'none'"]);
    expect(d['form-action']).toEqual(["'none'"]);
    expect(d['frame-ancestors']).toEqual(["'none'"]);
    expect(d['frame-src']).toBeUndefined();
  });

  test('in development, adds only what the dev server needs', () => {
    const d = directives(doctorCsp({ nonce: NONCE, livekitOrigin: null, dev: true }));
    expect(d['script-src']).toEqual(["'self'", `'nonce-${NONCE}'`, "'strict-dynamic'", ROLE_SCRIPT_HASH, "'unsafe-eval'"]);
    expect(d['connect-src']).toEqual(["'self'", 'ws:']);
  });

  test('the hash is that of the role script the root layout renders', () => {
    expect(ROLE_SCRIPT_HASH).toBe(`'sha256-${createHash('sha256').update(ROLE_SCRIPT).digest('base64')}'`);
    expect(readFileSync(join(__dirname, '../app/layout.tsx'), 'utf8')).toMatch(/from '@\/lib\/role-script'/);
  });

  test('a nonce is 128 random bits, fresh every time', () => {
    const nonces = new Set(Array.from({ length: 100 }, () => newNonce()));
    expect(nonces.size).toBe(100);
    for (const nonce of nonces) expect(Buffer.from(nonce, 'base64')).toHaveLength(16);
  });
});
