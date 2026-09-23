/* The shift as a state machine. One piece of state — online or offline —
   with the offer, the consultation and the terminal states arranged around
   it. Pure: every transition takes state and returns state, so it can be
   tested without a browser, and the URL follows it rather than driving it. */
import { OFFER } from '@/lib/fixtures';
import type { SessionRecord } from '@/lib/earnings';

export const SESSION_SCREENS = [
  'offline', 'online-idle', 'no-patients-waiting', 'offer', 'offer-consent-refused',
  'consultation', 'complete', 'offer-declined', 'offer-timed-out', 'patient-no-show',
] as const;
export type SessionScreen = (typeof SESSION_SCREENS)[number];

export const OFFER_WINDOW_SECONDS = OFFER.windowSeconds; // 45
export const OFFER_AFTER_MS = 8000;                       // how long an idle GP waits before something happens

export type SessionState = {
  screen: SessionScreen;
  online: boolean;
  blocked: boolean;
  nav: number;                     // bumped by every non-jump action that changes the screen; the URL follows this, never `screen` alone
  onlineSince: number | null;
  consultationStartedAt: number | null;
  offerExpiresAt: number | null;   // wall clock: a hidden tab cannot stretch the window
  offerRemaining: number;
  offerConsent: boolean;
  offersSeen: number;
  completed: SessionRecord[];
  lastConsultSeconds: number;
};

export type SessionAction =
  | { type: 'jump'; screen: SessionScreen; now: number }
  | { type: 'setBlocked'; blocked: boolean }
  | { type: 'goOnline'; now: number }
  | { type: 'goOffline' }
  | { type: 'offerArrives'; consent: boolean; now: number }
  | { type: 'noPatients' }
  | { type: 'tickOffer'; now: number }
  | { type: 'accept'; now: number }
  | { type: 'decline' }
  | { type: 'complete'; now: number; id: string; when: string }
  | { type: 'noShow' }
  | { type: 'backOnline'; now: number };

const OFFER_SCREENS = new Set<SessionScreen>(['offer', 'offer-consent-refused']);
const TERMINAL = new Set<SessionScreen>(['complete', 'offer-declined', 'offer-timed-out', 'patient-no-show']);
const IDLE = new Set<SessionScreen>(['online-idle', 'no-patients-waiting']);
const WINDOW_MS = OFFER_WINDOW_SECONDS * 1000;

export function initialSession(screen: SessionScreen | null, { blocked, now }: { blocked: boolean; now: number }): SessionState {
  const base: SessionState = {
    screen: 'offline', online: false, blocked, nav: 0, onlineSince: null, consultationStartedAt: null,
    offerExpiresAt: null, offerRemaining: OFFER_WINDOW_SECONDS, offerConsent: true, offersSeen: 0,
    completed: [], lastConsultSeconds: 0,
  };
  return screen && screen !== 'offline' ? sessionReducer(base, { type: 'jump', screen, now }) : base;
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  // A screen change the GP (or a timer) caused: the URL must follow it.
  const move = (patch: Partial<SessionState>): SessionState => ({ ...state, ...patch, nav: state.nav + 1 });

  switch (action.type) {
    case 'jump': {
      const online = action.screen !== 'offline';
      const onOffer = OFFER_SCREENS.has(action.screen);
      return {
        ...state,
        screen: action.screen,
        online,
        onlineSince: online ? (state.onlineSince ?? action.now) : null,
        offerExpiresAt: onOffer ? action.now + WINDOW_MS : null,
        offerRemaining: onOffer ? OFFER_WINDOW_SECONDS : state.offerRemaining,
        offerConsent: action.screen === 'offer-consent-refused' ? false : action.screen === 'offer' ? true : state.offerConsent,
        consultationStartedAt: action.screen === 'consultation' ? action.now : null,
      };
    }
    case 'setBlocked':
      return state.blocked === action.blocked ? state : { ...state, blocked: action.blocked };
    case 'goOnline':
      if (state.screen !== 'offline' || state.blocked) return state;
      return move({ screen: 'online-idle', online: true, onlineSince: action.now });
    case 'goOffline':
      if (state.screen === 'consultation' || state.screen === 'offline') return state;
      return move({ screen: 'offline', online: false, onlineSince: null, offerExpiresAt: null });
    case 'offerArrives':
      if (!IDLE.has(state.screen)) return state;
      return move({
        screen: action.consent ? 'offer' : 'offer-consent-refused',
        offerExpiresAt: action.now + WINDOW_MS, offerRemaining: OFFER_WINDOW_SECONDS,
        offerConsent: action.consent, offersSeen: state.offersSeen + 1,
      });
    case 'noPatients':
      return state.screen === 'online-idle' ? move({ screen: 'no-patients-waiting' }) : state;
    case 'tickOffer': {
      if (!OFFER_SCREENS.has(state.screen) || state.offerExpiresAt === null) return state;
      const remaining = Math.max(0, Math.ceil((state.offerExpiresAt - action.now) / 1000));
      if (remaining === 0) return move({ screen: 'offer-timed-out', offerRemaining: 0, offerExpiresAt: null });
      return remaining === state.offerRemaining ? state : { ...state, offerRemaining: remaining };
    }
    case 'accept':
      if (!OFFER_SCREENS.has(state.screen)) return state;
      return move({ screen: 'consultation', consultationStartedAt: action.now, offerExpiresAt: null });
    case 'decline':
      return OFFER_SCREENS.has(state.screen) ? move({ screen: 'offer-declined', offerExpiresAt: null }) : state;
    case 'complete': {
      if (state.screen !== 'consultation') return state;
      const seconds = Math.max(0, Math.floor((action.now - (state.consultationStartedAt ?? action.now)) / 1000));
      const record: SessionRecord = {
        id: action.id, when: action.when, ageBand: OFFER.ageBand,
        minutes: Math.max(1, Math.round(seconds / 60)), outcome: 'Recorded in Semble',
        fee: OFFER.fee,   // what the GP accepted this consultation for, not a flat rate
        isNew: true,
      };
      return move({ screen: 'complete', completed: [record, ...state.completed], lastConsultSeconds: seconds, consultationStartedAt: null });
    }
    case 'noShow':
      return state.screen === 'consultation' ? move({ screen: 'patient-no-show', consultationStartedAt: null }) : state;
    case 'backOnline':
      if (!TERMINAL.has(state.screen)) return state;
      return move({ screen: 'online-idle', online: true, onlineSince: state.onlineSince ?? action.now });
    default:
      return state;
  }
}

const SESSION_ROOT = '/doctor/session';

/* The bare path has no opinion: an in-app link to /doctor/session must never
   knock an online GP offline, so only a named state seeds the reducer. */
export function sessionScreenFromPath(pathname: string): SessionScreen | null {
  if (!pathname.startsWith(`${SESSION_ROOT}/`)) return null;
  const tail = pathname.slice(SESSION_ROOT.length + 1).replace(/\/+$/g, '');
  return (SESSION_SCREENS as readonly string[]).includes(tail) ? (tail as SessionScreen) : null;
}

export function sessionHref(screen: SessionScreen): string {
  return `${SESSION_ROOT}/${screen}`;
}
