// The guard every /dev/demo* route starts with. Null means go ahead; otherwise
// the refusal to return. The order is fixed: a 404 unless the demo is running,
// then the caller check (demoCaller), which app/dev/call shares.
//
// On a developer's machine the caller must name this machine and come from
// this site. In the demo deployment at demo.drquick.co.uk any Host will do,
// but only with the passcode session (lib/demo/session.ts), from this site:
// the proxy has already checked the session, and this checks it again. Then,
// in both, a database the demo may write to (assertLocal: in the deployment,
// one on this machine whose name contains "demo").
import { demoDeployment, demoMode } from '@/lib/demo';
import { hasDemoSession } from '@/lib/demo/session';
import { assertLocal } from '@/lib/dev/seed-doctor';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);
const NO_STORE = { 'Cache-Control': 'no-store' };

function hostname(request: Request): string {
  try {
    return new URL(`http://${request.headers.get('host') ?? new URL(request.url).host}`).hostname;
  } catch {
    return '';
  }
}

const refuse = (error: 'not_local' | 'demo_locked') => Response.json({ error }, { status: 403, headers: NO_STORE });

/** The caller check without the demo switch, for every demo route and for app/dev/call. */
export function demoCaller(request: Request): Response | null {
  const site = request.headers.get('sec-fetch-site');
  const otherSite = Boolean(site) && site !== 'same-origin';
  if (demoDeployment()) {
    if (otherSite || !hasDemoSession(request)) return refuse('demo_locked');
  } else if (otherSite || !LOOPBACK.has(hostname(request))) {
    return refuse('not_local');
  }
  try {
    assertLocal();
  } catch {
    return refuse('not_local');
  }
  return null;
}

export function demoGuard(request: Request): Response | null {
  if (!demoMode()) return new Response('Not found', { status: 404, headers: NO_STORE });
  return demoCaller(request);
}
