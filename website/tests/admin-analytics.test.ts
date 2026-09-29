import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { resetDb, useTestDb } from './helpers/db';
import { setDb, type DB } from '@/lib/db';
import { events, sessions, visitors, waitlistSignups } from '@/lib/db/schema';
import { newToken } from '@/lib/waitlist';
import { parseRange } from '@/lib/admin/range';
import { campaigns, devices, entryPages, referrers, topPages, trafficKpis } from '@/lib/admin/queries/traffic';
import { scrollReach, sectionReadThrough, timeOnPage } from '@/lib/admin/queries/engagement';
import { funnel, gpFieldErrors, gpLastField, parseSegment } from '@/lib/admin/queries/funnels';
import { deepestScrolls, heatmapClicks, topElements } from '@/lib/admin/queries/heatmaps';
import { listVisitors, liveNow, parseVisitorQuery } from '@/lib/admin/queries/visitors';
import { plotClicks, rampColour, reachBands, RAMP_HEX } from '@/lib/admin/heatmap';
import { PATIENT_SECTIONS } from '@/lib/analytics/sections';

let db: DB;
beforeAll(async () => { db = await useTestDb(); });
beforeEach(async () => { setDb(db); await resetDb(db); });

const NOW = new Date('2026-09-29T12:00:00Z');
const range = () => parseRange({ from: '2026-09-23', to: '2026-09-29' }, NOW); // prev: 16–22 Sept
const at = (iso: string) => new Date(iso);
const T = '2026-09-25T10:00:00Z';

let seq = 0;
const uuid = (prefix: number) => {
  seq += 1;
  return `${String(prefix).padStart(8, '0')}-0000-4000-8000-${String(seq).padStart(12, '0')}`;
};

async function visitor(id: string, extra: Partial<typeof visitors.$inferInsert> = {}) {
  await db.insert(visitors).values({ id, firstSeen: at(T), lastSeen: at(T), ...extra });
}

async function session(visitorId: string | null, extra: Partial<typeof sessions.$inferInsert> = {}) {
  const id = uuid(1);
  await db.insert(sessions).values({
    id, visitorId, startedAt: at(T), lastSeen: at(T), entryPath: '/', exitPath: '/', currentPath: '/',
    device: 'mobile', browser: 'Safari', os: 'iOS', ...extra,
  });
  return id;
}

type Ev = { type: string; path?: string; ts?: string; props?: Record<string, unknown> };
// Events of one consented page view (all share its pv).
async function view(sessionId: string, visitorId: string, pv: string, evs: Ev[], base: { path?: string; ts?: string } = {}) {
  await db.insert(events).values(evs.map((e, i) => ({
    sessionId, visitorId, type: e.type, path: e.path ?? base.path ?? '/',
    ts: at(e.ts ?? new Date(at(base.ts ?? T).getTime() + i * 1000).toISOString()),
    props: { pv, ...e.props },
  })));
}
async function cookieless(path: string, props: Record<string, unknown> = {}, ts = T) {
  await db.insert(events).values({ type: 'pageview', path, ts: at(ts), props: { device: 'mobile', ref: null, ...props } });
}

const V1 = '11111111-1111-4111-8111-111111111111';
const V2 = '22222222-2222-4222-8222-222222222222';

