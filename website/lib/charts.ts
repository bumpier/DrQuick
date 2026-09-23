/* Charts are authored SVG built from fixtures. No library, no build step, and
   no colour outside the closed palette — every fill and stroke is a class in
   dashboard.css, so a chart cannot introduce a hue the page has forbidden.

   The geometry is separated from the markup so it can be unit-tested: a chart
   that silently draws a bar off the top of its own box is the kind of bug a
   screenshot hides and a test does not. */

export type Bar = { x: number; y: number; w: number; h: number; value: number };
export type Point = { x: number; y: number; value: number };
export type BarDatum = { label: string; value: number; emph?: 'true' | 'false' | 'accent' };
export type LineSet = { key: string; values: number[] };
export type BarOptions = { width: number; height: number; gap?: number };
export type LineOptions = { width: number; height: number; max?: number | null };

export function barGeometry(values: number[], { width, height, gap = 6 }: BarOptions): Bar[] {
  const max = Math.max(...values, 1);
  const n = values.length;
  if (n === 0) return [];
  const w = Math.max(1, (width - gap * (n - 1)) / n);
  return values.map((value, i) => {
    // A zero bar still gets a 1px stub: an empty day and a missing day look
    // identical otherwise, and they mean very different things.
    const h = Math.max(1, (value / max) * height);
    return { x: i * (w + gap), y: height - h, w, h, value };
  });
}

export function linePoints(values: number[], { width, height, max = null }: LineOptions): Point[] {
  // A shared max is what lets two series be compared on one pair of axes.
  // Scaling each set to its own peak makes a smaller series look identical
  // to a larger one, which is worse than drawing no chart at all.
  const ceiling = max ?? Math.max(...values, 1);
  const n = values.length;
  if (n === 0) return [];
  const step = n === 1 ? 0 : width / (n - 1);
  return values.map((value, i) => ({ x: i * step, y: height - (value / ceiling) * height, value }));
}

export function toPath(points: Point[]): string {
  if (points.length === 0) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}

/* How many tick labels fit before they collide. A chart drawn at phone width
   with every label printed is a grey smear; dropping every other one keeps the
   axis readable at both ends of the breakpoint range. */
export function labelStride(count: number, width: number, minGap = 34): number {
  const slots = Math.max(1, Math.floor(width / minGap));
  return Math.max(1, Math.ceil(count / slots));
}

const esc = (s: unknown): string => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export function svgBars(
  series: BarDatum[],
  { width = 640, height = 150, gap = 6, labelEvery = null, format = String }:
    { width?: number; height?: number; gap?: number; labelEvery?: number | null; format?: (v: number) => string } = {},
): string {
  const stride = labelEvery ?? labelStride(series.length, width);
  const axis = 20;
  const bars = barGeometry(series.map((d) => d.value), { width, height, gap });
  const rects = bars.map((b, i) => {
    const emph = series[i].emph ?? 'false';
    return `<rect class="bar" data-emph="${esc(emph)}" x="${b.x.toFixed(1)}" y="${b.y.toFixed(1)}" `
      + `width="${b.w.toFixed(1)}" height="${b.h.toFixed(1)}" rx="2">`
      + `<title>${esc(series[i].label)}: ${esc(format(b.value))}</title></rect>`;
  }).join('');
  const labels = series.map((d, i) => (i % stride === 0
    ? `<text x="${(bars[i].x + bars[i].w / 2).toFixed(1)}" y="${height + 14}" text-anchor="middle">${esc(d.label)}</text>`
    : '')).join('');
  return `<svg class="chart" viewBox="0 0 ${width} ${height + axis}" role="img" preserveAspectRatio="xMidYMid meet">`
    + `<line class="baseline" x1="0" y1="${height + .5}" x2="${width}" y2="${height + .5}"/>`
    + rects + labels + '</svg>';
}

export function svgLines(
  sets: LineSet[],
  labels: string[],
  { width = 640, height = 150, area = false }: { width?: number; height?: number; area?: boolean } = {},
): string {
  const axis = 20;
  const stride = labelStride(labels.length, width);
  const all = sets.flatMap((s) => s.values);
  const max = Math.max(...all, 1);
  const paths = sets.map((set) => {
    const pts = linePoints(set.values, { width, height, max });
    const path = toPath(pts);
    const fill = area && set.key !== 'second'
      ? `<path class="area" d="${path} L${width} ${height} L0 ${height} Z"/>`
      : '';
    return fill + `<path class="line" data-key="${esc(set.key)}" d="${path}"/>`;
  }).join('');
  // Both ends are always labelled; an intermediate tick within one stride of
  // the last is dropped, or the two collide at phone width.
  const last = labels.length - 1;
  const ticks = labels.map((label, i) => {
    const keep = i === last || (i % stride === 0 && last - i >= stride);
    if (!keep) return '';
    const x = labels.length === 1 ? 0 : (i / (labels.length - 1)) * width;
    const anchor = i === 0 ? 'start' : (i === labels.length - 1 ? 'end' : 'middle');
    return `<text x="${x.toFixed(1)}" y="${height + 14}" text-anchor="${anchor}">${esc(label)}</text>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${width} ${height + axis}" role="img" preserveAspectRatio="xMidYMid meet">`
    + `<line class="baseline" x1="0" y1="${height + .5}" x2="${width}" y2="${height + .5}"/>`
    + paths + ticks + '</svg>';
}

/* Draw a chart at its container's real width, so one SVG unit is one CSS
   pixel and the axis type renders at the size it was authored at. A fixed
   viewBox scaled down to a phone shrinks the labels with it, which is how a
   chart ends up with an axis nobody can read. */
export function mountChart(node: HTMLElement, build: (width: number) => string, win: Window = globalThis as unknown as Window): () => void {
  const draw = () => {
    const width = Math.max(240, Math.round(node.clientWidth || 640));
    node.innerHTML = build(width);
  };
  draw();
  let frame = 0;
  win.addEventListener('resize', () => {
    win.cancelAnimationFrame?.(frame);
    frame = win.requestAnimationFrame?.(draw) ?? 0;
    if (!win.requestAnimationFrame) draw();
  });
  return draw;
}
