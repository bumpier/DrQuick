import { describe, test, expect } from 'vitest';
import {
  BOOKING_SCREENS, COMPLAINT_ERROR, DETAILS_ERROR, DURATION_ERROR, NO_GP_ONLINE, POSTCODE_ERROR, PRACTICE_ERROR,
  backTarget, bookingHref, bookingReducer, bookingScreenFromPath, initialBooking, isLive, isOver, normalisePostcode,
  type BookingAction, type BookingScreen, type BookingState,
} from '@/lib/booking-flow';
import { PATIENT_ACCOUNT } from '@/lib/fixtures';

const T0 = Date.parse('2026-08-28T14:00:00Z');
const blank = (screen: BookingScreen | null = null) => initialBooking(screen, { seeded: false, now: T0 });
const seeded = (screen: BookingScreen | null = null) => initialBooking(screen, { seeded: true, now: T0 });
const run = (state: BookingState, ...actions: BookingAction[]) => actions.reduce(bookingReducer, state);

// The answers a first patient gives on the way to the queue, as actions.
const ANSWERS: BookingAction[] = [
  { type: 'setComplaint', complaint: 'sore-throat' },
  { type: 'setDuration', duration: '2–3 days' },
  { type: 'submitSymptoms' },
  { type: 'submitSafety' },
  { type: 'verifyIdentity' },
  { type: 'setPractice', practice: 'Example Surgery' },
  { type: 'setPostcode', postcode: 'n19aa' },
  { type: 'submitNhs', consent: true },
];

describe('a fresh booking', () => {
  test('starts on symptoms with nothing chosen, nothing quoted and nothing held', () => {
    for (const state of [blank(), blank('symptoms')]) {
      expect(state).toMatchObject({
        screen: 'symptoms', nav: 0, complaint: null, duration: null, details: '', flags: [],
        quote: null, hold: { status: 'none' }, queue: null, gp: null, record: null, nhsGpConsent: null,
      });
    }
  });
  test('a returning patient’s practice is on file; a first patient types it', () => {
    expect(seeded()).toMatchObject({ practice: PATIENT_ACCOUNT.nhsPractice, postcode: 'N1 9AA' });
    expect(blank()).toMatchObject({ practice: '', postcode: '' });
  });
});

describe('landing on a URL', () => {
  test('every screen can be landed on, in both modes, without moving the URL or claiming a match', () => {
    for (const screen of BOOKING_SCREENS) {
      for (const state of [blank(screen), seeded(screen)]) {
        expect(state.screen).toBe(screen);
        expect(state.nav).toBe(0);
        expect(state.matchedAt).toBeNull();
        expect(state.record).toBeNull();
        expect(state.identityChecked).toBe(false);
      }
    }
  });
  test('the price is quoted from the quote step on: £40 for the returning patient, £32 for the first', () => {
    for (const screen of ['symptoms', 'safety-check', 'identity', 'nhs-gp', 'red-flag', 'consent-refused'] as const) {
      expect(seeded(screen).quote).toBeNull();
    }
    for (const screen of ['quote', 'finding', 'ready', 'call', 'outcome', 'done', 'payment-failed', 'no-gp-available', 'cancelled', 'ended-early'] as const) {
      expect(seeded(screen).quote).toBe(40);
      expect(blank(screen).quote).toBe(32);
    }
  });
  test('the queue you land in is a real one, running from now', () => {
    expect(seeded('finding')).toMatchObject({
      hold: { status: 'authorised', amount: 40 }, queue: { startedAt: T0, totalSeconds: 135 }, position: 3, etaSeconds: 135,
    });
    expect(blank('finding')).toMatchObject({
      hold: { status: 'authorised', amount: 32 }, queue: { startedAt: T0, totalSeconds: 45 }, position: 1, etaSeconds: 45,
    });
    expect(isLive(blank('finding'))).toBe(true);
  });
  test('seeded mode lands on the worked example: GP-002 matched and the fee taken', () => {
    for (const screen of ['ready', 'call', 'outcome', 'done', 'ended-early'] as const) {
      expect(seeded(screen)).toMatchObject({ gp: { ref: 'GP-002' }, hold: { status: 'captured', amount: 40 } });
    }
    expect(seeded('call').callStartedAt).toBe(T0);
    expect(seeded('outcome').seconds).toBe(545);
    expect(seeded('done').seconds).toBe(545);
    expect(seeded('ended-early').seconds).toBe(45);
  });
  test('blank mode invents nothing clinical: no GP, no clock, no hold, and nothing live to lock', () => {
    for (const screen of ['ready', 'call', 'outcome', 'done', 'ended-early'] as const) {
      const state = blank(screen);
      expect(state).toMatchObject({ gp: null, callStartedAt: null, seconds: 0, hold: { status: 'none' } });
      expect(isLive(state)).toBe(false);
    }
  });
  test('the NHS answer is assumed only for the returning patient, and refused wherever the URL says so', () => {
    expect(seeded('quote').nhsGpConsent).toBe(true);
    expect(blank('quote').nhsGpConsent).toBeNull();
    expect(seeded('consent-refused').nhsGpConsent).toBe(false);
    expect(blank('consent-refused').nhsGpConsent).toBe(false);
  });
  test('no screen past the ID check exists without passing it', () => {
    expect(blank('identity').identityVerified).toBe(false);
    expect(blank('nhs-gp').identityVerified).toBe(true);
    expect(blank('finding').identityVerified).toBe(true);
  });
  test('each state lands with the hold its screen describes', () => {
    expect(seeded('payment-failed')).toMatchObject({ hold: { status: 'declined', amount: 40 }, card: 'declined' });
    expect(seeded('no-gp-available')).toMatchObject({ hold: { status: 'released', amount: 40, reason: 'no-gp' }, queue: null });
    expect(seeded('cancelled')).toMatchObject({ hold: { status: 'released', amount: 40, reason: 'cancelled' }, queue: null });
    expect(seeded('red-flag')).toMatchObject({ flags: [], hold: { status: 'none' } });
  });
});

