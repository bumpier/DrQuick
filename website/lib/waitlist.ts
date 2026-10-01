// The waitlist in Postgres: joining, and the reads and edits the admin makes.
// Server-only. The API route (app/api/waitlist) validates the input; this file
// only stores it.
import { randomBytes } from 'node:crypto';
import { and, asc, eq, inArray, isNotNull, isNull, ne, or, sql } from 'drizzle-orm';
import type { DB } from '@/lib/db';
import { audit } from '@/lib/admin/audit';
import {
  consultationOffers, consultations, doctorTokens, emailLog, events, gps, sessions, visitors, waitlistSignups,
  type PendingDetails, type WaitlistRole,
} from '@/lib/db/schema';
import { expireFeeCheckout } from '@/lib/stripe';

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

export type GpStartInput = { email: string; source: string; name: string; mobile: string; gmc: string } & Attribution;

// A GP submitting the sign-up: the row is written before the payment, marked
// 'unpaid', so a doctor who leaves Stripe's page half way is someone the team
// can see and follow up rather than someone who vanished. The fee is marked
// paid by lib/gp-fee-store when Stripe confirms it.
//
// A doctor coming back to finish reuses their row, and the row is NOT rewritten
// by the form: it keeps the first details submitted for the address. Anyone can
// type anyone's email, so letting a later post replace the details would let a
// stranger rewrite an application. What a later post typed is kept beside the
// checkout it started (recordFeeCheckout) and takes effect only if that
// checkout is paid (lib/gp-fee-store.ts).
export async function startGpSignup(db: DB, input: GpStartInput): Promise<{ signup: Signup; alreadyPaid: boolean }> {
  const inserted = await db.insert(waitlistSignups).values({
    role: 'gp',
    email: input.email,
    name: input.name,
    mobile: input.mobile,
    gmc: input.gmc,
    source: input.source,
    status: 'new',
    feeStatus: 'unpaid',
    visitorId: input.visitorId ?? null,
    utmSource: input.utmSource ?? null,
    utmMedium: input.utmMedium ?? null,
    utmCampaign: input.utmCampaign ?? null,
    referrer: input.referrer ?? null,
    landingPath: input.landingPath ?? null,
    unsubscribeToken: newToken(),
  }).onConflictDoNothing().returning();
  if (inserted[0]) return { signup: inserted[0], alreadyPaid: false };

  const mine = and(eq(waitlistSignups.role, 'gp'), eq(waitlistSignups.email, input.email));
  const [existing] = await db.select().from(waitlistSignups).where(mine);
  if (existing.feeStatus === 'paid') return { signup: existing, alreadyPaid: true };

  // A GP from before the fee existed has no fee status; they owe it now.
  if (existing.feeStatus) return { signup: existing, alreadyPaid: false };
  const [updated] = await db.update(waitlistSignups).set({ feeStatus: 'unpaid', updatedAt: new Date() })
    .where(mine).returning();
  return { signup: updated, alreadyPaid: false };
}

// How many started checkouts a sign-up remembers the typed details of.
const PENDING_KEPT = 5;

// A checkout has been started for this sign-up: remember its id (the admin
// shows that one was started) and the details typed with it, which become the
// application's only if this checkout is the one that gets paid. Never touches
// a sign-up that is already paid.
export async function recordFeeCheckout(
  db: DB, signup: Signup, sessionId: string, details: PendingDetails,
): Promise<void> {
  const kept = Object.entries(signup.pendingDetails ?? {}).slice(-(PENDING_KEPT - 1));
  await db.update(waitlistSignups).set({
    stripeCheckoutSessionId: sessionId,
    pendingDetails: { ...Object.fromEntries(kept), [sessionId]: details },
    updatedAt: new Date(),
  }).where(and(
    eq(waitlistSignups.id, signup.id),
    or(isNull(waitlistSignups.feeStatus), ne(waitlistSignups.feeStatus, 'paid')),
  ));
}

export async function allSignups(db: DB): Promise<Signup[]> {
  return db.select().from(waitlistSignups).orderBy(asc(waitlistSignups.createdAt));
}

// A right-to-erasure request: every sign-up for the address, the analytics of
// any visitor those sign-ups were linked to, and the email log rows naming it.
// One transaction, so an erasure never half-happens. Returns sign-ups removed.
export async function erasePerson(db: DB, email: string): Promise<number> {
  // A GP with a checkout still open could otherwise pay after their details
  // are gone, leaving money with nothing to attach it to. Close it first; this
  // is best effort and never stops the erasure.
  const open = await db.select({ sessionId: waitlistSignups.stripeCheckoutSessionId }).from(waitlistSignups)
    .where(and(eq(waitlistSignups.email, email), eq(waitlistSignups.feeStatus, 'unpaid'), isNotNull(waitlistSignups.stripeCheckoutSessionId)));
  for (const { sessionId } of open) await expireFeeCheckout(sessionId);

  return db.transaction(async (tx) => {
    // A GP's portal account goes too. One that never took a consultation is
    // deleted outright. One that did is the payee on financial records the
    // business has to keep, so the row stays with the name and GMC number
    // those records need and loses everything else: the sign-in, the address,
    // the mobile, the profile. They can no longer sign in.
    const now = new Date();
    for (const { id } of await tx.select({ id: gps.id }).from(gps).where(eq(gps.email, email))) {
      await tx.delete(consultationOffers).where(and(eq(consultationOffers.gpId, id), eq(consultationOffers.status, 'offered')));
      const [taken] = await tx.select({ id: consultations.id }).from(consultations).where(eq(consultations.gpId, id)).limit(1);
      if (!taken) {
        await tx.delete(consultationOffers).where(eq(consultationOffers.gpId, id));
        await tx.delete(gps).where(eq(gps.id, id));
      } else {
        await tx.update(gps).set({
          email: `erased+${id}@drquick.invalid`, signupId: null, status: 'offboarded', passwordHash: null,
          sessionEpoch: sql`${gps.sessionEpoch} + 1`, mobile: null, bio: '', languages: '',
          onlineSince: null, lastSeenAt: null, availableSince: null, updatedAt: now,
        }).where(eq(gps.id, id));
      }
    }
    await tx.delete(doctorTokens).where(eq(doctorTokens.email, email));

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
  // A GP who had paid the sign-up fee leaves a trace of that, so a withdrawal
  // with money attached never vanishes without the team being able to see it.
  await audit(db, 'self-service', 'self_erasure', signup.id, {
    role: signup.role, ...(signup.feeStatus ? { feeStatus: signup.feeStatus } : {}),
  });
  return { ok: true, role: signup.role };
}
