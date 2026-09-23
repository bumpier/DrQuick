// @vitest-environment jsdom
import { test, expect, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import '@testing-library/jest-dom/vitest';
import Page from '@/app/page';
import { installIOStub } from './helpers/io-stub';
import { DEFAULT_ROLE, PATIENT_MODE } from '@/lib/site-mode';

// Both modes ship at launch. The patient assertions skip only if PATIENT_MODE
// is switched off again; the GP-only assertions are the contract for that case.
const patientTest = test.skipIf(!PATIENT_MODE);

beforeEach(() => {
  cleanup();
  installIOStub();
  vi.stubGlobal('scrollTo', vi.fn());
  document.documentElement.className = 'js';
  document.documentElement.setAttribute('data-role', DEFAULT_ROLE);
});

const PATIENT_ORDER = ['hero', 'urgent', 'steps', 'covers', 'price', 'faq', 'recap'];
const PATIENT_QS = [
  'Are these real GPs?', 'How quickly will I be seen?', 'Can I get a prescription?',
  'Is Dr Quick CQC registered?', 'Will my own GP find out?', 'Can I use it for my children?',
  'What happens to my email address?', 'Where can I use Dr Quick?',
];

patientTest('the patient mode keeps its section order — what the reader knows when', () => {
  const { container } = render(<Page />);
  const kids = [...container.querySelectorAll('[data-mode="patient"] > *')];
  expect(kids.map((el) => PATIENT_ORDER.find((c) => el.classList.contains(c)))).toEqual(PATIENT_ORDER);
});

patientTest('the patient FAQ asks all eight questions, in order', () => {
  const { container } = render(<Page />);
  const summaries = [...container.querySelectorAll('[data-mode="patient"] .faq summary')].map((s) => s.textContent);
  expect(summaries).toEqual(PATIENT_QS);
});

patientTest('the 999 band sits directly under the hero with a live tel: link', () => {
  const { container } = render(<Page />);
  const urgent = container.querySelector('[data-mode="patient"] .urgent')!;
  expect(urgent.previousElementSibling!.classList.contains('hero')).toBe(true);
  expect(urgent.querySelector('a.tel')).toHaveAttribute('href', 'tel:999');
});

patientTest('both patient forms exist with their sources; email is the only field', () => {
  const { container } = render(<Page />);
  const forms = [...container.querySelectorAll('[data-mode="patient"] form')];
  expect(forms.map((f) => f.getAttribute('data-source'))).toEqual(['hero', 'recap']);
  for (const form of forms) {
    const visible = [...form.querySelectorAll('input')].filter((i) => !i.classList.contains('hp'));
    expect(visible).toHaveLength(1);
    expect(visible[0]).toHaveAttribute('type', 'email');
  }
});

test('the DEPLOY / LEGAL marker survives in source', () => {
  const content = readFileSync(join(__dirname, '../app/landing-content.tsx'), 'utf8');
  expect(content).toContain('DEPLOY / LEGAL');
  expect(content).toContain('UK GDPR Art 13');
});

const GP_ORDER = ['hero', 'steps', 'covers', 'pay', 'faq', 'recap'];
const GP_QS = [
  'Am I employed by Dr Quick?', 'What indemnity do I need?', 'What gets checked before I start?',
  'Do I have to prescribe?', 'How long is a consultation?', 'What equipment do I need?',
  'What happens to my details?', 'Where are the patients?', 'When does this start?',
];

test('the GP mode keeps its order, has no 999 band, and the dark fill sits on the pay band', () => {
  const { container } = render(<Page />);
  const gp = container.querySelector('[data-mode="gp"]')!;
  const kids = [...gp.querySelectorAll(':scope > *')];
  expect(kids.map((el) => GP_ORDER.find((c) => el.classList.contains(c)))).toEqual(GP_ORDER);
  expect(gp.querySelector('.urgent')).toBeNull();
  expect(gp.querySelector('.pay')!.className).toContain('bg-band');
  expect(gp.querySelector('#gps')).not.toBeNull(); // the #gps hash target
});

test('the GP FAQ asks all nine questions, in order', () => {
  const { container } = render(<Page />);
  const summaries = [...container.querySelectorAll('[data-mode="gp"] .faq summary')].map((s) => s.textContent);
  expect(summaries).toEqual(GP_QS);
});

test('every form on the page ships with its own source', () => {
  const { container } = render(<Page />);
  const sources = [...container.querySelectorAll('form')].map((f) => f.getAttribute('data-source'));
  expect(sources).toEqual(
    PATIENT_MODE ? ['hero', 'recap', 'hero-gp', 'recap-gp'] : ['hero-gp', 'recap-gp'],
  );
});

// Both GP capture points ask the same four things: a doctor who scrolls to the
// bottom must not meet a different, lighter ask than the one in the hero.
test('both GP forms ask for name, email, mobile and GMC number', () => {
  const { container } = render(<Page />);
  const forms = [...container.querySelectorAll('[data-mode="gp"] form')];
  expect(forms).toHaveLength(2);
  for (const form of forms) {
    const visible = [...form.querySelectorAll('input')].filter((i) => !i.classList.contains('hp'));
    expect(visible.map((i) => i.getAttribute('name'))).toEqual(['name', 'email', 'mobile', 'gmc']);
    // Every field is labelled: four unlabelled wells are unusable by anyone
    // navigating by voice or screen reader.
    for (const input of visible) {
      expect(form.querySelector(`label[for="${input.id}"]`), `no label for #${input.id}`).toBeTruthy();
    }
  }
});

patientTest('without JS both modes are in the document — one page carrying both audiences', () => {
  const { container } = render(<Page />);
  expect(container.querySelectorAll('.mode')).toHaveLength(2);
  expect(container.querySelectorAll('h1')).toHaveLength(2);
});

// The patient mode is held out of the document, not hidden with CSS: a mode that
// is not being offered should not be there for a crawler or a screen reader.
test.skipIf(PATIENT_MODE)('with PATIENT_MODE off the patient mode is absent, not hidden', () => {
  const { container } = render(<Page />);
  expect(container.querySelector('[data-mode="patient"]')).toBeNull();
  expect(container.querySelectorAll('.mode')).toHaveLength(1);
  expect(container.querySelectorAll('h1')).toHaveLength(1);
  expect(container.querySelector('[data-mode-link]')).toBeNull();
});

test('the footer carries the second 999 link and the Storyset attribution', () => {
  const { container } = render(<Page />);
  const footer = container.querySelector('footer')!;
  expect(footer.querySelector('a.tel')).toHaveAttribute('href', 'tel:999');
  expect(footer.querySelector('a[href="https://storyset.com/doctors"]')).toHaveTextContent('Doctors illustrations by Storyset');
  // The 999 band is patient-flow content and ships only in patient mode; the
  // footer instance is shared, so the page never loses the number entirely.
  expect(container.querySelectorAll('a[href="tel:999"]')).toHaveLength(PATIENT_MODE ? 2 : 1);
});

test('the pay copy names the rate honestly', () => {
  const { container } = render(<Page />);
  expect(container.querySelector('[data-mode="gp"] .pay h2')).toHaveTextContent('Paid more when demand is high.');
  expect(container.querySelector('[data-mode="gp"] .pay .fine')).toHaveTextContent('shown in full before you accept it');
});
