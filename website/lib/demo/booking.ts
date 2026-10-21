// The investor demo's patient request (app/dev/demo/booking, called by
// components/patient/useDemoBooking.ts): the booking the presenter makes in the
// patient app becomes a real waiting consultation, which the ordinary
// dispatcher offers to the demo doctor in the portal. Development only, behind
// lib/demo/guard.ts. Everything it writes belongs to one patient address,
// which the seed's clear-out already covers (demo-patient-*@example.com in
// lib/dev/seed-doctor.ts), so Reset removes it.
//
// The dispatcher's rules hold here (lib/doctor/dispatch.ts): one clock, the
// `now` passed in; inside a transaction, `tx` only; and a request changes
// state in one guarded statement, so a doctor's accept and a patient's cancel
// can never both win.
import { randomUUID } from 'node:crypto';
import { eq, sql, type SQL } from 'drizzle-orm';
import type { DB } from '@/lib/db';
import { consultations, patients, payments } from '@/lib/db/schema';
import { COMPLAINTS } from '@/lib/booking';
import type { ComplaintId } from '@/lib/booking-flow';
import { AGE_BANDS, assertLocal } from '@/lib/dev/seed-doctor';
import { MAX_REQUEST_MINUTES, dispatch } from '@/lib/doctor/dispatch';
import { splitPrice } from '@/lib/finance/commission';
import { rowsOf } from '@/lib/rate-limit';

export const DEMO_PATIENT_EMAIL = 'demo-patient-live@example.com';
// The patient app asks no age, so the doctor is shown one of the seed's bands,
// the same one every run.
const AGE_BAND = AGE_BANDS[1];

export type DemoRequestInput = { complaint: ComplaintId; pricePence: number; recordConsent: boolean };
export type DemoRequestStatus = 'waiting' | 'matched' | 'completed' | 'ended';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isRequestId = (id: unknown): id is string => typeof id === 'string' && UUID.test(id);

type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];
const iso = (d: Date) => d.toISOString();

// One statement: the live patient's requests that match `which` and are still
// waiting are cancelled, and an offer a doctor holds for one is withdrawn,
// which keeps that doctor's place in the rotation. A consultation a doctor has
// already accepted is no longer waiting, so it is never touched.
function withdraw(handle: DB | Tx, which: SQL, now: Date) {
  return handle.execute(sql`
    with cancelled as (
      update consultations c set status = 'cancelled', ended_at = ${iso(now)}::timestamptz
      from patients p
      where p.id = c.patient_id and p.email = ${DEMO_PATIENT_EMAIL} and c.status = 'requested' and ${which}
      returning c.id
    )
    update consultation_offers set status = 'withdrawn', responded_at = ${iso(now)}::timestamptz
    where status = 'offered' and consultation_id in (select id from cancelled)`);
}

/**
 * The patient asks for a GP. Whatever they left waiting before is cancelled
 * first, so the doctor is only ever offered the booking on screen.
 */
export async function createDemoRequest(db: DB, input: DemoRequestInput, now = new Date()): Promise<{ consultationId: string }> {
  assertLocal();
  const consultationId = randomUUID();
  const { pricePence, recordConsent } = input;
  await db.transaction(async (tx) => {
    await tx.insert(patients).values({ email: DEMO_PATIENT_EMAIL }).onConflictDoNothing();
    const [patient] = await tx.select({ id: patients.id }).from(patients).where(eq(patients.email, DEMO_PATIENT_EMAIL));
    await withdraw(tx, sql`true`, now);
    await tx.insert(consultations).values({
      id: consultationId, patientId: patient.id, status: 'requested', requestedAt: now, pricePence,
      // Provisional until a doctor accepts; the accept writes the split they were quoted.
      ...splitPrice(pricePence, 0),
      // The complaint's stock label, never the patient's own words.
      reason: COMPLAINTS[input.complaint].label, ageBand: AGE_BAND, recordConsent,
    });
    // As addWaitingRequest does: there is no payment flow, so it is paid up
    // front, or a consultation completed in the demo would never be earned.
    await tx.insert(payments).values({ consultationId, amountPence: pricePence, status: 'succeeded', paidAt: now, createdAt: now });
  });
  // Whatever creates a consultation runs the dispatcher.
  await dispatch(db, now, { wait: true });
  return { consultationId };
}

/**
 * The patient's poll. It runs the dispatcher first: if the only doctor holding
 * an offer has gone quiet, the patient's wait screen is what expires it.
 *
 * A request nobody can take any more has ended. The dispatcher never offers a
 * consultation to a doctor who has had it, and the demo has one doctor, so
 * once they have declined it or let it lapse (the window ran out, or their
 * portal went quiet), it would wait for ever. With no live offer left, it is
 * cancelled here, in the same guarded statement as any cancel, and the
 * patient is told no GP is available. The same goes for a request older than
 * the dispatcher's MAX_REQUEST_MINUTES, which it never offers.
 */
export async function demoRequestStatus(db: DB, id: string, now = new Date()): Promise<DemoRequestStatus> {
  if (!isRequestId(id)) return 'ended';
  await dispatch(db, now);
  await withdraw(db, sql`c.id = ${id}
    and not exists (select 1 from consultation_offers o where o.consultation_id = c.id and o.status = 'offered')
    and (exists (select 1 from consultation_offers o where o.consultation_id = c.id and o.status in ('declined', 'expired'))
      or c.requested_at <= ${iso(new Date(now.getTime() - MAX_REQUEST_MINUTES * 60_000))}::timestamptz)`, now);
  const [row] = rowsOf<{ status: string }>(await db.execute(sql`
    select c.status from consultations c join patients p on p.id = c.patient_id
    where c.id = ${id} and p.email = ${DEMO_PATIENT_EMAIL}`));
  switch (row?.status) {
    case 'requested': return 'waiting';
    case 'in_progress': return 'matched';
    case 'completed': return 'completed';
    default: return 'ended';
  }
}

/** The patient cancelled while waiting. A request a doctor has taken stays theirs. */
export async function cancelDemoRequest(db: DB, id: string, now = new Date()): Promise<void> {
  assertLocal();
  if (!isRequestId(id)) return;
  await withdraw(db, sql`c.id = ${id}`, now);
  // A doctor whose offer was withdrawn is free for whatever else is waiting.
  await dispatch(db, now, { wait: true });
}
