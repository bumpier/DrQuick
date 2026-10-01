import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import { resetDb, useTestDb } from './helpers/db';
import { setDb, type DB } from '@/lib/db';
import { consultationOffers, consultations, gps } from '@/lib/db/schema';

const jar = new Map<string, { value: string; opts?: Record<string, unknown> }>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)!.value } : undefined),
    set: (name: string, value: string, opts?: Record<string, unknown>) => { jar.set(name, { value, opts }); },
    delete: (arg: string | { name: string }) => { jar.delete(typeof arg === 'string' ? arg : arg.name); },
  }),
  headers: async () => new Headers(),
}));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => { throw Object.assign(new Error(`NEXT_REDIRECT ${to}`), { digest: `NEXT_REDIRECT;${to}` }); },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { hashPassword } from '@/lib/admin-auth';
import { DOCTOR_COOKIE, signDoctorSession } from '@/lib/doctor-auth';
import { GRACE_SECONDS, OFFER_SECONDS, dispatch } from '@/lib/doctor/dispatch';
import {
  acceptOffer, backOnline, completeConsultation, declineOffer, goOffline, goOnline, markNoShow, pulse, shiftState,
} from '@/lib/doctor/shift';
import { splitPrice } from '@/lib/finance/commission';
import { signOut } from '@/app/doctor/actions';
import { acceptAction, completeAction, goOnlineAction } from '@/app/doctor/(portal)/shift-actions';
import { POST as pulseRoute } from '@/app/doctor/pulse/route';

const NOW = new Date('2026-10-01T09:00:00Z');
const at = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);
const WINDOW = OFFER_SECONDS + GRACE_SECONDS;

let db: DB;
beforeAll(async () => { db = await useTestDb(); });

let n = 0;
beforeEach(async () => {
  vi.unstubAllEnvs();
  setDb(db);
  vi.stubEnv('DOCTOR_SESSION_SECRET', 'd'.repeat(40));
  jar.clear();
  n = 0;
  await resetDb(db);
});

type GpInsert = typeof gps.$inferInsert;
type ConsultationInsert = typeof consultations.$inferInsert;

async function doctor(over: Partial<GpInsert> = {}) {
  n += 1;
  const [row] = await db.insert(gps).values({
    name: `GP ${n}`, email: `gp${n}@example.com`, gmc: String(7000000 + n), status: 'active',
    passwordHash: hashPassword('correct horse battery'),
    onlineSince: at(-600), lastSeenAt: NOW, availableSince: at(-600 + n), ...over,
  }).returning();
  return row;
}
const offlineDoctor = (over: Partial<GpInsert> = {}) => doctor({ onlineSince: null, lastSeenAt: null, availableSince: null, ...over });

async function request(over: Partial<ConsultationInsert> = {}) {
  const [row] = await db.insert(consultations).values({
    patientId: randomUUID(), status: 'requested', requestedAt: at(-30), pricePence: 4000, ...splitPrice(4000, 0),
    reason: 'Sore throat, three days', ageBand: '30 to 39', recordConsent: true, ...over,
  }).returning();
  return row;
}

const beat = (when: Date) => db.update(gps).set({ lastSeenAt: when });
const offers = () => db.select().from(consultationOffers).orderBy(asc(consultationOffers.offeredAt));
const gp = async (id: string) => (await db.select().from(gps).where(eq(gps.id, id)))[0];
const consultation = async (id: string) => (await db.select().from(consultations).where(eq(consultations.id, id)))[0];

// A doctor, a request, and the request on offer to that doctor.
async function onOffer() {
  const d = await doctor();
  const c = await request();
  await dispatch(db, NOW);
  const [offer] = await offers();
  return { d, c, offer };
}
const signInAs = (d: { id: string; sessionEpoch: number }) => jar.set(DOCTOR_COOKIE, { value: signDoctorSession(d)! });

