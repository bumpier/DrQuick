// GET /admin/finance/revenue/export[?demo=1] — the Revenue page's monthly
// table as CSV: the last twelve months, then their total and the year to date.
// Pounds as plain decimals so a spreadsheet reads them as numbers.
import { currentAdmin } from '@/lib/admin-auth';
import { audit } from '@/lib/admin/audit';
import { dbSource, revenueLedger } from '@/lib/admin/queries/finance';
import { csvCell } from '@/lib/csv';
import { getDb } from '@/lib/db';
import { demoSource } from '@/lib/finance/demo';
import type { Figures } from '@/lib/finance/model';
import { poundsDecimal } from '@/lib/money';

export const dynamic = 'force-dynamic';

const REVENUE_CSV_HEADER =
  'month,gross_gbp,refunds_gbp,gp_fees_gbp,net_revenue_gbp,take_rate,consultations_completed,consultations_paid,average_price_gbp';

// Numbers are written bare: they are ours, not user input, and csvCell's
// formula guard would turn a negative net into text.
const line = (label: string, f: Figures) => [
  csvCell(label), poundsDecimal(f.gmv), poundsDecimal(f.refunds), poundsDecimal(f.gpFees), poundsDecimal(f.net),
  f.takeRate === null ? '' : f.takeRate.toFixed(4), f.completed, f.paidConsults, f.avgPrice === null ? '' : poundsDecimal(f.avgPrice),
].join(',');

export async function GET(request: Request) {
  const admin = await currentAdmin();
  if (!admin) return new Response('Sign in first.', { status: 401 });
  const demo = new URL(request.url).searchParams.get('demo') === '1';
  const db = await getDb();
  if (!db && !demo) return new Response('The database is not configured on this server.', { status: 503 });

  const now = new Date();
  const ledger = await revenueLedger(demo ? demoSource(now) : dbSource(db!), now);
  if (db) await audit(db, admin, 'export_revenue_csv', null, { demo });

  const rows = [
    REVENUE_CSV_HEADER,
    ...ledger.rows.map((r) => line(r.toDate ? `${r.key} (to date)` : r.key, r.figures)),
    line('twelve months', ledger.total),
    line(`${ledger.year} to date`, ledger.ytd),
  ];
  const day = now.toISOString().slice(0, 10);
  return new Response(`${rows.join('\n')}\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="drquick-revenue${demo ? '-demo' : ''}-${day}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
