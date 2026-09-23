/* The consultation request as a state machine, from "See a GP now" to a
   receipt, with every fork a patient can meet on the way. Pure: every
   transition takes state and returns state, and the same object when an
   action does not apply, so the flow can be tested without a browser and the
   URL follows the state rather than driving it (lib/session.ts is the
   pattern this mirrors).

   Three rules are load-bearing, and each has a test:
   - The price is quoted once, when the quote screen is first reached, and is
     frozen from then on. Nothing after that moment may change it.
   - Money moves only by an explicit action. While a hold is live (finding a
     GP, matched, in the call, awaiting the outcome) a URL cannot move the
     booking; the provider puts the URL back instead.
   - Every clock is a wall-clock timestamp, so a hidden tab can neither stretch
     the queue nor stall it. */
import {
  COMPLAINTS, SECONDS_PER_PLACE, consultationRecord, endedEarly, matchGp, waitEstimate,
  type ConsultationRow,
} from '@/lib/booking';
import { GPS, PATIENT_ACCOUNT, PRESCRIBING } from '@/lib/fixtures';
import { floorFor, quoteFor } from '@/lib/pricing';

export const BOOKING_STEPS = [
  'symptoms', 'safety-check', 'identity', 'nhs-gp', 'quote', 'finding', 'ready', 'call', 'outcome', 'done',
] as const;
export const BOOKING_STATES = [
  'red-flag', 'consent-refused', 'no-gp-available', 'cancelled', 'payment-failed', 'ended-early',
] as const;
export const BOOKING_SCREENS = [...BOOKING_STEPS, ...BOOKING_STATES] as const;

export type BookingStep = (typeof BOOKING_STEPS)[number];
export type BookingStateId = (typeof BOOKING_STATES)[number];
export type BookingScreen = (typeof BOOKING_SCREENS)[number];
export type ComplaintId = keyof typeof COMPLAINTS;

export const COMPLAINT_IDS = Object.keys(COMPLAINTS) as ComplaintId[];
export const DURATIONS = ['Today', '2–3 days', 'Over a week'] as const;
export type Duration = (typeof DURATIONS)[number];

/* The red-flag questions. A checklist with a binary outcome, never a score:
   an urgency ranked by software would put the intake inside MHRA's
   software-as-a-medical-device scope. */
export const SAFETY_FLAGS = [
  { id: 'chest-pain', label: 'Chest pain or pressure' },
  { id: 'breathing', label: 'Severe difficulty breathing' },
  { id: 'bleeding', label: 'Heavy bleeding that will not stop' },
  { id: 'confusion', label: 'Sudden confusion or loss of consciousness' },
  { id: 'self-harm', label: 'Thoughts of suicide or serious self-harm' },
] as const;
export type SafetyFlagId = (typeof SAFETY_FLAGS)[number]['id'];

export const POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
export const COMPLAINT_ERROR = 'Choose the closest match to what’s wrong.';
export const DURATION_ERROR = 'Tell us how long you’ve had it.';
export const DETAILS_ERROR = 'Tell us in a few words what’s wrong, so the GP knows what to expect.';
export const PRACTICE_ERROR = 'We need the name of your NHS GP practice.';
export const POSTCODE_ERROR = 'That doesn’t look like a postcode. Check it and try again.';

/* The waits the prototype stages where a real service would answer. */
export const IDENTITY_CHECK_MS = 1600;
export const AUTHORISE_MS = 900;

export const BOOKING_ROOT = '/patient/book';

export type Hold =
  | { status: 'none' }
  | { status: 'authorised' | 'captured' | 'declined'; amount: number }
  | { status: 'released'; amount: number; reason: 'no-gp' | 'cancelled' };

export type MatchedGp = { ref: string; reasons: string[]; limitedPrescribing: boolean };
export type MatchableGp = { ref: string; online: boolean; credentials: Record<string, { status: string }> };
export type SavedPractice = { practice: string; postcode: string };

