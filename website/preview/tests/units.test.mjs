import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initRouter, resolveScreen } from '../js/router.js';
import { buildRailModel } from '../js/rail.js';
import { formatEta, tickCountdown, tickQueue } from '../js/live.js';
import {
  waitEstimate, isEligibleGp, matchGp, outcomeFor, endedEarly,
  consultationRecord, formatClock, nextConsultationId,
} from '../js/booking.js';

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

/* --- charts: geometry, because a chart that lies is worse than no chart --- */

import { barGeometry, linePoints, toPath } from '../js/charts.js';

test('bars fill the box and never overflow it', () => {
  const bars = barGeometry([1, 2, 4], { width: 100, height: 50, gap: 5 });
  assert.equal(bars.length, 3);
  assert.equal(bars[2].h, 50, 'the tallest bar must reach the top of the box');
  for (const bar of bars) {
    assert.ok(bar.y >= 0, 'a bar starts above the top of its own box');
    assert.ok(bar.y + bar.h <= 50.001, 'a bar overflows the bottom of its box');
    assert.ok(bar.x + bar.w <= 100.001, 'a bar overflows the right of its box');
  }
});

// An empty day and a missing day mean different things, and at 0px high they
// look identical. The stub is what keeps them distinguishable.
test('a zero-value bar still draws a visible stub', () => {
  const [zero] = barGeometry([0, 10], { width: 100, height: 50, gap: 0 });
  assert.equal(zero.h, 1);
});

test('bar geometry survives an all-zero series without dividing by zero', () => {
  const bars = barGeometry([0, 0], { width: 100, height: 50, gap: 0 });
  for (const bar of bars) assert.ok(Number.isFinite(bar.h));
});

test('barGeometry returns nothing for an empty series', () => {
  assert.deepEqual(barGeometry([], { width: 100, height: 50 }), []);
});

// Two series on one pair of axes must share a ceiling. Scaled to their own
// peaks, a series of 2s and a series of 200s draw the identical line.
test('two line series share a ceiling when one is given', () => {
  const small = linePoints([1, 2], { width: 10, height: 10, max: 10 });
  const large = linePoints([5, 10], { width: 10, height: 10, max: 10 });
  assert.notEqual(small[1].y, large[1].y);
  assert.equal(large[1].y, 0, 'a value at the shared ceiling must touch the top');
});

test('a single-point line does not divide by zero', () => {
  const [only] = linePoints([4], { width: 100, height: 50 });
  assert.equal(only.x, 0);
  assert.ok(Number.isFinite(only.y));
});

test('toPath moves once and then draws', () => {
  assert.equal(toPath([{ x: 0, y: 1 }, { x: 2, y: 3 }]), 'M0.0 1.0 L2.0 3.0');
  assert.equal(toPath([]), '');
});

/* --- credential alerts -------------------------------------------------- */

import { credentialAlerts, alertSentence } from '../js/alerts.js';

const credentials = (overrides) => ({
  gmc: { status: 'valid', daysRemaining: 250 },
  dbs: { status: 'valid', daysRemaining: 200 },
  indemnity: { status: 'valid', daysRemaining: 180 },
  ...overrides,
});

test('a fully valid record raises no alert', () => {
  assert.deepEqual(credentialAlerts(credentials({})), []);
});

// Indemnity is the only one whose lapse is unlawful to work through, so an
// expiring indemnity must outrank an expiring anything else.
test('expiring indemnity blocks while another expiring credential only nags', () => {
  const alerts = credentialAlerts(credentials({
    indemnity: { status: 'expiring', daysRemaining: 9 },
    dbs: { status: 'expiring', daysRemaining: 12 },
  }));
  assert.deepEqual(alerts.map((a) => [a.key, a.tone]), [['indemnity', 'blocking'], ['dbs', 'act']]);
});

test('an expired credential of any kind blocks', () => {
  const [alert] = credentialAlerts(credentials({ dbs: { status: 'expired', daysRemaining: 0 } }));
  assert.equal(alert.tone, 'blocking');
});

test('a valid credential inside the warning window is still worth saying', () => {
  const [alert] = credentialAlerts(credentials({ gmc: { status: 'valid', daysRemaining: 20 } }));
  assert.equal(alert.tone, 'watch');
  assert.equal(alert.key, 'gmc');
});

test('a credential with no expiry never warns on days', () => {
  assert.deepEqual(credentialAlerts({ cct: { status: 'valid', daysRemaining: null } }), []);
});

test('alerts of equal weight sort by how soon they bite', () => {
  const alerts = credentialAlerts(credentials({
    gmc: { status: 'valid', daysRemaining: 25 },
    dbs: { status: 'valid', daysRemaining: 5 },
  }));
  assert.deepEqual(alerts.map((a) => a.key), ['dbs', 'gmc']);
});

test('alert sentences read as English, and singular days stay singular', () => {
  assert.equal(alertSentence({ label: 'DBS check', status: 'expiring', daysRemaining: 1 }),
    'DBS check expires in 1 day.');
  assert.equal(alertSentence({ label: 'Indemnity cover', status: 'expired' }),
    'Indemnity cover has expired.');
  assert.equal(alertSentence({ label: 'DBS check', status: 'pending' }),
    'DBS check is still being verified.');
});

