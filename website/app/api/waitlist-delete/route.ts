// POST /api/waitlist-delete  { email }
// Executes an erasure request. The page promises "you can ask us to delete it sooner
// at any time"; without this route that promise could only be honoured by hand-editing
// the store. Protected by the same bearer token as the export, because self-serve
// deletion by email alone would let anyone remove anyone else's entry.
import { getDb } from '@/lib/db';
import { ErasureBlocked, erasePerson } from '@/lib/waitlist';
import { authorised } from '@/app/api/waitlist-export/route';

export const runtime = 'nodejs';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request) {
  if (!authorised(request)) return json(401, { ok: false, error: 'unauthorised' });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const email = String(body.email || '').trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) {
    return json(400, { ok: false, error: 'invalid_email' });
  }

  const db = await getDb().catch(() => null);
  if (!db) return json(503, { ok: false, error: 'store_unavailable' });

  try {
    // Every sign-up for the address, and the analytics linked to it.
    return json(200, { ok: true, removed: await erasePerson(db, email) });
  } catch (err) {
    // A doctor mid-consultation: nothing was deleted; ask again once it has ended.
    if (err instanceof ErasureBlocked) return json(409, { ok: false, error: 'in_consultation' });
    console.error('Waitlist delete failed:', (err as Error).message);
    return json(502, { ok: false, error: 'store_write_failed' });
  }
}
