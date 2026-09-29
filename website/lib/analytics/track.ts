// The first-party analytics tracker. Client-only, no dependencies; every entry
// point is safe to import during a server render because nothing touches the
// DOM until it is called.
//
// Three modes, re-decided on every call rather than cached:
//
//   off         ?dq_heatmap=1 on the first URL (the admin heatmap iframe), or
//               no DOM. Nothing is sent at all.
//   cookieless  consent undecided or declined, a Global Privacy Control or Do
//               Not Track signal, or an automated browser. Only `pageview`
//               events, with no visitor or session id, and nothing is written
//               to a cookie or to storage.
//   identified  consent granted (dq_consent=granted). A visitor id in the
//               dq_vid cookie (13 months), a session id in sessionStorage with a
//               30-minute idle timeout, and the full event set.
//
// Events are batched in memory and flushed to /api/collect with sendBeacon
// (fetch keepalive as the fallback) every 10 seconds, when the tab is hidden
// and on pagehide. The event and props contract is written out in
// lib/analytics/ingest.ts, which is the server's half of it.
import type { EventType } from '@/lib/db/schema';

export const ENDPOINT = '/api/collect';
export const CONSENT_COOKIE = 'dq_consent';
export const VISITOR_COOKIE = 'dq_vid';
export const CONSENT_EVENT = 'dq:consent';
export const OPEN_CONSENT_EVENT = 'dq:consent-open';
const SESSION_KEY = 'dq_sid';
const FIRST_TOUCH_KEY = 'dq_ft';

const CONSENT_MAX_AGE = 365 * 24 * 3600;  // 12 months
const VISITOR_MAX_AGE = 396 * 24 * 3600;  // 13 months, renewed on each visit
const SESSION_IDLE_MS = 30 * 60 * 1000;
const FLUSH_MS = 10_000;
const ACTIVE_MS = 30_000;   // input within this window keeps the time "engaged"
const MIN_DWELL_MS = 500;   // a section scrolled straight past is not "read"
const MAX_BATCH = 50;
const MAX_BODY = 30_000;

export const MILESTONES = [25, 50, 75, 90, 100] as const;

// Never tracked: the admin, the patient and doctor prototypes, the component
// gallery, the unsubscribe link (its path can carry a token) and the API.
const UNTRACKED = ['/admin', '/patient', '/doctor', '/dev', '/unsubscribe', '/api'];

export type Consent = 'granted' | 'denied' | null;
export type Mode = 'off' | 'cookieless' | 'identified';
export type Props = Record<string, string | number | boolean | null>;
export type TrackedEvent = { type: EventType; path: string; ts: number; props: Props };
export type Payload = { mode: 'cookieless' | 'identified'; visitorId?: string; sessionId?: string; events: TrackedEvent[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hasDom = () => typeof window !== 'undefined' && typeof document !== 'undefined';

/* ------------------------------------------------------------ pure helpers */

export function isTrackedPath(path: string): boolean {
  return !UNTRACKED.some((p) => path === p || path.startsWith(`${p}/`));
}

export type Bucket = 'mobile' | 'tablet' | 'desktop';
export function viewportBucket(width: number): Bucket {
  return width < 640 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';
}

// How far down the page the bottom of the viewport has reached, 0–100.
export function scrollDepth(scrollY: number, viewportHeight: number, docHeight: number): number {
  if (docHeight <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round(((scrollY + viewportHeight) / docHeight) * 100)));
}

export function newMilestones(depth: number, reached: ReadonlySet<number>): number[] {
  return MILESTONES.filter((m) => depth >= m && !reached.has(m));
}

const SAFE_TOKEN = /^[A-Za-z_][\w-]{0,39}$/;

// A short, readable CSS path for a clicked element: up to five steps, each a
// tag plus at most two plain class names, stopping early at an id or a
// data-section. Utility classes with ':' or '[' in them are skipped. Trimmed
// from the left so the most specific end survives the 120-character cap.
export function selectorFor(el: Element): string {
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && parts.length < 5 && node.tagName !== 'BODY' && node.tagName !== 'HTML') {
    const tag = node.tagName.toLowerCase();
    if (node.id && SAFE_TOKEN.test(node.id)) { parts.unshift(`${tag}#${node.id}`); break; }
    const section = node.getAttribute('data-section');
    if (section && SAFE_TOKEN.test(section)) { parts.unshift(`${tag}[data-section="${section}"]`); break; }
    const classes = Array.from(node.classList).filter((c) => SAFE_TOKEN.test(c)).slice(0, 2);
    parts.unshift(classes.length ? `${tag}.${classes.join('.')}` : tag);
    node = node.parentElement;
  }
  while (parts.length > 1 && parts.join(' > ').length > 120) parts.shift();
  return parts.join(' > ').slice(-120);
}

