import { NextResponse, type NextRequest } from 'next/server';

// Next 16's proxy (formerly middleware). An optimistic check only: with no
// session cookie at all, an admin page redirects to sign-in before rendering.
// It cannot tell a forged cookie from a real one — requireAdmin() in
// lib/admin-auth.ts does that, in every admin page and every server action.
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === '/admin/login') return NextResponse.next();
  if (request.cookies.has('dq_admin')) return NextResponse.next();
  return NextResponse.redirect(new URL('/admin/login', request.url));
}

export const config = { matcher: ['/admin', '/admin/:path*'] };
