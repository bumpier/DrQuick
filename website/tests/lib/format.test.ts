import { test } from 'vitest';
import assert from 'node:assert/strict';
import { money, minutesLabel, daysLabel, percent, ordinal } from '@/lib/format';

test('money formats pounds with a thousands separator', () => {
  assert.equal(money(1248), '£1,248');
  assert.equal(money(39), '£39');
});

test('minutesLabel and daysLabel read as short units', () => {
  assert.equal(minutesLabel(42), '42m');
  assert.equal(daysLabel(9), '9 days');
});

test('percent rounds a ratio to a whole percentage', () => {
  assert.equal(percent(0.86), '86%');
});

test('a place in the queue reads as an ordinal, teens included', () => {
  const cases: Array<[number, string]> = [
    [1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'], [11, '11th'], [12, '12th'], [13, '13th'],
    [21, '21st'], [22, '22nd'], [23, '23rd'], [101, '101st'], [111, '111th'], [112, '112th'],
  ];
  for (const [n, expected] of cases) assert.equal(ordinal(n), expected);
});
