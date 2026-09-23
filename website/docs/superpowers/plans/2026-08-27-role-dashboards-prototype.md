# Role Dashboards Prototype — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a clickable, non-functional prototype of the patient, doctor and admin surfaces so the team can settle what each role does before committing to the real build.

**Architecture:** Four static HTML pages under `preview/`, sharing two stylesheets and three ES modules. Each page holds every screen as a `<section data-screen>`; a router shows one at a time. A bottom rail — styled as obviously-not-the-product — jumps to any screen or state in one click. All logic lives in pure exported functions so `node --test` can test it; DOM wiring is separate.

**Tech Stack:** Plain HTML, CSS and ES modules. No npm dependencies, no build step. Tests use Node's built-in `node --test` runner (Node 26, zero installs). Visual verification uses the cached `chrome-headless-shell` and `python3 -m http.server`.

**Spec:** `docs/superpowers/specs/2026-08-27-role-dashboards-prototype-design.md`

## Global Constraints

Every task's requirements implicitly include this section. Values are copied verbatim from the spec.

- **No dependencies, no build step.** Nothing may be added to a `package.json`; there is none. Node's built-in test runner only.
- **Suite command:** `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test 'preview/tests/*.test.mjs'`. The quoted glob is required — a bare directory argument fails with MODULE_NOT_FOUND on Node 26. The flag silences one environmental warning caused by an unrelated `package.json` in the repo root; every other warning still surfaces, and test output must be pristine.
- **Exactly three colours** plus neutral tints. Permitted hex values, and no others, anywhere under `preview/`: `#FFFFFF` `#000000` `#1447E6` `#6E9BFF` `#767676` `#A3A3A3` `#F1F1F1` `#E4E4E4` `#D2D2D2` `#8A8A8A` `#595959` `#C9C9C9`. `rgba(0,0,0,…)` and `rgba(255,255,255,…)` are permitted. Task 1 enforces this automatically.
- **No medicine is named anywhere**, including fixtures and placeholder text. Prescriptions render as "your prescription".
- **No surge or time-pressure pricing.** The strings `surge`, `priority queue`, `busier than usual` must not appear. One queue, one price, £39.
- **No fabricated absences.** No CQC registration number, no ratings, no press, no plausible-looking traction figures.
- **No algorithmic urgency shown to the patient.** The safety check is a red-flag checklist with a binary outcome.
- **£39 never implies the medicine is included.** The price screen states the pharmacy charges separately.
- **Typography:** Archivo (Google Fonts), weights 500/700/800, `system-ui` fallback.
- **Every `preview/` page carries** the prototype ribbon and `<meta name="robots" content="noindex,nofollow">`.
- **Motion:** the 16px-rise arrival grammar fires on a screen's first paint only, never on tab switches or data updates.
- **Untouched:** `index.html`, everything in `api/`.

## File Structure

| File | Responsibility |
|---|---|
| `preview/index.html` | Role picker — three doors |
| `preview/patient.html` | Patient flow, 11 screens + 6 states |
| `preview/doctor.html` | Doctor onboarding + working surface, 8 states |
| `preview/admin.html` | Admin shell, four sections |
| `preview/css/base.css` | Tokens, reset, typography, ribbon, rail — the chrome |
| `preview/css/components.css` | Product UI vocabulary — the product |
| `preview/js/router.js` | Screen resolution and DOM wiring |
| `preview/js/rail.js` | Rail model construction and rendering |
| `preview/js/live.js` | Interval-driven values: ETA, countdown, timer |
| `preview/js/fixtures.js` | All fake data, in one place |
| `preview/tests/constraints.test.mjs` | Compliance and palette guards over source text |
| `preview/tests/units.test.mjs` | Pure-function unit tests |
| `preview/tests/structure.test.mjs` | Per-surface screen and state contracts |
| `preview/README.md` | How to run tests and screenshots |
| `vercel.json` | Modified: `X-Robots-Tag` for `/preview/(.*)` |

**Task order rationale:** Tasks 1–5 build the foundation every surface needs. Tasks 6–8 are the three surfaces and are independent of each other — if scope needs cutting, cut whole surfaces from the end, never the foundation.

---

### Task 1: Constraint guard, shell and safety headers

**Files:**
- Create: `preview/index.html`
- Create: `preview/css/base.css`
- Create: `preview/tests/constraints.test.mjs`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: nothing.
- Produces: `preview/css/base.css` exposing the CSS custom properties listed in Step 3, the `.ribbon` and `.rail` classes, and a guard suite that every later task's files must keep passing.

- [ ] **Step 1: Write the failing test**

Create `preview/tests/constraints.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test preview/tests/constraints.test.mjs`
Expected: FAIL — `ENOENT` on the `preview/` directory, or "no preview HTML pages found".

- [ ] **Step 3: Write `preview/css/base.css`**

```css
:root {
  --white: #FFFFFF;
  --black: #000000;
  --blue: #1447E6;
  --blue-lift: #6E9BFF;
  --ink-2: #767676;
  --ink-2-dark: #A3A3A3;
  --fill: #F1F1F1;
  --fill-2: #E4E4E4;
  --rule: rgba(0, 0, 0, .13);
  --tile-edge: #D2D2D2;
  --rule-dark: rgba(255, 255, 255, .22);

  --r-control: 8px;
  --r-tile: 16px;

  --s-1: 4px;  --s-2: 8px;  --s-3: 12px; --s-4: 16px;
  --s-6: 24px; --s-8: 32px; --s-12: 48px; --s-16: 64px;

  --ease: cubic-bezier(.22, .61, .36, 1);
  --ease-out: cubic-bezier(.16, 1, .3, 1);

  --rail-h: 44px;
}

*, *::before, *::after { box-sizing: border-box; }

html, body { margin: 0; padding: 0; }

body {
  background: var(--white);
  color: var(--black);
  font-family: Archivo, system-ui, -apple-system, sans-serif;
  font-weight: 500;
  font-size: 16px;
  line-height: 1.45;
  -webkit-font-smoothing: antialiased;
  padding-bottom: var(--rail-h);
}

h1, h2, h3 { margin: 0; font-weight: 800; letter-spacing: -.03em; line-height: 1.05; }
h1 { font-size: clamp(28px, 5vw, 44px); }
h2 { font-size: clamp(22px, 3vw, 30px); }
h3 { font-size: 18px; letter-spacing: -.02em; }

a { color: var(--blue); }

:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }

/* --- prototype chrome: deliberately not the product ------------------- */

.ribbon {
  position: sticky;
  top: 0;
  z-index: 40;
  background: var(--black);
  color: var(--white);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  letter-spacing: .04em;
  text-transform: uppercase;
  padding: var(--s-2) var(--s-4);
}

.rail {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  z-index: 50;
  height: var(--rail-h);
  display: flex;
  align-items: center;
  gap: var(--s-2);
  overflow-x: auto;
  background: var(--black);
  color: var(--white);
  border-top: 1px solid var(--rule-dark);
  padding: 0 var(--s-3);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
}

.rail__group { display: flex; align-items: center; gap: var(--s-2); white-space: nowrap; }
.rail__label { color: var(--ink-2-dark); text-transform: uppercase; letter-spacing: .06em; }

.rail__btn {
  background: transparent;
  color: var(--white);
  border: 1px solid var(--rule-dark);
  border-radius: var(--r-control);
  padding: var(--s-1) var(--s-2);
  font: inherit;
  cursor: pointer;
  white-space: nowrap;
}
.rail__btn[aria-current="true"] { background: var(--white); color: var(--black); }
.rail__btn[data-kind="state"] { border-style: dashed; }

/* --- screens ---------------------------------------------------------- */

[data-screen] { display: none; }
[data-screen].is-active { display: block; }

/* Arrival grammar fires on first paint only, never on later screen changes. */
@media (prefers-reduced-motion: no-preference) {
  body.is-first-paint [data-screen].is-active [data-reveal] {
    animation: rise 320ms var(--ease-out) both;
  }
}
@keyframes rise {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: none; }
}
```

