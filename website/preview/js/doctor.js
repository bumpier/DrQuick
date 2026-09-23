import { initRouter } from './router.js';
import { buildRailModel, renderRail } from './rail.js';
import { mountShell } from './shell.js';
import { tickCountdown, startInterval } from './live.js';
import { credentialAlerts, alertSentence } from './alerts.js';
import { svgBars, svgLines, mountChart } from './charts.js';
import { icon } from './icons.js';
import {
  OFFER, OFFER_CONSENT_REFUSED, DOCTOR, DOCTOR_DASHBOARD, GPS, FEE,
} from './fixtures.js';
import {
  DASH, dataModeFromLocation, shown, seed, emptyState, listOr, isSeeded,
} from './placeholder.js';

dataModeFromLocation();

const $ = (selector, scope = document) => scope.querySelector(selector);
const money = (value) => `£${value.toLocaleString('en-GB')}`;
const set = (selector, text) => { const node = $(selector); if (node) node.textContent = text; };
const html = (selector, markup) => { const node = $(selector); if (node) node.innerHTML = markup; };

const D = DOCTOR_DASHBOARD;
const me = GPS.find((gp) => gp.ref === DOCTOR.ref);

const router = initRouter(document, 'dashboard');

const DASH_SCREENS = [
  'dashboard', 'earnings', 'profile',
  'offline', 'online-idle', 'no-patients-waiting',
  'verification-pending', 'verification-rejected', 'indemnity-expired', 'revalidation-due',
];
mountShell(document, router, {
  dash: DASH_SCREENS,
  sectionOf: {
    offline: 'dashboard', 'online-idle': 'dashboard', 'no-patients-waiting': 'dashboard',
    'verification-pending': 'profile', 'verification-rejected': 'profile',
    'indemnity-expired': 'profile', 'revalidation-due': 'profile',
  },
});

renderRail(document, buildRailModel([
  { label: 'Dashboard', items: [
    { id: 'dashboard', label: 'Dashboard', kind: 'screen' },
    { id: 'earnings', label: 'Earnings', kind: 'screen' },
    { id: 'profile', label: 'Profile', kind: 'screen' },
  ] },
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
    { id: 'offer-consent-refused', label: 'Offer — consent refused', kind: 'state' },
    { id: 'offer-declined', label: 'Declined', kind: 'state' },
    { id: 'offer-timed-out', label: 'Timed out', kind: 'state' },
    { id: 'patient-no-show', label: 'No-show', kind: 'state' },
    { id: 'revalidation-due', label: 'Revalidation', kind: 'state' },
    { id: 'no-patients-waiting', label: 'Nobody waiting', kind: 'state' },
  ] },
], router.ids()), router);

/* --- availability: one piece of state, echoed everywhere it matters ----- */

const availabilityButton = $('[data-availability]');
const availabilityEcho = $('[data-availability-echo]');
let online = false;

function renderAvailability() {
  availabilityButton.setAttribute('aria-pressed', String(online));
  availabilityButton.textContent = online ? 'Go offline' : 'Go online';
  set('[data-gp="status"]', online ? 'Online' : 'Offline');
  set('[data-live="heading"]', online ? 'You are online' : 'You are offline');
  set('[data-live="clock"]', online ? 'Taking offers' : 'Not taking offers');
  availabilityEcho.textContent = online ? 'Go offline' : 'Go online';
}
availabilityButton.addEventListener('click', () => { online = !online; renderAvailability(); });
availabilityEcho.addEventListener('click', () => {
  online = !online;
  renderAvailability();
  router.show(online ? 'online-idle' : 'offline');
});
// Walking to the availability screens by any route must not leave the top bar
// claiming the opposite of what the screen says.
document.addEventListener('screenchange', (event) => {
  if (event.detail.id === 'online-idle' || event.detail.id === 'no-patients-waiting') online = true;
  if (event.detail.id === 'offline') online = false;
  renderAvailability();
});

set('[data-gp="ref"]', DOCTOR.ref);
set('[data-gp="initials"]', D.initials);
renderAvailability();

/* --- live floor --------------------------------------------------------- */

