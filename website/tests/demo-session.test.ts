// The passcode gate of the demo deployment at demo.drquick.co.uk
// (docs/superpowers/plans/2026-10-19-live-demo-deployment.md, Task 2): the
// dq_demo session, the passcode page's action, and the proxy in front of every
// page and route of that deployment. Node environment on purpose: lib/demo.ts
// reads the build's flag alone in a browser, so a server check must be tested
// where there is no window.
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

const jar = new Map<string, { value: string; opts?: Record<string, unknown> }>();
const reqHeaders = new Headers();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)!.value } : undefined),
    set: (name: string, value: string, opts?: Record<string, unknown>) => { jar.set(name, { value, opts }); },
    delete: (arg: string | { name: string }) => { jar.delete(typeof arg === 'string' ? arg : arg.name); },
  }),
  headers: async () => reqHeaders,
}));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => { throw Object.assign(new Error(`NEXT_REDIRECT ${to}`), { digest: `NEXT_REDIRECT;${to}` }); },
  notFound: () => { throw new Error('NEXT_NOT_FOUND'); },
}));
// The real comparison, watched: a right and a wrong passcode must do the same work.
vi.mock('node:crypto', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:crypto')>();
  return { ...real, timingSafeEqual: vi.fn(real.timingSafeEqual) };
});

import { timingSafeEqual } from 'node:crypto';
import { NextRequest } from 'next/server';
import { setDb, type DB } from '@/lib/db';
import { demoDatabaseProblem } from '@/lib/demo/database';
import { demoGuard } from '@/lib/demo/guard';
import {
  DEMO_COOKIE, DEMO_SESSION_HOURS, demoConfigured, demoCookieOptions, hasDemoSession, passcodeMatches,
  readDemoSession, safeNext, signDemoSession,
} from '@/lib/demo/session';
import { signToken } from '@/lib/signed-token';
import { enterDemo } from '@/app/demo-access/actions';
import { proxy } from '@/proxy';
import { resetDb, useTestDb } from './helpers/db';

const PASSCODE = 'river-otter-harbour-42';
const SECRET = 'k'.repeat(40);
const HOUR = 3_600_000;

let db: DB;
beforeAll(async () => { db = await useTestDb(); });
beforeEach(async () => {
  vi.unstubAllEnvs();
  setDb(db);
  await resetDb(db);
  jar.clear();
  reqHeaders.set('x-forwarded-for', '203.0.113.9, 10.0.0.1');
});
afterEach(() => vi.unstubAllEnvs());

// The demo deployment: a production build made with NEXT_PUBLIC_DEMO=1, run
// with DEMO_DEPLOYMENT=1, a passcode and a session secret.
const DEMO_DB = 'postgres://u:p@127.0.0.1:5432/drquick_demo';
function demoDeploymentEnv({ passcode = PASSCODE, secret = SECRET, deployment = '1', database = DEMO_DB } = {}) {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('NEXT_PUBLIC_DEMO', '1');
  vi.stubEnv('DEMO_DEPLOYMENT', deployment);
  vi.stubEnv('DEMO_PASSCODE', passcode);
  vi.stubEnv('DEMO_SESSION_SECRET', secret);
  vi.stubEnv('DATABASE_URL', database);
}

// The real site: a production build with neither flag.
function realSiteEnv() {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('NEXT_PUBLIC_DEMO', '');
  vi.stubEnv('DEMO_DEPLOYMENT', '');
}

