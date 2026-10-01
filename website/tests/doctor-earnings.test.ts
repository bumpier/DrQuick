import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { randomUUID } from 'node:crypto';
import { resetDb, useTestDb } from './helpers/db';
import { setDb, type DB } from '@/lib/db';
import { consultations, gps, patients, payments, payoutItems, payouts } from '@/lib/db/schema';
import { dbSource } from '@/lib/admin/queries/finance';
import { earningsSummary, feeFor, myConsultations, myPayout, myPayouts, todaysWork } from '@/lib/doctor/queries/earnings';

const NOW = new Date('2026-09-20T12:00:00Z');
const at = (iso: string) => new Date(iso);

let db: DB;
beforeAll(async () => { db = await useTestDb(); });

let me: string;
let other: string;
const ids: Record<string, string> = {};

beforeEach(async () => {
  setDb(db);
  await resetDb(db);
  const [a, b] = await db.insert(gps).values([
    { name: 'GP One', email: 'one@example.com', gmc: '7000001', status: 'active' },
    { name: 'GP Two', email: 'two@example.com', gmc: '7000002', status: 'active' },
  ]).returning();
  me = a.id;
  other = b.id;
  const [patient] = await db.insert(patients).values({ email: 'p@example.com' }).returning();

  type Status = 'completed' | 'no_show' | 'in_progress';
  // key, doctor, status, their fee, when it was requested and ended, the payment's status and time
  const rows: Array<[string, string, Status, number, string, 'succeeded' | 'pending' | null, string | null]> = [
    ['augPaid', me, 'completed', 2400, '2026-08-12T10:00:00Z', 'succeeded', '2026-08-12T10:01:00Z'],
    ['sepProcessing', me, 'completed', 2400, '2026-09-02T10:00:00Z', 'succeeded', '2026-09-02T10:01:00Z'],
    ['sepFailedPayout', me, 'completed', 2880, '2026-09-10T10:00:00Z', 'succeeded', '2026-09-10T10:01:00Z'],
    // 22:30 UTC on the 19th is 23:30 in London: yesterday, by half an hour.
    ['lateYesterday', me, 'completed', 1800, '2026-09-19T22:30:00Z', 'succeeded', '2026-09-19T22:31:00Z'],
    ['today', me, 'completed', 1920, '2026-09-20T09:00:00Z', 'succeeded', '2026-09-20T09:01:00Z'],
    ['noShow', me, 'no_show', 2400, '2026-09-18T10:00:00Z', 'succeeded', '2026-09-18T10:01:00Z'],
    ['unpaid', me, 'completed', 2400, '2026-09-20T10:00:00Z', 'pending', null],
    ['live', me, 'in_progress', 2400, '2026-09-20T11:50:00Z', 'pending', null],
    ['theirs', other, 'completed', 3000, '2026-09-05T10:00:00Z', 'succeeded', '2026-09-05T10:01:00Z'],
  ];
  for (const [key, gpId, status, fee, when, pay, paidAt] of rows) {
    ids[key] = randomUUID();
    await db.insert(consultations).values({
      id: ids[key], patientId: patient.id, gpId, status, requestedAt: at(when), startedAt: at(when),
      endedAt: status === 'in_progress' ? null : at(when), pricePence: 4000, gpFeePence: fee, platformFeePence: 4000 - fee,
    });
    if (pay) {
      await db.insert(payments).values({
        consultationId: ids[key], amountPence: 4000, status: pay, paidAt: paidAt ? at(paidAt) : null, createdAt: at(when),
      });
    }
  }

  const payout = async (key: string, gpId: string, status: 'paid' | 'processing' | 'failed' | 'pending', amount: number, of: string[]) => {
    ids[key] = randomUUID();
    await db.insert(payouts).values({
      id: ids[key], gpId, periodStart: at('2026-09-01T00:00:00Z'), periodEnd: at('2026-09-08T00:00:00Z'), amountPence: amount,
      status, paidAt: status === 'paid' ? at('2026-09-10T00:00:00Z') : null,
    });
    await db.insert(payoutItems).values(of.map((c) => ({ payoutId: ids[key], consultationId: ids[c] })));
  };
  await payout('paidPayout', me, 'paid', 2400, ['augPaid']);
  await payout('processingPayout', me, 'processing', 2400, ['sepProcessing']);
  await payout('failedPayout', me, 'failed', 2880, ['sepFailedPayout']);
  await payout('theirPayout', other, 'pending', 3000, ['theirs']);
});

