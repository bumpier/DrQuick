import { describe, expect, test } from 'vitest';
import {
  COMMISSION_TIERS, gpSharePercent, nextTier, platformSharePercent, splitPrice, tierFor,
} from '@/lib/finance/commission';

describe('the commission tiers', () => {
  test('are 60/40, then 70/30 at 100, then 75/25 at 500, and that is the top', () => {
    expect(COMMISSION_TIERS.map((t) => [t.from, gpSharePercent(t), platformSharePercent(t)])).toEqual([
      [0, 60, 40],
      [100, 70, 30],
      [500, 75, 25],
    ]);
  });

  test('a tier is held from its threshold, not one consultation later', () => {
    expect(gpSharePercent(tierFor(0))).toBe(60);
    expect(gpSharePercent(tierFor(99))).toBe(60);
    expect(gpSharePercent(tierFor(100))).toBe(70);
    expect(gpSharePercent(tierFor(499))).toBe(70);
    expect(gpSharePercent(tierFor(500))).toBe(75);
    expect(gpSharePercent(tierFor(1_000_000))).toBe(75);
  });

  test('a count that is negative, fractional or not a number is read safely', () => {
    expect(gpSharePercent(tierFor(-5))).toBe(60);
    expect(gpSharePercent(tierFor(99.9))).toBe(60);
    expect(gpSharePercent(tierFor(Number.NaN))).toBe(60);
  });

  test('the next tier counts down to its threshold and stops at the top', () => {
    expect(nextTier(0)).toEqual({ tier: COMMISSION_TIERS[1], remaining: 100 });
    expect(nextTier(63)).toEqual({ tier: COMMISSION_TIERS[1], remaining: 37 });
    expect(nextTier(100)).toEqual({ tier: COMMISSION_TIERS[2], remaining: 400 });
    expect(nextTier(499)).toEqual({ tier: COMMISSION_TIERS[2], remaining: 1 });
    expect(nextTier(500)).toBeNull();
  });
});

describe('splitting a consultation price', () => {
  // servedBefore is the count before this consultation, so the 100th
  // consultation (99 before it) is the last at 60% and the 101st the first at 70%.
  test('the 100th consultation pays 60%, the 101st 70%, the 501st 75%', () => {
    expect(splitPrice(4000, 99)).toEqual({ gpFeePence: 2400, platformFeePence: 1600 });
    expect(splitPrice(4000, 100)).toEqual({ gpFeePence: 2800, platformFeePence: 1200 });
    expect(splitPrice(4000, 499)).toEqual({ gpFeePence: 2800, platformFeePence: 1200 });
    expect(splitPrice(4000, 500)).toEqual({ gpFeePence: 3000, platformFeePence: 1000 });
  });

  test('the two parts always add up to the price, to the penny', () => {
    for (const price of [1, 33, 3201, 3999, 4801, 12345]) {
      for (const served of [0, 100, 500]) {
        const { gpFeePence, platformFeePence } = splitPrice(price, served);
        expect(gpFeePence + platformFeePence).toBe(price);
        expect(Number.isInteger(gpFeePence)).toBe(true);
      }
    }
    // 75% of 33p is 24.75p: the GP's part rounds to 25p and Dr Quick takes 8p.
    expect(splitPrice(33, 500)).toEqual({ gpFeePence: 25, platformFeePence: 8 });
  });

  test('a nonsense price never produces a negative fee', () => {
    expect(splitPrice(-100, 0)).toEqual({ gpFeePence: 0, platformFeePence: 0 });
  });
});