/* --- the app shell ------------------------------------------------------ */

import { activeNav, areaOf } from '../js/shell.js';

test('a sub-screen keeps its parent nav item lit', () => {
  assert.equal(activeNav('consultation-detail', { 'consultation-detail': 'consultations' }), 'consultations');
  assert.equal(activeNav('account', {}), 'account');
});

test('a screen outside the dashboard set is a flow, and hides the product nav', () => {
  const dash = ['home', 'account'];
  assert.equal(areaOf('home', dash), 'dash');
  assert.equal(areaOf('symptoms', dash), 'flow');
});

import { labelStride, svgLines } from '../js/charts.js';

test('a narrow chart labels fewer ticks than a wide one', () => {
  assert.equal(labelStride(14, 640), 1);
  assert.equal(labelStride(14, 300), 2);
  assert.equal(labelStride(1, 20), 1, 'a single label must never be dropped entirely');
});

// Both ends of an axis carry meaning, so both are always printed — but a tick
// one step short of the end overlaps it at phone width.
test('a line axis labels both ends without colliding at the far end', () => {
  const labels = Array.from({ length: 16 }, (_, i) => String(i));
  const svg = svgLines([{ key: 'first', values: labels.map(Number) }], labels, { width: 300 });
  const printed = [...svg.matchAll(/<text[^>]*>(\d+)<\/text>/g)].map((m) => Number(m[1]));
  assert.equal(printed[0], 0, 'the first tick is missing');
  assert.equal(printed.at(-1), 15, 'the last tick is missing');
  assert.ok(!printed.includes(14), 'a tick is printed right on top of the last one');
});

/* --- the consultation itself -------------------------------------------- */

test('the wait is divided by the GPs actually online, not counted head by head', () => {
  assert.deepEqual(waitEstimate({ waiting: 4, gpsOnline: 2 }), { position: 3, etaSeconds: 135 });
  assert.deepEqual(waitEstimate({ waiting: 4, gpsOnline: 1 }), { position: 5, etaSeconds: 225 });
  assert.deepEqual(waitEstimate({ waiting: 0, gpsOnline: 3 }), { position: 1, etaSeconds: 45 });
});

test('an empty floor never estimates a zero wait', () => {
  assert.equal(waitEstimate({ waiting: 0, gpsOnline: 0 }).position, 1);
});

test('a GP with a lapsed, pending or rejected credential cannot take a consultation', () => {
  const gp = (status) => ({ online: true, credentials: { gmc: { status: 'valid' }, dbs: { status } } });
  assert.equal(isEligibleGp(gp('valid')), true);
  assert.equal(isEligibleGp(gp('expiring')), true, 'close to expiry is still in date');
  assert.equal(isEligibleGp(gp('expired')), false);
  assert.equal(isEligibleGp(gp('pending')), false);
  assert.equal(isEligibleGp(gp('rejected')), false);
});

test('an offline GP is never matched, however good their credentials', () => {
  assert.equal(isEligibleGp({ online: false, credentials: { gmc: { status: 'valid' } } }), false);
});

const FLOOR_GPS = [
  { ref: 'GP-001', online: true, credentials: { gmc: { status: 'valid' } } },
  { ref: 'GP-002', online: true, credentials: { gmc: { status: 'valid' } } },
  { ref: 'GP-003', online: false, credentials: { gmc: { status: 'valid' } } },
];
const LOAD = [
  { ref: 'GP-001', consults: 45 },
  { ref: 'GP-002', consults: 40 },
  { ref: 'GP-003', consults: 0 },
];

test('matching picks the least-loaded eligible GP', () => {
  assert.equal(matchGp(FLOOR_GPS, LOAD, { nhsGpConsent: true }).ref, 'GP-002');
});

test('matching is deterministic when two GPs carry the same load', () => {
  const even = [{ ref: 'GP-001', consults: 5 }, { ref: 'GP-002', consults: 5 }];
  assert.equal(matchGp(FLOOR_GPS, even, { nhsGpConsent: true }).ref, 'GP-001');
});

test('matching returns nothing when no GP is eligible', () => {
  const none = FLOOR_GPS.map((gp) => ({ ...gp, online: false }));
  assert.equal(matchGp(none, LOAD, { nhsGpConsent: true }), null);
});

test('a matched GP carries the refused-consent limit through to the patient', () => {
  assert.equal(matchGp(FLOOR_GPS, LOAD, { nhsGpConsent: false }).limitedPrescribing, true);
  assert.equal(matchGp(FLOOR_GPS, LOAD, { nhsGpConsent: true }).limitedPrescribing, false);
});

// A consultation is not a prescription. Different complaints end differently,
// and the surface must never imply that paying the fee buys a medicine.
test('the outcome differs by complaint, so no path guarantees a prescription', () => {
  const at = (complaint) => outcomeFor({ complaint, nhsGpConsent: true });
  assert.equal(at('sore-throat').prescription, true);
  assert.equal(at('stomach').prescription, false);
  assert.equal(at('stomach').referral, true);
  assert.equal(at('skin').prescription, false);
  assert.equal(at('other').fitNote, true);
});