describe('going online', () => {
  test('an active doctor goes online and is offered a waiting request at once', async () => {
    const d = await offlineDoctor();
    await request();
    expect(await goOnline(db, d.id, NOW)).toEqual({ ok: true });
    expect(await shiftState(db, d.id, NOW)).toMatchObject({
      kind: 'offer', feePence: 2400, reason: 'Sore throat, three days', ageBand: '30 to 39', recordConsent: true,
      remainingMs: OFFER_SECONDS * 1000, windowSeconds: OFFER_SECONDS,
    });
  });

  test('with nothing waiting, an online doctor is idle', async () => {
    const d = await offlineDoctor();
    await goOnline(db, d.id, NOW);
    expect(await shiftState(db, d.id, NOW)).toMatchObject({ kind: 'idle' });
    expect((await gp(d.id)).onlineSince?.getTime()).toBe(NOW.getTime());
  });

  test.each(['onboarding', 'paused'] as const)('a doctor who is %s cannot go online, and is told why', async (status) => {
    const d = await offlineDoctor({ status });
    expect(await goOnline(db, d.id, NOW)).toEqual({ ok: false, reason: 'not_active' });
    expect((await gp(d.id)).onlineSince).toBeNull();
    expect(await shiftState(db, d.id, NOW)).toEqual({ kind: 'unavailable', reason: status });
  });

  test('a doctor who has not gone online is offline', async () => {
    const d = await offlineDoctor();
    expect(await shiftState(db, d.id, NOW)).toEqual({ kind: 'offline' });
  });
});

describe('an offer', () => {
  test('accepting takes the consultation, at the fee that was quoted', async () => {
    const { d, c, offer } = await onOffer();
    expect(await acceptOffer(db, d.id, offer.id, at(10))).toEqual({ ok: true });

    expect(await consultation(c.id)).toMatchObject({ status: 'in_progress', gpId: d.id, gpFeePence: 2400, platformFeePence: 1600 });
    expect((await consultation(c.id)).startedAt?.getTime()).toBe(at(10).getTime());
    expect((await offers())[0]).toMatchObject({ status: 'accepted' });
    expect((await gp(d.id)).availableSince).toBeNull();
    expect(await shiftState(db, d.id, at(70))).toMatchObject({
      kind: 'consultation', consultationId: c.id, feePence: 2400, elapsedMs: 60_000, reason: 'Sore throat, three days',
    });
  });

  test('a second click on Accept changes nothing and is still a yes', async () => {
    const { d, c, offer } = await onOffer();
    await acceptOffer(db, d.id, offer.id, at(10));
    expect(await acceptOffer(db, d.id, offer.id, at(11))).toEqual({ ok: true });
    expect((await consultation(c.id)).startedAt?.getTime()).toBe(at(10).getTime());
  });

  test('the countdown the doctor sees ends before the stored window does, so a last-second click lands', async () => {
    const { d, offer } = await onOffer();
    expect(await shiftState(db, d.id, at(OFFER_SECONDS - 1))).toMatchObject({ kind: 'offer', remainingMs: 1000 });
    expect(await shiftState(db, d.id, at(OFFER_SECONDS))).toMatchObject({ kind: 'offer', remainingMs: 0 });
    expect(await acceptOffer(db, d.id, offer.id, at(OFFER_SECONDS + 1))).toEqual({ ok: true });
  });

  test('accepting at the moment the stored window ends is too late, and nothing is half done', async () => {
    const { d, c, offer } = await onOffer();
    expect(await acceptOffer(db, d.id, offer.id, at(WINDOW))).toEqual({ ok: false, reason: 'expired' });
    expect(await consultation(c.id)).toMatchObject({ status: 'requested', gpId: null });
    expect((await offers())[0].status).toBe('offered'); // the dispatcher expires it, not the click
  });

  test('another doctor cannot accept it, and neither can a made-up id', async () => {
    const { c, offer } = await onOffer();
    const other = await doctor();
    expect(await acceptOffer(db, other.id, offer.id, at(5))).toEqual({ ok: false, reason: 'not_found' });
    expect(await acceptOffer(db, other.id, 'not-a-uuid', at(5))).toEqual({ ok: false, reason: 'not_found' });
    expect(await consultation(c.id)).toMatchObject({ status: 'requested', gpId: null });
  });

  // Written after the guard existed, so it has never been seen to fail: it pins
  // the behaviour rather than proving the guard.
  test.each(['paused', 'onboarding'] as const)('a doctor the team has made %s cannot accept an offer they are still holding', async (status) => {
    const { d, c, offer } = await onOffer();
    await db.update(gps).set({ status }).where(eq(gps.id, d.id));
    expect(await acceptOffer(db, d.id, offer.id, at(5))).toEqual({ ok: false, reason: 'not_active' });
    expect(await consultation(c.id)).toMatchObject({ status: 'requested', gpId: null });
  });

  test('accepting after the patient cancelled leaves nothing half done', async () => {
    const { d, c, offer } = await onOffer();
    await db.update(consultations).set({ status: 'cancelled' }).where(eq(consultations.id, c.id));
    expect(await acceptOffer(db, d.id, offer.id, at(5))).toEqual({ ok: false, reason: 'withdrawn' });
    expect(await consultation(c.id)).toMatchObject({ status: 'cancelled', gpId: null });
  });

  test('a doctor already in a consultation cannot take another', async () => {
    const d = await doctor({ availableSince: null });
    await request({ status: 'in_progress', gpId: d.id, startedAt: at(-60) });
    const second = await request();
    // Never offered in practice; forced here to prove the last line of defence.
    const [forced] = await db.insert(consultationOffers)
      .values({ consultationId: second.id, gpId: d.id, gpFeePence: 2400, offeredAt: NOW, expiresAt: at(WINDOW) }).returning();
    expect(await acceptOffer(db, d.id, forced.id, at(5))).toEqual({ ok: false, reason: 'busy' });
    expect(await consultation(second.id)).toMatchObject({ status: 'requested', gpId: null });
  });

  test('declining passes it to the next doctor at once, and the decliner goes to the back of the queue', async () => {
    const first = await doctor();
    const second = await doctor();
    const c = await request();
    await dispatch(db, NOW);
    const [offer] = await offers();
    await beat(at(5));

    expect(await declineOffer(db, first.id, offer.id, at(5))).toEqual({ ok: true });
    const [declined, passed] = await offers();
    expect(declined).toMatchObject({ gpId: first.id, status: 'declined' });
    expect(passed).toMatchObject({ gpId: second.id, consultationId: c.id, status: 'offered' });
    expect((await gp(first.id)).availableSince?.getTime()).toBe(at(5).getTime());
    expect(await shiftState(db, first.id, at(5))).toMatchObject({ kind: 'idle' });
  });

  test('declining twice, or after it expired, changes nothing', async () => {
    const { d, offer } = await onOffer();
    await declineOffer(db, d.id, offer.id, at(5));
    expect(await declineOffer(db, d.id, offer.id, at(6))).toEqual({ ok: true });

    await request({ requestedAt: at(-1) });
    await beat(at(7));
    await dispatch(db, at(7));
    const live = (await offers()).find((o) => o.status === 'offered')!;
    expect(await declineOffer(db, d.id, live.id, at(7 + WINDOW))).toEqual({ ok: false, reason: 'expired' });
  });

  test('a missed offer rests the doctor until they tap Back online', async () => {
    const { d } = await onOffer();
    expect(await pulse(db, d.id, at(WINDOW))).toEqual({ kind: 'resting', reason: 'missed' });
    await request({ requestedAt: at(WINDOW) });
    // Resting: the new request does not reach them.
    expect(await pulse(db, d.id, at(WINDOW + 3))).toEqual({ kind: 'resting', reason: 'missed' });

    expect(await backOnline(db, d.id, at(WINDOW + 4))).toEqual({ ok: true });
    expect(await shiftState(db, d.id, at(WINDOW + 4))).toMatchObject({ kind: 'offer' });
  });
});

