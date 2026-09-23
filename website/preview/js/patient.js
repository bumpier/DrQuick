import { initRouter } from './router.js';
import { buildRailModel, renderRail } from './rail.js';
import { mountShell } from './shell.js';
import { formatEta } from './live.js';
import { icon } from './icons.js';
import { initFlow } from './flow.js';
import { nextConsultationId, waitEstimate } from './booking.js';
import {
  DASH, dataModeFromLocation, live, shown, seed, emptyState, listOr, isSeeded,
} from './placeholder.js';
import {
  PRICE, PATIENT_ACCOUNT, CONSULTATIONS, PRESCRIPTIONS, FEE,
  GPS, PRESCRIBING, FLOOR,
} from './fixtures.js';

const $ = (selector, scope = document) => scope.querySelector(selector);
const money = (value) => `£${value.toLocaleString('en-GB')}`;
const set = (selector, text) => { const node = $(selector); if (node) node.textContent = text; };
const mins = (n) => `${n} minute${n === 1 ? '' : 's'}`;

/* The consultations this patient has. It starts as the fixtures and grows: a
   consultation booked in this session has to land here, or the flow is a
   slideshow rather than something a patient could actually use. */
dataModeFromLocation();
const history = seed(CONSULTATIONS);
const prescriptions = seed(PRESCRIPTIONS);
const TODAY_LABEL = '28 August 2026';

const router = initRouter(document, 'home');

const DASH_SCREENS = ['home', 'consultations', 'consultation-detail', 'prescriptions', 'account'];
mountShell(document, router, {
  dash: DASH_SCREENS,
  sectionOf: { 'consultation-detail': 'consultations' },
});

