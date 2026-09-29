// Fills a LOCAL database with ~60 days of synthetic analytics, so the admin's
// Traffic, Engagement, Funnels, Heatmaps, Visitors and Live pages have
// something to show in development. `npm run db:seed:analytics`.
//
//   node scripts/seed-analytics.mjs [--visitors 400] [--days 60] [--seed 7] [--force]
//
// Safety: refuses when NODE_ENV=production, and when DATABASE_URL's host is not
// localhost / 127.0.0.1 / ::1, unless --force. DATABASE_URL is read like
// scripts/migrate.mjs does (environment, then .env.production, .env.local, .env).
//
// Everything it writes is recognisable and is replaced on every run:
//   visitors and sessions  ids beginning dddddddd-
//   events                 props.demo = true
//   waitlist_signups       source 'demo', emails demo+N@example.com
//
// Layouts: click positions and section offsets come from the real pages,
// measured at 1440 and 390 wide (scripts/seed-analytics.layouts.json), so the
// heatmaps land on the actual buttons and fields.
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';

const root = path.resolve(import.meta.dirname, '..');

// The same lookup as scripts/migrate.mjs (which runs on import, so it is not imported).
function fromEnvFiles(name) {
  for (const file of ['.env.production', '.env.local', '.env']) {
    const full = path.join(root, file);
    if (!existsSync(full)) continue;
    for (const line of readFileSync(full, 'utf8').split('\n')) {
      const m = line.match(new RegExp(`^\\s*${name}\\s*=\\s*(.*?)\\s*$`));
      if (m && m[1]) return m[1].replace(/^["']|["']$/g, '');
    }
  }
  return '';
}
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : fallback;
};

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed demo analytics with NODE_ENV=production.');
  process.exit(1);
}
const url = process.env.DATABASE_URL || fromEnvFiles('DATABASE_URL');
if (!url) {
  console.error('DATABASE_URL is not set. Start a local Postgres (see docs/postgres-vps.md) and pass DATABASE_URL.');
  process.exit(1);
}
const host = (() => { try { return new URL(url).hostname; } catch { return ''; } })();
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host) && !flag('force')) {
  console.error(`Refusing to seed ${host || 'an unknown host'}: only localhost databases, unless --force.`);
  process.exit(1);
}

const VISITORS = opt('visitors', 400);
const DAYS = opt('days', 60);
const LAYOUTS = JSON.parse(readFileSync(path.join(import.meta.dirname, 'seed-analytics.layouts.json'), 'utf8'));

/* ------------------------------------------------------------ randomness */
let state = opt('seed', 7) >>> 0;
const rand = () => {           // mulberry32: repeatable runs
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const chance = (p) => rand() < p;
const between = (a, b) => a + rand() * (b - a);
const int = (a, b) => Math.floor(between(a, b + 1));
const pick = (list) => list[Math.floor(rand() * list.length)];
const weighted = (pairs) => {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of pairs) { if ((r -= w) <= 0) return v; }
  return pairs[pairs.length - 1][0];
};
const hex = (n) => Array.from({ length: n }, () => '0123456789abcdef'[int(0, 15)]).join('');
const demoId = () => `dddddddd-${hex(4)}-4${hex(3)}-8${hex(3)}-${hex(12)}`;
const pvId = () => hex(8);

/* ------------------------------------------------------------ the world */
const NOW = Date.now();
const DAY = 86_400_000;

const DEVICES = [['mobile', 60], ['desktop', 32], ['tablet', 8]];
const UA = {
  mobile: [[['Safari', 'iOS'], 55], [['Chrome', 'Android'], 40], [['Samsung Internet', 'Android'], 5]],
  tablet: [[['Safari', 'iPadOS'], 70], [['Chrome', 'Android'], 30]],
  desktop: [[['Chrome', 'Windows'], 38], [['Chrome', 'macOS'], 22], [['Safari', 'macOS'], 18], [['Edge', 'Windows'], 14], [['Firefox', 'Windows'], 8]],
};
const VIEWPORT = { mobile: [390, 844], tablet: [820, 1180], desktop: [1440, 900] };
// Where a visit came from: [referrer URL | null, utm source, medium, campaign, share of GP mode on '/'].
const SOURCES = [
  [[null, null, null, null, 0.3], 44],
  [['https://www.google.com/', null, null, null, 0.2], 20],
  [['https://l.facebook.com/', null, null, null, 0.1], 7],
  [['https://www.reddit.com/r/unitedkingdom/', null, null, null, 0.15], 4],
  [['https://www.bing.com/', null, null, null, 0.2], 3],
  [[null, 'newsletter', 'email', 'autumn-launch', 0.1], 8],
  [[null, 'instagram', 'social', 'launch', 0.1], 8],
  [[null, 'gp-mag', 'print', 'gp-recruit', 0.9], 7],
  [['https://www.linkedin.com/', 'linkedin', 'social', 'gp-recruit', 0.8], 2],
];
const PAGES = ['/', '/pricing', '/how-it-works', '/blog'];
const ENTRY = [['/', 72], ['/pricing', 10], ['/how-it-works', 10], ['/blog', 8]];

