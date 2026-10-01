// A doctor's shift: going online and offline, the offer in front of them, and
// the consultation they are in. Server-only. The dispatcher decides who is
// offered what (lib/doctor/dispatch.ts); this file is what a doctor does about
// it, and what their screen should show.
//
// Every write is one guarded statement, so a late click, a double click or two
// tabs can never assign a consultation twice or end one that is not theirs. A
// statement that changes nothing is then asked why, and the answer is returned
// as a reason rather than thrown.
//
// One clock, as in the dispatcher: the `now` passed in.
import { sql } from 'drizzle-orm';
import type { DB } from '@/lib/db';
import { GRACE_SECONDS, OFFER_SECONDS, dispatch } from '@/lib/doctor/dispatch';
import { rowsOf } from '@/lib/rate-limit';

// What the portal shows. Times are durations measured on the server, never
// absolute times, so a doctor's own clock being wrong cannot stretch a window.
export type ShiftState =
  // The account may not go online: not yet approved, or paused by the team.
  | { kind: 'unavailable'; reason: 'onboarding' | 'paused' }
  | { kind: 'offline' }
  | { kind: 'idle'; onlineMs: number }
  // Online but out of the rotation until they tap Back online: an offer went
  // unanswered, or a consultation has just ended.
  | { kind: 'resting'; reason: 'missed' | 'finished' }
  | {
      kind: 'offer'; offerId: string; feePence: number;
      // The three things a doctor may know before accepting, and nothing more.
      reason: string | null; ageBand: string | null; recordConsent: boolean | null;
      remainingMs: number; windowSeconds: number;
    }
  | { kind: 'consultation'; consultationId: string; feePence: number; reason: string | null; ageBand: string | null; elapsedMs: number };

export type ShiftReason =
  | 'not_active' | 'not_online' | 'in_consultation' | 'expired' | 'withdrawn' | 'not_found' | 'busy' | 'nothing_in_progress';
export type ShiftResult = { ok: true } | { ok: false; reason: ShiftReason };

const OK: ShiftResult = { ok: true };
const no = (reason: ShiftReason): ShiftResult => ({ ok: false, reason });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const iso = (d: Date) => d.toISOString();
const ms = (v: unknown) => Math.round(Number(v ?? 0));

const inConsultation = async (db: DB, gpId: string) => rowsOf(await db.execute(
  sql`select 1 from consultations where gp_id = ${gpId} and status = 'in_progress' limit 1`)).length > 0;

/* ------------------------------------------------------------ the state */

export async function shiftState(db: DB, gpId: string, now = new Date()): Promise<ShiftState> {
  const ts = iso(now);

  // A consultation in progress outranks everything, the account's status
  // included: whatever else has happened, the doctor must be able to end it.
  const [c] = rowsOf<{ id: string; gp_fee_pence: number; reason: string | null; age_band: string | null; elapsed_ms: number }>(
    await db.execute(sql`
      select id, gp_fee_pence, reason, age_band,
        extract(epoch from (${ts}::timestamptz - coalesce(started_at, ${ts}::timestamptz))) * 1000 as elapsed_ms
      from consultations where gp_id = ${gpId} and status = 'in_progress' limit 1`));
  if (c) {
    return {
      kind: 'consultation', consultationId: c.id, feePence: Number(c.gp_fee_pence), reason: c.reason, ageBand: c.age_band,
      elapsedMs: Math.max(0, ms(c.elapsed_ms)),
    };
  }

  const [g] = rowsOf<{ status: string; online: boolean; available: boolean; online_ms: number | null }>(await db.execute(sql`
    select status, online_since is not null as online, available_since is not null as available,
      extract(epoch from (${ts}::timestamptz - online_since)) * 1000 as online_ms
    from gps where id = ${gpId}`));
  if (!g) return { kind: 'offline' };
  if (g.status !== 'active') return { kind: 'unavailable', reason: g.status === 'paused' ? 'paused' : 'onboarding' };
  if (!g.online) return { kind: 'offline' };

  const [o] = rowsOf<{
    id: string; gp_fee_pence: number; reason: string | null; age_band: string | null; record_consent: boolean | null; left_ms: number;
  }>(await db.execute(sql`
    select o.id, o.gp_fee_pence, c.reason, c.age_band, c.record_consent,
      extract(epoch from (o.expires_at - ${ts}::timestamptz)) * 1000 as left_ms
    from consultation_offers o join consultations c on c.id = o.consultation_id
    where o.gp_id = ${gpId} and o.status = 'offered' and o.expires_at > ${ts}::timestamptz and c.status = 'requested'
    limit 1`));
  if (o) {
    return {
      kind: 'offer', offerId: o.id, feePence: Number(o.gp_fee_pence),
      reason: o.reason, ageBand: o.age_band, recordConsent: o.record_consent,
      // The grace is not shown: the countdown reaches zero before the offer does.
      remainingMs: Math.min(OFFER_SECONDS * 1000, Math.max(0, ms(o.left_ms) - GRACE_SECONDS * 1000)),
      windowSeconds: OFFER_SECONDS,
    };
  }

  if (g.available) return { kind: 'idle', onlineMs: Math.max(0, ms(g.online_ms)) };

  // Out of the rotation. The last offer says why: one that ran out was missed;
  // otherwise the last thing that happened was a consultation ending.
  const [last] = rowsOf<{ status: string }>(await db.execute(
    sql`select status from consultation_offers where gp_id = ${gpId} order by offered_at desc limit 1`));
  return { kind: 'resting', reason: last?.status === 'expired' ? 'missed' : 'finished' };
}