describe('a consultation', () => {
  async function inConsultation() {
    const made = await onOffer();
    await acceptOffer(db, made.d.id, made.offer.id, at(10));
    return made;
  }

  test('completing it ends it and rests the doctor until they are ready for the next', async () => {
    const { d, c } = await inConsultation();
    expect(await completeConsultation(db, d.id, at(610))).toEqual({ ok: true });
    expect(await consultation(c.id)).toMatchObject({ status: 'completed' });
    expect((await consultation(c.id)).endedAt?.getTime()).toBe(at(610).getTime());
    expect(await shiftState(db, d.id, at(611))).toEqual({ kind: 'resting', reason: 'finished' });

    await beat(at(612));
    expect(await backOnline(db, d.id, at(612))).toEqual({ ok: true });
    expect(await shiftState(db, d.id, at(612))).toMatchObject({ kind: 'idle' });
  });

  test('a patient who never arrives is a no-show', async () => {
    const { d, c } = await inConsultation();
    expect(await markNoShow(db, d.id, at(300))).toEqual({ ok: true });
    expect(await consultation(c.id)).toMatchObject({ status: 'no_show' });
  });

  test('only the first of Complete and No-show counts', async () => {
    const { d, c } = await inConsultation();
    await completeConsultation(db, d.id, at(610));
    expect(await markNoShow(db, d.id, at(611))).toEqual({ ok: false, reason: 'nothing_in_progress' });
    expect(await consultation(c.id)).toMatchObject({ status: 'completed' });
  });

  test('a doctor ends only their own consultation', async () => {
    const { c } = await inConsultation();
    const other = await doctor();
    expect(await completeConsultation(db, other.id, at(610))).toEqual({ ok: false, reason: 'nothing_in_progress' });
    expect(await consultation(c.id)).toMatchObject({ status: 'in_progress' });
  });

  test('Back online is refused in the middle of one', async () => {
    const { d } = await inConsultation();
    expect(await backOnline(db, d.id, at(20))).toEqual({ ok: false, reason: 'in_consultation' });
  });

  test('going offline is refused in the middle of one', async () => {
    const { d } = await inConsultation();
    expect(await goOffline(db, d.id, at(20))).toEqual({ ok: false, reason: 'in_consultation' });
    expect((await gp(d.id)).onlineSince).not.toBeNull();
  });
});

