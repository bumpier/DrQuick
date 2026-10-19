import { randomBytes, randomUUID } from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

// The network half of lib/video/livekit.ts is replaced; passes are minted for real.
vi.mock('@/lib/video/livekit', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/video/livekit')>();
  return {
    ...real,
    ensureRoom: vi.fn(async () => undefined),
    closeRoom: vi.fn(async () => true),
    removeParticipant: vi.fn(async () => true),
  };
});

import { setDb, type DB } from '@/lib/db';
import { appErrors, callEvents, consultationCalls, consultations, gps, livekitEvents } from '@/lib/db/schema';
import { open, sealingSecret } from '@/lib/crypto/sealed';
import { completeConsultation, markNoShow } from '@/lib/doctor/shift';
import { splitPrice } from '@/lib/finance/commission';
import { closeRoom, ensureRoom, removeParticipant } from '@/lib/video/livekit';
import {
  CALL_KEY_LABEL, applyWebhook, devPatientPass, devVideoCalls, gpPass, openCall, retryRoomDeletes, sweepCalls,
} from '@/lib/video/calls';
import { resetDb, useTestDb } from './helpers/db';

// The call lifecycle in our database (lib/video/calls.ts): who gets a pass and
// a key, when a call is closed, and what is recorded.

let db: DB;
beforeAll(async () => { db = await useTestDb(); });

const NOW = new Date('2026-10-13T12:00:00Z');
const at = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);
const CALL_KEY_SECRET = randomBytes(32).toString('base64');

