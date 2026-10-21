// /dev/demo/booking — the investor demo's patient request (lib/demo/booking.ts),
// called by the patient app (components/patient/useDemoBooking.ts).
//   POST { complaint, pricePence, recordConsent }  → { consultationId }
//   GET ?id=                                       → { status }, and runs the dispatcher
//   DELETE ?id=                                    → 204, the request withdrawn
// Every handler starts with lib/demo/guard.ts: a 404 unless the demo is
// running; local requests only, or in the demo deployment the passcode session.
import { NextResponse } from 'next/server';
import { COMPLAINTS } from '@/lib/booking';
import { getDb } from '@/lib/db';
import {
  cancelDemoRequest, createDemoRequest, demoRequestStatus, isRequestId, type DemoRequestInput,
} from '@/lib/demo/booking';
import { demoGuard } from '@/lib/demo/guard';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };
// Far above any quote the prototype makes (lib/pricing.ts), so only nonsense is refused.
const MAX_PRICE_PENCE = 100_000;

const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

function parse(body: unknown): DemoRequestInput | null {
  if (!body || typeof body !== 'object') return null;
  const { complaint, pricePence, recordConsent } = body as Record<string, unknown>;
  if (typeof complaint !== 'string' || !Object.hasOwn(COMPLAINTS, complaint)) return null;
  if (typeof pricePence !== 'number' || !Number.isInteger(pricePence) || pricePence <= 0 || pricePence > MAX_PRICE_PENCE) return null;
  if (typeof recordConsent !== 'boolean') return null;
  return { complaint: complaint as DemoRequestInput['complaint'], pricePence, recordConsent };
}

const idOf = (request: Request) => {
  const id = new URL(request.url).searchParams.get('id');
  return isRequestId(id) ? id : null;
};

export async function POST(request: Request) {
  const refused = demoGuard(request);
  if (refused) return refused;
  const input = parse(await request.json().catch(() => null));
  if (!input) return reply({ error: 'invalid_body' }, 400);
  const db = await getDb();
  if (!db) return reply({ error: 'store_unavailable' }, 503);
  try {
    return reply(await createDemoRequest(db, input));
  } catch {
    return reply({ error: 'unavailable' }, 503);
  }
}

export async function GET(request: Request) {
  const refused = demoGuard(request);
  if (refused) return refused;
  const id = idOf(request);
  if (!id) return reply({ error: 'invalid_id' }, 400);
  const db = await getDb();
  if (!db) return reply({ error: 'store_unavailable' }, 503);
  try {
    return reply({ status: await demoRequestStatus(db, id) });
  } catch {
    return reply({ error: 'unavailable' }, 503);
  }
}

export async function DELETE(request: Request) {
  const refused = demoGuard(request);
  if (refused) return refused;
  const id = idOf(request);
  if (!id) return reply({ error: 'invalid_id' }, 400);
  const db = await getDb();
  if (!db) return reply({ error: 'store_unavailable' }, 503);
  try {
    await cancelDemoRequest(db, id);
    return new Response(null, { status: 204, headers: NO_STORE });
  } catch {
    return reply({ error: 'unavailable' }, 503);
  }
}
