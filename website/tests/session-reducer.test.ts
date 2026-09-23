import { test, expect, describe } from 'vitest';
import { OFFER } from '@/lib/fixtures';
import {
  SESSION_SCREENS, OFFER_WINDOW_SECONDS, initialSession, sessionReducer, sessionScreenFromPath, sessionHref,
  type SessionScreen, type SessionState, type SessionAction,
} from '@/lib/session';

const T0 = Date.parse('2026-08-28T14:00:00Z');
const at = (screen: SessionScreen, extra: Partial<SessionState> = {}): SessionState =>
  ({ ...initialSession(screen, { blocked: false, now: T0 }), ...extra });

describe('initial state', () => {
  test('null seeds offline; a screen seeds that screen', () => {
    expect(initialSession(null, { blocked: false, now: T0 }).screen).toBe('offline');
    expect(initialSession('offer', { blocked: false, now: T0 })).toMatchObject({ screen: 'offer', online: true, offerRemaining: OFFER_WINDOW_SECONDS });
    expect(initialSession('consultation', { blocked: false, now: T0 }).consultationStartedAt).toBe(T0);
  });
  test('the blocked flag is carried', () => {
    expect(initialSession(null, { blocked: true, now: T0 }).blocked).toBe(true);
  });
});

describe('legal transitions', () => {
  test('offline → goOnline → online-idle', () => {
    const s = sessionReducer(at('offline'), { type: 'goOnline', now: T0 });
    expect(s).toMatchObject({ screen: 'online-idle', online: true, onlineSince: T0 });
  });
  test.each(['online-idle', 'no-patients-waiting', 'offer', 'offer-consent-refused', 'complete', 'offer-declined', 'offer-timed-out', 'patient-no-show'] as const)(
    '%s → goOffline → offline', (screen) => {
      expect(sessionReducer(at(screen), { type: 'goOffline' })).toMatchObject({ screen: 'offline', online: false, onlineSince: null });
    });
  test.each(['online-idle', 'no-patients-waiting'] as const)('%s → offerArrives → offer (consent) / offer-consent-refused', (screen) => {
    expect(sessionReducer(at(screen), { type: 'offerArrives', consent: true, now: T0 })).toMatchObject({ screen: 'offer', offerRemaining: 45, offerExpiresAt: T0 + 45_000, offerConsent: true, offersSeen: 1 });
    expect(sessionReducer(at(screen), { type: 'offerArrives', consent: false, now: T0 })).toMatchObject({ screen: 'offer-consent-refused', offerConsent: false });
  });
  test('online-idle → noPatients → no-patients-waiting', () => {
    expect(sessionReducer(at('online-idle'), { type: 'noPatients' }).screen).toBe('no-patients-waiting');
  });
  test.each(['offer', 'offer-consent-refused'] as const)('%s counts down on the wall clock and times out at zero', (screen) => {
    const s = at(screen);                                                  // offerExpiresAt = T0 + 45_000
    expect(sessionReducer(s, { type: 'tickOffer', now: T0 + 1_000 }).offerRemaining).toBe(44);
    expect(sessionReducer(s, { type: 'tickOffer', now: T0 + 30_000 }).offerRemaining).toBe(15);
    expect(sessionReducer(s, { type: 'tickOffer', now: T0 })).toBe(s);   // nothing changed → same object
    // A hidden tab that comes back late has missed the window: the offer moved on.
    expect(sessionReducer(s, { type: 'tickOffer', now: T0 + 60_000 })).toMatchObject({ screen: 'offer-timed-out', offerRemaining: 0 });
  });
  test('every screen-changing action bumps nav once; jump and setBlocked never do', () => {
    const s = at('offline');
    expect(sessionReducer(s, { type: 'goOnline', now: T0 }).nav).toBe(s.nav + 1);
    expect(sessionReducer(at('offer'), { type: 'accept', now: T0 }).nav).toBe(1);
    expect(sessionReducer(at('offer'), { type: 'jump', screen: 'consultation', now: T0 }).nav).toBe(0);
    expect(sessionReducer(at('offer'), { type: 'setBlocked', blocked: true }).nav).toBe(0);
    expect(sessionReducer(at('offer'), { type: 'tickOffer', now: T0 + 1_000 }).nav).toBe(0);   // a tick that stays on the screen
    expect(sessionReducer(at('offer'), { type: 'tickOffer', now: T0 + 60_000 }).nav).toBe(1);  // a tick that times out
  });
  test.each(['offer', 'offer-consent-refused'] as const)('%s → accept → consultation; → decline → offer-declined', (screen) => {
    expect(sessionReducer(at(screen), { type: 'accept', now: T0 })).toMatchObject({ screen: 'consultation', consultationStartedAt: T0 });
    expect(sessionReducer(at(screen), { type: 'decline' }).screen).toBe('offer-declined');
  });
  test('consultation → complete records one consultation of at least a minute', () => {
    const s = sessionReducer(at('consultation'), { type: 'complete', now: T0 + 545_000, id: 'C-0032', when: 'Today, 15:02' });
    expect(s.screen).toBe('complete');
    expect(s.completed).toEqual([{ id: 'C-0032', when: 'Today, 15:02', ageBand: '30–39', minutes: 9, outcome: 'Recorded in Semble', fee: OFFER.fee, isNew: true }]);
    expect(s.lastConsultSeconds).toBe(545);
    const short = sessionReducer(at('consultation'), { type: 'complete', now: T0 + 20_000, id: 'C-0033', when: 'Today, 15:03' });
    expect(short.completed[0].minutes).toBe(1);
  });
  test('consultation → noShow → patient-no-show, nothing recorded', () => {
    const s = sessionReducer(at('consultation'), { type: 'noShow' });
    expect(s).toMatchObject({ screen: 'patient-no-show', completed: [] });
  });
  test.each(['complete', 'offer-declined', 'offer-timed-out', 'patient-no-show'] as const)('%s → backOnline → online-idle', (screen) => {
    expect(sessionReducer(at(screen), { type: 'backOnline', now: T0 })).toMatchObject({ screen: 'online-idle', online: true });
  });
  test('jump seeds any screen and its timers', () => {
    for (const screen of SESSION_SCREENS) {
      const s = sessionReducer(at('offline'), { type: 'jump', screen, now: T0 });
      expect(s.screen).toBe(screen);
      expect(s.online).toBe(screen !== 'offline');
    }
  });
  test('setBlocked only changes the flag', () => {
    const s = at('online-idle');
    expect(sessionReducer(s, { type: 'setBlocked', blocked: true })).toEqual({ ...s, blocked: true });
  });
});