describe('demoConfigured', () => {
  test('needs a passcode of 16 characters or more, not counting spaces around it', () => {
    demoDeploymentEnv();
    expect(demoConfigured()).toBe(true);
    demoDeploymentEnv({ passcode: 'p'.repeat(16) });
    expect(demoConfigured()).toBe(true);
    demoDeploymentEnv({ passcode: 'p'.repeat(15) });
    expect(demoConfigured()).toBe(false);
    demoDeploymentEnv({ passcode: `   ${'p'.repeat(15)}   ` });
    expect(demoConfigured()).toBe(false);
    demoDeploymentEnv({ passcode: ' '.repeat(20) });
    expect(demoConfigured()).toBe(false);
    demoDeploymentEnv({ passcode: '' });
    expect(demoConfigured()).toBe(false);
  });

  // A wrong DATABASE_URL must lock the whole copy, not only the demo routes:
  // the passcode page, the doctor sign-in and the API all write to it.
  test('needs the demo’s own database: on this machine, named for the demo in its path alone', () => {
    demoDeploymentEnv({ database: 'postgres://u:p@localhost/drquick_demo?sslmode=disable' });
    expect(demoConfigured()).toBe(true);
    for (const database of [
      '', 'not a url', 'postgres://u:p@127.0.0.1:5432/drquick', 'postgres://u:p@db.example.com:5432/drquick_demo',
      `${DEMO_DB}?database=drquick`, `${DEMO_DB}?DBNAME=drquick`, `${DEMO_DB}?db`,
    ]) {
      demoDeploymentEnv({ database });
      expect(demoConfigured(), database).toBe(false);
    }
  });

  test('needs a session secret of 32 characters or more, not counting spaces around it', () => {
    demoDeploymentEnv({ secret: 'k'.repeat(32) });
    expect(demoConfigured()).toBe(true);
    demoDeploymentEnv({ secret: 'k'.repeat(31) });
    expect(demoConfigured()).toBe(false);
    demoDeploymentEnv({ secret: ` ${'k'.repeat(31)} ` });
    expect(demoConfigured()).toBe(false);
    demoDeploymentEnv({ secret: ' '.repeat(32) });
    expect(demoConfigured()).toBe(false);
    demoDeploymentEnv({ secret: '' });
    expect(demoConfigured()).toBe(false);
  });
});

// The one rule for the demo's database (lib/demo/database.ts), shared by the
// proxy's 503 and assertLocal: a database on this machine, named for the demo
// in the URL's path, with no name in the query (postgres.js would send it in
// its startup message and connect there instead).
describe('demoDatabaseProblem', () => {
  test('the demo’s own database is no problem', () => {
    for (const url of [DEMO_DB, 'postgres://u:p@localhost/drquick_demo', 'postgresql://u:p@[::1]:5432/demo', `${DEMO_DB}?sslmode=disable`]) {
      expect(demoDatabaseProblem(url), url).toBeNull();
    }
  });

  test('names what is wrong, as a fixed code', () => {
    expect(demoDatabaseProblem(undefined)).toBe('missing');
    expect(demoDatabaseProblem('')).toBe('missing');
    expect(demoDatabaseProblem('not a url')).toBe('not_local');
    expect(demoDatabaseProblem('postgres://u:p@db.example.com/drquick_demo')).toBe('not_local');
    expect(demoDatabaseProblem('postgres://u:p@127.0.0.1/drquick')).toBe('not_demo');
    expect(demoDatabaseProblem('postgres://u:p@127.0.0.1/drquick?application_name=demo')).toBe('not_demo');
    for (const key of ['database', 'DATABASE', 'db', 'Db', 'dbname', 'DBNAME']) {
      expect(demoDatabaseProblem(`${DEMO_DB}?${key}=drquick`), key).toBe('named_in_query');
    }
  });
});

