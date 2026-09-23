/* Driving the consultation. The router moves between screens; this decides
   which screen comes next, and it decides it from what the patient actually
   entered rather than from a hardcoded path. Every screen reads the one
   booking object, so no screen can show a fact the patient never gave. */

import {
  createBooking, waitEstimate, matchGp, outcomeFor, endedEarly,
  consultationRecord, formatClock, COMPLAINTS,
} from './booking.js';
import { formatEta, tickQueue, startInterval } from './live.js';
import { DASH, shown, isSeeded, emptyState } from './placeholder.js';

const POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

export function initFlow(doc, router, config) {
  const {
    account, floor, gps, prescribing, fee, price, onComplete,
  } = config;

  const $ = (selector) => doc.querySelector(selector);
  const $$ = (selector) => [...doc.querySelectorAll(selector)];
  const set = (selector, text) => { const n = $(selector); if (n) n.textContent = text; };

  let stopTimer = () => {};
  const estimate = waitEstimate(floor);

  /* Every screen is on the rail and reachable by hash, so none of them may be
     blank before the flow has run. The booking starts as a worked example and
     "See a GP now" replaces it with a real one. */
  let booking = {
    ...createBooking(),
    identityVerified: true,
    practice: account.nhsPractice,
    postcode: 'N1 9AA',
    nhsGpConsent: true,
    authorised: true,
    seconds: 545,
  };

  /* --- the arrival notification ---------------------------------------- */

  const toast = $('[data-toast]');
  let toastTimer = null;

  function showToast(title, note, label, goto) {
    set('[data-toast="title"]', title);
    set('[data-toast="note"]', note);
    const action = $('[data-toast-action]');
    action.textContent = label;
    action.dataset.gotoScreen = goto;
    toast.hidden = false;
    // The tab title is the only part of this a patient sees when they have
    // looked away, which is the whole point of a queue you can leave.
    const original = doc.title;
    doc.title = `${title} — Dr Quick`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { doc.title = original; }, 8000);
  }
  const hideToast = () => { toast.hidden = true; };
  toast.addEventListener('click', (event) => {
    if (!event.target.closest('[data-toast-action]')) return;
    hideToast();
    router.show($('[data-toast-action]').dataset.gotoScreen);
  });

  /* --- errors ----------------------------------------------------------- */

  function fail(name, message) {
    const node = $(`[data-error="${name}"]`);
    node.textContent = message;
    node.hidden = false;
    return false;
  }
  const clearError = (name) => { $(`[data-error="${name}"]`).hidden = true; };

  /* --- entry ------------------------------------------------------------ */

  /* The wait quoted before you book is a claim about a floor of GPs that does
     not exist yet, so it follows the dashboard into a dash. The queue you are
     actually sitting in is different — that one this session really does
     produce, and it reads as a real number. */
  set('[data-entry="price"]', price.amount);
  set('[data-entry="eta"]', shown(estimate.etaSeconds, formatEta));

  $('[data-start]').addEventListener('click', () => {
    booking = createBooking();
    $('#practice').value = account.nhsPractice;
    $('#postcode').value = '';
    $('#details').value = '';
    for (const box of $$('[data-form="safety"] input')) box.checked = false;
    syncSafety();
    router.show('symptoms');
  });

  /* --- symptoms --------------------------------------------------------- */

  $('[data-form="symptoms"]').addEventListener('submit', (event) => {
    event.preventDefault();
    const complaint = $$('[name="main-symptom"]').find((r) => r.checked)?.value ?? 'other';
    const details = $('#details').value.trim();
    if (complaint === 'other' && details.length < 3) {
      return fail('symptoms', 'Tell us in a few words what is wrong, so the GP knows what they are taking.');
    }
    clearError('symptoms');
    booking = { ...booking, complaint, duration: $('#duration').value, details };
    router.show('safety-check');
    return true;
  });

  /* --- safety check ------------------------------------------------------ */

  /* The button says what it will do. Ticking a red flag does not hide the way
     forward, it changes where forward goes — a patient in trouble should never
     have to find a second, differently-worded control. */
  const safetyForm = $('[data-form="safety"]');
  const safetyButton = $('[data-safety-continue]');

  function tickedFlags() {
    return $$('[data-form="safety"] input:checked').map((box) => ({
      value: box.value,
      label: box.parentElement.textContent.trim(),
    }));
  }
  function syncSafety() {
    safetyButton.textContent = tickedFlags().length
      ? 'Continue — this needs emergency care'
      : 'None of these — continue';
  }
  safetyForm.addEventListener('change', syncSafety);
  safetyForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const flags = tickedFlags();
    booking = { ...booking, flags };
    router.show(flags.length ? 'red-flag' : 'identity');
  });

  /* --- identity ---------------------------------------------------------- */

  const identityAction = $('[data-identity="action"]');

  function paintIdentity() {
    // Nothing has launched, so nobody has an ID already on file. Seeded mode
    // is the returning patient; placeholder mode walks the check.
    const alreadyOnFile = isSeeded() && account.identityVerified;
    const done = booking.identityVerified || alreadyOnFile;
    $('[data-identity="pill"]').textContent = done ? 'Verified' : 'Not started';
    $('[data-identity="pill"]').dataset.status = done ? 'valid' : 'pending';
    set('[data-identity="title"]', done ? 'Photo ID already verified' : 'Photo ID and a selfie');
    set('[data-identity="note"]', done
      ? `Stripe Identity checked your ID when you joined in ${account.memberSince}. Nothing to do.`
      : "You'll be asked to photograph your ID and take a quick selfie. This takes about a minute.");
    identityAction.textContent = done ? 'Continue' : 'Verify identity';
    identityAction.disabled = false;
  }

  identityAction.addEventListener('click', () => {
    if (booking.identityVerified || (isSeeded() && account.identityVerified)) {
      booking = { ...booking, identityVerified: true };
      router.show('nhs-gp');
      return;
    }
    identityAction.disabled = true;
    identityAction.textContent = 'Checking your ID…';
    setTimeout(() => {
      booking = { ...booking, identityVerified: true };
      paintIdentity();
      router.show('nhs-gp');
    }, 1600);
  });

  /* --- NHS GP and consent ------------------------------------------------ */

  const nhsForm = $('[data-form="nhs"]');
  let consentChoice = 'yes';
  for (const button of $$('[data-consent]')) {
    button.addEventListener('click', () => { consentChoice = button.dataset.consent; });
  }

  nhsForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const practice = $('#practice').value.trim();
    const postcode = $('#postcode').value.trim();
    if (practice.length < 3) return fail('nhs', 'We need the name of your NHS GP practice.');
    if (!POSTCODE.test(postcode)) return fail('nhs', 'That does not look like a UK postcode. Check it and try again.');
    clearError('nhs');
    booking = { ...booking, practice, postcode, nhsGpConsent: consentChoice === 'yes' };
    router.show(booking.nhsGpConsent ? 'price-wait' : 'consent-refused');
    return true;
  });

  $('[data-consent-continue]').addEventListener('click', () => router.show('price-wait'));
  $('[data-consent-change]').addEventListener('click', () => router.show('nhs-gp'));

  /* --- price and authorisation -------------------------------------------- */

  set('[data-price-note]', price.note);
  set('[data-price-eta]', shown(estimate.etaSeconds, formatEta));
  set('[data-price="card"]', `${account.cardBrand} ending ${account.cardLast4}`);

  const authorise = $('[data-authorise]');
  authorise.addEventListener('click', () => {
    const card = $$('[name="card"]').find((r) => r.checked)?.value ?? 'ok';
    authorise.disabled = true;
    authorise.textContent = 'Authorising £39…';
    setTimeout(() => {
      authorise.disabled = false;
      authorise.textContent = 'Authorise payment';
      if (card === 'declined') { router.show('payment-failed'); return; }
      booking = { ...booking, card, authorised: true };
      router.show('queue');
    }, 900);
  });

  /* --- the queue ---------------------------------------------------------- */

  const bar = $('[data-queue-bar]');
  let queue = { ...estimate };

  function paintQueue() {
    set('[data-queue-position]', String(queue.position));
    set('[data-queue-eta]', formatEta(queue.etaSeconds));
    const done = 1 - queue.etaSeconds / estimate.etaSeconds;
    bar.style.width = `${Math.round(Math.min(1, Math.max(0, done)) * 100)}%`;
  }

  function resolveMatch() {
    stopTimer();
    const match = matchGp(gps, prescribing, booking);
    if (!match) { booking = { ...booking, authorised: false }; router.show('no-gp-available'); return; }
    booking = { ...booking, gp: match };
    showToast('Your GP is ready', `${match.ref} has accepted your consultation.`, 'Join', 'doctor-ready');
    router.show('doctor-ready');
  }

  function runQueue() {
    queue = { ...estimate };
    paintQueue();
    stopTimer = startInterval(() => {
      queue = tickQueue(queue);
      paintQueue();
      if (queue.etaSeconds === 0) resolveMatch();
    }, 1000);
  }

  $('[data-skip-wait]').addEventListener('click', resolveMatch);

  $('[data-cancel]').addEventListener('click', () => {
    stopTimer();
    onComplete(consultationRecord({ ...booking, status: 'cancelled' }, {
      id: config.nextId(), date: config.today, fee,
    }));
    router.show('cancelled');
  });

  /* --- the GP that was matched --------------------------------------------- */

  function paintReady() {
    const gp = booking.gp;
    if (!gp) return;
    set('[data-ready="gp"]', gp.ref);
    $('[data-ready="reasons"]').innerHTML = gp.reasons.map((r) => `<li>${r}</li>`).join('');
    $('[data-ready="limited"]').hidden = !gp.limitedPrescribing;
  }

  $('[data-join]').addEventListener('click', () => { hideToast(); router.show('consultation'); });

  /* --- the call ------------------------------------------------------------ */

  const frame = $('[data-call="gp"]');

  function runCall() {
    booking = { ...booking, seconds: 0 };
    frame.textContent = `${booking.gp?.ref ?? 'Your GP'} · connected`;
    frame.dataset.live = 'true';
    set('[data-call="clock"]', formatClock(0));
    stopTimer = startInterval(() => {
      booking.seconds += 1;
      set('[data-call="clock"]', formatClock(booking.seconds));
    }, 1000);
  }

  $('[data-end-call]').addEventListener('click', () => {
    stopTimer();
    frame.dataset.live = 'false';
    if (endedEarly(booking.seconds)) {
      set('[data-early="lead"]', `The call lasted ${formatClock(booking.seconds)}. `
        + 'Don\'t worry — the GP will still complete your outcome summary.');
      router.show('consult-ended-early');
      return;
    }
    router.show('outcome');
  });

  /* --- the outcome ---------------------------------------------------------- */

  function paintOutcome() {
    const outcome = outcomeFor(booking);
    const complaint = COMPLAINTS[booking.complaint]?.label ?? 'your symptoms';
    set('[data-outcome="lead"]', `${booking.gp?.ref ?? 'Your GP'} · ${complaint.toLowerCase()} · ${formatClock(booking.seconds)}`);
    const cards = [
      outcome.note,
      outcome.prescription
        ? 'The pharmacy charges you separately for the medicine itself.'
        : 'No prescription was issued for this consultation.',
      outcome.fitNote ? 'A fit note has been issued.' : 'A fit note was not issued.',
      outcome.sharedWithNhsGp
        ? `A summary will be sent to ${booking.practice || account.nhsPractice}, as you agreed.`
        : 'Nothing was sent to your NHS GP — you chose not to share.',
    ];
    $('[data-outcome="cards"]').innerHTML = cards
      .map((text) => `<div class="card" style="margin-top:var(--s-4)"><p style="margin:0">${text}</p></div>`)
      .join('');
  }

  function paintDone(record) {
    $('[data-done="facts"]').innerHTML = [
      ['Reference', record.id],
      ['GP', record.gp],
      ['Length', `${record.minutes} minute${record.minutes === 1 ? '' : 's'}`],
      ['Paid', `£${fee}`],
      ['Recording', 'The call was not recorded'],
    ].map(([term, value]) => `<div><b>${term}</b><span>${value}</span></div>`).join('');
    set('[data-done="lead"]', `Your consultation is saved to your account as ${record.id}. `
      + "You'll receive a summary by email.");
  }

  $('[data-complete]').addEventListener('click', () => {
    const record = consultationRecord(booking, { id: config.nextId(), date: config.today, fee });
    onComplete(record);
    paintDone(record);
    router.show('done');
  });

  /* --- red flags ------------------------------------------------------------ */

  function paintRedFlag() {
    const flags = booking.flags ?? [];
    $('[data-flag="list"]').innerHTML = flags.length
      ? `<p style="margin:0 0 var(--s-2);font-weight:700">You told us:</p><ul class="reasons">${
        flags.map((f) => `<li>${f.label}</li>`).join('')}</ul>`
      : '<p style="margin:0">Anything on that list needs emergency care, not a video consultation.</p>';
  }

  /* --- arriving on a screen -------------------------------------------------- */

  const onEnter = {
    identity: paintIdentity,
    queue: runQueue,
    'doctor-ready': paintReady,
    consultation: runCall,
    outcome: paintOutcome,
    'red-flag': paintRedFlag,
  };

  doc.addEventListener('screenchange', (event) => {
    stopTimer();
    stopTimer = () => {};
    if (!['queue', 'doctor-ready'].includes(event.detail.id)) hideToast();
    onEnter[event.detail.id]?.();
  });

  /* Every screen is on the rail, so none may be blank — but "not blank" is
     not a licence to invent a consultation that never happened. Seeded mode
     gets the worked example; placeholder mode gets an empty state that says
     what to do about it. */
  const NOTHING_YET = 'Nothing here yet. Start a consultation and this screen '
    + 'fills with what actually happened.';

  if (isSeeded()) {
    booking = { ...booking, gp: matchGp(gps, prescribing, booking) };
    paintReady();
    paintOutcome();
    paintDone(consultationRecord(booking, { id: config.nextId(), date: config.today, fee }));
  } else {
    // Drop the worked example entirely, so nothing downstream reads from it.
    booking = createBooking();
    set('[data-ready="gp"]', DASH);
    $('[data-ready="reasons"]').innerHTML = emptyState('No GP has been matched yet.');
    $('[data-ready="limited"]').hidden = true;
    $('[data-outcome="cards"]').innerHTML = emptyState(NOTHING_YET);
    set('[data-outcome="lead"]', '');
    $('[data-done="facts"]').innerHTML = emptyState(NOTHING_YET);
  }

  paintIdentity();
  paintRedFlag();

  if (onEnter[router.current()]) onEnter[router.current()]();

  return { booking: () => booking };
}