describe('the walk from symptoms to receipt', () => {
  test('every step moves the screen once and the URL follows (nav counts the moves)', () => {
    let state = blank();
    const moves: Array<[BookingAction, BookingScreen]> = [
      [{ type: 'submitSymptoms' }, 'safety-check'],
    ];
    state = run(state, { type: 'setComplaint', complaint: 'sore-throat' }, { type: 'setDuration', duration: 'Today' });
    expect(state.nav).toBe(0);   // choosing is not moving
    for (const [action, screen] of moves) {
      const next = bookingReducer(state, action);
      expect(next.screen).toBe(screen);
      expect(next.nav).toBe(state.nav + 1);
      state = next;
    }
    state = run(state, { type: 'submitSafety' });
    expect(state.screen).toBe('identity');
    state = run(state, { type: 'verifyIdentity' });
    expect(state).toMatchObject({ screen: 'nhs-gp', identityVerified: true, identityChecked: true });
    state = run(state, { type: 'setPractice', practice: '  Example Surgery ' }, { type: 'setPostcode', postcode: 'n19aa' }, { type: 'submitNhs', consent: true });
    expect(state).toMatchObject({ screen: 'quote', nhsGpConsent: true, practice: 'Example Surgery', postcode: 'N1 9AA', quote: 32 });
    state = run(state, { type: 'authorise', now: T0 });
    expect(state).toMatchObject({ screen: 'finding', hold: { status: 'authorised', amount: 32 }, position: 1, etaSeconds: 45 });
    state = run(state, { type: 'tickQueue', now: T0 + 45_000 });
    expect(state).toMatchObject({ screen: 'ready', gp: { ref: 'GP-002', limitedPrescribing: false }, hold: { status: 'captured', amount: 32 }, matchedAt: T0 + 45_000 });
    state = run(state, { type: 'join', now: T0 + 60_000 });
    expect(state).toMatchObject({ screen: 'call', callStartedAt: T0 + 60_000, matchedAt: null });
    state = run(state, { type: 'endCall', now: T0 + 60_000 + 545_000 });
    expect(state).toMatchObject({ screen: 'outcome', seconds: 545, callStartedAt: null });
    state = run(state, { type: 'complete', id: 'C-0001', date: '28 August 2026' });
    expect(state.screen).toBe('done');
    expect(state.nav).toBe(9);
    expect(state.record).toMatchObject({
      id: 'C-0001', status: 'completed', gp: 'GP-002', minutes: 9, cost: 32, reason: 'Sore throat or cough',
      outcome: { prescription: true, sharedWithNhsGp: true },
    });
  });

  test('the quote is frozen: back, a declined card and a re-entry never change it', () => {
    let state = run(seeded(), ...ANSWERS);
    expect(state.quote).toBe(40);
    state = run(state, { type: 'back' });                                       // to nhs-gp
    state = run(state, { type: 'submitNhs', consent: true });                    // back to the quote
    expect(state.quote).toBe(40);
    state = run(state, { type: 'setCard', card: 'declined' }, { type: 'authorise', now: T0 });
    expect(state).toMatchObject({ screen: 'payment-failed', quote: 40, hold: { status: 'declined', amount: 40 }, queue: null });
    state = run(state, { type: 'retryCard' });
    expect(state).toMatchObject({ screen: 'quote', quote: 40, card: 'ok', hold: { status: 'none' } });
    state = run(state, { type: 'setMode', seeded: false, now: T0 });            // a mode change after acting
    expect(state.quote).toBe(40);
    state = run(state, { type: 'authorise', now: T0 }, { type: 'skipWait', now: T0 });
    expect(state).toMatchObject({ screen: 'ready', quote: 40, hold: { status: 'captured', amount: 40 } });
  });
});

