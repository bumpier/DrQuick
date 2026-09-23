import { test, expect } from 'vitest';
import { staggerDelay, heroDelay, REVEAL_STEP, REVEAL_CAP, HERO_STEP } from '@/lib/reveal';

test('the stagger steps 70ms and caps at 300ms', () => {
  expect(REVEAL_STEP).toBe(70);
  expect(REVEAL_CAP).toBe(300);
  expect(staggerDelay(0)).toBe(0);
  expect(staggerDelay(4)).toBe(280);
  expect(staggerDelay(5)).toBe(300);
  expect(staggerDelay(50)).toBe(300);
});

test('the hero arrives at 90ms per element, uncapped', () => {
  expect(HERO_STEP).toBe(90);
  expect(heroDelay(0)).toBe(0);
  expect(heroDelay(3)).toBe(270);
});
