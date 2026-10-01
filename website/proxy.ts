import { NextResponse, type NextRequest } from 'next/server';

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

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const area = AREAS.find((a) => path === a.root || path.startsWith(`${a.root}/`));
  if (!area || area.open.includes(path) || request.cookies.has(area.cookie)) return NextResponse.next();
  return NextResponse.redirect(new URL(area.signIn, request.url));
}

export const config = { matcher: ['/admin', '/admin/:path*', '/doctor', '/doctor/:path*'] };
