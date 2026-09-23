// @vitest-environment jsdom
import { test, expect, beforeEach, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
vi.mock('next/navigation', () => import('./helpers/next-navigation'));
import { installDomStubs } from './helpers/dom-stubs';
import { CredentialMatrix } from '@/components/app/CredentialMatrix';
import { GATE_RECORDS, MY_RECORD, type CredentialRecord } from '@/lib/fixtures';
import { CREDENTIAL_KEYS, CREDENTIAL_LABELS } from '@/lib/alerts';
import { DASH } from '@/lib/placeholder';

// The matrix has no hook, so the navigation mock is inert; it is installed
// anyway so every component test in this suite starts from the same floor.
beforeEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); installDomStubs(); });

const rows = (c: HTMLElement) => [...c.querySelectorAll<HTMLTableRowElement>('tbody tr')];
const labels = (c: HTMLElement) => rows(c).map((r) => r.querySelector('th')!.textContent);
const expiry = (c: HTMLElement) => rows(c).map((r) => r.querySelectorAll('td')[1].textContent);
const badge = (row: HTMLElement) => row.querySelector<HTMLElement>('[data-slot="badge"]')!;

test('blank mode: every credential in record order, no status, "Not submitted" throughout', () => {
  const { container } = render(<CredentialMatrix record={MY_RECORD} seeded={false} caption="Your credentials" />);
  expect(labels(container)).toEqual(CREDENTIAL_KEYS.map((k) => CREDENTIAL_LABELS[k]));
  expect(expiry(container)).toEqual(Array(7).fill('Not submitted'));
  expect(screen.getAllByLabelText('Not submitted')).toHaveLength(7);
  for (const row of rows(container)) {
    expect(badge(row)).toHaveTextContent(DASH);
    expect(row).not.toHaveClass('bg-band');
    expect(row).not.toHaveClass('border-ink');
  }
});

test('GP-003: the expired indemnity leads on a band row whose badge goes white', () => {
  const { container } = render(<CredentialMatrix record={GATE_RECORDS['indemnity-expired']} seeded caption="GP-003" />);
  expect(labels(container)).toEqual([
    'Indemnity cover', 'GMC registration', 'Licence to practise', 'CCT / specialist registration',
    'DBS check', 'Right to work', 'GMC revalidation',
  ]);
  const [lead, ...rest] = rows(container);
  expect(lead).toHaveClass('bg-band', 'text-white', 'hover:bg-band');
  expect(lead.querySelector('[data-status="expired"]')).toHaveTextContent('Expired');
  expect(badge(lead)).toHaveClass('text-white');
  expect(expiry(container)[0]).toBe('0 days');
  for (const row of rest) expect(row).not.toHaveClass('bg-band');
  expect(container.querySelectorAll('[data-status="valid"]')).toHaveLength(6);
});

test('GP-002: expiring rows lead soonest-first with an ink border, then the valid rows in record order', () => {
  const { container } = render(<CredentialMatrix record={MY_RECORD} seeded caption="Your credentials" />);
  expect(labels(container)).toEqual([
    'Indemnity cover', 'DBS check', 'GMC registration', 'Licence to practise',
    'CCT / specialist registration', 'Right to work', 'GMC revalidation',
  ]);
  expect(expiry(container)).toEqual(['9 days', '12 days', '250 days', '250 days', 'No expiry', 'No expiry', '120 days']);
  const all = rows(container);
  for (const row of all.slice(0, 2)) expect(row).toHaveClass('border-2!', 'border-ink');
  for (const row of all.slice(2)) expect(row).not.toHaveClass('border-ink');
  expect(container.querySelector('.bg-band')).toBeNull();
  expect(container.querySelectorAll('[data-status="expiring"]')).toHaveLength(2);
});

test('the full order is expired, rejected, pending, expiring by days, valid', () => {
  const mixed: CredentialRecord = {
    ...MY_RECORD,
    gmc: { status: 'pending', daysRemaining: null },
    licence: { status: 'rejected', daysRemaining: null },
    cct: { status: 'expired', daysRemaining: 0 },
  };
  const { container } = render(<CredentialMatrix record={mixed} seeded caption="Mixed" />);
  expect(labels(container)).toEqual([
    'CCT / specialist registration', 'Licence to practise', 'GMC registration',
    'Indemnity cover', 'DBS check', 'Right to work', 'GMC revalidation',
  ]);
  expect(expiry(container)).toEqual(['0 days', DASH, DASH, '9 days', '12 days', 'No expiry', '120 days']);
  const all = rows(container);
  expect(all[0]).toHaveClass('bg-band');
  expect(all[1]).not.toHaveClass('bg-band');                      // rejected is a badge, not a fill
  expect(all[1].querySelector('[data-status="rejected"]')).toHaveTextContent('Rejected');
  expect(container.querySelectorAll('.bg-band')).toHaveLength(1);
});

test('GP-004: a pending check has no expiry yet, so its cell is the dash, not "No expiry"', () => {
  const { container } = render(<CredentialMatrix record={GATE_RECORDS['verification-pending']} seeded caption="GP-004" />);
  expect(labels(container)).toEqual([
    'GMC registration', 'Licence to practise', 'CCT / specialist registration', 'DBS check',
    'Indemnity cover', 'GMC revalidation', 'Right to work',
  ]);
  expect(expiry(container)).toEqual([DASH, DASH, DASH, DASH, DASH, DASH, 'No expiry']);
  expect(container.querySelectorAll('[data-status="pending"]')).toHaveLength(6);
});

test('keys renders the five onboarding credentials and nothing else', () => {
  const { container } = render(
    <CredentialMatrix record={GATE_RECORDS['verification-pending']} seeded caption="Credentials"
      keys={['gmc', 'licence', 'cct', 'dbs', 'rightToWork']} />,
  );
  expect(labels(container)).toEqual(['GMC registration', 'Licence to practise', 'CCT / specialist registration', 'DBS check', 'Right to work']);
  expect(container.textContent).not.toMatch(/Indemnity cover|GMC revalidation/);
});

test('the table is captioned, every header is scoped, and stack marks the table and labels its cells', () => {
  const { container, unmount } = render(<CredentialMatrix record={MY_RECORD} seeded caption="Your credentials" stack="phone" />);
  expect(screen.getByRole('table', { name: 'Your credentials' })).toBeInTheDocument();
  expect(container.querySelector('caption')).toHaveTextContent('Your credentials');
  const heads = [...container.querySelectorAll('th')];
  expect(heads).toHaveLength(10);
  for (const th of heads) expect(th).toHaveAttribute('scope');
  expect(container.querySelectorAll('th[scope="col"]')).toHaveLength(3);
  expect(container.querySelectorAll('th[scope="row"]')).toHaveLength(7);
  expect(container.querySelector('table')).toHaveAttribute('data-stack', 'phone');
  expect(container.querySelectorAll('td[data-label="Status"]')).toHaveLength(7);
  expect(container.querySelectorAll('td[data-label="Days remaining"]')).toHaveLength(7);
  const band = within(container).queryByText('Not submitted');
  expect(band).toBeNull();
  unmount();
  const plain = render(<CredentialMatrix record={MY_RECORD} seeded caption="Your credentials" />);
  expect(plain.container.querySelector('table')).not.toHaveAttribute('data-stack');
});