describe('the demo session', () => {
  beforeEach(() => demoDeploymentEnv());

  test('a signed session reads back for twelve hours, and not a moment longer', () => {
    expect(DEMO_SESSION_HOURS).toBe(12);
    const token = signDemoSession(1_000)!;
    expect(readDemoSession(token, 1_000 + 12 * HOUR - 1)).toBe(true);
    expect(readDemoSession(token, 1_000 + 12 * HOUR)).toBe(false);
  });

  test('a tampered, foreign or empty token is no session', () => {
    const token = signDemoSession()!;
    const [body, sig] = token.split('.');
    const flipped = `${body}.${sig.slice(0, -1)}${sig.endsWith('A') ? 'B' : 'A'}`;
    expect(readDemoSession(flipped)).toBe(false);
    const longer = Buffer.from(JSON.stringify({ exp: Date.now() + 100 * HOUR })).toString('base64url');
    expect(readDemoSession(`${longer}.${sig}`)).toBe(false);
    expect(readDemoSession(signToken({ exp: Date.now() + HOUR }, 'z'.repeat(40)))).toBe(false);
    // The right key, but not a session this server made: it names no passcode.
    expect(readDemoSession(signToken({ exp: Date.now() + HOUR }, SECRET))).toBe(false);
    expect(readDemoSession(undefined)).toBe(false);
    expect(readDemoSession('')).toBe(false);
  });

  test('changing the passcode signs every session out', () => {
    const token = signDemoSession()!;
    vi.stubEnv('DEMO_PASSCODE', 'a-new-passcode');
    expect(readDemoSession(token)).toBe(false);
    vi.stubEnv('DEMO_PASSCODE', PASSCODE);
    expect(readDemoSession(token)).toBe(true);
  });

  test('a server that is not set up signs nothing and reads nothing', () => {
    const token = signDemoSession()!;
    vi.stubEnv('DEMO_SESSION_SECRET', 'short');
    expect(signDemoSession()).toBeNull();
    expect(readDemoSession(token)).toBe(false);
    vi.stubEnv('DEMO_SESSION_SECRET', SECRET);
    vi.stubEnv('DEMO_PASSCODE', '');
    expect(readDemoSession(token)).toBe(false);
  });

  test('hasDemoSession reads the dq_demo cookie from a Request or a NextRequest', () => {
    const token = signDemoSession()!;
    const cookie = `dq_consent=granted; ${DEMO_COOKIE}=${token}; dq_doctor=x`;
    expect(hasDemoSession(new Request('https://demo.drquick.co.uk/dev/call', { headers: { cookie } }))).toBe(true);
    expect(hasDemoSession(new NextRequest('https://demo.drquick.co.uk/dev/call', { headers: { cookie } }))).toBe(true);
    expect(hasDemoSession(new Request('https://demo.drquick.co.uk/dev/call'))).toBe(false);
    expect(hasDemoSession(new Request('https://demo.drquick.co.uk/', { headers: { cookie: `${DEMO_COOKIE}=nonsense` } }))).toBe(false);
    expect(hasDemoSession(new Request('https://demo.drquick.co.uk/', { headers: { cookie: `x${DEMO_COOKIE}=${token}` } }))).toBe(false);
  });

  test('the cookie is httpOnly, Secure in production, SameSite=Lax, for the whole site, for twelve hours', () => {
    expect(demoCookieOptions()).toEqual({ httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 12 * 3600 });
    vi.stubEnv('NODE_ENV', 'development');
    expect(demoCookieOptions().secure).toBe(false);
  });

  test('a right and a wrong passcode are checked with the same work: two SHA-256 digests, compared in constant time', () => {
    const compare = vi.mocked(timingSafeEqual);
    compare.mockClear();
    expect(passcodeMatches(PASSCODE)).toBe(true);
    expect(passcodeMatches('wrong')).toBe(false);
    expect(passcodeMatches('a much longer wrong passcode than the real one')).toBe(false);
    expect(passcodeMatches('')).toBe(false);
    expect(compare).toHaveBeenCalledTimes(4);
    for (const [a, b] of compare.mock.calls) expect([(a as Buffer).length, (b as Buffer).length]).toEqual([32, 32]);
  });

  test('no passcode configured matches nothing, not even an empty one', () => {
    vi.stubEnv('DEMO_PASSCODE', '');
    expect(passcodeMatches('')).toBe(false);
  });
});

describe('where the passcode page sends you', () => {
  test('a path on this site, with its query', () => {
    expect(safeNext('/patient/book')).toBe('/patient/book');
    expect(safeNext('/patient?data=seeded')).toBe('/patient?data=seeded');
    expect(safeNext('/doctor')).toBe('/doctor');
    expect(safeNext('/?role=patient')).toBe('/?role=patient');
  });

  // The bare address is where a presenter starts: they mean the presenter
  // page, which links to the website, not the website itself.
  test('the bare site address is the presenter page', () => {
    expect(safeNext('/')).toBe('/dev/demo');
  });

  test('anything else is the presenter page', () => {
    for (const next of [
      undefined, null, '', 'patient', '//evil.com', '//evil.com/dev/demo', 'https://evil.com', 'http://evil.com/x',
      '/\\evil.com', '\\\\evil.com', '/\t/evil.com', ' //evil.com', '/.//evil.com', '/..//evil.com', '/a/..//evil.com',
      'javascript:alert(1)', '/demo-access', '/demo-access?next=/x',
      42, ['/doctor'],
    ]) {
      expect(safeNext(next), String(next)).toBe('/dev/demo');
    }
  });
});