describe('the forks', () => {
  test('symptoms: nothing chosen names both missing answers, stays put, and a repeat changes nothing', () => {
    const state = run(blank(), { type: 'submitSymptoms' });
    expect(state).toMatchObject({ screen: 'symptoms', nav: 0 });
    expect(state.errors).toMatchObject({ complaint: COMPLAINT_ERROR, duration: DURATION_ERROR, details: null });
    expect(bookingReducer(state, { type: 'submitSymptoms' })).toBe(state);
    const fixed = run(state, { type: 'setComplaint', complaint: 'skin' }, { type: 'setDuration', duration: 'Today' });
    expect(fixed.errors).toMatchObject({ complaint: null, duration: null });
  });
  test('symptoms: "Something else" needs a few words of detail', () => {
    const base = run(blank(), { type: 'setComplaint', complaint: 'other' }, { type: 'setDuration', duration: 'Today' });
    const short = run(base, { type: 'setDetails', details: 'ab' }, { type: 'submitSymptoms' });
    expect(short).toMatchObject({ screen: 'symptoms' });
    expect(short.errors.details).toBe(DETAILS_ERROR);
    expect(run(short, { type: 'setDetails', details: 'abc' }).errors.details).toBeNull();
    expect(run(short, { type: 'setDetails', details: 'abc' }, { type: 'submitSymptoms' }).screen).toBe('safety-check');
    expect(run(short, { type: 'setComplaint', complaint: 'skin' }).errors.details).toBeNull();
  });
  test('safety: any one flag sends the patient to 999; ticking twice unticks', () => {
    const atSafety = run(blank(), ...ANSWERS.slice(0, 3));
    for (const flag of ['chest-pain', 'breathing', 'bleeding', 'confusion', 'self-harm'] as const) {
      expect(run(atSafety, { type: 'toggleFlag', flag }, { type: 'submitSafety' })).toMatchObject({ screen: 'red-flag', flags: [flag] });
    }
    expect(run(atSafety, { type: 'toggleFlag', flag: 'breathing' }, { type: 'toggleFlag', flag: 'breathing' }).flags).toEqual([]);
    expect(run(atSafety, { type: 'submitSafety' }).screen).toBe('identity');
  });
  test('999: back returns to the checklist with the flags still ticked, so they can be corrected', () => {
    const atRedFlag = run(blank(), ...ANSWERS.slice(0, 3), { type: 'toggleFlag', flag: 'chest-pain' }, { type: 'submitSafety' });
    expect(run(atRedFlag, { type: 'back' })).toMatchObject({ screen: 'safety-check', flags: ['chest-pain'] });
  });
  test('identity: a check on file continues without being counted as a new check', () => {
    const atIdentity = run(seeded(), ...ANSWERS.slice(0, 4));
    expect(run(atIdentity, { type: 'confirmIdentity' })).toMatchObject({ screen: 'nhs-gp', identityVerified: true, identityChecked: false });
  });
  test('NHS GP: a bad practice or postcode stays put and records no consent', () => {
    const atNhs = run(blank(), ...ANSWERS.slice(0, 5));
    const failed = run(atNhs, { type: 'setPractice', practice: 'ab' }, { type: 'setPostcode', postcode: '12345' }, { type: 'submitNhs', consent: true });
    expect(failed).toMatchObject({ screen: 'nhs-gp', nhsGpConsent: null, quote: null });
    expect(failed.errors).toMatchObject({ practice: PRACTICE_ERROR, postcode: POSTCODE_ERROR });
    expect(bookingReducer(failed, { type: 'submitNhs', consent: false })).toBe(failed);
    for (const postcode of ['SW1A 1AA', 'n1 9aa', 'EC1A1BB']) {
      expect(run(failed, { type: 'setPractice', practice: 'Example Surgery' }, { type: 'setPostcode', postcode }, { type: 'submitNhs', consent: true }).screen).toBe('quote');
    }
    for (const postcode of ['12345', 'SW1A', '']) {
      expect(run(failed, { type: 'setPractice', practice: 'Example Surgery' }, { type: 'setPostcode', postcode }, { type: 'submitNhs', consent: true }).screen).toBe('nhs-gp');
    }
  });
  test('refusing to share is allowed, shown before any money moves, and costs the prescription', () => {
    const atNhs = run(blank(), ...ANSWERS.slice(0, 7));
    const refused = run(atNhs, { type: 'submitNhs', consent: false });
    expect(refused).toMatchObject({ screen: 'consent-refused', nhsGpConsent: false, quote: null, hold: { status: 'none' } });
    expect(run(refused, { type: 'changeAnswer' })).toMatchObject({ screen: 'nhs-gp', nhsGpConsent: null });
    expect(run(refused, { type: 'back' })).toMatchObject({ screen: 'nhs-gp', nhsGpConsent: null });
    let state = run(refused, { type: 'continueWithoutSharing' });
    expect(state).toMatchObject({ screen: 'quote', quote: 32, nhsGpConsent: false });
    state = run(state, { type: 'authorise', now: T0 }, { type: 'skipWait', now: T0 });
    expect(state.gp?.limitedPrescribing).toBe(true);
    state = run(state, { type: 'join', now: T0 }, { type: 'endCall', now: T0 + 300_000 }, { type: 'complete', id: 'C-0001', date: 'd' });
    expect(state.record?.outcome).toMatchObject({ prescription: false, referral: true, sharedWithNhsGp: false });
  });
  test('the queue is derived from the wall clock, never counted down', () => {
    const state = run(seeded(), ...ANSWERS, { type: 'authorise', now: T0 });
    expect(state).toMatchObject({ position: 3, etaSeconds: 135 });
    expect(run(state, { type: 'tickQueue', now: T0 + 1_000 })).toMatchObject({ position: 3, etaSeconds: 134 });
    expect(run(state, { type: 'tickQueue', now: T0 + 45_000 })).toMatchObject({ position: 2, etaSeconds: 90 });
    expect(run(state, { type: 'tickQueue', now: T0 + 90_000 })).toMatchObject({ position: 1, etaSeconds: 45 });
    expect(run(state, { type: 'tickQueue', now: T0 + 134_000 })).toMatchObject({ screen: 'finding', position: 1, etaSeconds: 1 });
    expect(run(state, { type: 'tickQueue', now: T0 + 135_000 })).toMatchObject({ screen: 'ready', gp: { ref: 'GP-002' } });
    expect(bookingReducer(state, { type: 'tickQueue', now: T0 + 400 })).toBe(state);   // nothing changed: same object
  });
  test('a tab that returns long after the wait resolves in one tick', () => {
    const state = run(seeded(), ...ANSWERS, { type: 'authorise', now: T0 });
    expect(run(state, { type: 'tickQueue', now: T0 + 600_000 })).toMatchObject({ screen: 'ready', nav: state.nav + 1 });
  });
  test('with no GP online the hold is released in full and nothing is written', () => {
    const state = run(seeded(), ...ANSWERS, { type: 'authorise', now: T0 });
    for (const action of [
      { type: 'tickQueue', now: T0 + 135_000, gps: NO_GP_ONLINE },
      { type: 'skipWait', now: T0, gps: NO_GP_ONLINE },
    ] as BookingAction[]) {
      expect(run(state, action)).toMatchObject({
        screen: 'no-gp-available', hold: { status: 'released', amount: 40, reason: 'no-gp' }, queue: null, gp: null, record: null,
      });
    }
  });
  test('trying again after no GP is a new request, quoted afresh, with nothing held', () => {
    const noGp = run(seeded(), ...ANSWERS, { type: 'authorise', now: T0 }, { type: 'skipWait', now: T0, gps: NO_GP_ONLINE });
    expect(run(noGp, { type: 'retry' })).toMatchObject({ screen: 'quote', quote: 40, hold: { status: 'none' }, card: 'ok' });
  });
  test('cancelling releases the hold and leaves a cancelled record that cost nothing', () => {
    const state = run(seeded(), ...ANSWERS, { type: 'authorise', now: T0 }, { type: 'cancel', id: 'C-0032', date: '28 August 2026' });
    expect(state).toMatchObject({ screen: 'cancelled', hold: { status: 'released', amount: 40, reason: 'cancelled' }, queue: null });
    expect(state.record).toMatchObject({ id: 'C-0032', status: 'cancelled', cost: 0, gp: null, outcome: null, minutes: 0 });
  });
  test('a call under two minutes ends early and still reaches the outcome', () => {
    const inCall = run(seeded(), ...ANSWERS, { type: 'authorise', now: T0 }, { type: 'skipWait', now: T0 }, { type: 'join', now: T0 });
    expect(run(inCall, { type: 'endCall', now: T0 + 45_000 })).toMatchObject({ screen: 'ended-early', seconds: 45 });
    expect(run(inCall, { type: 'endCall', now: T0 + 119_999 }).screen).toBe('ended-early');
    expect(run(inCall, { type: 'endCall', now: T0 + 120_000 }).screen).toBe('outcome');
    const early = run(inCall, { type: 'endCall', now: T0 + 45_000 }, { type: 'continueToOutcome' });
    expect(early.screen).toBe('outcome');
    expect(run(early, { type: 'complete', id: 'C-0032', date: 'd' }).record).toMatchObject({ minutes: 1, cost: 40 });
  });
  test('completing twice writes one record', () => {
    const outcome = seeded('outcome');
    const done = run(outcome, { type: 'complete', id: 'C-0032', date: 'd' });
    expect(done.record?.cost).toBe(40);
    expect(bookingReducer(done, { type: 'complete', id: 'C-0033', date: 'd' })).toBe(done);
  });
});

