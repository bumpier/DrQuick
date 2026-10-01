import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { randomUUID } from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import { resetDb, useTestDb } from './helpers/db';
import { setDb, type DB } from '@/lib/db';
import { consultationOffers, consultations, gps } from '@/lib/db/schema';
import {
  GONE_SECONDS, GRACE_SECONDS, MAX_REQUEST_MINUTES, OFFER_SECONDS, STALE_SECONDS, dispatch,
} from '@/lib/doctor/dispatch';
import { splitPrice } from '@/lib/finance/commission';

const NOW = new Date('2026-10-01T09:00:00Z');
const at = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);
// The whole stored window: what the doctor is shown, plus the grace for a late click.
const WINDOW = OFFER_SECONDS + GRACE_SECONDS;

let db: DB;
beforeAll(async () => { db = await useTestDb(); });

let n = 0;
beforeEach(async () => {
  setDb(db);
  n = 0;
  await resetDb(db);
});

type GpInsert = typeof gps.$inferInsert;
type ConsultationInsert = typeof consultations.$inferInsert;

// An active doctor, online and in rotation. Each one made has been available a
// second less than the one before, so the first made is the first offered.
async function doctor(over: Partial<GpInsert> = {}) {
  n += 1;
  const [row] = await db.insert(gps).values({
    name: `GP ${n}`, email: `gp${n}@example.com`, gmc: String(7000000 + n), status: 'active',
    onlineSince: at(-600), lastSeenAt: NOW, availableSince: at(-600 + n), ...over,
  }).returning();
  return row;
}

async function request(over: Partial<ConsultationInsert> = {}) {
  const pricePence = over.pricePence ?? 4000;
  const [row] = await db.insert(consultations).values({
    patientId: randomUUID(), status: 'requested', requestedAt: at(-30), pricePence, ...splitPrice(pricePence, 0),
    reason: 'Sore throat, three days', ageBand: '30 to 39', recordConsent: true, ...over,
  }).returning();
  return row;
}

// Every doctor's portal checks in.
const beat = (when: Date, ...only: string[]) => (only.length
  ? Promise.all(only.map((id) => db.update(gps).set({ lastSeenAt: when }).where(eq(gps.id, id))))
  : db.update(gps).set({ lastSeenAt: when }));

const offers = () => db.select().from(consultationOffers).orderBy(asc(consultationOffers.offeredAt));
const gp = async (id: string) => (await db.select().from(gps).where(eq(gps.id, id)))[0];