// The visible label of what was clicked, never what was typed into a field.
export function elementText(el: Element): string {
  if (el.closest('input, textarea, select, [contenteditable]')) return '';
  const host = el.closest('a, button, label, summary, h1, h2, h3') ?? el;
  // innerText keeps the line breaks between spans ("See a GP" / "in minutes").
  const text = (host as HTMLElement).innerText ?? host.textContent ?? '';
  return text.replace(/\s+/g, ' ').trim().slice(0, 40);
}

function uuid(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/* ------------------------------------------------- cookies, storage, consent */

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function writeCookie(name: string, value: string, maxAge: number) {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
}

function readJson<T>(key: string): T | null {
  try { return JSON.parse(sessionStorage.getItem(key) ?? 'null') as T | null; } catch { return null; }
}

function writeJson(key: string, value: unknown) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ }
}

export function readConsent(): Consent {
  if (!hasDom()) return null;
  const v = readCookie(CONSENT_COOKIE);
  return v === 'granted' || v === 'denied' ? v : null;
}

// Storing the choice itself is strictly necessary, so it needs no consent.
// Declining (or withdrawing) also removes the visitor cookie and the session.
export function setConsent(choice: 'granted' | 'denied') {
  if (!hasDom()) return;
  writeCookie(CONSENT_COOKIE, choice, CONSENT_MAX_AGE);
  if (choice === 'denied') {
    writeCookie(VISITOR_COOKIE, '', 0);
    try { sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(FIRST_TOUCH_KEY); } catch { /* blocked */ }
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: choice }));
}

export function openConsentSettings() {
  if (hasDom()) window.dispatchEvent(new CustomEvent(OPEN_CONSENT_EVENT));
}

let heatmap: boolean | null = null;
export function isHeatmapView(): boolean {
  if (!hasDom()) return false;
  heatmap ??= new URLSearchParams(location.search).get('dq_heatmap') === '1';
  return heatmap;
}

// Global Privacy Control or Do Not Track: treated as a standing "no".
export function privacySignal(): boolean {
  if (!hasDom()) return false;
  const n = navigator as Navigator & { globalPrivacyControl?: boolean };
  return n.globalPrivacyControl === true || n.doNotTrack === '1'
    || (window as unknown as { doNotTrack?: string }).doNotTrack === '1';
}

export function trackingMode(): Mode {
  if (!hasDom() || isHeatmapView()) return 'off';
  if (readConsent() !== 'granted' || privacySignal() || navigator.webdriver) return 'cookieless';
  return 'identified';
}

function visitorId(create: boolean): string | null {
  const existing = readCookie(VISITOR_COOKIE);
  const id = existing && UUID.test(existing) ? existing : create ? uuid() : null;
  if (id && create) writeCookie(VISITOR_COOKIE, id, VISITOR_MAX_AGE);
  return id;
}

function sessionId(now: number): string {
  const s = readJson<{ id: string; last: number }>(SESSION_KEY);
  const id = s && UUID.test(s.id) && now - s.last < SESSION_IDLE_MS ? s.id : uuid();
  writeJson(SESSION_KEY, { id, last: now });
  return id;
}

/* ------------------------------------------------------------- attribution */

type Touch = { utmSource?: string; utmMedium?: string; utmCampaign?: string; referrer?: string; landingPath?: string };
let firstTouch: Touch | null = null;

// An off-site referrer as origin + path; the query string is dropped.
function externalReferrer(): string | undefined {
  try {
    if (!document.referrer) return undefined;
    const u = new URL(document.referrer);
    return u.host === location.host ? undefined : (u.origin + u.pathname).slice(0, 300);
  } catch { return undefined; }
}

function currentTouch(): Touch {
  const q = new URLSearchParams(location.search);
  const v = (k: string) => (q.get(k) ?? '').trim().slice(0, 100) || undefined;
  return {
    utmSource: v('utm_source'), utmMedium: v('utm_medium'), utmCampaign: v('utm_campaign'),
    referrer: externalReferrer(), landingPath: location.pathname.slice(0, 300),
  };
}

