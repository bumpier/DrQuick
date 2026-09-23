import {
  Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/app/StatusBadge';
import { CREDENTIAL_KEYS, CREDENTIAL_LABELS } from '@/lib/alerts';
import { daysLabel } from '@/lib/format';
import { DASH } from '@/lib/placeholder';
import { cn } from '@/lib/utils';
import type { CredentialKey, CredentialRecord, CredentialStatus } from '@/lib/fixtures';

/* The credential record as a table, ordered by how soon each row stops the GP
   working. Severity is fill, border and position, never a hue: an expired
   credential is band-filled and leads, an expiring one carries a 2px ink
   border and follows soonest-first, a valid one is plain. One component for
   the profile, the onboarding credentials step (`keys`) and supply's per-GP
   view, so the three can never disagree about what is urgent. */

type Props = {
  record: CredentialRecord;
  seeded: boolean;
  caption: string;
  keys?: readonly CredentialKey[];
  stack?: 'phone';
};

// Position is the first channel: the lower the rank, the higher the row.
const RANK: Record<CredentialStatus, number> = { expired: 0, rejected: 1, pending: 2, expiring: 3, valid: 4 };

const daysOf = (days: number | null) => (days === null ? Infinity : days);

function order(record: CredentialRecord, keys: readonly CredentialKey[]): CredentialKey[] {
  return keys
    .map((key, index) => ({ key, index, status: record[key].status, days: daysOf(record[key].daysRemaining) }))
    .sort((a, b) =>
      RANK[a.status] - RANK[b.status]
      || (a.status === 'expiring' ? a.days - b.days : 0)
      || a.index - b.index)
    .map((row) => row.key);
}

// A pending or rejected check has no expiry *yet*: its cell is the dash
// (admin.html:229), not "No expiry", which would claim the check never expires.
function expiry(status: CredentialStatus, days: number | null): string {
  if (days !== null) return daysLabel(days);
  return status === 'pending' || status === 'rejected' ? DASH : 'No expiry';
}

export function CredentialMatrix({ record, seeded, caption, keys = CREDENTIAL_KEYS, stack }: Props) {
  // `seeded` is this table's shown(): the record is the only figure here, and
  // blank mode has no record, so nothing is sorted and every row reads
  // "Not submitted" (doctor.js:262-267).
  const rows = seeded ? order(record, keys) : [...keys];

  return (
    <Table stack={stack}>
      <TableCaption className="sr-only">{caption}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Credential</TableHead>
          <TableHead scope="col">Status</TableHead>
          <TableHead scope="col">Days remaining</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((key) => {
          const { status, daysRemaining } = record[key];
          const shown = seeded ? status : null;
          const band = shown === 'expired';
          const bordered = shown === 'expiring';
          return (
            <TableRow
              key={key}
              data-credential={key}
              className={cn(
                // hover:bg-band: TableRow's surface-mid hover would turn the fill light.
                // The stacked label (::before) is ink-2, invisible on the band, so it goes band-ink-2.
                band && 'bg-band font-semibold text-white hover:bg-band [&>td]:before:text-band-ink-2!',
                // `!`: TableBody strips the last row's border with [&_tr:last-child]:border-0.
                bordered && 'border-2! border-ink',
              )}
            >
              {/* The label is read, not scanned: body face and size, not the column header's label-caps. */}
              <TableHead
                scope="row"
                className={cn('font-sans text-body font-semibold normal-case tracking-normal whitespace-normal', band ? 'text-white' : 'text-ink')}
              >
                {CREDENTIAL_LABELS[key]}
              </TableHead>
              <TableCell label="Status">
                <StatusBadge status={shown} onBand={band} />
              </TableCell>
              <TableCell label="Days remaining" className={cn('text-fine tabular-nums', band ? 'text-band-ink-2' : 'text-ink-2')}>
                {seeded ? expiry(status, daysRemaining) : 'Not submitted'}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