describe('traffic', () => {
  test('zero data: zeros and nulls, nothing throws', async () => {
    const k = await trafficKpis(db, range());
    expect(k).toEqual({ visitors: 0, visits: 0, pageviews: 0, sessions: 0, bounceRate: null, avgEngaged: null, identifiedShare: null });
    expect(await topPages(db, range())).toEqual([]);
  });

  test('KPIs: after_consent re-counts are excluded, bounce is one page and under 10s', async () => {
    const s1 = await session(V1, { pageviews: 1, engagedSeconds: 4, referrer: 'https://www.google.com/search' }); // bounce
    const s2 = await session(V1, { pageviews: 3, engagedSeconds: 40, utmSource: 'newsletter', utmMedium: 'email' });
    await session(V2, { pageviews: 1, engagedSeconds: 30 });                            // one page but engaged: not a bounce
    await session(V2, { startedAt: at('2026-09-20T10:00:00Z') });                       // previous period
    await view(s1, V1, 'aaaa0001', [{ type: 'pageview' }]);
    await view(s2, V1, 'aaaa0002', [{ type: 'pageview' }, { type: 'engaged_time', props: { seconds: 40 } }]);
    await view(s2, V1, 'aaaa0003', [{ type: 'pageview', props: { after_consent: true } }]); // excluded from totals
    await view(s2, V1, 'aaaa0004', [{ type: 'pageview', path: '/pricing' }]);
    await cookieless('/', { ref: 'bing.com' });
    await cookieless('/pricing', { utm_source: 'newsletter', device: 'desktop' });

    const k = await trafficKpis(db, range());
    expect(k.pageviews).toBe(5);
    expect(k.sessions).toBe(3);
    expect(k.visits).toBe(5);
    expect(k.visitors).toBe(4); // V1, V2, two cookieless views
    expect(k.bounceRate).toBeCloseTo(1 / 3);
    expect(k.avgEngaged).toBeCloseTo((4 + 40 + 30) / 3);
    expect(k.identifiedShare).toBeCloseTo(3 / 5);

    const pages = await topPages(db, range());
    expect(pages.map((p) => [p.path, p.views, p.visitors])).toEqual([['/', 3, 2], ['/pricing', 2, 2]]);
    // 40 engaged seconds over the three consented views of '/' (the re-count included, it carries engagement).
    expect(pages[0].avgEngaged).toBeCloseTo(40 / 3);

    const refs = await referrers(db, range());
    expect(refs).toEqual(expect.arrayContaining([
      { key: 'Direct', value: 3 }, { key: 'google.com', value: 1 }, { key: 'bing.com', value: 1 },
    ]));
    expect(await campaigns(db, range())).toEqual(expect.arrayContaining([
      { source: 'newsletter', medium: 'email', campaign: null, visits: 1 },
      { source: 'newsletter', medium: null, campaign: null, visits: 1 },
    ]));
    expect(await devices(db, range())).toEqual([{ key: 'mobile', value: 4 }, { key: 'desktop', value: 1 }]);
    const entries = await entryPages(db, range());
    expect(entries).toEqual([{ path: '/', sessions: 3, bounceRate: 1 / 3 }]);
  });
});

describe('engagement', () => {
  const f = { path: '/', role: 'patient' as const };

  test('section read-through sums repeat rows per view, keeps reading order and measures drop-off', async () => {
    const s = await session(V1);
    // Four patient views; one GP view that must be ignored.
    await view(s, V1, 'p1', [
      { type: 'pageview', props: { role: 'patient' } },
      { type: 'section_view', props: { section: 'patient-hero', dwell_ms: 3000 } },
      { type: 'section_view', props: { section: 'patient-urgent', dwell_ms: 600 } },
      { type: 'section_view', props: { section: 'patient-hero', dwell_ms: 1000 } }, // same section again: summed
      { type: 'scroll', props: { depth: 50, max: 55 } },
      { type: 'engaged_time', props: { seconds: 20, max_scroll: 60 } },
    ]);
    await view(s, V1, 'p2', [
      { type: 'pageview', props: { role: 'patient' } },
      { type: 'section_view', props: { section: 'patient-hero', dwell_ms: 2000 } },
      { type: 'scroll', props: { depth: 25, max: 30 } },
      { type: 'engaged_time', props: { seconds: 5 } },
      { type: 'engaged_time', props: { seconds: 70 } },
    ]);
    await view(s, V1, 'p3', [{ type: 'pageview', props: { role: 'patient' } }]);
    await view(s, V1, 'p4', [
      { type: 'pageview', props: { role: 'patient' } },
      { type: 'section_view', props: { section: 'patient-hero', dwell_ms: 1000 } },
      { type: 'section_view', props: { section: 'patient-urgent', dwell_ms: 900 } },
      { type: 'scroll', props: { depth: 100, max: 100 } },
      { type: 'engaged_time', props: { seconds: 400, max_scroll: 100 } },
    ]);
    await view(s, V1, 'g1', [
      { type: 'pageview', props: { role: 'gp' } },
      { type: 'section_view', props: { section: 'patient-hero', dwell_ms: 5000 } },
    ]);

    const r = await sectionReadThrough(db, f, range(), PATIENT_SECTIONS);
    expect(r.total).toBe(4);
    expect(r.sections.map((x) => x.section)).toEqual([...PATIENT_SECTIONS]);
    const [hero, urgent, how] = r.sections;
    expect(hero).toMatchObject({ views: 3, share: 0.75, dropOff: null });
    expect(hero.avgDwellMs).toBeCloseTo((4000 + 2000 + 1000) / 3);
    expect(urgent).toMatchObject({ views: 2, share: 0.5 });
    expect(urgent.dropOff).toBeCloseTo(1 / 3);
    expect(how).toMatchObject({ views: 0, share: 0, dropOff: 1, avgDwellMs: null });

    const sc = await scrollReach(db, f, range());
    expect(sc.total).toBe(4);
    expect(sc.reach.map((x) => x.views)).toEqual([3, 2, 1, 1, 1]); // deepest: 60, 30, 0, 100
    expect(sc.reach[0].share).toBe(0.75);

    const t = await timeOnPage(db, f, range());
    expect(t.total).toBe(4);
    // 20s, 75s, 0s, 400s
    expect(t.bins.map((b) => b.views)).toEqual([1, 1, 0, 1, 1]);
    expect(t.avgSeconds).toBeCloseTo(495 / 4);
  });
});