/* Every GP offline: how the prototype reaches "no GP available" from a live
   queue without touching the fixtures. */
export const NO_GP_ONLINE: MatchableGp[] = GPS.map((gp) => ({ ...gp, online: false }));

type Errors = {
  complaint: string | null;
  duration: string | null;
  details: string | null;
  practice: string | null;
  postcode: string | null;
};

export type BookingState = {
  screen: BookingScreen;
  nav: number;                  // bumped by every action that moves the screen; the URL follows this, never `screen` alone
  seeded: boolean;              // the data mode this booking runs under; it decides the floor a quote and a queue read
  complaint: ComplaintId | null;
  duration: Duration | null;
  details: string;
  flags: SafetyFlagId[];
  identityVerified: boolean;
  identityChecked: boolean;     // the ID check ran in this booking; the provider mirrors it into the account
  practice: string;
  postcode: string;
  nhsGpConsent: boolean | null;
  answered: SavedPractice | null; // what a valid NHS GP submit gave, a new object each time; a URL landing never sets it
  errors: Errors;
  quote: number | null;         // frozen the first time the quote screen is reached
  card: 'ok' | 'declined';
  hold: Hold;
  queue: { startedAt: number; totalSeconds: number } | null;
  position: number;             // derived from the wall clock at the last tick; what the screen shows
  etaSeconds: number;
  gp: MatchedGp | null;
  matchedAt: number | null;     // set by a real match, never by landing on a URL; drives the toast once
  callStartedAt: number | null;
  seconds: number;              // the call's length, fixed when it ends
  record: ConsultationRow | null;
};

export type BookingAction =
  | { type: 'jump'; screen: BookingScreen; now: number }
  | { type: 'setMode'; seeded: boolean; now: number }
  | { type: 'start'; prefill?: SavedPractice | null }
  | { type: 'back' }
  | { type: 'setComplaint'; complaint: ComplaintId }
  | { type: 'setDuration'; duration: Duration }
  | { type: 'setDetails'; details: string }
  | { type: 'submitSymptoms' }
  | { type: 'toggleFlag'; flag: SafetyFlagId }
  | { type: 'submitSafety' }
  | { type: 'verifyIdentity' }
  | { type: 'confirmIdentity' }
  | { type: 'setPractice'; practice: string }
  | { type: 'setPostcode'; postcode: string }
  | { type: 'submitNhs'; consent: boolean }
  | { type: 'continueWithoutSharing' }
  | { type: 'changeAnswer' }
  | { type: 'setCard'; card: 'ok' | 'declined' }
  | { type: 'authorise'; now: number }
  | { type: 'retryCard' }
  | { type: 'tickQueue'; now: number; gps?: MatchableGp[] }
  | { type: 'skipWait'; now: number; gps?: MatchableGp[] }
  | { type: 'cancel'; id: string; date: string }
  | { type: 'join'; now: number }
  | { type: 'endCall'; now: number }
  | { type: 'continueToOutcome' }
  | { type: 'complete'; id: string; date: string }
  | { type: 'retry' };

const NO_ERRORS: Errors = { complaint: null, duration: null, details: null, practice: null, postcode: null };
const NO_HOLD: Hold = { status: 'none' };

/* A state screen counts as the step it forks from, for seeding and ordering. */
const STEP_OF: Partial<Record<BookingScreen, BookingStep>> = {
  'red-flag': 'safety-check', 'consent-refused': 'nhs-gp', 'payment-failed': 'quote',
  'no-gp-available': 'finding', cancelled: 'finding', 'ended-early': 'call',
};
const indexOf = (step: BookingStep) => BOOKING_STEPS.indexOf(step);
const positionOf = (screen: BookingScreen) => indexOf(STEP_OF[screen] ?? (screen as BookingStep));

/* A consultation in progress: a hold is on the card and the patient is in the
   queue, matched, in the call or waiting on the outcome. */