test('refusing to share the NHS record costs the prescription, not just a warning', () => {
  const outcome = outcomeFor({ complaint: 'sore-throat', nhsGpConsent: false });
  assert.equal(outcome.prescription, false);
  assert.equal(outcome.referral, true);
  assert.equal(outcome.sharedWithNhsGp, false);
});

test('a call under two minutes counts as ended early', () => {
  assert.equal(endedEarly(0), true);
  assert.equal(endedEarly(119), true);
  assert.equal(endedEarly(120), false);
});

test('the clock reads mm:ss and never goes negative', () => {
  assert.equal(formatClock(0), '00:00');
  assert.equal(formatClock(9), '00:09');
  assert.equal(formatClock(605), '10:05');
  assert.equal(formatClock(-4), '00:00');
});

test('the next reference follows the highest one already on file', () => {
  assert.equal(nextConsultationId([{ id: 'C-0031' }, { id: 'C-0009' }]), 'C-0032');
  assert.equal(nextConsultationId([]), 'C-0001');
});

test('a completed consultation records the same shape as an old one', () => {
  const record = consultationRecord({
    complaint: 'sore-throat', nhsGpConsent: true, gp: { ref: 'GP-002' }, seconds: 545,
  }, { id: 'C-0032', date: '28 August 2026', fee: 39 });
  assert.equal(record.status, 'completed');
  assert.equal(record.gp, 'GP-002');
  assert.equal(record.minutes, 9);
  assert.equal(record.cost, 39);
  assert.equal(record.reason, 'Sore throat or cough');
  assert.equal(record.outcome.prescription, true);
});

test('a cancelled consultation costs nothing and names no GP', () => {
  const record = consultationRecord({
    complaint: 'skin', status: 'cancelled', gp: { ref: 'GP-002' }, seconds: 0,
  }, { id: 'C-0032', date: '28 August 2026', fee: 39 });
  assert.equal(record.status, 'cancelled');
  assert.equal(record.cost, 0);
  assert.equal(record.gp, null);
  assert.equal(record.outcome, null);
});

test('a consultation shorter than a minute still records a minute, never zero', () => {
  const record = consultationRecord({
    complaint: 'skin', nhsGpConsent: true, gp: { ref: 'GP-001' }, seconds: 20,
  }, { id: 'C-0032', date: '28 August 2026', fee: 39 });
  assert.equal(record.minutes, 1, 'a completed consultation must not look cancelled');
});

/* --- placeholder mode: a prototype must not imply traction it has not had -- */

import {
  DASH, live, shown, seed, setDataMode, dataMode, isSeeded, emptyState, listOr,
} from '../js/placeholder.js';

test('the prototype defaults to placeholder, never to invented figures', () => {
  assert.equal(dataMode(), 'placeholder');
  assert.equal(isSeeded(), false);
});

// "0 consultations" says the service ran and nobody came. A dash says only
// that there is nothing to show. Before launch those are different claims.
test('live() shows a dash for nothing, including zero', () => {
  assert.equal(live(0), DASH);
  assert.equal(live(null), DASH);
  assert.equal(live(undefined), DASH);
  assert.equal(live(''), DASH);
  assert.equal(live(3), '3');
});

test('live() formats a real value through its formatter', () => {
  assert.equal(live(39, (v) => `£${v}`), '£39');
});

// live() is for what this session can genuinely produce — a patient who walks
// the booking flow really does hold a consultation afterwards.
test('live() lets session data through even in placeholder mode', () => {
  assert.equal(dataMode(), 'placeholder');
  assert.equal(live(1), '1');
});

test('shown() withholds a fixture figure until the prototype is seeded', () => {
  assert.equal(shown(1248, (v) => `£${v}`), DASH);
  try {
    setDataMode('seeded');
    assert.equal(shown(1248, (v) => `£${v}`), '£1248');
  } finally {
    setDataMode('placeholder');
  }
});

test('seed() empties a fixture list until seeded, and copies it when it is', () => {
  const source = [{ id: 'a' }];
  assert.deepEqual(seed(source), []);
  try {
    setDataMode('seeded');
    const copy = seed(source);
    assert.deepEqual(copy, source);
    // patient.js unshifts this session's own consultation onto the list, so a
    // shared reference would mutate the fixture and leak between screens.
    assert.notEqual(copy, source);
  } finally {
    setDataMode('placeholder');
  }
});

test('an unknown data mode is refused rather than silently ignored', () => {
  assert.throws(() => setDataMode('demo'), /Unknown data mode: demo/);
  assert.equal(dataMode(), 'placeholder');
});

test('listOr falls back to a written empty state, not a blank box', () => {
  assert.equal(listOr('', 'Nothing yet.'), emptyState('Nothing yet.'));
  assert.equal(listOr('<tr></tr>', 'Nothing yet.'), '<tr></tr>');
  assert.match(emptyState('Nothing yet.'), /class="empty"/);
});
