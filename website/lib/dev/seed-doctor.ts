// Demo data for the doctor portal, for a development machine only: one doctor
// who can sign in, with a history of consultations, payouts and ratings, a GP
// sign-up that has not claimed its account yet, and requests waiting to be
// offered. Reached through the dev-only route app/dev/doctor (`npm run
// db:seed:doctor`, `npm run doctor:request`), because local development runs on
// PGlite, which only the dev server's own process can open.
//
// Everything it writes is recognisable and is replaced on every run:
//   the doctor      demo.doctor@example.com
//   the applicant   demo.applicant@example.com
//   patients        demo-patient-N@example.com, and every consultation of theirs
//
// It refuses in production and against a database on another machine. Nothing
// here is real: the figures are synthetic and the reasons are stock phrases.
import { randomUUID } from 'node:crypto';
import { eq, inArray, like, or } from 'drizzle-orm';
import { hashPassword } from '@/lib/admin-auth';
import type { DB } from '@/lib/db';
import {
  consultationOffers, consultationRatings, consultations, doctorTokens, gps, patients, payments, payoutItems, payouts,
  waitlistSignups,
} from '@/lib/db/schema';
import { dispatch } from '@/lib/doctor/dispatch';
import { splitPrice } from '@/lib/finance/commission';
import { newToken } from '@/lib/waitlist';

export const DEMO_DOCTOR = {
  email: 'demo.doctor@example.com', password: 'demo doctor password', name: 'Dr Demo Doctor', gmc: '7999999',
};
export const DEMO_APPLICANT_EMAIL = 'demo.applicant@example.com';

const PATIENT_COUNT = 12;
const HISTORY = 44;
const WAITING = 2;
const DAY = 86_400_000;
const patientEmail = (i: number) => `demo-patient-${i + 1}@example.com`;

const REASONS = [
  'Sore throat and fever, three days', 'Rash on the forearm, one week', 'Lower back pain after lifting',
  'Cough that will not clear, two weeks', 'Earache since yesterday', 'Headaches most mornings',
  'Itchy eyes and sneezing', 'Stomach cramps after meals',
];
const AGE_BANDS = ['18 to 29', '30 to 39', '40 to 49', '50 to 59', '60 to 69'];
// Mostly fives: what a well-liked doctor's ratings look like.
const STARS = [5, 5, 5, 5, 5, 5, 4, 4, 4, 3];
const PRICES = [3200, 3600, 4000, 4400, 4800];

type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];

function assertLocal() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to write demo data in production.');
  const url = process.env.DATABASE_URL;
  if (!url) return; // PGlite, in this process
  let host = '';
  try { host = new URL(url).hostname; } catch { /* reported below */ }
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
    throw new Error(`Refusing to write demo data to ${host || 'an unknown host'}: only a local database.`);
  }
}

