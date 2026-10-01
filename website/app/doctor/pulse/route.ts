// POST /doctor/pulse — the portal's poll, every few seconds while a doctor is
// online. It is the heartbeat (a closed tab drops the doctor out of rotation),
// it brings the offers up to date, and it answers with what the screen shows.
//
// A route handler, not a server action: Next runs a client's actions one at a
// time, so a slow poll would queue in front of the doctor's Accept click.
// Under /doctor so the dq_doctor cookie (path=/doctor) is sent. It answers 401
// rather than redirecting, because a redirected fetch would return the sign-in
// page with a 200. It never sets a cookie: that would re-render the page.
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { currentDoctor } from '@/lib/doctor-auth';
import { pulse } from '@/lib/doctor/shift';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
  // A route handler gets no origin check from Next. The cookie is
  // SameSite=Strict, which already keeps other sites out; this is the belt.
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: NO_STORE });

  const doctor = await currentDoctor();
  if (!doctor) return NextResponse.json({ error: 'signed_out' }, { status: 401, headers: NO_STORE });
  const db = await getDb();
  if (!db) return NextResponse.json({ error: 'store_unavailable' }, { status: 503, headers: NO_STORE });

  const state = await pulse(db, doctor.id);
  // The build id lets a long-open tab notice a deploy and reload when idle.
  return NextResponse.json({ state, build: process.env.NEXT_PUBLIC_BUILD_SHA ?? '' }, { headers: NO_STORE });
}