/* ------------------------------------------------- online and offline */

export async function goOnline(db: DB, gpId: string, now = new Date()): Promise<ShiftResult> {
  const ts = iso(now);
  // Coming online joins the back of the rotation, unless they are mid-offer or
  // mid-consultation, where their place is already settled.
  const rows = rowsOf(await db.execute(sql`
    update gps set online_since = coalesce(online_since, ${ts}::timestamptz), last_seen_at = ${ts}::timestamptz,
      available_since = case
        when exists (select 1 from consultations x where x.gp_id = gps.id and x.status = 'in_progress') then null
        when exists (select 1 from consultation_offers o where o.gp_id = gps.id and o.status = 'offered') then available_since
        else ${ts}::timestamptz end
    where id = ${gpId} and status = 'active'
    returning id`));
  if (rows.length === 0) return no('not_active');
  await dispatch(db, now, { wait: true });
  return OK;
}

export async function goOffline(db: DB, gpId: string, now = new Date()): Promise<ShiftResult> {
  if (await inConsultation(db, gpId)) return no('in_consultation');
  const ts = iso(now);
  // An offer they were holding goes straight on to the next doctor.
  await db.execute(sql`
    update consultation_offers set status = 'declined', responded_at = ${ts}::timestamptz
    where gp_id = ${gpId} and status = 'offered'`);
  await db.execute(sql`update gps set online_since = null, available_since = null where id = ${gpId}`);
  await dispatch(db, now, { wait: true });
  return OK;
}

// Back into the rotation after a missed offer or a finished consultation.
export async function backOnline(db: DB, gpId: string, now = new Date()): Promise<ShiftResult> {
  if (await inConsultation(db, gpId)) return no('in_consultation');
  const ts = iso(now);
  const rows = rowsOf(await db.execute(sql`
    update gps set available_since = ${ts}::timestamptz, last_seen_at = ${ts}::timestamptz
    where id = ${gpId} and status = 'active' and online_since is not null and available_since is null
    returning id`));
  if (rows.length === 0) {
    const [g] = rowsOf<{ status: string; online: boolean }>(await db.execute(
      sql`select status, online_since is not null as online from gps where id = ${gpId}`));
    if (!g || g.status !== 'active') return no('not_active');
    if (!g.online) return no('not_online');
    return OK; // already in the rotation
  }
  await dispatch(db, now, { wait: true });
  return OK;
}

/**
 * The portal's poll: records that the doctor is here, brings the offers up to
 * date, and answers with what to show. An offline doctor's poll records nothing.
 */
export async function pulse(db: DB, gpId: string, now = new Date()): Promise<ShiftState> {
  const here = rowsOf(await db.execute(sql`
    update gps set last_seen_at = ${iso(now)}::timestamptz where id = ${gpId} and online_since is not null returning id`));
  if (here.length > 0) await dispatch(db, now);
  return shiftState(db, gpId, now);
}

/* ----------------------------------------------------------- the offer */

