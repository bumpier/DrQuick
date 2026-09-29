import Link from 'next/link';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRESETS, PRESET_SHORT, presetSpan, type Range } from '@/lib/admin/range';
import { CustomRange } from './CustomRange';

// The range every figure on a page is scoped to, in the URL as ?from&to so a
// view can be shared and reloaded. Presets are plain links (they work before
// hydration); a custom span is picked in the disclosure beside them. `keep`
// carries the page's other query parameters through a change of range.
export function DateRangePicker({ range, basePath, keep = {}, now = new Date() }: {
  range: Range;
  basePath: string;
  keep?: Record<string, string | undefined>;
  now?: Date;
}) {
  const href = (fromDay: string, toDay: string) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(keep)) if (v) q.set(k, v);
    q.set('from', fromDay);
    q.set('to', toDay);
    return `${basePath}?${q.toString()}`;
  };

  return (
    <div data-slot="date-range" className="mb-6 flex flex-wrap items-center gap-2">
      <nav aria-label="Date range" className="flex flex-wrap gap-1 rounded-pill bg-fill p-1">
        {PRESETS.map((p) => {
          const s = presetSpan(p, now);
          const active = range.preset === p;
          return (
            <Link
              key={p}
              href={href(s.fromDay, s.toDay)}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'inline-flex h-9 items-center rounded-pill px-3.5 text-fine font-semibold text-ink no-underline transition-colors duration-160 ease-(--ease)',
                active ? 'bg-primary shadow-seg' : 'hover:bg-fill-hover',
              )}
            >
              {PRESET_SHORT[p]}
            </Link>
          );
        })}
      </nav>
      <CustomRange basePath={basePath} keep={keep} fromDay={range.fromDay} toDay={range.toDay} active={range.preset === null} />
      <p className="ml-1 inline-flex items-center gap-1.5 text-fine text-ink-2">
        <CalendarIcon strokeWidth={2} className="size-4" aria-hidden="true" />
        <span>{range.label}<span className="max-phone:hidden">, compared with the {range.days === 1 ? 'day' : `${range.days} days`} before</span></span>
      </p>
    </div>
  );
}
