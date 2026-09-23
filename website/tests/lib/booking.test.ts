import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  waitEstimate, isEligibleGp, matchGp, outcomeFor, endedEarly,
  consultationRecord, formatClock, nextConsultationId, COMPLAINTS,
} from '@/lib/booking';

test('the wait is divided by the GPs actually online, not counted head by head', () => {
  assert.deepEqual(waitEstimate({ waiting: 4, gpsOnline: 2 }), { position: 3, etaSeconds: 135 });
  assert.deepEqual(waitEstimate({ waiting: 4, gpsOnline: 1 }), { position: 5, etaSeconds: 225 });
  assert.deepEqual(waitEstimate({ waiting: 0, gpsOnline: 3 }), { position: 1, etaSeconds: 45 });
});

test('an empty floor never estimates a zero wait', () => {
  assert.equal(waitEstimate({ waiting: 0, gpsOnline: 0 }).position, 1);
});

test('a GP with a lapsed, pending or rejected credential cannot take a consultation', () => {
  const gp = (status: string) => ({ online: true, credentials: { gmc: { status: 'valid' }, dbs: { status } } });
  assert.equal(isEligibleGp(gp('valid')), true);
  assert.equal(isEligibleGp(gp('expiring')), true, 'close to expiry is still in date');
  assert.equal(isEligibleGp(gp('expired')), false);
  assert.equal(isEligibleGp(gp('pending')), false);
  assert.equal(isEligibleGp(gp('rejected')), false);
});

test('an offline GP is never matched, however good their credentials', () => {
  assert.equal(isEligibleGp({ online: false, credentials: { gmc: { status: 'valid' } } }), false);
});

const FLOOR_GPS = [
  { ref: 'GP-001', online: true, credentials: { gmc: { status: 'valid' } } },
  { ref: 'GP-002', online: true, credentials: { gmc: { status: 'valid' } } },
  { ref: 'GP-003', online: false, credentials: { gmc: { status: 'valid' } } },
];
const LOAD = [
  { ref: 'GP-001', consults: 45 },
  { ref: 'GP-002', consults: 40 },
  { ref: 'GP-003', consults: 0 },
];

test('matching picks the least-loaded eligible GP', () => {
  assert.equal(matchGp(FLOOR_GPS, LOAD, { nhsGpConsent: true })!.ref, 'GP-002');
});

test('matching is deterministic when two GPs carry the same load', () => {
  const even = [{ ref: 'GP-001', consults: 5 }, { ref: 'GP-002', consults: 5 }];
  assert.equal(matchGp(FLOOR_GPS, even, { nhsGpConsent: true })!.ref, 'GP-001');
});

test('matching returns nothing when no GP is eligible', () => {
  const none = FLOOR_GPS.map((gp) => ({ ...gp, online: false }));
  assert.equal(matchGp(none, LOAD, { nhsGpConsent: true }), null);
});

test('a matched GP carries the refused-consent limit through to the patient', () => {
  assert.equal(matchGp(FLOOR_GPS, LOAD, { nhsGpConsent: false })!.limitedPrescribing, true);
  assert.equal(matchGp(FLOOR_GPS, LOAD, { nhsGpConsent: true })!.limitedPrescribing, false);
});

// A consultation is not a prescription. Different complaints end differently,
// and the surface must never imply that paying the fee buys a medicine.
test('the outcome differs by complaint, so no path guarantees a prescription', () => {
  const at = (complaint: keyof typeof COMPLAINTS) => outcomeFor({ complaint, nhsGpConsent: true });
  assert.equal(at('sore-throat').prescription, true);
  assert.equal(at('stomach').prescription, false);
  assert.equal(at('stomach').referral, true);
  assert.equal(at('skin').prescription, false);
  assert.equal(at('other').fitNote, true);
});

test('refusing to share the NHS record costs the prescription, not just a warning', () => {
  const outcome = outcomeFor({ complaint: 'sore-throat', nhsGpConsent: false });
  assert.equal(outcome.prescription, false);
  assert.equal(outcome.referral, true);
  assert.equal(outcome.sharedWithNhsGp, false);
});

test('a call under two minutes counts as ended early', () => {
  assert.equal(endedEarly(0), true);
  assert.equal(endedEarly(119), true);
  assert.equal(endedEarly(120), false);
});

test('the clock reads mm:ss and never goes negative', () => {
  assert.equal(formatClock(0), '00:00');
  assert.equal(formatClock(9), '00:09');
  assert.equal(formatClock(605), '10:05');
  assert.equal(formatClock(-4), '00:00');
});

test('the next reference follows the highest one already on file', () => {
  assert.equal(nextConsultationId([{ id: 'C-0031' }, { id: 'C-0009' }]), 'C-0032');
  assert.equal(nextConsultationId([]), 'C-0001');
});

test('a completed consultation records the same shape as an old one', () => {
  const record = consultationRecord({
    complaint: 'sore-throat', nhsGpConsent: true, gp: { ref: 'GP-002' }, seconds: 545,
  }, { id: 'C-0032', date: '28 August 2026', fee: 39 });
  assert.equal(record.status, 'completed');
  assert.equal(record.gp, 'GP-002');
  assert.equal(record.minutes, 9);
  assert.equal(record.cost, 39);
  assert.equal(record.reason, 'Sore throat or cough');
  assert.equal(record.outcome!.prescription, true);
});

test('a cancelled consultation costs nothing and names no GP', () => {
  const record = consultationRecord({
    complaint: 'skin', status: 'cancelled', gp: { ref: 'GP-002' }, seconds: 0,
  }, { id: 'C-0032', date: '28 August 2026', fee: 39 });
  assert.equal(record.status, 'cancelled');
  assert.equal(record.cost, 0);
  assert.equal(record.gp, null);
  assert.equal(record.outcome, null);
});

test('a consultation shorter than a minute still records a minute, never zero', () => {
  const record = consultationRecord({
    complaint: 'skin', nhsGpConsent: true, gp: { ref: 'GP-001' }, seconds: 20,
  }, { id: 'C-0032', date: '28 August 2026', fee: 39 });
  assert.equal(record.minutes, 1, 'a completed consultation must not look cancelled');
});
