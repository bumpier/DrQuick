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

test('a rejected verification uses its own status value, not "expired"', () => {
  const html = read('doctor.html');
  const section = html.split('data-screen="verification-rejected"')[1].split('</section>')[0];
  assert.match(section, /data-status="rejected"/,
    'the rejected DBS check reuses the "expired" status instead of carrying its own');
  const css = readFileSync(new URL('../css/components.css', import.meta.url), 'utf8');
  assert.match(css, /\.pill\[data-status="rejected"\]/, 'components.css has no rule for the rejected status');
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
test('the doctor sees the consent-refused fork, not only the consenting case', () => {
  const html = read('doctor.html');
  const ids = [...html.matchAll(/data-screen="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(ids.includes('offer-consent-refused'),
    'the doctor surface never shows what an offer looks like when consent was refused');
  const section = html.split('data-screen="offer-consent-refused"')[1].split('</section>')[0];
  assert.match(section, /consent/i);
  assert.match(section, /decline|unable to prescribe|without/i,
    'the screen does not explain the consequence of refused consent');
});

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

test('governance attributes prescribing against the register to each prescriber', () => {
  const section = read('admin.html').split('data-screen="governance"')[1].split('</section>')[0];
  assert.match(section, /data-outlier-rows/, 'governance has no per-GP prescribing view');
  assert.match(section, /flagged/i, 'the prescribing view does not show register flags');
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
test('every admin and doctor figure comes from the fixtures, not the markup', () => {
  for (const page of ['admin.html', 'doctor.html']) {
    const body = read(page).split('<script')[0];
    const literals = [
      ...[...body.matchAll(/<span class="stat__value[^"]*"[^>]*>([^<]*)<\/span>/g)].map((m) => m[1]),
      ...[...body.matchAll(/<td[^>]*>([^<]*)<\/td>/g)].map((m) => m[1]),
    ].map((text) => text.trim()).filter((text) => /\d/.test(text));
    assert.deepEqual(
      literals,
      [],
      `these ${page} figures are typed into the markup instead of injected from `
        + `fixtures.js: ${literals.join(', ')}`,
    );
  }
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

// Root-absolute paths resolve only when the server root happens to be the
// website directory. Served from inside preview/, or opened as a file, every
// stylesheet and module 404s and the page renders unstyled.
test('pages reference their assets relatively, so they work from any root', () => {
  for (const page of ['index.html', 'patient.html', 'doctor.html', 'admin.html']) {
    const html = read(page);
    const absolute = [...html.matchAll(/(?:href|src)="(\/[^"]*)"|from '(\/[^']*)'/g)]
      .map((match) => match[1] ?? match[2]);
    assert.deepEqual(
      absolute,
      [],
      `${page} references ${absolute.join(', ')} from the site root — those 404 `
        + 'unless the server root is the website directory',
    );
  }
});

// Screens are hidden until the router activates one, so a page whose module
// never runs shows nothing at all. Marking the opening screen active in markup
// means a failed script degrades to one readable screen instead of a blank page.
test('each surface shows its opening screen without JavaScript', () => {
  const openers = { 'patient.html': 'home', 'doctor.html': 'dashboard', 'admin.html': 'floor' };
  for (const [page, screen] of Object.entries(openers)) {
    const active = [...read(page).matchAll(/<section data-screen="([^"]+)"[^>]*class="[^"]*is-active/g)]
      .map((match) => match[1]);
    assert.deepEqual(
      active,
      [screen],
      `${page} must mark exactly "${screen}" active in markup so a failed script never blanks the page`,
    );
  }
});

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

/* --- the signed-in surfaces ------------------------------------------- */

const PATIENT_DASHBOARD = ['home', 'consultations', 'consultation-detail', 'prescriptions', 'account'];

test('the patient has a dashboard, not only a booking flow', () => {
  const ids = screenIds(read('patient.html'));
  for (const id of PATIENT_DASHBOARD) {
    assert.ok(ids.includes(id), `patient.html is missing dashboard screen: ${id}`);
  }
});

// The whole point of a dashboard is that a returning patient lands on their
// own records, not on the top of a funnel they have already been through.
test('the patient surface opens on the dashboard and can still reach the flow', () => {
  const html = read('patient.html');
  assert.match(read('js/patient.js'), /initRouter\(document,\s*'home'\)/,
    'patient.js does not open on the dashboard');
  assert.ok(gotoTargets(html).includes('entry'), 'the dashboard offers no way into the booking flow');
});

// The emergency route must survive the move into a dashboard: someone using
// this page may need to tap it while shaking, from wherever they happen to be.
test('the patient dashboard keeps a real 999 link at body size', () => {
  const section = read('patient.html').split('data-screen="home"')[1].split('</section>')[0];
  assert.match(section, /href="tel:999"/, 'the patient dashboard has no 999 link');
  assert.match(section, /class="band"/, 'the 999 line is not in the emergency band');
  const css = readFileSync(new URL('../css/dashboard.css', import.meta.url), 'utf8');
  assert.match(css, /\.band \{[^}]*font-size: 16px/, 'the emergency band has been shrunk below body size');
});

// Every screen on the rail is reachable by hash, so none of them may depend
// on a click having happened first to have any content at all — including
// when there is no consultation to show, which is the pre-launch default.
test('the consultation detail screen is painted before anything is clicked', () => {
  const js = read('js/patient.js');
  assert.match(js, /if \(history\.length > 0\) renderDetail\(history\[0\]\.id\);/,
    'the detail screen is blank until a row is clicked, but the rail links straight to it');
  assert.match(js, /else renderDetailPlaceholder\(\);/,
    'with no consultations the detail screen has no placeholder to fall back to');
});

test('the patient dashboard tracks a prescription without naming a medicine', () => {
  const html = read('patient.html');
  const section = html.split('data-screen="prescriptions"')[1].split('</section>')[0];
  assert.match(section, /pharmacy charges you separately/i,
    'the prescriptions screen does not disclose that the pharmacy charges separately');
});

const DOCTOR_DASHBOARD = ['dashboard', 'earnings', 'profile'];

test('the doctor has a dashboard, earnings and a profile', () => {
  const ids = screenIds(read('doctor.html'));
  for (const id of DOCTOR_DASHBOARD) {
    assert.ok(ids.includes(id), `doctor.html is missing dashboard screen: ${id}`);
  }
  assert.match(read('js/doctor.js'), /initRouter\(document,\s*'dashboard'\)/,
    'doctor.js does not open on the dashboard');
});

test('the doctor dashboard carries alerts and both charts', () => {
  const section = read('doctor.html').split('data-screen="dashboard"')[1].split('</section>')[0];
  assert.match(section, /data-alerts="list"/, 'the dashboard shows no alerts');
  assert.match(section, /data-chart="daily"/, 'the dashboard shows no workload chart');
  assert.match(section, /data-chart="demand"/, 'the dashboard shows no demand chart');
});

// A GP does not book shifts here. Availability is one control, and an offer is
// accept or decline — anything that looks like a rota is the wrong model.
test('the doctor surface offers availability, not a schedule', () => {
  const html = read('doctor.html');
  assert.ok(!screenIds(html).includes('schedule'), 'the doctor surface still has a schedule screen');
  assert.ok(!/class="cal"/.test(html), 'the doctor surface still shows a shift calendar');
  const section = html.split('data-screen="dashboard"')[1].split('</section>')[0];
  assert.match(section, /data-availability-echo/, 'the dashboard has no go online / go offline control');
  const js = read('js/doctor.js');
  assert.match(js, /router\.show\(online \? 'online-idle' : 'offline'\)/,
    'the availability control does not move the GP between online and offline');
});

test('declining an offer says where the offer goes next', () => {
  const section = read('doctor.html').split('data-screen="offer-declined"')[1].split('</section>')[0];
  assert.match(section, /queue|another GP|next GP/i,
    'the declined state does not say what happens to the patient');
});

// A chart is a status claim. Drawn from a literal it can disagree with the
// tile beside it, and nothing would catch that.
test('no chart, calendar or alert is drawn from a literal in the markup', () => {
  for (const page of ['doctor.html', 'admin.html']) {
    const body = read(page).split('<script')[0];
    assert.ok(!/<svg class="chart"/.test(body), `${page} has a chart typed into the markup`);
    assert.ok(!/class="alert"/.test(body), `${page} has an alert typed into the markup`);
  }
});

// A dashboard full of invented earnings and volumes is a claim about a
// service that has not seen one patient. Every surface starts blank.
test('every surface starts in placeholder mode', () => {
  for (const source of ['js/patient.js', 'js/doctor.js', 'admin.html']) {
    assert.match(read(source), /dataModeFromLocation\(\)/,
      `${source} does not read the data mode, so it cannot start blank`);
  }
  assert.match(
    readFileSync(new URL('../js/placeholder.js', import.meta.url), 'utf8'),
    /let mode = 'placeholder';/,
    'placeholder.js does not default to the blank state',
  );
});

test('every page that shows a dashboard loads the dashboard stylesheet', () => {
  for (const page of ['index.html', 'patient.html', 'doctor.html', 'admin.html']) {
    assert.match(read(page), /css\/dashboard\.css/, `${page} is missing dashboard.css`);
  }
});

// The product nav is a dashboard affordance. Offering four destinations in
// the middle of triage or a consultation is an invitation to abandon it.
test('the product nav is hidden during a linear flow', () => {
  const css = readFileSync(new URL('../css/dashboard.css', import.meta.url), 'utf8');
  assert.match(css, /body\[data-area="flow"\] \.topnav \{ display: none; \}/,
    'dashboard.css does not hide the product nav during a flow');
});

test('the arrival animation is scoped to first paint only', () => {
  for (const page of ['index.html', 'patient.html', 'doctor.html', 'admin.html']) {
    assert.match(read(page), /<body class="is-first-paint"/, `${page} lacks the first-paint flag`);
  }
  assert.match(
    readFileSync(new URL('../css/base.css', import.meta.url), 'utf8'),
    /body\.is-first-paint \[data-screen\]\.is-active \[data-reveal\]/,
    'base.css animates on every screen change, not just first paint',
  );
});

// The booking flow paints screens of its own, so reading the data mode in
// patient.js is not enough — flow.js has to honour it too, or the same wait
// reads as a dash on the dashboard and as a number two screens later.
test('the booking flow honours the data mode as well as the dashboard', () => {
  const flow = read('js/flow.js');
  assert.match(flow, /from '\.\/placeholder\.js'/,
    'flow.js never imports the placeholder rules, so it cannot honour them');
  assert.match(flow, /shown\(estimate\.etaSeconds/,
    'the wait quoted before booking is not held back before launch');
  assert.ok(!/set\('\[data-(entry="eta"|price-eta)\]', formatEta\(/.test(flow),
    'the flow quotes a wait the dashboard refuses to quote');
  assert.match(flow, /if \(isSeeded\(\)\) \{/,
    'the worked example is painted regardless of mode, inventing a consultation');
});
