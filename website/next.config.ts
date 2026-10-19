import { execSync } from 'node:child_process';
import type { NextConfig } from 'next';

const DEV = process.env.NODE_ENV === 'development';
// The demo deployment's build (lib/demo.ts, docs/superpowers/plans/2026-10-19-
// live-demo-deployment.md), or `npm run demo`. The real site never sets it.
const DEMO_BUILD = process.env.NEXT_PUBLIC_DEMO === '1';

// The vercel.json policy with the Google Fonts hosts removed: next/font
// self-hosts Archivo under /_next/static, so 'self' now covers fonts and the
// CSP gets tighter, not looser. 'unsafe-inline' in script-src stays — the
// pre-paint role script and Next's own bootstrap are inline scripts — except in
// the doctor portal, which gets a nonce-based policy instead (lib/csp.ts).
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
];

// The static CSP goes everywhere but the doctor portal, and in development and
// a demo build the patient prototype: there proxy.ts sets the policy per
// request (lib/csp.ts), because the video call's keys live in those pages and
// the call needs the media server, and a second policy here would have to be
// met as well. Next matches a source without regard to case, so /DOCTOR is
// left out too.
export const CSP_SOURCE = DEV || DEMO_BUILD ? '/((?!doctor(?:/|$)|patient(?:/|$)).*)' : '/((?!doctor(?:/|$)).*)';

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

// The doctor portal runs the video call: the camera and microphone for this
// origin only, never framed, and a window no other site can hold a reference
// to. Its CSP comes from proxy.ts (CSP_SOURCE above leaves it out).
export const DOCTOR_PERMISSIONS = 'geolocation=(), microphone=(self), camera=(self), fullscreen=(self), interest-cohort=()';
const DOCTOR_HEADERS = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: DOCTOR_PERMISSIONS },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  NOINDEX,
];

// The patient prototype's call is real only on a developer's machine and in the
// demo deployment, and only on a developer's machine does it get the camera: the
// demo deployment's patient sends a generated picture and no sound
// (components/call/demoCamera.ts), so in production it stays off, as everywhere else.
const PATIENT_HEADERS = DEV ? [{ key: 'Permissions-Policy', value: DOCTOR_PERMISSIONS }, NOINDEX] : [NOINDEX];

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
  // The demo hides Next's dev badge; it is set by scripts/demo.mjs.
  devIndicators: process.env.NEXT_PUBLIC_DEMO === '1' ? false : undefined,
  env: {
    NEXT_PUBLIC_BUILD_SHA: process.env.NEXT_PUBLIC_BUILD_SHA || gitSha(),
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
    // Defined in every build, as '' when unset: Next inlines a NEXT_PUBLIC_
    // variable only when it has a value, so without this the real site's
    // demo gates (components/call/useEncryptedCall.ts) stay runtime checks and
    // its bundle keeps the demo camera and its worker. Defined, they fold to
    // false and go. The demo deployment's build sets it to '1'.
    NEXT_PUBLIC_DEMO: process.env.NEXT_PUBLIC_DEMO ?? '',
  },
  // Loaded with require() at runtime rather than bundled: PGlite ships WASM and
  // data files it finds beside itself, and postgres.js is plain Node.
  serverExternalPackages: ['@electric-sql/pglite', 'postgres'],
  async headers() {
    return [
      // A demo build is noindex everywhere, static files included, which the
      // proxy (which sets it on everything else) never sees.
      { source: '/(.*)', headers: DEMO_BUILD ? [...SECURITY_HEADERS, NOINDEX] : SECURITY_HEADERS },
      { source: CSP_SOURCE, headers: [{ key: 'Content-Security-Policy', value: DEV ? DEV_CSP : PROD_CSP }] },
      {
        source: '/assets/(.*)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      { source: '/patient/:path*', headers: PATIENT_HEADERS },
      { source: '/doctor/:path*', headers: DOCTOR_HEADERS },
      { source: '/admin/:path*', headers: ADMIN_HEADERS },
      { source: '/dev/:path*', headers: [NOINDEX] },
      // The legal pages are drafts until the legal entity exists (PRODUCT.md);
      // a draft must never be indexed as if it were in force.
      { source: '/privacy', headers: [NOINDEX] },
      { source: '/terms', headers: [NOINDEX] },
      // Where Stripe returns a GP after the sign-up fee: one person's receipt.
      { source: '/gp/:path*', headers: [NOINDEX] },
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
