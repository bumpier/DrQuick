// POST /dev/demo/sign-out — "Sign out of the demo" on the presenter's page (a
// button whose click POSTs here with fetch, app/dev/demo/DemoControls.tsx).
// Clears the dq_demo passcode session (lib/demo/session.ts) and sends the
// presenter to the passcode page. A 404 unless the demo is running.
// POST only, and only from this site (sec-fetch-site absent or same-origin, the
// rule the demo routes use), so a link on another site cannot sign the
// presenter out. It needs no session check: all it does is forget one. The
// redirect is relative because behind Caddy the request's own host is the local one.
import { NextResponse } from 'next/server';
import { demoMode } from '@/lib/demo';
import { DEMO_ACCESS_PATH, DEMO_COOKIE, demoCookieOptions } from '@/lib/demo/session';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
  if (!demoMode()) return new Response('Not found', { status: 404, headers: NO_STORE });
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') return Response.json({ error: 'cross_site' }, { status: 403, headers: NO_STORE });
  const res = new NextResponse(null, { status: 303, headers: { ...NO_STORE, Location: DEMO_ACCESS_PATH } });
  res.cookies.set(DEMO_COOKIE, '', { ...demoCookieOptions(), maxAge: 0 });
  return res;
}