describe('the lock: money moves only by an explicit action', () => {
  test('a URL cannot move a live consultation', () => {
    const live = [
      run(seeded(), ...ANSWERS, { type: 'authorise', now: T0 }),
      seeded('ready'), seeded('call'), seeded('outcome'), seeded('ended-early'), blank('finding'),
    ];
    for (const state of live) {
      expect(isLive(state)).toBe(true);
      for (const screen of BOOKING_SCREENS) expect(bookingReducer(state, { type: 'jump', screen, now: T0 })).toBe(state);
    }
  });
  test('a consultation in progress is never abandoned by starting another', () => {
    const live = run(seeded(), ...ANSWERS, { type: 'authorise', now: T0 });
    expect(bookingReducer(live, { type: 'start' })).toBe(live);
  });
  test('before money moves a URL jumps freely and keeps the answers given', () => {
    const answered = run(blank(), { type: 'setComplaint', complaint: 'skin' }, { type: 'setDuration', duration: 'Today' });
    const jumped = run(answered, { type: 'jump', screen: 'quote', now: T0 }, { type: 'jump', screen: 'symptoms', now: T0 });
    expect(jumped).toMatchObject({ screen: 'symptoms', complaint: 'skin', duration: 'Today', nav: 0 });
  });
  test('a finished booking is not reopened by a URL: a new one starts there', () => {
    for (const over of [seeded('done'), seeded('cancelled'), seeded('no-gp-available')]) {
      expect(isOver(over)).toBe(true);
      const next = run({ ...over, nav: 5, complaint: 'stomach' }, { type: 'jump', screen: 'symptoms', now: T0 });
      expect(next).toMatchObject({ screen: 'symptoms', complaint: null, quote: null, hold: { status: 'none' }, nav: 5 });
    }
  });
  test('a blank landing that holds nothing is not locked, so a URL or a new start can leave it', () => {
    expect(run(blank('ready'), { type: 'jump', screen: 'symptoms', now: T0 }).screen).toBe('symptoms');
    expect(run(blank('call'), { type: 'start' })).toMatchObject({ screen: 'symptoms', nav: 1 });
  });
  test('starting again prefills the practice this session remembered', () => {
    const next = run(blank('done'), { type: 'start', prefill: { practice: 'Example Surgery', postcode: 'N1 9AA' } });
    expect(next).toMatchObject({ screen: 'symptoms', practice: 'Example Surgery', postcode: 'N1 9AA', nav: 1 });
  });
  test('only the screens before money moves have a way back', () => {
    expect(BOOKING_SCREENS.filter((screen) => backTarget(screen) !== null)).toEqual([
      'safety-check', 'identity', 'nhs-gp', 'quote', 'red-flag', 'consent-refused', 'payment-failed',
    ]);
    for (const screen of ['finding', 'ready', 'call', 'outcome', 'done', 'no-gp-available', 'cancelled', 'ended-early', 'symptoms'] as const) {
      const state = seeded(screen);
      expect(bookingReducer(state, { type: 'back' })).toBe(state);
    }
  });
});

