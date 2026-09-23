'use client';
import { barGeometry, labelStride, type BarDatum } from '@/lib/charts';
import { AXIS, ChartFrame } from './ChartFrame';

/* The daily bars. Today is the one primary mark; every earlier day is the
   solid outline grey, which reads at 4.5:1 on white where a tint would not.
   A client component only because the render prop it hands ChartFrame
   cannot cross a server boundary. */

type Props = {
  data: BarDatum[];
  height?: number;
  format?: (value: number) => string;
  ariaLabel: string;
};

export function BarChart({ data, height = 150, format = String, ariaLabel }: Props) {
  return (
    <ChartFrame height={height} ariaLabel={ariaLabel}>
      {(width) => {
        const bars = barGeometry(data.map((d) => d.value), { width, height });
        const stride = labelStride(data.length, width);
        return (
          <svg
            role="img"
            aria-label={ariaLabel}
            viewBox={`0 0 ${width} ${height + AXIS}`}
            preserveAspectRatio="xMidYMid meet"
            className="block h-auto w-full"
          >
            <line className="stroke-rule" x1={0} y1={height + 0.5} x2={width} y2={height + 0.5} />
            {bars.map((bar, i) => (
              <rect
                key={i}
                data-emph={data[i].emph ?? 'false'}
                className={data[i].emph === 'true' ? 'fill-primary' : 'fill-outline'}
                x={bar.x}
                y={bar.y}
                width={bar.w}
                height={bar.h}
                rx={2}
              >
                <title>{`${data[i].label}: ${format(bar.value)}`}</title>
              </rect>
            ))}
            {bars.map((bar, i) => i % stride === 0 && (
              <text
                key={i}
                className="fill-ink-2 font-display text-[11px]"
                x={bar.x + bar.w / 2}
                y={height + 14}
                textAnchor="middle"
              >
                {data[i].label}
              </text>
            ))}
          </svg>
        );
      }}
    </ChartFrame>
  );
}
