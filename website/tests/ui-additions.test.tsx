// @vitest-environment jsdom
import { test, expect, beforeEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

beforeEach(cleanup);

test('the checkbox is a real checkbox and the click toggles it', () => {
  const { getByRole } = render(<Checkbox aria-label="Dermatology" />);
  const box = getByRole('checkbox', { name: 'Dermatology' });
  expect(box).toHaveAttribute('aria-checked', 'false');
  fireEvent.click(box);
  expect(box).toHaveAttribute('aria-checked', 'true');
  fireEvent.click(box);
  expect(box).toHaveAttribute('aria-checked', 'false');
});

test('a disabled checkbox does not toggle', () => {
  const { getByRole } = render(<Checkbox aria-label="Locked" disabled />);
  const box = getByRole('checkbox', { name: 'Locked', hidden: true });
  fireEvent.click(box);
  expect(box).toHaveAttribute('aria-checked', 'false');
});

const rows = (stack?: 'cols' | 'phone') => render(
  <Table stack={stack}>
    <TableHeader>
      <TableRow><TableHead>Patient</TableHead><TableHead>Fee</TableHead></TableRow>
    </TableHeader>
    <TableBody>
      <TableRow><TableCell label="Patient">A. Patient</TableCell><TableCell label="Fee">£39</TableCell></TableRow>
    </TableBody>
  </Table>,
);

test('a plain table carries no stack marker', () => {
  const { container } = rows();
  expect(container.querySelector('table')).not.toHaveAttribute('data-stack');
  expect(container.querySelector('table')).not.toHaveAttribute('role');
});

test('a stacked table marks its mode and re-asserts the table roles', () => {
  const { container, getByRole } = rows('cols');
  const table = container.querySelector('table')!;
  expect(table).toHaveAttribute('data-stack', 'cols');
  expect(table).toHaveAttribute('role', 'table');
  expect(getByRole('table')).toBe(table);
  expect(container.querySelector('thead')).toHaveAttribute('role', 'rowgroup');
  expect(container.querySelector('tbody')).toHaveAttribute('role', 'rowgroup');
  expect(container.querySelector('tbody tr')).toHaveAttribute('role', 'row');
  expect(container.querySelector('th')).toHaveAttribute('role', 'columnheader');
});

test('the cell label is printed decoration, carried on data-label', () => {
  const { container } = rows('phone');
  const cells = container.querySelectorAll('td');
  expect(cells[0]).toHaveAttribute('data-label', 'Patient');
  expect(cells[1]).toHaveAttribute('data-label', 'Fee');
  expect(cells[0]).toHaveAttribute('role', 'cell');
  expect(cells[0].textContent).toBe('A. Patient');
});

test('a row header reports as a row header, not a column header', () => {
  const { container } = render(
    <Table stack="cols">
      <TableBody>
        <TableRow><TableHead scope="row">A. Patient</TableHead><TableCell label="Fee">£39</TableCell></TableRow>
      </TableBody>
    </Table>,
  );
  expect(container.querySelector('th')).toHaveAttribute('role', 'rowheader');
});
