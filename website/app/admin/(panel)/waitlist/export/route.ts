// GET /admin/waitlist/export?role=patient|gp&q=&status=&source=&sort=&dir=
// The admin's CSV download of whatever the list is showing (every page of it).
// Under /admin so the dq_admin cookie (path=/admin) is sent. A route handler
// answers 401 rather than redirecting, so a script gets a clear refusal.
import { currentAdmin } from '@/lib/admin-auth';
import { audit } from '@/lib/admin/audit';
import { exportSignups, parseListQuery } from '@/lib/admin/queries/waitlist';
import { waitlistCsv } from '@/lib/csv';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const admin = await currentAdmin();
  if (!admin) return new Response('Sign in first.', { status: 401 });
  const db = await getDb();
  if (!db) return new Response('The database is not configured on this server.', { status: 503 });

  const params = new URL(request.url).searchParams;
  const role = params.get('role') === 'gp' ? 'gp' : 'patient';
  const query = parseListQuery(role, params);
  const rows = await exportSignups(db, query);
  await audit(db, admin, 'export_csv', role, {
    rows: rows.length, searched: Boolean(query.q), status: query.status, source: query.source,
  });

  const day = new Date().toISOString().slice(0, 10);
  return new Response(waitlistCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="drquick-${role === 'gp' ? 'gps' : 'patients'}-${day}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
