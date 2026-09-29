import type { ReactNode } from 'react';
import { EmptyState } from '@/components/app/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fmtCount } from '@/lib/admin/format';
import { cn } from '@/lib/utils';

export type RankRow = { key: string; label: ReactNode; value: number; cells?: ReactNode[] };

/* A "top N" table in a card: the name, the main count with a thin bar behind
   it scaled to the largest row (primary-ink on the fill track, the same marks
   as the funnel), and any further columns. One series, so no legend; the
   number is always printed, the bar only helps the eye compare. */
export function RankTable({ title, description, head, valueLabel, extraHeads = [], rows, empty, className }: {
  title: string;
  description?: string;
  head: string;
  valueLabel: string;
  extraHeads?: string[];
  rows: RankRow[];
  empty: string;
  className?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <Card size="sm" className={cn('min-w-0', className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <p className="text-fine text-ink-2">{description}</p>}
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? <EmptyState className="py-6">{empty}</EmptyState> : (
          <table data-slot="rank-table" className="w-full table-fixed text-left text-fine">
            <thead>
              <tr className="text-ink-2">
                <th scope="col" className="pb-2 font-semibold">{head}</th>
                <th scope="col" className="w-[32%] pb-2 text-right font-semibold">{valueLabel}</th>
                {extraHeads.map((h) => <th key={h} scope="col" className="w-[20%] pb-2 pl-3 text-right font-semibold max-phone:hidden">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-rule">
                  <th scope="row" className="truncate py-2 pr-3 font-normal text-ink">{r.label}</th>
                  <td className="py-2">
                    <span className="flex items-center justify-end gap-2">
                      <span aria-hidden="true" className="h-1.5 min-w-0 flex-1 rounded-full bg-fill">
                        <span className="block h-full rounded-full bg-primary-ink" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">{fmtCount(r.value)}</span>
                    </span>
                  </td>
                  {(r.cells ?? []).map((c, i) => <td key={i} className="py-2 pl-3 text-right text-ink-2 tabular-nums max-phone:hidden">{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
