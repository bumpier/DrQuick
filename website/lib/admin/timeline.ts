// A visitor's journey as something a person can read: sessions, each split
// into the pages viewed (events grouped by their pageview id, props.pv), and
// under each page what happened there in plain sentences. Pure, so the
// sentences are tested without a database; the query is lib/admin/queries/journey.ts.
//
// Folding rules, so the list reads as behaviour rather than as a log:
//   - section_view rows for one (pageview, section) are summed into one line,
//     placed where the section was first read;
//   - engaged_time is a running counter, so it becomes the page's summary
//     ("active 45s"), never a line;
//   - a click that also produced a cta_click / outbound_click at the same
//     moment is shown once, as the more specific event.
import { errorLabel, fieldLabel, fmtDuration, formName, sectionLabel } from '@/lib/admin/analytics-labels';

export type TimelineEventInput = {
  id: number;
  type: string;
  path: string;
  ts: Date | string;
  props: Record<string, unknown> | null;
};

export type TimelineSessionInput = {
  id: string;
  startedAt: Date | string;
  lastSeen: Date | string;
  entryPath: string;
  pageviews: number;
  engagedSeconds: number;
  maxScroll: number;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  device: string;
  browser: string;
  os: string;
  events: TimelineEventInput[];
};

export type TimelineKind = 'scroll' | 'section' | 'click' | 'cta' | 'outbound' | 'form' | 'error' | 'success' | 'other';
export type TimelineItem = { key: string; ts: Date; kind: TimelineKind; text: string };
export type TimelinePage = {
  key: string;
  path: string;
  ts: Date;
  role: string | null;
  engagedSeconds: number;
  maxScroll: number;
  items: TimelineItem[];
};
export type TimelineSession = Omit<TimelineSessionInput, 'events'> & {
  startedAt: Date;
  lastSeen: Date;
  pages: TimelinePage[];
  converted: boolean;
};

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const quote = (s: string) => `“${s}”`;

// One event as one sentence. Null for events that are folded elsewhere
// (engaged_time, pageview, section_view).
export function describe(type: string, props: Record<string, unknown> | null | undefined): string | null {
  const p = props ?? {};
  switch (type) {
    case 'scroll': return `Reached ${num(p.depth ?? p.max)}% of the page`;
    case 'click': {
      const t = text(p.text);
      if (t) return `Clicked ${quote(t)}`;
      const sel = text(p.sel);
      if (sel && /(^|[\s>])(input|textarea|select)\b/.test(sel)) return 'Clicked into a form field';
      return `Clicked ${sel ?? 'the page'}`;
    }
    case 'cta_click': {
      const t = text(p.text) ?? text(p.cta);
      return t ? `Clicked the ${quote(t)} button` : 'Clicked a call to action';
    }
    case 'outbound_click': {
      const href = text(p.href) ?? '';
      if (href.startsWith('tel:')) return `Tapped to call ${href.slice(4)}`;
      if (href === 'mailto') return 'Clicked an email link';
      return href ? `Left for ${href}` : 'Followed a link off the site';
    }
    case 'form_view': return `Saw ${formName(p.form, p.role)}`;
    case 'form_start': return `Started ${formName(p.form, p.role)}`;
    case 'field_focus': return `Moved to ${fieldLabel(p.field)}`;
    case 'field_error': return `Error on ${fieldLabel(p.field)}: ${errorLabel(p.error)}${p.from === 'server' ? ' (from the server)' : ''}`;
    case 'form_submit': return `Submitted ${formName(p.form, p.role)}`;
    case 'form_success': return p.already === true ? 'Was already on the waitlist' : `Joined the ${p.role === 'gp' ? 'GP' : 'patient'} waitlist`;
    case 'form_fail': return `${formName(p.form, p.role).replace(/^the/, 'The')} failed to send (${errorLabel(p.error)})`;
    case 'section_view': return `Read ${quote(sectionLabel(text(p.section) ?? '?'))} for ${fmtDuration(num(p.dwell_ms) / 1000)}`;
    default: return null;
  }
}

