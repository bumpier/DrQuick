import { test, expect, beforeAll, beforeEach, vi } from 'vitest';
import { resetDb, useTestDb } from './helpers/db';
import { setDb, type DB } from '@/lib/db';
import { appErrors, events, sessions, visitors } from '@/lib/db/schema';
import { POST } from '@/app/api/collect/route';
import { validateBatch } from '@/lib/analytics/ingest';

const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const VID = '11111111-1111-4111-8111-111111111111';
const SID = '22222222-2222-4222-8222-222222222222';
const SID2 = '33333333-3333-4333-8333-333333333333';

function req(body: unknown, { ua = CHROME, ip = '203.0.113.9', type = 'text/plain' } = {}) {
  const headers: Record<string, string> = { 'Content-Type': type, 'x-forwarded-for': ip };
  if (ua) headers['user-agent'] = ua;
  return new Request('http://localhost/api/collect', {
    method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const now = () => Date.now();
const pv = (path: string, props: Record<string, unknown> = {}, ts = now()) => ({ type: 'pageview', path, ts, props });

let db: DB;
beforeAll(async () => { db = await useTestDb(); });
beforeEach(async () => {
  vi.unstubAllEnvs();
  setDb(db);
  await resetDb(db);
});

test('a bot or an empty user-agent is answered 204 and stores nothing', async () => {
  const batch = { mode: 'cookieless', events: [pv('/')] };
  expect((await POST(req(batch, { ua: 'Mozilla/5.0 (compatible; Googlebot/2.1)' }))).status).toBe(204);
  expect((await POST(req(batch, { ua: 'HeadlessChrome/126.0.0.0' }))).status).toBe(204);
  expect((await POST(req(batch, { ua: '' }))).status).toBe(204);
  expect(await db.select().from(events)).toEqual([]);
});

test('cookieless: pageviews only, with no ids, and the coarse browser and OS added', async () => {
  const res = await POST(req({
    mode: 'cookieless',
    visitorId: VID, sessionId: SID, // ignored without consent
    events: [
      pv('/pricing?utm_source=x#top', { device: 'mobile', ref: 'www.google.com', utm_source: 'google' }),
      { type: 'click', path: '/pricing', ts: now(), props: { x: 10 } },
    ],
  }, { ua: IPHONE }));
  expect(res.status).toBe(204);
  expect(res.headers.get('Cache-Control')).toBe('no-store');
  const rows = await db.select().from(events);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    type: 'pageview', path: '/pricing', sessionId: null, visitorId: null,
    props: { device: 'mobile', ref: 'www.google.com', utm_source: 'google', browser: 'Safari', os: 'iOS' },
  });
  expect(await db.select().from(visitors)).toEqual([]);
  expect(await db.select().from(sessions)).toEqual([]);
});

test('identified: one batch creates the visitor, the session and the events', async () => {
  const t0 = now() - 5000;
  const res = await POST(req({
    mode: 'identified', visitorId: VID, sessionId: SID,
    events: [
      pv('/', { device: 'desktop', ref: 'news.example', referrer: 'https://news.example/story', utm_source: 'newsletter', utm_medium: 'email', utm_campaign: 'launch', vw: 1440, vh: 900, pv: 'abcd1234' }, t0),
      { type: 'scroll', path: '/', ts: t0 + 1000, props: { depth: 50, max: 55, pv: 'abcd1234' } },
      { type: 'section_view', path: '/', ts: t0 + 2000, props: { section: 'patient-hero', dwell_ms: 4200, pv: 'abcd1234' } },
      { type: 'engaged_time', path: '/', ts: t0 + 3000, props: { seconds: 12, max_scroll: 60, pv: 'abcd1234' } },
      pv('/pricing', { prev: '/', pv: 'efgh5678' }, t0 + 4000),
    ],
  }, { ua: CHROME }));
  expect(res.status).toBe(204);

  const [v] = await db.select().from(visitors);
  expect(v).toMatchObject({
    id: VID, firstPath: '/', firstReferrer: 'https://news.example/story',
    firstUtmSource: 'newsletter', firstUtmMedium: 'email', firstUtmCampaign: 'launch',
    device: 'desktop', browser: 'Chrome', os: 'macOS',
    sessions: 1, pageviews: 2, engagedSeconds: 12,
  });
  const [s] = await db.select().from(sessions);
  expect(s).toMatchObject({
    id: SID, visitorId: VID, entryPath: '/', exitPath: '/pricing', currentPath: '/pricing',
    pageviews: 2, engagedSeconds: 12, maxScroll: 60, referrer: 'https://news.example/story',
    utmSource: 'newsletter', device: 'desktop', browser: 'Chrome', os: 'macOS', viewportWidth: 1440,
  });
  const rows = await db.select().from(events);
  expect(rows.map((r) => r.type)).toEqual(['pageview', 'scroll', 'section_view', 'engaged_time', 'pageview']);
  expect(rows.every((r) => r.visitorId === VID && r.sessionId === SID)).toBe(true);
});

test('a later batch folds into the session; a new session counts once on the visitor', async () => {
  const t0 = now() - 60_000;
  await POST(req({ mode: 'identified', visitorId: VID, sessionId: SID, events: [pv('/', { referrer: 'https://a.example/' }, t0)] }));
  await POST(req({ mode: 'identified', visitorId: VID, sessionId: SID, events: [
    { type: 'engaged_time', path: '/', ts: t0 + 10_000, props: { seconds: 8, max_scroll: 90 } },
    pv('/about', {}, t0 + 20_000),
  ] }));
  let [v] = await db.select().from(visitors);
  const [s] = await db.select().from(sessions);
  expect(v).toMatchObject({ sessions: 1, pageviews: 2, engagedSeconds: 8, firstPath: '/', firstReferrer: 'https://a.example/' });
  expect(s).toMatchObject({ entryPath: '/', exitPath: '/about', pageviews: 2, engagedSeconds: 8, maxScroll: 90, referrer: 'https://a.example/' });
  expect(s.lastSeen.getTime()).toBe(t0 + 20_000);

  // A second visit: first-touch fields on the visitor never change.
  await POST(req({ mode: 'identified', visitorId: VID, sessionId: SID2, events: [pv('/pricing', { referrer: 'https://b.example/' }, t0 + 30_000)] }));
  [v] = await db.select().from(visitors);
  expect(v).toMatchObject({ sessions: 2, pageviews: 3, firstPath: '/', firstReferrer: 'https://a.example/' });
  expect(v.lastSeen.getTime()).toBe(t0 + 30_000);
  expect(await db.select().from(sessions)).toHaveLength(2);
});

test('validation: malformed JSON is 400, oversized is 413, bad ids and bad events store nothing', async () => {
  expect((await POST(req('{not json'))).status).toBe(400);
  expect((await POST(req({ mode: 'cookieless', events: [pv('/', { pad: 'x'.repeat(40_000) })] }))).status).toBe(413);
  expect((await POST(req({ mode: 'identified', visitorId: 'nope', sessionId: SID, events: [pv('/')] }))).status).toBe(204);
  expect((await POST(req({ mode: 'sneaky', events: [pv('/')] }))).status).toBe(204);
  expect((await POST(req({ mode: 'cookieless', events: Array.from({ length: 51 }, () => pv('/')) }))).status).toBe(204);
  expect((await POST(req({ mode: 'cookieless', events: [
    { type: 'drop_table', path: '/', ts: now(), props: {} },
    pv('no-leading-slash'),
    pv(`/${'a'.repeat(300)}`),
  ] }))).status).toBe(204);
  expect(await db.select().from(events)).toEqual([]);
});

test('application/json bodies are accepted too', async () => {
  await POST(req({ mode: 'cookieless', events: [pv('/')] }, { type: 'application/json' }));
  expect(await db.select().from(events)).toHaveLength(1);
});

test('props are flattened and capped, and timestamps are clamped into the last day', () => {
  const t = 1_800_000_000_000;
  const batch = validateBatch({
    mode: 'cookieless',
    events: [
      { type: 'pageview', path: '/', ts: t + 3_600_000, props: { ok: 'y', n: 3, b: true, z: null, nested: { a: 1 }, arr: [1], BadKey: 1, long: 'x'.repeat(500), inf: Infinity } },
      { type: 'pageview', path: '/old', ts: t - 3 * 86_400_000, props: 'nope' },
      { type: 'pageview', path: '/none', props: {} },
    ],
  }, t)!;
  expect(batch.events.map((e) => e.ts.getTime())).toEqual([t - 86_400_000, t, t]);
  const first = batch.events.find((e) => e.path === '/')!;
  expect(first.props).toEqual({ ok: 'y', n: 3, b: true, z: null, long: 'x'.repeat(200) });
  expect(batch.events.find((e) => e.path === '/old')!.props).toEqual({});
});

test('more than 120 beacons in ten minutes from one address are dropped', async () => {
  const batch = { mode: 'cookieless', events: [pv('/')] };
  for (let i = 0; i < 121; i++) expect((await POST(req(batch, { ip: '198.51.100.7' }))).status).toBe(204);
  expect(await db.select().from(events)).toHaveLength(120);
  await POST(req(batch, { ip: '198.51.100.8' })); // a different client is unaffected
  expect(await db.select().from(events)).toHaveLength(121);
});

test('no database: a quiet 204', async () => {
  setDb(null);
  expect((await POST(req({ mode: 'cookieless', events: [pv('/')] }))).status).toBe(204);
});

test('a failed write is logged to app_errors, briefly, and still answers 204', async () => {
  // Validation stops anything that would fail the write, so break it directly.
  const broken = new Proxy(db, {
    get(target, prop, receiver) {
      if (prop === 'transaction') return async () => { throw new Error('disk full '.repeat(50)); };
      return Reflect.get(target, prop, receiver);
    },
  }) as DB;
  setDb(broken);
  const res = await POST(req({ mode: 'identified', visitorId: VID, sessionId: SID, events: [pv('/')] }));
  expect(res.status).toBe(204);
  const [err] = await db.select().from(appErrors);
  expect(err.route).toBe('/api/collect');
  expect(err.message.length).toBeLessThanOrEqual(200);
});
