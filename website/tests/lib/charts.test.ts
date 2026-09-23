import { test } from 'vitest';
import assert from 'node:assert/strict';
import { barGeometry, linePoints, toPath, labelStride, svgLines, svgBars, type BarDatum } from '@/lib/charts';

test('bars fill the box and never overflow it', () => {
  const bars = barGeometry([1, 2, 4], { width: 100, height: 50, gap: 5 });
  assert.equal(bars.length, 3);
  assert.equal(bars[2].h, 50, 'the tallest bar must reach the top of the box');
  for (const bar of bars) {
    assert.ok(bar.y >= 0, 'a bar starts above the top of its own box');
    assert.ok(bar.y + bar.h <= 50.001, 'a bar overflows the bottom of its box');
    assert.ok(bar.x + bar.w <= 100.001, 'a bar overflows the right of its box');
  }
});

// An empty day and a missing day mean different things, and at 0px high they
// look identical. The stub is what keeps them distinguishable.
test('a zero-value bar still draws a visible stub', () => {
  const [zero] = barGeometry([0, 10], { width: 100, height: 50, gap: 0 });
  assert.equal(zero.h, 1);
});

test('bar geometry survives an all-zero series without dividing by zero', () => {
  const bars = barGeometry([0, 0], { width: 100, height: 50, gap: 0 });
  for (const bar of bars) assert.ok(Number.isFinite(bar.h));
});

test('barGeometry returns nothing for an empty series', () => {
  assert.deepEqual(barGeometry([], { width: 100, height: 50 }), []);
});

// Two series on one pair of axes must share a ceiling. Scaled to their own
// peaks, a series of 2s and a series of 200s draw the identical line.
test('two line series share a ceiling when one is given', () => {
  const small = linePoints([1, 2], { width: 10, height: 10, max: 10 });
  const large = linePoints([5, 10], { width: 10, height: 10, max: 10 });
  assert.notEqual(small[1].y, large[1].y);
  assert.equal(large[1].y, 0, 'a value at the shared ceiling must touch the top');
});

test('a single-point line does not divide by zero', () => {
  const [only] = linePoints([4], { width: 100, height: 50 });
  assert.equal(only.x, 0);
  assert.ok(Number.isFinite(only.y));
});

test('toPath moves once and then draws', () => {
  assert.equal(toPath([{ x: 0, y: 1, value: 0 }, { x: 2, y: 3, value: 0 }]), 'M0.0 1.0 L2.0 3.0');
  assert.equal(toPath([]), '');
});

test('a narrow chart labels fewer ticks than a wide one', () => {
  assert.equal(labelStride(14, 640), 1);
  assert.equal(labelStride(14, 300), 2);
  assert.equal(labelStride(1, 20), 1, 'a single label must never be dropped entirely');
});

// Both ends of an axis carry meaning, so both are always printed — but a tick
// one step short of the end overlaps it at phone width.
test('a line axis labels both ends without colliding at the far end', () => {
  const labels = Array.from({ length: 16 }, (_, i) => String(i));
  const svg = svgLines([{ key: 'first', values: labels.map(Number) }], labels, { width: 300 });
  const printed = [...svg.matchAll(/<text[^>]*>(\d+)<\/text>/g)].map((m) => Number(m[1]));
  assert.equal(printed[0], 0, 'the first tick is missing');
  assert.equal(printed.at(-1), 15, 'the last tick is missing');
  assert.ok(!printed.includes(14), 'a tick is printed right on top of the last one');
});

// New: svgBars had no test of its own — one rect per datum, the emphasised
// datum flagged in the markup, and a title carrying the label and value.
test('svgBars draws one rect per datum, marks the emphasised one, and titles each with its value', () => {
  const series: BarDatum[] = [
    { label: 'Mon', value: 4 },
    { label: 'Tue', value: 9, emph: 'true' },
    { label: 'Wed', value: 2 },
  ];
  const svg = svgBars(series, { width: 300, height: 100, format: (v) => `${v} calls` });
  const rects = [...svg.matchAll(/<rect\b[^>]*>[\s\S]*?<\/rect>/g)].map((m) => m[0]);
  assert.equal(rects.length, series.length, 'one rect per datum');
  const emphFlags = rects.map((r) => /data-emph="(true|false)"/.exec(r)?.[1]);
  assert.deepEqual(emphFlags, ['false', 'true', 'false']);
  rects.forEach((r, i) => {
    assert.match(r, new RegExp(`<title>${series[i].label}: ${series[i].value} calls</title>`));
  });
});