renderRail(document, buildRailModel([
  { label: 'Account', items: [
    { id: 'home', label: 'Home', kind: 'screen' },
    { id: 'consultations', label: 'Consultations', kind: 'screen' },
    { id: 'consultation-detail', label: 'Detail', kind: 'screen' },
    { id: 'prescriptions', label: 'Prescriptions', kind: 'screen' },
    { id: 'account', label: 'Account', kind: 'screen' },
  ] },
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

/* --- identity in the top bar ------------------------------------------- */

set('[data-account="ref"]', PATIENT_ACCOUNT.ref);
set('[data-account="initials"]', PATIENT_ACCOUNT.initials);

/* --- one row, wherever a consultation is listed -------------------------- */

const consultRow = (c) => `
  <button class="row" type="button" data-detail-id="${c.id}">
    <span class="row__main">
      <span class="row__t">${c.reason}${c.isNew ? ' <span class="tag">new</span>' : ''}</span>
      <span class="row__s">${c.date} · ${c.status === 'cancelled' ? 'Cancelled before it started' : `${c.gp} · ${mins(c.minutes)}`}</span>
    </span>
    <span class="row__end">${c.cost === 0 ? 'No charge' : money(c.cost)}</span>
  </button>`;

/* --- home ---------------------------------------------------------------- */

const openPrescription = prescriptions.find((rx) => rx.steps.some((step) => step.now));
const estimate = waitEstimate(FLOOR);

// The price is a published product fact and stays. The wait and the claim
// that GPs are online are floor data, and there is no floor yet.
set('[data-home="price"]', PRICE.amount);
set('[data-home="eta"]', shown(estimate.etaSeconds, formatEta));
set('[data-home="availability"]', isSeeded() ? 'GPs online now' : 'Not live yet');

$('[data-home="rx-status"]').innerHTML = openPrescription
  ? `<p style="margin:0 0 var(--s-2);font-weight:700">${
      openPrescription.steps.filter((s) => s.done).at(-1).label}</p>`
    + `<p style="margin:0;color:var(--ink-2);font-size:14px">${openPrescription.pharmacy}. `
    + 'You pay the pharmacy for the medicine itself.</p>'
  : '<p style="margin:0;color:var(--ink-2)">Nothing waiting at a pharmacy.</p>';

function renderHome() {
  const completed = history.filter((c) => c.status === 'completed');

  // The to-do list is derived from the same records the rest of the page
  // shows, so it can never tell the patient about something that is not
  // really there.
  const todos = [
    openPrescription && {
      tone: 'act', mark: 'pin',
      title: 'A prescription is waiting at your pharmacy',
      note: `${openPrescription.pharmacy}. Take photo ID with you. The pharmacy charges for the medicine.`,
      action: { label: 'Track', goto: 'prescriptions' },
    },
    completed.some((c) => !c.outcome.sharedWithNhsGp) && {
      tone: 'watch', mark: 'file',
      title: 'One consultation was never sent to your NHS GP',
      note: 'You chose not to share it at the time. You can still send it.',
      action: { label: 'Review', goto: 'consultations' },
    },
    {
      tone: 'watch', mark: 'user',
      title: 'Confirm your NHS GP practice',
      note: 'We send your consultation summary here. Check it is still right.',
      action: { label: 'Check', goto: 'account' },
    },
  ].filter(Boolean);

  $('[data-home="todo"]').innerHTML = listOr(todos.map((todo) => `
    <div class="alert" data-tone="${todo.tone}">
      <span class="alert__icon">${icon(todo.mark)}</span>
      <div class="alert__body">
        <div class="alert__title">${todo.title}</div>
        <p class="alert__note">${todo.note}</p>
      </div>
      <span class="alert__end"><button class="btn btn--sm" type="button" data-goto="${todo.action.goto}">${todo.action.label}</button></span>
    </div>`).join(''), 'Nothing needs you.');
  set('[data-home="todo-count"]', live(todos.length, (n) => `${n} to do`));

  $('[data-home="recent"]').innerHTML = listOr(
    history.slice(0, 3).map(consultRow).join(''),
    'No consultations yet. Your first one will appear here.',
  );

  // These count what this patient has actually done, so a consultation booked
  // in this session shows up straight away rather than staying a dash.
  set('[data-year="consults"]', live(completed.length));
  set('[data-year="spend"]', live(completed.reduce((sum, c) => sum + c.cost, 0), money));
  set('[data-year="shared"]', live(completed.filter((c) => c.outcome.sharedWithNhsGp).length));
}

/* --- consultations, with a working filter ------------------------------- */

const list = $('[data-list="consultations"]');
const emptyNote = $('[data-list-empty]');
const filterButtons = [...document.querySelectorAll('[data-filter] button')];
let filter = 'all';

function renderList(value = filter) {
  filter = value;
  const rows = history.filter((c) => value === 'all' || c.status === value);
  list.innerHTML = rows.map(consultRow).join('');
  emptyNote.hidden = rows.length > 0;
  for (const button of filterButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.value === value));
  }
}
for (const button of filterButtons) {
  button.addEventListener('click', () => renderList(button.dataset.value));
}

/* --- one consultation --------------------------------------------------- */

/* Paints only. The detail screen is on the rail and reachable by hash, so it
   has to hold content before anyone has clicked a row. */
function renderDetail(id) {
  const c = history.find((row) => row.id === id);
  if (!c) return;
  set('[data-detail="title"]', c.reason);
  set('[data-detail="sub"]', c.status === 'cancelled'
    ? `${c.date} · cancelled before a GP accepted it`
    : `${c.date} · ${mins(c.minutes)} with ${c.gp}`);
  $('[data-detail="facts"]').innerHTML = [
    ['Reference', c.id],
    ['Date', c.date],
    ['GP', c.gp ?? 'None — no GP accepted'],
    ['Length', c.minutes === 0 ? '—' : mins(c.minutes)],
    ['Recording', 'The call was not recorded'],
  ].map(([term, value]) => `<div><b>${term}</b><span>${value}</span></div>`).join('');

  const outcome = c.outcome;
  $('[data-detail="outcome"]').innerHTML = outcome
    ? [
      ['Prescription', outcome.prescription ? 'Sent to your pharmacy' : 'None issued'],
      ['Referral', outcome.referral ? 'Referred on to your NHS GP' : 'None needed'],
      ['Fit note', outcome.fitNote ? 'Issued' : 'Not issued'],
      ['Shared with your NHS GP', outcome.sharedWithNhsGp ? 'Yes, as you agreed' : 'No — you chose not to share'],
    ].map(([term, value]) => `<div class="row"><span class="row__main"><span class="row__t">${term}</span></span>`
      + `<span class="row__end" style="font-weight:500;color:var(--ink-2)">${value}</span></div>`).join('')
    : '<p class="empty">No outcome — this consultation was cancelled before a GP accepted it.</p>';
  set('[data-detail="cost"]', c.cost === 0 ? 'No charge' : money(c.cost));
}
function renderDetailPlaceholder() {
  set('[data-detail="title"]', 'No consultation selected');
  set('[data-detail="sub"]', 'Pick one from your consultations to see what came out of it.');
  $('[data-detail="facts"]').innerHTML = [
    ['Reference', DASH], ['Date', DASH], ['GP', DASH],
    ['Length', DASH], ['Recording', 'Calls are never recorded'],
  ].map(([term, value]) => `<div><b>${term}</b><span>${value}</span></div>`).join('');
  $('[data-detail="outcome"]').innerHTML = emptyState('No outcome yet.');
  set('[data-detail="cost"]', DASH);
}

// The detail screen is on the rail and reachable by hash, so it must hold
// something before anyone has clicked a row — a consultation if there is one,
// and an honest blank if there is not.
if (history.length > 0) renderDetail(history[0].id);
else renderDetailPlaceholder();

document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-detail-id]');
  if (!trigger) return;
  renderDetail(trigger.dataset.detailId);
  router.show('consultation-detail');
});

