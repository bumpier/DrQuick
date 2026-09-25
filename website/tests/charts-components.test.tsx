// @vitest-environment jsdom
import { test, expect, beforeEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
vi.mock('next/navigation', () => import('./helpers/next-navigation'));
import { installDomStubs, ResizeObserverStub } from './helpers/dom-stubs';
import { ChartFrame } from '@/components/app/ChartFrame';
import { BarChart } from '@/components/app/BarChart';
import { LineChart, ONE_SERIES_BELOW } from '@/components/app/LineChart';
import { ChartLegend, DAILY_LEGEND, DEMAND_LEGEND } from '@/components/app/ChartLegend';
import { EmptyState } from '@/components/app/EmptyState';
import { DataModeProvider, useFigures } from '@/lib/data-mode';
import { earningsFor } from '@/lib/earnings';
import { DEMAND_BY_HOUR } from '@/lib/fixtures';
import { labelStride } from '@/lib/charts';

const DAILY = earningsFor({ seeded: true, session: [] }).dailySeries;
const SETS = [
  { key: 'first', values: DEMAND_BY_HOUR.map((h) => h.waiting) },
  { key: 'second', values: DEMAND_BY_HOUR.map((h) => h.gps) },
];
const HOURS = DEMAND_BY_HOUR.map((h) => h.hour);

beforeEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  installDomStubs();
  window.history.replaceState(null, '', '/doctor');
});

// jsdom measures every box at 0, so the frame is measured by hand — what a
// browser's ResizeObserver does on observe.
function measure(container: HTMLElement, width: number) {
  const frame = container.querySelector('[data-slot="chart-frame"]')!;
  act(() => ResizeObserverStub.forElement(frame)!.resize(frame, width));
  return frame;
}

test('ChartFrame draws nothing until measured, then at the measured width and never under 240', () => {
  const { container } = render(
    <ChartFrame height={150} ariaLabel="Consultations, last 14 days">{(w) => <svg data-width={w} />}</ChartFrame>,
  );
  const frame = container.querySelector('[data-slot="chart-frame"]')!;
  expect(frame).toHaveStyle({ minHeight: '170px' });
  expect(container.querySelector('svg')).toBeNull();
  expect(frame).toHaveTextContent('Consultations, last 14 days');   // named before it is drawn
  measure(container, 100);
  expect(container.querySelector('svg')).toHaveAttribute('data-width', '240');
  expect(container.querySelector('.sr-only')).toBeNull();           // the svg carries the name now
  measure(container, 640);
  expect(container.querySelector('svg')).toHaveAttribute('data-width', '640');
});

test('ChartFrame stops observing when it unmounts', () => {
  const { container, unmount } = render(<BarChart data={DAILY} ariaLabel="Consultations, last 14 days" />);
  const frame = container.querySelector('[data-slot="chart-frame"]')!;
  expect(ResizeObserverStub.forElement(frame)).toBeDefined();
  unmount();
  expect(ResizeObserverStub.forElement(frame)).toBeUndefined();
});

test('BarChart draws one rect per day at the measured width, today in primary, the rest in outline', () => {
  const { container } = render(
    <BarChart data={DAILY} height={150} format={(v) => `${v} consultations`} ariaLabel="Consultations, last 14 days" />,
  );
  expect(container.querySelector('svg')).toBeNull();
  measure(container, 640);
  const svg = container.querySelector('svg')!;
  expect(svg).toHaveAttribute('role', 'img');
  expect(svg).toHaveAttribute('aria-label', 'Consultations, last 14 days');
  expect(svg).toHaveAttribute('viewBox', '0 0 640 170');
  const rects = [...container.querySelectorAll('rect')];
  expect(rects).toHaveLength(14);
  expect(rects.filter((r) => r.classList.contains('fill-primary-ink'))).toHaveLength(1);
  expect(rects.at(-1)).toHaveClass('fill-primary-ink');
  expect(rects.slice(0, -1).every((r) => r.classList.contains('fill-outline'))).toBe(true);
  expect(container.querySelectorAll('rect > title')).toHaveLength(14);
  expect(container.querySelector('rect > title')).toHaveTextContent('15: 1 consultations');
  expect(container.querySelector('line')).toHaveClass('stroke-rule');
});

test('BarChart prints fewer day labels when narrow, via labelStride', () => {
  const { container } = render(<BarChart data={DAILY} height={150} ariaLabel="Consultations, last 14 days" />);
  measure(container, 640);
  expect(container.querySelectorAll('text')).toHaveLength(14);
  measure(container, 300);
  expect(labelStride(14, 300)).toBe(2);
  expect(container.querySelectorAll('text')).toHaveLength(7);
  for (const t of container.querySelectorAll('text')) expect(t).toHaveClass('fill-ink-2', 'font-display', 'text-[11px]');
});