// First touch lives in memory for this page load; with consent it is also kept
// in sessionStorage so it survives a full reload within the visit.
function touch(): Touch {
  const identified = trackingMode() === 'identified';
  firstTouch ??= (identified ? readJson<Touch>(FIRST_TOUCH_KEY) : null) ?? currentTouch();
  if (identified) writeJson(FIRST_TOUCH_KEY, firstTouch);
  return firstTouch;
}

export type Attribution = {
  visitorId?: string; utmSource?: string; utmMedium?: string; utmCampaign?: string; referrer?: string; landingPath?: string;
};

// What a sign-up form sends with the person's own submission. Absent values are
// left out rather than sent as null. Without consent there is no visitor id,
// but the campaign tags, referrer and landing path still travel: they describe
// the submission, not a tracked person.
export function getAttribution(): Attribution {
  if (!hasDom()) return {};
  const out: Attribution = {};
  for (const [k, v] of Object.entries(touch())) if (v) out[k as keyof Touch] = v;
  const vid = trackingMode() === 'identified' ? visitorId(false) : null;
  if (vid) out.visitorId = vid;
  return out;
}

/* ------------------------------------------------------------ tracker state */

type Section = { ms: number; since: number | null };
type View = {
  pv: string;               // this pageview's id, on every identified event
  path: string;
  maxScroll: number;
  reportedScroll: number;
  milestones: Set<number>;
  sections: Map<string, Section>;
  engagedMs: number;
};
type Queued = { mode: 'cookieless' | 'identified'; visitorId?: string; sessionId?: string; event: TrackedEvent };

let started = false;
let view: View | null = null;
let queue: Queued[] = [];
let observer: IntersectionObserver | null = null;
let lastActivity = 0;
let firstViewOfLoad = true;
let lastPath: string | null = null;
let timers: ReturnType<typeof setInterval>[] = [];
let scrollFrame = 0;

const docVisible = () => document.visibilityState !== 'hidden';

function push(type: EventType, props: Props = {}) {
  const mode = trackingMode();
  if (mode === 'off' || !view) return;
  if (mode === 'cookieless' && type !== 'pageview') return;
  const now = Date.now();
  const entry: Queued = { mode, event: { type, path: view.path, ts: now, props } };
  if (mode === 'identified') {
    props.pv = view.pv;
    entry.visitorId = visitorId(true)!;
    entry.sessionId = sessionId(now);
  }
  queue.push(entry);
  if (queue.length >= MAX_BATCH) flush();
}

// For the forms (and anything else) to record an event on the current page.
// A no-op until the tracker is running, and in cookieless mode.
export function track(type: EventType, props: Props = {}) {
  if (started) push(type, { ...props });
}

/* ---------------------------------------------------------------- flushing */

function send(payload: Payload) {
  const body = JSON.stringify(payload);
  if (body.length > MAX_BODY && payload.events.length > 1) {
    const half = Math.ceil(payload.events.length / 2);
    send({ ...payload, events: payload.events.slice(0, half) });
    send({ ...payload, events: payload.events.slice(half) });
    return;
  }
  try {
    if (navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: 'text/plain' }))) return;
  } catch { /* fall through to fetch */ }
  try {
    void fetch(ENDPOINT, {
      method: 'POST', body, keepalive: true, credentials: 'same-origin',
      headers: { 'Content-Type': 'text/plain' },
    }).catch(() => {});
  } catch { /* nothing more to try */ }
}

export function flush() {
  if (!queue.length) return;
  const batch = queue;
  queue = [];
  let current: Payload | null = null;
  for (const q of batch) {
    if (!current || current.mode !== q.mode || current.visitorId !== q.visitorId
      || current.sessionId !== q.sessionId || current.events.length >= MAX_BATCH) {
      if (current) send(current);
      current = { mode: q.mode, events: [] };
      if (q.visitorId) { current.visitorId = q.visitorId; current.sessionId = q.sessionId; }
    }
    current.events.push(q.event);
  }
  if (current) send(current);
}

/* -------------------------------------------------------------- pageviews */

function pauseSections(now: number) {
  if (!view) return;
  for (const s of view.sections.values()) {
    if (s.since !== null) { s.ms += now - s.since; s.since = null; }
  }
}

