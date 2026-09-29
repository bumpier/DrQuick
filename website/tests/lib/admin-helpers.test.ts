import { describe, expect, test } from 'vitest';
import { gbp } from '@/lib/money';
import { binCounts, columnGeometry, columnPath, funnelRows, nearestIndex, niceCeiling } from '@/lib/admin/charts';
import { delta, firstTouchChannel, hostOf } from '@/lib/admin/format';
import { withQuery } from '@/lib/admin/url';
import { activeHref, ADMIN_NAV } from '@/components/admin/nav';

describe('gbp', () => {
  test('formats pence as pounds, en-GB', () => {
    expect(gbp(0)).toBe('£0.00');
    expect(gbp(3200)).toBe('£32.00');
    expect(gbp(123456)).toBe('£1,234.56');
    expect(gbp(-450)).toBe('-£4.50');
  });
  test('treats missing values as zero', () => {
    expect(gbp(null)).toBe('£0.00');
    expect(gbp(undefined)).toBe('£0.00');
    expect(gbp(Number.NaN)).toBe('£0.00');
  });
});

describe('chart geometry', () => {
  test('niceCeiling rounds up to a speakable number', () => {
    expect(niceCeiling(0)).toBe(1);
    expect(niceCeiling(3)).toBe(5);
    expect(niceCeiling(7)).toBe(10);
    expect(niceCeiling(120)).toBe(200);
    expect(niceCeiling(240)).toBe(250);
  });
  test('columns stay inside the box, at most 24px wide, zero as a 1px stub', () => {
    const cols = columnGeometry([0, 5, 10], { width: 300, height: 100, max: 10 });
    expect(cols.map((c) => c.w)).toEqual([24, 24, 24]);
    expect(cols[0].h).toBe(1);
    expect(cols[2]).toMatchObject({ y: 0, h: 100 });
    for (const c of cols) expect(c.x + c.w).toBeLessThanOrEqual(300);
    expect(columnPath(cols[2])).toMatch(/^M.*Z$/);
  });
  test('funnel rows carry share, step conversion and drop-off', () => {
    const rows = funnelRows([{ label: 'Seen', value: 200 }, { label: 'Started', value: 50 }, { label: 'Joined', value: 25 }]);
    expect(rows.map((r) => r.share)).toEqual([1, 0.25, 0.125]);
    expect(rows.map((r) => r.fromPrevious)).toEqual([null, 0.25, 0.5]);
    expect(rows[1].dropOff).toBe(0.75);
    expect(funnelRows([{ label: 'a', value: 0 }, { label: 'b', value: 0 }])[1]).toMatchObject({ share: 0, fromPrevious: 0 });
  });
  test('bins include the top edge in the last bin only', () => {
    expect(binCounts([0, 24, 25, 99, 100, 101], [0, 25, 50, 75, 100])).toEqual([2, 1, 0, 2]);
  });
  test('nearestIndex snaps to the closest point', () => {
    expect(nearestIndex(0, 100, 5)).toBe(0);
    expect(nearestIndex(60, 100, 5)).toBe(2);
    expect(nearestIndex(999, 100, 5)).toBe(4);
  });
});

describe('format helpers', () => {
  test('first touch: UTM source, else referring host, else Direct', () => {
    expect(firstTouchChannel({ utmSource: 'newsletter', referrer: 'https://google.com/' })).toBe('newsletter');
    expect(firstTouchChannel({ utmSource: null, referrer: 'https://www.google.co.uk/search?q=gp' })).toBe('google.co.uk');
    expect(firstTouchChannel({ utmSource: null, referrer: null })).toBe('Direct');
    expect(firstTouchChannel({ utmSource: null, referrer: 'https://drquick.co.uk/about' }, 'www.drquick.co.uk')).toBe('Direct');
    expect(hostOf('not a url at all')).toBeNull();
  });
  test('delta is null when there is nothing to compare', () => {
    expect(delta(5, 0)).toBeNull();
    expect(delta(15, 10)).toBeCloseTo(0.5);
  });
  test('withQuery sets, replaces and drops keys', () => {
    expect(withQuery('/x', { a: '1', b: '2' }, { b: null, c: '3' })).toBe('/x?a=1&c=3');
    expect(withQuery('/x', {}, {})).toBe('/x');
  });
});

describe('admin nav', () => {
  test('has every section, in its group', () => {
    expect(ADMIN_NAV.map((g) => g.label)).toEqual(['Home', 'Waitlist', 'Analytics', 'Finance', 'Content', 'System']);
    expect(ADMIN_NAV.flatMap((g) => g.items).map((i) => i.href)).toEqual([
      '/admin', '/admin/waitlist/patients', '/admin/waitlist/gps',
      '/admin/analytics/traffic', '/admin/analytics/engagement', '/admin/analytics/funnels',
      '/admin/analytics/heatmaps', '/admin/analytics/visitors', '/admin/analytics/live',
      '/admin/finance/revenue', '/admin/finance/consultations', '/admin/finance/payouts',
      '/admin/blog', '/admin/system/technical', '/admin/system/emails', '/admin/system/audit', '/admin/system/settings',
    ]);
  });
  test('lights the section a path belongs to', () => {
    expect(activeHref('/admin')).toBe('/admin');
    expect(activeHref('/admin/')).toBe('/admin');
    expect(activeHref('/admin/waitlist/gps/0b6c')).toBe('/admin/waitlist/gps');
    expect(activeHref('/admin/blog/new')).toBe('/admin/blog');
    expect(activeHref('/admin/waitlist')).toBeNull();
  });
});
