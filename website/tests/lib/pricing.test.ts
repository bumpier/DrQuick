import { test } from 'vitest';
import assert from 'node:assert/strict';
import { BASE_PRICE, EMPTY_FLOOR, PRICE_CAP, PRICE_STEP, floorFor, quoteFor } from '@/lib/pricing';
import { waitEstimate } from '@/lib/booking';
import { FLOOR } from '@/lib/fixtures';

test('an empty floor is quoted the business plan’s base price', () => {
  assert.equal(BASE_PRICE, 32);
  assert.equal(quoteFor(EMPTY_FLOOR), BASE_PRICE);
});

test('each place in the queue beyond the first adds one step', () => {
  assert.equal(waitEstimate({ waiting: 1, gpsOnline: 1 }).position, 2);
  assert.equal(quoteFor({ waiting: 1, gpsOnline: 1 }), BASE_PRICE + PRICE_STEP);
});

test('the fixture floor, three places deep, is quoted £40', () => {
  assert.equal(waitEstimate(FLOOR).position, 3);
  assert.equal(quoteFor(FLOOR), 40);
});

test('the quote never falls as the queue grows, is always whole pounds, and stops at the cap', () => {
  let last = 0;
  for (let waiting = 0; waiting <= 40; waiting += 1) {
    const quote = quoteFor({ waiting, gpsOnline: 2 });
    assert.ok(quote >= last, `the quote fell at ${waiting} waiting`);
    assert.ok(quote <= PRICE_CAP, `the quote passed the cap at ${waiting} waiting`);
    assert.ok(Number.isInteger(quote));
    last = quote;
  }
  assert.equal(quoteFor({ waiting: 40, gpsOnline: 1 }), PRICE_CAP);
});

test('more GPs online lowers the quote for the same queue', () => {
  assert.ok(quoteFor({ waiting: 8, gpsOnline: 4 }) < quoteFor({ waiting: 8, gpsOnline: 1 }));
});

// Blank mode is the first patient on a platform that has not launched: the
// queue they join is empty and the quote is the base. Seeded mode is the
// returning patient on the fixture floor the dashboards were designed on.
test('blank mode reads the empty floor and seeded mode the fixture floor', () => {
  assert.deepEqual(floorFor(false), EMPTY_FLOOR);
  assert.equal(floorFor(true), FLOOR);
});
