// POST /doctor/call — the signed-in GP's pass to the encrypted video call of the
// consultation they hold (lib/video/calls.ts gpPass): the media server's URL, a
// two-minute pass, their identity and the patient's, their own key to encrypt
// with and the patient's to decrypt. Nothing about which consultation comes
// from the request: a doctor holds at most one, and acts for themselves.
//
// Like /doctor/pulse: a route handler, so it never queues behind the doctor's
// clicks; under /doctor, so the session cookie is sent; 401 rather than a
// redirect; never cached; and every refusal a fixed code, never a message.
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { currentDoctor } from '@/lib/doctor-auth';
import { hashKey, hit } from '@/lib/rate-limit';
import { gpPass, type PassRefusal } from '@/lib/video/calls';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };
// One pass per join, and a few more for reconnecting.
const RATE_MAX = 6;
const RATE_WINDOW_S = 300;
const STATUS: Record<PassRefusal, number> = { video_off: 501, no_consultation: 409, closed: 409, unavailable: 503 };

const reply = (body: unknown, status: number) => NextResponse.json(body, { status, headers: NO_STORE });

export async function POST(request: Request) {
  // A route handler gets no origin check from Next; the cookie is SameSite=Strict as well.
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') return reply({ error: 'forbidden' }, 403);

  const doctor = await currentDoctor();
  if (!doctor) return reply({ error: 'signed_out' }, 401);
  const db = await getDb();
  if (!db) return reply({ error: 'store_unavailable' }, 503);
  if ((await hit(db, hashKey('rl:call-pass', doctor.id), RATE_WINDOW_S)) > RATE_MAX) return reply({ error: 'rate_limited' }, 429);

  try {
    const result = await gpPass(db, doctor.id);
    return result.ok ? reply(result.pass, 200) : reply({ error: result.reason }, STATUS[result.reason]);
  } catch {
    return reply({ error: 'unavailable' }, 503);
  }
}
