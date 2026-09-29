/* Geometry for the admin's charts, apart from the markup so it can be tested
   (the lib/charts.ts pattern). Every mark follows the dataviz spec mapped onto
   Lime & Forest: columns at most 24px thick with a 2px gap, 2px lines, and
   one shared ceiling per chart. */

export const BAR_MAX = 24;
export const BAR_GAP = 2;

// A ceiling a reader can say out loud: 1, 2, 5 × 10ⁿ at or above the peak.
export function niceCeiling(max: number): number {
  if (!(max > 0)) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const step of [1, 2, 2.5, 5, 10]) if (step * pow >= max) return step * pow;
  return 10 * pow;
}

export type Column = { x: number; y: number; w: number; h: number; value: number; slot: number };

// Columns centred in equal slots, capped at BAR_MAX wide, a zero drawn as a
// 1px stub so an empty bin and a missing one never look the same.
export function columnGeometry(values: number[], { width, height, max }: { width: number; height: number; max?: number }): Column[] {
  const n = values.length;
  if (n === 0) return [];
  const ceiling = max ?? niceCeiling(Math.max(...values, 0));
  const slot = width / n;
  const w = Math.max(1, Math.min(BAR_MAX, slot - BAR_GAP));
  return values.map((value, i) => {
    const h = Math.max(1, (Math.max(0, value) / ceiling) * height);
    return { x: i * slot + (slot - w) / 2, y: height - h, w, h, value, slot };
  });
}

// SVG path for a column with 4px rounded data-end and a square foot.
export function columnPath({ x, y, w, h }: Pick<Column, 'x' | 'y' | 'w' | 'h'>, radius = 4): string {
  const r = Math.min(radius, w / 2, h);
  const f = (v: number) => v.toFixed(1);
  return `M${f(x)} ${f(y + h)}V${f(y + r)}Q${f(x)} ${f(y)} ${f(x + r)} ${f(y)}H${f(x + w - r)}Q${f(x + w)} ${f(y)} ${f(x + w)} ${f(y + r)}V${f(y + h)}Z`;
}

export type FunnelStep = { label: string; value: number };
export type FunnelRow = FunnelStep & {
  share: number;           // of the first step, 0–1: the bar's length
  fromPrevious: number | null; // conversion from the step before; null for the first
  dropOff: number | null;  // 1 - fromPrevious
};

export function funnelRows(steps: FunnelStep[]): FunnelRow[] {
  const first = steps[0]?.value ?? 0;
  return steps.map((step, i) => {
    const prev = i === 0 ? null : steps[i - 1].value;
    const fromPrevious = prev === null ? null : prev > 0 ? step.value / prev : 0;
    return {
      ...step,
      share: first > 0 ? Math.min(1, step.value / first) : 0,
      fromPrevious,
      dropOff: fromPrevious === null ? null : 1 - fromPrevious,
    };
  });
}

// Counts per bin for a histogram: `edges` [0, 25, 50, 75, 100] gives four
// bins [0,25) [25,50) [50,75) [75,100] — the last bin includes its top edge.
export function binCounts(values: number[], edges: number[]): number[] {
  const counts = new Array(Math.max(0, edges.length - 1)).fill(0);
  for (const v of values) {
    for (let i = 0; i < counts.length; i += 1) {
      const last = i === counts.length - 1;
      if (v >= edges[i] && (v < edges[i + 1] || (last && v <= edges[i + 1]))) { counts[i] += 1; break; }
    }
  }
  return counts;
}

// The index of the data point nearest an x position, for the crosshair.
export function nearestIndex(x: number, width: number, count: number): number {
  if (count <= 1) return 0;
  const i = Math.round((x / width) * (count - 1));
  return Math.min(count - 1, Math.max(0, i));
}
