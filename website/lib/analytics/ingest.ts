// The server half of the analytics contract: validates a beacon from
// lib/analytics/track.ts and writes it. Server-only.
//
// Payload (JSON, sent as text/plain by sendBeacon):
//   { mode: 'cookieless' | 'identified', visitorId?, sessionId?, events: [{ type, path, ts, props }] }
//
// Cookieless batches keep only `pageview` events and store them with no ids.
// Identified batches, in one transaction: upsert the visitor (first-touch
// fields only on insert), insert the session if it is new (and count it on the
// visitor), fold the batch into the session's aggregates, insert the events.
//
// Event props, as the tracker sends them (every identified event also has `pv`,
// an 8-character id shared by the events of one pageview):
//   pageview        device ('mobile'|'tablet'|'desktop', viewport), ref (referrer host|null),
//                   utm_source?, role? ('/' only: 'patient'|'gp')
//                   + identified: referrer (origin+path|null), utm_medium, utm_campaign, vw, vh,
//                   prev (previous in-site path|null), after_consent? (true: the same page
//                   again, re-counted when consent was given mid-view — exclude from totals)
//                   + cookieless, added here: browser, os
//   scroll          depth (milestone 25|50|75|90|100), max (deepest % so far)
//   section_view    section (data-section name), dwell_ms (≥500; several per pageview are summed)
//   engaged_time    seconds (visible and active since the last report), max_scroll
//   click           x (% of document width), y (px from top), h (document height),
//                   vp ('mobile'|'tablet'|'desktop'), sel (CSS path ≤120), text (≤40)
//   cta_click       cta (the data-cta value), text
//   outbound_click  href (host+path, 'tel:999' or 'mailto'), text
//   form_view / form_start / form_submit             form (source: hero|recap|hero-gp|recap-gp), role
//   field_focus     form, role, field
//   field_error     form, role, field, error ('invalid_<field>'|'missing_email'), from? ('client'|'server')
//   form_success    form, role, already (boolean)
//   form_fail       form, role, error ('rate_limited'|'http_<status>'|'network'|'invalid_<field>')
import { eq, sql } from 'drizzle-orm';
import type { DB } from '@/lib/db';
import { EVENT_TYPES, events, sessions, visitors, type EventType } from '@/lib/db/schema';
import type { ParsedUa } from '@/lib/analytics/ua';

export const MAX_BODY = 32 * 1024;
export const MAX_EVENTS = 50;
const MAX_PATH = 300;
const MAX_PROP_KEYS = 20;
const MAX_PROP_STRING = 200;
const MAX_PROPS_JSON = 2048;
const DAY_MS = 24 * 3600 * 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES = new Set<string>(EVENT_TYPES);
const KEY = /^[a-z][a-z0-9_]{0,31}$/;

export type CleanEvent = { type: EventType; path: string; ts: Date; props: Record<string, string | number | boolean | null> };
export type CleanBatch =
  | { mode: 'cookieless'; events: CleanEvent[] }
  | { mode: 'identified'; visitorId: string; sessionId: string; events: CleanEvent[] };

function cleanPath(v: unknown): string | null {
  if (typeof v !== 'string' || !v.startsWith('/')) return null;
  const path = v.split(/[?#]/)[0];
  return path.length <= MAX_PATH ? path : null;
}

// Flat props only: short keys, strings capped, finite numbers, booleans, null.
// Anything else is dropped, and an oversized set is dropped whole.
function cleanProps(v: unknown): CleanEvent['props'] {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: CleanEvent['props'] = {};
  let n = 0;
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (n >= MAX_PROP_KEYS || !KEY.test(k)) continue;
    if (typeof val === 'string') out[k] = val.slice(0, MAX_PROP_STRING);
    else if (typeof val === 'number' && Number.isFinite(val)) out[k] = val;
    else if (typeof val === 'boolean' || val === null) out[k] = val;
    else continue;
    n++;
  }
  return JSON.stringify(out).length <= MAX_PROPS_JSON ? out : {};
}

// A timestamp from the browser's clock, clamped into the last 24 hours.
function cleanTs(v: unknown, now: number): Date {
  const t = typeof v === 'number' && Number.isFinite(v) ? v : now;
  return new Date(Math.min(now, Math.max(now - DAY_MS, t)));
}

// null when the body is not a usable batch at all. Individual bad events are
// dropped; a batch left with none is still valid (and writes nothing).
export function validateBatch(body: unknown, now = Date.now()): CleanBatch | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (b.mode !== 'cookieless' && b.mode !== 'identified') return null;
  if (!Array.isArray(b.events) || b.events.length > MAX_EVENTS) return null;

  const cleaned: CleanEvent[] = [];
  for (const raw of b.events) {
    if (!raw || typeof raw !== 'object') continue;
    const e = raw as Record<string, unknown>;
    const path = cleanPath(e.path);
    if (typeof e.type !== 'string' || !TYPES.has(e.type) || !path) continue;
    if (b.mode === 'cookieless' && e.type !== 'pageview') continue;
    cleaned.push({ type: e.type as EventType, path, ts: cleanTs(e.ts, now), props: cleanProps(e.props) });
  }
  cleaned.sort((a, z) => a.ts.getTime() - z.ts.getTime());

  if (b.mode === 'cookieless') return { mode: 'cookieless', events: cleaned };
  if (typeof b.visitorId !== 'string' || !UUID.test(b.visitorId)) return null;
  if (typeof b.sessionId !== 'string' || !UUID.test(b.sessionId)) return null;
  return {
    mode: 'identified',
    visitorId: b.visitorId.toLowerCase(),
    sessionId: b.sessionId.toLowerCase(),
    events: cleaned,
  };
}