// Report what has accumulated on this pageview so far — section dwell, engaged
// time, the deepest scroll — and zero it. Runs when the page is hidden or left.
function checkpoint(keepVisible: boolean) {
  if (!view || trackingMode() !== 'identified') return;
  const now = Date.now();
  const visible = [...view.sections].filter(([, s]) => s.since !== null).map(([name]) => name);
  pauseSections(now);
  for (const [section, s] of view.sections) {
    if (s.ms >= MIN_DWELL_MS) push('section_view', { section, dwell_ms: Math.round(s.ms) });
    s.ms = 0;
  }
  const seconds = Math.round(view.engagedMs / 1000);
  if (seconds > 0 || view.maxScroll > view.reportedScroll) {
    push('engaged_time', { seconds, max_scroll: view.maxScroll });
    view.engagedMs = 0;
    view.reportedScroll = view.maxScroll;
  }
  if (keepVisible) for (const name of visible) view.sections.get(name)!.since = now;
}

function observeSections() {
  observer?.disconnect();
  observer = null;
  if (typeof IntersectionObserver === 'undefined' || !view) return;
  observer = new IntersectionObserver((entries) => {
    if (!view) return;
    const now = Date.now();
    for (const e of entries) {
      const name = (e.target as HTMLElement).dataset.section;
      if (!name) continue;
      const vh = e.rootBounds?.height ?? window.innerHeight;
      // "Being read": at least half the viewport, or half the section when it
      // is shorter than that.
      const seen = e.isIntersecting && e.intersectionRect.height >= 0.5 * Math.min(vh, e.boundingClientRect.height);
      const s = view.sections.get(name) ?? { ms: 0, since: null };
      if (seen && s.since === null && docVisible()) s.since = now;
      else if (!seen && s.since !== null) { s.ms += now - s.since; s.since = null; }
      view.sections.set(name, s);
    }
  }, { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1] });
  document.querySelectorAll<HTMLElement>('[data-section]').forEach((el) => observer!.observe(el));
}

function measureScroll() {
  scrollFrame = 0;
  if (!view || trackingMode() !== 'identified') return;
  const depth = scrollDepth(window.scrollY, window.innerHeight, document.documentElement.scrollHeight);
  if (depth > view.maxScroll) view.maxScroll = depth;
  for (const m of newMilestones(depth, view.milestones)) {
    view.milestones.add(m);
    push('scroll', { depth: m, max: view.maxScroll });
  }
}

// A new pageview: the tracker's route-change hook (components/Analytics.tsx).
export function pageview(path: string, opts: { afterConsent?: boolean } = {}) {
  if (!started) return;
  if (!opts.afterConsent && view?.path === path) return; // React strict mode runs effects twice
  checkpoint(false);
  observer?.disconnect();
  observer = null;
  const mode = trackingMode();
  if (mode === 'off' || !isTrackedPath(path)) { view = null; return; }

  const prev = opts.afterConsent ? null : lastPath;
  lastPath = path;
  view = {
    pv: uuid().slice(0, 8), path, maxScroll: 0, reportedScroll: 0,
    milestones: new Set(), sections: new Map(), engagedMs: 0,
  };
  lastActivity = Date.now();
  touch();
  const here = currentTouch();
  const external = firstViewOfLoad ? here.referrer : undefined;
  firstViewOfLoad = false;

  const props: Props = {
    device: viewportBucket(window.innerWidth),
    ref: external ? new URL(external).host : null,
  };
  if (here.utmSource) props.utm_source = here.utmSource;
  if (path === '/') props.role = document.documentElement.getAttribute('data-role');
  if (mode === 'identified') {
    Object.assign(props, {
      referrer: external ?? null,
      utm_medium: here.utmMedium ?? null,
      utm_campaign: here.utmCampaign ?? null,
      vw: window.innerWidth,
      vh: window.innerHeight,
      prev,
    });
    if (opts.afterConsent) props.after_consent = true;
  }
  push('pageview', props);

  if (mode === 'identified') {
    // After the new route has painted and the scroll has been restored.
    setTimeout(() => { if (view?.path === path) { observeSections(); measureScroll(); } }, 300);
  }
}

/* --------------------------------------------------------------- listeners */

function onActivity() { lastActivity = Date.now(); }

