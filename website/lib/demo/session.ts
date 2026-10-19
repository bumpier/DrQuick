// The demo deployment's passcode session (docs/superpowers/plans/2026-10-19-
// live-demo-deployment.md). demo.drquick.co.uk hands out live video-call keys
// with no sign-in of its own, so every page and route of it sits behind one
// passcode: proxy.ts sends anyone without this session to /demo-access, and
// lib/demo/guard.ts checks it again in every demo route. Server only.
//
// The session is a signed token (lib/signed-token.ts), keyed by
// DEMO_SESSION_SECRET, in the httpOnly dq_demo cookie: SameSite=Lax and path /,
// so the presenter's patient and doctor windows (one browser) share it, for
// twelve hours. It also carries an HMAC of the passcode, so changing
// DEMO_PASSCODE signs every session out.
//
// The passcode is compared in constant time, as SHA-256 digests of equal
// length, so a wrong one and the right one take the same time to check.
// Attempts are rate-limited per client address by app/demo-access/actions.ts.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { demoDatabaseProblem } from '@/lib/demo/database';
import { readToken, signToken } from '@/lib/signed-token';

export const DEMO_COOKIE = 'dq_demo';
export const DEMO_SESSION_HOURS = 12;
export const DEMO_ACCESS_PATH = '/demo-access';
/** Where the passcode page sends the presenter when nothing else was asked for. */
export const DEMO_HOME = '/dev/demo';

// Both counted without the spaces around them: 32 spaces are no secret. A
// passcode under 16 characters is too easy to guess past a per-address limit.
const MIN_PASSCODE = 16;
const MIN_SECRET = 32;
const passcode = () => (process.env.DEMO_PASSCODE ?? '').trim();
const secret = () => (process.env.DEMO_SESSION_SECRET ?? '').trim();

/**
 * A passcode of 16 characters or more, a session secret of 32 or more, and the
 * demo's own database (lib/demo/database.ts). Without all three the demo
 * deployment answers 503 everywhere and no session is signed or read: a wrong
 * DATABASE_URL must lock the whole copy, because the passcode page, the doctor
 * sign-in and the API write to it, not only the demo routes.
 */
export function demoConfigured(): boolean {
  return passcode().length >= MIN_PASSCODE && secret().length >= MIN_SECRET
    && demoDatabaseProblem(process.env.DATABASE_URL) === null;
}

// Which passcode a session was opened with, without saying what it was: the
// cookie's payload is readable, and an unkeyed hash of a short passcode is not
// a secret.
const passcodeTag = () => createHmac('sha256', secret()).update(`dq/demo-passcode|${passcode()}`).digest('base64url');

/** A session for twelve hours from `now`, or null on a server that is not set up. */
export function signDemoSession(now = Date.now()): string | null {
  if (!demoConfigured()) return null;
  return signToken({ pc: passcodeTag(), exp: now + DEMO_SESSION_HOURS * 3_600_000 }, secret());
}

/** Whether a token is a live session of this server, under its current passcode. */
export function readDemoSession(token: string | undefined, now = Date.now()): boolean {
  if (!token || !demoConfigured()) return false;
  const data = readToken(token, secret(), now);
  return data !== null && data.pc === passcodeTag();
}

// Every dq_demo value in the Cookie header; a cookie of another path may share the name.
function demoCookies(request: Request): string[] {
  return (request.headers.get('cookie') ?? '').split(';').flatMap((pair) => {
    const at = pair.indexOf('=');
    return at > 0 && pair.slice(0, at).trim() === DEMO_COOKIE ? [pair.slice(at + 1).trim()] : [];
  });
}

/** Whether the request carries a live demo session. Takes a Request or a NextRequest. */
export function hasDemoSession(request: Request, now = Date.now()): boolean {
  return demoCookies(request).some((token) => readDemoSession(token, now));
}

/** The dq_demo cookie's attributes. */
export function demoCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: DEMO_SESSION_HOURS * 3600,
  };
}

const digest = (value: string) => createHash('sha256').update(value).digest();

/** Whether `attempt` is the passcode: the same work for any attempt, right or wrong, long or short. */
export function passcodeMatches(attempt: string): boolean {
  const same = timingSafeEqual(digest(attempt.trim()), digest(passcode()));
  return same && demoConfigured();
}

// Control characters, which a browser strips from a URL (so "/\t/evil.com"
// would become "//evil.com"), and backslashes, which it reads as slashes.
const UNSAFE = /[\u0000-\u001f\u007f\\]/;
const BASE = 'https://demo.invalid';

/**
 * `next` if it is a path on this site (with its query), else the presenter
 * page. Never the passcode page itself, and never the bare site address: a
 * presenter who opens demo.drquick.co.uk means the presenter page, which links
 * to the website.
 */
export function safeNext(next: unknown): string {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//') || UNSAFE.test(next)) return DEMO_HOME;
  let url: URL;
  try { url = new URL(next, BASE); } catch { return DEMO_HOME; }
  if (url.origin !== BASE || url.pathname === DEMO_ACCESS_PATH || url.pathname.startsWith(`${DEMO_ACCESS_PATH}/`)) return DEMO_HOME;
  // Resolving dot segments can make one: "/.//evil.com" is the path "//evil.com".
  if (url.pathname.startsWith('//')) return DEMO_HOME;
  if (url.pathname === '/' && !url.search) return DEMO_HOME;
  return `${url.pathname}${url.search}`;
}
