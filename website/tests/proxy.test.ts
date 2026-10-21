import { afterEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
import * as pageStaticInfo from 'next/dist/build/analysis/get-page-static-info';
import { getMiddlewareRouteMatcher } from 'next/dist/shared/lib/router/utils/middleware-route-matcher';
// The real livekitOrigin, watched: the proxy runs on every request, and only a
// call page needs the media server's origin.
vi.mock('@/lib/csp', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/csp')>();
  return { ...real, livekitOrigin: vi.fn(real.livekitOrigin) };
});

import { doctorCsp, livekitOrigin } from '@/lib/csp';
import { config, proxy } from '@/proxy';
import { DOCTOR_NAV, activeNavHref } from '@/components/app/nav';

const visit = (path: string, cookie?: string) =>
  proxy(new NextRequest(`http://localhost${path}`, cookie ? { headers: { cookie } } : undefined));

// A redirect names where it goes; a pass-through has no Location.
const sentTo = (path: string, cookie?: string) => {
  const location = visit(path, cookie).headers.get('location');
  return location ? new URL(location).pathname : null;
};

describe('the admin', () => {
  test('a visitor with no cookie is sent to the admin sign-in', () => {
    expect(sentTo('/admin')).toBe('/admin/login');
    expect(sentTo('/admin/waitlist/gps')).toBe('/admin/login');
  });

  test('the sign-in page and a visitor with the cookie pass', () => {
    expect(sentTo('/admin/login')).toBeNull();
    expect(sentTo('/admin/set-password')).toBeNull();
    expect(sentTo('/admin/finance/payouts', 'dq_admin=x')).toBeNull();
  });
});

describe('the doctor portal', () => {
  test('a visitor with no cookie is sent to the doctor sign-in, never the admin one', () => {
    expect(sentTo('/doctor')).toBe('/doctor/login');
    expect(sentTo('/doctor/earnings')).toBe('/doctor/login');
    expect(sentTo('/doctor/earnings/payouts/abc')).toBe('/doctor/login');
  });

  test('the pages a doctor needs before signing in pass without a cookie', () => {
    for (const path of ['/doctor/login', '/doctor/register', '/doctor/set-password']) expect(sentTo(path)).toBeNull();
  });

  // A redirected fetch would hand the poller the sign-in page with a 200; the
  // route answers 401 itself.
  test('the pulse route is left to answer for itself', () => {
    expect(sentTo('/doctor/pulse')).toBeNull();
  });

  test('a visitor with the cookie passes', () => {
    expect(sentTo('/doctor', 'dq_doctor=x')).toBeNull();
    expect(sentTo('/doctor/profile', 'dq_doctor=x')).toBeNull();
  });

  test('one area’s cookie does not open the other', () => {
    expect(sentTo('/doctor', 'dq_admin=x')).toBe('/doctor/login');
    expect(sentTo('/admin', 'dq_doctor=x')).toBe('/admin/login');
  });
});

// Every page and route, because the demo deployment's passcode gate stands in
// front of all of them (lib/demo/session.ts); only the build's static files
// and the public assets are left out, which the passcode page needs to load.
// Outside the demo deployment the proxy passes everything else straight
// through, as it did when it ran only on the two signed-in areas and /patient.
// Matched the way Next matches it, with its own compiler for the list.
test('the proxy runs on every path but the build’s static files and the public assets', () => {
  // Exported by Next at runtime (it compiles the proxy's matcher at build), but
  // left out of its type declarations.
  const { getMiddlewareMatchers } = pageStaticInfo as unknown as {
    getMiddlewareMatchers: (matcher: unknown, nextConfig: unknown) => Parameters<typeof getMiddlewareRouteMatcher>[0];
  };
  const matches = getMiddlewareRouteMatcher(getMiddlewareMatchers(config.matcher, {}));
  const runsOn = (path: string) => matches(path, new NextRequest(`http://localhost${path}`) as never, {});
  for (const path of [
    '/', '/about', '/blog/a-post', '/demo-access', '/dev/demo', '/dev/call', '/dev/demo/reset', '/api/waitlist',
    '/admin', '/admin/login', '/doctor', '/doctor/pulse', '/DOCTOR/login', '/patient', '/patient/book/call', '/PATIENT',
    '/sitemap.xml', '/brand', '/ASSETS/og.png', '/_next/data/build/index.json',
  ]) {
    expect(runsOn(path), path).toBe(true);
  }
  for (const path of [
    '/_next/static/chunks/main.js', '/_next/static/media/demoClock.worker.js', '/_next/image',
    '/favicon.ico', '/favicon.svg', '/assets/og.png', '/assets/site.webmanifest',
  ]) {
    expect(runsOn(path), path).toBe(false);
  }
});