- [ ] **Step 4: Write `preview/index.html`**

```html
<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Dr Quick — role prototype</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/preview/css/base.css">
</head>
<body class="is-first-paint">
<p class="ribbon">Prototype. Not a live service — no real patients, GPs, or data.</p>

<main style="max-width:760px;margin:0 auto;padding:var(--s-16) var(--s-6)">
  <h1>Role prototype</h1>
  <p style="color:var(--ink-2);max-width:52ch">
    Three surfaces, fake data throughout. Every screen and every awkward state is one
    click away on the rail at the bottom of each page.
  </p>
  <nav style="display:grid;gap:var(--s-3);margin-top:var(--s-12)">
    <a href="/preview/patient.html">Patient</a>
    <a href="/preview/doctor.html">Doctor</a>
    <a href="/preview/admin.html">Admin</a>
  </nav>
</main>
</body>
</html>
```

- [ ] **Step 5: Add the `X-Robots-Tag` header**

In `vercel.json`, insert this object into the `headers` array, before the `/assets/(.*)` entry:

```json
{
  "source": "/preview/(.*)",
  "headers": [
    { "key": "X-Robots-Tag", "value": "noindex, nofollow" }
  ]
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test preview/tests/constraints.test.mjs`
Expected: PASS — 6 tests.

- [ ] **Step 7: Verify the JSON is still valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('vercel.json ok')"`
Expected: `vercel.json ok`

- [ ] **Step 8: Commit**

```bash
git add preview/index.html preview/css/base.css preview/tests/constraints.test.mjs vercel.json
git commit -m "feat(preview): prototype shell, compliance guards and noindex headers"
```

---

### Task 2: Screen router

**Files:**
- Create: `preview/js/router.js`
- Create: `preview/tests/units.test.mjs`

**Interfaces:**
- Consumes: `preview/css/base.css` classes `[data-screen]` and `.is-active` from Task 1.
- Produces:
  - `resolveScreen(screenIds: string[], target: string): string` — returns `target`, throws `Error` if absent.
  - `initRouter(doc: Document, initial?: string): { show(id: string): void, current(): string, ids(): string[] }` — wires every `[data-goto]` click to `show`, reflects state in `location.hash`, and reads the initial screen from the hash when present.

- [ ] **Step 1: Write the failing test**

Create `preview/tests/units.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initRouter, resolveScreen } from '../js/router.js';

test('resolveScreen returns a known screen id', () => {
  assert.equal(resolveScreen(['entry', 'queue'], 'queue'), 'queue');
});

test('resolveScreen throws on an unknown screen id', () => {
  assert.throws(
    () => resolveScreen(['entry', 'queue'], 'nope'),
    /Unknown screen: nope/,
  );
});

test('resolveScreen throws when the screen list is empty', () => {
  assert.throws(() => resolveScreen([], 'entry'), /Unknown screen: entry/);
});

// Minimal DOM stand-in: exactly what initRouter touches, and nothing more.
// The project forbids dependencies, so jsdom is not an option.
function fakeDoc(screenIds) {
  const listeners = {};
  const sections = screenIds.map((id) => {
    const classes = new Set();
    return {
      dataset: { screen: id },
      classes,
      classList: { toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)) },
    };
  });
  const bodyClasses = new Set(['is-first-paint']);
  return {
    body: { classList: { remove: (c) => bodyClasses.delete(c) } },
    defaultView: { location: { hash: '' } },
    querySelectorAll: () => sections,
    addEventListener: (type, fn) => ((listeners[type] ??= []).push(fn)),
    dispatchEvent: (event) => (listeners[event.type] ?? []).forEach((fn) => fn(event)),
    activeScreens: () => sections.filter((s) => s.classes.has('is-active')).map((s) => s.dataset.screen),
    bodyIsFirstPaint: () => bodyClasses.has('is-first-paint'),
  };
}

test('initRouter activates exactly one screen and reports it', () => {
  const doc = fakeDoc(['entry', 'queue']);
  const router = initRouter(doc, 'entry');
  assert.deepEqual(doc.activeScreens(), ['entry']);
  assert.equal(router.current(), 'entry');
  assert.deepEqual(router.ids(), ['entry', 'queue']);
});

test('showing a screen swaps the active one rather than adding to it', () => {
  const doc = fakeDoc(['entry', 'queue']);
  const router = initRouter(doc, 'entry');
  router.show('queue');
  assert.deepEqual(doc.activeScreens(), ['queue']);
});

test('is-first-paint survives the first screen and is dropped on the second', () => {
  const doc = fakeDoc(['entry', 'queue']);
  const router = initRouter(doc, 'entry');
  assert.equal(doc.bodyIsFirstPaint(), true, 'the first screen must keep its arrival animation');
  router.show('queue');
  assert.equal(doc.bodyIsFirstPaint(), false, 'later screen changes must not animate');
});

test('screenchange announces the screen that became active', () => {
  const doc = fakeDoc(['entry', 'queue']);
  const seen = [];
  const router = initRouter(doc, 'entry');
  doc.addEventListener('screenchange', (event) => seen.push(event.detail.id));
  router.show('queue');
  assert.deepEqual(seen, ['queue']);
});

test('initRouter honours a screen named in the location hash', () => {
  const doc = fakeDoc(['entry', 'queue']);
  doc.defaultView.location.hash = '#queue';
  const router = initRouter(doc, 'entry');
  assert.equal(router.current(), 'queue');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test preview/tests/units.test.mjs`
Expected: FAIL — `ERR_MODULE_NOT_FOUND` for `../js/router.js`.

- [ ] **Step 3: Write `preview/js/router.js`**

```js
export function resolveScreen(screenIds, target) {
  if (!screenIds.includes(target)) {
    throw new Error(`Unknown screen: ${target}`);
  }
  return target;
}

export function initRouter(doc, initial) {
  const sections = [...doc.querySelectorAll('[data-screen]')];
  const ids = sections.map((s) => s.dataset.screen);
  let current = null;
  let painted = false;

  function show(id) {
    const next = resolveScreen(ids, id);
    // The arrival animation belongs to the first paint only.
    if (painted) doc.body.classList.remove('is-first-paint');
    painted = true;
    for (const section of sections) {
      section.classList.toggle('is-active', section.dataset.screen === next);
    }
    current = next;
    doc.defaultView.location.hash = next;
    doc.dispatchEvent(new CustomEvent('screenchange', { detail: { id: next } }));
  }

  doc.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-goto]');
    if (!trigger) return;
    event.preventDefault();
    show(trigger.dataset.goto);
  });

  const fromHash = doc.defaultView.location.hash.slice(1);
  show(ids.includes(fromHash) ? fromHash : (initial ?? ids[0]));

  return { show, current: () => current, ids: () => [...ids] };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test preview/tests/units.test.mjs`
Expected: PASS — 8 tests.

- [ ] **Step 5: Commit**

```bash
git add preview/js/router.js preview/tests/units.test.mjs
git commit -m "feat(preview): screen router with unknown-screen guard"
```

---

### Task 3: Prototype rail

**Files:**
- Create: `preview/js/rail.js`
- Modify: `preview/tests/units.test.mjs`

**Interfaces:**
- Consumes: `resolveScreen` from Task 2; `.rail`, `.rail__group`, `.rail__label`, `.rail__btn` from Task 1.
- Produces:
  - `buildRailModel(groups, screenIds)` — `groups` is `[{ label: string, items: [{ id: string, label: string, kind: 'screen' | 'state' }] }]`. Returns the same shape, validated. Throws if any `item.id` is not in `screenIds`.
  - `renderRail(doc, model, router)` — appends a `<nav class="rail">` to `doc.body` and keeps `aria-current` in sync with `screenchange`.

- [ ] **Step 1: Write the failing test**

Append to `preview/tests/units.test.mjs`:

