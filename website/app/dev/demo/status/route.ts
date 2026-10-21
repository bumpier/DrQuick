// GET /dev/demo/status — what the presenter's status line polls (app/dev/demo).
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { demoGuard } from '@/lib/demo/guard';
import { demoStatus } from '@/lib/demo/reset';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(request: Request) {
  const refused = demoGuard(request);
  if (refused) return refused;
  const db = await getDb();
  if (!db) return NextResponse.json({ error: 'store_unavailable' }, { status: 503, headers: NO_STORE });
  try {
    return NextResponse.json(await demoStatus(db), { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: NO_STORE });
  }
}
