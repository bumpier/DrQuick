import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

// Sealing small secrets at rest: the video call's encryption keys first
// (docs/superpowers/specs/2026-10-13-encrypted-video-calls-design.md), and the
// patient fields of part 2 later, each under a label of its own.
//
// AES-256-GCM with a random 96-bit IV. The key is derived with HKDF-SHA256 from
// CALL_KEY_SECRET and a purpose label, so one secret seals each kind of value
// under a different key. The associated data names where a value belongs (for a
// call key, `consultation_id|role`): a sealed value copied into another row or
// column opens nowhere. The secret lives only in the environment, so a copy of
// the database alone yields nothing.
//
// Format: `v1.<iv>.<ciphertext>.<tag>`, base64url. Every refusal is the same
// SealError, whose message carries nothing about what was refused: an error must
// never put a key, a seal or its place into a log, a response or app_errors.

const VERSION = 'v1';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const SALT = Buffer.from('drquick/sealed');
const B64URL = /^[A-Za-z0-9_-]+$/;

export class SealError extends Error {
  constructor() {
    super('sealed value rejected');
    this.name = 'SealError';
  }
}

/** Where a sealed value belongs: the secret, its purpose, and its place. */
export type SealContext = { secret: Buffer; label: string; aad: string };

function keyFor({ secret, label, aad }: SealContext): Buffer {
  if (!label || !aad) throw new TypeError('seal needs a label and associated data');
  return Buffer.from(hkdfSync('sha256', secret, SALT, label, 32));
}

export function seal(plain: Uint8Array, context: SealContext): string {
  const key = keyFor(context);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(context.aad, 'utf8'));
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return [VERSION, iv, body, cipher.getAuthTag()].map((p) => (typeof p === 'string' ? p : p.toString('base64url'))).join('.');
}

export function open(sealed: string, context: SealContext): Buffer {
  const key = keyFor(context);
  const parts = typeof sealed === 'string' ? sealed.split('.') : [];
  if (parts.length !== 4 || parts[0] !== VERSION || !parts.slice(1).every((p) => B64URL.test(p))) throw new SealError();
  const [iv, body, tag] = parts.slice(1).map((p) => Buffer.from(p, 'base64url'));
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES || body.length === 0) throw new SealError();
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_BYTES });
    decipher.setAAD(Buffer.from(context.aad, 'utf8'));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]);
  } catch {
    throw new SealError();
  }
}

const BASE64 = /^[A-Za-z0-9+/_-]+={0,2}$/;

/**
 * The sealing secret from CALL_KEY_SECRET (base64 or base64url): at least 32
 * bytes, and never one of the session secrets reused. Null otherwise, which
 * leaves video calls off rather than sealing with a weak or shared key.
 */
export function sealingSecret(): Buffer | null {
  const raw = process.env.CALL_KEY_SECRET?.trim();
  if (!raw || !BASE64.test(raw)) return null;
  if ([process.env.DOCTOR_SESSION_SECRET, process.env.ADMIN_SESSION_SECRET].some((s) => s && s.trim() === raw)) return null;
  const bytes = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  return bytes.length >= 32 ? bytes : null;
}
