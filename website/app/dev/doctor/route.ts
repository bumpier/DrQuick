// POST /dev/doctor?do=seed | request — development only. Fills the local
// database with the doctor portal's demo data, or adds one waiting patient, so
// the portal can be tried without a patient flow or a payment provider.
// `npm run db:seed:doctor` and `npm run doctor:request` call it.
//
// A route rather than a script because local development runs on PGlite, which
// only this process can open. Like the /dev/ui gallery it never ships: a
// production build answers 404, lib/dev/seed-doctor.ts refuses in production
// and against a remote database on its own account, and /dev/* is noindex.
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { addWaitingRequest, seedDoctorDemo } from '@/lib/dev/seed-doctor';

export const dynamic = 'force-dynamic';

// The dev server also listens on the network: refuse a request that does not
// name this machine or comes from another site, as app/dev/call/route.ts does.
// Node's fetch (scripts/dev-doctor.mjs) sends a localhost Host and no sec-fetch-site.
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

function hostname(request: Request): string {
  try {
    return new URL(`http://${request.headers.get('host') ?? new URL(request.url).host}`).hostname;
  } catch {
    return '';
  }
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') return new Response('Not found', { status: 404 });
  const site = request.headers.get('sec-fetch-site');
  if (!LOOPBACK.has(hostname(request)) || (site && site !== 'same-origin')) {
    return NextResponse.json({ error: 'not_local' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }
  const db = await getDb();
  if (!db) return NextResponse.json({ error: 'store_unavailable' }, { status: 503 });

  const action = new URL(request.url).searchParams.get('do');
  try {
    if (action === 'seed') return NextResponse.json(await seedDoctorDemo(db));
    if (action === 'request') return NextResponse.json(await addWaitingRequest(db));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
  return NextResponse.json({ error: 'Use ?do=seed or ?do=request.' }, { status: 400 });
}
