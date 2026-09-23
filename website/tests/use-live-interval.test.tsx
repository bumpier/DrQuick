// @vitest-environment jsdom
import { test, expect, beforeEach, vi } from 'vitest';
import { StrictMode } from 'react';
import { render, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
vi.mock('next/navigation', () => import('./helpers/next-navigation'));
import { installDomStubs, setDocumentHidden } from './helpers/dom-stubs';
import { useLiveInterval } from '@/hooks/use-live-interval';

const T0 = Date.parse('2026-08-28T14:00:00Z');
const tick = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

function Harness({ fn, ms = 1000, active = true }: { fn: (now: number) => void; ms?: number; active?: boolean }) {
  useLiveInterval(fn, ms, active);
  return null;
}

beforeEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  installDomStubs();
  // Vitest fakes Date with the timers, so every tick sees the advanced clock;
  // setSystemTime must come after useFakeTimers.
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

test('ticks once a second with the wall clock and clears on unmount', () => {
  const fn = vi.fn();
  const { unmount } = render(<Harness fn={fn} />);
  expect(fn).not.toHaveBeenCalled();
  tick(3_000);
  expect(fn).toHaveBeenCalledTimes(3);
  expect(fn).toHaveBeenLastCalledWith(T0 + 3_000);
  unmount();
  tick(5_000);
  expect(fn).toHaveBeenCalledTimes(3);
});

test('stops while the tab is hidden and catches up the moment it returns', () => {
  const fn = vi.fn();
  render(<Harness fn={fn} />);
  tick(3_000);
  act(() => setDocumentHidden(true));
  tick(5_000);
  expect(fn).toHaveBeenCalledTimes(3);
  act(() => setDocumentHidden(false));
  expect(fn).toHaveBeenCalledTimes(4);
  expect(fn).toHaveBeenLastCalledWith(T0 + 8_000);   // the paused seconds are in the timestamp
  tick(1_000);
  expect(fn).toHaveBeenCalledTimes(5);
  expect(fn).toHaveBeenLastCalledWith(T0 + 9_000);
});

test('mounted in a hidden tab, it waits for the tab', () => {
  const fn = vi.fn();
  setDocumentHidden(true);
  render(<Harness fn={fn} />);
  tick(3_000);
  expect(fn).not.toHaveBeenCalled();
  act(() => setDocumentHidden(false));
  expect(fn).toHaveBeenCalledTimes(1);
  tick(1_000);
  expect(fn).toHaveBeenCalledTimes(2);
});

test('a new closure never restarts the interval; only ms or active do', () => {
  const first = vi.fn();
  const second = vi.fn();
  const { rerender } = render(<Harness fn={first} />);
  tick(500);
  rerender(<Harness fn={second} />);
  tick(500);
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);    // the tick due at 1000ms, not a fresh one at 1500ms
  rerender(<Harness fn={second} ms={500} />);
  tick(500);
  expect(second).toHaveBeenCalledTimes(2);
});

test('inactive schedules nothing; flipping active starts and stops it', () => {
  const fn = vi.fn();
  const { rerender } = render(<Harness fn={fn} active={false} />);
  tick(3_000);
  expect(fn).not.toHaveBeenCalled();
  rerender(<Harness fn={fn} active />);
  tick(2_000);
  expect(fn).toHaveBeenCalledTimes(2);
  rerender(<Harness fn={fn} active={false} />);
  tick(2_000);
  expect(fn).toHaveBeenCalledTimes(2);
});

test('a dev double-mount (StrictMode) runs one interval, not two', () => {
  const fn = vi.fn();
  render(<StrictMode><Harness fn={fn} /></StrictMode>);
  tick(3_000);
  expect(fn).toHaveBeenCalledTimes(3);
});

test('the 1000ms dashboard interval still runs under reduced motion', () => {
  installDomStubs({ reducedMotion: true });
  const fn = vi.fn();
  render(<Harness fn={fn} />);
  tick(2_000);
  expect(fn).toHaveBeenCalledTimes(2);
});
