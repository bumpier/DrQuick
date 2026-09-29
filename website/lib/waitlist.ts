// The waitlist in Postgres: joining, and the reads and edits the admin makes.
// Server-only. The API route (app/api/waitlist) validates the input; this file
// only stores it.
import { randomBytes } from 'node:crypto';
import { and, asc, eq, inArray, isNotNull } from 'drizzle-orm';
import type { DB } from '@/lib/db';
import { audit } from '@/lib/admin/audit';
import { emailLog, events, sessions, visitors, waitlistSignups, type WaitlistRole } from '@/lib/db/schema';

export type Signup = typeof waitlistSignups.$inferSelect;

export type Attribution = {
  visitorId?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  referrer?: string | null;
  landingPath?: string | null;
};

export type JoinInput = {
  role: WaitlistRole;
  email: string;
  source: string;
  name?: string;
  mobile?: string;
  gmc?: string;
} & Attribution;

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Attribution arrives from the browser, so every field is optional, trimmed
// and capped; a malformed visitor id is dropped rather than rejected.
export function cleanAttribution(raw: Record<string, unknown>): Attribution {
  const text = (v: unknown, max: number) => {
    const s = typeof v === 'string' ? v.trim().slice(0, max) : '';
    return s || null;
  };
  const visitorId = typeof raw.visitorId === 'string' && UUID.test(raw.visitorId) ? raw.visitorId.toLowerCase() : null;
  return {
    visitorId,
    utmSource: text(raw.utmSource, 100),
    utmMedium: text(raw.utmMedium, 100),
    utmCampaign: text(raw.utmCampaign, 100),
    referrer: text(raw.referrer, 500),
    landingPath: text(raw.landingPath, 300),
  };
}

export const newToken = () => randomBytes(24).toString('base64url');

// A repeat sign-up for the same role and email changes nothing and reports
// alreadyJoined, exactly as the Redis SADD did.
export async function joinWaitlist(db: DB, input: JoinInput): Promise<{ signup: Signup; alreadyJoined: boolean }> {
  const inserted = await db.insert(waitlistSignups).values({
    role: input.role,
    email: input.email,
    name: input.name ?? null,
    mobile: input.mobile ?? null,
    gmc: input.gmc ?? null,
    source: input.source,
    status: input.role === 'gp' ? 'new' : 'subscribed',
    visitorId: input.visitorId ?? null,
    utmSource: input.utmSource ?? null,
    utmMedium: input.utmMedium ?? null,
    utmCampaign: input.utmCampaign ?? null,
    referrer: input.referrer ?? null,
    landingPath: input.landingPath ?? null,
    unsubscribeToken: newToken(),
  }).onConflictDoNothing().returning();

  if (inserted[0]) return { signup: inserted[0], alreadyJoined: false };
  const [existing] = await db.select().from(waitlistSignups)
    .where(and(eq(waitlistSignups.role, input.role), eq(waitlistSignups.email, input.email)));
  return { signup: existing, alreadyJoined: true };
}

export async function allSignups(db: DB): Promise<Signup[]> {
  return db.select().from(waitlistSignups).orderBy(asc(waitlistSignups.createdAt));
}

// A right-to-erasure request: every sign-up for the address, the analytics of
// any visitor those sign-ups were linked to, and the email log rows naming it.
// One transaction, so an erasure never half-happens. Returns sign-ups removed.
export async function erasePerson(db: DB, email: string): Promise<number> {
  return db.transaction(async (tx) => {
    const gone = await tx.delete(waitlistSignups).where(eq(waitlistSignups.email, email))
      .returning({ id: waitlistSignups.id, visitorId: waitlistSignups.visitorId });
    const visitorIds = gone.map((g) => g.visitorId).filter((v): v is string => v !== null);
    if (visitorIds.length) {
      await tx.delete(events).where(and(isNotNull(events.visitorId), inArray(events.visitorId, visitorIds)));
      await tx.delete(sessions).where(and(isNotNull(sessions.visitorId), inArray(sessions.visitorId, visitorIds)));
      await tx.delete(visitors).where(inArray(visitors.id, visitorIds));
    }
    await tx.delete(emailLog).where(eq(emailLog.to, email));
    // The team's "new GP" alerts name the applicant too; they hang off the sign-up id.
    const ids = gone.map((g) => g.id);
    if (ids.length) await tx.delete(emailLog).where(inArray(emailLog.signupId, ids));
    return gone.length;
  });
}

// The sign-up an unsubscribe link belongs to, or null for an unknown, used or
// malformed token. Tokens are 32 base64url characters (newToken).
export async function findByToken(db: DB, token: string | null | undefined): Promise<Signup | null> {
  if (!token || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const [row] = await db.select().from(waitlistSignups).where(eq(waitlistSignups.unsubscribeToken, token));
  return row ?? null;
}

// The emails promise "Unsubscribe and we will delete it" (patients) and
// "Withdraw and delete my details" (GPs), so confirming the link erases the
// person, not just flags them. The audit row keeps the sign-up id and role and
// never the address. Only ever called on an explicit confirm (a POST): mail
// scanners fetch every link in a message, so a GET must change nothing.
export async function unsubscribeByToken(db: DB, token: string): Promise<{ ok: true; role: WaitlistRole } | { ok: false }> {
  const signup = await findByToken(db, token);
  if (!signup) return { ok: false };
  await erasePerson(db, signup.email);
  await audit(db, 'self-service', 'self_erasure', signup.id, { role: signup.role });
  return { ok: true, role: signup.role };
}