describe('matching', () => {
  test('a waiting request is offered to the doctor who has been available longest, once', async () => {
    const first = await doctor();
    await doctor();
    const c = await request();

    expect(await dispatch(db, NOW)).toEqual({ skipped: false, offered: 1 });
    const [offer] = await offers();
    expect(offer).toMatchObject({ consultationId: c.id, gpId: first.id, status: 'offered', gpFeePence: 2400 });
    expect(offer.offeredAt.getTime()).toBe(NOW.getTime());
    expect(offer.expiresAt.getTime()).toBe(at(WINDOW).getTime());

    expect(await dispatch(db, at(1))).toEqual({ skipped: false, offered: 0 });
    expect(await offers()).toHaveLength(1);
  });

  test('with two requests and one doctor the older is offered and the other waits', async () => {
    await doctor();
    const newer = await request({ requestedAt: at(-10) });
    const older = await request({ requestedAt: at(-90) });
    await dispatch(db, NOW);
    const all = await offers();
    expect(all).toHaveLength(1);
    expect(all[0].consultationId).toBe(older.id);
    expect(all[0].consultationId).not.toBe(newer.id);
  });

  // CLAUDE.md: demand may move the price; it may never reorder the queue.
  test('a higher price does not move a request up the queue', async () => {
    await doctor();
    const cheapAndFirst = await request({ requestedAt: at(-90), pricePence: 3200 });
    await request({ requestedAt: at(-10), pricePence: 4800 });
    await dispatch(db, NOW);
    expect((await offers())[0].consultationId).toBe(cheapAndFirst.id);
  });

  test.each([
    ['still onboarding', { status: 'onboarding' }],
    ['paused by the team', { status: 'paused' }],
    ['offboarded', { status: 'offboarded' }],
    ['offline', { onlineSince: null }],
    ['silent for the stale interval', { lastSeenAt: at(-STALE_SECONDS) }],
    ['never seen', { lastSeenAt: null }],
    ['not in rotation', { availableSince: null }],
  ] as Array<[string, Partial<GpInsert>]>)('a doctor who is %s is never offered a request', async (_label, over) => {
    await doctor(over);
    await request();
    expect(await dispatch(db, NOW)).toEqual({ skipped: false, offered: 0 });
    expect((await offers()).filter((o) => o.status === 'offered')).toHaveLength(0);
  });

  test('a doctor holding an offer is not offered a second request', async () => {
    await doctor();
    await request({ requestedAt: at(-90) });
    await request({ requestedAt: at(-10) });
    await dispatch(db, NOW);
    await beat(at(3));
    expect(await dispatch(db, at(3))).toEqual({ skipped: false, offered: 0 });
    expect(await offers()).toHaveLength(1);
  });

  test('a doctor in a consultation is not offered a request', async () => {
    const d = await doctor();
    await request({ status: 'in_progress', gpId: d.id, startedAt: at(-120) });
    await request();
    expect(await dispatch(db, NOW)).toEqual({ skipped: false, offered: 0 });
  });

  test('a request older than the cutoff is never offered; one just inside it is', async () => {
    await doctor();
    await request({ requestedAt: at(-MAX_REQUEST_MINUTES * 60) });
    expect(await dispatch(db, NOW)).toEqual({ skipped: false, offered: 0 });
    const fresh = await request({ requestedAt: at(-MAX_REQUEST_MINUTES * 60 + 1) });
    expect(await dispatch(db, NOW)).toEqual({ skipped: false, offered: 1 });
    expect((await offers())[0].consultationId).toBe(fresh.id);
  });

  test('the fee quoted follows the commission tier the doctor holds', async () => {
    const d = await doctor();
    await db.insert(consultations).values(Array.from({ length: 100 }, (_, i) => ({
      patientId: randomUUID(), gpId: d.id, status: 'completed' as const, requestedAt: at(-86_400 - i),
      pricePence: 4000, ...splitPrice(4000, i),
    })));
    await request({ pricePence: 4000 });
    await dispatch(db, NOW);
    expect((await offers())[0].gpFeePence).toBe(2800); // 70% from the hundredth
  });

  test('two dispatches at once still make one offer', async () => {
    await doctor();
    await doctor();
    await request();
    await Promise.all([dispatch(db, NOW), dispatch(db, NOW)]);
    expect((await offers()).filter((o) => o.status === 'offered')).toHaveLength(1);
  });
});

