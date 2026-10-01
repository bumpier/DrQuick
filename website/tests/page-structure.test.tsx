// @vitest-environment jsdom
import { test, expect, beforeEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
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
  'Am I employed by Dr Quick?', 'How much do I keep?', 'What is the sign-up fee?',
  'What indemnity do I need?', 'What gets checked before I start?',
  'Do I have to prescribe?', 'How long is a consultation?', 'What equipment do I need?',
  'What happens to my details?', 'Where are the patients?', 'When does this start?',
];

test('the GP mode keeps its order, has no 999 band, and the dark fill sits on the pay band', () => {
  const { container } = render(<Page />);
  const gp = container.querySelector('[data-mode="gp"]')!;
  const kids = [...gp.querySelectorAll(':scope > *')];
  expect(kids.map((el) => GP_ORDER.find((c) => el.classList.contains(c)))).toEqual(GP_ORDER);
  expect(gp.querySelector('.urgent')).toBeNull();
  expect(gp.querySelector('.pay .bg-band')).not.toBeNull();
  expect(gp.querySelector('#gps')).not.toBeNull(); // the #gps hash target
});

test('the GP FAQ asks all eleven questions, in order', () => {
  const { container } = render(<Page />);
  const summaries = [...container.querySelectorAll('[data-mode="gp"] .faq summary')].map((s) => s.textContent);
  expect(summaries).toEqual(GP_QS);
});

// The answers state the commission and the fee from their modules, in full:
// the three tiers, what counts towards them, and how the fee comes back.
test('the GP FAQ states the commission tiers and the fee terms', () => {
  const { container } = render(<Page />);
  const answer = (q: string) => [...container.querySelectorAll('[data-mode="gp"] .faq details')]
    .find((d) => d.querySelector('summary')!.textContent === q)!.querySelector('p')!.textContent!.replace(/\s+/g, ' ');
  expect(answer('How much do I keep?')).toBe(
    'You keep 60% of the price of each consultation, and Dr Quick keeps 40%. After 100 completed consultations you keep 70%, and after 500 you keep 75%, which is the top rate. The count is of consultations you complete, and it never resets. What a consultation pays is shown in full before you accept it.',
  );
  expect(answer('What is the sign-up fee?')).toBe(
    '£50, paid once by card when you sign up. Refunded in full if we can’t verify your GMC registration or don’t take you on. The payment is taken by Stripe, so Dr Quick never sees your card details.',
  );
});

// The only forms on the page are the patient waitlist's. The GP sign-up is a
// pop-up: its form is not in the document until a doctor asks for it.
test('the page carries the patient forms, and no GP form until it is asked for', () => {
  const { container } = render(<Page />);
  const sources = [...container.querySelectorAll('form')].map((f) => f.getAttribute('data-source'));
  expect(sources).toEqual(PATIENT_MODE ? ['hero', 'recap'] : []);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});

// Both GP capture points are the same ask: a doctor who scrolls to the bottom
// meets the same button, the same fee and the same four fields as in the hero.
test('both GP capture points state the fee and open the same four-field sign-up', () => {
  const { container } = render(<Page />);
  const triggers = [...container.querySelectorAll<HTMLElement>('[data-mode="gp"] [data-gp-signup]')];
  expect(triggers.map((b) => [b.id, b.dataset.gpSignup])).toEqual([['gp-join', 'hero-gp'], ['gp-join2', 'recap-gp']]);
  for (const cta of container.querySelectorAll('[data-mode="gp"] .gp-cta')) {
    expect(cta.querySelector('.note')).toHaveTextContent('£50 one-off sign-up fee. Refunded in full');
  }
  for (const trigger of triggers) {
    fireEvent.click(trigger);
    const dialog = document.querySelector('[role="dialog"]')!;
    const form = dialog.querySelector('form')!;
    expect(form).toHaveAttribute('data-source', trigger.dataset.gpSignup);
    const visible = [...form.querySelectorAll('input')].filter((i) => !i.classList.contains('hp'));
    expect(visible.map((i) => i.getAttribute('name'))).toEqual(['name', 'email', 'mobile', 'gmc']);
    // Every field is labelled: four unlabelled wells are unusable by anyone
    // navigating by voice or screen reader.
    for (const input of visible) {
      expect(form.querySelector(`label[for="${input.id}"]`), `no label for #${input.id}`).toBeTruthy();
    }
    fireEvent.keyDown(dialog, { key: 'Escape' });
  }
});

patientTest('without JS both modes are in the document, the main audience first', () => {
  const { container } = render(<Page />);
  const modes = [...container.querySelectorAll('.mode')].map((m) => m.getAttribute('data-mode'));
  expect(modes).toEqual(DEFAULT_ROLE === 'gp' ? ['gp', 'patient'] : ['patient', 'gp']);
  expect(container.querySelectorAll('h1')).toHaveLength(2);
});

test('the GP hero says what a GP keeps, and leads to where it is explained', () => {
  const { container } = render(<Page />);
  const hero = container.querySelector('[data-mode="gp"] .hero')!;
  expect(hero.querySelector('.sub')).toHaveTextContent(
    'Keep 60% of every consultation, rising to 75%. No minimum hours and no retainer, by secure video from wherever you are.',
  );
  const more = hero.querySelector('.gp-cta a')!;
  expect(more).toHaveAttribute('href', '#gp-pay-title');
  expect(container.querySelector('[data-mode="gp"] .pay h2')).toHaveAttribute('id', 'gp-pay-title');
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

test('the footer carries the second 999 link, and no Storyset asset or attribution is left', () => {
  const { container } = render(<Page />);
  const footer = container.querySelector('footer')!;
  expect(footer.querySelector('a.tel')).toHaveAttribute('href', 'tel:999');
  // The illustrations left with the 2026-09-25 rebrand; the licence link goes with them.
  expect(container.querySelector('a[href*="storyset.com"]')).toBeNull();
  expect(container.querySelector('img[src*="illustration"], .art')).toBeNull();
  // The 999 band is patient-flow content and ships only in patient mode; the
  // footer instance is shared, so the page never loses the number entirely.
  expect(container.querySelectorAll('a[href="tel:999"]')).toHaveLength(PATIENT_MODE ? 2 : 1);
});

test('the pay copy names the rate honestly', () => {
  const { container } = render(<Page />);
  const pay = container.querySelector('[data-mode="gp"] .pay')!;
  expect(pay.querySelector('h2')).toHaveTextContent('Keep 60% of every consultation, rising to 75%.');
  expect(pay.querySelector('.fine')).toHaveTextContent('shown in full before you accept it');
  expect(pay.querySelector('.fine')).toHaveTextContent('more when demand is high');
  // The three tiers, as steps, each carrying its own words.
  expect([...pay.querySelectorAll('.commission-ladder li')].map((li) => li.textContent)).toEqual([
    '60%To start, from your first consultation',
    '70%After 100 completed consultations',
    '75%After 500 completed consultations',
  ]);
  // The patient price stays a promise without a figure: pricing is dynamic.
  const price = container.querySelector('[data-mode="patient"] .price');
  if (price) expect(price.textContent).not.toMatch(/£\d|\d\s?%/);
});
