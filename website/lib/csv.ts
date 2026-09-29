// The waitlist as CSV, for the token export route and the admin's download.
import type { Signup } from '@/lib/waitlist';

// Quoting escapes the delimiter but does not stop a spreadsheet EVALUATING a cell
// that opens with =, +, - or @. The email pattern permits all of them, so prefix any
// such cell with an apostrophe before quoting.
export const csvCell = (value: unknown): string => {
  let cell = String(value == null ? '' : value);
  if (/^[=+\-@\t\r]/.test(cell)) cell = `'${cell}`;
  return `"${cell.replace(/"/g, '""')}"`;
};

// One CSV covers both roles: a GP row fills the sign-up columns, a patient row
// leaves them blank rather than the export splitting into two files.
export const CSV_HEADER = 'email,role,name,mobile,gmc,source,status,utm_source,joined_at';

export function waitlistCsv(rows: Signup[]): string {
  return [
    CSV_HEADER,
    ...rows.map((r) =>
      [r.email, r.role, r.name, r.mobile, r.gmc, r.source, r.status, r.utmSource, r.createdAt.toISOString()]
        .map(csvCell).join(',')),
  ].join('\n');
}
