'use client';
import { useEffect, useRef, useState } from 'react';
import { plotClicks, rampColour, type StoredClick } from '@/lib/admin/heatmap';
import { fmtPct } from '@/lib/admin/format';

/* The live page under a heat layer. The public page is framed from this
   origin (public pages allow frame-ancestors 'self'; ?dq_heatmap=1 switches
   the tracker and the consent banner off) at the device bucket's width, and
   the whole frame is scaled down to fit the card with a CSS transform. Being
   same-origin, the frame's document height can be read, so the frame is made
   exactly as tall as the page and nothing inside it scrolls.

   HeatmapCanvas, on top, is our own code: clicks accumulate as Gaussian blobs
   on a half-resolution density grid, normalised to the hottest cell and
   colour-mapped through the sequential ramp in lib/admin/heatmap.ts. Scroll
   mode shades 5% bands of the page by the share of views that reached them. */

const MAX_HEIGHT = 16_000; // the canvas limit browsers agree on, with room to spare

export function HeatmapView({ src, width, mode, clicks, bands, marks }: {
  src: string;
  width: number;
  mode: 'clicks' | 'scroll';
  clicks: number[];                  // flat [x, y, h, x, y, h, …] to keep the payload small
  bands: number[];                   // share of views reaching each 5% band
  marks: Array<{ depth: number; share: number }>;
}) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [boxWidth, setBoxWidth] = useState<number | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const node = box.current;
    if (!node) return;
    const ro = new ResizeObserver(([e]) => setBoxWidth(Math.round(e.contentRect.width)));
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  // Measure the framed document once it has loaded. The frame is in the
  // server HTML, so it can finish loading before hydration: check the
  // document's state as well as listening for the event.
  useEffect(() => {
    setHeight(null);
    setFailed(false);
    const f = frame.current;
    if (!f) return;
    let ro: ResizeObserver | null = null;
    const run = () => {
      const doc = f.contentDocument;
      if (!doc || !doc.body) { setFailed(true); return; }
      if (!doc.getElementById('dq-heatmap-still')) {
        // Everything visible and still: the reveal grammar would otherwise hold
        // below-the-fold content at opacity 0 until it scrolled into view.
        const style = doc.createElement('style');
        style.id = 'dq-heatmap-still';
        style.textContent = '[data-reveal],.ln>span{opacity:1!important;transform:none!important;transition:none!important}html{scroll-behavior:auto!important}';
        doc.head.appendChild(style);
      }
      const measure = () => setHeight(Math.min(MAX_HEIGHT, Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0)));
      measure();
      // Fonts and late layout can still move the height a little.
      ro?.disconnect();
      ro = new ResizeObserver(measure);
      ro.observe(doc.body);
    };
    const doc = f.contentDocument;
    if (doc && doc.readyState === 'complete' && doc.URL !== 'about:blank') run();
    f.addEventListener('load', run);
    return () => { f.removeEventListener('load', run); ro?.disconnect(); };
  }, [src, width]);

  const scale = boxWidth ? Math.min(1, boxWidth / width) : 1;
  const h = height ?? 1200;

  return (
    <div ref={box} data-slot="heatmap-view" className="w-full">
      <div className="relative overflow-hidden rounded-lg bg-white shadow-card" style={{ height: h * scale, width: width * scale, maxWidth: '100%' }}>
        <div className="absolute top-0 left-0 origin-top-left" style={{ width, height: h, transform: `scale(${scale})` }}>
          <iframe
            ref={frame}
            key={src + width}
            src={src}
            title="The page as visitors see it"
            tabIndex={-1}
            aria-hidden="true"
            className="pointer-events-none block border-0"
            style={{ width, height: h }}
          />
          {height !== null && (
            <HeatmapCanvas width={width} height={height} mode={mode} clicks={clicks} bands={bands} />
          )}
        </div>
        {height !== null && mode === 'scroll' && marks.map((m) => (
          <div key={m.depth} className="pointer-events-none absolute right-0 left-0 border-t-2 border-dashed border-ink" style={{ top: Math.min(h - 2, (m.depth / 100) * h) * scale }}>
            <span className="absolute right-2 -translate-y-full rounded-sm bg-white px-2 py-0.5 text-fine font-semibold text-ink shadow-pop">
              {m.depth}% down · {fmtPct(m.share)} of views
            </span>
          </div>
        ))}
        {height === null && !failed && (
          <p className="absolute inset-x-0 top-8 text-center text-fine text-ink-2">Loading the page…</p>
        )}
        {failed && (
          <p role="alert" className="absolute inset-x-0 top-8 px-4 text-center text-fine text-ink-2">The page could not be loaded into the heatmap.</p>
        )}
      </div>
    </div>
  );
}

const CELL = 2; // density grid resolution, in page pixels

export function HeatmapCanvas({ width, height, mode, clicks, bands }: {
  width: number;
  height: number;
  mode: 'clicks' | 'scroll';
  clicks: number[];
  bands: number[];
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    if (mode === 'scroll') {
      const band = height / bands.length;
      bands.forEach((share, i) => {
        const [r, g, b] = rampColour(share);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.2 + share * 0.35})`;
        ctx.fillRect(0, Math.floor(i * band), width, Math.ceil(band));
      });
      return;
    }

    const stored: StoredClick[] = [];
    for (let i = 0; i + 2 < clicks.length; i += 3) stored.push({ x: clicks[i], y: clicks[i + 1], h: clicks[i + 2] });
    const points = plotClicks(stored, width, height);
    if (points.length === 0) return;

    const gw = Math.ceil(width / CELL);
    const gh = Math.ceil(height / CELL);
    const grid = new Float32Array(gw * gh);
    const radius = Math.max(8, Math.round((width < 500 ? 18 : 26) / CELL)); // in cells
    const sigma = radius / 2.5;
    const kernel: number[] = [];
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        kernel.push(Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma)));
      }
    }
    const span = radius * 2 + 1;
    for (const p of points) {
      const cx = Math.round(p.px / CELL);
      const cy = Math.round(p.py / CELL);
      for (let dy = -radius; dy <= radius; dy += 1) {
        const y = cy + dy;
        if (y < 0 || y >= gh) continue;
        const row = y * gw;
        const krow = (dy + radius) * span + radius;
        for (let dx = -radius; dx <= radius; dx += 1) {
          const x = cx + dx;
          if (x < 0 || x >= gw) continue;
          grid[row + x] += kernel[krow + dx];
        }
      }
    }
    let max = 0;
    for (let i = 0; i < grid.length; i += 1) if (grid[i] > max) max = grid[i];
    if (max <= 0) return;

    const img = new ImageData(gw, gh);
    for (let i = 0; i < grid.length; i += 1) {
      const t = grid[i] / max;
      if (t < 0.03) continue;
      // A square root lifts the long tail of single clicks so they still show.
      const v = Math.sqrt(t);
      const [r, g, b] = rampColour(v);
      img.data[i * 4] = r;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = b;
      img.data[i * 4 + 3] = Math.round(255 * Math.min(0.9, 0.35 + v * 0.55));
    }
    const off = document.createElement('canvas');
    off.width = gw;
    off.height = gh;
    off.getContext('2d')?.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, gw * CELL, gh * CELL);
  }, [width, height, mode, clicks, bands]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      data-slot="heatmap-canvas"
      className="pointer-events-none absolute top-0 left-0"
      style={{ width, height }}
    />
  );
}
