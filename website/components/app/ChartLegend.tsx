import { cn } from '@/lib/utils';

/* A legend is a caption for a picture. The swatches are the marks themselves
   — the solid squares of the bars, the dashed line of the second series —
   and a caller renders it only beside a drawn chart, never above an empty
   state: with no data there is no picture (dashboard.css:194). */

export type LegendItem = { label: string; swatch: 'primary' | 'outline' | 'ink-2' };

// doctor.html:95 and :199; doctor.html:105 and admin.html:78.
export const DAILY_LEGEND: LegendItem[] = [
  { label: 'Today', swatch: 'primary' },
  { label: 'Earlier days', swatch: 'outline' },
];
export const DEMAND_LEGEND: LegendItem[] = [
  { label: 'Patients waiting', swatch: 'primary' },
  { label: 'GPs online', swatch: 'ink-2' },
];

function Swatch({ swatch }: { swatch: LegendItem['swatch'] }) {
  if (swatch === 'ink-2') {
    return (
      <svg aria-hidden="true" width={16} height={2} viewBox="0 0 16 2" className="shrink-0">
        <line className="stroke-ink-2" x1={0} y1={1} x2={16} y2={1} strokeWidth={2} strokeDasharray="5 4" />
      </svg>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn('size-2.5 shrink-0 rounded-[2px]', swatch === 'primary' ? 'bg-primary' : 'bg-outline')}
    />
  );
}

export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <div data-slot="chart-legend" className="mt-3 flex flex-wrap gap-4 text-fine text-ink-2">
      {items.map((item) => (
        // Below the phone line LineChart draws its first series only; the caption
        // for the dashed second series leaves with it.
        <span
          key={item.label}
          data-swatch={item.swatch}
          className={cn('inline-flex items-center gap-1.5', item.swatch === 'ink-2' && 'max-phone:hidden')}
        >
          <Swatch swatch={item.swatch} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