let n = 0;
beforeEach(async () => {
  setDb(db);
  await resetDb(db);
  n = 0;
  vi.stubEnv('LIVEKIT_URL', 'wss://media.drquick.example');
  vi.stubEnv('LIVEKIT_API_KEY', 'APIkey123');
  vi.stubEnv('LIVEKIT_API_SECRET', 's'.repeat(43));
  vi.stubEnv('CALL_KEY_SECRET', CALL_KEY_SECRET);
  vi.mocked(ensureRoom).mockReset().mockResolvedValue(undefined);
  vi.mocked(closeRoom).mockReset().mockResolvedValue(true);
  vi.mocked(removeParticipant).mockReset().mockResolvedValue(true);
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

async function doctor() {
  n += 1;
  const [row] = await db.insert(gps).values({
    name: `GP ${n}`, email: `gp${n}@example.com`, gmc: String(7100000 + n), status: 'active',
  }).returning();
  return row;
}
async function consultation(gpId: string | null, status: 'requested' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' = 'in_progress') {
  const [row] = await db.insert(consultations).values({
    patientId: randomUUID(), gpId, status, requestedAt: at(-120), startedAt: status === 'requested' ? null : at(-60),
    pricePence: 4000, ...splitPrice(4000, 0),
  }).returning();
  return row;
}
const callOf = async (consultationId: string) =>
  (await db.select().from(consultationCalls).where(eq(consultationCalls.consultationId, consultationId)))[0];
const events = () => db.select().from(callEvents).orderBy(asc(callEvents.id));
const claims = (jwt: string) => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
const keyOf = (sealed: string | null, consultationId: string, role: 'gp' | 'patient') =>
  open(sealed!, { secret: sealingSecret()!, label: CALL_KEY_LABEL, aad: `${consultationId}|${role}` });

describe('a GP’s pass', () => {
  test('goes to the doctor holding the consultation: their own key to send, the patient’s to receive', async () => {
    const d = await doctor();
    const c = await consultation(d.id);
    const result = await gpPass(db, d.id, NOW);
    if (!result.ok) throw new Error(result.reason);
    const call = await callOf(c.id);
    expect(result.pass.url).toBe('wss://media.drquick.example');
    expect(result.pass.identity).toBe(call.gpIdentity);
    expect(result.pass.peerIdentity).toBe(call.patientIdentity);
    expect(claims(result.pass.token)).toMatchObject({ sub: call.gpIdentity, video: { room: call.room } });
    expect(Buffer.from(result.pass.ownKey, 'base64url').equals(keyOf(call.sealedGpKey, c.id, 'gp'))).toBe(true);
    expect(Buffer.from(result.pass.peerKey, 'base64url').equals(keyOf(call.sealedPatientKey, c.id, 'patient'))).toBe(true);
    expect(Buffer.from(result.pass.ownKey, 'base64url')).toHaveLength(32);
    expect(ensureRoom).toHaveBeenCalledWith(expect.objectContaining({ url: 'wss://media.drquick.example' }), call.room);
  });

  test('goes to no other doctor, and never for a consultation that is not in progress', async () => {
    const holder = await doctor();
    await consultation(holder.id);
    const other = await doctor();
    expect(await gpPass(db, other.id, NOW)).toEqual({ ok: false, reason: 'no_consultation' });
    for (const status of ['requested', 'completed', 'cancelled', 'no_show'] as const) {
      const d = await doctor();
      await consultation(status === 'requested' ? null : d.id, status);
      expect(await gpPass(db, d.id, NOW), status).toEqual({ ok: false, reason: 'no_consultation' });
    }
    expect(await db.select().from(consultationCalls)).toHaveLength(0);
  });

  test('is refused while video is not set up', async () => {
    const d = await doctor();
    await consultation(d.id);
    vi.stubEnv('CALL_KEY_SECRET', '');
    expect(await gpPass(db, d.id, NOW)).toEqual({ ok: false, reason: 'video_off' });
    vi.stubEnv('CALL_KEY_SECRET', CALL_KEY_SECRET);
    vi.stubEnv('LIVEKIT_URL', '');
    expect(await gpPass(db, d.id, NOW)).toEqual({ ok: false, reason: 'video_off' });
  });

  test('is refused, recording nothing, when the media server cannot be reached', async () => {
    const d = await doctor();
    await consultation(d.id);
    vi.mocked(ensureRoom).mockRejectedValue(new Error('media server unavailable'));
    expect(await gpPass(db, d.id, NOW)).toEqual({ ok: false, reason: 'unavailable' });
    expect(await events()).toEqual([]);
  });

  // The consultation ended while its room was being made: no pass, and the room
  // that may have just been created is deleted again.
  test('is refused if the call closes while its room is being made', async () => {
    const d = await doctor();
    const c = await consultation(d.id);
    vi.mocked(ensureRoom).mockImplementation(async () => { await completeConsultation(db, d.id, at(1)); });
    expect(await gpPass(db, d.id, NOW)).toEqual({ ok: false, reason: 'closed' });
    expect(closeRoom).toHaveBeenCalledWith(expect.anything(), (await callOf(c.id)).room);
  });

  test('every pass is recorded, by role only', async () => {
    const d = await doctor();
    const c = await consultation(d.id);
    await gpPass(db, d.id, NOW);
    await gpPass(db, d.id, at(30));
    expect((await events()).map(({ consultationId, role, kind }) => ({ consultationId, role, kind }))).toEqual([
      { consultationId: c.id, role: 'gp', kind: 'pass_issued' },
      { consultationId: c.id, role: 'gp', kind: 'pass_issued' },
    ]);
  });
});

describe('the call', () => {
  test('is opened once, however many ask at the same moment', async () => {
    const d = await doctor();
    const c = await consultation(d.id);
    const secret = sealingSecret()!;
    const opened = await Promise.all(Array.from({ length: 5 }, () => openCall(db, c.id, secret, NOW)));
    expect(new Set(opened.map((o) => o?.room)).size).toBe(1);
    expect(await db.select().from(consultationCalls)).toHaveLength(1);
  });

  test('has its own room, identities and keys, shared with no other call', async () => {
    const made = [];
    for (let i = 0; i < 3; i += 1) {
      const d = await doctor();
      const c = await consultation(d.id);
      const result = await gpPass(db, d.id, NOW);
      if (!result.ok) throw new Error(result.reason);
      made.push({ room: (await callOf(c.id)).room, ...result.pass });
    }
    for (const field of ['room', 'identity', 'peerIdentity', 'ownKey', 'peerKey'] as const) {
      expect(new Set(made.map((m) => m[field])).size, field).toBe(3);
    }
    for (const m of made) {
      expect(m.ownKey).not.toBe(m.peerKey);
      expect(m.room).toMatch(/^[A-Za-z0-9_-]{22}$/);
      expect(m.identity).toMatch(/^[A-Za-z0-9_-]{22}$/);
    }
  });

  // A sealed key is bound to its consultation and role, so one copied into
  // another row opens nowhere, and the failure says nothing about the key.
  test('a key moved to another call is refused, and nothing about it is logged', async () => {
    const a = await doctor();
    const ca = await consultation(a.id);
    const b = await doctor();
    const cb = await consultation(b.id);
    await gpPass(db, a.id, NOW);
    await gpPass(db, b.id, NOW);
    const sealedA = (await callOf(ca.id)).sealedGpKey!;
    await db.update(consultationCalls).set({ sealedGpKey: sealedA }).where(eq(consultationCalls.consultationId, cb.id));
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await gpPass(db, b.id, at(10))).toEqual({ ok: false, reason: 'unavailable' });
    const errors = await db.select().from(appErrors);
    expect(errors.map((e) => e.message)).toEqual(['call_key_unreadable']);
    for (const text of [...errors.map((e) => `${e.route} ${e.message}`), ...logged.mock.calls.flat().map(String)]) {
      expect(text).not.toContain(sealedA);
      expect(text).not.toContain(cb.id);
    }
  });
});

describe('ending the consultation', () => {
  test.each([['completed', completeConsultation], ['no_show', markNoShow]] as const)(
    '(%s) closes the call and clears both keys in the same statement',
    async (_status, end) => {
      const d = await doctor();
      const c = await consultation(d.id);
      await gpPass(db, d.id, NOW);
      const { room } = await callOf(c.id);
      expect(await end(db, d.id, at(60))).toEqual({ ok: true, room });
      expect(await callOf(c.id)).toMatchObject({ closedAt: at(60), sealedGpKey: null, sealedPatientKey: null, roomDeletedAt: null });
      expect(await gpPass(db, d.id, at(61))).toEqual({ ok: false, reason: 'no_consultation' });
    },
  );

  test('with no call yet, ends the consultation and has no room to close', async () => {
    const d = await doctor();
    await consultation(d.id);
    expect(await completeConsultation(db, d.id, at(60))).toEqual({ ok: true, room: null });
  });
});

describe('closing rooms', () => {
  async function closedCall() {
    const d = await doctor();
    const c = await consultation(d.id);
    await gpPass(db, d.id, NOW);
    await completeConsultation(db, d.id, NOW);
    return callOf(c.id);
  }

  test('a room confirmed gone is recorded once', async () => {
    const call = await closedCall();
    await retryRoomDeletes(db, at(1));
    expect(closeRoom).toHaveBeenCalledWith(expect.anything(), call.room);
    expect((await callOf(call.consultationId)).roomDeletedAt).toEqual(at(1));
    expect((await events()).filter((e) => e.kind === 'room_closed')).toHaveLength(1);
    vi.mocked(closeRoom).mockClear();
    await retryRoomDeletes(db, at(100));
    expect(closeRoom).not.toHaveBeenCalled();
  });

  // Deleting the room is what cuts the media, so a failure is retried, backing
  // off, and the fifth raises an alert for the team.
  test('a failed delete is retried with backoff, and five failures raise an alert', async () => {
    const call = await closedCall();
    vi.mocked(closeRoom).mockResolvedValue(false);
    let clock = 0;
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      clock += attempt * 10;
      await retryRoomDeletes(db, at(clock));
      expect((await callOf(call.consultationId)).closeAttempts, `attempt ${attempt}`).toBe(attempt);
      await retryRoomDeletes(db, at(clock)); // too soon: no new attempt
      expect((await callOf(call.consultationId)).closeAttempts).toBe(attempt);
    }
    expect((await db.select().from(appErrors)).map((e) => e.message)).toEqual(['call_close_failed']);
    expect((await events()).filter((e) => e.kind === 'close_failed')).toHaveLength(1);
    vi.mocked(closeRoom).mockResolvedValue(true);
    await retryRoomDeletes(db, at(clock + 60));
    expect((await callOf(call.consultationId)).roomDeletedAt).toEqual(at(clock + 60));
  });

  test('the sweep closes a call whose consultation ended some other way', async () => {
    const d = await doctor();
    const c = await consultation(d.id);
    await gpPass(db, d.id, NOW);
    await db.update(consultations).set({ status: 'cancelled' }).where(eq(consultations.id, c.id));
    await sweepCalls(db, at(5));
    expect(await callOf(c.id)).toMatchObject({ closedAt: at(5), sealedGpKey: null, sealedPatientKey: null });
  });
});

