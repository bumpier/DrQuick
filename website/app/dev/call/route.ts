// POST /dev/call — the patient's pass to the live consultation's encrypted call
// (lib/video/calls.ts devPatientPass), for the patient prototype's call screen
// (components/patient/VideoFrame.tsx): on a developer's machine, and in the
// demo deployment at demo.drquick.co.uk (lib/demo.ts).
//
// There is no patient sign-in yet, so this hands a call's keys to anyone the
// guard lets through. It must never be reachable where a patient could be: a
// 404 in every production build but the demo deployment's. On a developer's
// machine, refused unless the request names this machine (the dev server also
// listens on the network); in the demo deployment, refused without the
// passcode session; in both, refused from another site and against a database
// the demo may not write to (lib/demo/guard.ts demoCaller). Every refusal is a
// fixed code.
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { demoDeployment } from '@/lib/demo';
import { demoCaller } from '@/lib/demo/guard';
import { devPatientPass, type PassRefusal } from '@/lib/video/calls';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };
const STATUS: Record<PassRefusal, number> = { video_off: 501, no_consultation: 409, closed: 409, unavailable: 503 };

const reply = (body: unknown, status: number) => NextResponse.json(body, { status, headers: NO_STORE });

export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production' && !demoDeployment()) return new Response('Not found', { status: 404 });
  const refused = demoCaller(request);
  if (refused) return refused;
  const db = await getDb();
  if (!db) return reply({ error: 'store_unavailable' }, 503);
  try {
    const result = await devPatientPass(db);
    return result.ok ? reply(result.pass, 200) : reply({ error: result.reason }, STATUS[result.reason]);
  } catch {
    return reply({ error: 'unavailable' }, 503);
  }
}
