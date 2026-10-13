import { NextResponse, type NextRequest } from 'next/server';
import { TRUSTED_TYPES_REPORT_ONLY, doctorCsp, livekitOrigin, newNonce } from '@/lib/csp';

// Next 16's proxy (formerly middleware). An optimistic check only: with no
// session cookie at all, a page in a signed-in area redirects to that area's
// sign-in before rendering. It cannot tell a forged cookie from a real one —
// requireAdmin() in lib/admin-auth.ts and requireDoctor() in lib/doctor-auth.ts
// do that, in every page and every server action.
type Area = { root: string; cookie: string; signIn: string; open: readonly string[] };

const AREAS: readonly Area[] = [
  { root: '/admin', cookie: 'dq_admin', signIn: '/admin/login', open: ['/admin/login'] },
  {
    root: '/doctor', cookie: 'dq_doctor', signIn: '/doctor/login',
    // The three pages a doctor needs before they have a session, and the
    // portal's poll: a redirected fetch would hand it the sign-in page with a
    // 200, so app/doctor/pulse answers 401 itself.
    open: ['/doctor/login', '/doctor/register', '/doctor/set-password', '/doctor/pulse'],
  },
];

const within = (path: string, root: string) => path === root || path.startsWith(`${root}/`);

// The pages that get the per-request CSP (lib/csp.ts): the doctor portal, and
// in development the patient prototype, because the video call's keys live
// there. Without regard to case, as next.config.ts leaves them out of its own.
function strictCsp(path: string): boolean {
  const lower = path.toLowerCase();
  return within(lower, '/doctor') || (process.env.NODE_ENV === 'development' && within(lower, '/patient'));
}

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const area = AREAS.find((a) => within(path, a.root));
  if (area && !area.open.includes(path) && !request.cookies.has(area.cookie)) {
    return NextResponse.redirect(new URL(area.signIn, request.url));
  }
  if (!strictCsp(path)) return NextResponse.next();

  const csp = doctorCsp({
    nonce: newNonce(), livekitOrigin: livekitOrigin(process.env.LIVEKIT_URL), dev: process.env.NODE_ENV === 'development',
  });
  // Next reads the policy from the request to nonce its own scripts.
  const headers = new Headers(request.headers);
  headers.set('content-security-policy', csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Content-Security-Policy-Report-Only', TRUSTED_TYPES_REPORT_ONLY);
  return response;
}

// /patient only for its development policy; in production the proxy passes it
// through. The portal and the prototype are matched in any case, because
// next.config.ts leaves them out of its static CSP without regard to case: a
// page at /DOCTOR would otherwise have no policy at all. Next reads this list
// at build time, so it is spelled out rather than computed.
export const config = {
  matcher: [
    '/admin', '/admin/:path*',
    '/:root([dD][oO][cC][tT][oO][rR])', '/:root([dD][oO][cC][tT][oO][rR])/:path*',
    '/:root([pP][aA][tT][iI][eE][nN][tT])', '/:root([pP][aA][tT][iI][eE][nN][tT])/:path*',
  ],
};
