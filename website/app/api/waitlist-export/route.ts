// GET /api/waitlist-export  ->  CSV of everyone on the list.
// Protected by a bearer token so the list is not public. Without
// WAITLIST_EXPORT_TOKEN set, the route refuses to serve anything at all.
// The admin has the same download behind its sign-in (/admin/waitlist/export).
import { timingSafeEqual } from 'node:crypto';
import { getDb } from '@/lib/db';
import { allSignups } from '@/lib/waitlist';
import { waitlistCsv } from '@/lib/csv';

export { csvCell } from '@/lib/csv';

export const runtime = 'nodejs';

export function authorised(request: Request): boolean {
  const expected = process.env.WAITLIST_EXPORT_TOKEN;
  if (!expected) return false;
  const given = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const noStore = { 'Cache-Control': 'no-store' };
  if (!authorised(request)) {
    return Response.json({ ok: false, error: 'unauthorised' }, { status: 401, headers: noStore });
  }
  const db = await getDb().catch(() => null);
  if (!db) {
    return Response.json({ ok: false, error: 'store_unavailable' }, { status: 503, headers: noStore });
  }

  try {
    return new Response(waitlistCsv(await allSignups(db)), {
      status: 200,
      headers: {
        ...noStore,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="dr-quick-waitlist.csv"',
      },
    });
  } catch (err) {
    console.error('Waitlist export failed:', (err as Error).message);
    return Response.json({ ok: false, error: 'store_read_failed' }, { status: 502, headers: noStore });
  }
}
