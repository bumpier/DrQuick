import { linePoints, toPath } from '@/lib/charts';

// A small trend line for a KPI tile: no axis, no labels, the latest point
// marked. The line is primary-ink at 2px; the viewBox stretches to the tile and
// non-scaling-stroke keeps the line 2px whatever the width. Decorative: the
// tile's own number and delta say what it shows.
export function Sparkline({ values, height = 32 }: { values: number[]; height?: number }) {
  // A flat line at zero says nothing the zero above it has not already said.
  if (values.length < 2 || values.every((v) => v === 0)) return null;
  const W = 100;
  const pad = 3;
  const pts = linePoints(values, { width: W, height: height - pad * 2 }).map((p) => ({ ...p, y: p.y + pad }));
  const end = pts[pts.length - 1];
  return (
    <svg
      aria-hidden="true"
      data-slot="sparkline"
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      className="block w-full overflow-visible"
      style={{ height }}
    >
      <path d={toPath(pts)} className="stroke-primary-ink" fill="none" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      <line x1={end.x} x2={end.x} y1={end.y} y2={end.y} className="stroke-primary-ink" strokeWidth={7} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
