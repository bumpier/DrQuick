import { funnelRows, type FunnelStep } from '@/lib/admin/charts';
import { fmtCount, fmtPct } from '@/lib/admin/format';

/* A funnel as horizontal bars, one per step, each as long as its share of the
   first step. Bars are primary-ink on a fill track (lime is a fill but never a
   mark on white). Each row says its count, the conversion from the step before
   and the drop-off, in words, so nothing depends on reading a bar's length.
   Plain HTML, so it needs no measuring and renders on the server. */
export function FunnelChart({ steps, ariaLabel }: { steps: FunnelStep[]; ariaLabel: string }) {
  const rows = funnelRows(steps);
  return (
    <ol data-slot="funnel" aria-label={ariaLabel} className="grid gap-4">
      {rows.map((row, i) => (
        <li key={row.label} className="grid gap-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
            <span className="text-body font-semibold">{i + 1}. {row.label}</span>
            <span className="text-fine text-ink-2">
              <strong className="font-bold text-ink tabular-nums">{fmtCount(row.value)}</strong>
              {row.fromPrevious !== null && (
                <> · {fmtPct(row.fromPrevious)} of the step before · {fmtPct(row.dropOff)} dropped off</>
              )}
            </span>
          </div>
          <div className="h-6 rounded-sm bg-fill" title={`${row.label}: ${fmtCount(row.value)}`}>
            <div
              className="h-full rounded-sm bg-primary-ink"
              style={{ width: `${Math.max(row.value > 0 ? 0.5 : 0, row.share * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
