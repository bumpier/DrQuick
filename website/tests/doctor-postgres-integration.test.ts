// The dispatcher under real contention, against a real Postgres over
// postgres.js. PGlite runs every transaction behind one mutex, so the rest of
// the suite cannot show a race; this is the only test that can. Opt-in: runs
// only with TEST_DATABASE_URL pointing at a migrated, DISPOSABLE database (it
// empties the doctor tables), e.g.
//   TEST_DATABASE_URL=postgres://drquick:drquick@127.0.0.1:55433/drquick npx vitest run tests/doctor-postgres-integration.test.ts
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { getDb, setDb, type DB } from '@/lib/db';
import { consultationOffers, consultations, gps } from '@/lib/db/schema';
import { GRACE_SECONDS, OFFER_SECONDS, dispatch } from '@/lib/doctor/dispatch';
import { acceptOffer, declineOffer } from '@/lib/doctor/shift';
import { splitPrice } from '@/lib/finance/commission';

const url = process.env.TEST_DATABASE_URL;
const NOW = new Date('2026-10-01T09:00:00Z');
const at = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);
const WINDOW = OFFER_SECONDS + GRACE_SECONDS;

let db: DB;
beforeAll(async () => {
  if (!url) return;
  setDb(undefined);
  process.env.DATABASE_URL = url;
  db = (await getDb())!;
});
afterAll(() => { delete process.env.DATABASE_URL; });
beforeEach(async () => {
  if (url) await db.execute(sql`truncate consultation_offers, consultations, gps`);
});

let n = 0;
async function doctor() {
  n += 1;
  const [row] = await db.insert(gps).values({
    name: `GP ${n}`, email: `it-gp${n}-${randomUUID()}@example.com`, gmc: String(7100000 + n), status: 'active',
    onlineSince: at(-600), lastSeenAt: NOW, availableSince: at(-600 + n),
  }).returning();
  return row;
}
async function request() {
  const [row] = await db.insert(consultations).values({
    patientId: randomUUID(), status: 'requested', requestedAt: at(-30), pricePence: 4000, ...splitPrice(4000, 0),
  }).returning();
  return row;
}
const live = async () => (await db.select().from(consultationOffers)).filter((o) => o.status === 'offered');

test.runIf(Boolean(url))('a storm of dispatches makes exactly one live offer per consultation and per doctor', async () => {
  for (let i = 0; i < 6; i += 1) await doctor();
  const wanted = [await request(), await request(), await request(), await request()];

  // Half step aside if another is running, half queue behind it: both paths at once.
  const results = await Promise.all(Array.from({ length: 16 }, (_, i) => dispatch(db, NOW, { wait: i % 2 === 0 })));
  expect(results.reduce((sum, r) => sum + r.offered, 0)).toBe(4);

  const offers = await live();
  expect(offers).toHaveLength(4);
  expect(new Set(offers.map((o) => o.consultationId))).toEqual(new Set(wanted.map((c) => c.id)));
  expect(new Set(offers.map((o) => o.gpId)).size).toBe(4);
});

test.runIf(Boolean(url))('an accept racing the expiry has one winner, and never a half-taken consultation', async () => {
  for (let round = 0; round < 15; round += 1) {
    await db.execute(sql`truncate consultation_offers, consultations, gps`);
    const d = await doctor();
    const c = await request();
    await dispatch(db, NOW, { wait: true });
    const [offer] = await live();
    await db.update(gps).set({ lastSeenAt: at(WINDOW) }).where(eq(gps.id, d.id));

    // The click lands a millisecond inside the window as the dispatcher, a
    // millisecond past it, comes to expire the offer.
    const [accepted] = await Promise.all([
      acceptOffer(db, d.id, offer.id, new Date(at(WINDOW).getTime() - 1)),
      dispatch(db, at(WINDOW), { wait: true }),
    ]);

    const [after] = await db.select().from(consultationOffers).where(eq(consultationOffers.id, offer.id));
    const [consultation] = await db.select().from(consultations).where(eq(consultations.id, c.id));
    if (accepted.ok) {
      expect(after.status).toBe('accepted');
      expect(consultation).toMatchObject({ status: 'in_progress', gpId: d.id });
    } else {
      expect(after.status).toBe('expired');
      expect(consultation).toMatchObject({ status: 'requested', gpId: null });
    }
  }
});

test.runIf(Boolean(url))('a double click on Accept, and Accept against Decline, each settle one way', async () => {
  const d = await doctor();
  const c = await request();
  await dispatch(db, NOW, { wait: true });
  const [offer] = await live();

  const clicks = await Promise.all([
    acceptOffer(db, d.id, offer.id, at(5)), acceptOffer(db, d.id, offer.id, at(5)), declineOffer(db, d.id, offer.id, at(5)),
  ]);
  const [after] = await db.select().from(consultationOffers).where(eq(consultationOffers.id, offer.id));
  const [consultation] = await db.select().from(consultations).where(eq(consultations.id, c.id));
  if (after.status === 'accepted') {
    expect(consultation).toMatchObject({ status: 'in_progress', gpId: d.id });
    expect(clicks[0].ok && clicks[1].ok).toBe(true);
    expect(clicks[2].ok).toBe(false);
  } else {
    expect(after.status).toBe('declined');
    expect(consultation).toMatchObject({ status: 'requested', gpId: null });
    expect(clicks[2].ok).toBe(true);
  }
});