set('[data-live="waiting"]', shown(DOCTOR.shift.patientsWaiting));
set('[data-live="gps"]', isSeeded() ? `${DOCTOR.shift.gpsOnline} of ${DOCTOR.shift.gpsNeeded}` : DASH);
set('[data-live="minutes"]', shown(DOCTOR.shift.minutesOnline, (m) => `${m}m`));
set('[data-live="today"]', shown(DOCTOR.shift.earningsToday, money));

/* --- earnings arithmetic, done once ------------------------------------- */

const dayValue = (day) => day.consults * FEE;
const fortnightConsults = D.dailyConsults.reduce((sum, day) => sum + day.consults, 0);
const weekConsults = D.dailyConsults.slice(-7).reduce((sum, day) => sum + day.consults, 0);
const busiest = D.dailyConsults.reduce((best, day) => (day.consults > best.consults ? day : best));
const payoutAmount = weekConsults * FEE;

set('[data-fortnight="consults"]', shown(fortnightConsults));
set('[data-fortnight="earnings"]', shown(fortnightConsults * FEE, money));
set('[data-fortnight="busiest"]', isSeeded() ? `${busiest.label} Aug · ${busiest.consults}` : DASH);

set('[data-payout="amount"]', shown(payoutAmount, money));
set('[data-payout="when"]', isSeeded() ? `Paid ${D.payout.date}` : 'Nothing to pay out yet');
set('[data-payout="note"]', isSeeded()
  ? `${weekConsults} consultations at ${money(FEE)} each, by ${D.payout.method.toLowerCase()}.`
  : `Paid by ${D.payout.method.toLowerCase()} at ${money(FEE)} per completed consultation.`);
$('[data-payout="progress"]').style.width = isSeeded()
  ? `${Math.round((weekConsults / Math.max(fortnightConsults, 1)) * 100)}%` : '0%';

/* --- credential alerts, derived from the credential record -------------- */

const ACTIONS = { indemnity: 'indemnity', dbs: 'credentials', revalidation: 'revalidation-due' };
const alerts = isSeeded() ? credentialAlerts(me.credentials) : [];
html('[data-alerts="list"]', alerts.length === 0
  ? emptyState(isSeeded()
    ? 'Nothing needs you. Every credential is valid for more than a month.'
    : 'No credentials on file yet. Add them and anything close to lapsing appears here.')
  : alerts.map((alert) => `
    <div class="alert" data-tone="${alert.tone}">
      <span class="alert__icon">${icon(alert.tone === 'blocking' ? 'warn' : 'clock')}</span>
      <div class="alert__body">
        <div class="alert__title">${alertSentence(alert)}</div>
        ${alert.tone === 'blocking'
          ? '<p class="alert__note">You cannot take a consultation once this lapses.</p>'
          : ''}
      </div>
      <span class="alert__end"><button class="btn btn--sm" type="button" data-goto="${ACTIONS[alert.key] ?? 'profile'}">Fix</button></span>
    </div>`).join(''));
set('[data-alerts="count"]', alerts.length === 0
  ? (isSeeded() ? 'All clear' : DASH) : `${alerts.length} to sort`);

/* --- charts ------------------------------------------------------------- */

const dailySeries = D.dailyConsults.map((day, i) => ({
  label: day.label,
  value: day.consults,
  emph: i === D.dailyConsults.length - 1 ? 'true' : 'false',
}));

// A chart on a hidden screen measures zero, so it falls back to a default
// width. Redraw when its screen becomes visible or the axis stays wrong.
const redraws = [];
const chart = (selector, message, build) => {
  const node = $(selector);
  if (!isSeeded()) { node.innerHTML = emptyState(message); return () => {}; }
  return mountChart(node, build);
};

redraws.push(chart('[data-chart="daily"]', 'No consultations yet.', (width) =>
  svgBars(dailySeries, { width, height: 150, format: (v) => `${v} consultations` })));

redraws.push(chart('[data-chart="earnings"]', 'No earnings yet.', (width) => svgBars(
  D.dailyConsults.map((day, i) => ({
    label: day.label,
    value: dayValue(day),
    emph: i === D.dailyConsults.length - 1 ? 'true' : 'false',
  })),
  { width, height: 150, format: money },
)));

redraws.push(chart('[data-chart="demand"]', 'No demand recorded yet.', (width) => svgLines(
  [
    { key: 'first', values: D.demandByHour.map((hour) => hour.waiting) },
    { key: 'second', values: D.demandByHour.map((hour) => hour.gps) },
  ],
  D.demandByHour.map((hour) => hour.hour),
  { width, height: 150, area: true },
)));

