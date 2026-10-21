import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import type { DB } from '@/lib/db';
import { consultationCalls, livekitEvents } from '@/lib/db/schema';
import { resetDb, useTestDb } from './helpers/db';

// Migration 0005: what the database itself refuses, whatever the code does.

let db: DB;
beforeAll(async () => { db = await useTestDb(); });
beforeEach(async () => { await resetDb(db); });

const NOW = new Date('2026-10-13T12:00:00Z');
const call = (over: Partial<typeof consultationCalls.$inferInsert> = {}) => ({
  consultationId: randomUUID(), room: randomUUID(), gpIdentity: randomUUID(), patientIdentity: randomUUID(),
  sealedGpKey: 'v1.sealed-gp', sealedPatientKey: 'v1.sealed-patient', openedAt: NOW, ...over,
});
const code = (err: unknown) => (err as { cause?: { code?: string }; code?: string }).cause?.code ?? (err as { code?: string }).code;

describe('a closed call keeps no key', () => {
  test('a call cannot be written closed with a key in it', async () => {
    for (const keys of [{ sealedGpKey: 'v1.x', sealedPatientKey: null }, { sealedGpKey: null, sealedPatientKey: 'v1.x' }]) {
      await expect(db.insert(consultationCalls).values(call({ closedAt: NOW, ...keys })), JSON.stringify(keys))
        .rejects.toSatisfy((err) => code(err) === '23514');
    }
  });

  test('nor closed without clearing both keys; closing and clearing together is fine', async () => {
    const row = call();
    await db.insert(consultationCalls).values(row);
    await expect(db.update(consultationCalls).set({ closedAt: NOW }).where(eq(consultationCalls.consultationId, row.consultationId)))
      .rejects.toSatisfy((err) => code(err) === '23514');
    await db.update(consultationCalls).set({ closedAt: NOW, sealedGpKey: null, sealedPatientKey: null })
      .where(eq(consultationCalls.consultationId, row.consultationId));
    expect((await db.select().from(consultationCalls))[0]).toMatchObject({ closedAt: NOW, sealedGpKey: null, sealedPatientKey: null });
  });
});

// Every room and identity is random; the unique indexes make a collision, or a
// bug that reused one, fail loudly rather than join two calls.
test('no two calls share a room or an identity', async () => {
  const first = call();
  await db.insert(consultationCalls).values(first);
  for (const clash of [{ room: first.room }, { gpIdentity: first.gpIdentity }, { patientIdentity: first.patientIdentity }]) {
    await expect(db.insert(consultationCalls).values(call(clash)), Object.keys(clash)[0])
      .rejects.toSatisfy((err) => code(err) === '23505');
  }
  await expect(db.insert(consultationCalls).values(call({ consultationId: first.consultationId })))
    .rejects.toSatisfy((err) => code(err) === '23505');
});

test('a webhook event id is recorded once', async () => {
  await db.insert(livekitEvents).values({ id: 'EV_1', receivedAt: NOW });
  const again = await db.insert(livekitEvents).values({ id: 'EV_1', receivedAt: NOW }).onConflictDoNothing().returning();
  expect(again).toEqual([]);
});
