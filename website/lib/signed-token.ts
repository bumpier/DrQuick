// A signed, expiring token: base64url(JSON payload) + "." + HMAC-SHA256 over it.
// What both session cookies are (lib/admin-auth.ts, lib/doctor-auth.ts). It
// proves the payload was written by this server and has not expired; whether
// the account it names may still sign in is the caller's check. Server-only.
import { createHmac, timingSafeEqual } from 'node:crypto';

const mac = (payload: string, key: string) => createHmac('sha256', key).update(payload).digest('base64url');

// `payload.exp` is the expiry, in milliseconds since the epoch.
export function signToken(payload: Record<string, unknown>, key: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${mac(body, key)}`;
}

// The payload, if the signature is genuine and the token has not expired.
export function readToken(token: string | undefined, key: string, now = Date.now()): Record<string, unknown> | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(mac(body, key));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let data: unknown;
  try { data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return null; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const exp = (data as { exp?: unknown }).exp;
  if (typeof exp !== 'number' || exp <= now) return null;
  return data as Record<string, unknown>;
}