test('LineChart draws two paths at 640 and one at 390, on one shared ceiling', () => {
  const { container } = render(
    <LineChart sets={SETS} labels={HOURS} height={150} ariaLabel="Demand against cover, by hour" />,
  );
  measure(container, 640);
  expect(container.querySelector('svg')).toHaveAttribute('viewBox', '0 0 640 170');
  const paths = container.querySelectorAll('path');
  expect(paths).toHaveLength(2);
  expect(paths[0]).toHaveAttribute('data-key', 'first');
  expect(paths[0]).toHaveClass('stroke-primary-ink');
  expect(paths[0]).not.toHaveAttribute('stroke-dasharray');
  expect(paths[1]).toHaveAttribute('data-key', 'second');
  expect(paths[1]).toHaveClass('stroke-ink-2');
  expect(paths[1]).toHaveAttribute('stroke-dasharray', '5 4');
  for (const p of paths) {
    expect(p).toHaveAttribute('stroke-width', '2');
    expect(p).toHaveAttribute('fill', 'none');
  }
  // Patients waiting peaks at 9 and touches the top; GPs online peaks at 4 and does not.
  expect(paths[0].getAttribute('d')).toMatch(/ 0\.0\b/);
  expect(paths[1].getAttribute('d')).not.toMatch(/ 0\.0\b/);
  measure(container, 390);
  expect(container.querySelectorAll('path')).toHaveLength(1);
  expect(container.querySelector('path')).toHaveAttribute('data-key', 'first');
  measure(container, ONE_SERIES_BELOW - 1);
  expect(container.querySelectorAll('path')).toHaveLength(1);
  measure(container, ONE_SERIES_BELOW);
  expect(container.querySelectorAll('path')).toHaveLength(2);
});

test('LineChart labels both ends and drops the tick that would collide with the last', () => {
  const labels = Array.from({ length: 16 }, (_, i) => String(i));
  const { container } = render(
    <LineChart sets={[{ key: 'first', values: labels.map(Number) }]} labels={labels} height={150} ariaLabel="Ticks" />,
  );
  measure(container, 300);
  const ticks = [...container.querySelectorAll('text')];
  const printed = ticks.map((t) => Number(t.textContent));
  expect(printed[0]).toBe(0);
  expect(printed.at(-1)).toBe(15);
  expect(printed).not.toContain(14);
  expect(ticks[0]).toHaveAttribute('text-anchor', 'start');
  expect(ticks.at(-1)).toHaveAttribute('text-anchor', 'end');
});

test('ChartLegend swatches are the marks: solid primary and outline, and an ink-2 dashed line that leaves at phone width', () => {
  const { container } = render(<><ChartLegend items={DAILY_LEGEND} /><ChartLegend items={DEMAND_LEGEND} /></>);
  const [daily, demand] = container.querySelectorAll('[data-slot="chart-legend"]');
  expect(daily).toHaveTextContent('Today');
  expect(daily).toHaveTextContent('Earlier days');
  expect(daily.querySelector('[data-swatch="primary"] span')).toHaveClass('bg-primary-ink');
  expect(daily.querySelector('[data-swatch="outline"] span')).toHaveClass('bg-outline');
  const dashed = demand.querySelector('[data-swatch="ink-2"]')!;
  expect(dashed).toHaveTextContent('GPs online');
  expect(dashed.querySelector('line')).toHaveClass('stroke-ink-2');
  expect(dashed.querySelector('line')).toHaveAttribute('stroke-dasharray', '5 4');
  expect(dashed).toHaveClass('max-phone:hidden');
  expect(demand.querySelector('[data-swatch="primary"]')).not.toHaveClass('max-phone:hidden');
});

// The composition every chart card copies. A legend is a caption for a picture:
// in blank mode there is no picture, so there is no legend either.
function DailyChartCard() {
  const { seeded } = useFigures();
  if (!seeded) return <EmptyState>No consultations yet.</EmptyState>;
  return (
    <>
      <BarChart data={DAILY} height={150} ariaLabel="Consultations, last 14 days" />
      <ChartLegend items={DAILY_LEGEND} />
    </>
  );
}

test('no picture, no legend: blank mode renders the written empty state alone', () => {
  const { container } = render(<DataModeProvider><DailyChartCard /></DataModeProvider>);
  expect(container.querySelector('[data-slot="empty"]')).toHaveTextContent('No consultations yet.');
  expect(container.querySelector('[data-slot="chart-frame"]')).toBeNull();
  expect(container.querySelector('svg')).toBeNull();
  expect(container.querySelector('[data-slot="chart-legend"]')).toBeNull();
});

test('seeded mode draws the chart with its legend', () => {
  window.history.replaceState(null, '', '/doctor?data=seeded');
  const { container } = render(<DataModeProvider><DailyChartCard /></DataModeProvider>);
  expect(container.querySelector('[data-slot="empty"]')).toBeNull();
  measure(container, 640);
  expect(container.querySelectorAll('rect')).toHaveLength(14);
  expect(container.querySelector('[data-slot="chart-legend"]')).toHaveTextContent('Today');
});