// The doctor portal holds the video call's keys, so it gets a nonce-based CSP
// on every response (lib/csp.ts); next.config.ts sends none there.
describe('the doctor portal’s CSP', () => {
  const csp = (path: string, cookie?: string) => visit(path, cookie).headers.get('content-security-policy');
  const nonceOf = (policy: string | null) => policy?.match(/'nonce-([^']+)'/)?.[1];
  afterEach(() => vi.unstubAllEnvs());

  test('every portal page gets one, with a fresh nonce each time, signed in or not', () => {
    const first = csp('/doctor', 'dq_doctor=x');
    expect(first).toBe(doctorCsp({ nonce: nonceOf(first)!, livekitOrigin: null, dev: false }));
    expect(nonceOf(csp('/doctor', 'dq_doctor=x'))).not.toBe(nonceOf(first));
    for (const path of ['/doctor/login', '/doctor/pulse', '/doctor/earnings']) expect(nonceOf(csp(path, 'dq_doctor=x')), path).toBeTruthy();
    // Next reads the policy from the request to nonce its own scripts.
    const response = visit('/doctor/login');
    expect(response.headers.get('x-middleware-request-content-security-policy')).toBe(response.headers.get('content-security-policy'));
    expect(response.headers.get('content-security-policy-report-only')).toBe("require-trusted-types-for 'script'");
  });

  // Next matches routes case-insensitively, so the static policy's exclusion does too.
  test('however the path is cased', () => {
    expect(nonceOf(csp('/DOCTOR/login'))).toBeTruthy();
  });

  test('names the media server from LIVEKIT_URL, and ignores a setting that is not one', () => {
    vi.stubEnv('LIVEKIT_URL', 'wss://media.drquick.example');
    expect(csp('/doctor/login')).toContain("connect-src 'self' wss://media.drquick.example https://media.drquick.example;");
    vi.stubEnv('LIVEKIT_URL', "wss://a.example; script-src 'unsafe-inline'");
    expect(csp('/doctor/login')).toContain("connect-src 'self';");
  });

  test('LIVEKIT_URL is read only for a page that gets a call policy, never for the rest of the site', () => {
    vi.stubEnv('LIVEKIT_URL', 'wss://media.drquick.example');
    const parse = vi.mocked(livekitOrigin);
    parse.mockClear();
    for (const path of ['/', '/about', '/admin/login', '/patient/book/call', '/api/waitlist', '/dev/demo']) visit(path, 'dq_admin=x');
    expect(parse).not.toHaveBeenCalled();
    csp('/doctor/login');
    expect(parse).toHaveBeenCalledTimes(1);
  });

  test('the admin, and the patient prototype in production, are left to next.config.ts', () => {
    expect(csp('/admin', 'dq_admin=x')).toBeNull();
    expect(csp('/patient/book/call')).toBeNull();
  });

  test('in development the patient prototype gets it too, for its call', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const policy = csp('/patient/book/call');
    expect(policy).toBe(doctorCsp({ nonce: nonceOf(policy)!, livekitOrigin: null, dev: true }));
  });
});

describe('which nav item a path lights', () => {
  const hrefs = DOCTOR_NAV.map((item) => item.href);

  test('the home item only on exactly the home path', () => {
    expect(activeNavHref('/doctor', hrefs, '/doctor')).toBe('/doctor');
    expect(activeNavHref('/doctor/', hrefs, '/doctor')).toBe('/doctor');
  });

  test('a page under a section lights that section', () => {
    expect(activeNavHref('/doctor/earnings', hrefs, '/doctor')).toBe('/doctor/earnings');
    expect(activeNavHref('/doctor/earnings/payouts/abc', hrefs, '/doctor')).toBe('/doctor/earnings');
  });

  test('a path under no section lights nothing', () => {
    expect(activeNavHref('/doctor/elsewhere', hrefs, '/doctor')).toBeNull();
  });
});
