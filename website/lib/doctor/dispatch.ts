// The dispatcher: a waiting consultation is offered to one online doctor at a
// time for a short window; a decline or a timeout passes it to the next, and
// the same doctor is never offered the same consultation twice. Server-only.
//
// There is no background worker. dispatch() is run by whoever is waiting on its
// outcome: every online doctor's poll (app/doctor/pulse), and every action that
// frees a doctor or a request (lib/doctor/shift.ts). An offer only matters
// while a doctor is online and polling, so that is enough for the doctor side.
// THE PATIENT SIDE MUST RUN IT TOO: if the only doctor holding an offer shuts
// their laptop, no doctor is polling, and only the patient's wait screen is
// left to drive the clock. Whatever creates a consultation, and whatever shows
// a patient the queue, must call dispatch().
//
// One clock: the `now` passed in, on every statement. Never the database's
// now(): the window would then be judged against two clocks.
//
// Two layers keep it honest. An advisory lock makes dispatches run one at a
// time; the partial unique indexes on consultation_offers (lib/db/schema.ts)
// refuse a second live offer for a doctor or a consultation even if the lock
// were bypassed. Inside the transaction every statement goes through `tx`: on
// PGlite, reaching for the outer handle from in here never returns.
import { sql } from 'drizzle-orm';
import type { DB } from '@/lib/db';
import { splitPrice } from '@/lib/finance/commission';
import { rowsOf } from '@/lib/rate-limit';

// What the doctor is shown counting down.
export const OFFER_SECONDS = 45;
// Stored on top of it, so a click made while the countdown still shows 1 lands.
export const GRACE_SECONDS = 3;
// A portal that has not checked in for this long is not looking: it gets no
// offer, and loses the one it holds.
export const STALE_SECONDS = 15;
// Silent for this long, a doctor is taken offline.
export const GONE_SECONDS = 120;
// A request older than this is abandoned and is never offered: a doctor going
// online in the morning must not be handed last night's.
export const MAX_REQUEST_MINUTES = 15;

const BATCH = 50;

type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];
export type DispatchResult = { skipped: boolean; offered: number };

const iso = (d: Date) => d.toISOString();
const before = (now: Date, seconds: number) => iso(new Date(now.getTime() - seconds * 1000));

/**
 * Brings the offers up to date as of `now`. The poll passes no options and
 * steps aside (`skipped`) when another dispatch is running; an event that must
 * not be lost (a decline, a doctor going offline or coming back) passes
 * `wait: true` and queues behind it instead.
 */
export async function dispatch(db: DB, now = new Date(), opts: { wait?: boolean } = {}): Promise<DispatchResult> {
  return db.transaction(async (tx) => {
    if (opts.wait) {
      await tx.execute(sql`select pg_advisory_xact_lock(7301001)`);
    } else {
      const [lock] = rowsOf<{ locked: boolean }>(await tx.execute(sql`select pg_try_advisory_xact_lock(7301001) as locked`));
      if (!lock?.locked) return { skipped: true, offered: 0 };
    }
    await withdrawCancelled(tx, now);
    await expireDead(tx, now);
    await sweepGone(tx, now);
    return { skipped: false, offered: await offerWaiting(tx, now) };
  });
}

// The patient cancelled while it was on offer. Not the doctor's doing, so they
// keep their place in the rotation.
async function withdrawCancelled(tx: Tx, now: Date) {
  await tx.execute(sql`
    update consultation_offers as o set status = 'withdrawn', responded_at = ${iso(now)}::timestamptz
    where o.status = 'offered'
      and not exists (select 1 from consultations c where c.id = o.consultation_id and c.status = 'requested')`);
}

// The window ran out, or the doctor is no longer there to see it: gone silent,
// gone offline, or taken off the floor by the team. They leave the rotation
// until they tap Back online; otherwise one unresponsive doctor would add a
// full window to every patient's wait.
async function expireDead(tx: Tx, now: Date) {
  await tx.execute(sql`
    with dead as (
      update consultation_offers as o set status = 'expired', responded_at = ${iso(now)}::timestamptz
      where o.status = 'offered' and (
        o.expires_at <= ${iso(now)}::timestamptz
        or not exists (
          select 1 from gps g where g.id = o.gp_id and g.status = 'active' and g.online_since is not null
            and g.last_seen_at > ${before(now, STALE_SECONDS)}::timestamptz
        )
      )
      returning o.gp_id
    )
    update gps set available_since = null where id in (select gp_id from dead)`);
}

// A doctor in a consultation is left alone: their portal may sit in a hidden
// tab for the length of the call.
async function sweepGone(tx: Tx, now: Date) {
  await tx.execute(sql`
    update gps set online_since = null, available_since = null
    where online_since is not null
      and (last_seen_at is null or last_seen_at <= ${before(now, GONE_SECONDS)}::timestamptz)
      and not exists (select 1 from consultations x where x.gp_id = gps.id and x.status = 'in_progress')`);
}

// Oldest request first, and never by price: demand may move what a consultation
// costs, but it may not reorder the queue (CLAUDE.md, Compliance constraints).
// Each goes to the doctor who has been available longest.
async function offerWaiting(tx: Tx, now: Date): Promise<number> {
  const waiting = rowsOf<{ id: string; price_pence: number }>(await tx.execute(sql`
    select c.id, c.price_pence from consultations c
    where c.status = 'requested' and c.requested_at > ${before(now, MAX_REQUEST_MINUTES * 60)}::timestamptz
      and not exists (select 1 from consultation_offers o where o.consultation_id = c.id and o.status = 'offered')
    order by c.requested_at asc, c.id asc limit ${BATCH}`));

  const expires = iso(new Date(now.getTime() + (OFFER_SECONDS + GRACE_SECONDS) * 1000));
  let offered = 0;
  for (const c of waiting) {
    const [gp] = rowsOf<{ id: string; served: number }>(await tx.execute(sql`
      select g.id,
        (select count(*) from consultations x where x.gp_id = g.id and x.status = 'completed')::int as served
      from gps g
      where g.status = 'active' and g.online_since is not null and g.available_since is not null
        and g.last_seen_at > ${before(now, STALE_SECONDS)}::timestamptz
        and not exists (select 1 from consultation_offers o where o.gp_id = g.id and o.status = 'offered')
        and not exists (select 1 from consultations x where x.gp_id = g.id and x.status = 'in_progress')
        and not exists (select 1 from consultation_offers o where o.gp_id = g.id and o.consultation_id = ${c.id})
      order by g.available_since asc, g.id asc limit 1`));
    // Nobody free who has not already had this one. A later request may still
    // have a taker, so carry on.
    if (!gp) continue;

    // The fee is fixed now, at the tier this doctor holds, so the figure they
    // are shown is the figure they are paid.
    const { gpFeePence } = splitPrice(Number(c.price_pence), Number(gp.served));
    const made = rowsOf<{ id: string }>(await tx.execute(sql`
      insert into consultation_offers (consultation_id, gp_id, status, gp_fee_pence, offered_at, expires_at)
      values (${c.id}, ${gp.id}, 'offered', ${gpFeePence}, ${iso(now)}::timestamptz, ${expires}::timestamptz)
      on conflict do nothing
      returning id`));
    offered += made.length;
  }
  return offered;
}