document.addEventListener('screenchange', () => { for (const draw of redraws) draw(); });

/* --- offers today -------------------------------------------------------- */

set('[data-offers="offered"]', shown(D.offersToday.offered));
set('[data-offers="accepted"]', shown(D.offersToday.accepted));
set('[data-offers="declined"]', shown(D.offersToday.declined));

/* --- today's consultations ---------------------------------------------- */

const recent = seed(D.recent);

html('[data-recent-rows]', listOr(recent.map((c) => `<tr>
  <th scope="row">${c.id}</th><td>${c.when}</td><td>${c.ageBand}</td>
  <td>${c.minutes} min</td><td>${c.outcome}</td><td>${money(FEE)}</td></tr>`).join(''),
  '') || '<tr><th scope="row">—</th><td colspan="5">No consultations today.</td></tr>');

html('[data-payout-rows]', recent.map((c) => `<tr>
  <th scope="row">${c.id}</th><td>${c.when}</td><td>${c.minutes} min</td>
  <td>${c.outcome}</td><td>${money(FEE)}</td></tr>`).join('')
  || '<tr><th scope="row">—</th><td colspan="4">Nothing in this payout yet.</td></tr>');

/* --- performance -------------------------------------------------------- */

set('[data-perf="rating"]', shown(D.ratingAverage, (r) => r.toFixed(1)));
set('[data-perf="rating-label"]', isSeeded()
  ? `Patient rating from ${D.ratingCount} consultations` : 'Patient rating');
$('[data-perf="rating-bar"]').style.width = isSeeded() ? `${(D.ratingAverage / 5) * 100}%` : '0%';
set('[data-perf="acceptance"]', shown(D.acceptanceRate, (r) => `${Math.round(r * 100)}%`));
$('[data-perf="acceptance-bar"]').style.width = isSeeded() ? `${D.acceptanceRate * 100}%` : '0%';
set('[data-perf="length"]', shown(D.averageConsultMinutes, (m) => `${m} min`));

/* --- earnings screen ---------------------------------------------------- */

set('[data-earn="period"]', shown(D.payout.period));
set('[data-earn="payout"]', shown(payoutAmount, money));
set('[data-earn="payout-when"]', isSeeded()
  ? `${D.payout.method}, ${D.payout.date}` : `${D.payout.method}, weekly`);
set('[data-earn="todate"]', shown(DOCTOR.earningsToDate, money));
set('[data-earn="consults"]', shown(DOCTOR.consultsCompleted));
set('[data-earn="fee"]', money(FEE));
set('[data-earn="week"]', shown(payoutAmount, money));
set('[data-earn="range"]', isSeeded()
  ? `${D.dailyConsults[0].label}–${D.dailyConsults.at(-1).label} August` : DASH);
// A five-row table under a twelve-consultation payout invites the reader to
// add it up and find it short. Say which five these are.
set('[data-earn="payout-note"]', isSeeded() ? `${D.recent.length} most recent of ${weekConsults}` : '');

/* --- profile ------------------------------------------------------------ */

// A status pill must carry a word, not only a colour — and the word reads as
// English, not as the fixture's own key.
const statusLabel = (status) => status.charAt(0).toUpperCase() + status.slice(1);

const CREDENTIAL_LABELS = {
  gmc: 'GMC registration',
  licence: 'Licence to practise',
  cct: 'CCT / specialist registration',
  dbs: 'DBS check',
  rightToWork: 'Right to work',
  indemnity: 'Indemnity cover',
  revalidation: 'GMC revalidation',
};

html('[data-credential-rows]', Object.entries(me.credentials).map(([key, credential]) => `
  <div class="row">
    <span class="row__main">
      <span class="row__t">${CREDENTIAL_LABELS[key]}</span>
      <span class="row__s">${isSeeded()
        ? (credential.daysRemaining === null ? 'No expiry' : `${credential.daysRemaining} days remaining`)
        : 'Not submitted'}</span>
    </span>
    <span class="row__end"><span class="pill" data-status="${isSeeded() ? credential.status : 'pending'}">${
      isSeeded() ? statusLabel(credential.status) : DASH}</span></span>
  </div>`).join(''));

