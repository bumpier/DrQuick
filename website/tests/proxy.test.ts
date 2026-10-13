import { afterEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { doctorCsp } from '@/lib/csp';
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

// The patient prototype is matched only for its development-only policy below.
// Both are matched in any case: next.config.ts leaves them out of its static
// CSP without regard to case, so a page at /DOCTOR must still get this one.
test('the proxy runs on the two signed-in areas and the patient prototype, in any case, and nothing else', () => {
  expect(config.matcher).toEqual([
    '/admin', '/admin/:path*',
    '/:root([dD][oO][cC][tT][oO][rR])', '/:root([dD][oO][cC][tT][oO][rR])/:path*',
    '/:root([pP][aA][tT][iI][eE][nN][tT])', '/:root([pP][aA][tT][iI][eE][nN][tT])/:path*',
  ]);
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
