// GET /api/waitlist-export  ->  CSV of everyone on the list.
// Protected by a bearer token so the list is not public. Without
// WAITLIST_EXPORT_TOKEN set, the route refuses to serve anything at all.
import { timingSafeEqual } from 'node:crypto';
import { configured, pipeline } from '@/lib/waitlist-store';

export const runtime = 'nodejs';

export function authorised(request: Request): boolean {
  const expected = process.env.WAITLIST_EXPORT_TOKEN;
  if (!expected) return false;
  const given = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Quoting escapes the delimiter but does not stop a spreadsheet EVALUATING a cell
// that opens with =, +, - or @. The email pattern permits all of them, so prefix any
// such cell with an apostrophe before quoting.
export const csvCell = (value: unknown): string => {
  let cell = String(value == null ? '' : value);
  if (/^[=+\-@\t\r]/.test(cell)) cell = `'${cell}`;
  return `"${cell.replace(/"/g, '""')}"`;
};

// A patient row carries only email/role/source/joinedAt; a GP row adds the three
// sign-up fields. One CSV covers both, so the GP columns are blank on a patient
// row rather than split across two files.
type Row = {
  email: string; role: string; source: string; joinedAt: string;
  name?: string; mobile?: string; gmc?: string;
};

export async function GET(request: Request) {
  const noStore = { 'Cache-Control': 'no-store' };
  if (!authorised(request)) {
    return Response.json({ ok: false, error: 'unauthorised' }, { status: 401, headers: noStore });
  }
  if (!configured()) {
    return Response.json({ ok: false, error: 'store_unavailable' }, { status: 503, headers: noStore });
  }

  try {
    const [entries] = (await pipeline([['HGETALL', 'waitlist:entries']])) as [string[]];

    // Upstash returns HGETALL as a flat [field, value, field, value, ...] array.
    const rows: Row[] = [];
    for (let i = 0; i < entries.length; i += 2) {
      try {
        rows.push(JSON.parse(entries[i + 1]));
      } catch {
        // Field keys are `role:email`; fall back to splitting on the first colon.
        const field = String(entries[i]);
        const cut = field.indexOf(':');
        rows.push({
          email: cut === -1 ? field : field.slice(cut + 1),
          role: cut === -1 ? '' : field.slice(0, cut),
          source: '',
          joinedAt: '',
        });
      }
    }
    rows.sort((a, b) => String(a.joinedAt).localeCompare(String(b.joinedAt)));

    const csv = [
      'email,role,name,mobile,gmc,source,joined_at',
      ...rows.map((r) =>
        [r.email, r.role, r.name ?? '', r.mobile ?? '', r.gmc ?? '', r.source, r.joinedAt]
          .map(csvCell)
          .join(','),
      ),
    ].join('\n');

    return new Response(csv, {
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