// How likely a reader who reached a section goes on to the next one.
const CONTINUE = { patient: [0.9, 0.92, 0.82, 0.78, 0.7, 0.72], gp: [0.85, 0.8, 0.82, 0.7, 0.72] };
// Typical dwell per section, seconds [min, max].
const DWELL = {
  'patient-hero': [3, 20], 'patient-urgent': [1, 4], 'patient-how-it-works': [4, 25], 'patient-covers': [4, 30],
  'patient-price': [5, 35], 'patient-faq': [4, 60], 'patient-closing': [2, 15],
  'gp-hero': [4, 25], 'gp-shift': [5, 35], 'gp-scope': [5, 30], 'gp-pay': [6, 45], 'gp-faq': [5, 70], 'gp-closing': [2, 20],
};
const CLICK_WEIGHT = { cta: 9, field: 8, button: 7, faq: 3, link: 1.2, tel: 0.8 };

function layoutFor(page, device, role) {
  const key = `${device === 'mobile' ? 'mobile' : 'desktop'}${page === '/' && role === 'gp' ? '/?role=gp' : page}`;
  return LAYOUTS[key];
}

/* ------------------------------------------------------------ one view */
let signupN = 0;
const out = { visitors: [], sessions: [], events: [], signups: [] };
const ev = (s, type, pageTs, path, props) => out.events.push({
  session_id: s?.id ?? null, visitor_id: s?.visitor_id ?? null, type, path, ts: new Date(pageTs), props: { ...props, demo: true },
});

