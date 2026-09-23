// @vitest-environment jsdom
import { test, expect, beforeEach, vi } from 'vitest';
import { useState } from 'react';
import { render, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
vi.mock('next/navigation', () => import('./helpers/next-navigation'));
import { installDomStubs } from './helpers/dom-stubs';
import { useLiveInterval } from '@/hooks/use-live-interval';
import { Countdown } from '@/components/app/Countdown';

const region = (c: HTMLElement) => c.querySelector('[aria-live="assertive"]')!;
const numerals = (c: HTMLElement) => c.querySelector('[data-slot="countdown-value"]')!;
const bar = (c: HTMLElement) => c.querySelector('[role="progressbar"]')!;

beforeEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  installDomStubs();
});

test('on arrival it announces the window once and hides the numerals from assistive technology', () => {
  const { container } = render(<Countdown remaining={45} total={45} />);
  expect(region(container)).toHaveTextContent('45 seconds to accept');
  expect(region(container)).toHaveAttribute('aria-atomic', 'true');
  expect(region(container)).toHaveClass('sr-only');
  expect(container.querySelectorAll('[aria-live]')).toHaveLength(1);
  expect(numerals(container)).toHaveTextContent('45s');
  expect(numerals(container)).toHaveAttribute('aria-hidden', 'true');
  expect(numerals(container)).toHaveClass('font-display', 'text-4xl', 'tabular-nums');
  expect(bar(container)).toHaveAttribute('aria-label', 'Time left to accept');
  expect(bar(container)).toHaveAttribute('aria-valuenow', '100');
  expect(bar(container)).toHaveAttribute('aria-valuetext', '45 seconds left');
});

test('announces at 30, 15 and 5 and is silent in between', () => {
  const { container, rerender } = render(<Countdown remaining={45} total={45} />);
  const at = (remaining: number) => {
    rerender(<Countdown remaining={remaining} total={45} />);
    return region(container).textContent;
  };
  expect(at(44)).toBe('');
  expect(at(31)).toBe('');
  expect(at(30)).toBe('30 seconds left to accept');
  expect(at(29)).toBe('');
  expect(at(15)).toBe('15 seconds left to accept');
  expect(at(14)).toBe('');
  expect(at(5)).toBe('5 seconds left to accept');
  expect(at(4)).toBe('');
  expect(at(0)).toBe('');
});

test('mounted mid-window it says nothing until the next milestone', () => {
  const { container, rerender } = render(<Countdown remaining={31} total={45} />);
  expect(region(container)).toBeEmptyDOMElement();
  rerender(<Countdown remaining={30} total={45} />);
  expect(region(container)).toHaveTextContent('30 seconds left to accept');
  rerender(<Countdown remaining={29} total={45} />);
  expect(region(container)).toBeEmptyDOMElement();
});

test('error reaches the numerals at five seconds and never the bar', () => {
  const { container, rerender } = render(<Countdown remaining={6} total={45} />);
  expect(numerals(container)).not.toHaveClass('text-error');
  rerender(<Countdown remaining={5} total={45} />);
  expect(numerals(container)).toHaveClass('text-error');
  rerender(<Countdown remaining={0} total={45} />);
  expect(numerals(container)).toHaveClass('text-error');
  expect(numerals(container)).toHaveTextContent('0s');
  expect(bar(container).className).not.toMatch(/error/);
  expect(container.querySelector('[data-slot="progress-indicator"]')!.className).not.toMatch(/error/);
});

test('the bar drains linearly over each second and reports the seconds on demand', () => {
  const { container, rerender } = render(<Countdown remaining={45} total={45} />);
  expect(bar(container)).toHaveClass(
    '[&_[data-slot=progress-indicator]]:duration-1000',
    '[&_[data-slot=progress-indicator]]:ease-linear',
  );
  for (const [remaining, percent] of [[30, '67'], [15, '33'], [5, '11'], [0, '0']] as const) {
    rerender(<Countdown remaining={remaining} total={45} />);
    expect(bar(container)).toHaveAttribute('aria-valuenow', percent);
    expect(bar(container)).toHaveAttribute('aria-valuetext', `${remaining} seconds left`);
  }
});

// The wiring SessionProvider uses (Task 13): an expiry timestamp, one live
// interval, `remaining` derived on every tick — never counted down.
function Offer({ start, total }: { start: number; total: number }) {
  const [now, setNow] = useState(start);
  useLiveInterval(setNow, 1000);
  return <Countdown remaining={Math.max(0, Math.ceil((start + total * 1000 - now) / 1000))} total={total} />;
}

test('the progressbar reports its value to assistive technology, not indeterminate, and updates on a tick', () => {
  vi.useFakeTimers();
  const T0 = Date.parse('2026-08-28T14:00:00Z');
  vi.setSystemTime(T0);
  const { container } = render(<Offer start={T0} total={45} />);
  act(() => { vi.advanceTimersByTime(1_000); });   // remaining: 44
  expect(bar(container)).toHaveAttribute('data-state', 'loading');
  expect(bar(container)).toHaveAttribute('aria-valuenow', '98');
  act(() => { vi.advanceTimersByTime(14_000); });  // remaining: 30, one tick later
  expect(bar(container)).toHaveAttribute('data-state', 'loading');
  expect(bar(container)).toHaveAttribute('aria-valuenow', '67');
});

test('driven from a timestamp by useLiveInterval it speaks exactly four times in 45 seconds', () => {
  vi.useFakeTimers();
  const T0 = Date.parse('2026-08-28T14:00:00Z');
  vi.setSystemTime(T0);
  const { container } = render(<Offer start={T0} total={45} />);
  const spoken = [region(container).textContent];
  for (let second = 1; second <= 45; second += 1) {
    act(() => { vi.advanceTimersByTime(1_000); });
    const text = region(container).textContent;
    if (text) spoken.push(text);
  }
  expect(spoken).toEqual([
    '45 seconds to accept', '30 seconds left to accept', '15 seconds left to accept', '5 seconds left to accept',
  ]);
  expect(numerals(container)).toHaveTextContent('0s');
  expect(bar(container)).toHaveAttribute('aria-valuenow', '0');
});