describe('the development patient pass', () => {
  test('is the patient’s half of the live call', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const d = await doctor();
    const c = await consultation(d.id);
    await gpPass(db, d.id, NOW);
    const result = await devPatientPass(db, at(5));
    if (!result.ok) throw new Error(result.reason);
    const call = await callOf(c.id);
    expect(result.pass.identity).toBe(call.patientIdentity);
    expect(result.pass.peerIdentity).toBe(call.gpIdentity);
    expect(Buffer.from(result.pass.ownKey, 'base64url').equals(keyOf(call.sealedPatientKey, c.id, 'patient'))).toBe(true);
    expect((await events()).at(-1)).toMatchObject({ role: 'patient', kind: 'pass_issued' });
  });

  test('does not exist in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const d = await doctor();
    await consultation(d.id);
    expect(await devPatientPass(db, NOW)).toEqual({ ok: false, reason: 'video_off' });
    // Nor with only one of the demo deployment's two flags.
    for (const [demo, deployment] of [['1', ''], ['', '1']]) {
      vi.stubEnv('NEXT_PUBLIC_DEMO', demo);
      vi.stubEnv('DEMO_DEPLOYMENT', deployment);
      expect(await devPatientPass(db, NOW)).toEqual({ ok: false, reason: 'video_off' });
    }
    expect(await db.select().from(consultationCalls)).toHaveLength(0);
  });

  // demo.drquick.co.uk, a production build with both flags; app/dev/call adds
  // the passcode session and the demo database check in front of it.
  test('exists in the demo deployment', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_DEMO', '1');
    vi.stubEnv('DEMO_DEPLOYMENT', '1');
    const d = await doctor();
    const c = await consultation(d.id);
    const result = await devPatientPass(db, NOW);
    if (!result.ok) throw new Error(result.reason);
    expect(result.pass.identity).toBe((await callOf(c.id)).patientIdentity);
  });
});

