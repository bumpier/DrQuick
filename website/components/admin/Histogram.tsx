'use client';
import { useState } from 'react';
import { ChartFrame } from '@/components/app/ChartFrame';
import { columnGeometry, columnPath, niceCeiling } from '@/lib/admin/charts';

/* A distribution as columns, one per bin (scroll depth, time on page). One
   series, so one colour: primary-ink, never lime on white. Each column is its
   own hover and focus target with the bin and count; the hovered column lifts
   to forest. Columns are capped at 24px wide with a 4px rounded top. */
export function Histogram({ bins, height = 160, ariaLabel, suffix = '', format = (v: number) => `${v.toLocaleString('en-GB')}${suffix}` }: {
  bins: Array<{ label: string; value: number }>;
  height?: number;
  ariaLabel: string;
  suffix?: string;              // a unit for the values ('%'), for server callers that cannot pass `format`
  format?: (v: number) => string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const AXIS = 20;
  const ceiling = niceCeiling(Math.max(...bins.map((b) => b.value), 0));
  return (
    <ChartFrame height={height} ariaLabel={ariaLabel}>
      {(width) => {
        const cols = columnGeometry(bins.map((b) => b.value), { width, height, max: ceiling });
        return (
          <div className="relative">
            <svg role="img" aria-label={ariaLabel} viewBox={`0 0 ${width} ${height + AXIS}`} className="block h-auto w-full">
              <line className="stroke-rule" x1={0} x2={width} y1={0.5} y2={0.5} />
              <line className="stroke-rule" x1={0} x2={width} y1={height + 0.5} y2={height + 0.5} />
              {cols.map((c, i) => (
                <g
                  key={i}
                  tabIndex={0}
                  role="img"
                  aria-label={`${bins[i].label}: ${format(c.value)}`}
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                >
                  {/* The hit target is the whole slot, not the painted column. */}
                  <rect x={i * c.slot} y={0} width={c.slot} height={height} fill="transparent" />
                  <path d={columnPath(c)} className={active === i ? 'fill-ink' : 'fill-primary-ink'} />
                  <text className="fill-ink-2 text-[11px]" x={c.x + c.w / 2} y={height + 14} textAnchor="middle">{bins[i].label}</text>
                </g>
              ))}
            </svg>
            <span className="absolute top-1 left-1 text-[11px] text-ink-2 tabular-nums" aria-hidden="true">{format(ceiling)}</span>
            {active !== null && (
              <div
                role="status"
                className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md bg-white px-3 py-2 text-fine shadow-pop"
                style={{ left: `${((cols[active].x + cols[active].w / 2) / width) * 100}%`, top: `${(cols[active].y / (height + AXIS)) * 100}%` }}
              >
                <strong className="font-bold tabular-nums">{format(bins[active].value)}</strong>{' '}
                <span className="text-ink-2">{bins[active].label}</span>
              </div>
            )}
          </div>
        );
      }}
    </ChartFrame>
  );
}
