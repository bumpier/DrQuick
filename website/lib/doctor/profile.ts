// What a doctor edits about themselves: their name, mobile, a short bio and the
// languages they consult in. The email is the sign-in name and the GMC number
// is what the team verified, so neither is editable here; changing either is
// for the team. Server-only: the rules the form also reads are in profile-rules.
import { eq, sql } from 'drizzle-orm';
import { hashPassword, verifyPassword } from '@/lib/admin-auth';
import type { DB } from '@/lib/db';
import { gps } from '@/lib/db/schema';
import type { GpRow } from '@/lib/doctor-auth';
import { PASSWORD_MAX, PASSWORD_MIN } from '@/lib/doctor/account';
import { normaliseProfile, profileErrors, type ProfileErrors } from '@/lib/doctor/profile-rules';

export * from '@/lib/doctor/profile-rules';

export async function saveProfile(
  db: DB, gpId: string, raw: Record<string, unknown>, now = new Date(),
): Promise<{ ok: true } | { ok: false; errors: ProfileErrors }> {
  const profile = normaliseProfile(raw);
  const errors = profileErrors(profile);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  await db.update(gps).set({ ...profile, updatedAt: now }).where(eq(gps.id, gpId));
  return { ok: true };
}

/**
 * Changes the password of a signed-in doctor who knows the current one. The
 * session epoch moves on, so every session signed before stops working; the
 * caller starts a fresh one for the device that made the change.
 */
export async function changePassword(
  db: DB, gpId: string, current: string, next: string, now = new Date(),
): Promise<{ ok: true; gp: GpRow } | { ok: false; error: 'wrong_password' | 'weak_password' }> {
  const [row] = await db.select().from(gps).where(eq(gps.id, gpId));
  if (!row?.passwordHash || !verifyPassword(current, row.passwordHash)) return { ok: false, error: 'wrong_password' };
  if (next.length < PASSWORD_MIN || next.length > PASSWORD_MAX) return { ok: false, error: 'weak_password' };
  const [updated] = await db.update(gps)
    .set({ passwordHash: hashPassword(next), sessionEpoch: sql`${gps.sessionEpoch} + 1`, updatedAt: now })
    .where(eq(gps.id, gpId)).returning();
  return { ok: true, gp: updated };
}