const SKILLS = [
  ['General adult medicine', 'On'],
  ['Minor illness', 'On'],
  ["Women's health", 'Off'],
  ['Mental health', 'Off'],
  ['Paediatrics (age 5+)', 'Off'],
  ['Dermatology', 'Off'],
];
html('[data-skills-list]', SKILLS.map(([label, state]) => `
  <div class="row">
    <span class="row__main"><span class="row__t">${label}</span></span>
    <span class="row__end" style="font-weight:500;color:var(--ink-2)">${state}</span>
  </div>`).join(''));

html('[data-gp-facts]', [
  ['Reference', DOCTOR.ref],
  ['Credentials', isSeeded()
    ? `${DOCTOR.credentialsVerified} of ${DOCTOR.credentialsTotal} verified` : DASH],
  ['Consultations', shown(DOCTOR.consultsCompleted)],
  ['Earned to date', shown(DOCTOR.earningsToDate, money)],
  ['Working in', 'England only'],
].map(([term, value]) => `<div><b>${term}</b><span>${value}</span></div>`).join(''));

/* --- the availability screens' own figures ------------------------------ */

set('[data-doctor="earningsToDate"]', shown(DOCTOR.earningsToDate, money));
set('[data-doctor="consultsCompleted"]', shown(DOCTOR.consultsCompleted));
set('[data-doctor="credentials"]', isSeeded()
  ? `${DOCTOR.credentialsVerified} of ${DOCTOR.credentialsTotal} verified` : DASH);
set('[data-doctor="daysToRevalidation"]', shown(DOCTOR.daysToRevalidation, (d) => `${d} days`));
// The revalidation state screen exists to show the warning, so it keeps its number.
set('[data-doctor="revalidationDueInDays"]', `${DOCTOR.revalidationDueInDays} days`);
set('[data-doctor-shift="gpsOnline"]', isSeeded()
  ? `${DOCTOR.shift.gpsOnline} of ${DOCTOR.shift.gpsNeeded}` : DASH);
set('[data-doctor-shift="patientsWaiting"]', shown(DOCTOR.shift.patientsWaiting));
set('[data-doctor-shift="minutesOnline"]', shown(DOCTOR.shift.minutesOnline, (m) => `${m}m`));
set('[data-doctor-shift="earningsToday"]', shown(DOCTOR.shift.earningsToday, money));

set('[data-complete-fee]', `Payment confirmed — ${money(FEE)} for this consultation.`);

/* --- an offer ------------------------------------------------------------ */

// Both offer screens render from fixtures rather than hardcoded facts, so
// the consenting and consent-refused cases cannot drift apart.
const renderOfferFacts = (screenId, facts) => {
  const section = $(`[data-screen="${screenId}"]`);
  $('[data-offer-fact="presentingComplaint"]', section).textContent = facts.presentingComplaint;
  $('[data-offer-fact="ageBand"]', section).textContent = facts.ageBand;
  $('[data-offer-fact="nhsGpConsent"]', section).textContent = facts.nhsGpConsent ? 'Yes' : 'No';
};
renderOfferFacts('offer', OFFER);
renderOfferFacts('offer-consent-refused', OFFER_CONSENT_REFUSED);

html('[data-consult-facts]', [
  ['Complaint', OFFER.presentingComplaint],
  ['Age band', OFFER.ageBand],
  ['NHS GP summary', OFFER.nhsGpConsent ? 'Consent given' : 'Consent refused'],
  ['Recording', 'This call is not recorded'],
].map(([term, value]) => `<div><b>${term}</b><span>${value}</span></div>`).join(''));

let offer = { remaining: OFFER.windowSeconds };
let stop = () => {};
document.addEventListener('screenchange', (event) => {
  stop();
  if (event.detail.id !== 'offer' && event.detail.id !== 'offer-consent-refused') return;
  const counter = $(`[data-screen="${event.detail.id}"] [data-offer-countdown]`);
  offer = { remaining: OFFER.windowSeconds };
  counter.textContent = `${offer.remaining}s`;
  stop = startInterval(() => {
    offer = tickCountdown(offer);
    counter.textContent = `${offer.remaining}s`;
    if (offer.expired) { stop(); router.show('offer-timed-out'); }
  }, 1000);
});