```js
import { buildRailModel } from '../js/rail.js';

const GROUPS = [
  { label: 'Flow', items: [{ id: 'entry', label: 'Entry', kind: 'screen' }] },
  { label: 'States', items: [{ id: 'red-flag', label: '999', kind: 'state' }] },
];

test('buildRailModel passes through groups whose ids all exist', () => {
  const model = buildRailModel(GROUPS, ['entry', 'red-flag']);
  assert.equal(model.length, 2);
  assert.equal(model[1].items[0].kind, 'state');
});

test('buildRailModel throws when a rail item references a missing screen', () => {
  assert.throws(
    () => buildRailModel(GROUPS, ['entry']),
    /Unknown screen: red-flag/,
  );
});

test('buildRailModel rejects an unknown item kind', () => {
  const bad = [{ label: 'Flow', items: [{ id: 'entry', label: 'Entry', kind: 'wat' }] }];
  assert.throws(() => buildRailModel(bad, ['entry']), /Unknown rail kind: wat/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test preview/tests/units.test.mjs`
Expected: FAIL — `ERR_MODULE_NOT_FOUND` for `../js/rail.js`.

- [ ] **Step 3: Write `preview/js/rail.js`**

```js
import { resolveScreen } from './router.js';

const KINDS = new Set(['screen', 'state']);

export function buildRailModel(groups, screenIds) {
  return groups.map((group) => ({
    label: group.label,
    items: group.items.map((item) => {
      if (!KINDS.has(item.kind)) {
        throw new Error(`Unknown rail kind: ${item.kind}`);
      }
      resolveScreen(screenIds, item.id);
      return { ...item };
    }),
  }));
}

export function renderRail(doc, model, router) {
  const nav = doc.createElement('nav');
  nav.className = 'rail';
  nav.setAttribute('aria-label', 'Prototype navigation');

  for (const group of model) {
    const wrap = doc.createElement('div');
    wrap.className = 'rail__group';

    const label = doc.createElement('span');
    label.className = 'rail__label';
    label.textContent = group.label;
    wrap.append(label);

    for (const item of group.items) {
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'rail__btn';
      btn.dataset.goto = item.id;
      btn.dataset.kind = item.kind;
      btn.textContent = item.label;
      wrap.append(btn);
    }
    nav.append(wrap);
  }

  doc.body.append(nav);

  const sync = (id) => {
    for (const btn of nav.querySelectorAll('.rail__btn')) {
      btn.setAttribute('aria-current', String(btn.dataset.goto === id));
    }
  };
  doc.addEventListener('screenchange', (event) => sync(event.detail.id));
  sync(router.current());
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test preview/tests/units.test.mjs`
Expected: PASS — 11 tests.

- [ ] **Step 5: Commit**

```bash
git add preview/js/rail.js preview/tests/units.test.mjs
git commit -m "feat(preview): prototype rail with missing-screen validation"
```

---

### Task 4: Live values

**Files:**
- Create: `preview/js/live.js`
- Modify: `preview/tests/units.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `formatEta(seconds: number): string` — `"under a minute"` below 60; `"about N minutes"` otherwise, rounding up.
  - `tickCountdown(state: {remaining: number}): {remaining: number, expired: boolean}` — decrements to a floor of 0; `expired` is true at 0.
  - `tickQueue(state: {position: number, etaSeconds: number}): {position: number, etaSeconds: number}` — drops `etaSeconds` by 1 to a floor of 0, and decrements `position` to a floor of 1 each time `etaSeconds` crosses a multiple of 45.
  - `startInterval(fn, ms, win = globalThis): () => void` — returns a stop function. Never runs when `win.matchMedia('(prefers-reduced-motion: reduce)').matches` is true and `ms < 1000`.

- [ ] **Step 1: Write the failing test**

Append to `preview/tests/units.test.mjs`:

```js
import { formatEta, tickCountdown, tickQueue } from '../js/live.js';

test('formatEta reads naturally under a minute', () => {
  assert.equal(formatEta(0), 'under a minute');
  assert.equal(formatEta(59), 'under a minute');
});

test('formatEta rounds up to whole minutes', () => {
  assert.equal(formatEta(60), 'about 1 minute');
  assert.equal(formatEta(61), 'about 2 minutes');
  assert.equal(formatEta(300), 'about 5 minutes');
});

test('tickCountdown decrements and floors at zero', () => {
  assert.deepEqual(tickCountdown({ remaining: 45 }), { remaining: 44, expired: false });
  assert.deepEqual(tickCountdown({ remaining: 1 }), { remaining: 0, expired: true });
  assert.deepEqual(tickCountdown({ remaining: 0 }), { remaining: 0, expired: true });
});

test('tickQueue advances position only when eta crosses a 45s boundary', () => {
  assert.deepEqual(tickQueue({ position: 3, etaSeconds: 100 }), { position: 3, etaSeconds: 99 });
  assert.deepEqual(tickQueue({ position: 3, etaSeconds: 91 }), { position: 2, etaSeconds: 90 });
  assert.deepEqual(tickQueue({ position: 3, etaSeconds: 46 }), { position: 2, etaSeconds: 45 });
});

test('tickQueue never drops below position 1 or a zero eta', () => {
  assert.deepEqual(tickQueue({ position: 1, etaSeconds: 46 }), { position: 1, etaSeconds: 45 });
  assert.deepEqual(tickQueue({ position: 1, etaSeconds: 0 }), { position: 1, etaSeconds: 0 });
});

