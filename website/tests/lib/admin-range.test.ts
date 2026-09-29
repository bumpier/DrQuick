import { describe, expect, test } from 'vitest';
import { bucketKeys, bucketLabel, parseDay, parseRange, presetSpan, rangeQuery } from '@/lib/admin/range';

const NOW = new Date('2026-09-29T15:30:00Z');

describe('parseRange', () => {
  test('defaults to the last 30 days, today included, compared with the 30 before', () => {
    const r = parseRange({}, NOW);
    expect(r).toMatchObject({ fromDay: '2026-08-31', toDay: '2026-09-29', days: 30, preset: '30d', label: 'Last 30 days', bucket: 'day' });
    expect(r.from.toISOString()).toBe('2026-08-31T00:00:00.000Z');
    expect(r.to.toISOString()).toBe('2026-09-30T00:00:00.000Z'); // exclusive
    expect(r.prev).toMatchObject({ fromDay: '2026-08-01', toDay: '2026-08-30' });
    expect(r.prev.to.toISOString()).toBe(r.from.toISOString());
  });

  test('a custom span is read from ?from&to and labelled with its dates', () => {
    const r = parseRange({ from: '2026-09-01', to: '2026-09-10' }, NOW);
    expect(r).toMatchObject({ days: 10, preset: null, label: '1 Sept – 10 Sept 2026' });
    expect(r.prev).toMatchObject({ fromDay: '2026-08-22', toDay: '2026-08-31' });
  });

  test('a span matching a preset is named as the preset', () => {
    const s = presetSpan('7d', NOW);
    expect(parseRange(new URLSearchParams(rangeQuery(s)), NOW)).toMatchObject({ preset: '7d', label: 'Last 7 days', days: 7 });
    expect(parseRange(new URLSearchParams(rangeQuery(presetSpan('today', NOW))), NOW)).toMatchObject({ days: 1, label: 'Today' });
  });

  test('12 months runs by month and 90 days by day', () => {
    const year = parseRange(new URLSearchParams(rangeQuery(presetSpan('12m', NOW))), NOW);
    expect(year).toMatchObject({ fromDay: '2025-09-30', toDay: '2026-09-29', preset: '12m', bucket: 'month' });
    expect(bucketKeys(year)).toHaveLength(13);
    expect(bucketKeys(year)[0]).toBe('2025-09');
    expect(bucketKeys(year).at(-1)).toBe('2026-09');
    expect(parseRange(new URLSearchParams(rangeQuery(presetSpan('90d', NOW))), NOW).bucket).toBe('day');
  });

  test('reversed dates are swapped, rubbish falls back to the default', () => {
    expect(parseRange({ from: '2026-09-10', to: '2026-09-01' }, NOW)).toMatchObject({ fromDay: '2026-09-01', toDay: '2026-09-10' });
    expect(parseRange({ from: '2026-02-31', to: '2026-03-01' }, NOW).preset).toBe('30d');
    expect(parseRange({ from: "2026-01-01' or 1=1", to: '2026-02-01' }, NOW).preset).toBe('30d');
    expect(parseRange({ from: ['2026-09-01', 'x'], to: '2026-09-02' }, NOW).fromDay).toBe('2026-09-01');
  });

  test('a span longer than three years is cut to its last three', () => {
    const r = parseRange({ from: '2000-01-01', to: '2026-09-29' }, NOW);
    expect(r.days).toBe(366 * 3);
    expect(r.toDay).toBe('2026-09-29');
  });
});

test('parseDay refuses impossible dates', () => {
  expect(parseDay('2026-02-29')).toBeNull();
  expect(parseDay('2028-02-29')?.toISOString()).toBe('2028-02-29T00:00:00.000Z');
  expect(parseDay(undefined)).toBeNull();
});

test('bucket keys cover every day, and label readably', () => {
  const r = parseRange({ from: '2026-09-28', to: '2026-09-29' }, NOW);
  expect(bucketKeys(r)).toEqual(['2026-09-28', '2026-09-29']);
  expect(bucketLabel('2026-09-28')).toBe('28 Sept');
  expect(bucketLabel('2026-09')).toBe('Sept 26');
});
