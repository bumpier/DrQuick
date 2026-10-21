'use server';
// What a doctor does on shift. Each action is an untrusted POST (Next checks
// only that it is same-origin), so each starts with requireDoctor() and acts
// for that doctor alone. Each answers with the state the screen should now
// show, so a click never waits for the next poll. None of them sets a cookie
// or revalidates a path: either would re-render the page mid-click.
import { after } from 'next/server';
import { getDb } from '@/lib/db';
import { retireRoom } from '@/lib/video/calls';
import { requireDoctor, type Doctor } from '@/lib/doctor-auth';
import {
  acceptOffer, backOnline, completeConsultation, declineOffer, goOffline, goOnline, markNoShow, shiftState,
  type ShiftReason, type ShiftResult, type ShiftState,
} from '@/lib/doctor/shift';
import type { DB } from '@/lib/db';

export type ShiftActionResult = ({ ok: true; message?: string } | { ok: false; error: string }) & { state: ShiftState };

function words(reason: ShiftReason, doctor: Doctor): string {
  switch (reason) {
    case 'not_active':
      return doctor.status === 'paused'
        ? 'Your account is paused. Contact the team.'
        : 'Your account has not been approved to go online yet.';
    case 'not_online': return 'Go online first.';
    case 'in_consultation': return 'Finish your consultation first.';
    case 'busy': return 'Finish your current consultation first.';
    case 'expired': return 'This offer has expired.';
    case 'withdrawn': return 'The patient cancelled this request.';
    case 'not_found': return 'That offer is no longer available.';
    case 'nothing_in_progress': return 'There is no consultation in progress.';
  }
}

async function act(run: (db: DB, doctor: Doctor) => Promise<ShiftResult>, message?: string): Promise<ShiftActionResult> {
  const doctor = await requireDoctor();
  const db = await getDb();
  if (!db) return { ok: false, error: 'The database is not configured on this server (set DATABASE_URL).', state: { kind: 'offline' } };
  const result = await run(db, doctor);
  const state = await shiftState(db, doctor.id);
  return result.ok ? { ok: true, message, state } : { ok: false, error: words(result.reason, doctor), state };
}

export const goOnlineAction = async () => act((db, d) => goOnline(db, d.id));
export const goOfflineAction = async () => act((db, d) => goOffline(db, d.id));
export const backOnlineAction = async () => act((db, d) => backOnline(db, d.id));
export const acceptAction = async (offerId: string) => act((db, d) => acceptOffer(db, d.id, String(offerId)));
export const declineAction = async (offerId: string) => act((db, d) => declineOffer(db, d.id, String(offerId)));
// Ending a consultation closes its video call and clears its keys in the same
// statement. The people in the call hold the keys, so its room, which is what
// disconnects them, is deleted once the reply has gone; every poll retries
// until the media server confirms it (lib/video/calls.ts).
const ending = (end: typeof completeConsultation) => async (db: DB, doctor: Doctor): Promise<ShiftResult> => {
  const result = await end(db, doctor.id);
  if (result.ok && result.room) {
    const room = result.room;
    after(() => retireRoom(db, room).catch(() => {}));
  }
  return result;
};

export const completeAction = async () => act(ending(completeConsultation), 'Consultation completed.');
export const noShowAction = async () => act(ending(markNoShow), 'Recorded as a no-show.');
