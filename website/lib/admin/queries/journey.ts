// A visitor's journey: their most recent sessions, newest first, each with its
// events in order; lib/admin/timeline.ts turns it into sentences. Server-only.
// Only visitors who accepted analytics cookies have an id, so a sign-up
// without a visitor id has no journey to show.
import { desc, eq, inArray } from 'drizzle-orm';
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
    .orderBy(desc(sessions.startedAt)).limit(JOURNEY_SESSION_LIMIT);
  const ids = list.map((s) => s.id);
  const evts = ids.length
    ? await db.select().from(events).where(inArray(events.sessionId, ids))
      .orderBy(desc(events.ts), desc(events.id)).limit(JOURNEY_EVENT_LIMIT + 1)
    : [];
  const truncated = evts.length > JOURNEY_EVENT_LIMIT || list.length === JOURNEY_SESSION_LIMIT;
  // The newest events are the ones kept; each session's list is then oldest first.
  const kept = evts.slice(0, JOURNEY_EVENT_LIMIT).reverse();
  return {
    visitor: visitor ?? null,
    sessions: list.map((s) => ({ ...s, events: kept.filter((e) => e.sessionId === s.id) })),
    truncated,
  };
}
