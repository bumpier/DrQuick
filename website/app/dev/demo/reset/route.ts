// POST /dev/demo/reset — the presenter's Reset (app/dev/demo). Guarded by
// lib/demo/guard.ts: a 404 unless the demo is running; local requests only, or
// in the demo deployment the passcode session.
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { demoGuard } from '@/lib/demo/guard';
import { resetDemo } from '@/lib/demo/reset';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
  const refused = demoGuard(request);
  if (refused) return refused;
  const db = await getDb();
  if (!db) return NextResponse.json({ error: 'store_unavailable' }, { status: 503, headers: NO_STORE });
  try {
    await resetDemo(db);
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: NO_STORE });
  }
}
