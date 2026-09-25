import Link from 'next/link';
import { ChevronRightIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { money } from '@/lib/format';
import type { ConsultationRow } from '@/lib/patient';

const minutes = (n: number) => `${n} minute${n === 1 ? '' : 's'}`;

// One consultation wherever consultations are listed: what it was for, when
// and with whom, and what it cost. Reasons are the patient's own words from
// the booking, never a diagnosis and never a medicine.
export function ConsultRow({ consultation: c }: { consultation: ConsultationRow }) {
  const cancelled = c.status === 'cancelled';
  return (
    <Link
      href={`/patient/consultations/${c.id}`}
      data-slot="consult-row"
      className="group flex items-center gap-4 py-3 no-underline"
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 font-semibold transition-colors duration-160 ease-(--ease) group-hover:text-primary-ink">
          {c.reason}
          {c.isNew && <Badge>New</Badge>}
        </span>
        <span className="block text-fine text-ink-2">
          {cancelled ? `${c.date} · Cancelled before it started` : `${c.date} · ${c.gp} · ${minutes(c.minutes)}`}
        </span>
      </span>
      <span className="shrink-0 font-semibold tabular-nums">{c.cost === 0 ? 'No charge' : money(c.cost)}</span>
      <ChevronRightIcon strokeWidth={2} aria-hidden="true" className="size-5 shrink-0 text-ink-2" />
    </Link>
  );
}
