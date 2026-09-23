import { test } from 'vitest';
import assert from 'node:assert/strict';
import { earningsFor } from '@/lib/earnings';
import { OFFER } from '@/lib/fixtures';

// The pay a GP accepted this consultation for. Read from OFFER rather than
// typed, because under dynamic pricing there is no flat rate to assume.
const FEE = OFFER.fee;
const record = { id: 'C-0032', when: 'Today, 15:02', ageBand: '30–39', minutes: 9, outcome: 'Recorded in Semble', fee: FEE, isNew: true as const };

test('seeded figures are the preview arithmetic, with consults to date from PRESCRIBING', () => {
  const e = earningsFor({ seeded: true, session: [] });
  assert.deepEqual([e.fortnightConsults, e.weekConsults, e.todayConsults, e.toDateConsults], [23, 12, 3, 40]);
  // Sums of what each day actually paid — not a count times a rate.
  assert.deepEqual([e.fortnight, e.payoutAmount, e.today, e.toDate], [677, 373, 102, 1186]);
  assert.deepEqual(e.busiest, { label: '18', consults: 3, earnings: 88 });   // the first maximum wins
  assert.equal(e.recent.length, 5);
  assert.equal(e.dailySeries.filter((d) => d.emph === 'true').length, 1);
  assert.equal(Math.round((e.weekConsults / e.fortnightConsults) * 100), 52);   // the payout meter
});

test('blank mode plus one session record shows only what happened', () => {
  const e = earningsFor({ seeded: false, session: [record] });
  assert.deepEqual([e.today, e.week, e.fortnight, e.toDate], [FEE, FEE, FEE, FEE]);
  assert.deepEqual(e.busiest, { label: '28', consults: 1, earnings: FEE });
  assert.deepEqual(e.recent, [record]);
});

test('blank mode has nothing, and nothing is the only figure it has', () => {
  const e = earningsFor({ seeded: false, session: [] });
  assert.deepEqual([e.fortnight, e.week, e.today, e.toDate], [0, 0, 0, 0]);
  assert.equal(e.busiest, null);
  assert.deepEqual(e.recent, []);
  assert.ok(e.dailySeries.every((d) => d.value === 0));
});

test('one completed consultation moves every figure by exactly one fee, in both modes', () => {
  for (const seeded of [true, false]) {
    const before = earningsFor({ seeded, session: [] });
    const after = earningsFor({ seeded, session: [record] });
    assert.equal(after.today - before.today, FEE);
    assert.equal(after.week - before.week, FEE);
    assert.equal(after.fortnight - before.fortnight, FEE);
    assert.equal(after.toDate - before.toDate, FEE);
    assert.equal(after.recent[0], record);
    assert.equal(after.dailySeries.at(-1)!.value, before.dailySeries.at(-1)!.value + 1);
  }
});
