'use client';
import { labelStride, linePoints, toPath, type LineSet } from '@/lib/charts';
import { AXIS, ChartFrame } from './ChartFrame';

/* Two series on one pair of axes and no fill under either line. The
   ceiling is shared across every set, drawn or not, so a value sits at the
   same height on the phone as on the desk. Below the phone line only the
   first series is drawn: two lines at 300px cross into a smear, and the
   second — cover — is the one a GP can least act on. A client component
   only because the render prop it hands ChartFrame cannot cross a server
   boundary. */

export const ONE_SERIES_BELOW = 560;

type Props = { sets: LineSet[]; labels: string[]; height?: number; ariaLabel: string };

export function LineChart({ sets, labels, height = 150, ariaLabel }: Props) {
  return (
    <ChartFrame height={height} ariaLabel={ariaLabel}>
      {(width) => {
        const drawn = width < ONE_SERIES_BELOW ? sets.slice(0, 1) : sets;
        const max = Math.max(...sets.flatMap((s) => s.values), 1);
        const stride = labelStride(labels.length, width);
        const last = labels.length - 1;
        return (
          <svg
            role="img"
            aria-label={ariaLabel}
            viewBox={`0 0 ${width} ${height + AXIS}`}
            preserveAspectRatio="xMidYMid meet"
            className="block h-auto w-full"
          >
            <line className="stroke-rule" x1={0} y1={height + 0.5} x2={width} y2={height + 0.5} />
            {drawn.map((set, i) => (
              <path
                key={set.key}
                data-key={set.key}
                d={toPath(linePoints(set.values, { width, height, max }))}
                className={i === 0 ? 'stroke-primary' : 'stroke-ink-2'}
                strokeDasharray={i === 0 ? undefined : '5 4'}
                fill="none"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            {labels.map((label, i) => {
              // Both ends always print; a tick within one stride of the last would sit on top of it.
              if (i !== last && (i % stride !== 0 || last - i < stride)) return null;
              return (
                <text
                  key={i}
                  className="fill-ink-2 font-display text-[11px]"
                  x={last === 0 ? 0 : (i / last) * width}
                  y={height + 14}
                  textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'}
                >
                  {label}
                </text>
              );
            })}
          </svg>
        );
      }}
    </ChartFrame>
  );
}