describe('expiry and rotation', () => {
  test('when the window ends the offer expires, the doctor leaves rotation, and the next doctor is offered in the same call', async () => {
    const first = await doctor();
    const second = await doctor();
    const c = await request();
    await dispatch(db, NOW);
    await beat(at(WINDOW));

    expect(await dispatch(db, at(WINDOW))).toEqual({ skipped: false, offered: 1 });
    const [expired, live] = await offers();
    expect(expired).toMatchObject({ gpId: first.id, status: 'expired' });
    expect(expired.respondedAt?.getTime()).toBe(at(WINDOW).getTime());
    expect(live).toMatchObject({ gpId: second.id, consultationId: c.id, status: 'offered' });
    const rested = await gp(first.id);
    expect(rested.availableSince).toBeNull();
    expect(rested.onlineSince).not.toBeNull(); // still online: they tap Back online, not Go online
  });

  test('a millisecond before the window ends nothing changes', async () => {
    await doctor();
    await doctor();
    await request();
    await dispatch(db, NOW);
    const justBefore = new Date(at(WINDOW).getTime() - 1);
    await beat(justBefore);
    expect(await dispatch(db, justBefore)).toEqual({ skipped: false, offered: 0 });
    expect((await offers()).map((o) => o.status)).toEqual(['offered']);
  });

  test('a doctor who goes silent loses the offer early, and it passes on', async () => {
    const silent = await doctor();
    const present = await doctor();
    await request();
    await dispatch(db, NOW);
    await beat(at(STALE_SECONDS), present.id);

    await dispatch(db, at(STALE_SECONDS));
    const [lost, passed] = await offers();
    expect(lost).toMatchObject({ gpId: silent.id, status: 'expired' });
    expect(passed).toMatchObject({ gpId: present.id, status: 'offered' });
  });

  test('a doctor silent for the gone interval is taken offline, unless they are in a consultation', async () => {
    const gone = await doctor({ lastSeenAt: at(-GONE_SECONDS) });
    const consulting = await doctor({ lastSeenAt: at(-GONE_SECONDS), availableSince: null });
    await request({ status: 'in_progress', gpId: consulting.id, startedAt: at(-300) });
    await dispatch(db, NOW);
    expect((await gp(gone.id)).onlineSince).toBeNull();
    expect((await gp(gone.id)).availableSince).toBeNull();
    expect((await gp(consulting.id)).onlineSince).not.toBeNull();
  });

  test('a request every doctor has passed on waits for one who has not seen it, and is never re-offered', async () => {
    const only = await doctor();
    const c = await request();
    await dispatch(db, NOW);
    await beat(at(WINDOW));
    await dispatch(db, at(WINDOW));
    // They tap Back online: in rotation again, but they have had this request.
    await db.update(gps).set({ availableSince: at(WINDOW + 1) }).where(eq(gps.id, only.id));
    await beat(at(WINDOW + 2));
    expect(await dispatch(db, at(WINDOW + 2))).toEqual({ skipped: false, offered: 0 });

    const newcomer = await doctor({ lastSeenAt: at(WINDOW + 3), availableSince: at(WINDOW + 3) });
    expect(await dispatch(db, at(WINDOW + 3))).toEqual({ skipped: false, offered: 1 });
    expect((await offers()).at(-1)).toMatchObject({ gpId: newcomer.id, consultationId: c.id, status: 'offered' });
  });

  test('a request cancelled while on offer is withdrawn, and the doctor keeps their place', async () => {
    const first = await doctor();
    await doctor();
    const cancelled = await request({ requestedAt: at(-90) });
    await dispatch(db, NOW);
    await db.update(consultations).set({ status: 'cancelled' }).where(eq(consultations.id, cancelled.id));
    const next = await request({ requestedAt: at(-5) });
    await beat(at(5));

    await dispatch(db, at(5));
    const [withdrawn, live] = await offers();
    expect(withdrawn).toMatchObject({ consultationId: cancelled.id, status: 'withdrawn' });
    // Not their doing, so they are still first in line.
    expect(live).toMatchObject({ consultationId: next.id, gpId: first.id, status: 'offered' });
  });

  test('a doctor the team pauses loses a live offer', async () => {
    const paused = await doctor();
    const other = await doctor();
    await request();
    await dispatch(db, NOW);
    await db.update(gps).set({ status: 'paused' }).where(eq(gps.id, paused.id));
    await beat(at(2));
    await dispatch(db, at(2));
    expect((await offers()).map((o) => [o.gpId, o.status])).toEqual([[paused.id, 'expired'], [other.id, 'offered']]);
  });
});

// What holds if the lock were ever bypassed: the database refuses outright.
describe('the database backstops', () => {
  const offer = (consultationId: string, gpId: string, status: 'offered' | 'expired' = 'offered') => db.insert(consultationOffers)
    .values({ consultationId, gpId, status, gpFeePence: 2400, offeredAt: NOW, expiresAt: at(WINDOW) });
  const refusedBy = (constraint: string) => ({ cause: { code: '23505', constraint } });

  test('a consultation cannot have two live offers', async () => {
    const [a, b, c] = [await doctor(), await doctor(), await request()];
    await offer(c.id, a.id);
    await expect(offer(c.id, b.id)).rejects.toMatchObject(refusedBy('offers_live_consultation'));
  });

  test('a doctor cannot hold two live offers', async () => {
    const [a, c1, c2] = [await doctor(), await request(), await request()];
    await offer(c1.id, a.id);
    await expect(offer(c2.id, a.id)).rejects.toMatchObject(refusedBy('offers_live_gp'));
  });

  test('a consultation cannot be offered to the same doctor twice', async () => {
    const [a, c] = [await doctor(), await request()];
    await offer(c.id, a.id, 'expired');
    await expect(offer(c.id, a.id)).rejects.toMatchObject(refusedBy('offers_consultation_gp'));
  });

  test('a doctor cannot hold two consultations', async () => {
    const a = await doctor();
    await request({ status: 'in_progress', gpId: a.id });
    await expect(request({ status: 'in_progress', gpId: a.id })).rejects.toMatchObject(refusedBy('consultations_gp_live'));
  });
});
