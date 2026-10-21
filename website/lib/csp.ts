import { createHash, randomBytes } from 'node:crypto';
import { ROLE_SCRIPT } from '@/lib/role-script';

// The Content Security Policy of the doctor portal, and in development of the
// patient prototype: the pages where the video call's keys live
// (docs/superpowers/specs/2026-10-13-encrypted-video-calls-design.md). A script
// injected there could read the keys, so no inline script runs unless Next has
// nonced it for this response, or it is the role script, allowed by its hash.
// proxy.ts sets it per request; next.config.ts sends no other policy there.
// The demo deployment's patient prototype is prerendered, so it cannot be
// nonced: it gets prerenderedCallCsp below instead.
//
// Inline styles stay allowed: Radix and sonner set style attributes, and a
// style cannot read a key. Trusted Types is reported, not yet enforced
// (TRUSTED_TYPES_REPORT_ONLY), until the portal's console is clean of it.

export const ROLE_SCRIPT_HASH = `'sha256-${createHash('sha256').update(ROLE_SCRIPT).digest('base64')}'`;

export const TRUSTED_TYPES_REPORT_ONLY = "require-trusted-types-for 'script'";

/** A nonce for one response: 128 random bits. */
export function newNonce(): string {
  return randomBytes(16).toString('base64');
}

// LIVEKIT_URL as a CSP source: a bare wss:// origin and nothing else, or null.
// A setting with a path, a query, credentials, a wildcard or stray characters
// is refused rather than allowed to widen the policy.
const HOST = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;

/** The media server's origin, `wss://host[:port]`, from LIVEKIT_URL, or null if it is not one. */
export function livekitOrigin(url: string | undefined): string | null {
  if (!url || /[\s;,'"]/.test(url)) return null;
  let parsed: URL;
  try { parsed = new URL(url); } catch { return null; }
  if (parsed.protocol !== 'wss:' || parsed.username || parsed.password) return null;
  if ((parsed.pathname !== '/' && parsed.pathname !== '') || parsed.search || parsed.hash) return null;
  if (!HOST.test(parsed.hostname)) return null;
  return parsed.origin.replace(/^https:/, 'wss:');
}

/** The policy for one response. `dev` adds only what the dev server needs: eval and its websocket. */
export function doctorCsp({ nonce, livekitOrigin: media, dev }: { nonce: string; livekitOrigin: string | null; dev: boolean }): string {
  const script = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ROLE_SCRIPT_HASH, ...(dev ? ["'unsafe-eval'"] : [])];
  const connect = ["'self'", ...(media ? [media, media.replace(/^wss:/, 'https:')] : []), ...(dev ? ['ws:'] : [])];
  return policy(script, connect);
}

/**
 * The policy of a call screen whose page is prerendered at build: the patient
 * prototype in the demo deployment (proxy.ts). Next nonces scripts only when it
 * renders a page for a request, so a nonce policy there would block every
 * script the page has. Its scripts run as on every other prerendered page of
 * the site ('self' and inline, next.config.ts); everything else is the
 * portal's: the media server and nothing more to connect to, same-origin
 * workers, no plugins, never framed.
 */
export function prerenderedCallCsp({ livekitOrigin: media }: { livekitOrigin: string | null }): string {
  return policy(["'self'", "'unsafe-inline'"], ["'self'", ...(media ? [media, media.replace(/^wss:/, 'https:')] : [])]);
}

function policy(script: readonly string[], connect: readonly string[]): string {
  return [
    "default-src 'self'",
    `script-src ${script.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data:",
    `connect-src ${connect.join(' ')}`,
    "worker-src 'self'",
    "object-src 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
  ].join('; ');
}
