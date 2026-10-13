import { randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { DB } from '@/lib/db';
import { appErrors, type CallEventKind, type CallRole } from '@/lib/db/schema';
import { SealError, open, seal, sealingSecret } from '@/lib/crypto/sealed';
import { rowsOf } from '@/lib/rate-limit';
import {
  closeRoom, ensureRoom, mintPass, removeParticipant, videoConfig, type CallWebhook, type VideoConfig,
} from '@/lib/video/livekit';

// The encrypted video call of a consultation, in our database
// (docs/superpowers/specs/2026-10-13-encrypted-video-calls-design.md). Our
// server is the root of trust: it makes each call's random room and identities
// and one key per participant, seals the keys at rest, hands them only to the
// GP holding the consultation (and, in development, its patient), and clears
// them in the statement that ends the consultation (lib/doctor/shift.ts end()).
// The media server is reached only through lib/video/livekit.ts.
//
// The rules of lib/doctor/shift.ts hold: one clock, the `now` passed in; every
// write one guarded statement. A key, a pass, a sealed value or a server's
// message never reaches a log, a response or app_errors: alerts are fixed codes.

export const CALL_KEY_LABEL = 'dq/call-key/v1';

type Role = 'gp' | 'patient';
export type CallPass = { url: string; token: string; identity: string; peerIdentity: string; ownKey: string; peerKey: string };
export type PassRefusal = 'video_off' | 'no_consultation' | 'closed' | 'unavailable';
export type PassResult = { ok: true; pass: CallPass } | { ok: false; reason: PassRefusal };
export type WebhookOutcome = 'recorded' | 'duplicate' | 'ignored' | 'removed' | 'closed';

const iso = (d: Date) => d.toISOString();
const DAY_MS = 86_400_000;
// 128 random bits: rooms and identities that mean nothing outside our database.
const randomId = () => randomBytes(16).toString('base64url');
const keyContext = (secret: Buffer, consultationId: string, role: Role) =>
  ({ secret, label: CALL_KEY_LABEL, aad: `${consultationId}|${role}` });
const no = (reason: PassRefusal): PassResult => ({ ok: false, reason });

async function record(db: DB, consultationId: string, role: CallRole, kind: CallEventKind, now: Date) {
  await db.execute(sql`
    insert into call_events (consultation_id, role, kind, at)
    values (${consultationId}::uuid, ${role}, ${kind}, ${iso(now)}::timestamptz)`);
}

// For the team, on the admin's Technical page: a fixed code, nothing more.
async function alert(db: DB, code: 'call_key_unreadable' | 'call_close_failed' | 'call_unknown_participant' | 'call_unencrypted_track') {
  await db.insert(appErrors).values({ route: 'video/calls', message: code }).catch(() => {});
}

type OpenCall = { room: string; gpIdentity: string; patientIdentity: string; closed: boolean };

/**
 * The call of an in-progress consultation, made the first time it is asked
 * for: a random room, two random identities, and a fresh 256-bit key for each
 * participant, sealed to this consultation and role. Safe to call at once from
 * several requests. Null if the consultation is not in progress and has no call.
 */
export async function openCall(db: DB, consultationId: string, secret: Buffer, now: Date): Promise<OpenCall | null> {
  const gpKey = randomBytes(32);
  const patientKey = randomBytes(32);
  try {
    await db.execute(sql`
      insert into consultation_calls
        (consultation_id, room, gp_identity, patient_identity, sealed_gp_key, sealed_patient_key, opened_at)
      select ${consultationId}::uuid, ${randomId()}, ${randomId()}, ${randomId()},
        ${seal(gpKey, keyContext(secret, consultationId, 'gp'))},
        ${seal(patientKey, keyContext(secret, consultationId, 'patient'))},
        ${iso(now)}::timestamptz
      where exists (select 1 from consultations where id = ${consultationId}::uuid and status = 'in_progress')
      on conflict (consultation_id) do nothing`);
  } finally {
    gpKey.fill(0);
    patientKey.fill(0);
  }
  const [row] = rowsOf<{ room: string; gp_identity: string; patient_identity: string; closed: boolean }>(await db.execute(sql`
    select room, gp_identity, patient_identity, closed_at is not null as closed
    from consultation_calls where consultation_id = ${consultationId}::uuid`));
  return row ? { room: row.room, gpIdentity: row.gp_identity, patientIdentity: row.patient_identity, closed: row.closed } : null;
}

async function issuePass(
  db: DB, config: VideoConfig, secret: Buffer, consultationId: string, role: Role, now: Date,
): Promise<PassResult> {
  const call = await openCall(db, consultationId, secret, now);
  if (!call) return no('no_consultation');
  if (call.closed) return no('closed');
  try {
    await ensureRoom(config, call.room);
  } catch {
    return no('unavailable');
  }
  // The consultation may have ended while its room was being made: then no
  // pass, and the room that may have just been created goes again.
  const [keys] = rowsOf<{ gp: string; patient: string }>(await db.execute(sql`
    select c.sealed_gp_key as gp, c.sealed_patient_key as patient
    from consultation_calls c join consultations k on k.id = c.consultation_id
    where c.consultation_id = ${consultationId}::uuid and c.closed_at is null and k.status = 'in_progress'`));
  if (!keys) {
    await closeRoom(config, call.room);
    return no('closed');
  }
  let gpKey: Buffer;
  let patientKey: Buffer;
  try {
    gpKey = open(keys.gp, keyContext(secret, consultationId, 'gp'));
    patientKey = open(keys.patient, keyContext(secret, consultationId, 'patient'));
  } catch (err) {
    if (!(err instanceof SealError)) throw err;
    await alert(db, 'call_key_unreadable');
    return no('unavailable');
  }
  try {
    const [own, peer] = role === 'gp' ? [gpKey, patientKey] : [patientKey, gpKey];
    const identity = role === 'gp' ? call.gpIdentity : call.patientIdentity;
    const peerIdentity = role === 'gp' ? call.patientIdentity : call.gpIdentity;
    const token = await mintPass(config, { room: call.room, identity });
    await record(db, consultationId, role, 'pass_issued', now);
    return {
      ok: true,
      pass: { url: config.url, token, identity, peerIdentity, ownKey: own.toString('base64url'), peerKey: peer.toString('base64url') },
    };
  } finally {
    gpKey.fill(0);
    patientKey.fill(0);
  }
}

/** The signed-in GP's pass to the call of the consultation they hold. Never an id from the browser. */
export async function gpPass(db: DB, gpId: string, now = new Date()): Promise<PassResult> {
  const config = videoConfig();
  const secret = sealingSecret();
  if (!config || !secret) return no('video_off');
  const [held] = rowsOf<{ id: string }>(await db.execute(sql`
    select id from consultations where gp_id = ${gpId}::uuid and status = 'in_progress'`));
  if (!held) return no('no_consultation');
  return issuePass(db, config, secret, held.id, 'gp', now);
}

/** Whether the patient prototype's call is real: a developer's machine with video calls set up. */
export function devVideoCalls(): boolean {
  return process.env.NODE_ENV === 'development' && videoConfig() !== null && sealingSecret() !== null;
}

/**
 * The patient's pass to the live consultation's call, for the patient prototype
 * on a developer's machine. There is no patient sign-in yet, so this never
 * exists in production; app/dev/call adds its own guards.
 */
export async function devPatientPass(db: DB, now = new Date()): Promise<PassResult> {
  if (process.env.NODE_ENV === 'production') return no('video_off');
  const config = videoConfig();
  const secret = sealingSecret();
  if (!config || !secret) return no('video_off');
  const [live] = rowsOf<{ id: string }>(await db.execute(sql`
    select id from consultations where status = 'in_progress' order by started_at desc limit 1`));
  if (!live) return no('no_consultation');
  return issuePass(db, config, secret, live.id, 'patient', now);
}

/**
 * Deletes a closed call's room, which is what disconnects both people: they
 * already hold the keys. True once the media server confirms it is gone.
 * Otherwise counts the attempt; the fifth failure alerts the team.
 */
export async function retireRoom(db: DB, room: string, now = new Date()): Promise<boolean> {
  const config = videoConfig();
  if (config && await closeRoom(config, room)) {
    const done = rowsOf<{ consultation_id: string }>(await db.execute(sql`
      update consultation_calls set room_deleted_at = ${iso(now)}::timestamptz
      where room = ${room} and closed_at is not null and room_deleted_at is null
      returning consultation_id`));
    for (const row of done) await record(db, row.consultation_id, 'none', 'room_closed', now);
    return true;
  }
  const [row] = rowsOf<{ consultation_id: string; close_attempts: number }>(await db.execute(sql`
    update consultation_calls set close_attempts = close_attempts + 1
    where room = ${room} and closed_at is not null and room_deleted_at is null
    returning consultation_id, close_attempts`));
  if (row && Number(row.close_attempts) === 5) {
    await record(db, row.consultation_id, 'none', 'close_failed', now);
    await alert(db, 'call_close_failed');
  }
  return false;
}

/**
 * Retries the rooms of closed calls not yet confirmed gone, backing off: after
 * n failed attempts the next waits until 10·n(n+1)/2 seconds after the close.
 */
export async function retryRoomDeletes(db: DB, now = new Date()): Promise<void> {
  const due = rowsOf<{ room: string }>(await db.execute(sql`
    select room from consultation_calls
    where closed_at is not null and room_deleted_at is null
      and closed_at + (close_attempts * (close_attempts + 1) / 2) * interval '10 seconds' < ${iso(now)}::timestamptz
    order by closed_at
    limit 10`));
  for (const { room } of due) await retireRoom(db, room, now);
}

/** Closes, and clears the keys of, any call whose consultation is no longer in progress. One guarded statement. */
export async function sweepCalls(db: DB, now = new Date()): Promise<void> {
  await db.execute(sql`
    update consultation_calls
    set closed_at = ${iso(now)}::timestamptz, sealed_gp_key = null, sealed_patient_key = null
    where closed_at is null
      and not exists (select 1 from consultations k where k.id = consultation_calls.consultation_id and k.status = 'in_progress')`);
}

/**
 * A verified webhook (lib/video/livekit.ts readWebhook) applied once. Joins and
 * leaves are recorded by role. A stranger in a call is removed, and an
 * unencrypted track ends the call: both alert the team.
 */
export async function applyWebhook(db: DB, event: CallWebhook, now = new Date()): Promise<WebhookOutcome> {
  await db.execute(sql`delete from livekit_events where received_at < ${iso(new Date(now.getTime() - DAY_MS))}::timestamptz`);
  const fresh = rowsOf(await db.execute(sql`
    insert into livekit_events (id, received_at) values (${event.id}, ${iso(now)}::timestamptz)
    on conflict (id) do nothing returning id`));
  if (fresh.length === 0) return 'duplicate';
  try {
    return await applyOnce(db, event, now);
  } catch (err) {
    // Not applied, so not seen: the media server's retry gets another go.
    await db.execute(sql`delete from livekit_events where id = ${event.id}`).catch(() => {});
    throw err;
  }
}

async function applyOnce(db: DB, event: CallWebhook, now: Date): Promise<WebhookOutcome> {
  if (!event.room) return 'ignored';

  const [call] = rowsOf<{ consultation_id: string; gp_identity: string; patient_identity: string }>(await db.execute(sql`
    select consultation_id, gp_identity, patient_identity from consultation_calls where room = ${event.room}`));
  if (!call) return 'ignored';

  if (event.event === 'room_finished') {
    // Only a closed call's room counts as gone: an open one is made again on the next pass.
    await db.execute(sql`
      update consultation_calls set room_deleted_at = ${iso(now)}::timestamptz
      where room = ${event.room} and closed_at is not null and room_deleted_at is null`);
    return 'recorded';
  }

  const role: Role | null = event.identity === call.gp_identity ? 'gp' : event.identity === call.patient_identity ? 'patient' : null;
  const config = videoConfig();
  if (!role) {
    if (!event.identity || (event.event !== 'participant_joined' && event.event !== 'track_published')) return 'ignored';
    if (config) await removeParticipant(config, event.room, event.identity);
    await record(db, call.consultation_id, 'none', 'unknown_participant', now);
    await alert(db, 'call_unknown_participant');
    return 'removed';
  }

  if (event.unencryptedTrack) {
    await db.execute(sql`
      update consultation_calls
      set closed_at = coalesce(closed_at, ${iso(now)}::timestamptz), sealed_gp_key = null, sealed_patient_key = null
      where room = ${event.room}`);
    if (config && await closeRoom(config, event.room)) {
      await db.execute(sql`
        update consultation_calls set room_deleted_at = ${iso(now)}::timestamptz
        where room = ${event.room} and room_deleted_at is null`);
    }
    await record(db, call.consultation_id, role, 'unencrypted_track', now);
    await alert(db, 'call_unencrypted_track');
    return 'closed';
  }

  if (event.event === 'participant_joined' || event.event === 'participant_left') {
    await record(db, call.consultation_id, role, event.event === 'participant_joined' ? 'joined' : 'left', now);
    return 'recorded';
  }
  return 'ignored';
}
