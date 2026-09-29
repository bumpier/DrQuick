import type { ReactNode } from 'react';
import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from 'lucide-react';
import { StatTile } from '@/components/app/StatTile';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { fmtPct } from '@/lib/admin/format';

// One headline figure: the value, what it is, and how it moved against the
// previous period. Direction is carried by the arrow and the words, never by
// colour alone; the colour only says whether the move is good news.
export function Kpi({ label, value, change, goodWhen = 'up', note, children }: {
  label: string;
  value: string;
  change?: number | null;       // a ratio: 0.12 is +12%; null is "nothing to compare"
  goodWhen?: 'up' | 'down';
  note?: string;                // a definition or a qualifier, one line
  children?: ReactNode;         // a sparkline
}) {
  return (
    <Card size="sm" className="min-w-0 gap-0 px-5 py-5">
      <StatTile label={label} value={value} size="sm" className="gap-1.5" />
      {change !== undefined && <Delta change={change} goodWhen={goodWhen} />}
      {note && <p className="mt-1 text-fine text-ink-2">{note}</p>}
      {children && <div className="mt-auto pt-3">{children}</div>}
    </Card>
  );
}

export function Delta({ change, goodWhen = 'up' }: { change: number | null; goodWhen?: 'up' | 'down' }) {
  if (change === null) {
    return <p data-slot="delta" className="mt-2 text-fine text-ink-2">Nothing to compare yet</p>;
  }
  const flat = Math.abs(change) < 0.0005;
  const up = change > 0;
  const good = !flat && (up === (goodWhen === 'up'));
  const Icon = flat ? MinusIcon : up ? ArrowUpIcon : ArrowDownIcon;
  return (
    <p
      data-slot="delta"
      data-direction={flat ? 'flat' : up ? 'up' : 'down'}
      className={cn('mt-2 inline-flex items-center gap-1 text-fine font-semibold', good ? 'text-primary-ink' : 'text-ink-2')}
    >
      <Icon strokeWidth={2} className="size-4" aria-hidden="true" />
      {flat ? 'No change' : `${up ? 'Up' : 'Down'} ${fmtPct(Math.abs(change))}`}
      <span className="font-normal text-ink-2 max-phone:hidden">vs previous period</span>
    </p>
  );
}

export function KpiRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div data-slot="kpi-row" className={cn('grid grid-cols-3 gap-4 max-cols:grid-cols-2 max-phone:gap-3', className)}>{children}</div>;
}