const str = (v: unknown, max = 300) => (typeof v === 'string' && v ? v.slice(0, max) : null);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export async function ingest(db: DB, batch: CleanBatch, ua: ParsedUa): Promise<void> {
  if (!batch.events.length) return;

  if (batch.mode === 'cookieless') {
    await db.insert(events).values(batch.events.map((e) => ({
      sessionId: null, visitorId: null, type: e.type, path: e.path, ts: e.ts,
      props: { ...e.props, browser: ua.browser, os: ua.os },
    })));
    return;
  }

  const { visitorId, sessionId } = batch;
  const evs = batch.events;
  const first = evs[0];
  const last = evs[evs.length - 1];
  const landing = evs.find((e) => e.type === 'pageview') ?? first;
  const pageviews = evs.filter((e) => e.type === 'pageview').length;
  const engaged = Math.min(3600, evs.filter((e) => e.type === 'engaged_time').reduce((s, e) => s + num(e.props.seconds), 0));
  const maxScroll = Math.min(100, Math.max(0, ...evs.map((e) =>
    e.type === 'scroll' ? num(e.props.max) : e.type === 'engaged_time' ? num(e.props.max_scroll) : 0)));
  const p = landing.type === 'pageview' ? landing.props : {};
  const vw = num(p.vw);

  await db.transaction(async (tx) => {
    await tx.insert(visitors).values({
      id: visitorId,
      firstSeen: first.ts,
      lastSeen: last.ts,
      firstReferrer: str(p.referrer),
      firstUtmSource: str(p.utm_source, 100),
      firstUtmMedium: str(p.utm_medium, 100),
      firstUtmCampaign: str(p.utm_campaign, 100),
      firstPath: landing.path,
      device: ua.device, browser: ua.browser, os: ua.os,
      sessions: 0, pageviews, engagedSeconds: engaged,
    }).onConflictDoUpdate({
      target: visitors.id,
      set: {
        lastSeen: sql`greatest(${visitors.lastSeen}, ${last.ts.toISOString()}::timestamptz)`,
        pageviews: sql`${visitors.pageviews} + ${pageviews}`,
        engagedSeconds: sql`${visitors.engagedSeconds} + ${engaged}`,
        device: ua.device, browser: ua.browser, os: ua.os,
      },
    });

    const inserted = await tx.insert(sessions).values({
      id: sessionId,
      visitorId,
      startedAt: first.ts,
      lastSeen: last.ts,
      entryPath: landing.path,
      exitPath: last.path,
      currentPath: last.path,
      pageviews,
      engagedSeconds: engaged,
      maxScroll,
      referrer: str(p.referrer),
      utmSource: str(p.utm_source, 100),
      utmMedium: str(p.utm_medium, 100),
      utmCampaign: str(p.utm_campaign, 100),
      device: ua.device, browser: ua.browser, os: ua.os,
      viewportWidth: vw > 0 ? Math.round(vw) : null,
    }).onConflictDoNothing().returning({ id: sessions.id });

    if (inserted.length) {
      await tx.update(visitors).set({ sessions: sql`${visitors.sessions} + 1` }).where(eq(visitors.id, visitorId));
    } else {
      // The session belongs to the visitor that started it; a beacon naming
      // someone else's session id is folded in under that id regardless, since
      // ids are random and unguessable, but never re-parented.
      await tx.update(sessions).set({
        lastSeen: sql`greatest(${sessions.lastSeen}, ${last.ts.toISOString()}::timestamptz)`,
        exitPath: last.path,
        currentPath: last.path,
        pageviews: sql`${sessions.pageviews} + ${pageviews}`,
        engagedSeconds: sql`${sessions.engagedSeconds} + ${engaged}`,
        maxScroll: sql`greatest(${sessions.maxScroll}, ${maxScroll})`,
      }).where(eq(sessions.id, sessionId));
    }

    await tx.insert(events).values(evs.map((e) => ({
      sessionId, visitorId, type: e.type, path: e.path, ts: e.ts, props: e.props,
    })));
  });
}
