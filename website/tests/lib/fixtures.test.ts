import { test } from 'vitest';
import assert from 'node:assert/strict';
import * as F from '@/lib/fixtures';

test('fixtures use synthetic GP references, never names', () => {
  for (const gp of F.GPS) {
    assert.match(gp.ref, /^GP-\d{3}$/, `GP reference is not synthetic: ${gp.ref}`);
    assert.ok(!('name' in gp), 'fixtures must not carry GP names');
  }
});

test('the price fixture names no figure, and discloses the pharmacy charge', () => {
  // Pricing is dynamic: a patient's price is quoted per booking, so a flat
  // amount here would be a claim the platform can no longer make.
  assert.ok(!('amount' in F.PRICE), 'PRICE must not carry a fixed amount');
  assert.doesNotMatch(F.PRICE.note, /£\d/, 'the price note must not name a figure');
  assert.match(F.PRICE.note, /before you book/i);
  assert.match(F.PRICE.note, /pharmacy/i);
});

test('every GP credential carries a status the admin surface can render', () => {
  const allowed = new Set(['valid', 'expiring', 'expired', 'pending']);
  for (const gp of F.GPS) {
    for (const [key, credential] of Object.entries(gp.credentials)) {
      assert.ok(allowed.has(credential.status), `${gp.ref}.${key} has status ${credential.status}`);
    }
  }
});

test('at least one GP has expired indemnity, so the blocking state is reachable', () => {
  assert.ok(
    F.GPS.some((gp) => gp.credentials.indemnity.status === 'expired'),
    'no GP has expired indemnity — the doctor blocking state cannot be demonstrated',
  );
});

test('the queue fixture is 45-second aligned so the position actually advances', () => {
  assert.equal(
    F.QUEUE.etaSeconds,
    F.QUEUE.position * 45,
    'tickQueue advances only on exact multiples of 45; an unaligned seed pins the '
      + 'patient at their starting position while the wait counts down to zero',
  );
});

test('prescribing fixtures reconcile with the consult total and the register', () => {
  const consults = F.PRESCRIBING.reduce((sum, gp) => sum + gp.consults, 0);
  assert.equal(consults, F.BUSINESS.consults,
    'per-GP consults must sum to the business consult total, or the two screens contradict each other');
  const flagged = F.PRESCRIBING.reduce((sum, gp) => sum + gp.restrictedFlagged, 0);
  const breaches = F.GOVERNANCE.restrictedRegister.reduce((sum, row) => sum + row.breaches, 0);
  assert.equal(flagged, breaches,
    'per-GP flags must sum to the register breach total, or governance contradicts itself');
});

test('prescribing fixtures reference GPs synthetically', () => {
  for (const gp of F.PRESCRIBING) {
    assert.match(gp.ref, /^GP-\d{3}$/);
  }
});

test('business fixtures pair each headline number with its plan assumption', () => {
  assert.ok(Number.isFinite(F.BUSINESS.cac.actual));
  assert.ok(Number.isFinite(F.BUSINESS.cac.assumption));
  assert.ok(Number.isFinite(F.BUSINESS.repeatRate.actual));
  assert.ok(Number.isFinite(F.BUSINESS.repeatRate.assumption));
});

test('figures that appear twice are derived once', () => {
  assert.equal(F.DOCTOR.shift.patientsWaiting, F.FLOOR.waiting);
  assert.equal(F.DOCTOR.shift.gpsOnline, F.FLOOR.gpsOnline);
  assert.equal(F.DOCTOR.shift.gpsNeeded, F.FLOOR.gpsNeeded);
  assert.equal(F.DOCTOR.consultsCompleted, F.PRESCRIBING.find((gp) => gp.ref === F.DOCTOR.ref)!.consults);
  assert.equal(F.DOCTOR.shift.earningsToday, F.DOCTOR_DASHBOARD.dailyConsults.at(-1)!.earnings);
  assert.equal(F.PAYOUT_RUNS[0].gps, 3);
  assert.equal(F.PAYOUT_RUNS[0].status, 'Due');
  assert.equal(F.DASH, '—');
  assert.equal(F.DOCTOR.daysToRevalidation, F.MY_RECORD.revalidation.daysRemaining);
  assert.equal(F.DOCTOR.credentialsTotal, 7);
  assert.equal(F.GOVERNANCE.breakGlass, F.BREAK_GLASS_LOG.length);
  assert.equal(F.PAYOUT_RUNS[0].amount, F.BUSINESS.revenue);
});