describe('the data mode arrives after mount', () => {
  test('an untouched landing is re-seeded as the returning patient', () => {
    expect(run(blank('quote'), { type: 'setMode', seeded: true, now: T0 })).toMatchObject({ seeded: true, quote: 40, nav: 0 });
    expect(run(blank('ready'), { type: 'setMode', seeded: true, now: T0 }).gp?.ref).toBe('GP-002');
  });
  test('once the patient has acted the booking keeps what it has', () => {
    const acted = run(blank(), { type: 'setComplaint', complaint: 'skin' }, { type: 'setDuration', duration: 'Today' }, { type: 'submitSymptoms' });
    expect(run(acted, { type: 'setMode', seeded: true, now: T0 })).toMatchObject({ seeded: true, complaint: 'skin', screen: 'safety-check' });
  });
  test('the same mode twice changes nothing', () => {
    const state = seeded('quote');
    expect(bookingReducer(state, { type: 'setMode', seeded: true, now: T0 })).toBe(state);
  });
});

/* Every action belongs to one screen; from any other it is a no-op that
   returns the same object, so a double press or a stale timer can never act
   on a screen the patient has left. */
describe('an action from the wrong screen returns the same object', () => {
  const OWN: Array<[BookingAction, BookingScreen]> = [
    [{ type: 'setComplaint', complaint: 'skin' }, 'symptoms'],
    [{ type: 'setDuration', duration: 'Today' }, 'symptoms'],
    [{ type: 'setDetails', details: 'abc' }, 'symptoms'],
    [{ type: 'submitSymptoms' }, 'symptoms'],
    [{ type: 'toggleFlag', flag: 'chest-pain' }, 'safety-check'],
    [{ type: 'submitSafety' }, 'safety-check'],
    [{ type: 'verifyIdentity' }, 'identity'],
    [{ type: 'confirmIdentity' }, 'identity'],
    [{ type: 'setPractice', practice: 'Example Surgery' }, 'nhs-gp'],
    [{ type: 'setPostcode', postcode: 'N1 9AA' }, 'nhs-gp'],
    [{ type: 'submitNhs', consent: true }, 'nhs-gp'],
    [{ type: 'continueWithoutSharing' }, 'consent-refused'],
    [{ type: 'changeAnswer' }, 'consent-refused'],
    [{ type: 'setCard', card: 'declined' }, 'quote'],
    [{ type: 'authorise', now: T0 }, 'quote'],
    [{ type: 'retryCard' }, 'payment-failed'],
    [{ type: 'tickQueue', now: T0 + 1_000 }, 'finding'],
    [{ type: 'skipWait', now: T0 }, 'finding'],
    [{ type: 'cancel', id: 'C-0032', date: 'd' }, 'finding'],
    [{ type: 'join', now: T0 }, 'ready'],
    [{ type: 'endCall', now: T0 + 300_000 }, 'call'],
    [{ type: 'continueToOutcome' }, 'ended-early'],
    [{ type: 'complete', id: 'C-0032', date: 'd' }, 'outcome'],
    [{ type: 'retry' }, 'no-gp-available'],
  ];
  test.each(OWN.map(([action, own]) => [action.type, action, own] as const))('%s', (_type, action, own) => {
    for (const screen of BOOKING_SCREENS) {
      if (screen === own) continue;
      for (const state of [seeded(screen), blank(screen)]) {
        expect(bookingReducer(state, action), `${action.type} from ${screen}`).toBe(state);
      }
    }
  });
  test('each action does act from its own screen (the table above is not vacuous)', () => {
    for (const [action, own] of OWN) {
      if (action.type === 'tickQueue') continue;   // a tick that changes nothing is a same-object no-op by design
      expect(bookingReducer(seeded(own), action), `${action.type} from ${own}`).not.toBe(seeded(own));
    }
  });
});