const LIVE_SCREENS = new Set<BookingScreen>(['finding', 'ready', 'call', 'outcome', 'ended-early']);
const OVER_SCREENS = new Set<BookingScreen>(['done', 'cancelled', 'no-gp-available']);

export function isLive(state: BookingState): boolean {
  return LIVE_SCREENS.has(state.screen) && (state.hold.status === 'authorised' || state.hold.status === 'captured');
}

export function isOver(state: BookingState): boolean {
  return OVER_SCREENS.has(state.screen);
}

/* The in-flow back arrow. Only the screens before money moves have one. */
const BACK: Partial<Record<BookingScreen, BookingScreen>> = {
  'safety-check': 'symptoms', identity: 'safety-check', 'nhs-gp': 'identity', quote: 'nhs-gp',
  'consent-refused': 'nhs-gp', 'payment-failed': 'quote', 'red-flag': 'safety-check',
};

export function backTarget(screen: BookingScreen): BookingScreen | null {
  return BACK[screen] ?? null;
}

export function normalisePostcode(raw: string): string {
  const compact = raw.trim().toUpperCase().replace(/\s+/g, '');
  return compact.replace(/^(.+)(\d[A-Z]{2})$/, '$1 $2');
}

const practiceOk = (practice: string) => practice.trim().length >= 3;
const postcodeOk = (postcode: string) => POSTCODE.test(postcode.trim());

function fresh(seeded: boolean, prefill?: SavedPractice | null): BookingState {
  // A returning patient's practice is on file; this session's answer, when
  // there is one, wins. A first patient types it.
  const saved = prefill ?? (seeded ? { practice: PATIENT_ACCOUNT.nhsPractice, postcode: PATIENT_ACCOUNT.nhsPostcode } : null);
  return {
    screen: 'symptoms', nav: 0, seeded,
    complaint: null, duration: null, details: '', flags: [],
    identityVerified: false, identityChecked: false,
    practice: saved?.practice ?? '', postcode: saved?.postcode ?? '', nhsGpConsent: null, answered: null,
    errors: NO_ERRORS,
    quote: null, card: 'ok', hold: NO_HOLD,
    queue: null, position: 0, etaSeconds: 0,
    gp: null, matchedAt: null, callStartedAt: null, seconds: 0,
    record: null,
  };
}

/* Landing on a screen by URL. Seeded mode is the returning patient's worked
   example; blank mode is the first patient, and nothing clinical is invented
   for them: a screen that needs a GP, a call or an outcome this session never
   produced shows an honest empty state instead. Facts a screen asserts are
   filled only where they are missing, so jumping back never erases an answer. */
function seed(state: BookingState, screen: BookingScreen, now: number): BookingState {
  const i = positionOf(screen);
  const { seeded } = state;
  const s: BookingState = { ...state, screen, matchedAt: null };

  if (seeded && i > indexOf('symptoms')) {
    s.complaint ??= 'sore-throat';
    s.duration ??= '2–3 days';
  }
  if (i > indexOf('identity')) s.identityVerified = true;   // no screen past the check exists without passing it
  if (screen === 'consent-refused') s.nhsGpConsent = false;
  else if (seeded && i > indexOf('nhs-gp') && s.nhsGpConsent === null) s.nhsGpConsent = true;
  if (i >= indexOf('quote') && s.quote === null) s.quote = quoteFor(floorFor(seeded));

  const amount = s.quote ?? 0;
  switch (screen) {
    case 'payment-failed':
      s.hold = { status: 'declined', amount };
      s.card = 'declined';
      break;
    case 'finding': {
      // The queue you land in is a real one: it runs on the clock from now.
      const estimate = waitEstimate(floorFor(seeded));
      s.hold = { status: 'authorised', amount };
      s.queue = { startedAt: now, totalSeconds: estimate.etaSeconds };
      s.position = estimate.position;
      s.etaSeconds = estimate.etaSeconds;
      s.gp = null;
      s.callStartedAt = null;
      break;
    }
    case 'no-gp-available':
      s.hold = { status: 'released', amount, reason: 'no-gp' };
      s.queue = null;
      s.gp = null;
      break;
    case 'cancelled':
      s.hold = { status: 'released', amount, reason: 'cancelled' };
      s.queue = null;
      s.gp = null;
      break;
    case 'ready': case 'call': case 'ended-early': case 'outcome': case 'done':
      if (seeded) {
        s.gp ??= matchGp(GPS, PRESCRIBING, s);
        s.hold = { status: 'captured', amount };
        s.queue = null;
        s.position = 1;
        s.etaSeconds = 0;
        if (screen === 'call') { s.callStartedAt = now; s.seconds = 0; }
        else if (screen !== 'ready') { s.callStartedAt = null; s.seconds ||= screen === 'ended-early' ? 45 : 545; }
      } else {
        s.gp = null;
        s.hold = NO_HOLD;
        s.queue = null;
        s.callStartedAt = null;
        s.seconds = 0;
      }
      break;
    default:
      break;
  }
  return s;
}

