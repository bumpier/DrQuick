import { test, expect } from 'vitest';
import nextConfig, { PROD_CSP } from '@/next.config';

test('the CSP is the vercel.json policy minus the Google Fonts hosts', () => {
  expect(PROD_CSP).toBe(
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
    "font-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'none'; " +
    "frame-ancestors 'none'; base-uri 'none'"
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
  expect(get('X-Frame-Options')).toBe('DENY');
  expect(get('Permissions-Policy')).toBe('geolocation=(), microphone=(), camera=(), interest-cohort=()');
  expect(get('Strict-Transport-Security')).toBe('max-age=63072000; includeSubDomains; preload');
  expect(get('Content-Security-Policy')).toBe(PROD_CSP); // test env takes the prod branch
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
