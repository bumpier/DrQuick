import { test } from 'vitest';
import assert from 'node:assert/strict';
import { money, minutesLabel, daysLabel, percent } from '@/lib/format';

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
