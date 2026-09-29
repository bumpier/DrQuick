'use client';
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { bulkUnsubscribeAction } from '@/app/admin/(panel)/waitlist/actions';
import { fmtDate, sourceLabel } from '@/lib/admin/format';
import { ConfirmAction } from './ConfirmAction';
import { StatusBadge } from './StatusBadge';

export type PatientRow = { id: string; email: string; source: string; channel: string; createdAt: Date; status: string };

// The patient list with row selection, for the one bulk action: unsubscribe.
// The sortable headers arrive rendered from the server (they are links).
export function PatientsTable({ rows, headers }: { rows: PatientRow[]; headers: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectable = rows.filter((r) => r.status === 'subscribed').map((r) => r.id);
  const all = selectable.length > 0 && selectable.every((id) => selected.has(id));
  const toggle = (id: string, on: boolean) => setSelected((s) => {
    const next = new Set(s);
    if (on) next.add(id); else next.delete(id);
    return next;
  });
  const count = selected.size;

  return (
    <>
      <div className="mb-2 flex min-h-12 flex-wrap items-center gap-3">
        <ConfirmAction
          disabled={count === 0}
          trigger={<Button variant="secondary" size="sm" disabled={count === 0}>Unsubscribe selected{count > 0 ? ` (${count})` : ''}</Button>}
          title={`Unsubscribe ${count} ${count === 1 ? 'patient' : 'patients'}?`}
          description="They stay on the list, marked unsubscribed, and will not be emailed. You can resubscribe someone from their page."
          confirmLabel="Unsubscribe"
          run={() => bulkUnsubscribeAction([...selected])}
          onDone={() => setSelected(new Set())}
        />
        {count === 0 && <span className="text-fine text-ink-2">Tick patients to unsubscribe them together.</span>}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                aria-label="Select every subscribed patient on this page"
                checked={all}
                disabled={selectable.length === 0}
                onCheckedChange={(v) => setSelected(v === true ? new Set(selectable) : new Set())}
              />
            </TableHead>
            {headers}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} data-state={selected.has(r.id) ? 'selected' : undefined}>
              <TableCell>
                <Checkbox
                  aria-label={`Select ${r.email}`}
                  checked={selected.has(r.id)}
                  disabled={r.status !== 'subscribed'}
                  onCheckedChange={(v) => toggle(r.id, v === true)}
                />
              </TableCell>
              <TableCell className="max-w-[18rem] whitespace-normal">
                <Link href={`/admin/waitlist/patients/${r.id}`} className="font-semibold break-all text-ink underline-offset-4 hover:underline">{r.email}</Link>
              </TableCell>
              <TableCell className="text-ink-2 max-cols:hidden">{sourceLabel(r.source)}</TableCell>
              <TableCell className="text-ink-2 max-cols:hidden">{r.channel}</TableCell>
              <TableCell className="text-ink-2 max-phone:hidden">{fmtDate(r.createdAt)}</TableCell>
              <TableCell><StatusBadge role="patient" status={r.status} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
