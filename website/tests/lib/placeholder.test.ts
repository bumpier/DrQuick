import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  DASH, live, shown, seed, setDataMode, dataMode, isSeeded, emptyState, listOr,
} from '@/lib/placeholder';

test('the prototype defaults to placeholder, never to invented figures', () => {
  assert.equal(dataMode(), 'placeholder');
  assert.equal(isSeeded(), false);
});

// "0 consultations" says the service ran and nobody came. A dash says only
// that there is nothing to show. Before launch those are different claims.
test('live() shows a dash for nothing, including zero', () => {
  assert.equal(live(0), DASH);
  assert.equal(live(null), DASH);
  assert.equal(live(undefined), DASH);
  assert.equal(live(''), DASH);
  assert.equal(live(3), '3');
});

test('live() formats a real value through its formatter', () => {
  assert.equal(live(39, (v) => `£${v}`), '£39');
});

// live() is for what this session can genuinely produce — a patient who walks
// the booking flow really does hold a consultation afterwards.
test('live() lets session data through even in placeholder mode', () => {
  assert.equal(dataMode(), 'placeholder');
  assert.equal(live(1), '1');
});

test('shown() withholds a fixture figure until the prototype is seeded', () => {
  assert.equal(shown(1248, (v) => `£${v}`), DASH);
  try {
    setDataMode('seeded');
    assert.equal(shown(1248, (v) => `£${v}`), '£1248');
  } finally {
    setDataMode('placeholder');
  }
});

test('seed() empties a fixture list until seeded, and copies it when it is', () => {
  const source = [{ id: 'a' }];
  assert.deepEqual(seed(source), []);
  try {
    setDataMode('seeded');
    const copy = seed(source);
    assert.deepEqual(copy, source);
    // patient.js unshifts this session's own consultation onto the list, so a
    // shared reference would mutate the fixture and leak between screens.
    assert.notEqual(copy, source);
  } finally {
    setDataMode('placeholder');
  }
});

test('an unknown data mode is refused rather than silently ignored', () => {
  assert.throws(() => setDataMode('demo'), /Unknown data mode: demo/);
  assert.equal(dataMode(), 'placeholder');
});

test('listOr falls back to a written empty state, not a blank box', () => {
  assert.equal(listOr('', 'Nothing yet.'), emptyState('Nothing yet.'));
  assert.equal(listOr('<tr></tr>', 'Nothing yet.'), '<tr></tr>');
  assert.match(emptyState('Nothing yet.'), /class="empty"/);
});