// Simulates one consented page view; returns { endTs, deepest, engaged, signedUp }.
function simulateView(s, visitor, path, ts, device, role, first, prev, src, glance = false) {
  const L = layoutFor(path, device, role);
  const pv = pvId();
  const [vw, vh] = VIEWPORT[device];
  const base = { pv };
  const pageview = { pv, device, ref: first && src[0] ? new URL(src[0]).host : null, referrer: first ? src[0] : null,
    utm_medium: src[2], utm_campaign: src[3], vw, vh, prev };
  if (src[1]) pageview.utm_source = src[1];
  if (path === '/') pageview.role = role;
  ev(s, 'pageview', ts, path, pageview);

  let t = ts + int(300, 1500);
  let engaged = 0;
  let deepestPx = vh;
  const reached = [];

  if (L.sections.length) {
    const cont = CONTINUE[role];
    for (let i = 0; i < L.sections.length; i += 1) {
      if (i > 0 && (glance || !chance(cont[i - 1] ?? 0.7))) break;
      const [name, top, h] = L.sections[i];
      const [lo, hi] = glance ? [1, 5] : DWELL[name] ?? [2, 15];
      const dwell = Math.round(between(lo, hi) * 1000);
      reached.push(name);
      deepestPx = Math.max(deepestPx, top + Math.min(h, vh * 0.8));
      t += dwell;
      engaged += dwell / 1000;
      if (chance(0.2)) {                    // read, scrolled away and came back: two rows
        const a = Math.max(500, Math.round(dwell * between(0.3, 0.7)));
        ev(s, 'section_view', t - dwell + a, path, { ...base, section: name, dwell_ms: a });
        ev(s, 'section_view', t, path, { ...base, section: name, dwell_ms: Math.max(500, dwell - a) });
      } else {
        ev(s, 'section_view', t, path, { ...base, section: name, dwell_ms: Math.max(500, dwell) });
      }
    }
  } else {
    // A page with no tracked sections: read on with a steady decay.
    const screens = Math.ceil(L.H / vh);
    let i = 1;
    while (!glance && i < screens && chance(0.72)) i += 1;
    deepestPx = Math.min(L.H, i * vh);
    engaged = glance ? between(1, 6) : between(8, 25) * i;
    t += engaged * 1000;
  }

  // Whoever reached the last section usually carries on into the footer.
  if (L.sections.length && reached.length === L.sections.length && chance(0.6)) deepestPx = L.H;
  const deepest = Math.min(100, Math.round((deepestPx / L.H) * 100));
  // When the reader was at a point of the page: reading runs top to bottom.
  const timeAt = (px) => ts + Math.round(Math.min(1, Math.max(0, px / deepestPx)) * (t - ts));
  for (const m of [25, 50, 75, 90, 100]) {
    if (deepest < m) break;
    ev(s, 'scroll', timeAt(((m / 100) * L.H) - vh * 0.5) + int(0, 900), path, { ...base, depth: m, max: deepest });
  }

  // Clicks on what they could see.
  const visible = L.targets.filter((x) => x[3] <= deepestPx);
  const clicks = glance ? 0 : weighted([[0, 3], [1, 4], [2, 3], [3, 2], [4, 1]]);
  for (let i = 0; i < clicks && visible.length; i += 1) {
    const target = weighted(visible.map((x) => [x, CLICK_WEIGHT[x[5]] ?? 1]));
    const [sel, text, x, y, half, kind, name] = target;
    const at = timeAt(y) + int(300, 4000);
    ev(s, 'click', at, path, {
      ...base, x: Math.round(Math.min(99.5, Math.max(0.5, x + between(-half, half) * 0.8)) * 10) / 10,
      y: Math.round(y + between(-12, 12)), h: L.H, vp: device, sel, text: kind === 'field' ? '' : text,
    });
    if (kind === 'cta') ev(s, 'cta_click', at, path, { ...base, cta: name, text });
    if (kind === 'tel') ev(s, 'outbound_click', at, path, { ...base, href: 'tel:999', text });
  }

  // The forms (landing page only).
  let signedUp = null;
  if (path === '/' && !glance && !visitor.signedUp) {
    const forms = [role === 'gp' ? 'hero-gp' : 'hero'];
    if (reached.includes(role === 'gp' ? 'gp-closing' : 'patient-closing')) forms.push(role === 'gp' ? 'recap-gp' : 'recap');
    const f = { role };
    let started = false;
    for (const form of forms) {
      const [, top] = L.sections.find(([n]) => n === (form.startsWith('hero') ? `${role}-hero` : `${role}-closing`)) ?? [null, 0];
      let ft = Math.max(ts + 1500, timeAt(top)) + int(500, 4000);
      ev(s, 'form_view', ft, path, { ...base, ...f, form });
      if (started || !chance(role === 'gp' ? (form === 'hero-gp' ? 0.15 : 0.28) : (form === 'hero' ? 0.09 : 0.2))) continue;
      started = true;
      ft += int(1000, 6000);
      ev(s, 'form_start', ft, path, { ...base, ...f, form });
      const fields = role === 'gp' ? [['name', 0.08], ['email', 0.12], ['mobile', 0.2], ['gmc', 0.3]] : [['email', 0.1]];
      let complete = true;
      for (const [field, leave] of fields) {
        ft += int(2000, 12_000);
        ev(s, 'field_focus', ft, path, { ...base, ...f, form, field });
        if (chance(leave)) { complete = false; break; }
      }
      if (!complete) continue;
      const fieldErr = role === 'gp' ? (chance(0.28) ? 'gmc' : chance(0.08) ? 'email' : chance(0.05) ? 'mobile' : null) : (chance(0.08) ? 'email' : null);
      if (fieldErr) {
        ft += int(1000, 3000);
        ev(s, 'field_error', ft, path, { ...base, ...f, form, field: fieldErr, error: `invalid_${fieldErr}`, from: 'client' });
        if (chance(0.35)) continue;           // gave up after the error
        ft += int(4000, 15_000);
        ev(s, 'field_focus', ft, path, { ...base, ...f, form, field: fieldErr });
      }
      ft += int(1000, 4000);
      ev(s, 'form_submit', ft, path, { ...base, ...f, form });
      ft += int(300, 1200);
      if (chance(0.05)) { ev(s, 'form_fail', ft, path, { ...base, ...f, form, error: 'network' }); continue; }
      ev(s, 'form_success', ft, path, { ...base, ...f, form, already: false });
      signedUp = { form, ts: ft };
      t = Math.max(t, ft);
    }
  }

  // Engaged time in two or three reports, the last carrying the deepest scroll.
  const secs = Math.max(1, Math.round(engaged));
  const parts = secs > 20 ? int(2, 3) : 1;
  let left = secs;
  for (let i = 0; i < parts; i += 1) {
    const sN = i === parts - 1 ? left : Math.round(left * between(0.3, 0.6));
    left -= sN;
    ev(s, 'engaged_time', ts + Math.round(((i + 1) / parts) * (t - ts)) + 500, path, { ...base, seconds: sN, max_scroll: deepest });
  }

  if (signedUp) {
    visitor.signedUp = true;
    signupN += 1;
    const gp = role === 'gp';
    out.signups.push({
      id: randomUUID(), role, email: `demo+${signupN}@example.com`,
      name: gp ? `Dr Demo ${signupN}` : null, mobile: gp ? `07700 9${String(int(0, 99999)).padStart(5, '0')}` : null,
      gmc: gp ? String(int(1_000_000, 7_999_999)) : null, source: 'demo',
      status: gp ? weighted([['new', 5], ['contacted', 3], ['gmc_verified', 2], ['onboarding', 1], ['active', 1], ['rejected', 1]]) : 'subscribed',
      notes: '', visitor_id: visitor.id, utm_source: visitor.first_utm_source, utm_medium: visitor.first_utm_medium,
      utm_campaign: visitor.first_utm_campaign, referrer: visitor.first_referrer, landing_path: visitor.first_path,
      unsubscribe_token: randomBytes(24).toString('base64url'),
      created_at: new Date(signedUp.ts), updated_at: new Date(signedUp.ts),
    });
  }
  return { endTs: t + int(1000, 5000), deepest, engaged: secs };
}

