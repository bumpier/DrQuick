// @vitest-environment jsdom
import { test, expect, describe, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { installDomStubs } from './helpers/dom-stubs';
import { Ribbon } from '@/components/app/Ribbon';
import { EmptyState } from '@/components/app/EmptyState';
import { StatTile } from '@/components/app/StatTile';
import { PageHeader } from '@/components/app/PageHeader';
import { Facts } from '@/components/app/Facts';
import { StatusBadge } from '@/components/app/StatusBadge';
import { Stepper, type Step } from '@/components/app/Stepper';
import { STATUS_LABELS } from '@/lib/alerts';
import type { CredentialStatus } from '@/lib/fixtures';

// Part 1 (Task 9): the static compositions. The charts (Task 10), CredentialMatrix
// (Task 11) and the shell pieces (Task 12) append to this file, so the navigation
// mock and the dom stubs are its standing header even though nothing in part 1
// navigates or measures.
vi.mock('next/navigation', () => import('./helpers/next-navigation'));

beforeEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  installDomStubs();
});

const STATUSES = Object.keys(STATUS_LABELS) as CredentialStatus[];

describe('StatTile', () => {
  test('marks its numeral, defaults to the headline size and sizes it per decision 26', () => {
    const { container } = render(<StatTile label="Earned today" value="£117" />);
    const tile = container.querySelector('[data-slot="stat-tile"]')!;
    expect(tile).toHaveAttribute('data-size', 'lg');
    const value = tile.querySelector('[data-slot="stat-value"]')!;
    expect(value).toHaveTextContent('£117');
    for (const cls of ['font-display', 'text-4xl', 'font-bold', 'leading-none', 'tabular-nums']) expect(value).toHaveClass(cls);
    expect(tile).toHaveTextContent('Earned today');
    expect(tile.querySelector('[data-slot="stat-against"]')).toBeNull();
  });

  test('the small size keeps the face and the figure spacing', () => {
    const { container } = render(<StatTile size="sm" label="Time online today" value="42m" />);
    expect(container.querySelector('[data-slot="stat-tile"]')).toHaveAttribute('data-size', 'sm');
    const value = container.querySelector('[data-slot="stat-value"]')!;
    for (const cls of ['font-display', 'text-2xl', 'font-semibold', 'leading-none', 'tabular-nums']) expect(value).toHaveClass(cls);
    expect(value).not.toHaveClass('text-4xl');
  });

  test('a dash sits in the numeral slot, in the same classes as a figure', () => {
    const { container } = render(<StatTile label="Earned today" value="—" />);
    const value = container.querySelector('[data-slot="stat-value"]')!;
    expect(value).toHaveTextContent('—');
    expect(value).toHaveClass('text-4xl');
  });

  test('note and against are their own lines; against carries its slot', () => {
    const { container } = render(
      <StatTile label="Next payout" value="—" note="Nothing to pay out yet" against="plan assumed £16" />,
    );
    expect(container.querySelector('[data-slot="stat-tile"]')).toHaveTextContent('Nothing to pay out yet');
    expect(container.querySelector('[data-slot="stat-against"]')).toHaveTextContent('plan assumed £16');
  });
});

describe('StatusBadge', () => {
  const VARIANT: Record<CredentialStatus, string> = {
    pending: 'secondary', expiring: 'secondary', valid: 'success', expired: 'destructive', rejected: 'destructive',
  };

  test('every status carries its word, its data-status and the ink-ramp variant', () => {
    expect(STATUSES).toHaveLength(5);
    for (const status of STATUSES) {
      const { container, unmount } = render(<StatusBadge status={status} />);
      const badge = container.querySelector('[data-slot="badge"]')!;
      expect(badge).toHaveTextContent(STATUS_LABELS[status]);
      expect(badge).toHaveAttribute('data-status', status);
      expect(badge).toHaveAttribute('data-variant', VARIANT[status]);
      unmount();
    }
  });

  test('expiring is ink at 15 percent, not the primary accent', () => {
    const { container } = render(<StatusBadge status="expiring" />);
    const badge = container.querySelector('[data-slot="badge"]')!;
    expect(badge).toHaveClass('bg-ink/15');
    expect(badge).toHaveClass('text-ink');
    for (const cls of ['bg-fill', 'text-ink-2', 'bg-primary/15', 'text-primary']) expect(badge).not.toHaveClass(cls);
  });

  test('blank mode has no status: a dash named "Not submitted" with no data-status', () => {
    const { container } = render(<StatusBadge status={null} />);
    const badge = container.querySelector('[data-slot="badge"]')!;
    expect(badge).toHaveTextContent('—');
    expect(badge).toHaveAttribute('aria-label', 'Not submitted');
    expect(badge).not.toHaveAttribute('data-status');
    expect(badge).toHaveAttribute('data-variant', 'secondary');
  });

  test('on the band every badge is white at 15 percent — the row is the severity', () => {
    for (const status of [...STATUSES, null]) {
      const { container, unmount } = render(<StatusBadge status={status} onBand />);
      const badge = container.querySelector('[data-slot="badge"]')!;
      expect(badge).toHaveClass('bg-white/15');
      expect(badge).toHaveClass('text-white');
      for (const cls of ['bg-error/15', 'text-error', 'bg-success/15', 'text-success', 'bg-ink/15', 'text-ink', 'bg-fill', 'text-ink-2']) {
        expect(badge).not.toHaveClass(cls);
      }
      unmount();
    }
  });
});

