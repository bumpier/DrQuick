'use client';
import { useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ChartFrame } from '@/components/app/ChartFrame';
import { linePoints, labelStride, toPath } from '@/lib/charts';
import { nearestIndex, niceCeiling } from '@/lib/admin/charts';
import { cn } from '@/lib/utils';

/* A time series, one or two lines on one axis. The first series is the
   primary-ink solid line; the second is forest and dashed, so the pair is told
   apart by stroke as well as tone (the brand has no second hue that clears the
   colour checks, so the dash is the secondary encoding the dataviz rules ask
   for). One shared, rounded ceiling; hairline grid; a crosshair that snaps to
   the nearest day and lists every series; the same readout by keyboard (arrow
   keys); and the numbers as a table for anyone who would rather read them. */

export type TrendSeries = { key: string; label: string; values: number[] };

const STYLES = [
  { stroke: 'stroke-primary-ink', fill: 'fill-primary-ink', dash: undefined, key: 'bg-primary-ink' },
  { stroke: 'stroke-ink', fill: 'fill-ink', dash: '6 4', key: 'bg-ink' },
] as const;

const GUTTER_DEFAULT = 36;  // room for the y tick labels
const AXIS = 20;
const TOP = 8;

export function TrendChart({ series, labels, height = 180, ariaLabel, format = (v: number) => v.toLocaleString('en-GB'), axisFormat = format, gutter: GUTTER = GUTTER_DEFAULT }: {
  series: TrendSeries[];
  labels: string[];
  height?: number;
  ariaLabel: string;
  format?: (v: number) => string;
  axisFormat?: (v: number) => string;   // a shorter form for the y ticks (e.g. money)
  gutter?: number;                      // width kept for those ticks
}) {
  const [hover, setHover] = useState<number | null>(null);
  const drawn = series.slice(0, 2);
  const ceiling = niceCeiling(Math.max(...drawn.flatMap((s) => s.values), 0));
  const count = labels.length;

  return (
    <div data-slot="trend-chart">
      {drawn.length > 1 && (
        <ul className="mb-3 flex flex-wrap gap-4 text-fine text-ink-2" aria-label="Legend">
          {drawn.map((s, i) => (
            <li key={s.key} className="inline-flex items-center gap-1.5">
              <svg aria-hidden="true" width={18} height={2} viewBox="0 0 18 2" className="shrink-0">
                <line className={STYLES[i].stroke} x1={0} y1={1} x2={18} y2={1} strokeWidth={2} strokeDasharray={STYLES[i].dash} />
              </svg>
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <ChartFrame height={height + TOP} ariaLabel={ariaLabel}>
        {(width) => {
          const plot = Math.max(1, width - GUTTER);
          const pts = drawn.map((s) => linePoints(s.values, { width: plot, height, max: ceiling }).map((p) => ({ ...p, x: p.x + GUTTER, y: p.y + TOP })));
          const stride = labelStride(count, plot, 56);
          const last = count - 1;
          const xAt = (i: number) => GUTTER + (last <= 0 ? 0 : (i / last) * plot);

          const pick = (clientX: number, rect: DOMRect) => {
            const x = ((clientX - rect.left) / rect.width) * width - GUTTER;
            setHover(nearestIndex(Math.max(0, x), plot, count));
          };
          const onPointer = (e: PointerEvent<SVGSVGElement>) => pick(e.clientX, e.currentTarget.getBoundingClientRect());
          const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
            if (e.key === 'ArrowLeft') { e.preventDefault(); setHover((h) => Math.max(0, (h ?? last) - 1)); }
            if (e.key === 'ArrowRight') { e.preventDefault(); setHover((h) => Math.min(last, (h ?? -1) + 1)); }
            if (e.key === 'Escape') setHover(null);
          };
          const tipLeft = hover === null ? 0 : Math.min(Math.max(xAt(hover) / width, 0.12), 0.88);

          return (
            <div className="relative">
              <svg
                role="img"
                aria-label={`${ariaLabel}. Use the arrow keys to read each point.`}
                tabIndex={0}
                viewBox={`0 0 ${width} ${height + TOP + AXIS}`}
                className="block h-auto w-full touch-pan-y outline-offset-4"
                onPointerMove={onPointer}
                onPointerDown={onPointer}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover((h) => h ?? last)}
                onBlur={() => setHover(null)}
                onKeyDown={onKey}
              >
                {[1, 0.5].map((f) => (
                  <g key={f}>
                    <line className="stroke-rule" x1={GUTTER} x2={width} y1={TOP + height * (1 - f) + 0.5} y2={TOP + height * (1 - f) + 0.5} />
                    {f === 1 && (
                      <text className="fill-ink-2 text-[11px] tabular-nums" x={GUTTER - 8} y={TOP + 4} textAnchor="end">
                        {axisFormat(ceiling)}
                      </text>
                    )}
                  </g>
                ))}
                <line className="stroke-rule" x1={GUTTER} x2={width} y1={TOP + height + 0.5} y2={TOP + height + 0.5} />
                <text className="fill-ink-2 text-[11px] tabular-nums" x={GUTTER - 8} y={TOP + height + 4} textAnchor="end">0</text>
                {pts.map((p, i) => (
                  <path
                    key={drawn[i].key}
                    data-key={drawn[i].key}
                    d={toPath(p)}
                    className={STYLES[i].stroke}
                    strokeDasharray={STYLES[i].dash}
                    fill="none"
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                ))}
                {labels.map((label, i) => {
                  if (i !== last && (i % stride !== 0 || last - i < stride)) return null;
                  return (
                    <text
                      key={i}
                      className="fill-ink-2 text-[11px]"
                      x={xAt(i)}
                      y={TOP + height + 15}
                      textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'}
                    >
                      {label}
                    </text>
                  );
                })}
                {hover !== null && (
                  <g aria-hidden="true">
                    <line className="stroke-outline" x1={xAt(hover)} x2={xAt(hover)} y1={TOP} y2={TOP + height} strokeWidth={1} />
                    {pts.map((p, i) => p[hover] && (
                      <circle key={i} cx={p[hover].x} cy={p[hover].y} r={4.5} className={cn(STYLES[i].fill, 'stroke-white')} strokeWidth={2} />
                    ))}
                  </g>
                )}
              </svg>
              {hover !== null && (
                <div
                  role="status"
                  className="pointer-events-none absolute top-0 z-10 min-w-36 -translate-x-1/2 rounded-md bg-white px-3 py-2 text-fine shadow-pop"
                  style={{ left: `${tipLeft * 100}%` }}
                >
                  <p className="text-ink-2">{labels[hover]}</p>
                  {drawn.map((s, i) => (
                    <p key={s.key} className="mt-0.5 flex items-center gap-2">
                      <span aria-hidden="true" className={cn('h-0.5 w-3 shrink-0', STYLES[i].key)} />
                      <strong className="font-bold text-ink tabular-nums">{format(s.values[hover] ?? 0)}</strong>
                      <span className="text-ink-2">{s.label}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        }}
      </ChartFrame>
      <details className="mt-2 text-fine">
        <summary className="cursor-pointer font-semibold text-primary-ink">View as a table</summary>
        <div className="mt-2 max-h-64 overflow-auto rounded-md border border-rule">
          <table className="w-full text-left tabular-nums">
            <thead className="sticky top-0 bg-white">
              <tr>
                <th className="px-3 py-1.5 font-semibold">Date</th>
                {drawn.map((s) => <th key={s.key} className="px-3 py-1.5 text-right font-semibold">{s.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {labels.map((label, i) => (
                <tr key={i} className="border-t border-rule">
                  <td className="px-3 py-1">{label}</td>
                  {drawn.map((s) => <td key={s.key} className="px-3 py-1 text-right">{format(s.values[i] ?? 0)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