describe('the passcode page’s action', () => {
  const form = (passcode: string, next?: string) => {
    const f = new FormData();
    f.set('passcode', passcode);
    if (next !== undefined) f.set('next', next);
    return f;
  };
  const enter = (passcode: string, next?: string) => enterDemo({ error: null }, form(passcode, next));
  const redirectOf = async (attempt: Promise<unknown>) => {
    try {
      await attempt;
    } catch (err) {
      return (err as { digest?: string }).digest?.replace('NEXT_REDIRECT;', '') ?? null;
    }
    return null;
  };

  beforeEach(() => demoDeploymentEnv());

  test('a wrong passcode says so, and sets no cookie', async () => {
    expect(await enter('not-it')).toEqual({ error: 'That passcode isn\'t right.' });
    expect(jar.has(DEMO_COOKIE)).toBe(false);
  });

  test('the right passcode sets the session and goes where the visitor was going', async () => {
    expect(await redirectOf(enter(PASSCODE, '/patient/book'))).toBe('/patient/book');
    const cookie = jar.get(DEMO_COOKIE)!;
    expect(readDemoSession(cookie.value)).toBe(true);
    expect(cookie.opts).toEqual({ httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 12 * 3600 });
  });

  test('with nowhere named, or somewhere off this site, it goes to the presenter page', async () => {
    expect(await redirectOf(enter(PASSCODE))).toBe('/dev/demo');
    expect(await redirectOf(enter(PASSCODE, '/'))).toBe('/dev/demo');
    for (const next of ['//evil.com', 'https://evil.com', '/\\evil.com']) {
      expect(await redirectOf(enter(PASSCODE, next)), next).toBe('/dev/demo');
    }
  });

  test('an empty passcode is asked for, and not counted', async () => {
    expect(await enter('')).toEqual({ error: 'Enter the passcode.' });
    expect(await enter('   ')).toEqual({ error: 'Enter the passcode.' });
    // Nine wrong, so the right one is the tenth counted: the empty ones were not.
    for (let i = 0; i < 9; i++) await enter('wrong');
    expect(await redirectOf(enter(PASSCODE))).toBe('/dev/demo');
  });

  test('ten tries per ten minutes per address: the eleventh is refused, even with the right passcode', async () => {
    for (let i = 0; i < 10; i++) expect(await enter(`wrong-${i}`)).toEqual({ error: 'That passcode isn\'t right.' });
    expect(await enter(PASSCODE)).toEqual({ error: 'Too many attempts. Try again in ten minutes.' });
    expect(jar.has(DEMO_COOKIE)).toBe(false);
    // The address is the first entry of x-forwarded-for: another visitor is unaffected.
    reqHeaders.set('x-forwarded-for', '198.51.100.7');
    expect(await redirectOf(enter(PASSCODE))).toBe('/dev/demo');
  });

  test('refuses, and sets nothing, on a server that is not set up, and on the real site', async () => {
    demoDeploymentEnv({ secret: 'short' });
    expect((await enter(PASSCODE)).error).toBeTruthy();
    realSiteEnv();
    vi.stubEnv('DEMO_PASSCODE', PASSCODE);
    vi.stubEnv('DEMO_SESSION_SECRET', SECRET);
    expect((await enter(PASSCODE)).error).toBeTruthy();
    expect(jar.has(DEMO_COOKIE)).toBe(false);
  });

  test('without a database there is no rate limit, so no way in', async () => {
    setDb(null);
    expect((await enter(PASSCODE)).error).toBeTruthy();
    expect(jar.has(DEMO_COOKIE)).toBe(false);
  });
});

describe('the passcode page', () => {
  test('is a 404 on the real site', async () => {
    realSiteEnv();
    const { default: Page } = await import('@/app/demo-access/page');
    await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_NOT_FOUND');
  });
});

// The proxy, in front of every page and route of the demo deployment.
type Visit = { cookie?: string; method?: string; accept?: string; headers?: Record<string, string> };
function visit(path: string, { cookie, method = 'GET', accept = 'text/html,application/xhtml+xml', headers = {} }: Visit = {}) {
  return proxy(new NextRequest(`https://demo.drquick.co.uk${path}`, {
    method, headers: { accept, ...(cookie ? { cookie } : {}), ...headers },
  }));
}
const passedThrough = (response: Response) => response.headers.get('x-middleware-next') === '1' && !response.headers.get('location');
const lockedOut = async (response: Response) => [response.status, await response.json()];

describe('the proxy on the real site', () => {
  test('passes / and /dev/demo through exactly as before: no gate, no noindex, no policy', () => {
    realSiteEnv();
    for (const path of ['/', '/dev/demo', '/dev/call', '/api/waitlist', '/demo-access', '/patient/book/call']) {
      const response = visit(path);
      expect(passedThrough(response), path).toBe(true);
      expect(response.headers.get('x-robots-tag'), path).toBeNull();
      expect(response.headers.get('content-security-policy'), path).toBeNull();
    }
  });

  test('the doctor portal and the admin keep their redirects and policy', () => {
    realSiteEnv();
    expect(new URL(visit('/doctor').headers.get('location')!).pathname).toBe('/doctor/login');
    expect(new URL(visit('/admin').headers.get('location')!).pathname).toBe('/admin/login');
    expect(visit('/doctor/login').headers.get('content-security-policy')).toMatch(/'nonce-/);
  });

  test('passes through in development, demo flag or not, with no passcode', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_DEMO', '1');
    expect(passedThrough(visit('/dev/demo'))).toBe(true);
    expect(passedThrough(visit('/'))).toBe(true);
  });
});