// Zero is a multiple of 45, so without an explicit guard the queue would
// advance one last time as the wait hits zero. Position 1 hides this behind
// the floor, so this case must use a higher position.
test('tickQueue does not advance position when the wait reaches zero', () => {
  assert.deepEqual(tickQueue({ position: 3, etaSeconds: 1 }), { position: 3, etaSeconds: 0 });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test preview/tests/units.test.mjs`
Expected: FAIL — `ERR_MODULE_NOT_FOUND` for `../js/live.js`.

- [ ] **Step 3: Write `preview/js/live.js`**

```js
export function formatEta(seconds) {
  if (seconds < 60) return 'under a minute';
  const minutes = Math.ceil(seconds / 60);
  return `about ${minutes} minute${minutes === 1 ? '' : 's'}`;
}

export function tickCountdown(state) {
  const remaining = Math.max(0, state.remaining - 1);
  return { remaining, expired: remaining === 0 };
}

export function tickQueue(state) {
  const etaSeconds = Math.max(0, state.etaSeconds - 1);
  const crossed = etaSeconds > 0 && etaSeconds % 45 === 0;
  const position = crossed ? Math.max(1, state.position - 1) : state.position;
  return { position, etaSeconds };
}

export function startInterval(fn, ms, win = globalThis) {
  const reduced = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  if (reduced && ms < 1000) {
    fn();
    return () => {};
  }
  const id = win.setInterval(fn, ms);
  return () => win.clearInterval(id);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test preview/tests/units.test.mjs`
Expected: PASS — 17 tests.

- [ ] **Step 5: Commit**

```bash
git add preview/js/live.js preview/tests/units.test.mjs
git commit -m "feat(preview): live queue, countdown and eta helpers"
```

---

### Task 5: Fixtures

**Files:**
- Create: `preview/js/fixtures.js`
- Modify: `preview/tests/constraints.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces named exports used by Tasks 6–8:
  - `PRICE = { amount: '£39', note: string }`
  - `PATIENT = { presentingComplaint, ageBand, nhsGpConsent, nhsPractice }`
  - `QUEUE = { position, etaSeconds }`
  - `OFFER = { windowSeconds: 45, presentingComplaint, ageBand, nhsGpConsent }`
  - `GPS: Array<{ ref, credentials: { gmc, licence, cct, dbs, rightToWork, indemnity, revalidation }, online }>` where every credential is `{ status: 'valid' | 'expiring' | 'expired' | 'pending', daysRemaining: number | null }`
  - `FLOOR = { waiting, gpsOnline, gpsNeeded, inProgress, offersDeclined, offersTimedOut, failedMatches, noShows }`
  - `GOVERNANCE = { incidents, safeguarding, redFlagEscalations, complaints, breakGlass, restrictedRegister }`
  - `BUSINESS = { cac: { actual, assumption }, repeatRate: { actual, assumption }, consults, revenue, refunds, waitlist }`

- [ ] **Step 1: Write the failing test**

Append to `preview/tests/constraints.test.mjs`:

```js
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

test('business fixtures pair each headline number with its plan assumption', () => {
  assert.ok(Number.isFinite(FIXTURES.BUSINESS.cac.actual));
  assert.ok(Number.isFinite(FIXTURES.BUSINESS.cac.assumption));
  assert.ok(Number.isFinite(FIXTURES.BUSINESS.repeatRate.actual));
  assert.ok(Number.isFinite(FIXTURES.BUSINESS.repeatRate.assumption));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test preview/tests/constraints.test.mjs`
Expected: FAIL — `ERR_MODULE_NOT_FOUND` for `../js/fixtures.js`.

- [ ] **Step 3: Write `preview/js/fixtures.js`**

Numbers are deliberately round and small so no screenshot reads as traction.

```js
export const PRICE = {
  amount: '£39',
  note: 'Covers the consultation and writing any prescription you need. '
      + 'The pharmacy charges separately for the medicine itself.',
};

export const PATIENT = {
  presentingComplaint: 'Sore throat and fever, three days',
  ageBand: '30–39',
  nhsGpConsent: true,
  nhsPractice: 'Example Medical Centre, London',
};

export const QUEUE = { position: 3, etaSeconds: 135 };

export const OFFER = {
  windowSeconds: 45,
  presentingComplaint: 'Sore throat and fever, three days',
  ageBand: '30–39',
  nhsGpConsent: true,
};

const credential = (status, daysRemaining = null) => ({ status, daysRemaining });

export const GPS = [
  {
    ref: 'GP-001',
    online: true,
    credentials: {
      gmc: credential('valid', 300),
      licence: credential('valid', 300),
      cct: credential('valid', null),
      dbs: credential('valid', 200),
      rightToWork: credential('valid', null),
      indemnity: credential('valid', 180),
      revalidation: credential('valid', 400),
    },
  },
  {
    ref: 'GP-002',
    online: true,
    credentials: {
      gmc: credential('valid', 250),
      licence: credential('valid', 250),
      cct: credential('valid', null),
      dbs: credential('expiring', 12),
      rightToWork: credential('valid', null),
      indemnity: credential('expiring', 9),
      revalidation: credential('valid', 120),
    },
  },
  {
    ref: 'GP-003',
    online: false,
    credentials: {
      gmc: credential('valid', 150),
      licence: credential('valid', 150),
      cct: credential('valid', null),
      dbs: credential('valid', 90),
      rightToWork: credential('valid', null),
      indemnity: credential('expired', 0),
      revalidation: credential('valid', 60),
    },
  },
  {
    ref: 'GP-004',
    online: false,
    credentials: {
      gmc: credential('pending', null),
      licence: credential('pending', null),
      cct: credential('pending', null),
      dbs: credential('pending', null),
      rightToWork: credential('valid', null),
      indemnity: credential('pending', null),
      revalidation: credential('pending', null),
    },
  },
];

export const FLOOR = {
  waiting: 4,
  gpsOnline: 2,
  gpsNeeded: 3,
  inProgress: 2,
  offersDeclined: 3,
  offersTimedOut: 1,
  failedMatches: 1,
  noShows: 0,
};

export const GOVERNANCE = {
  incidents: 2,
  safeguarding: 1,
  redFlagEscalations: 3,
  complaints: 1,
  breakGlass: 1,
  restrictedRegister: [
    { category: 'Schedule 2 controlled drugs', status: 'Prohibited platform-wide', breaches: 0 },
    { category: 'Schedule 3 controlled drugs', status: 'Prohibited platform-wide', breaches: 0 },
    { category: 'Items needing monitoring', status: 'Records access required', breaches: 1 },
  ],
};

export const BUSINESS = {
  cac: { actual: 42, assumption: 16 },
  repeatRate: { actual: 1.1, assumption: 1.8 },
  consults: 120,
  revenue: 4680,
  refunds: 3,
  waitlist: { patients: 210, gps: 34 },
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test preview/tests/constraints.test.mjs`
Expected: PASS — 12 tests.

- [ ] **Step 5: Commit**

```bash
git add preview/js/fixtures.js preview/tests/constraints.test.mjs
git commit -m "feat(preview): synthetic fixtures with compliance guards"
```

---

### Task 6: Patient surface

**Files:**
- Create: `preview/patient.html`
- Create: `preview/css/components.css`
- Create: `preview/tests/structure.test.mjs`

**Interfaces:**
- Consumes: `initRouter` (Task 2), `buildRailModel` / `renderRail` (Task 3), `formatEta` / `tickQueue` / `startInterval` (Task 4), `PRICE` / `PATIENT` / `QUEUE` (Task 5).
- Produces: `preview/css/components.css` exposing `.shell`, `.card`, `.stat`, `.pill`, `.table`, `.field`, `.stepper`, `.videoframe`, `.btn`, `.btn--primary` for Tasks 7 and 8.

- [ ] **Step 1: Write the failing test**

Create `preview/tests/structure.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

function screenIds(html) {
  return [...html.matchAll(/data-screen="([^"]+)"/g)].map((m) => m[1]);
}
function gotoTargets(html) {
  return [...html.matchAll(/data-goto="([^"]+)"/g)].map((m) => m[1]);
}

const PATIENT_SCREENS = [
  'entry', 'symptoms', 'safety-check', 'identity', 'nhs-gp',
  'price-wait', 'queue', 'doctor-ready', 'consultation', 'outcome', 'done',
];

const PATIENT_STATES = [
  'red-flag', 'consent-refused', 'no-gp-available',
  'cancelled', 'payment-failed', 'consult-ended-early',
];

test('patient page defines every screen in the flow', () => {
  const ids = screenIds(read('patient.html'));
  for (const id of PATIENT_SCREENS) {
    assert.ok(ids.includes(id), `patient.html is missing screen: ${id}`);
  }
});

test('patient page defines every state on the rail', () => {
  const ids = screenIds(read('patient.html'));
  for (const id of PATIENT_STATES) {
    assert.ok(ids.includes(id), `patient.html is missing state: ${id}`);
  }
});

test('every patient data-goto target resolves to a screen on the same page', () => {
  const html = read('patient.html');
  const ids = new Set(screenIds(html));
  for (const target of gotoTargets(html)) {
    assert.ok(ids.has(target), `patient.html links to missing screen: ${target}`);
  }
});

test('the red-flag screen offers a real 999 call link', () => {
  const html = read('patient.html');
  const section = html.split('data-screen="red-flag"')[1] ?? '';
  assert.match(section.slice(0, 2000), /href="tel:999"/, 'red-flag screen has no tel:999 link');
});

test('the price screen discloses that the pharmacy charges separately', () => {
  const html = read('patient.html');
  const section = html.split('data-screen="price-wait"')[1] ?? '';
  assert.match(section.slice(0, 2000), /pharmacy/i);
});

// The wedge is "minutes instead of hours", so the wait is half the decision.
// A patient must not commit to the price and only then discover the queue.
test('the price screen shows the estimated wait beside the price', () => {
  const html = read('patient.html');
  const section = html.split('data-screen="price-wait"')[1] ?? '';
  assert.match(section.slice(0, 2000), /data-price-eta/, 'the price screen shows no estimated wait');
});

test('the no-gp-available state says the hold is released', () => {
  const html = read('patient.html');
  const section = html.split('data-screen="no-gp-available"')[1] ?? '';
  assert.match(section.slice(0, 2000), /released/i);
});

test('the consultation screen states the call is not recorded', () => {
  const html = read('patient.html');
  const section = html.split('data-screen="consultation"')[1] ?? '';
  assert.match(section.slice(0, 2000), /not recorded/i);
});

test('the safety check shows no urgency score', () => {
  const html = read('patient.html').toLowerCase();
  for (const word of ['urgency score', 'triage score', 'severity score', 'risk score']) {
    assert.ok(!html.includes(word), `patient.html shows an urgency score: ${word}`);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test preview/tests/structure.test.mjs`
Expected: FAIL — `ENOENT` for `patient.html`.

- [ ] **Step 3: Write `preview/css/components.css`**

Severity is carried by fill and weight, never by hue — this is what keeps the palette guard in Task 1 passing.

```css
.shell { max-width: 480px; margin: 0 auto; padding: var(--s-6) var(--s-4) var(--s-16); }
.shell--wide { max-width: 1180px; padding-inline: var(--s-6); }

.card {
  border: 1px solid var(--tile-edge);
  border-radius: var(--r-tile);
  padding: var(--s-6);
  background: var(--white);
}
.card--fill { background: var(--black); color: var(--white); border-color: var(--black); }

.btn {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: 52px; padding: 0 var(--s-6);
  border: 1px solid var(--black); border-radius: var(--r-control);
  background: var(--white); color: var(--black);
  font: inherit; font-weight: 700; cursor: pointer;
}
.btn--primary { background: var(--black); color: var(--white); }
.btn--block { width: 100%; }

.field { display: grid; gap: var(--s-2); margin-block: var(--s-4); }
.field > label { font-weight: 700; }
.field > input, .field > select, .field > textarea {
  min-height: 52px; padding: 0 var(--s-3); font: inherit;
  border: 1px solid var(--tile-edge); border-radius: var(--r-control);
  background: var(--white); color: var(--black);
}

.stepper { display: flex; gap: var(--s-1); margin-bottom: var(--s-6); }
.stepper > span { flex: 1; height: 3px; background: var(--fill-2); }
.stepper > span[data-done="true"] { background: var(--black); }

.stat { display: grid; gap: var(--s-1); }
.stat__value { font-size: 34px; font-weight: 800; letter-spacing: -.03em; }
.stat__label { color: var(--ink-2); font-size: 13px; }
.stat__against { color: var(--ink-2); font-size: 13px; }

.pill {
  display: inline-block; padding: 2px var(--s-2);
  border: 1px solid var(--black); border-radius: 999px;
  font-size: 12px; font-weight: 700;
}
.pill[data-status="valid"]    { border-color: var(--tile-edge); color: var(--ink-2); }
.pill[data-status="pending"]  { border-style: dashed; color: var(--ink-2); }
.pill[data-status="expiring"] { border-color: var(--black); color: var(--black); }
.pill[data-status="expired"]  { background: var(--black); color: var(--white); }

.table { width: 100%; border-collapse: collapse; font-size: 14px; }
.table th, .table td { text-align: left; padding: var(--s-3); border-bottom: 1px solid var(--rule); }
.table th { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--ink-2); }
.table tr[data-severity="high"] td { background: var(--fill); font-weight: 700; }

.videoframe {
  aspect-ratio: 3 / 4; border-radius: var(--r-tile);
  background: var(--fill); border: 1px solid var(--tile-edge);
  display: grid; place-items: center; color: var(--ink-2);
}

.countdown { font-variant-numeric: tabular-nums; font-weight: 800; font-size: 40px; }
```

- [ ] **Step 4: Write `preview/patient.html`**

Use this head, ribbon and module block verbatim, then author the eleven screens and six states listed in the test. Every `<section>` follows the pattern shown for `entry` and `red-flag`.

```html
<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Dr Quick — patient prototype</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/preview/css/base.css">
<link rel="stylesheet" href="/preview/css/components.css">
</head>
<body class="is-first-paint">
<p class="ribbon">Prototype. Not a live service — no real patients, GPs, or data.</p>

<main class="shell">

  <section data-screen="entry">
    <h1 data-reveal>Feel unwell? See a GP now.</h1>
    <p data-reveal style="color:var(--ink-2)">England only. Not for emergencies.</p>
    <button class="btn btn--primary btn--block" data-goto="symptoms" data-reveal>See a GP now</button>
    <p style="margin-top:var(--s-6)">
      If this is an emergency, <a href="tel:999">call 999</a> or go to A&amp;E.
    </p>
  </section>

  <section data-screen="red-flag">
    <h1 data-reveal>Call 999 now</h1>
    <p data-reveal>What you have described needs emergency care, not a video consultation.</p>
    <a class="btn btn--primary btn--block" href="tel:999" data-reveal>Call 999</a>
    <p style="margin-top:var(--s-4)">Or go to your nearest A&amp;E.</p>
  </section>

  <!-- Remaining screens follow the same pattern, one <section data-screen="…"> each:
       symptoms · safety-check · identity · nhs-gp · price-wait · queue ·
       doctor-ready · consultation · outcome · done
       and the states: consent-refused · no-gp-available · cancelled ·
       payment-failed · consult-ended-early
       Required content per screen is asserted in preview/tests/structure.test.mjs. -->

</main>

<script type="module">
  import { initRouter } from '/preview/js/router.js';
  import { buildRailModel, renderRail } from '/preview/js/rail.js';
  import { formatEta, tickQueue, startInterval } from '/preview/js/live.js';
  import { PRICE, QUEUE } from '/preview/js/fixtures.js';

  const router = initRouter(document, 'entry');

  renderRail(document, buildRailModel([
    { label: 'Flow', items: [
      { id: 'entry', label: 'Entry', kind: 'screen' },
      { id: 'symptoms', label: 'Symptoms', kind: 'screen' },
      { id: 'safety-check', label: 'Safety', kind: 'screen' },
      { id: 'identity', label: 'ID', kind: 'screen' },
      { id: 'nhs-gp', label: 'NHS GP', kind: 'screen' },
      { id: 'price-wait', label: 'Price', kind: 'screen' },
      { id: 'queue', label: 'Queue', kind: 'screen' },
      { id: 'doctor-ready', label: 'Ready', kind: 'screen' },
      { id: 'consultation', label: 'Consult', kind: 'screen' },
      { id: 'outcome', label: 'Outcome', kind: 'screen' },
      { id: 'done', label: 'Done', kind: 'screen' },
    ] },
    { label: 'States', items: [
      { id: 'red-flag', label: '999', kind: 'state' },
      { id: 'consent-refused', label: 'Consent refused', kind: 'state' },
      { id: 'no-gp-available', label: 'No GP', kind: 'state' },
      { id: 'cancelled', label: 'Cancelled', kind: 'state' },
      { id: 'payment-failed', label: 'Payment failed', kind: 'state' },
      { id: 'consult-ended-early', label: 'Ended early', kind: 'state' },
    ] },
  ], router.ids()), router);

  document.querySelector('[data-price-note]').textContent = PRICE.note;
  document.querySelector('[data-price-eta]').textContent = formatEta(QUEUE.etaSeconds);

  let queue = { ...QUEUE };
  const position = document.querySelector('[data-queue-position]');
  const eta = document.querySelector('[data-queue-eta]');
  startInterval(() => {
    queue = tickQueue(queue);
    position.textContent = String(queue.position);
    eta.textContent = formatEta(queue.etaSeconds);
  }, 1000);
</script>
</body>
</html>
```

Screen requirements, each asserted by the test in Step 1:

| Screen | Must contain |
|---|---|
| `symptoms` | A structured question set plus one free-text field. No urgency wording. |
| `safety-check` | Red-flag questions, two outcomes: `data-goto="identity"` and `data-goto="red-flag"`. |
| `identity` | Stripe Identity handoff copy; photo ID, not a card. |
| `nhs-gp` | Practice fields and a consent choice with `data-goto="price-wait"` and `data-goto="consent-refused"`. |
| `price-wait` | `£39`, an element with `data-price-note`, the words "authorised" and "taken when a GP accepts", and an element with `data-price-eta` carrying the estimated wait — the patient decides on price and wait together, not price first. |
| `queue` | `[data-queue-position]`, `[data-queue-eta]` with `aria-live="polite"`, and a visible cancel to `cancelled`. |
| `doctor-ready` | Interrupt copy and a single button to `consultation`. |
| `consultation` | `.videoframe`, a timer, and the words "not recorded". |
| `outcome` | "your prescription", referral and fit-note lines, and the consent outcome. No medicine named. |
| `done` | Closing confirmation. |
| `consent-refused` | Explains the doctor may be unable to prescribe without records. |
| `no-gp-available` | The word "released", plus 111 and Pharmacy First signposts. |
| `cancelled` | Confirms the hold is released. |
| `payment-failed` | Retry to `price-wait`. |
| `consult-ended-early` | Route back to `outcome`. |

- [ ] **Step 5: Run all tests to verify they pass**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test 'preview/tests/*.test.mjs'`
Expected: PASS — 38 tests, 0 failures.

- [ ] **Step 6: Verify visually**

```bash
python3 -m http.server 8000 &
SERVER=$!
CHROME=$(ls -d ~/.cache/puppeteer/chrome-headless-shell/*/chrome-headless-shell-mac-arm64/chrome-headless-shell | tail -1)
mkdir -p /tmp/preview-shots
for screen in entry symptoms safety-check identity nhs-gp price-wait queue doctor-ready consultation outcome done red-flag consent-refused no-gp-available cancelled payment-failed consult-ended-early; do
  "$CHROME" --headless --window-size=390,844 --screenshot=/tmp/preview-shots/patient-390-$screen.png "http://localhost:8000/preview/patient.html#$screen"
  "$CHROME" --headless --window-size=1440,900 --screenshot=/tmp/preview-shots/patient-1440-$screen.png "http://localhost:8000/preview/patient.html#$screen"
done
kill $SERVER
```

Open every PNG and check: the ribbon is present, the rail is present and does not cover content, type is Archivo, nothing is off-palette, and the 390px screens have no horizontal scroll.

- [ ] **Step 7: Commit**

```bash
git add preview/patient.html preview/css/components.css preview/tests/structure.test.mjs
git commit -m "feat(preview): patient surface with all screens and states"
```

---

### Task 7: Doctor surface

**Files:**
- Create: `preview/doctor.html`
- Modify: `preview/css/components.css`
- Modify: `preview/tests/structure.test.mjs`

**Interfaces:**
- Consumes: everything Task 6 produced, plus `tickCountdown` (Task 4) and `GPS` / `OFFER` (Task 5).
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Write the failing test**

Append to `preview/tests/structure.test.mjs`:

```js
const DOCTOR_SCREENS = [
  'register', 'identity', 'credentials', 'indemnity', 'skills', 'onboarding-done',
  'offline', 'online-idle', 'offer', 'consultation', 'complete',
];

const DOCTOR_STATES = [
  'verification-pending', 'verification-rejected', 'indemnity-expired',
  'offer-declined', 'offer-timed-out', 'patient-no-show',
  'revalidation-due', 'no-patients-waiting',
];

test('doctor page defines every onboarding and shift screen', () => {
  const ids = screenIds(read('doctor.html'));
  for (const id of DOCTOR_SCREENS) {
    assert.ok(ids.includes(id), `doctor.html is missing screen: ${id}`);
  }
});

test('doctor page defines every state on the rail', () => {
  const ids = screenIds(read('doctor.html'));
  for (const id of DOCTOR_STATES) {
    assert.ok(ids.includes(id), `doctor.html is missing state: ${id}`);
  }
});

test('every doctor data-goto target resolves to a screen on the same page', () => {
  const html = read('doctor.html');
  const ids = new Set(screenIds(html));
  for (const target of gotoTargets(html)) {
    assert.ok(ids.has(target), `doctor.html links to missing screen: ${target}`);
  }
});

test('expired indemnity disables going online', () => {
  const html = read('doctor.html');
  const section = html.split('data-screen="indemnity-expired"')[1] ?? '';
  const slice = section.slice(0, 2000);
  assert.match(slice, /disabled/, 'the go-online control is not disabled');
  assert.match(slice, /indemnity/i);
});

test('the offer screen shows only pre-acceptance information', () => {
  const html = read('doctor.html');
  const slice = (html.split('data-screen="offer"')[1] ?? '').slice(0, 2000);
  assert.match(slice, /data-offer-countdown/, 'the 45-second window is not shown');
  assert.match(slice, /aria-live="assertive"/, 'the countdown is not announced');
  assert.ok(!/full record|clinical history|past consultations/i.test(slice),
    'the offer screen leaks post-acceptance information');
});

// The handoff and the completion are different acts: a GP opens Semble during
// a consultation, possibly repeatedly, and finishes it once at the end. Fusing
// them under one label makes the handoff look frictionless, which is precisely
// the question this prototype exists to answer honestly.
test('the Semble handoff does not double as finishing the consultation', () => {
  const html = read('doctor.html');
  const section = html.split('data-screen="consultation"')[1].split('</section>')[0];
  const controls = [...section.matchAll(/<(?:a|button)[^>]*data-goto="([^"]+)"[^>]*>([\s\S]*?)<\/(?:a|button)>/g)]
    .map(([, target, label]) => ({ target, label: label.replace(/<[^>]+>/g, '').trim() }));
  const completer = controls.find((control) => control.target === 'complete');
  assert.ok(completer, 'no control finishes the consultation');
  assert.ok(
    !/semble/i.test(completer.label),
    `the control that finishes the consultation is labelled "${completer.label}" — `
      + 'the handoff and the completion must be separate actions',
  );
});

test('the doctor consultation screen hands off to the clinical record system', () => {
  const html = read('doctor.html');
  const slice = (html.split('data-screen="consultation"')[1] ?? '').slice(0, 2500);
  assert.match(slice, /Semble/, 'no clinical-record handoff is shown');
  assert.ok(!/<textarea[^>]*data-notes/.test(slice),
    'the doctor surface must not contain an in-app notes editor');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test preview/tests/structure.test.mjs`
Expected: FAIL — `ENOENT` for `doctor.html`.

- [ ] **Step 3: Add the doctor components to `preview/css/components.css`**

```css
/* Native controls otherwise paint with the browser's own accent, which is a
   fourth colour the palette forbids in rendered output. */
input[type="checkbox"], input[type="radio"], progress, select { accent-color: var(--blue); }

.appbar {
  display: flex; align-items: center; justify-content: space-between;
  gap: var(--s-4); padding: var(--s-3) var(--s-6);
  border-bottom: 1px solid var(--rule);
}

.toggle {
  display: inline-flex; align-items: center; gap: var(--s-2);
  min-height: 44px; padding: 0 var(--s-4);
  border: 1px solid var(--black); border-radius: 999px;
  background: var(--white); color: var(--black);
  font: inherit; font-weight: 700; cursor: pointer;
}
.toggle[aria-pressed="true"] { background: var(--black); color: var(--white); }
.toggle[disabled] { border-color: var(--tile-edge); color: var(--ink-2); cursor: not-allowed; }

.grid { display: grid; gap: var(--s-4); }
.grid--3 { grid-template-columns: repeat(3, 1fr); }
.grid--4 { grid-template-columns: repeat(4, 1fr); }

.gate { display: flex; justify-content: space-between; gap: var(--s-4); padding: var(--s-4) 0; border-bottom: 1px solid var(--rule); }

@media (max-width: 900px) {
  .grid--3, .grid--4 { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 560px) {
  .grid--3, .grid--4 { grid-template-columns: 1fr; }
}
```

- [ ] **Step 4: Write `preview/doctor.html`**

Same head, ribbon and module pattern as `patient.html`, with `.shell--wide`, plus:

```html
<script type="module">
  import { initRouter } from '/preview/js/router.js';
  import { buildRailModel, renderRail } from '/preview/js/rail.js';
  import { tickCountdown, startInterval } from '/preview/js/live.js';
  import { OFFER } from '/preview/js/fixtures.js';

  const router = initRouter(document, 'offline');

  renderRail(document, buildRailModel([
    { label: 'Onboarding', items: [
      { id: 'register', label: 'Register', kind: 'screen' },
      { id: 'identity', label: 'Identity', kind: 'screen' },
      { id: 'credentials', label: 'Credentials', kind: 'screen' },
      { id: 'indemnity', label: 'Indemnity', kind: 'screen' },
      { id: 'skills', label: 'Skills', kind: 'screen' },
      { id: 'onboarding-done', label: 'Done', kind: 'screen' },
    ] },
    { label: 'Shift', items: [
      { id: 'offline', label: 'Offline', kind: 'screen' },
      { id: 'online-idle', label: 'Online', kind: 'screen' },
      { id: 'offer', label: 'Offer', kind: 'screen' },
      { id: 'consultation', label: 'Consult', kind: 'screen' },
      { id: 'complete', label: 'Complete', kind: 'screen' },
    ] },
    { label: 'States', items: [
      { id: 'verification-pending', label: 'Pending', kind: 'state' },
      { id: 'verification-rejected', label: 'Rejected', kind: 'state' },
      { id: 'indemnity-expired', label: 'Indemnity expired', kind: 'state' },
      { id: 'offer-declined', label: 'Declined', kind: 'state' },
      { id: 'offer-timed-out', label: 'Timed out', kind: 'state' },
      { id: 'patient-no-show', label: 'No-show', kind: 'state' },
      { id: 'revalidation-due', label: 'Revalidation', kind: 'state' },
      { id: 'no-patients-waiting', label: 'Nobody waiting', kind: 'state' },
    ] },
  ], router.ids()), router);

  let offer = { remaining: OFFER.windowSeconds };
  const counter = document.querySelector('[data-offer-countdown]');
  let stop = () => {};
  document.addEventListener('screenchange', (event) => {
    stop();
    if (event.detail.id !== 'offer') return;
    offer = { remaining: OFFER.windowSeconds };
    stop = startInterval(() => {
      offer = tickCountdown(offer);
      counter.textContent = `${offer.remaining}s`;
      if (offer.expired) { stop(); router.show('offer-timed-out'); }
    }, 1000);
  });
</script>
```

Screen requirements, each asserted by the test in Step 1:

| Screen | Must contain |
|---|---|
| `register` | Email and GMC number fields. |
| `identity` | Photo ID handoff. |
| `credentials` | Five `.gate` rows — GMC, licence, CCT, DBS, right to work — each with a `.pill` carrying `data-status`. |
| `indemnity` | Block cover as the primary path, certificate upload as the alternative, and an expiry date on the upload path. |
| `skills` | Clinical skills selection that drives matching. |
| `onboarding-done` | Route to `offline`. |
| `offline` | Earnings to date, consults completed, credential summary, next revalidation, and a `.toggle` to `online-idle`. |
| `online-idle` | Queue depth, patients waiting, time online, earnings today, `.toggle[aria-pressed="true"]`. |
| `offer` | Presenting complaint, age band, consent flag, `[data-offer-countdown]` with `aria-live="assertive"`, accept and decline. Nothing else. |
| `consultation` | `.videoframe`, patient context panel, and a Semble handoff panel. No `<textarea>`. |
| `complete` | Outcome recorded and payment confirmed. |
| `indemnity-expired` | `.toggle[disabled]` and an explanation naming indemnity. |
| `verification-pending` / `verification-rejected` | Gate statuses; rejected explains the next step. |
| `offer-declined` / `offer-timed-out` | Return to `online-idle`. |
| `patient-no-show` | Return to `online-idle`. |
| `revalidation-due` | Days remaining and what to do. |
| `no-patients-waiting` | Reassurance that the shift is live and nobody is queued. |

- [ ] **Step 5: Run all tests to verify they pass**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test 'preview/tests/*.test.mjs'`
Expected: PASS — 45 tests, 0 failures.

- [ ] **Step 6: Verify visually**

Run the Step 6 loop from Task 6, substituting `doctor.html` and the nineteen doctor screen ids. Check the same list, and additionally confirm the `offer` countdown renders and the `indemnity-expired` toggle is visibly disabled.

- [ ] **Step 7: Commit**

```bash
git add preview/doctor.html preview/css/components.css preview/tests/structure.test.mjs
git commit -m "feat(preview): doctor surface with onboarding, shift and blocking states"
```

---

### Task 8: Admin surface

**Files:**
- Create: `preview/admin.html`
- Modify: `preview/tests/structure.test.mjs`

**Interfaces:**
- Consumes: everything Tasks 6 and 7 produced, plus `GPS`, `FLOOR`, `GOVERNANCE`, `BUSINESS` (Task 5).
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Write the failing test**

Append to `preview/tests/structure.test.mjs`:

```js
const ADMIN_SCREENS = ['floor', 'governance', 'supply', 'business'];

test('admin page defines all four sections', () => {
  const ids = screenIds(read('admin.html'));
  for (const id of ADMIN_SCREENS) {
    assert.ok(ids.includes(id), `admin.html is missing section: ${id}`);
  }
});

test('admin opens on the live floor', () => {
  assert.match(read('admin.html'), /initRouter\(document,\s*'floor'\)/);
});

test('every admin data-goto target resolves to a screen on the same page', () => {
  const html = read('admin.html');
  const ids = new Set(screenIds(html));
  for (const target of gotoTargets(html)) {
    assert.ok(ids.has(target), `admin.html links to missing screen: ${target}`);
  }
});

test('the floor gives failure counters equal weight', () => {
  const slice = (read('admin.html').split('data-screen="floor"')[1] ?? '').slice(0, 3000);
  for (const label of ['declined', 'timed out', 'failed', 'no-show']) {
    assert.ok(slice.toLowerCase().includes(label), `floor is missing counter: ${label}`);
  }
});

test('governance carries a restricted-items register with a breach count', () => {
  const slice = (read('admin.html').split('data-screen="governance"')[1] ?? '').slice(0, 3000);
  assert.match(slice, /restricted/i);
  assert.match(slice, /Schedule 2/);
  assert.match(slice, /Schedule 3/);
  assert.match(slice, /breach/i);
});

test('supply shows credential expiry, not just present-tense status', () => {
  const slice = (read('admin.html').split('data-screen="supply"')[1] ?? '').slice(0, 3000);
  assert.match(slice, /data-status=/, 'no credential status pills');
  assert.match(slice, /days/i, 'no expiry countdown');
});

test('business shows CAC and repeat rate against their assumptions', () => {
  const slice = (read('admin.html').split('data-screen="business"')[1] ?? '').slice(0, 3000);
  assert.match(slice, /CAC/);
  assert.match(slice, /repeat/i);
  assert.match(slice, /class="stat__against"/, 'headline numbers are not shown against assumptions');
});

// fixtures.js is the file the compliance guards actually test. A figure typed
// into the markup is outside that guard and can silently drift from the data.
test('every admin figure comes from the fixtures, not the markup', () => {
  const body = read('admin.html').split('<script')[0];
  const literals = [
    ...[...body.matchAll(/<span class="stat__value[^"]*"[^>]*>([^<]*)<\/span>/g)].map((m) => m[1]),
    ...[...body.matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((m) => m[1]),
  ].map((text) => text.trim()).filter((text) => /\d/.test(text));
  assert.deepEqual(
    literals,
    [],
    'these admin figures are typed into the markup instead of injected from '
      + `fixtures.js: ${literals.join(', ')}`,
  );
});

test('no admin status depends on colour alone', () => {
  const html = read('admin.html');
  for (const attr of [...html.matchAll(/data-status="([^"]+)"/g)]) {
    if (attr[1].includes('${')) continue; // rendered at runtime from fixtures
    assert.ok(
      ['valid', 'pending', 'expiring', 'expired'].includes(attr[1]),
      `unexpected status value: ${attr[1]}`,
    );
  }
  const pills = [...html.matchAll(/<span class="pill"[^>]*>([^<]*)<\/span>/g)];
  assert.ok(pills.length > 0, 'admin.html renders no status pills');
  for (const pill of pills) {
    assert.ok(pill[1].trim().length > 0, 'a status pill carries colour but no text label');
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test preview/tests/structure.test.mjs`
Expected: FAIL — `ENOENT` for `admin.html`.

- [ ] **Step 3: Write `preview/admin.html`**

Same head and ribbon pattern, `.shell--wide`, a left nav of four `data-goto` links, and:

```html
<script type="module">
  import { initRouter } from '/preview/js/router.js';
  import { buildRailModel, renderRail } from '/preview/js/rail.js';
  import { GPS, FLOOR, GOVERNANCE, BUSINESS } from '/preview/js/fixtures.js';

  const router = initRouter(document, 'floor');

  renderRail(document, buildRailModel([
    { label: 'Sections', items: [
      { id: 'floor', label: 'Live floor', kind: 'screen' },
      { id: 'governance', label: 'Governance', kind: 'screen' },
      { id: 'supply', label: 'GP supply', kind: 'screen' },
      { id: 'business', label: 'Business', kind: 'screen' },
    ] },
  ], router.ids()), router);

  const set = (key, value) => {
    const node = document.querySelector(`[data-floor="${key}"]`);
    if (node) node.textContent = String(value);
  };
  for (const [key, value] of Object.entries(FLOOR)) set(key, value);

  const rows = document.querySelector('[data-supply-rows]');
  rows.innerHTML = GPS.map((gp) => {
    const cells = Object.entries(gp.credentials).map(([name, c]) => {
      const days = c.daysRemaining === null ? '—' : `${c.daysRemaining} days`;
      return `<td><span class="pill" data-status="${c.status}">${c.status}</span> ${days}</td>`;
    }).join('');
    const severity = Object.values(gp.credentials).some((c) => c.status === 'expired') ? 'high' : 'normal';
    return `<tr data-severity="${severity}"><th scope="row">${gp.ref}</th>${cells}</tr>`;
  }).join('');

  document.querySelector('[data-register-rows]').innerHTML = GOVERNANCE.restrictedRegister
    .map((r) => `<tr><th scope="row">${r.category}</th><td>${r.status}</td><td>${r.breaches} breaches</td></tr>`)
    .join('');

  document.querySelector('[data-cac]').textContent = `£${BUSINESS.cac.actual}`;
  document.querySelector('[data-cac-against]').textContent = `plan assumed £${BUSINESS.cac.assumption}`;
  document.querySelector('[data-repeat]').textContent = BUSINESS.repeatRate.actual.toFixed(1);
  document.querySelector('[data-repeat-against]').textContent =
    `plan assumed ${BUSINESS.repeatRate.assumption.toFixed(1)}`;
</script>
```

Section requirements, each asserted by the test in Step 1:

| Section | Must contain |
|---|---|
| `floor` | `[data-floor="waiting"]`, `gpsOnline`, `gpsNeeded`, `inProgress`, and the four failure counters — declined, timed out, failed matches, no-shows — as `.stat` tiles of equal size. |
| `governance` | Incident, safeguarding, red-flag-escalation, complaint and break-glass counts; a `.table` with `[data-register-rows]` listing the restricted register including Schedule 2 and Schedule 3 and a breach count; an audit-log table. |
| `supply` | A `.table` with `[data-supply-rows]`, one column per credential, each cell a `.pill[data-status]` plus a days-remaining figure; rows with any expired credential carry `data-severity="high"` and sort to the top. |
| `business` | `.stat` tiles for CAC and repeat rate at the top, each with a `.stat__against` line; then consults, revenue, refunds, and the waitlist split. |

- [ ] **Step 4: Run all tests to verify they pass**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test 'preview/tests/*.test.mjs'`
Expected: PASS — 54 tests, 0 failures.

- [ ] **Step 5: Verify visually**

Run the Step 6 loop from Task 6, substituting `admin.html` and the four section ids. Check that the expired-indemnity row is unmistakable without colour, and that the table scrolls inside its own container at 390px rather than scrolling the page sideways.

- [ ] **Step 6: Commit**

```bash
git add preview/admin.html preview/tests/structure.test.mjs
git commit -m "feat(preview): admin surface — floor, governance, supply and business"
```

---

### Task 9: Full verification pass and README

**Files:**
- Create: `preview/README.md`
- Modify: `preview/tests/structure.test.mjs`

**Interfaces:**
- Consumes: all preceding tasks.
- Produces: the documented commands for running tests and screenshots.

- [ ] **Step 1: Write the failing test**

Append to `preview/tests/structure.test.mjs`:

```js
test('the role picker links to all three surfaces', () => {
  const html = read('index.html');
  for (const page of ['patient.html', 'doctor.html', 'admin.html']) {
    assert.ok(html.includes(page), `index.html does not link to ${page}`);
  }
});

test('no preview page is linked from the live landing page', () => {
  const landing = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  assert.ok(!landing.includes('preview/'), 'the landing page links to the prototype');
});

test('every preview page loads both stylesheets', () => {
  for (const page of ['index.html', 'patient.html', 'doctor.html', 'admin.html']) {
    const html = read(page);
    assert.match(html, /css\/base\.css/, `${page} is missing base.css`);
    if (page !== 'index.html') {
      assert.match(html, /css\/components\.css/, `${page} is missing components.css`);
    }
  }
});

test('the arrival animation is scoped to first paint only', () => {
  for (const page of ['index.html', 'patient.html', 'doctor.html', 'admin.html']) {
    assert.match(read(page), /<body class="is-first-paint">/, `${page} lacks the first-paint flag`);
  }
  assert.match(
    readFileSync(new URL('../css/base.css', import.meta.url), 'utf8'),
    /body\.is-first-paint \[data-screen\]\.is-active \[data-reveal\]/,
    'base.css animates on every screen change, not just first paint',
  );
});
```

- [ ] **Step 2: Run the test to verify it fails or passes**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test preview/tests/structure.test.mjs`
Expected: PASS if the earlier tasks were done correctly. If any fails, fix the page it names before continuing — that is the point of the check.

- [ ] **Step 3: Write `preview/README.md`**

````markdown
# Role prototype

Clickable, non-functional prototype of the patient, doctor and admin surfaces.
Fake data throughout. **Not a live service.**

Spec: `docs/superpowers/specs/2026-08-27-role-dashboards-prototype-design.md`

## Run it

```bash
python3 -m http.server 8000
open http://localhost:8000/preview/
```

Every screen and state is one click away on the rail at the bottom of each page,
or reachable directly by hash — `/preview/patient.html#no-gp-available`.

## Test it

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test 'preview/tests/*.test.mjs'
```

Three suites, no dependencies:

- `constraints.test.mjs` — compliance guards. No medicine named, no surge or
  time-pressure wording, no invented CQC id, no off-palette colour, ribbon and
  noindex on every page.
- `units.test.mjs` — pure functions in `js/`.
- `structure.test.mjs` — every screen and state exists, and every link resolves.

## Screenshot it

```bash
CHROME=$(ls -d ~/.cache/puppeteer/chrome-headless-shell/*/chrome-headless-shell-mac-arm64/chrome-headless-shell | tail -1)
"$CHROME" --headless --window-size=390,844 --screenshot=out.png http://localhost:8000/preview/patient.html#queue
```

Check both 390px and 1440px before calling anything done.

## Rules

`preview/` may not add dependencies or a build step, may not name a medicine,
may not use a colour outside the twelve permitted values, and may not be linked
from the live landing page. The tests enforce all four.
````

- [ ] **Step 4: Run the whole suite one final time**

Run: `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test 'preview/tests/*.test.mjs'`
Expected: PASS — 60 tests, 0 failures.

- [ ] **Step 5: Confirm the landing page is untouched**

Run: `git log --oneline HEAD~8..HEAD -- index.html api/`
Expected: no output — no commit in this series touched the landing page or the API.

- [ ] **Step 6: Commit**

```bash
git add preview/README.md preview/tests/structure.test.mjs
git commit -m "docs(preview): document how to run, test and screenshot the prototype"
```