describe('whether the patient prototype’s call is real', () => {
  test('in development, or in the demo deployment, when video calls are set up', () => {
    const cases: Array<[string, string, string, boolean]> = [
      ['development', '', '', true],
      ['production', '', '', false],
      ['production', '1', '', false],
      ['production', '', '1', false],
      ['production', '1', '1', true],
    ];
    for (const [nodeEnv, demo, deployment, real] of cases) {
      vi.stubEnv('NODE_ENV', nodeEnv);
      vi.stubEnv('NEXT_PUBLIC_DEMO', demo);
      vi.stubEnv('DEMO_DEPLOYMENT', deployment);
      expect(devVideoCalls(), `${nodeEnv}|${demo}|${deployment}`).toBe(real);
    }
    vi.stubEnv('CALL_KEY_SECRET', '');
    expect(devVideoCalls()).toBe(false);
  });
});

describe('webhooks', () => {
  async function liveCall() {
    const d = await doctor();
    const c = await consultation(d.id);
    await gpPass(db, d.id, NOW);
    return callOf(c.id);
  }
  const hook = (over: Partial<Parameters<typeof applyWebhook>[1]> = {}) => ({
    id: `EV_${randomUUID()}`, event: 'participant_joined', room: null, identity: null, unencryptedTrack: false, ...over,
  });

  test('joins and leaves are recorded by role, and a repeated notice changes nothing', async () => {
    const call = await liveCall();
    const joined = hook({ room: call.room, identity: call.patientIdentity });
    expect(await applyWebhook(db, joined, at(2))).toBe('recorded');
    expect(await applyWebhook(db, joined, at(3))).toBe('duplicate');
    expect(await applyWebhook(db, hook({ event: 'participant_left', room: call.room, identity: call.gpIdentity }), at(4))).toBe('recorded');
    expect((await events()).slice(1).map(({ role, kind }) => ({ role, kind }))).toEqual([
      { role: 'patient', kind: 'joined' }, { role: 'gp', kind: 'left' },
    ]);
  });

  test('a notice about a room that is not ours is ignored', async () => {
    expect(await applyWebhook(db, hook({ room: 'ROOM_elsewhere', identity: 'ID_x' }), NOW)).toBe('ignored');
    expect(await events()).toEqual([]);
  });

  test('a stranger in a call is removed and the team alerted', async () => {
    const call = await liveCall();
    expect(await applyWebhook(db, hook({ room: call.room, identity: 'ID_stranger' }), at(2))).toBe('removed');
    expect(removeParticipant).toHaveBeenCalledWith(expect.anything(), call.room, 'ID_stranger');
    expect((await events()).at(-1)).toMatchObject({ role: 'none', kind: 'unknown_participant' });
    expect((await db.select().from(appErrors)).map((e) => e.message)).toEqual(['call_unknown_participant']);
  });

  // The browsers refuse an unencrypted track anyway; the server ends the call too.
  test('an unencrypted track ends the call and alerts the team', async () => {
    const call = await liveCall();
    const result = await applyWebhook(db, hook({ event: 'track_published', room: call.room, identity: call.gpIdentity, unencryptedTrack: true }), at(2));
    expect(result).toBe('closed');
    expect(closeRoom).toHaveBeenCalledWith(expect.anything(), call.room);
    expect((await events()).at(-1)).toMatchObject({ role: 'gp', kind: 'unencrypted_track' });
    expect((await db.select().from(appErrors)).map((e) => e.message)).toEqual(['call_unencrypted_track']);
  });

  // Only a closed call's room counts as gone: an open call's room is made
  // again on its next pass, so marking it gone would hide a live room.
  test('a finished room is recorded as gone once its call is closed', async () => {
    const call = await liveCall();
    expect(await applyWebhook(db, hook({ event: 'room_finished', room: call.room }), at(5))).toBe('recorded');
    expect((await callOf(call.consultationId)).roomDeletedAt).toBeNull();
    const [gp] = await db.select().from(gps);
    await completeConsultation(db, gp.id, at(6));
    expect(await applyWebhook(db, hook({ event: 'room_finished', room: call.room }), at(9))).toBe('recorded');
    expect((await callOf(call.consultationId)).roomDeletedAt).toEqual(at(9));
  });

  // A notice that failed part-way was not applied, so it must not count as seen.
  test('a notice that fails part-way is applied when the media server sends it again', async () => {
    const call = await liveCall();
    const stranger = hook({ id: 'EV_retry', room: call.room, identity: 'ID_stranger' });
    vi.mocked(removeParticipant).mockRejectedValueOnce(new Error('network'));
    await expect(applyWebhook(db, stranger, at(2))).rejects.toThrow();
    expect(await db.select().from(livekitEvents)).toEqual([]);
    expect(await applyWebhook(db, stranger, at(3))).toBe('removed');
  });

  test('old notice ids are pruned after a day', async () => {
    const call = await liveCall();
    await applyWebhook(db, hook({ id: 'EV_old', room: call.room, identity: call.gpIdentity }), NOW);
    await applyWebhook(db, hook({ id: 'EV_new', room: call.room, identity: call.gpIdentity }), at(86_401));
    expect((await db.select().from(livekitEvents)).map((e) => e.id)).toEqual(['EV_new']);
  });
});