describe('the proxy in the demo deployment, without the passcode', () => {
  beforeEach(() => demoDeploymentEnv());

  test('a page is sent to the passcode page, which remembers where it was going', () => {
    // The bare address names nowhere, so the passcode leads to the presenter page.
    const cases: Array<[string, string | null]> = [['/', null], ['/?role=patient', '/?role=patient'], ['/patient/book', '/patient/book'],
      ['/patient?data=seeded', '/patient?data=seeded'], ['/dev/demo', '/dev/demo'], ['/doctor/login', '/doctor/login']];
    for (const [path, next] of cases) {
      const response = visit(path);
      expect(response.status, path).toBe(307);
      const location = new URL(response.headers.get('location')!);
      expect([location.origin, location.pathname, location.searchParams.get('next')], path)
        .toEqual(['https://demo.drquick.co.uk', '/demo-access', next]);
      expect(response.headers.get('cache-control'), path).toBe('no-store');
    }
  });

  test('a fetch, a route, the API and a server action get 401 demo_locked, never a page', async () => {
    expect(await lockedOut(visit('/dev/call', { method: 'POST', accept: '*/*' }))).toEqual([401, { error: 'demo_locked' }]);
    expect(await lockedOut(visit('/api/waitlist', { method: 'POST', accept: '*/*' }))).toEqual([401, { error: 'demo_locked' }]);
    // The API is never a page, even to a browser.
    expect(await lockedOut(visit('/api/waitlist'))).toEqual([401, { error: 'demo_locked' }]);
    expect(await lockedOut(visit('/dev/demo/status', { accept: '*/*' }))).toEqual([401, { error: 'demo_locked' }]);
    expect(await lockedOut(visit('/dev/demo/reset', { method: 'POST', accept: '*/*' }))).toEqual([401, { error: 'demo_locked' }]);
    expect(await lockedOut(visit('/doctor/call', { method: 'POST', accept: '*/*' }))).toEqual([401, { error: 'demo_locked' }]);
    expect(await lockedOut(visit('/doctor/pulse', { method: 'POST', accept: '*/*' }))).toEqual([401, { error: 'demo_locked' }]);
    expect(await lockedOut(visit('/doctor/login', { method: 'POST', accept: 'text/x-component', headers: { 'next-action': 'abc' } })))
      .toEqual([401, { error: 'demo_locked' }]);
    expect(visit('/dev/call', { method: 'POST', accept: '*/*' }).headers.get('cache-control')).toBe('no-store');
  });

  test('a forged, expired or foreign cookie is no session', () => {
    const expired = signToken({ exp: Date.now() - 1 }, SECRET);
    for (const cookie of [`${DEMO_COOKIE}=x`, `${DEMO_COOKIE}=${expired}`, `${DEMO_COOKIE}=${signToken({ exp: Date.now() + HOUR }, 'z'.repeat(40))}`]) {
      expect(visit('/', { cookie }).status).toBe(307);
    }
  });

  test('the passcode page itself is open, and its action can be posted', () => {
    expect(passedThrough(visit('/demo-access'))).toBe(true);
    expect(passedThrough(visit('/demo-access?next=%2Fpatient'))).toBe(true);
    expect(passedThrough(visit('/demo-access', { method: 'POST', accept: 'text/x-component', headers: { 'next-action': 'abc' } }))).toBe(true);
  });

  test('every answer is noindex', () => {
    for (const response of [visit('/'), visit('/demo-access'), visit('/dev/call', { method: 'POST', accept: '*/*' })]) {
      expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    }
  });
});

