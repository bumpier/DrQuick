// POST /api/waitlist-delete  { email }
// Executes an erasure request. The page promises "you can ask us to delete it sooner
// at any time"; without this route that promise could only be honoured by hand-editing
// the store. Protected by the same bearer token as the export, because self-serve
// deletion by email alone would let anyone remove anyone else's entry.
import { configured, pipeline } from '@/lib/waitlist-store';
import { authorised } from '@/app/api/waitlist-export/route';

export const runtime = 'nodejs';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ['patient', 'gp'];

const json = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request) {
  if (!authorised(request)) return json(401, { ok: false, error: 'unauthorised' });
  if (!configured()) return json(503, { ok: false, error: 'store_unavailable' });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const email = String(body.email || '').trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) {
    return json(400, { ok: false, error: 'invalid_email' });
  }

  try {
    const results = await pipeline([
      ...ROLES.map((role) => ['SREM', `waitlist:${role}`, email]),
      ['HDEL', 'waitlist:entries', ...ROLES.map((role) => `${role}:${email}`)],
    ]);
    const removed = results.reduce<number>((total, value) => total + Number(value || 0), 0);
    return json(200, { ok: true, removed });
  } catch (err) {
    console.error('Waitlist delete failed:', (err as Error).message);
    return json(502, { ok: false, error: 'store_write_failed' });
  }
}
