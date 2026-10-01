import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { resetDb, useTestDb } from './helpers/db';
import { setDb, type DB } from '@/lib/db';
import { consultationOffers, consultationRatings, consultations, gps, payments, payoutItems, payouts, waitlistSignups } from '@/lib/db/schema';
import { verifyDoctorCredentials } from '@/lib/doctor-auth';
import { requestSetPasswordLink } from '@/lib/doctor/account';
import { shiftState } from '@/lib/doctor/shift';
import { DEMO_APPLICANT_EMAIL, DEMO_DOCTOR, addWaitingRequest, seedDoctorDemo } from '@/lib/dev/seed-doctor';
import { POST as devRoute } from '@/app/dev/doctor/route';

const NOW = new Date('2026-10-01T09:00:00Z');

let db: DB;
beforeAll(async () => { db = await useTestDb(); });
beforeEach(async () => {
  vi.unstubAllEnvs();
  vi.stubEnv('RESEND_API_KEY', '');
  setDb(db);
  await resetDb(db);
});

describe('the demo data', () => {
  test('makes a doctor who can sign in and go straight online', async () => {
    await seedDoctorDemo(db, NOW);
    const doctor = await verifyDoctorCredentials(db, DEMO_DOCTOR.email, DEMO_DOCTOR.password);
    expect(doctor).toMatchObject({ status: 'active' });
    expect(await shiftState(db, doctor!.id, NOW)).toEqual({ kind: 'offline' });
  });

  test('gives them a history: completed consultations, each paid for, with payouts and ratings', async () => {
    await seedDoctorDemo(db, NOW);
    const [doctor] = await db.select().from(gps).where(eq(gps.email, DEMO_DOCTOR.email));
    const mine = await db.select().from(consultations).where(eq(consultations.gpId, doctor.id));
    const completed = mine.filter((c) => c.status === 'completed');
    expect(completed.length).toBeGreaterThanOrEqual(30);
    expect(mine.some((c) => c.status === 'no_show')).toBe(true);

    const paid = await db.select().from(payments).where(eq(payments.status, 'succeeded'));
    for (const c of completed) expect(paid.some((p) => p.consultationId === c.id && p.amountPence === c.pricePence)).toBe(true);
    // Each fee is the commission split of its price, never a typed figure.
    for (const c of completed) expect(c.gpFeePence + c.platformFeePence).toBe(c.pricePence);

    const paidOut = await db.select().from(payouts).where(eq(payouts.gpId, doctor.id));
    expect(paidOut.map((p) => p.status).sort()).toContain('paid');
    const items = await db.select().from(payoutItems);
    for (const p of paidOut) {
      const fees = items.filter((i) => i.payoutId === p.id)
        .map((i) => completed.find((c) => c.id === i.consultationId)!.gpFeePence);
      expect(fees.reduce((a, b) => a + b, 0)).toBe(p.amountPence);
    }
    // Some recent work is not in any payout yet, so "awaiting payout" is not empty.
    expect(completed.some((c) => !items.some((i) => i.consultationId === c.id))).toBe(true);

    const ratings = await db.select().from(consultationRatings).where(eq(consultationRatings.gpId, doctor.id));
    expect(ratings.length).toBeGreaterThanOrEqual(5);
    for (const r of ratings) {
      expect(r.stars).toBeGreaterThanOrEqual(1);
      expect(r.stars).toBeLessThanOrEqual(5);
      expect(completed.some((c) => c.id === r.consultationId)).toBe(true);
    }
  });

  test('leaves a GP sign-up that has not claimed its account, to try the emailed link with', async () => {
    await seedDoctorDemo(db, NOW);
    const [signup] = await db.select().from(waitlistSignups).where(eq(waitlistSignups.email, DEMO_APPLICANT_EMAIL));
    expect(signup).toMatchObject({ role: 'gp', status: 'active' });
    expect(await requestSetPasswordLink(db, DEMO_APPLICANT_EMAIL, NOW)).toBe(true);
  });

  test('running it twice replaces the demo data rather than doubling it', async () => {
    const first = await seedDoctorDemo(db, NOW);
    const second = await seedDoctorDemo(db, NOW);
    expect(second.consultations).toBe(first.consultations);
    expect(await db.select().from(gps)).toHaveLength(1);
    expect(await db.select().from(consultations)).toHaveLength(first.consultations);
  });

  test('a waiting request reaches a doctor who is online', async () => {
    await seedDoctorDemo(db, NOW);
    const [doctor] = await db.select().from(gps).where(eq(gps.email, DEMO_DOCTOR.email));
    await db.update(gps).set({ onlineSince: NOW, lastSeenAt: NOW, availableSince: NOW }).where(eq(gps.id, doctor.id));
    await addWaitingRequest(db, NOW);
    const [offer] = await db.select().from(consultationOffers);
    expect(offer).toMatchObject({ gpId: doctor.id, status: 'offered' });
    expect(await shiftState(db, doctor.id, NOW)).toMatchObject({ kind: 'offer' });
  });
});

describe('where it may run', () => {
  test('never in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await expect(seedDoctorDemo(db, NOW)).rejects.toThrow(/production/);
    await expect(addWaitingRequest(db, NOW)).rejects.toThrow(/production/);
    const response = await devRoute(new Request('http://localhost/dev/doctor?do=seed', { method: 'POST' }));
    expect(response.status).toBe(404);
    expect(await db.select().from(gps)).toHaveLength(0);
  });

  test('never against a database on another machine', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@db.internal.example:5432/drquick');
    await expect(seedDoctorDemo(db, NOW)).rejects.toThrow(/local/);
  });

  test('the route seeds, adds a request, and refuses anything else', async () => {
    const post = (action: string) => devRoute(new Request(`http://localhost/dev/doctor?do=${action}`, { method: 'POST' }));
    const seeded = await post('seed');
    expect(seeded.status).toBe(200);
    expect(await seeded.json()).toMatchObject({ doctor: { email: DEMO_DOCTOR.email } });
    expect((await post('request')).status).toBe(200);
    expect((await post('drop-everything')).status).toBe(400);
  });
});