describe('going offline', () => {
  test('with a live offer, the offer is released and passed on', async () => {
    const first = await doctor();
    const second = await doctor();
    await request();
    await dispatch(db, NOW);
    await beat(at(5));

    expect(await goOffline(db, first.id, at(5))).toEqual({ ok: true });
    expect((await gp(first.id))).toMatchObject({ onlineSince: null, availableSince: null });
    expect((await offers()).map((o) => [o.gpId, o.status])).toEqual([[first.id, 'declined'], [second.id, 'offered']]);
    expect(await shiftState(db, first.id, at(5))).toEqual({ kind: 'offline' });
  });

  test('signing out takes the doctor offline', async () => {
    const d = await doctor();
    signInAs(d);
    await expect(signOut()).rejects.toThrow('NEXT_REDIRECT /doctor/login');
    expect((await gp(d.id)).onlineSince).toBeNull();
    expect(jar.has(DOCTOR_COOKIE)).toBe(false);
  });
});

describe('the heartbeat', () => {
  test('a pulse records that an online doctor is here', async () => {
    const d = await doctor();
    await pulse(db, d.id, at(9));
    expect((await gp(d.id)).lastSeenAt?.getTime()).toBe(at(9).getTime());
  });

  test('a pulse from an offline doctor records nothing', async () => {
    const d = await offlineDoctor();
    expect(await pulse(db, d.id, at(9))).toEqual({ kind: 'offline' });
    expect((await gp(d.id)).lastSeenAt).toBeNull();
  });
});

describe('the actions', () => {
  test('each refuses a visitor with no session', async () => {
    await expect(goOnlineAction()).rejects.toThrow('NEXT_REDIRECT /doctor/login');
    await expect(acceptAction(randomUUID())).rejects.toThrow('NEXT_REDIRECT /doctor/login');
    await expect(completeAction()).rejects.toThrow('NEXT_REDIRECT /doctor/login');
  });

  test('going online returns the state to show, and a refusal says why in words', async () => {
    const active = await offlineDoctor();
    signInAs(active);
    expect(await goOnlineAction()).toMatchObject({ ok: true, state: { kind: 'idle' } });

    const waiting = await offlineDoctor({ status: 'onboarding' });
    signInAs(waiting);
    const refused = await goOnlineAction();
    expect(refused).toMatchObject({ ok: false, state: { kind: 'unavailable', reason: 'onboarding' } });
    expect(refused.ok === false && refused.error).toMatch(/approved/);
  });

  test('accepting through the action acts for the signed-in doctor only', async () => {
    // The actions run on the real clock, so this offer is made in real time.
    const real = new Date();
    const d = await doctor({ lastSeenAt: real, availableSince: real });
    const c = await request({ requestedAt: real });
    await dispatch(db, real);
    const [offer] = await offers();
    const other = await doctor({ lastSeenAt: real });
    signInAs(other);
    expect(await acceptAction(offer.id)).toMatchObject({ ok: false });
    signInAs(d);
    expect(await acceptAction(offer.id)).toMatchObject({ ok: true, state: { kind: 'consultation', consultationId: c.id } });
  });
});

describe('the poll', () => {
  const poll = (headers: Record<string, string> = {}) =>
    pulseRoute(new Request('http://localhost/doctor/pulse', { method: 'POST', headers }));

  test('answers 401 without a session, so the page can send the doctor to sign in', async () => {
    expect((await poll()).status).toBe(401);
  });

  test('refuses a request another site made', async () => {
    signInAs(await doctor());
    expect((await poll({ 'sec-fetch-site': 'cross-site' })).status).toBe(403);
  });

  test('returns the doctor’s state, uncached, and counts as a heartbeat', async () => {
    const d = await doctor({ lastSeenAt: at(-10) });
    signInAs(d);
    const response = await poll({ 'sec-fetch-site': 'same-origin' });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ state: { kind: 'idle' } });
    expect((await gp(d.id)).lastSeenAt!.getTime()).toBeGreaterThan(at(-10).getTime());
  });
});