describe('the summary', () => {
  test('counts a fee only for a completed consultation that was paid for', async () => {
    const s = await earningsSummary(db, me, NOW);
    // All time: 2400 + 2400 + 2880 + 1800 + 1920. The no-show, the unpaid one and the one in progress earn nothing.
    expect(s.earnedAllTime).toBe(11400);
    // September, by when the patient paid: everything but August's.
    expect(s.earnedThisMonth).toBe(9000);
    expect(s.consultsThisMonth).toBe(4);
  });

  test('what is awaiting payout is what no live payout covers; a failed payout puts its fees back', async () => {
    const s = await earningsSummary(db, me, NOW);
    expect(s.awaitingPayout).toBe(2880 + 1800 + 1920);
    expect(s.inPayout).toBe(2400);
    expect(s.paidToDate).toBe(2400);
    // Nothing is counted twice or lost: every earned penny is in exactly one place.
    expect(s.awaitingPayout + s.inPayout + s.paidToDate).toBe(s.earnedAllTime);
  });

  test('agrees with what the admin sees for the same doctor', async () => {
    const mine = await earningsSummary(db, me, NOW);
    const admin = (await dbSource(db).gpSummary(NOW)).find((g) => g.gpId === me)!;
    expect(mine.earnedThisMonth).toBe(admin.earnedThisMonth);
    expect(mine.consultsThisMonth).toBe(admin.consultsThisMonth);
    expect(mine.inPayout).toBe(admin.pending);
    expect(mine.paidToDate).toBe(admin.paidToDate);
    expect(mine.completed).toBe(admin.servedToDate);
  });

  test('the commission tier is counted on every completed consultation, paid for or not', async () => {
    expect((await earningsSummary(db, me, NOW)).completed).toBe(6);
  });

  test('another doctor’s money is not in it', async () => {
    const theirs = await earningsSummary(db, other, NOW);
    expect(theirs).toMatchObject({ earnedAllTime: 3000, awaitingPayout: 0, inPayout: 3000, paidToDate: 0, completed: 1 });
  });

  test('a doctor with no consultations sees zeros, not an error', async () => {
    const [fresh] = await db.insert(gps).values({ name: 'GP New', email: 'new@example.com', gmc: '7000003' }).returning();
    expect(await earningsSummary(db, fresh.id, NOW)).toEqual({
      earnedAllTime: 0, earnedThisMonth: 0, consultsThisMonth: 0, awaitingPayout: 0, inPayout: 0, paidToDate: 0, completed: 0,
    });
  });
});

describe('today', () => {
  test('is the London day: what ended since midnight there', async () => {
    // Completed today: the 09:00 one (paid) and the 10:00 one (not yet paid for).
    expect(await todaysWork(db, me, NOW)).toEqual({ consultations: 2, earnedPence: 1920 });
  });
});

describe('the fee a row shows', () => {
  test('a consultation that ended without being completed shows no fee: it is not paid', () => {
    expect(feeFor({ status: 'no_show', gpFeePence: 2640 })).toBeNull();
    expect(feeFor({ status: 'cancelled', gpFeePence: 2640 })).toBeNull();
  });

  test('a completed one, and one still in progress, show the fee that was agreed', () => {
    expect(feeFor({ status: 'completed', gpFeePence: 2640 })).toBe(2640);
    expect(feeFor({ status: 'in_progress', gpFeePence: 2640 })).toBe(2640);
  });
});

describe('the lists', () => {
  test('consultations are the doctor’s own, newest first', async () => {
    const page = await myConsultations(db, me, 1);
    expect(page.total).toBe(8);
    expect(page.rows.every((r) => r.gpId === me)).toBe(true);
    expect(page.rows[0].id).toBe(ids.live);
    expect(page.rows.at(-1)!.id).toBe(ids.augPaid);
    expect(page.rows.find((r) => r.id === ids.today)).toMatchObject({ status: 'completed', gpFeePence: 1920, payment: 'paid' });
  });

  test('payouts are the doctor’s own', async () => {
    const page = await myPayouts(db, me, 1);
    expect(page.rows.map((p) => p.id).sort()).toEqual([ids.paidPayout, ids.processingPayout, ids.failedPayout].sort());
  });

  test('a payout opens with its consultations; someone else’s, or a made-up id, does not open', async () => {
    const mine = await myPayout(db, me, ids.paidPayout);
    expect(mine?.payout.amountPence).toBe(2400);
    expect(mine?.consultations.map((c) => c.id)).toEqual([ids.augPaid]);
    expect(await myPayout(db, me, ids.theirPayout)).toBeNull();
    expect(await myPayout(db, me, 'not-a-uuid')).toBeNull();
  });
});