describe('illegal transitions return the same object', () => {
  const same = (state: SessionState, action: SessionAction) => expect(sessionReducer(state, action)).toBe(state);
  test('cannot go online with expired indemnity', () => same(at('offline', { blocked: true }), { type: 'goOnline', now: T0 }));
  test('cannot go offline mid-consultation', () => same(at('consultation'), { type: 'goOffline' }));
  test('goOnline only from offline', () => { for (const s of SESSION_SCREENS.filter((x) => x !== 'offline')) same(at(s), { type: 'goOnline', now: T0 }); });
  test('goOffline from offline is a no-op', () => same(at('offline'), { type: 'goOffline' }));
  test('an offer only arrives while idle', () => { for (const s of SESSION_SCREENS.filter((x) => x !== 'online-idle' && x !== 'no-patients-waiting')) same(at(s), { type: 'offerArrives', consent: true, now: T0 }); });
  test('noPatients only from online-idle', () => { for (const s of SESSION_SCREENS.filter((x) => x !== 'online-idle')) same(at(s), { type: 'noPatients' }); });
  test('tick, accept and decline only on an offer', () => {
    for (const s of SESSION_SCREENS.filter((x) => x !== 'offer' && x !== 'offer-consent-refused')) {
      same(at(s), { type: 'tickOffer', now: T0 + 1_000 }); same(at(s), { type: 'accept', now: T0 }); same(at(s), { type: 'decline' });
    }
  });
  test('complete and noShow only from consultation', () => {
    for (const s of SESSION_SCREENS.filter((x) => x !== 'consultation')) {
      same(at(s), { type: 'complete', now: T0, id: 'C-0032', when: 'Today' }); same(at(s), { type: 'noShow' });
    }
  });
  test('backOnline only from a terminal screen', () => {
    for (const s of ['offline', 'online-idle', 'no-patients-waiting', 'offer', 'offer-consent-refused', 'consultation'] as const) same(at(s), { type: 'backOnline', now: T0 });
  });
});

describe('paths', () => {
  test('sessionScreenFromPath has no opinion on the bare path', () => {
    expect(sessionScreenFromPath('/doctor/session')).toBeNull();
    expect(sessionScreenFromPath('/doctor/session/')).toBeNull();
    expect(sessionScreenFromPath('/doctor/session/patient-no-show')).toBe('patient-no-show');
    expect(sessionScreenFromPath('/doctor/session/nope')).toBeNull();
    expect(sessionScreenFromPath('/doctor')).toBeNull();
  });
  test('sessionHref', () => { expect(sessionHref('offer')).toBe('/doctor/session/offer'); });
});
