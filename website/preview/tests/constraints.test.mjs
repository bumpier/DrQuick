import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = new URL('../', import.meta.url).pathname;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const FILES = walk(ROOT).filter((f) => ['.html', '.css', '.js'].includes(extname(f)));
const HTML = FILES.filter((f) => extname(f) === '.html');

const MEDICINES = [
  'amoxicillin', 'azithromycin', 'clarithromycin', 'doxycycline', 'penicillin',
  'trimethoprim', 'nitrofurantoin', 'prednisolone', 'salbutamol', 'omeprazole',
  'metformin', 'atorvastatin', 'levothyroxine', 'sertraline', 'fluoxetine',
  'citalopram', 'amitriptyline', 'naproxen', 'ibuprofen', 'paracetamol',
  'codeine', 'tramadol', 'morphine', 'oxycodone', 'diazepam', 'zopiclone',
  'pregabalin', 'gabapentin', 'semaglutide', 'tirzepatide', 'wegovy',
  'ozempic', 'mounjaro',
];

// Word-boundary patterns: a bare substring match on "surge" also fires on
// "surgery", which is ordinary UK general-practice vocabulary.
const BANNED_PATTERNS = [
  /\bsurge\b/i,
  /\bpriority queue\b/i,
  /\bbusier than usual\b/i,
  /\bcqc-registered clinical partner\b/i,
  /\bcqc (registration )?number\b/i,
];

const ALLOWED_HEX = new Set([
  '#ffffff', '#000000', '#1447e6', '#6e9bff', '#767676', '#a3a3a3',
  '#f1f1f1', '#e4e4e4', '#d2d2d2', '#8a8a8a', '#595959', '#c9c9c9',
]);

test('preview source names no medicine', () => {
  for (const file of FILES) {
    const text = readFileSync(file, 'utf8').toLowerCase();
    for (const drug of MEDICINES) {
      assert.ok(!text.includes(drug), `${file} names a medicine: ${drug}`);
    }
  }
});

test('preview source uses no banned pricing or claim wording', () => {
  for (const file of FILES) {
    const text = readFileSync(file, 'utf8');
    for (const pattern of BANNED_PATTERNS) {
      assert.ok(!pattern.test(text), `${file} contains banned wording: ${pattern}`);
    }
  }
});

test('preview source invents no CQC provider id', () => {
  for (const file of FILES) {
    const text = readFileSync(file, 'utf8');
    assert.ok(!/\b1-\d{6,}\b/.test(text), `${file} contains a CQC-shaped provider id`);
  }
});

test('preview source uses only the permitted palette', () => {
  for (const file of FILES) {
    const text = readFileSync(file, 'utf8');
    for (const hex of text.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []) {
      assert.ok(ALLOWED_HEX.has(hex.toLowerCase()), `${file} uses off-palette colour ${hex}`);
    }
  }
});

test('every preview page carries the prototype ribbon', () => {
  assert.ok(HTML.length > 0, 'no preview HTML pages found');
  for (const file of HTML) {
    const text = readFileSync(file, 'utf8');
    assert.match(text, /class="ribbon"/, `${file} is missing the prototype ribbon`);
    assert.match(text, /Not a live service/, `${file} ribbon lacks the disclaimer text`);
  }
});

test('every preview page is noindex', () => {
  for (const file of HTML) {
    const text = readFileSync(file, 'utf8');
    assert.match(
      text,
      /<meta\s+name="robots"\s+content="noindex,\s*nofollow">/,
      `${file} is missing the noindex meta tag`,
    );
  }
});

import * as FIXTURES from '../js/fixtures.js';

test('fixtures use synthetic GP references, never names', () => {
  for (const gp of FIXTURES.GPS) {
    assert.match(gp.ref, /^GP-\d{3}$/, `GP reference is not synthetic: ${gp.ref}`);
    assert.ok(!('name' in gp), 'fixtures must not carry GP names');
  }
});

test('fixtures state the price as £39 and disclose the pharmacy charge', () => {
  assert.equal(FIXTURES.PRICE.amount, '£39');
  assert.match(FIXTURES.PRICE.note, /pharmacy/i);
});

test('every GP credential carries a status the admin surface can render', () => {
  const allowed = new Set(['valid', 'expiring', 'expired', 'pending']);
  for (const gp of FIXTURES.GPS) {
    for (const [key, credential] of Object.entries(gp.credentials)) {
      assert.ok(allowed.has(credential.status), `${gp.ref}.${key} has status ${credential.status}`);
    }
  }
});

test('at least one GP has expired indemnity, so the blocking state is reachable', () => {
  assert.ok(
    FIXTURES.GPS.some((gp) => gp.credentials.indemnity.status === 'expired'),
    'no GP has expired indemnity — the doctor blocking state cannot be demonstrated',
  );
});

test('the queue fixture is 45-second aligned so the position actually advances', () => {
  assert.equal(
    FIXTURES.QUEUE.etaSeconds,
    FIXTURES.QUEUE.position * 45,
    'tickQueue advances only on exact multiples of 45; an unaligned seed pins the '
      + 'patient at their starting position while the wait counts down to zero',
  );
});

test('prescribing fixtures reconcile with the consult total and the register', () => {
  const consults = FIXTURES.PRESCRIBING.reduce((sum, gp) => sum + gp.consults, 0);
  assert.equal(consults, FIXTURES.BUSINESS.consults,
    'per-GP consults must sum to the business consult total, or the two screens contradict each other');
  const flagged = FIXTURES.PRESCRIBING.reduce((sum, gp) => sum + gp.restrictedFlagged, 0);
  const breaches = FIXTURES.GOVERNANCE.restrictedRegister.reduce((sum, row) => sum + row.breaches, 0);
  assert.equal(flagged, breaches,
    'per-GP flags must sum to the register breach total, or governance contradicts itself');
});

test('prescribing fixtures reference GPs synthetically', () => {
  for (const gp of FIXTURES.PRESCRIBING) {
    assert.match(gp.ref, /^GP-\d{3}$/);
  }
});

test('business fixtures pair each headline number with its plan assumption', () => {
  assert.ok(Number.isFinite(FIXTURES.BUSINESS.cac.actual));
  assert.ok(Number.isFinite(FIXTURES.BUSINESS.cac.assumption));
  assert.ok(Number.isFinite(FIXTURES.BUSINESS.repeatRate.actual));
  assert.ok(Number.isFinite(FIXTURES.BUSINESS.repeatRate.assumption));
});
