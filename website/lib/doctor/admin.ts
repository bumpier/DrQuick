// What the team does to a doctor's portal account, and what they see of it.
// Server-only. The waitlist pipeline stays the one place a GP is approved: the
// account's status follows the application's (accountStatusFor), and the only
// thing the team sets on the account directly is a pause.
import { and, eq, sql } from 'drizzle-orm';
import type { DB } from '@/lib/db';
import { consultations, gps, type GpAccountStatus } from '@/lib/db/schema';
import { accountStatusFor } from '@/lib/doctor/account';
import { STALE_SECONDS, dispatch } from '@/lib/doctor/dispatch';
import { ratingSummary, type RatingSummary } from '@/lib/ratings';

export type PortalAccount = {
  id: string;
  status: GpAccountStatus;
  claimed: boolean;       // they have set a password
  createdAt: Date;
  online: boolean;        // online, and their portal has checked in lately
  completed: number;      // completed consultations, ever
  rating: RatingSummary;
};

/** The portal account made from a GP's application, or null if they have not claimed one. */
export async function portalAccountFor(db: DB, signupId: string, now = new Date()): Promise<PortalAccount | null> {
  const [row] = await db.select().from(gps).where(eq(gps.signupId, signupId));
  if (!row) return null;
  const [done] = await db.select({ n: sql<number>`count(*)::int` }).from(consultations)
    .where(and(eq(consultations.gpId, row.id), eq(consultations.status, 'completed')));
  const seenLately = row.lastSeenAt !== null && row.lastSeenAt.getTime() > now.getTime() - STALE_SECONDS * 1000;
  return {
    id: row.id, status: row.status, claimed: row.passwordHash !== null, createdAt: row.createdAt,
    online: row.onlineSince !== null && seenLately,
    completed: Number(done?.n ?? 0),
    rating: await ratingSummary(db, row.id),
  };
}

// Taken off the floor: offline, out of the rotation. The dispatcher then
// expires any offer they were holding and passes it on.
const OFF_THE_FLOOR = { onlineSince: null, availableSince: null } as const;

/**
 * The application's status changed, so the account follows. Anything but
 * Active takes the doctor off the floor at once. Returns the account, or null
 * when the GP has not claimed one yet (it will start in the right status when
 * they do).
 */
export async function syncAccountStatus(
  db: DB, signupId: string, signupStatus: string, now = new Date(),
): Promise<{ id: string; claimed: boolean } | null> {
  const status = accountStatusFor(signupStatus);
  const [row] = await db.update(gps)
    .set({ status, updatedAt: now, ...(status === 'active' ? {} : OFF_THE_FLOOR) })
    .where(eq(gps.signupId, signupId))
    .returning({ id: gps.id, passwordHash: gps.passwordHash });
  if (!row) return null;
  if (status !== 'active') await dispatch(db, now, { wait: true });
  return { id: row.id, claimed: row.passwordHash !== null };
}

/**
 * Pauses an active doctor, or resumes a paused one. False when the account is
 * not in the state the change starts from (not approved yet, or no account).
 * A resumed doctor is active but offline: going online is theirs to choose.
 */
export async function setAccountPaused(db: DB, signupId: string, paused: boolean, now = new Date()): Promise<boolean> {
  const rows = await db.update(gps)
    .set({ status: paused ? 'paused' : 'active', updatedAt: now, ...(paused ? OFF_THE_FLOOR : {}) })
    .where(and(eq(gps.signupId, signupId), eq(gps.status, paused ? 'active' : 'paused')))
    .returning({ id: gps.id });
  if (rows.length === 0) return false;
  if (paused) await dispatch(db, now, { wait: true });
  return true;
}