// Visits per day rise over the period (a pre-launch list growing), with a
// weekday bump; each visitor lands on a day drawn from that curve.
function dayOffset() {
  const weights = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(NOW - (DAYS - 1 - i) * DAY).getUTCDay();
    return (0.5 + (i / DAYS) * 1.2) * (d === 0 || d === 6 ? 0.75 : 1.1);
  });
  return DAYS - 1 - weighted(weights.map((w, i) => [i, w]));
}

function simulateVisitor(liveAt = null) {
  const device = weighted(DEVICES);
  const [browser, os] = weighted(UA[device]);
  const id = demoId();
  const firstDay = liveAt ? 0 : dayOffset();
  const src = weighted(SOURCES);
  let t = liveAt ?? NOW - firstDay * DAY - int(0, 20 * 3600) * 1000;
  const visitor = {
    id, first_seen: new Date(t), last_seen: new Date(t), first_referrer: src[0], first_utm_source: src[1],
    first_utm_medium: src[2], first_utm_campaign: src[3], first_path: null, device, browser, os,
    sessions: 0, pageviews: 0, engaged_seconds: 0,
  };
  const visits = liveAt ? 1 : weighted([[1, 70], [2, 20], [3, 7], [4, 3]]);
  for (let v = 0; v < visits; v += 1) {
    const s = src;
    const sid = demoId();
    const session = { id: sid, visitor_id: id };
    const role = chance(s[4]) ? 'gp' : 'patient';
    let path = v === 0 ? weighted(ENTRY) : '/';
    const glance = !liveAt && chance(0.22);  // a quick look and gone: the bounces
    const views = glance ? 1 : liveAt ? int(1, 3) : Math.min(5, 1 + weighted([[0, 45], [1, 30], [2, 15], [3, 10]]));
    const start = t;
    let pageviews = 0, engaged = 0, maxScroll = 0, prev = null, entry = path, exit = path;
    for (let i = 0; i < views; i += 1) {
      const r = simulateView(session, visitor, path, t, device, role, i === 0, prev, i === 0 ? s : [null, s[1], s[2], s[3]], glance);
      pageviews += 1; engaged += r.engaged; maxScroll = Math.max(maxScroll, r.deepest);
      prev = path; exit = path; t = r.endTs;
      path = pick(PAGES.filter((p) => p !== path));
    }
    if (!visitor.first_path) visitor.first_path = entry;
    out.sessions.push({
      id: sid, visitor_id: id, started_at: new Date(start), last_seen: new Date(t), entry_path: entry, exit_path: exit,
      current_path: exit, pageviews, engaged_seconds: Math.min(3600, engaged), max_scroll: maxScroll,
      referrer: s[0], utm_source: s[1], utm_medium: s[2], utm_campaign: s[3], device, browser, os,
      viewport_width: VIEWPORT[device][0],
    });
    visitor.sessions += 1; visitor.pageviews += pageviews; visitor.engaged_seconds += engaged;
    visitor.last_seen = new Date(t);
    t += int(1, 9) * DAY + int(0, 12 * 3600) * 1000;
    if (t > NOW - 60_000) break;
  }
  out.visitors.push(visitor);
}