// The same sequence every run, so the demo looks the same each time.
function sequence(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T>(list: readonly T[], r: number): T => list[Math.floor(r * list.length)];

async function clear(tx: Tx) {
  const demoGps = (await tx.select({ id: gps.id }).from(gps).where(eq(gps.email, DEMO_DOCTOR.email))).map((g) => g.id);
  const demoPatients = (await tx.select({ id: patients.id }).from(patients)
    .where(like(patients.email, 'demo-patient-%@example.com'))).map((p) => p.id);
  const conditions = [
    ...(demoGps.length ? [inArray(consultations.gpId, demoGps)] : []),
    ...(demoPatients.length ? [inArray(consultations.patientId, demoPatients)] : []),
  ];
  const ids = conditions.length
    ? (await tx.select({ id: consultations.id }).from(consultations).where(or(...conditions))).map((c) => c.id)
    : [];
  if (ids.length) {
    await tx.delete(consultationRatings).where(inArray(consultationRatings.consultationId, ids));
    await tx.delete(consultationOffers).where(inArray(consultationOffers.consultationId, ids));
    await tx.delete(payoutItems).where(inArray(payoutItems.consultationId, ids));
    await tx.delete(payments).where(inArray(payments.consultationId, ids));
    await tx.delete(consultations).where(inArray(consultations.id, ids));
  }
  if (demoGps.length) {
    await tx.delete(consultationOffers).where(inArray(consultationOffers.gpId, demoGps));
    await tx.delete(payouts).where(inArray(payouts.gpId, demoGps));
    await tx.delete(gps).where(inArray(gps.id, demoGps));
  }
  if (demoPatients.length) await tx.delete(patients).where(inArray(patients.id, demoPatients));
  const emails = [DEMO_DOCTOR.email, DEMO_APPLICANT_EMAIL];
  await tx.delete(doctorTokens).where(inArray(doctorTokens.email, emails));
  await tx.delete(waitlistSignups).where(inArray(waitlistSignups.email, emails));
}

function waitingRow(patientId: string, now: Date, r: () => number) {
  const pricePence = pick(PRICES, r());
  return {
    id: randomUUID(), patientId, status: 'requested' as const, requestedAt: now, pricePence,
    // Provisional until a doctor accepts; the accept writes the split they were quoted.
    ...splitPrice(pricePence, 0),
    reason: pick(REASONS, r()), ageBand: pick(AGE_BANDS, r()), recordConsent: r() > 0.2,
  };
}

// In the real flow the patient's card is held on request and captured at the
// match. There is no payment flow here, so the demo marks it paid up front;
// otherwise a consultation completed in the demo would never show as earned.
const paidFor = (c: { id: string; pricePence: number }, when: Date) => ({
  consultationId: c.id, amountPence: c.pricePence, status: 'succeeded' as const, paidAt: when, createdAt: when,
});

export type SeedResult = {
  doctor: { email: string; password: string };
  applicant: { email: string };
  consultations: number;
  waiting: number;
};

export async function seedDoctorDemo(db: DB, now = new Date()): Promise<SeedResult> {
  assertLocal();
  const r = sequence(20261001);

  return db.transaction(async (tx) => {
    await clear(tx);

    const signup = (name: string, email: string, gmc: string) => ({
      role: 'gp' as const, email, name, gmc, mobile: '07700900123', source: 'demo', status: 'active',
      unsubscribeToken: newToken(), createdAt: new Date(now.getTime() - 70 * DAY), updatedAt: now,
    });
    const [doctorSignup] = await tx.insert(waitlistSignups).values([
      signup(DEMO_DOCTOR.name, DEMO_DOCTOR.email, DEMO_DOCTOR.gmc),
      signup('Dr Demo Applicant', DEMO_APPLICANT_EMAIL, '7999998'),
    ]).returning();

    const [doctor] = await tx.insert(gps).values({
      signupId: doctorSignup.id, name: DEMO_DOCTOR.name, email: DEMO_DOCTOR.email, gmc: DEMO_DOCTOR.gmc, status: 'active',
      passwordHash: hashPassword(DEMO_DOCTOR.password), mobile: '07700900123',
      bio: 'A demo account for trying the portal.', languages: 'English',
      createdAt: new Date(now.getTime() - 60 * DAY), updatedAt: now,
    }).returning();

    const people = await tx.insert(patients)
      .values(Array.from({ length: PATIENT_COUNT }, (_, i) => ({ email: patientEmail(i) }))).returning();

    // Oldest first, so each fee is split at the tier the doctor held by then.
    let served = 0;
    const history = Array.from({ length: HISTORY }, (_, i) => {
      const requestedAt = new Date(now.getTime() - (56 - i * 1.25) * DAY + Math.floor(r() * 8 * 3_600_000));
      const startedAt = new Date(requestedAt.getTime() + 60_000 + Math.floor(r() * 60_000));
      const noShow = i % 15 === 7;
      const pricePence = pick(PRICES, r());
      const row = {
        id: randomUUID(), patientId: pick(people, r()).id, gpId: doctor.id,
        status: noShow ? 'no_show' as const : 'completed' as const,
        requestedAt, startedAt, endedAt: new Date(startedAt.getTime() + (noShow ? 5 : 6 + Math.floor(r() * 9)) * 60_000),
        pricePence, ...splitPrice(pricePence, served),
        reason: pick(REASONS, r()), ageBand: pick(AGE_BANDS, r()), recordConsent: r() > 0.2,
      };
      if (!noShow) served += 1;
      return row;
    });
    await tx.insert(consultations).values(history);
    const completed = history.filter((c) => c.status === 'completed');
    await tx.insert(payments).values(completed.map((c) => paidFor(c, c.startedAt)));

    // Weekly payouts, counted back from now. The last seven days are not in a
    // payout yet, the week before is on its way, and everything older is paid.
    for (let week = 1; week <= 8; week += 1) {
      const periodEnd = new Date(now.getTime() - week * 7 * DAY);
      const periodStart = new Date(periodEnd.getTime() - 7 * DAY);
      const inPeriod = completed.filter((c) => c.endedAt >= periodStart && c.endedAt < periodEnd);
      if (inPeriod.length === 0) continue;
      const paid = week > 1;
      const [payout] = await tx.insert(payouts).values({
        gpId: doctor.id, periodStart, periodEnd, amountPence: inPeriod.reduce((sum, c) => sum + c.gpFeePence, 0),
        status: paid ? 'paid' : 'processing', paidAt: paid ? new Date(periodEnd.getTime() + 2 * DAY) : null,
        createdAt: periodEnd,
      }).returning();
      await tx.insert(payoutItems).values(inPeriod.map((c) => ({ payoutId: payout.id, consultationId: c.id })));
    }

    const rated = completed.filter(() => r() < 0.75);
    await tx.insert(consultationRatings).values(rated.map((c) => ({
      consultationId: c.id, gpId: doctor.id, stars: pick(STARS, r()), createdAt: new Date(c.endedAt.getTime() + 5 * 60_000),
    })));

    const waiting = Array.from({ length: WAITING }, (_, i) =>
      waitingRow(people[i].id, new Date(now.getTime() - (WAITING - i) * 1000), r));
    await tx.insert(consultations).values(waiting);
    await tx.insert(payments).values(waiting.map((c) => paidFor(c, c.requestedAt)));

    return {
      doctor: { email: DEMO_DOCTOR.email, password: DEMO_DOCTOR.password },
      applicant: { email: DEMO_APPLICANT_EMAIL },
      consultations: history.length + waiting.length,
      waiting: waiting.length,
    };
  });
}

/** One more patient asks for a GP, now, and the dispatcher is told. */
export async function addWaitingRequest(db: DB, now = new Date()): Promise<{ consultationId: string; pricePence: number }> {
  assertLocal();
  const r = sequence(now.getTime() % 2_147_483_647);
  const email = patientEmail(Math.floor(r() * PATIENT_COUNT));
  await db.insert(patients).values({ email }).onConflictDoNothing();
  const [patient] = await db.select().from(patients).where(eq(patients.email, email));
  const row = waitingRow(patient.id, now, r);
  await db.insert(consultations).values(row);
  await db.insert(payments).values(paidFor(row, now));
  // Whatever creates a consultation runs the dispatcher (lib/doctor/dispatch.ts).
  await dispatch(db, now, { wait: true });
  return { consultationId: row.id, pricePence: row.pricePence };
}