describe('funnels', () => {
  test('counts distinct views, nested, with implied steps, and filters by segment', async () => {
    const mobile = await session(V1, { device: 'mobile' });
    const desk = await session(V2, { device: 'desktop', utmSource: 'gp-mag' });
    const pv = (device: string, role = 'patient') => ({ type: 'pageview', props: { role, device } });
    const form = (type: string, role = 'patient', extra: Record<string, unknown> = {}) => ({ type, props: { form: role === 'gp' ? 'hero-gp' : 'hero', role, ...extra } });

    await view(mobile, V1, 'a', [pv('mobile'), form('form_view'), form('form_start'), form('form_submit'), form('form_success')]);
    await view(mobile, V1, 'a', [form('form_view')]); // a repeat event in the same view counts once
    await view(mobile, V1, 'b', [pv('mobile'), form('form_view')]);
    await view(mobile, V1, 'c', [pv('mobile'), form('form_submit')]); // submit implies seen and started
    await view(desk, V2, 'd', [pv('desktop')]);
    await view(desk, V2, 'e', [pv('desktop', 'gp'), { type: 'section_view', props: { section: 'gp-pay', dwell_ms: 800 } },
      form('form_view', 'gp'), form('form_start', 'gp'), form('field_focus', 'gp', { field: 'name' }),
      form('field_focus', 'gp', { field: 'gmc' }), form('field_error', 'gp', { field: 'gmc', error: 'invalid_gmc' })]);
    await view(desk, V2, 'f', [pv('desktop', 'gp'), form('form_view', 'gp'), form('form_start', 'gp'), form('field_focus', 'gp', { field: 'email' }),
      form('form_submit', 'gp'), form('form_success', 'gp')]);
    await view(desk, V2, 'g', [pv('desktop', 'gp'), form('form_start', 'gp')]); // started, never focused a field

    const all = parseSegment({});
    const p = await funnel(db, 'patient', range(), all);
    expect(p.steps.map((s) => s.value)).toEqual([4, 3, 2, 2, 1]);

    const g = await funnel(db, 'gp', range(), all);
    expect(g.steps.map((s) => s.value)).toEqual([3, 3, 3, 1, 1]);
    const withPay = await funnel(db, 'gp', range(), all, true);
    expect(withPay.steps.map((s) => s.value)).toEqual([3, 1, 1, 1, 0, 0]);

    expect((await funnel(db, 'patient', range(), parseSegment({ device: 'desktop' }))).steps[0].value).toBe(1);
    expect((await funnel(db, 'gp', range(), parseSegment({ source: 'gp-mag' }))).steps[0].value).toBe(3);
    expect((await funnel(db, 'patient', range(), parseSegment({ source: 'direct' }))).steps[0].value).toBe(3);
    expect(parseSegment({ device: 'fridge' }).device).toBeNull();

    const last = await gpLastField(db, range(), all);
    expect(last.abandoned).toBe(2);
    expect(last.fields).toEqual([{ field: 'gmc', views: 1 }, { field: null, views: 1 }]);
    expect(await gpFieldErrors(db, range(), all)).toEqual([{ field: 'gmc', error: 'invalid_gmc', count: 1 }]);
    expect((await gpLastField(db, range(), parseSegment({ device: 'mobile' }))).abandoned).toBe(0);
  });
});

