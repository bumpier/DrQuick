import { NextResponse, type NextRequest } from 'next/server';
import { TRUSTED_TYPES_REPORT_ONLY, doctorCsp, livekitOrigin, newNonce, prerenderedCallCsp } from '@/lib/csp';
import { demoDeployment } from '@/lib/demo';
import { DEMO_ACCESS_PATH, demoConfigured, hasDemoSession, safeNext } from '@/lib/demo/session';

// Next 16's proxy (formerly middleware). Two jobs.
//
// In the demo deployment at demo.drquick.co.uk (lib/demo.ts), a passcode gate
// in front of every page and route, first: that copy hands out live video-call
// keys with no sign-in of its own (app/dev/call). It fails closed: a demo
// build that is not fully set up as one answers 503 to everything. The real
// site never builds with NEXT_PUBLIC_DEMO, so it never reaches the gate.
//
// Then, everywhere, the signed-in areas and the call pages' CSP. An optimistic
// check only: with no session cookie at all, a page in a signed-in area
// redirects to that area's sign-in before rendering. It cannot tell a forged
// cookie from a real one — requireAdmin() in lib/admin-auth.ts and
// requireDoctor() in lib/doctor-auth.ts do that, in every page and every
// server action.
type Area = { root: string; cookie: string; signIn: string; open: readonly string[] };

const AREAS: readonly Area[] = [
  { root: '/admin', cookie: 'dq_admin', signIn: '/admin/login', open: ['/admin/login', '/admin/set-password'] },
  {
    root: '/doctor', cookie: 'dq_doctor', signIn: '/doctor/login',
    // The three pages a doctor needs before they have a session, and the
    // portal's poll and call pass: a redirected fetch would hand either the
    // sign-in page with a 200, so app/doctor/pulse and app/doctor/call answer
    // 401 themselves.
    open: ['/doctor/login', '/doctor/register', '/doctor/set-password', '/doctor/pulse', '/doctor/call'],
  },
];

const within = (path: string, root: string) => path === root || path.startsWith(`${root}/`);
const NO_STORE = 'no-store';
const NOINDEX = 'noindex, nofollow';

// The per-request CSP (lib/csp.ts) of the pages where a video call's keys live,
// or null to leave a page to next.config.ts's static one. Without regard to
// case, as next.config.ts leaves them out of its own.
// - The doctor portal, always, with a fresh nonce.
// - The patient prototype in development, the same way.
// - The patient prototype in the demo deployment: its pages are prerendered,
//   so no nonce can reach their scripts, and it gets the policy built for that.
// LIVEKIT_URL is parsed only for those pages, not on every request.
function callPolicy(path: string): string | null {
  const lower = path.toLowerCase();
  const dev = process.env.NODE_ENV === 'development';
  if (within(lower, '/doctor') || (dev && within(lower, '/patient'))) {
    return doctorCsp({ nonce: newNonce(), livekitOrigin: livekitOrigin(process.env.LIVEKIT_URL), dev });
  }
  if (demoDeployment() && within(lower, '/patient')) return prerenderedCallCsp({ livekitOrigin: livekitOrigin(process.env.LIVEKIT_URL) });
  return null;
}

function site(request: NextRequest): NextResponse {
  const path = request.nextUrl.pathname;
  const area = AREAS.find((a) => within(path, a.root));
  if (area && !area.open.includes(path) && !request.cookies.has(area.cookie)) {
    return NextResponse.redirect(new URL(area.signIn, request.url));
  }
  const csp = callPolicy(path);
  if (!csp) return NextResponse.next();

  // Next reads the policy from the request to nonce its own scripts.
  const headers = new Headers(request.headers);
  headers.set('content-security-policy', csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Content-Security-Policy-Report-Only', TRUSTED_TYPES_REPORT_ONLY);
  return response;
}

// A production build made with NEXT_PUBLIC_DEMO=1: the demo deployment's
// build, which serves nothing unless it runs as the demo deployment.
const demoBuild = () => process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_DEMO === '1';

// A browser opening a page, as opposed to a fetch, a route, a server action or
// the API: only a page is sent to the passcode page; everything else is told
// it is locked, so no fetch is ever handed the passcode page with a 200.
function pageVisit(request: NextRequest, path: string): boolean {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  if (within(path, '/api')) return false;
  return request.headers.get('sec-fetch-mode') === 'navigate' || (request.headers.get('accept') ?? '').includes('text/html');
}

// A redirect on this site, never cached. `target` is a path with its query.
function redirectTo(request: NextRequest, target: string): NextResponse {
  const response = NextResponse.redirect(new URL(target, request.nextUrl.origin));
  response.headers.set('Cache-Control', NO_STORE);
  return response;
}

// The gate: null lets the request on to site(). DEMO_ACCESS_PATH is the one
// way in without the session: the passcode page and its server action.
function demoGate(request: NextRequest): NextResponse | null {
  if (!demoDeployment() || !demoConfigured()) {
    return new NextResponse('Demo not configured', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': NO_STORE },
    });
  }
  const path = request.nextUrl.pathname;
  const search = request.nextUrl.search;
  const session = hasDemoSession(request);
  if (path === DEMO_ACCESS_PATH) {
    // Already in: on to where they were going, rather than the form again.
    // The form's own POST (its server action) still goes through.
    return session && pageVisit(request, path) ? redirectTo(request, safeNext(request.nextUrl.searchParams.get('next'))) : null;
  }
  if (session) return null;
  if (pageVisit(request, path)) {
    // The bare address names nowhere: after the passcode, the presenter page.
    const next = path === '/' && !search ? '' : `?next=${encodeURIComponent(`${path}${search}`)}`;
    return redirectTo(request, `${DEMO_ACCESS_PATH}${next}`);
  }
  return NextResponse.json({ error: 'demo_locked' }, { status: 401, headers: { 'Cache-Control': NO_STORE } });
}

export function proxy(request: NextRequest) {
  if (!demoBuild()) return site(request);
  const response = demoGate(request) ?? site(request);
  response.headers.set('X-Robots-Tag', NOINDEX);
  return response;
}

// Every path but the build's static files and the public assets, which the
// passcode page needs to load and which carry nothing to guard: the demo
// deployment's gate must stand in front of every page and route. Outside it,
// a path that is neither signed-in area nor a call page passes straight
// through. Next matches this list case-sensitively, so only these exact
// spellings are left out; it reads the list at build time, so it is spelled
// out rather than computed.
export const config = {
  matcher: ['/((?!_next/static/|_next/image|favicon\\.|assets/).*)'],
};
