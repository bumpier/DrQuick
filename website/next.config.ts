import type { NextConfig } from 'next';

const DEV = process.env.NODE_ENV === 'development';

// The vercel.json policy with the Google Fonts hosts removed: next/font
// self-hosts Archivo under /_next/static, so 'self' now covers fonts and the
// CSP gets tighter, not looser. 'unsafe-inline' in script-src stays — the
// pre-paint role script and Next's own bootstrap are inline scripts.
export const PROD_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
  "font-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'none'; " +
  "frame-ancestors 'none'; base-uri 'none'";

// Dev needs eval (HMR compilation) and a websocket (HMR transport). Neither
// ever ships: this branch is dead in a production build.
const DEV_CSP = PROD_CSP
  .replace("script-src 'self' 'unsafe-inline'", "script-src 'self' 'unsafe-inline' 'unsafe-eval'")
  .replace("connect-src 'self'", "connect-src 'self' ws:");

const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=(), interest-cohort=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Content-Security-Policy', value: DEV ? DEV_CSP : PROD_CSP },
];

// The dashboards (milestones 2–4) are a prototype and must never be indexed.
// Configured ahead of the routes existing so it cannot be forgotten. /dev is the
// component gallery: development only, a 404 in production, and noindex besides.
const NOINDEX = { key: 'X-Robots-Tag', value: 'noindex, nofollow' };

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: '/(.*)', headers: SECURITY_HEADERS },
      {
        source: '/assets/(.*)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      { source: '/patient/:path*', headers: [NOINDEX] },
      { source: '/doctor/:path*', headers: [NOINDEX] },
      { source: '/admin/:path*', headers: [NOINDEX] },
      { source: '/dev/:path*', headers: [NOINDEX] },
      // The legal pages are drafts until the legal entity exists (PRODUCT.md);
      // a draft must never be indexed as if it were in force.
      { source: '/privacy', headers: [NOINDEX] },
      { source: '/terms', headers: [NOINDEX] },
    ];
  },
};

export default nextConfig;