describe('the proxy in the demo deployment, with the passcode', () => {
  const session = () => `${DEMO_COOKIE}=${signDemoSession()}`;
  beforeEach(() => demoDeploymentEnv());

  // Someone already in has no use for the passcode page: on to where they were going.
  test('the passcode page sends a signed-in visitor on, and still takes its action', () => {
    for (const [path, to] of [['/demo-access', '/dev/demo'], ['/demo-access?next=%2Fpatient%2Fbook', '/patient/book'],
      ['/demo-access?next=%2F', '/dev/demo'], ['/demo-access?next=%2F%2Fevil.com', '/dev/demo']]) {
      const response = visit(path, { cookie: session() });
      expect(response.status, path).toBe(307);
      const location = new URL(response.headers.get('location')!);
      expect(`${location.origin}${location.pathname}${location.search}`, path).toBe(`https://demo.drquick.co.uk${to}`);
      expect(response.headers.get('cache-control'), path).toBe('no-store');
    }
    expect(passedThrough(visit('/demo-access', {
      cookie: session(), method: 'POST', accept: 'text/x-component', headers: { 'next-action': 'abc' },
    }))).toBe(true);
  });

  test('every page and route passes, noindex', () => {
    for (const path of ['/', '/patient/book', '/dev/demo']) {
      const response = visit(path, { cookie: session() });
      expect(passedThrough(response), path).toBe(true);
      expect(response.headers.get('x-robots-tag'), path).toBe('noindex, nofollow');
    }
    expect(passedThrough(visit('/dev/call', { method: 'POST', accept: '*/*', cookie: session() }))).toBe(true);
    expect(passedThrough(visit('/api/waitlist', { method: 'POST', accept: '*/*', cookie: session() }))).toBe(true);
  });

  test('then the doctor portal’s own sign-in and policy apply, as on the real site', () => {
    expect(new URL(visit('/doctor', { cookie: session() }).headers.get('location')!).pathname).toBe('/doctor/login');
    const login = visit('/doctor/login', { cookie: session() });
    expect(login.headers.get('content-security-policy')).toMatch(/'nonce-[^']+' 'strict-dynamic'/);
    expect(login.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });

  test('the patient call screen gets a policy naming the media server and the workers, built for its prerendered page', () => {
    vi.stubEnv('LIVEKIT_URL', 'wss://drquick-demo.livekit.cloud');
    const response = visit('/patient/book/call', { cookie: session() });
    const policy = response.headers.get('content-security-policy')!;
    expect(policy).toContain("connect-src 'self' wss://drquick-demo.livekit.cloud https://drquick-demo.livekit.cloud;");
    expect(policy).toContain("worker-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    // The patient pages are prerendered at build: no nonce can reach their scripts.
    expect(policy).not.toContain('nonce-');
    expect(policy).not.toContain('strict-dynamic');
    expect(visit('/patient', { cookie: session() }).headers.get('content-security-policy')).toBe(policy);
  });
});

describe('the demo deployment, misconfigured, fails closed', () => {
  const unconfigured = async (response: Response) => [response.status, await response.text(), response.headers.get('x-robots-tag')];

  test.each([
    ['no passcode', { passcode: '' }],
    ['no session secret', { secret: '' }],
    ['a session secret under 32 characters', { secret: 'k'.repeat(31) }],
    ['a session secret of 32 spaces', { secret: ' '.repeat(32) }],
    ['a passcode under 16 characters', { passcode: 'p'.repeat(15) }],
    ['a demo build run without DEMO_DEPLOYMENT', { deployment: '' }],
    ['no database', { database: '' }],
    ['the real database', { database: 'postgres://u:p@127.0.0.1:5432/drquick' }],
    ['the demo name, overridden in the query', { database: `${DEMO_DB}?database=drquick` }],
    ['a database on another machine', { database: 'postgres://u:p@db.example.com:5432/drquick_demo' }],
  ])('%s: every page and route answers 503', async (_name, env) => {
    demoDeploymentEnv();
    const token = signDemoSession()!;
    demoDeploymentEnv(env);
    for (const [path, init] of [['/', {}], ['/demo-access', {}], ['/patient/book', { cookie: `${DEMO_COOKIE}=${token}` }],
      ['/dev/call', { method: 'POST', accept: '*/*', cookie: `${DEMO_COOKIE}=${token}` }], ['/api/waitlist', { method: 'POST' }]] as const) {
      expect(await unconfigured(visit(path, init)), path).toEqual([503, 'Demo not configured', 'noindex, nofollow']);
    }
  });

  test('and the demo routes refuse too, behind the proxy', () => {
    demoDeploymentEnv({ deployment: '' });
    vi.stubEnv('DATABASE_URL', 'postgres://u:p@127.0.0.1:5432/drquick_demo');
    expect(demoGuard(new Request('https://demo.drquick.co.uk/dev/demo/reset', { method: 'POST', headers: { host: 'demo.drquick.co.uk' } }))?.status)
      .toBe(404);
  });
});
