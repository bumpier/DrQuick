// The presenter's Reset and status line (app/dev/demo). Reset leaves the demo
// as it was before the first run: no consultation live or waiting, no call
// open, the demo doctor offline with their history intact.
import { eq, sql } from 'drizzle-orm';
import type { DB } from '@/lib/db';
import { consultations, gps } from '@/lib/db/schema';
import { DEMO_DOCTOR, assertLocal, seedDoctorDemo, type SeedResult } from '@/lib/dev/seed-doctor';
import { shiftState } from '@/lib/doctor/shift';
import { rowsOf } from '@/lib/rate-limit';
import { retireRoom, sweepCalls } from '@/lib/video/calls';

/**
 * Ends what is live, then re-seeds. A call is closed the way the app closes
 * one: its consultation stops being in progress, sweepCalls closes the call and
 * clears both keys, and its room is retired so both people are disconnected.
 */
export async function resetDemo(db: DB, now = new Date()): Promise<SeedResult> {
  assertLocal();
  const open = rowsOf<{ room: string }>(await db.execute(sql`select room from consultation_calls where closed_at is null`));
  await db.execute(sql`update consultations set status = 'cancelled', ended_at = ${now.toISOString()}::timestamptz
    where status in ('in_progress', 'requested')`);
  await sweepCalls(db, now);
  for (const { room } of open) await retireRoom(db, room, now);

  const seeded = await seedDoctorDemo(db, now);

  // The seed leaves requests waiting for the portal's own demo; here the
  // patient's own request is the one that reaches the doctor.
  await db.execute(sql`update consultations set status = 'cancelled' where status = 'requested'`);
  // The seed gives the demo doctor a new id, so the presenter's cookie no longer
  // matches and they sign in again; the sign-in limit counts successes too (5 per
  // 10 minutes, key prefix rl:doctor in lib/doctor-auth.ts), so it is cleared or
  // a few resets would lock them out.
  await db.execute(sql`delete from rate_limits where key like 'rl:doctor:%'`);
  return { ...seeded, consultations: seeded.consultations - seeded.waiting, waiting: 0 };
}

export type DemoStatus = {
  doctor: 'offline' | 'online' | 'offer' | 'consultation' | 'resting';
  consultation: { id: string; status: string } | null;
};

export async function demoStatus(db: DB, now = new Date()): Promise<DemoStatus> {
  const [doctor] = await db.select({ id: gps.id }).from(gps).where(eq(gps.email, DEMO_DOCTOR.email));
  if (!doctor) return { doctor: 'offline', consultation: null };
  const state = await shiftState(db, doctor.id, now);
  switch (state.kind) {
    case 'idle': return { doctor: 'online', consultation: null };
    case 'offer': return { doctor: 'offer', consultation: null };
    case 'resting': return { doctor: 'resting', consultation: null };
    case 'consultation': {
      const [row] = await db.select({ id: consultations.id, status: consultations.status })
        .from(consultations).where(eq(consultations.id, state.consultationId));
      return { doctor: 'consultation', consultation: row ?? null };
    }
    default: return { doctor: 'offline', consultation: null };
  }
}
