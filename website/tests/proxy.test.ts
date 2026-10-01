import { describe, expect, test } from 'vitest';
import { NextRequest } from 'next/server';
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

test('the proxy runs on both areas and nothing else', () => {
  expect(config.matcher).toEqual(['/admin', '/admin/:path*', '/doctor', '/doctor/:path*']);
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