/* --- prescriptions ------------------------------------------------------ */

$('[data-list="prescriptions"]').innerHTML = listOr(prescriptions.map((rx) => {
  const steps = rx.steps.map((step) => `
    <li data-done="${Boolean(step.done)}" data-now="${Boolean(step.now)}">
      <span class="timeline__dot"></span>
      <span><span class="timeline__label">${step.label}</span>
        ${step.when ? `<span class="timeline__when">${step.when}</span>` : ''}</span>
    </li>`).join('');
  const settled = rx.steps.every((step) => step.done);
  return `<div class="card">
    <div class="card__head">
      <h2 class="card__title">${settled ? 'Collected' : 'With your pharmacy'}</h2>
      <span class="card__meta">${rx.issued}</span>
    </div>
    <p style="margin:0 0 var(--s-4);color:var(--ink-2);font-size:14px">${rx.pharmacy}</p>
    <ol class="timeline">${steps}</ol>
    <p style="margin:var(--s-4) 0 0;color:var(--ink-2);font-size:13px">
      Your ${PRICE.amount} covered the consultation and writing this prescription.
      The pharmacy charges you separately for the medicine.</p>
  </div>`;
}).join(''), 'No prescriptions yet. Any a GP writes for you will appear here.');

/* --- account ------------------------------------------------------------ */

$('[data-account="facts"]').innerHTML = [
  ['Reference', PATIENT_ACCOUNT.ref],
  ['Email', PATIENT_ACCOUNT.email],
  ['Member since', shown(PATIENT_ACCOUNT.memberSince)],
  ['Available in', 'England only'],
].map(([term, value]) => `<div><b>${term}</b><span>${value}</span></div>`).join('');

const identityPill = $('[data-account="identity"]');
identityPill.textContent = isSeeded() && PATIENT_ACCOUNT.identityVerified ? 'Verified' : 'Not yet checked';
identityPill.dataset.status = isSeeded() && PATIENT_ACCOUNT.identityVerified ? 'valid' : 'pending';

set('[data-account="practice"]', shown(PATIENT_ACCOUNT.nhsPractice, String)
  === DASH ? 'No practice saved' : PATIENT_ACCOUNT.nhsPractice);
set('[data-account="card"]', isSeeded()
  ? `${PATIENT_ACCOUNT.cardBrand} ending ${PATIENT_ACCOUNT.cardLast4}`
  : 'No card saved');

const consentToggle = $('[data-consent-toggle]');
const consentNote = $('[data-account="consent-note"]');
function renderConsent(on) {
  consentToggle.setAttribute('aria-pressed', String(on));
  consentToggle.textContent = on ? 'Sharing on' : 'Sharing off';
  consentNote.textContent = on
    ? 'Each consultation summary is sent here.'
    : 'Nothing is sent. A GP may be unable to prescribe some treatments without your records.';
}
renderConsent(PATIENT_ACCOUNT.nhsShareConsent);
consentToggle.addEventListener('click', () => {
  renderConsent(consentToggle.getAttribute('aria-pressed') !== 'true');
});

/* --- the consultation flow ---------------------------------------------- */

renderHome();
renderList('all');

initFlow(document, router, {
  account: PATIENT_ACCOUNT,
  floor: FLOOR,
  gps: GPS,
  prescribing: PRESCRIBING,
  fee: FEE,
  price: PRICE,
  today: TODAY_LABEL,
  nextId: () => nextConsultationId(history),
  onComplete: (record) => {
    for (const row of history) delete row.isNew;
    history.unshift(record);
    renderHome();
    renderList();
  },
});

// FEE is the single source of the price; PRICE.amount is its display form.
// If they ever disagree the page is lying to somebody, so say so loudly.
if (PRICE.amount !== `£${FEE}`) {
  console.warn(`Fixture drift: PRICE.amount is ${PRICE.amount} but FEE is ${FEE}`);
}