// Anonymous page views: no ids, only what the cookieless beacon carries.
function simulateCookieless(ts) {
  const device = weighted(DEVICES);
  const [browser, os] = weighted(UA[device]);
  const src = weighted(SOURCES);
  const path = weighted(ENTRY);
  const props = { device, ref: src[0] ? new URL(src[0]).host : null, browser, os };
  if (src[1]) props.utm_source = src[1];
  if (path === '/') props.role = chance(src[4]) ? 'gp' : 'patient';
  ev(null, 'pageview', ts, path, props);
}

for (let i = 0; i < VISITORS; i += 1) simulateVisitor();
for (let i = 0; i < Math.round(VISITORS * 1.4); i += 1) simulateCookieless(NOW - dayOffset() * DAY - int(0, 20 * 3600) * 1000);
// A few people on the site right now, for the Live page.
for (let i = 0; i < 4; i += 1) {
  const [e0, s0] = [out.events.length, out.sessions.length];
  simulateVisitor(NOW - int(60, 200) * 1000);
  const end = Math.max(...out.events.slice(e0).map((e) => e.ts.getTime()));
  const shift = Math.max(0, end - (NOW - int(5, 90) * 1000));
  const back = (d) => new Date(d.getTime() - shift);
  for (const e of out.events.slice(e0)) e.ts = back(e.ts);
  for (const x of out.sessions.slice(s0)) { x.started_at = back(x.started_at); x.last_seen = back(x.last_seen); }
  for (const x of out.signups) if (x.visitor_id === out.visitors.at(-1).id) { x.created_at = back(x.created_at); x.updated_at = x.created_at; }
  const v = out.visitors.at(-1);
  v.first_seen = back(v.first_seen); v.last_seen = back(v.last_seen);
}
for (let i = 0; i < 3; i += 1) simulateCookieless(NOW - int(10, 240) * 1000);
// No event is in the future.
for (const e of out.events) if (e.ts.getTime() > NOW) e.ts = new Date(NOW - int(1, 30) * 1000);
for (const s of out.sessions) if (s.last_seen.getTime() > NOW) s.last_seen = new Date(NOW - int(1, 30) * 1000);

/* ------------------------------------------------------------ write */
const sql = postgres(url, { max: 1, onnotice: () => {} });
const chunks = (list, n) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));
try {
  await sql.begin(async (tx) => {
    // Replace any earlier demo data, and only that.
    await tx`delete from events where props->>'demo' = 'true'`;
    await tx`delete from sessions where id::text like 'dddddddd-%'`;
    await tx`delete from visitors where id::text like 'dddddddd-%'`;
    await tx`delete from waitlist_signups where source = 'demo' and email like 'demo+%@example.com'`;
    for (const c of chunks(out.visitors.map(({ signedUp: _, ...v }) => v), 500)) await tx`insert into visitors ${tx(c)}`;
    for (const c of chunks(out.sessions, 500)) await tx`insert into sessions ${tx(c)}`;
    for (const c of chunks(out.events.map((e) => ({ ...e, props: tx.json(e.props) })), 1000)) await tx`insert into events ${tx(c)}`;
    for (const c of chunks(out.signups, 500)) await tx`insert into waitlist_signups ${tx(c)}`;
  });
  console.log(`Seeded ${out.visitors.length} visitors, ${out.sessions.length} sessions, ${out.events.length} events, ${out.signups.length} demo sign-ups into ${host}.`);
} catch (err) {
  console.error('Seeding failed:', err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