function onScroll() {
  lastActivity = Date.now();
  if (!scrollFrame) scrollFrame = requestAnimationFrame(measureScroll);
}

function onVisibility() {
  if (!docVisible()) { checkpoint(false); flush(); return; }
  lastActivity = Date.now();
  if (view && trackingMode() === 'identified') observeSections(); // re-arms dwell for what is on screen
}

function onPageHide() { checkpoint(false); flush(); }

function tick() {
  if (view && docVisible() && Date.now() - lastActivity < ACTIVE_MS) view.engagedMs += 1000;
}

function onClick(e: MouseEvent) {
  if (!view || trackingMode() !== 'identified' || !(e.target instanceof Element)) return;
  const target = e.target;
  const doc = document.documentElement;
  let x = e.pageX;
  let y = e.pageY;
  if (e.detail === 0) { // keyboard activation: use the element's centre
    const r = target.getBoundingClientRect();
    x = r.left + r.width / 2 + window.scrollX;
    y = r.top + r.height / 2 + window.scrollY;
  }
  const text = elementText(target);
  push('click', {
    x: Math.round((x / Math.max(doc.scrollWidth, 1)) * 1000) / 10,
    y: Math.round(y),
    h: doc.scrollHeight,
    vp: viewportBucket(window.innerWidth),
    sel: selectorFor(target),
    text,
  });
  const cta = target.closest('[data-cta]');
  if (cta) push('cta_click', { cta: (cta.getAttribute('data-cta') ?? '').slice(0, 60), text: elementText(cta) });
  const link = target.closest('a[href]') as HTMLAnchorElement | null;
  if (link) {
    try {
      const u = new URL(link.href, location.href);
      if (u.protocol === 'tel:') push('outbound_click', { href: `tel:${u.pathname}`.slice(0, 40), text });
      else if (u.protocol === 'mailto:') push('outbound_click', { href: 'mailto', text });
      else if (/^https?:$/.test(u.protocol) && u.host !== location.host) {
        push('outbound_click', { href: (u.host + u.pathname).slice(0, 200), text });
      }
    } catch { /* malformed href */ }
  }
}

function onConsent(e: Event) {
  const choice = (e as CustomEvent<'granted' | 'denied'>).detail;
  if (!started) return;
  if (choice === 'denied') {
    queue = queue.filter((q) => q.mode !== 'identified');
    observer?.disconnect();
    observer = null;
    return;
  }
  // Granted mid-visit: identified tracking starts from here, on this page.
  // Nothing measured before the choice is carried over.
  if (view && trackingMode() === 'identified') {
    const path = view.path;
    view = null;
    pageview(path, { afterConsent: true });
  }
}

// Starts the tracker once for the page's lifetime; later calls do nothing.
export function startTracker() {
  if (!hasDom() || started) return;
  started = true;
  isHeatmapView();
  lastActivity = Date.now();
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  document.addEventListener('click', onClick, true);
  for (const type of ['pointerdown', 'keydown', 'mousemove', 'touchstart'] as const) {
    window.addEventListener(type, onActivity, { passive: true });
  }
  window.addEventListener(CONSENT_EVENT, onConsent);
  timers = [setInterval(tick, 1000), setInterval(flush, FLUSH_MS)];
}

// Fire `cb` once, the first time at least half of `el` is on screen.
export function onFirstView(el: Element | null, cb: () => void): () => void {
  if (!el || typeof IntersectionObserver === 'undefined') return () => {};
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { io.disconnect(); cb(); }
  }, { threshold: 0.5 });
  io.observe(el);
  return () => io.disconnect();
}

// Tests only: tear everything down so each test starts from a fresh page.
export function resetTrackerForTests() {
  if (hasDom()) {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    document.removeEventListener('click', onClick, true);
    for (const type of ['pointerdown', 'keydown', 'mousemove', 'touchstart'] as const) {
      window.removeEventListener(type, onActivity);
    }
    window.removeEventListener(CONSENT_EVENT, onConsent);
  }
  timers.forEach(clearInterval);
  timers = [];
  observer?.disconnect();
  observer = null;
  started = false;
  view = null;
  queue = [];
  heatmap = null;
  firstTouch = null;
  firstViewOfLoad = true;
  lastPath = null;
}

export const _queuedForTests = () => queue.map((q) => ({ ...q }));