describe('paths', () => {
  test('the bare booking route has no opinion; every screen round-trips', () => {
    expect(bookingScreenFromPath('/patient/book')).toBeNull();
    expect(bookingScreenFromPath('/patient/book/')).toBeNull();
    expect(bookingScreenFromPath('/patient/book/nope')).toBeNull();
    expect(bookingScreenFromPath('/patient')).toBeNull();
    for (const screen of BOOKING_SCREENS) {
      expect(bookingScreenFromPath(bookingHref(screen))).toBe(screen);
      expect(bookingScreenFromPath(`${bookingHref(screen)}/`)).toBe(screen);
    }
  });
  test('a postcode is kept the way the Royal Mail writes it', () => {
    expect(normalisePostcode(' n19aa ')).toBe('N1 9AA');
    expect(normalisePostcode('sw1a1aa')).toBe('SW1A 1AA');
    expect(normalisePostcode('EC1A  1BB')).toBe('EC1A 1BB');
  });
});

describe('the NHS GP answer the account keeps', () => {
  const atNhs = run(blank(), ...ANSWERS.slice(0, 5));
  const typed = (practice: string, consent: boolean) =>
    run(atNhs, { type: 'setPractice', practice }, { type: 'setPostcode', postcode: 'n19aa' }, { type: 'submitNhs', consent });

  test('a valid submit records the answer, trimmed and normalised, whichever way consent goes', () => {
    expect(atNhs.screen).toBe('nhs-gp');
    for (const consent of [true, false]) {
      expect(typed('  Example Surgery ', consent).answered).toEqual({ practice: 'Example Surgery', postcode: 'N1 9AA' });
    }
  });
  test('a failed submit records nothing', () => {
    expect(typed('ab', true).answered).toBeNull();
  });
  test('a URL landing is never an answer, in either mode, even where it seeds a consent', () => {
    for (const screen of BOOKING_SCREENS) {
      expect(blank(screen).answered).toBeNull();
      expect(seeded(screen).answered).toBeNull();
    }
    expect(seeded('quote').nhsGpConsent).toBe(true);
  });
  test('a corrected answer replaces the first as a new object', () => {
    const first = typed('Example Surgery', false);
    const corrected = run(first, { type: 'changeAnswer' }, { type: 'setPractice', practice: 'Another Surgery' }, { type: 'submitNhs', consent: false });
    expect(corrected.answered).toEqual({ practice: 'Another Surgery', postcode: 'N1 9AA' });
    expect(corrected.answered).not.toBe(first.answered);
  });
  test('the same answer submitted again is still a new object, so resubmitting is never ignored', () => {
    const first = typed('Example Surgery', false);
    const again = run(first, { type: 'changeAnswer' }, { type: 'submitNhs', consent: false });
    expect(again.answered).toEqual(first.answered);
    expect(again.answered).not.toBe(first.answered);
  });
  test('a new booking starts with no answer of its own', () => {
    const first = typed('Example Surgery', false);
    expect(bookingReducer(first, { type: 'start' }).answered).toBeNull();
  });
});
