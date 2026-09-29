// A visitor's journey: their sessions, oldest first, each with its events in
// order. Server-only. Only visitors who accepted analytics cookies have an id,
// so a sign-up without a visitor id has no journey to show.
import { asc, eq, inArray } from 'drizzle-orm';
import type { DB } from '@/lib/db';
import { events, sessions, visitors } from '@/lib/db/schema';
import { UUID } from '@/lib/waitlist';

export const JOURNEY_SESSION_LIMIT = 50;
export const JOURNEY_EVENT_LIMIT = 1000;

export type JourneyEvent = typeof events.$inferSelect;
export type JourneySession = typeof sessions.$inferSelect & { events: JourneyEvent[] };
export type Journey = { visitor: typeof visitors.$inferSelect | null; sessions: JourneySession[]; truncated: boolean };

export async function visitorJourney(db: DB, visitorId: string | null | undefined): Promise<Journey | null> {
  if (!visitorId || !UUID.test(visitorId)) return null;
  const [visitor] = await db.select().from(visitors).where(eq(visitors.id, visitorId));
  const list = await db.select().from(sessions).where(eq(sessions.visitorId, visitorId))
    .orderBy(asc(sessions.startedAt)).limit(JOURNEY_SESSION_LIMIT);
  const ids = list.map((s) => s.id);
  const evts = ids.length
    ? await db.select().from(events).where(inArray(events.sessionId, ids))
      .orderBy(asc(events.ts), asc(events.id)).limit(JOURNEY_EVENT_LIMIT + 1)
    : [];
  const truncated = evts.length > JOURNEY_EVENT_LIMIT || list.length === JOURNEY_SESSION_LIMIT;
  const kept = evts.slice(0, JOURNEY_EVENT_LIMIT);
  return {
    visitor: visitor ?? null,
    sessions: list.map((s) => ({ ...s, events: kept.filter((e) => e.sessionId === s.id) })),
    truncated,
  };
}

// One line of plain English for an event, for the journey list.
export function describeEvent(e: Pick<JourneyEvent, 'type' | 'path' | 'props'>): string {
  const p = (e.props ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof p[k] === 'string' || typeof p[k] === 'number' ? String(p[k]) : null);
  switch (e.type) {
    case 'pageview': return `Viewed ${e.path}`;
    case 'scroll': return `Scrolled to ${str('depth') ?? str('max') ?? '?'}% of ${e.path}`;
    case 'section_view': return `Read the ${str('section') ?? 'a'} section${str('dwell') ? ` for ${str('dwell')}s` : ''}`;
    case 'engaged_time': return `Spent ${str('seconds') ?? '?'}s active on ${e.path}`;
    case 'click': return `Clicked ${str('text') ? `“${str('text')}”` : str('selector') ?? 'the page'}`;
    case 'cta_click': return `Clicked the ${str('text') ?? str('cta') ?? ''} button`.replace('  ', ' ');
    case 'outbound_click': return `Left for ${str('href') ?? str('host') ?? 'another site'}`;
    case 'form_view': return `Saw the ${str('form') ?? ''} form`.replace('  ', ' ');
    case 'form_start': return `Started the ${str('form') ?? ''} form`.replace('  ', ' ');
    case 'field_focus': return `Focused ${str('field') ?? 'a field'}`;
    case 'field_error': return `Error on ${str('field') ?? 'a field'}`;
    case 'form_submit': return 'Submitted the form';
    case 'form_success': return 'Joined the waitlist';
    case 'form_fail': return 'The form failed to send';
    default: return `${e.type} on ${e.path}`;
  }
}