describe('heatmaps', () => {
  test('clicks are filtered by viewport bucket and page, and plotted with y rescaled', async () => {
    const s = await session(V1);
    await view(s, V1, 'h1', [
      { type: 'pageview', props: { role: 'patient', device: 'desktop' } },
      { type: 'click', props: { x: 50, y: 1000, h: 4000, vp: 'desktop', sel: 'a#nav-cta', text: 'Join' } },
      { type: 'click', props: { x: 10, y: 200, h: 4000, vp: 'desktop', sel: 'a#nav-cta', text: 'Join' } },
      { type: 'click', props: { x: 20, y: 300, h: 4000, vp: 'mobile', sel: 'button', text: 'Menu' } },
      { type: 'click', path: '/pricing', props: { x: 20, y: 300, h: 4000, vp: 'desktop', sel: 'p', text: '' } },
      { type: 'scroll', props: { depth: 75, max: 80 } },
    ]);
    await view(s, V1, 'h2', [
      { type: 'pageview', props: { role: 'gp', device: 'desktop' } },
      { type: 'click', props: { x: 90, y: 50, h: 4000, vp: 'desktop', sel: 'a.gp', text: 'GP' } },
    ]);
    const f = { path: '/', device: 'desktop' as const, role: null };
    const clicks = await heatmapClicks(db, f, range());
    expect(clicks).toHaveLength(3);
    expect(await heatmapClicks(db, { ...f, role: 'patient' }, range())).toHaveLength(2);
    expect(await heatmapClicks(db, { ...f, device: 'mobile' }, range())).toEqual([{ x: 20, y: 300, h: 4000 }]);

    const pts = plotClicks([{ x: 50, y: 1000, h: 4000 }, { x: 100, y: 5000, h: 4000 }], 1280, 2000);
    expect(pts).toEqual([{ px: 640, py: 500 }]); // halved, and the one beyond the page dropped
    expect(plotClicks([{ x: 25, y: 100, h: 0 }], 400, 1000)).toEqual([{ px: 100, py: 100 }]);

    const top = await topElements(db, { ...f, role: 'patient' }, range());
    expect(top.total).toBe(2);
    expect(top.rows).toEqual([{ sel: 'a#nav-cta', text: 'Join', clicks: 2, share: 1 }]);

    expect(await deepestScrolls(db, f, range())).toEqual(expect.arrayContaining([80, 0]));
  });

  test('scroll bands and the colour ramp', () => {
    const bands = reachBands([0, 50, 100, 100]);
    expect(bands).toHaveLength(20);
    expect(bands[0]).toBe(1);
    expect(bands[10]).toBe(0.75);   // 50% band: three of four
    expect(bands[19]).toBe(0.5);
    expect(rampColour(0)).toEqual([0xe2, 0xf6, 0xd5]);
    expect(rampColour(1)).toEqual([0x16, 0x33, 0x00]);
    expect(RAMP_HEX).toHaveLength(4);
  });
});

describe('visitors and live', () => {
  test('lists visitors with their sign-up, searches by email and filters on signed up', async () => {
    await visitor(V1, { lastSeen: at('2026-09-28T10:00:00Z'), sessions: 3, pageviews: 7, engagedSeconds: 120, device: 'desktop' });
    await visitor(V2, { lastSeen: at('2026-09-27T10:00:00Z'), sessions: 1 });
    await db.insert(waitlistSignups).values({
      role: 'gp', email: 'dr.who@example.com', source: 'hero-gp', status: 'new', unsubscribeToken: newToken(), visitorId: V1,
    });
    const all = await listVisitors(db, parseVisitorQuery({}));
    expect(all.total).toBe(2);
    expect(all.rows[0]).toMatchObject({ id: V1, sessions: 3, signup: { email: 'dr.who@example.com', role: 'gp' } });
    expect(all.rows[1].signup).toBeNull();

    expect((await listVisitors(db, parseVisitorQuery({ q: 'who' }))).rows.map((r) => r.id)).toEqual([V1]);
    expect((await listVisitors(db, parseVisitorQuery({ q: '%' }))).total).toBe(0);
    expect((await listVisitors(db, parseVisitorQuery({ signed: 'no' }))).rows.map((r) => r.id)).toEqual([V2]);
    expect((await listVisitors(db, parseVisitorQuery({ sort: 'sessions', dir: 'asc' }))).rows.map((r) => r.id)).toEqual([V2, V1]);
    expect(parseVisitorQuery({ sort: 'drop table' }).sort).toBe('last');
  });

  test('live: sessions seen in the last five minutes and recent cookieless views', async () => {
    await session(V1, { lastSeen: at('2026-09-29T11:57:00Z'), currentPath: '/pricing' });
    await session(V2, { lastSeen: at('2026-09-29T11:50:00Z') });
    await cookieless('/', {}, '2026-09-29T11:58:00Z');
    await cookieless('/', {}, '2026-09-29T11:40:00Z');
    const live = await liveNow(db, NOW);
    expect(live.total).toBe(1);
    expect(live.sessions[0]).toMatchObject({ visitorId: V1, currentPath: '/pricing' });
    expect(live.cookieless).toBe(1);
  });
});
