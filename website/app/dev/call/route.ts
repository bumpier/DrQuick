// POST /dev/call — development only: the patient's pass to the live
// consultation's encrypted call (lib/video/calls.ts devPatientPass), for the
// patient prototype's call screen (components/patient/VideoFrame.tsx).
//
// There is no patient sign-in yet, so this hands a call's keys to anyone who
// asks. It must never be reachable where a patient could be: a 404 in a
// production build, refused unless the request names this machine (the dev
// server also listens on the network), refused from another site, and refused
// against a database that is not local. Every refusal is a fixed code.
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { assertLocal } from '@/lib/dev/seed-doctor';
import { devPatientPass, type PassRefusal } from '@/lib/video/calls';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);
const STATUS: Record<PassRefusal, number> = { video_off: 501, no_consultation: 409, closed: 409, unavailable: 503 };

const reply = (body: unknown, status: number) => NextResponse.json(body, { status, headers: NO_STORE });

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
  if (!LOOPBACK.has(hostname(request)) || (site && site !== 'same-origin')) return reply({ error: 'not_local' }, 403);
  try {
    assertLocal();
  } catch {
    return reply({ error: 'not_local' }, 403);
  }
  const db = await getDb();
  if (!db) return reply({ error: 'store_unavailable' }, 503);
  try {
    const result = await devPatientPass(db);
    return result.ok ? reply(result.pass, 200) : reply({ error: result.reason }, STATUS[result.reason]);
  } catch {
    return reply({ error: 'unavailable' }, 503);
  }
}
