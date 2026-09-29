import type { ReactNode } from 'react';
import { ConsultationBadge, PaymentBadge } from '@/components/admin/FinanceBadges';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtDateTime } from '@/lib/admin/format';
import type { ConsultationRow } from '@/lib/finance/model';
import { gbp } from '@/lib/money';

// Consultations with their money: the list page (sortable headers passed in
// from the server) and a payout's detail (plain headers).
export function ConsultationTable({ rows, headers }: { rows: ConsultationRow[]; headers?: ReactNode }) {
  return (
    <Table stack="cols">
      <TableHeader>
        <TableRow>
          {headers ?? <>
            <TableHead>Requested</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>GP</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">GP fee</TableHead>
            <TableHead className="text-right">Platform fee</TableHead>
          </>}
          <TableHead>Payment</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell data-label="Requested" className="tabular-nums">{fmtDateTime(r.requestedAt)}</TableCell>
            <TableCell data-label="Status"><ConsultationBadge status={r.status} /></TableCell>
            <TableCell data-label="GP" className="whitespace-normal">{r.gpName ?? <span className="text-ink-2">Not matched</span>}</TableCell>
            <TableCell data-label="Price" className="text-right tabular-nums">{gbp(r.pricePence)}</TableCell>
            <TableCell data-label="GP fee" className="text-right tabular-nums">{gbp(r.gpFeePence)}</TableCell>
            <TableCell data-label="Platform fee" className="text-right tabular-nums">{gbp(r.platformFeePence)}</TableCell>
            <TableCell data-label="Payment">
              <PaymentBadge state={r.payment} />
              {r.refundedPence > 0 && <span className="ml-2 text-fine text-ink-2 tabular-nums">{gbp(r.refundedPence)} back</span>}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
