// Password hashing for every sign-in: scrypt, with the salt and cost stored in
// the hash so the cost can rise later. Server-only.
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 256;

export const SCRYPT_N = 16384;
export const KEYLEN = 64;

const b64 = (buf: Buffer) => buf.toString('base64url');

export function hashPassword(password: string, salt = randomBytes(16)): string {
  const key = scryptSync(password.normalize('NFKC'), salt, KEYLEN, { N: SCRYPT_N });
  return `scrypt:${SCRYPT_N}:${b64(salt)}:${b64(key)}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, n, salt, hash] = stored.split(':');
  if (scheme !== 'scrypt' || !n || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = scryptSync(password.normalize('NFKC'), Buffer.from(salt, 'base64url'), expected.length, { N: Number(n) });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
