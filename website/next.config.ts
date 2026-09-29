import { execSync } from 'node:child_process';
import type { NextConfig } from 'next';

const DEV = process.env.NODE_ENV === 'development';

// The vercel.json policy with the Google Fonts hosts removed: next/font
// self-hosts Archivo under /_next/static, so 'self' now covers fonts and the
// CSP gets tighter, not looser. 'unsafe-inline' in script-src stays — the
// pre-paint role script and Next's own bootstrap are inline scripts.
//
// Public pages may be framed by this origin only: the admin's heatmap view
// iframes them (with ?dq_heatmap=1, which switches the tracker off). The admin
// itself is never framed by anyone (ADMIN_CSP and X-Frame-Options DENY below).
export const PROD_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
  "font-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'none'; " +
  "frame-ancestors 'self'; base-uri 'none'";

const unframeable = (csp: string) => csp.replace("frame-ancestors 'self'", "frame-ancestors 'none'");
export const ADMIN_CSP = unframeable(PROD_CSP);

// Dev needs eval (HMR compilation) and a websocket (HMR transport). Neither
// ever ships: this branch is dead in a production build.
const DEV_CSP = PROD_CSP
  .replace("script-src 'self' 'unsafe-inline'", "script-src 'self' 'unsafe-inline' 'unsafe-eval'")
  .replace("connect-src 'self'", "connect-src 'self' ws:");

const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=(), interest-cohort=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Content-Security-Policy', value: DEV ? DEV_CSP : PROD_CSP },
];

// The dashboards (milestones 2–4) are a prototype and must never be indexed.
// Configured ahead of the routes existing so it cannot be forgotten. /dev is the
// component gallery: development only, a 404 in production, and noindex besides.
const NOINDEX = { key: 'X-Robots-Tag', value: 'noindex, nofollow' };

// Later rules override earlier ones for the same key, so this replaces the
// frame permissions of the global set on every /admin path.
const ADMIN_HEADERS = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: DEV ? unframeable(DEV_CSP) : ADMIN_CSP },
  NOINDEX,
];

// Baked in when the config loads (at build, or when the dev server starts) for
// the admin's Technical page. No git (a tarball deploy) leaves the SHA empty.
function gitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 }).toString().trim();
  } catch {
    return '';
  }
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_SHA: process.env.NEXT_PUBLIC_BUILD_SHA || gitSha(),
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  // Loaded with require() at runtime rather than bundled: PGlite ships WASM and
  // data files it finds beside itself, and postgres.js is plain Node.
  serverExternalPackages: ['@electric-sql/pglite', 'postgres'],
  async headers() {
    return [
      { source: '/(.*)', headers: SECURITY_HEADERS },
      {
        source: '/assets/(.*)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      { source: '/patient/:path*', headers: [NOINDEX] },
      { source: '/doctor/:path*', headers: [NOINDEX] },
      { source: '/admin/:path*', headers: ADMIN_HEADERS },
      { source: '/dev/:path*', headers: [NOINDEX] },
      // The legal pages are drafts until the legal entity exists (PRODUCT.md);
      // a draft must never be indexed as if it were in force.
      { source: '/privacy', headers: [NOINDEX] },
      { source: '/terms', headers: [NOINDEX] },
      // An unsubscribe link is personal to one address.
      { source: '/unsubscribe', headers: [NOINDEX] },
      { source: '/unsubscribe/:path*', headers: [NOINDEX] },
      // The brand guidelines are a working document for partners and suppliers,
      // not a page for patients or GPs to find.
      { source: '/brand', headers: [NOINDEX] },
      { source: '/brand/:path*', headers: [NOINDEX] },
    ];
  },
  // public/brand/ is the guide built in ../Branding/src (guide.py, then pdf.py
  // copies it here). Next serves public files by exact path only, so /brand
  // needs pointing at its index.html.
  async rewrites() {
    return [{ source: '/brand', destination: '/brand/index.html' }];
  },
};

export default nextConfig;
