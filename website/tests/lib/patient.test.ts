import { test } from 'vitest';
import assert from 'node:assert/strict';
import { consultationRecord } from '@/lib/booking';
import { CONSULTATIONS, PATIENT_ACCOUNT, PRESCRIPTIONS } from '@/lib/fixtures';
import {
  NOTHING_YET, addPrescription, addToHistory, consultationIdFromPath, currentStep, historyFor, isCollected,
  prescriptionFor, prescriptionsFor, todosFor, type ConsultationRow,
} from '@/lib/patient';

const completed = (id: string, extra: Partial<Parameters<typeof consultationRecord>[0]> = {}) =>
  consultationRecord(
    { complaint: 'sore-throat', nhsGpConsent: true, gp: { ref: 'GP-002' }, seconds: 545, ...extra },
    { id, date: '28 August 2026', fee: 40 },
  );

test('blank mode holds only what this session produced; seeded adds the fixtures after it', () => {
  const session = [completed('C-0032')];
  assert.deepEqual(historyFor({ seeded: false, session: [] }), []);
  assert.deepEqual(historyFor({ seeded: false, session }).map((r) => r.id), ['C-0032']);
  assert.deepEqual(historyFor({ seeded: true, session }).map((r) => r.id), ['C-0032', ...CONSULTATIONS.map((r) => r.id)]);
});

test('a new record goes first and is the only one marked new', () => {
  const first = addToHistory([], completed('C-0001'));
  const second = addToHistory(first, completed('C-0002'));
  assert.deepEqual(second.map((r) => [r.id, r.isNew ?? false]), [['C-0002', true], ['C-0001', false]]);
});

test('a record already on the list is not written twice', () => {
  const once = addToHistory([], completed('C-0001'));
  assert.equal(addToHistory(once, completed('C-0001')), once);
});

test('a prescription outcome leaves a prescription behind, sent when a pharmacy is on file', () => {
  const rx = prescriptionFor(completed('C-0032'), PATIENT_ACCOUNT.pharmacy)!;
  assert.equal(rx.id, 'RX-0032');
  assert.equal(rx.consultation, 'C-0032');
  assert.equal(rx.pharmacy, 'Example Pharmacy, London N1');
  assert.deepEqual(rx.steps.map((s) => [s.label, s.done, s.now ?? false]), [
    ['Written by your GP', true, false],
    ['Sent to your pharmacy', true, false],
    ['Ready to collect', false, true],
    ['Collected', false, false],
  ]);
});

// The flow does not nominate a pharmacy yet, so a first patient's prescription
// is written and waiting to be sent: the timeline says so rather than inventing one.
test('with no pharmacy saved the prescription waits to be sent', () => {
  const rx = prescriptionFor(completed('C-0001'), null)!;
  assert.equal(rx.pharmacy, null);
  assert.equal(currentStep(rx)?.label, 'Sent to your pharmacy');
  assert.equal(currentStep(rx)?.when, 'No pharmacy saved yet');
});

test('no prescription for a referral, a cancellation, or a consultation without the NHS record', () => {
  assert.equal(prescriptionFor(completed('C-0001', { complaint: 'stomach' }), 'x'), null);
  assert.equal(prescriptionFor(completed('C-0001', { nhsGpConsent: false }), 'x'), null);
  const cancelled = consultationRecord({ complaint: 'skin', status: 'cancelled', seconds: 0 }, { id: 'C-0001', date: 'd', fee: 0 });
  assert.equal(prescriptionFor(cancelled, 'x'), null);
});

test('prescriptions list this session’s first, then the fixtures when seeded, never twice', () => {
  const rx = prescriptionFor(completed('C-0032'), 'x')!;
  assert.deepEqual(prescriptionsFor({ seeded: false, session: [] }), []);
  assert.deepEqual(prescriptionsFor({ seeded: true, session: [rx] }).map((r) => r.id), ['RX-0032', 'RX-0031', 'RX-0014']);
  const once = addPrescription([], rx);
  assert.equal(addPrescription(once, rx), once);
});

test('the step a fixture prescription is on, and whether it is collected', () => {
  const [open, done] = PRESCRIPTIONS;
  assert.equal(currentStep(open)?.label, 'Ready to collect');
  assert.equal(isCollected(open), false);
  assert.equal(currentStep(done), null);
  assert.equal(isCollected(done), true);
});

test('the seeded account’s to-dos come from its records, in order of what to do first', () => {
  const todos = todosFor({ history: CONSULTATIONS, prescriptions: PRESCRIPTIONS, practice: PATIENT_ACCOUNT.nhsPractice });
  assert.deepEqual(todos.map((t) => t.id), ['prescription', 'unshared', 'practice']);
  assert.deepEqual(todos.map((t) => t.action.href), ['/patient/prescriptions', '/patient/consultations', '/patient/account']);
  assert.match(todos[0].note, /pharmacy charges for the medicine/);
});

test('a first patient with nothing on file has nothing to do', () => {
  assert.deepEqual(todosFor({ history: [], prescriptions: [], practice: null }), []);
});

test('a prescription with nowhere to go says it is waiting to be sent', () => {
  const rx = prescriptionFor(completed('C-0001'), null)!;
  const [todo] = todosFor({ history: [completed('C-0001')], prescriptions: [rx], practice: null });
  assert.equal(todo.title, 'A prescription is waiting to be sent');
});

test('a consultation that was not shared asks to be reviewed; a cancelled one never does', () => {
  const unshared = completed('C-0001', { nhsGpConsent: false });
  const cancelled: ConsultationRow = { ...completed('C-0002'), status: 'cancelled', outcome: null };
  assert.deepEqual(todosFor({ history: [unshared], prescriptions: [], practice: null }).map((t) => t.id), ['unshared']);
  assert.deepEqual(todosFor({ history: [cancelled], prescriptions: [], practice: null }), []);
});

test('a detail URL yields the id it names and nothing else', () => {
  assert.equal(consultationIdFromPath('/patient/consultations/C-0031'), 'C-0031');
  assert.equal(consultationIdFromPath('/patient/consultations/C-0031/'), 'C-0031');
  assert.equal(consultationIdFromPath('/patient/consultations'), null);
  assert.equal(consultationIdFromPath('/patient/consultations/'), null);
  assert.equal(consultationIdFromPath('/patient/consultations/a/b'), null);
  assert.equal(consultationIdFromPath('/patient'), null);
});

test('the empty-state sentence invents nothing', () => {
  assert.equal(NOTHING_YET, 'Nothing here yet. Start a consultation and this screen fills with what actually happened.');
});