/* The point of the whole change: money is no longer a consultation count times
   a rate. These guard the model, not the numbers. */
test('money is summed from what each consultation paid, never multiplied out', () => {
  assert.ok(!('FEE' in F), 'a flat FEE would reintroduce the fixed-price model');

  const days = F.DOCTOR_DASHBOARD.dailyConsults;
  const perDay = days.filter((d) => d.consults > 0).map((d) => d.earnings / d.consults);
  assert.ok(new Set(perDay).size > 1,
    'every day pays the same rate per consultation — this is a flat fee wearing a sum');

  // The recent rows are today's and yesterday's, and they must reconcile with
  // the days they belong to, or the dashboard contradicts its own chart.
  const recent = F.DOCTOR_DASHBOARD.recent;
  const fee = (rows: typeof recent) => rows.reduce((n, r) => n + r.fee, 0);
  assert.equal(fee(recent.filter((r) => r.when.startsWith('Today'))), days.at(-1)!.earnings);
  assert.equal(fee(recent.filter((r) => r.when.startsWith('Yesterday'))), days.at(-2)!.earnings);
});

// Ratings arrived on 2026-10-01 (the user's decision, reversing "no ratings").
// What a fixture may hold is still bounded: a round, plainly synthetic average
// and count on a GP, and none for a GP who could not have consulted.
test('a fixture rating is round and synthetic, and a GP who cannot consult has none', () => {
  for (const gp of F.GPS) {
    const cleared = Object.values(gp.credentials).every((c) => c.status !== 'pending');
    if (!cleared) { assert.equal(gp.rating, null, `${gp.ref} has never consulted`); continue; }
    assert.ok(gp.rating, `${gp.ref} has a rating`);
    assert.ok(gp.rating.average >= 1 && gp.rating.average <= 5);
    assert.equal(gp.rating.average, Math.round(gp.rating.average * 10) / 10, 'one decimal place');
    assert.equal(gp.rating.count % 10, 0, 'a round count');
  }
});

test('nothing in the fixtures but a GP carries a rating', () => {
  const { GPS: _gps, ...rest } = F;
  assert.ok(!JSON.stringify(rest).toLowerCase().includes('rating'));
});

test('the gate records are reachable and each carries the status its gate needs', () => {
  assert.equal(F.GATE_RECORDS['indemnity-expired'].indemnity.status, 'expired');
  assert.equal(F.GATE_RECORDS['verification-rejected'].dbs.status, 'rejected');
  assert.equal(F.GATE_RECORDS['verification-pending'].gmc.status, 'pending');
  assert.equal(F.GATE_RECORDS['revalidation-due'].revalidation.daysRemaining, F.DOCTOR.revalidationDueInDays);
});

test('applications in verification are the GPs with a pending credential', () => {
  assert.deepEqual(F.applicationsInVerification(), [{ ref: 'GP-004', stage: 'GMC registration' }]);
});

test('skills carry the six clinical areas with the preview defaults', () => {
  assert.deepEqual(F.SKILLS.map((s) => [s.label, s.defaultOn]), [
    ['General adult medicine', true], ['Minor illness', true], ["Women's health", false],
    ['Mental health', false], ['Paediatrics (age 5+)', false], ['Dermatology', false],
  ]);
});

test('every break-glass row carries a reason', () => {
  for (const row of F.BREAK_GLASS_LOG) assert.ok(row.reason.length > 0);
});