export function initialBooking(screen: BookingScreen | null, { seeded, now }: { seeded: boolean; now: number }): BookingState {
  const base = fresh(seeded);
  return screen && screen !== 'symptoms' ? seed(base, screen, now) : base;
}

/* A queue that has run its course: the least-loaded eligible GP accepts, or
   nobody can and the hold is released in full. */
function resolve(state: BookingState, now: number, gps: MatchableGp[] = GPS): BookingState {
  const match = matchGp(gps, PRESCRIBING, { nhsGpConsent: state.nhsGpConsent });
  const amount = state.quote ?? 0;
  if (!match) {
    return {
      ...state, screen: 'no-gp-available', nav: state.nav + 1,
      hold: { status: 'released', amount, reason: 'no-gp' }, queue: null, gp: null,
    };
  }
  return {
    ...state, screen: 'ready', nav: state.nav + 1,
    hold: { status: 'captured', amount }, queue: null, position: 1, etaSeconds: 0,
    gp: match, matchedAt: now,
  };
}

const sameErrors = (a: Errors, b: Errors) =>
  a.complaint === b.complaint && a.duration === b.duration && a.details === b.details
  && a.practice === b.practice && a.postcode === b.postcode;

export function bookingReducer(state: BookingState, action: BookingAction): BookingState {
  // A screen change the patient (or the queue) caused: the URL must follow it.
  const move = (patch: Partial<BookingState>): BookingState => ({ ...state, ...patch, nav: state.nav + 1 });

  switch (action.type) {
    case 'jump': {
      if (action.screen === state.screen || isLive(state)) return state;
      // A finished booking is not reopened by a URL: a new one starts.
      if (isOver(state)) return { ...seed(fresh(state.seeded), action.screen, action.now), nav: state.nav };
      return seed(state, action.screen, action.now);
    }
    case 'setMode': {
      if (action.seeded === state.seeded) return state;
      // The mode arrives after mount. Before the patient has done anything the
      // landing is simply re-seeded; after that the booking keeps what it has.
      if (state.nav === 0) return initialBooking(state.screen, { seeded: action.seeded, now: action.now });
      return { ...state, seeded: action.seeded };
    }
    case 'start':
      if (isLive(state)) return state;   // a consultation in progress is never abandoned by starting another
      return { ...fresh(state.seeded, action.prefill), nav: state.nav + 1 };
    case 'back': {
      const to = BACK[state.screen];
      if (!to) return state;
      return move(state.screen === 'consent-refused' ? { screen: to, nhsGpConsent: null } : { screen: to });
    }

    case 'setComplaint':
      if (state.screen !== 'symptoms') return state;
      return {
        ...state, complaint: action.complaint,
        errors: { ...state.errors, complaint: null, details: action.complaint === 'other' ? state.errors.details : null },
      };
    case 'setDuration':
      if (state.screen !== 'symptoms') return state;
      return { ...state, duration: action.duration, errors: { ...state.errors, duration: null } };
    case 'setDetails':
      if (state.screen !== 'symptoms') return state;
      return {
        ...state, details: action.details,
        errors: { ...state.errors, details: action.details.trim().length >= 3 ? null : state.errors.details },
      };
    case 'submitSymptoms': {
      if (state.screen !== 'symptoms') return state;
      const errors: Errors = {
        ...state.errors,
        complaint: state.complaint ? null : COMPLAINT_ERROR,
        duration: state.duration ? null : DURATION_ERROR,
        details: state.complaint === 'other' && state.details.trim().length < 3 ? DETAILS_ERROR : null,
      };
      if (errors.complaint || errors.duration || errors.details) {
        return sameErrors(errors, state.errors) ? state : { ...state, errors };
      }
      return move({ screen: 'safety-check', errors });
    }

    case 'toggleFlag':
      if (state.screen !== 'safety-check') return state;
      return {
        ...state,
        flags: state.flags.includes(action.flag) ? state.flags.filter((f) => f !== action.flag) : [...state.flags, action.flag],
      };
    case 'submitSafety':
      if (state.screen !== 'safety-check') return state;
      return move({ screen: state.flags.length > 0 ? 'red-flag' : 'identity' });

    case 'verifyIdentity':
      if (state.screen !== 'identity') return state;
      return move({ screen: 'nhs-gp', identityVerified: true, identityChecked: true });
    case 'confirmIdentity':
      if (state.screen !== 'identity') return state;
      return move({ screen: 'nhs-gp', identityVerified: true });

    case 'setPractice':
      if (state.screen !== 'nhs-gp') return state;
      return {
        ...state, practice: action.practice,
        errors: { ...state.errors, practice: practiceOk(action.practice) ? null : state.errors.practice },
      };
    case 'setPostcode':
      if (state.screen !== 'nhs-gp') return state;
      return {
        ...state, postcode: action.postcode,
        errors: { ...state.errors, postcode: postcodeOk(action.postcode) ? null : state.errors.postcode },
      };
    case 'submitNhs': {
      if (state.screen !== 'nhs-gp') return state;
      const errors: Errors = {
        ...state.errors,
        practice: practiceOk(state.practice) ? null : PRACTICE_ERROR,
        postcode: postcodeOk(state.postcode) ? null : POSTCODE_ERROR,
      };
      if (errors.practice || errors.postcode) {
        // A failed submit records no consent: the answer only counts with the form.
        return sameErrors(errors, state.errors) ? state : { ...state, errors };
      }
      const practice = state.practice.trim();
      const postcode = normalisePostcode(state.postcode);
      const submitted = { errors, practice, postcode, answered: { practice, postcode } };
      if (!action.consent) return move({ ...submitted, screen: 'consent-refused', nhsGpConsent: false });
      return move({ ...submitted, screen: 'quote', nhsGpConsent: true, quote: state.quote ?? quoteFor(floorFor(state.seeded)) });
    }
    case 'continueWithoutSharing':
      if (state.screen !== 'consent-refused') return state;
      return move({ screen: 'quote', quote: state.quote ?? quoteFor(floorFor(state.seeded)) });
    case 'changeAnswer':
      if (state.screen !== 'consent-refused') return state;
      return move({ screen: 'nhs-gp', nhsGpConsent: null });

    case 'setCard':
      if (state.screen !== 'quote' || state.card === action.card) return state;
      return { ...state, card: action.card };
    case 'authorise': {
      if (state.screen !== 'quote' || state.quote === null) return state;
      if (state.card === 'declined') return move({ screen: 'payment-failed', hold: { status: 'declined', amount: state.quote } });
      const estimate = waitEstimate(floorFor(state.seeded));
      return move({
        screen: 'finding', hold: { status: 'authorised', amount: state.quote },
        queue: { startedAt: action.now, totalSeconds: estimate.etaSeconds },
        position: estimate.position, etaSeconds: estimate.etaSeconds, gp: null, matchedAt: null,
      });
    }
    case 'retryCard':
      if (state.screen !== 'payment-failed') return state;
      return move({ screen: 'quote', card: 'ok', hold: NO_HOLD });

    case 'tickQueue': {
      if (state.screen !== 'finding' || state.queue === null) return state;
      const elapsed = Math.floor((action.now - state.queue.startedAt) / 1000);
      const remaining = Math.max(0, state.queue.totalSeconds - elapsed);
      if (remaining === 0) return resolve(state, action.now, action.gps);
      const position = Math.max(1, Math.ceil(remaining / SECONDS_PER_PLACE));
      return position === state.position && remaining === state.etaSeconds ? state : { ...state, position, etaSeconds: remaining };
    }
    case 'skipWait':
      if (state.screen !== 'finding' || state.queue === null) return state;
      return resolve(state, action.now, action.gps);
    case 'cancel': {
      if (state.screen !== 'finding') return state;
      const record = consultationRecord(
        { status: 'cancelled', gp: null, complaint: state.complaint ?? 'other', seconds: 0 },
        { id: action.id, date: action.date, fee: 0 },
      );
      return move({
        screen: 'cancelled', hold: { status: 'released', amount: state.quote ?? 0, reason: 'cancelled' },
        queue: null, gp: null, record,
      });
    }

    case 'join':
      if (state.screen !== 'ready' || state.gp === null) return state;
      return move({ screen: 'call', callStartedAt: action.now, seconds: 0, matchedAt: null });
    case 'endCall': {
      if (state.screen !== 'call' || state.callStartedAt === null) return state;
      const seconds = Math.max(0, Math.floor((action.now - state.callStartedAt) / 1000));
      return move({ screen: endedEarly(seconds) ? 'ended-early' : 'outcome', seconds, callStartedAt: null });
    }
    case 'continueToOutcome':
      if (state.screen !== 'ended-early') return state;
      return move({ screen: 'outcome' });
    case 'complete': {
      if (state.screen !== 'outcome' || state.quote === null || state.gp === null || state.record !== null) return state;
      const record = consultationRecord(
        { gp: state.gp, complaint: state.complaint ?? 'other', seconds: state.seconds, nhsGpConsent: state.nhsGpConsent },
        { id: action.id, date: action.date, fee: state.quote },
      );
      return move({ screen: 'done', record });
    }
    case 'retry':
      // Dynamic between requests is defensible; within one it never is. A new
      // request after nobody could take the last one is quoted afresh, in full.
      if (state.screen !== 'no-gp-available') return state;
      return move({ screen: 'quote', quote: quoteFor(floorFor(state.seeded)), hold: NO_HOLD, card: 'ok', record: null });
    default:
      return state;
  }
}

/* The bare /patient/book has no opinion: it shows whatever the booking is on. */
export function bookingScreenFromPath(pathname: string): BookingScreen | null {
  if (!pathname.startsWith(`${BOOKING_ROOT}/`)) return null;
  const tail = pathname.slice(BOOKING_ROOT.length + 1).replace(/\/+$/g, '');
  return (BOOKING_SCREENS as readonly string[]).includes(tail) ? (tail as BookingScreen) : null;
}

export function bookingHref(screen: BookingScreen): string {
  return `${BOOKING_ROOT}/${screen}`;
}

/* The five screens before a patient commits carry the stepper; after that the
   status of the request itself is the progress. */
export const STEPPER_STEPS: ReadonlyArray<{ id: BookingStep; label: string }> = [
  { id: 'symptoms', label: 'Symptoms' },
  { id: 'safety-check', label: 'Safety' },
  { id: 'identity', label: 'Identity' },
  { id: 'nhs-gp', label: 'NHS GP' },
  { id: 'quote', label: 'Price' },
];

export function complaintLabel(complaint: ComplaintId | null): string | null {
  return complaint ? COMPLAINTS[complaint].label : null;
}
