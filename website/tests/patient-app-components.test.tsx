// @vitest-environment jsdom
import { test, expect, describe, beforeEach, vi } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
vi.mock('next/navigation', () => import('./helpers/next-navigation'));
import { renderAt } from './helpers/render-at';
import { Stepper, type Step } from '@/components/app/Stepper';
import { Timeline } from '@/components/app/Timeline';
import { StateJumper } from '@/components/app/StateJumper';
import { PATIENT_JUMPS } from '@/components/app/jumps';
import { DataModeProvider } from '@/lib/data-mode';
import { PRESCRIPTIONS } from '@/lib/fixtures';

beforeEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const BOOKING: Step[] = ['Symptoms', 'Safety', 'Identity', 'NHS GP', 'Price'].map((label, i) => ({
  id: label, label, status: i < 2 ? 'done' : i === 2 ? 'current' : 'todo',
}));

describe('Stepper, as the booking uses it', () => {
  test('the default still names the doctor’s onboarding, so that surface is unchanged', () => {
    const { container } = render(<Stepper steps={BOOKING} />);
    expect(container.querySelector('ol')).toHaveAttribute('aria-label', 'Onboarding steps');
    expect(container.querySelector('ol')).toHaveClass('mb-6');
  });
  test('the booking names its own list and drops the default margin', () => {
    const { container } = render(<Stepper label="Booking steps" className="mb-0" steps={BOOKING} />);
    expect(container.querySelector('ol')).toHaveAttribute('aria-label', 'Booking steps');
    expect(container.querySelector('ol')).toHaveClass('mb-0');
    expect(container.querySelector('ol')).not.toHaveClass('mb-6');
  });
  test('labels="current" shows only the current word at every width; the rest stay in the accessible name', () => {
    const { container } = render(<Stepper label="Booking steps" labels="current" steps={BOOKING} />);
    const words = Array.from(container.querySelectorAll('li > span'));
    expect(words.map((w) => w.classList.contains('sr-only'))).toEqual([true, true, false, true, true]);
    expect(container.querySelector('[aria-current="step"]')).toHaveTextContent('Identity');
    expect(container.querySelector('ol')).toHaveTextContent('Symptoms completed');
  });
});

describe('Timeline', () => {
  test('a prescription reads as the steps it is on, with the current one marked for assistive technology', () => {
    const { container } = render(<Timeline label="RX-0031" steps={PRESCRIPTIONS[0].steps} />);
    const items = Array.from(container.querySelectorAll('li'));
    expect(items.map((li) => li.dataset.step)).toEqual(['done', 'done', 'now', 'todo']);
    expect(container.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
    expect(items[2]).toHaveAttribute('aria-current', 'step');
    expect(items[2]).toHaveTextContent('Ready to collect, current step');
    expect(items[0]).toHaveTextContent('Written by your GP, done');
    expect(items[3]).toHaveTextContent('Collected, not yet');
    expect(container.querySelector('ol')).toHaveAttribute('aria-label', 'RX-0031');
  });
  test('state is told by weight as well as colour, never by a hue alone', () => {
    const { container } = render(<Timeline steps={PRESCRIPTIONS[0].steps} />);
    const labels = Array.from(container.querySelectorAll('li span.block.text-body'));
    expect(labels.map((l) => l.classList.contains('font-semibold'))).toEqual([true, true, true, false]);
  });
});

describe('the state jumper’s patient group', () => {
  test('lists every destination, every booking step and state, and the data modes, as full-load links', async () => {
    const { container } = renderAt(
      <div data-surface="patient"><StateJumper surface="patient" /></div>,
      { pathname: '/patient/book/quote', providers: DataModeProvider },
    );
    const jumper = container.querySelector('nav[aria-label="Prototype navigation"]')!;
    expect(jumper).toBeInTheDocument();
    const hrefs = Array.from(jumper.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    for (const group of PATIENT_JUMPS) for (const item of group.items) {
      if (item.href.startsWith('?')) continue;
      expect(hrefs.some((href) => href?.startsWith(item.href)), item.href).toBe(true);
    }
    // The jumper reads the URL one tick after mount (StateJumper.tsx), then marks where you are.
    await waitFor(() => expect(jumper.querySelector('a[aria-current="page"]')).toHaveTextContent('Price'));
    expect(container.querySelector('[data-surface]')).toHaveAttribute('data-jumper', 'true');
  });
  test('states are dashed and screens are not, as on the other surfaces', () => {
    const { container } = renderAt(
      <div data-surface="patient"><StateJumper surface="patient" /></div>,
      { pathname: '/patient', providers: DataModeProvider },
    );
    const noGp = Array.from(container.querySelectorAll('a')).find((a) => a.textContent === 'No GP')!;
    expect(noGp).toHaveAttribute('data-kind', 'state');
    expect(noGp.className).toContain('border-dashed');
  });
});
