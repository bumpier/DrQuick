import Link from 'next/link';
import { ConsultationBadge, PaymentBadge, PayoutBadge, periodLabel } from '@/components/admin/FinanceBadges';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtCount, fmtDate, fmtDateTime } from '@/lib/admin/format';
import { feeFor } from '@/lib/doctor/queries/earnings';
import type { ConsultationRow, PayoutRow } from '@/lib/finance/model';
import { gbp } from '@/lib/money';

// A doctor's consultations with their money: what the patient paid, and the
// doctor's share of it. The platform's share is the difference and is not a
// column of its own.
export function MyConsultationsTable({ rows }: { rows: ConsultationRow[] }) {
  return (
    <Table stack="cols">
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Patient paid</TableHead>
          <TableHead className="text-right">Your fee</TableHead>
          <TableHead>Payment</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const fee = feeFor(r);
          return (
            <TableRow key={r.id}>
              <TableCell data-label="Date" className="tabular-nums">{fmtDateTime(r.requestedAt)}</TableCell>
              <TableCell data-label="Status"><ConsultationBadge status={r.status} /></TableCell>
              <TableCell data-label="Patient paid" className="text-right tabular-nums">{gbp(r.pricePence)}</TableCell>
              <TableCell data-label="Your fee" className="text-right font-semibold tabular-nums">
                {fee === null ? <span className="font-normal text-ink-2">Not paid</span> : gbp(fee)}
              </TableCell>
              <TableCell data-label="Payment"><PaymentBadge state={r.payment} /></TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function MyPayoutsTable({ rows }: { rows: PayoutRow[] }) {
  return (
    <Table stack="cols">
      <TableHeader>
        <TableRow>
          <TableHead>Period</TableHead>
          <TableHead className="text-right">Consultations</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Paid</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((p) => (
          <TableRow key={p.id}>
            <th scope="row" className="px-3 py-2 text-left font-semibold">
              <Link href={`/doctor/earnings/payouts/${p.id}`} className="text-primary-ink">{periodLabel(p)}</Link>
            </th>
            <TableCell data-label="Consultations" className="text-right tabular-nums">{fmtCount(p.consultations)}</TableCell>
            <TableCell data-label="Amount" className="text-right font-semibold tabular-nums">{gbp(p.amountPence)}</TableCell>
            <TableCell data-label="Status"><PayoutBadge status={p.status} /></TableCell>
            <TableCell data-label="Paid" className="tabular-nums">{p.paidAt ? fmtDate(p.paidAt) : <span className="text-ink-2">—</span>}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