const KIND: Record<string, TimelineKind> = {
  scroll: 'scroll', section_view: 'section', click: 'click', cta_click: 'cta', outbound_click: 'outbound',
  form_view: 'form', form_start: 'form', field_focus: 'form', form_submit: 'form',
  field_error: 'error', form_fail: 'error', form_success: 'success',
};

const toDate = (d: Date | string) => (d instanceof Date ? d : new Date(d));

export function buildPages(events: TimelineEventInput[]): TimelinePage[] {
  const sorted = [...events].sort((a, b) => toDate(a.ts).getTime() - toDate(b.ts).getTime() || a.id - b.id);
  const pages = new Map<string, TimelinePage & { sections: Map<string, TimelineItem & { ms: number }> }>();
  const order: string[] = [];

  const pageFor = (e: TimelineEventInput) => {
    const pv = text(e.props?.pv) ?? `path:${e.path}`;
    let page = pages.get(pv);
    if (!page) {
      page = { key: pv, path: e.path, ts: toDate(e.ts), role: null, engagedSeconds: 0, maxScroll: 0, items: [], sections: new Map() };
      pages.set(pv, page);
      order.push(pv);
    }
    return page;
  };

  // Clicks that a more specific event already describes (same pageview, same moment).
  const specific = new Set<string>();
  for (const e of sorted) {
    if (e.type === 'cta_click' || e.type === 'outbound_click') specific.add(`${text(e.props?.pv)}|${Math.round(toDate(e.ts).getTime() / 1000)}`);
  }

  for (const e of sorted) {
    const page = pageFor(e);
    const p = e.props ?? {};
    const ts = toDate(e.ts);
    if (e.type === 'pageview') {
      page.ts = ts;
      page.path = e.path;
      page.role = text(p.role);
      continue;
    }
    if (e.type === 'engaged_time') {
      page.engagedSeconds += num(p.seconds);
      page.maxScroll = Math.max(page.maxScroll, num(p.max_scroll));
      continue;
    }
    if (e.type === 'scroll') page.maxScroll = Math.max(page.maxScroll, num(p.max ?? p.depth));
    if (e.type === 'click' && specific.has(`${text(p.pv)}|${Math.round(ts.getTime() / 1000)}`)) continue;
    if (e.type === 'section_view') {
      const name = text(p.section) ?? '?';
      const seen = page.sections.get(name);
      if (seen) {
        seen.ms += num(p.dwell_ms);
        seen.text = describe('section_view', { section: name, dwell_ms: seen.ms })!;
      } else {
        const item = { key: `${e.id}`, ts, kind: 'section' as const, text: '', ms: num(p.dwell_ms) };
        item.text = describe('section_view', { section: name, dwell_ms: item.ms })!;
        page.sections.set(name, item);
        page.items.push(item);
      }
      continue;
    }
    const sentence = describe(e.type, p);
    if (sentence) page.items.push({ key: `${e.id}`, ts, kind: KIND[e.type] ?? 'other', text: sentence });
  }

  return order.map((k) => {
    const { sections: _s, ...page } = pages.get(k)!;
    page.items = page.items.map(({ key, ts, kind, text: t }) => ({ key, ts, kind, text: t }));
    return page;
  }).sort((a, b) => a.ts.getTime() - b.ts.getTime());
}

// Sessions newest first, each with its pages oldest first.
export function buildTimeline(sessions: TimelineSessionInput[]): TimelineSession[] {
  return sessions
    .map(({ events, ...s }) => {
      const pages = buildPages(events);
      return {
        ...s,
        startedAt: toDate(s.startedAt),
        lastSeen: toDate(s.lastSeen),
        pages,
        converted: events.some((e) => e.type === 'form_success'),
      };
    })
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
}
