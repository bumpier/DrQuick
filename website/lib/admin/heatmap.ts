// Heatmap maths, pure so the browser canvas and the tests share it.
//
// A click is stored as x (% of the document's width), y (px from the top) and
// h (the document's height when it happened). The page in the admin's iframe
// may be taller or shorter now (copy changed, fonts, another width inside the
// bucket), so y is rescaled by current height / recorded height.
import type { DeviceBucket } from '@/lib/admin/analytics-labels';

export const BUCKET_WIDTHS: Record<DeviceBucket, number> = { desktop: 1280, tablet: 820, mobile: 390 };

export type StoredClick = { x: number; y: number; h: number };
export type PlotPoint = { px: number; py: number };

export function plotClicks(clicks: StoredClick[], width: number, docHeight: number): PlotPoint[] {
  const out: PlotPoint[] = [];
  for (const c of clicks) {
    if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) continue;
    const scale = c.h > 0 && docHeight > 0 ? docHeight / c.h : 1;
    const py = c.y * scale;
    if (py < 0 || (docHeight > 0 && py > docHeight)) continue;
    out.push({ px: (Math.min(100, Math.max(0, c.x)) / 100) * width, py });
  }
  return out;
}

// The sequential ramp, light to dark in one hue family: lime-wash → lime →
// primary-ink → forest (DESIGN.md tokens; tests/constraints.test.ts allows
// exactly these hexes). Low density is a pale wash, the hottest spot forest.
export const RAMP_HEX = ['#E2F6D5', '#9FE870', '#2F6B0F', '#163300'] as const;

const rgb = (hex: string): [number, number, number] => {
  const v = Number.parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
const STOPS = RAMP_HEX.map(rgb);

// t in [0, 1] → [r, g, b], linear between the four stops.
export function rampColour(t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, t)) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(x));
  const f = x - i;
  const [a, b] = [STOPS[i], STOPS[i + 1]];
  return [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * f)) as [number, number, number];
}

// The share of views that reached each 5% band of the page, from each view's
// deepest scroll %. Band i covers [i*5, i*5+5); reaching it means a deepest
// point above its top edge (the first band is reached by every view).
export function reachBands(deepest: number[], step = 5): number[] {
  const total = deepest.length;
  const bands: number[] = [];
  for (let top = 0; top < 100; top += step) {
    const reached = deepest.filter((d) => d >= top).length;
    bands.push(total > 0 ? reached / total : 0);
  }
  return bands;
}