const isUniqueViolation = (err: unknown) => {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.cause?.code === '23505' || e?.code === '23505';
};

export async function acceptOffer(db: DB, gpId: string, offerId: string, now = new Date()): Promise<ShiftResult> {
  if (!UUID.test(String(offerId))) return no('not_found');
  const ts = iso(now);
  let taken: unknown[];
  try {
    // One statement: the offer is locked, the consultation is taken at the fee
    // that was quoted, the doctor leaves the rotation, and only then is the
    // offer marked accepted. If the consultation cannot be taken, none of it is.
    taken = rowsOf(await db.execute(sql`
      with o as (
        select id, consultation_id, gp_fee_pence from consultation_offers
        where id = ${offerId} and gp_id = ${gpId} and status = 'offered' and expires_at > ${ts}::timestamptz
        for update
      ), c as (
        update consultations set status = 'in_progress', gp_id = ${gpId}, started_at = ${ts}::timestamptz,
          gp_fee_pence = (select gp_fee_pence from o),
          platform_fee_pence = price_pence - (select gp_fee_pence from o)
        where id = (select consultation_id from o) and status = 'requested'
          and exists (select 1 from gps where id = ${gpId} and status = 'active')
        returning id
      ), g as (
        update gps set available_since = null where id = ${gpId} and exists (select 1 from c) returning id
      )
      update consultation_offers set status = 'accepted', responded_at = ${ts}::timestamptz
      where id = (select id from o) and exists (select 1 from c)
      returning consultation_id`));
  } catch (err) {
    // consultations_gp_live: they already hold a consultation. Nothing changed.
    if (isUniqueViolation(err)) return no('busy');
    throw err;
  }
  if (taken.length > 0) return OK;

  const [o] = rowsOf<{ status: string; late: boolean; requested: boolean }>(await db.execute(sql`
    select o.status, o.expires_at <= ${ts}::timestamptz as late,
      exists (select 1 from consultations c where c.id = o.consultation_id and c.status = 'requested') as requested
    from consultation_offers o where o.id = ${offerId} and o.gp_id = ${gpId}`));
  if (!o) return no('not_found');
  if (o.status === 'accepted') return OK; // their own second click
  if (o.status === 'withdrawn') return no('withdrawn');
  if (o.status !== 'offered' || o.late) return no('expired');
  return o.requested ? no('not_active') : no('withdrawn');
}

export async function declineOffer(db: DB, gpId: string, offerId: string, now = new Date()): Promise<ShiftResult> {
  if (!UUID.test(String(offerId))) return no('not_found');
  const ts = iso(now);
  const declined = rowsOf(await db.execute(sql`
    update consultation_offers set status = 'declined', responded_at = ${ts}::timestamptz
    where id = ${offerId} and gp_id = ${gpId} and status = 'offered' and expires_at > ${ts}::timestamptz
    returning id`));
  if (declined.length > 0) {
    // They answered, so they are plainly there: back of the queue, no tap needed.
    await db.execute(sql`update gps set available_since = ${ts}::timestamptz where id = ${gpId} and online_since is not null`);
    await dispatch(db, now, { wait: true });
    return OK;
  }
  const [o] = rowsOf<{ status: string }>(await db.execute(
    sql`select status from consultation_offers where id = ${offerId} and gp_id = ${gpId}`));
  if (!o) return no('not_found');
  if (o.status === 'declined') return OK;
  if (o.status === 'withdrawn') return no('withdrawn');
  return no('expired');
}

/* ---------------------------------------------------- the consultation */

// A doctor holds at most one consultation, so no id comes from the browser:
// each ends their own, whichever it is.
async function end(db: DB, gpId: string, to: 'completed' | 'no_show', now: Date): Promise<ShiftResult> {
  const ended = rowsOf(await db.execute(sql`
    update consultations set status = ${to}, ended_at = ${iso(now)}::timestamptz
    where gp_id = ${gpId} and status = 'in_progress'
    returning id`));
  return ended.length > 0 ? OK : no('nothing_in_progress');
}

export const completeConsultation = (db: DB, gpId: string, now = new Date()) => end(db, gpId, 'completed', now);
export const markNoShow = (db: DB, gpId: string, now = new Date()) => end(db, gpId, 'no_show', now);
