import { test } from 'vitest';
import assert from 'node:assert/strict';
import { formatEta, tickCountdown, tickQueue, startInterval } from '@/lib/live';

test('formatEta reads naturally under a minute', () => {
  assert.equal(formatEta(0), 'under a minute');
  assert.equal(formatEta(59), 'under a minute');
});

test('formatEta rounds up to whole minutes', () => {
  assert.equal(formatEta(60), 'about 1 minute');
  assert.equal(formatEta(61), 'about 2 minutes');
  assert.equal(formatEta(300), 'about 5 minutes');
});

test('tickCountdown decrements and floors at zero', () => {
  assert.deepEqual(tickCountdown({ remaining: 45 }), { remaining: 44, expired: false });
  assert.deepEqual(tickCountdown({ remaining: 1 }), { remaining: 0, expired: true });
  assert.deepEqual(tickCountdown({ remaining: 0 }), { remaining: 0, expired: true });
});

test('tickQueue advances position only when eta crosses a 45s boundary', () => {
  assert.deepEqual(tickQueue({ position: 3, etaSeconds: 100 }), { position: 3, etaSeconds: 99 });
  assert.deepEqual(tickQueue({ position: 3, etaSeconds: 91 }), { position: 2, etaSeconds: 90 });
  assert.deepEqual(tickQueue({ position: 3, etaSeconds: 46 }), { position: 2, etaSeconds: 45 });
});

test('tickQueue never drops below position 1 or a zero eta', () => {
  assert.deepEqual(tickQueue({ position: 1, etaSeconds: 46 }), { position: 1, etaSeconds: 45 });
  assert.deepEqual(tickQueue({ position: 1, etaSeconds: 0 }), { position: 1, etaSeconds: 0 });
});

// Zero is a multiple of 45, so without an explicit guard the queue would
// advance one last time as the wait hits zero. Position 1 hides this behind
// the floor, so this case must use a higher position.
test('tickQueue does not advance position when the wait reaches zero', () => {
  assert.deepEqual(tickQueue({ position: 3, etaSeconds: 1 }), { position: 3, etaSeconds: 0 });
});

// New: the only timer wrapper the surfaces use had no test.
test('startInterval returns a stop that clears the interval', () => {
  const calls: number[] = [];
  const win = {
    setInterval: (fn: () => void, ms: number) => { calls.push(ms); return 7; },
    clearInterval: (id: number) => { calls.push(-id); },
  } as unknown as typeof globalThis;
  const stop = startInterval(() => {}, 1000, win);
  stop();
  assert.deepEqual(calls, [1000, -7]);
});

test('startInterval runs a sub-second interval once under reduced motion', () => {
  let ran = 0;
  const win = {
    matchMedia: () => ({ matches: true }),
    setInterval: () => { throw new Error('must not schedule'); },
  } as unknown as typeof globalThis;
  const stop = startInterval(() => { ran += 1; }, 500, win);
  assert.equal(ran, 1);
  stop();
});