describe('Stepper', () => {
  // preview/js/doctor.js:47-54 — the six steps as the rail named them.
  const LABELS = ['Register', 'Identity', 'Credentials', 'Indemnity', 'Skills', 'Done'];
  const at = (current: number): Step[] => LABELS.map((label, i) => ({
    id: label.toLowerCase(), label, status: i < current ? 'done' : i === current ? 'current' : 'todo',
  }));

  test('is an ordered list with one aria-current step and the words a bar cannot say', () => {
    const { container } = render(<Stepper steps={at(3)} />);
    const ol = container.querySelector('ol[aria-label="Onboarding steps"]')!;
    const items = Array.from(ol.children);
    expect(items).toHaveLength(6);
    expect(items.every((li) => li.tagName === 'LI')).toBe(true);
    expect(ol.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
    expect(items[3]).toHaveAttribute('aria-current', 'step');
    expect(items[3]).toHaveTextContent('Indemnity');
    expect(items[3]).not.toHaveTextContent(/completed|not started/);
    expect(items[0]).toHaveTextContent('Register completed');
    expect(items[5]).toHaveTextContent('Done not started');
    expect(items[0].querySelector('.sr-only')).toHaveTextContent('completed');
  });

  test('severity by fill: ink up to and including the current step, fill beyond it', () => {
    const { container } = render(<Stepper steps={at(3)} />);
    const bars = Array.from(container.querySelectorAll('[data-slot="step-bar"]'));
    expect(bars).toHaveLength(6);
    expect(bars.slice(0, 4).every((b) => b.classList.contains('bg-ink'))).toBe(true);
    expect(bars.slice(4).every((b) => b.classList.contains('bg-fill'))).toBe(true);
    expect(Array.from(container.querySelectorAll('li')).map((li) => li.getAttribute('data-step')))
      .toEqual(['done', 'done', 'done', 'current', 'todo', 'todo']);
  });
});

describe('Ribbon', () => {
  test('is a note carrying the sentence verbatim, in the label-caps face on the band', () => {
    const { container } = render(<Ribbon />);
    const ribbon = container.querySelector('[data-slot="ribbon"]')!;
    expect(ribbon.tagName).toBe('P');
    expect(ribbon).toHaveAttribute('role', 'note');
    expect(ribbon).not.toHaveAttribute('aria-live');
    expect(ribbon.textContent).toBe('Prototype. Not a live service — no real patients, GPs, or data.');
    for (const cls of ['sticky', 'top-0', 'z-20', 'bg-band', 'text-white', 'font-display', 'uppercase']) expect(ribbon).toHaveClass(cls);
    expect(ribbon).not.toHaveClass('font-mono');
  });

  test('className merges through cn: the shell sets its height, the gallery unsticks it', () => {
    const { container } = render(<Ribbon className="static min-h-(--ribbon-h)" />);
    const ribbon = container.querySelector('[data-slot="ribbon"]')!;
    expect(ribbon).toHaveClass('static');
    expect(ribbon).toHaveClass('min-h-(--ribbon-h)');
    expect(ribbon).not.toHaveClass('sticky');
  });
});

describe('EmptyState', () => {
  test('is a written sentence marked data-slot="empty"', () => {
    const { container } = render(<EmptyState>No consultations yet.</EmptyState>);
    const empty = container.querySelector('p[data-slot="empty"]')!;
    expect(empty).toHaveTextContent('No consultations yet.');
    for (const cls of ['text-ink-2', 'text-body', 'border-dashed', 'border-rule', 'text-center']) expect(empty).toHaveClass(cls);
  });
});

describe('PageHeader', () => {
  test('the h1 carries data-reveal, the app headline sizes and a focus target', () => {
    const { container } = render(
      <PageHeader title="Today" lead="lead copy" actions={<button type="button">Simulate an offer</button>} />,
    );
    const h1 = container.querySelector('h1')!;
    expect(h1).toHaveTextContent('Today');
    expect(h1).toHaveAttribute('data-reveal');
    expect(h1).toHaveAttribute('tabindex', '-1');
    expect(h1).toHaveClass('text-headline');
    expect(h1).toHaveClass('max-phone:text-headline-sm');
    const lead = container.querySelector('[data-slot="page-header"] p')!;
    expect(lead).toHaveTextContent('lead copy');
    expect(lead).toHaveClass('text-ink-2');
    expect(lead).toHaveClass('max-w-[52ch]');
    expect(container.querySelector('button')).toHaveTextContent('Simulate an offer');
  });

  test('without a lead there is no empty paragraph', () => {
    const { container } = render(<PageHeader title="Earnings" />);
    expect(container.querySelector('[data-slot="page-header"] p')).toBeNull();
    expect(container.querySelectorAll('h1')).toHaveLength(1);
  });
});

describe('Facts', () => {
  test('is a dl of exactly the rows it was given, terms then values', () => {
    const { container } = render(
      <Facts items={[
        ['Presenting complaint', 'Sore throat and fever, three days'],
        ['Age band', '30–39'],
        ['NHS GP summary consent', 'Yes'],
      ]} />,
    );
    const dl = container.querySelector('dl[data-slot="facts"]')!;
    expect(Array.from(dl.querySelectorAll('dt')).map((d) => d.textContent))
      .toEqual(['Presenting complaint', 'Age band', 'NHS GP summary consent']);
    expect(Array.from(dl.querySelectorAll('dd')).map((d) => d.textContent))
      .toEqual(['Sore throat and fever, three days', '30–39', 'Yes']);
    expect(dl.querySelectorAll('dt')).toHaveLength(dl.querySelectorAll('dd').length);
  });
});
