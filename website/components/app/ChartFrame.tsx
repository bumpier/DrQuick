'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';

/* A chart is drawn at the width its box really has, so one SVG unit is one
   CSS pixel and the axis type renders at the size it was authored at. A
   fixed viewBox scaled down to a phone shrinks the labels with it, which is
   how a chart ends up with an axis nobody can read (the port of mountChart).
   The width is only known after mount, so the server shell reserves the
   height and draws nothing, the client's first render agrees with it, and
   the picture appears on the first measurement. */

export const AXIS = 20;   // the label band under the baseline
const MIN_WIDTH = 240;    // a collapsed or hidden box still gets a legible chart

type Props = { height: number; ariaLabel: string; children: (width: number) => ReactNode };

export function ChartFrame({ height, ariaLabel, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(MIN_WIDTH, Math.round(entry.contentRect.width)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} data-slot="chart-frame" className="w-full" style={{ minHeight: height + AXIS }}>
      {/* Until there is a picture the frame still says what will be here, so the
          server shell and a scripts-off page are not silent about it. */}
      {width === null ? <span className="sr-only">{ariaLabel}</span> : children(width)}
    </div>
  );
}
