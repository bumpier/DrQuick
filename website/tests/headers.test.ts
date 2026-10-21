import { test, expect, vi } from 'vitest';
import { getPathMatch } from 'next/dist/shared/lib/router/utils/path-match';
import nextConfig, { ADMIN_CSP, CSP_SOURCE, DOCTOR_PERMISSIONS, PROD_CSP } from '@/next.config';

test('the CSP is the vercel.json policy minus the Google Fonts hosts, frameable by this origin only', () => {
  expect(PROD_CSP).toBe(
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
    "font-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'none'; " +
    "frame-ancestors 'self'; base-uri 'none'"
  );
  expect(PROD_CSP).not.toContain('googleapis');
  expect(PROD_CSP).not.toContain('gstatic');
});

test('every route carries the security header set', async () => {
  const rules = await nextConfig.headers!();
  const global = rules.find((r) => r.source === '/(.*)')!;
  const get = (key: string) => global.headers.find((h) => h.key === key)?.value;
  expect(get('X-Content-Type-Options')).toBe('nosniff');
  expect(get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  expect(get('X-Frame-Options')).toBe('SAMEORIGIN'); // the admin heatmap iframes public pages
  expect(get('Permissions-Policy')).toBe('geolocation=(), microphone=(), camera=(), interest-cohort=()');
  expect(get('Strict-Transport-Security')).toBe('max-age=63072000; includeSubDomains; preload');
  // The CSP is its own rule, so the doctor portal can be left out of it.
  expect(get('Content-Security-Policy')).toBeUndefined();
});

// Next matches a header source the way it matches a route.
const matches = (source: string, path: string) =>
  Boolean(getPathMatch(source, { strict: true, removeUnnamedParams: true })(path));

// The doctor portal's policy is set per request by proxy.ts, with a nonce
// (lib/csp.ts): a second, static policy there would have to be met as well.
test('every page but the doctor portal takes the static CSP', async () => {
  const rules = await nextConfig.headers!();
  const csp = rules.find((r) => r.source === CSP_SOURCE)!;
  expect(csp.headers).toEqual([{ key: 'Content-Security-Policy', value: PROD_CSP }]); // test env takes the prod branch
  for (const path of ['/', '/about', '/blog/a-post', '/patient', '/patient/book/call', '/admin/login', '/gp/welcome', '/doctors']) {
    expect(matches(CSP_SOURCE, path), path).toBe(true);
  }
  for (const path of ['/doctor', '/doctor/', '/doctor/login', '/doctor/earnings/payouts', '/DOCTOR/login']) {
    expect(matches(CSP_SOURCE, path), path).toBe(false);
  }
  expect(rules.indexOf(csp)).toBeGreaterThan(rules.findIndex((r) => r.source === '/(.*)'));
  expect(rules.indexOf(csp)).toBeLessThan(rules.findIndex((r) => r.source === '/admin/:path*'));
});

test('assets are immutable-cached; the dashboard prefixes and the dev gallery are noindex', async () => {
  const rules = await nextConfig.headers!();
  const assets = rules.find((r) => r.source === '/assets/(.*)')!;
  expect(assets.headers).toContainEqual({ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' });
  for (const prefix of ['patient', 'doctor', 'admin', 'dev']) {
    const rule = rules.find((r) => r.source === `/${prefix}/:path*`)!;
    expect(rule.headers).toContainEqual({ key: 'X-Robots-Tag', value: 'noindex, nofollow' });
  }
});

test('the draft legal pages are noindex until they are in force', async () => {
  const rules = await nextConfig.headers!();
  for (const path of ['/privacy', '/terms']) {
    const rule = rules.find((r) => r.source === path)!;
    expect(rule.headers).toContainEqual({ key: 'X-Robots-Tag', value: 'noindex, nofollow' });
  }
});

test('the admin is never framed, not even by this origin, and is noindex', async () => {
  const rules = await nextConfig.headers!();
  const admin = rules.find((r) => r.source === '/admin/:path*')!;
  // Declared after the global rule, so these win for the same keys.
  expect(rules.indexOf(admin)).toBeGreaterThan(rules.findIndex((r) => r.source === '/(.*)'));
  expect(admin.headers).toContainEqual({ key: 'X-Frame-Options', value: 'DENY' });
  expect(admin.headers).toContainEqual({ key: 'Content-Security-Policy', value: ADMIN_CSP });
  expect(ADMIN_CSP).toBe(PROD_CSP.replace("frame-ancestors 'self'", "frame-ancestors 'none'"));
  expect(admin.headers).toContainEqual({ key: 'X-Robots-Tag', value: 'noindex, nofollow' });
});

// The video call runs here: the camera and microphone for this origin only,
// a window no other site can reach, and the CSP from proxy.ts.
test('the doctor portal is never framed, may use the camera, and is noindex', async () => {
  const rules = await nextConfig.headers!();
  const doctor = rules.find((r) => r.source === '/doctor/:path*')!;
  expect(rules.indexOf(doctor)).toBeGreaterThan(rules.findIndex((r) => r.source === '/(.*)'));
  expect(DOCTOR_PERMISSIONS).toBe('geolocation=(), microphone=(self), camera=(self), fullscreen=(self), interest-cohort=()');
  expect(doctor.headers).toEqual([
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Permissions-Policy', value: DOCTOR_PERMISSIONS },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
  ]);
});

// The patient prototype's call is real only on a developer's machine
// (devVideoRoom), so only there does /patient get the call's headers.
test('in production the patient prototype keeps the camera off; in development it gets the portal’s', async () => {
  const rules = await nextConfig.headers!();
  expect(rules.find((r) => r.source === '/patient/:path*')!.headers).toEqual([{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]);

  vi.stubEnv('NODE_ENV', 'development');
  vi.resetModules();
  try {
    const dev = await import('@/next.config');
    const devRules = await dev.default.headers!();
    expect(devRules.find((r) => r.source === '/patient/:path*')!.headers).toEqual([
      { key: 'Permissions-Policy', value: dev.DOCTOR_PERMISSIONS },
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
    ]);
    expect(matches(dev.CSP_SOURCE, '/patient/book/call')).toBe(false);
    expect(matches(dev.CSP_SOURCE, '/doctor/login')).toBe(false);
    expect(matches(dev.CSP_SOURCE, '/about')).toBe(true);
  } finally {
    vi.unstubAllEnvs();
    vi.resetModules();
  }
});

// The demo deployment's build (docs/superpowers/plans/2026-10-19-live-demo-
// deployment.md) is made with NEXT_PUBLIC_DEMO=1. Every response it sends is
// noindex, static files included, which the proxy does not see; and its
// patient prototype takes its policy from proxy.ts, which names the media
// server for the call. The real site's build has neither.
test('a demo build is noindex everywhere and leaves the patient prototype’s policy to the proxy; the real site is unchanged', async () => {
  const rules = await nextConfig.headers!();
  expect(rules.find((r) => r.source === '/(.*)')!.headers.some((h) => h.key === 'X-Robots-Tag')).toBe(false);
  expect(rules.some((r) => r.source === '/(.*)' && r.headers.some((h) => h.key === 'X-Robots-Tag'))).toBe(false);
  expect(matches(CSP_SOURCE, '/patient/book/call')).toBe(true);

  vi.stubEnv('NEXT_PUBLIC_DEMO', '1');
  vi.resetModules();
  try {
    const demo = await import('@/next.config');
    const demoRules = await demo.default.headers!();
    expect(demoRules.find((r) => r.source === '/(.*)')!.headers).toContainEqual({ key: 'X-Robots-Tag', value: 'noindex, nofollow' });
    const csp = demoRules.find((r) => r.source === demo.CSP_SOURCE)!;
    expect(csp.headers).toEqual([{ key: 'Content-Security-Policy', value: PROD_CSP }]);
    for (const path of ['/patient', '/patient/book/call', '/doctor/login']) expect(matches(demo.CSP_SOURCE, path), path).toBe(false);
    for (const path of ['/', '/about', '/demo-access', '/dev/demo', '/patients']) expect(matches(demo.CSP_SOURCE, path), path).toBe(true);
    // The demo patient sends a generated picture and no sound: no camera here either.
    expect(demoRules.find((r) => r.source === '/patient/:path*')!.headers).toEqual([{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]);
  } finally {
    vi.unstubAllEnvs();
    vi.resetModules();
  }
});

test('unsubscribe links are noindex', async () => {
  const rules = await nextConfig.headers!();
  for (const path of ['/unsubscribe', '/unsubscribe/:path*']) {
    const rule = rules.find((r) => r.source === path)!;
    expect(rule.headers).toContainEqual({ key: 'X-Robots-Tag', value: 'noindex, nofollow' });
  }
});
