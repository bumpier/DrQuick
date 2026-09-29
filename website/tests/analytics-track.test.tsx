// @vitest-environment jsdom
import { test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  _queuedForTests as queued, elementText, flush, getAttribution, isTrackedPath, newMilestones, pageview,
  resetTrackerForTests, scrollDepth, selectorFor, setConsent, startTracker, track, trackingMode, viewportBucket,
  type Payload,
} from '@/lib/analytics/track';
import { WaitlistForm } from '@/components/WaitlistForm';
import { GP_SECTIONS, PATIENT_SECTIONS } from '@/lib/analytics/sections';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const beacon = vi.fn((_url: string, _body: Blob) => true);

function clearCookies() {
  for (const name of ['dq_consent', 'dq_vid']) document.cookie = `${name}=; Max-Age=0; Path=/`;
}

// jsdom's Blob has no text(); FileReader does the same job.
const blobText = (blob: Blob) => new Promise<string>((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.readAsText(blob);
});

async function sent(): Promise<Payload[]> {
  return Promise.all(beacon.mock.calls.map(async ([, blob]) => JSON.parse(await blobText(blob)) as Payload));
}

beforeEach(() => {
  resetTrackerForTests();
  clearCookies();
  sessionStorage.clear();
  history.replaceState(null, '', '/');
  beacon.mockClear();
  Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });
  Object.defineProperty(navigator, 'globalPrivacyControl', { value: undefined, configurable: true });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/* ------------------------------------------------------------ pure helpers */

test('the admin, the prototypes, /dev, unsubscribe links and the API are never tracked', () => {
  for (const p of ['/', '/pricing', '/blog/some-post', '/administer']) expect(isTrackedPath(p), p).toBe(true);
  for (const p of ['/admin', '/admin/analytics', '/patient', '/patient/book/x', '/doctor', '/dev/ui', '/unsubscribe/abc', '/api/collect']) {
    expect(isTrackedPath(p), p).toBe(false);
  }
});

test('scroll depth is the viewport bottom as a share of the page, and milestones fire once', () => {
  expect(scrollDepth(0, 800, 4000)).toBe(20);
  expect(scrollDepth(1200, 800, 4000)).toBe(50);
  expect(scrollDepth(3200, 800, 4000)).toBe(100);
  expect(scrollDepth(9999, 800, 4000)).toBe(100);
  expect(scrollDepth(0, 800, 0)).toBe(100);
  expect(newMilestones(20, new Set())).toEqual([]);
  expect(newMilestones(80, new Set())).toEqual([25, 50, 75]);
  expect(newMilestones(95, new Set([25, 50, 75]))).toEqual([90]);
  expect(newMilestones(100, new Set([25, 50, 75, 90, 100]))).toEqual([]);
});

test('viewport buckets split at 640 and 1024', () => {
  expect([390, 639, 640, 1023, 1024, 1440].map(viewportBucket))
    .toEqual(['mobile', 'mobile', 'tablet', 'tablet', 'desktop', 'desktop']);
});

test('the selector is short, skips utility classes and stops at an id or a section', () => {
  document.body.innerHTML = `
    <main id="main"><section class="faq pt-section max-phone:px-4" data-section="patient-faq">
      <div class="grid"><details class="item open [&amp;_x]:y"><summary class="q">Is it private?</summary></details></div>
    </section></main>`;
  const summary = document.querySelector('summary')!;
  expect(selectorFor(summary)).toBe('section[data-section="patient-faq"] > div.grid > details.item.open > summary.q');
  document.body.innerHTML = '<form><input id="join" name="email"></form>';
  expect(selectorFor(document.querySelector('input')!)).toBe('input#join');
  document.body.innerHTML = `<div>${'<div class="aaaaaaaaaaaaaaaaaaaa bbbbbbbbbbbbbbbbbbbb">'.repeat(8)}<b>x</b>${'</div>'.repeat(8)}</div>`;
  const long = selectorFor(document.querySelector('b')!);
  expect(long.length).toBeLessThanOrEqual(120);
  expect(long.endsWith('> b')).toBe(true);
});

test('element text is the clicked label, trimmed, and never a field value', () => {
  document.body.innerHTML = '<button><span>Join   the\n waitlist</span></button><input value="me@example.com"><p>' + 'word '.repeat(20) + '</p>';
  expect(elementText(document.querySelector('span')!)).toBe('Join the waitlist');
  expect(elementText(document.querySelector('input')!)).toBe('');
  expect(elementText(document.querySelector('p')!).length).toBe(40);
});

test('the section lists are kebab-case, prefixed by mode, and match the landing page', async () => {
  for (const name of [...PATIENT_SECTIONS, ...GP_SECTIONS]) expect(name).toMatch(/^(patient|gp)-[a-z]+(-[a-z]+)*$/);
  const page = (await import('node:fs')).readFileSync('app/page.tsx', 'utf8');
  const onPage = [...page.matchAll(/section="([a-z-]+)"/g)].map((m) => m[1]);
  expect(onPage).toEqual([...PATIENT_SECTIONS, ...GP_SECTIONS]);
});

/* ------------------------------------------------------------ consent gating */

test('undecided: one anonymous pageview, and nothing written to cookies or storage', async () => {
  history.replaceState(null, '', '/pricing?utm_source=google&utm_medium=cpc');
  expect(trackingMode()).toBe('cookieless');
  startTracker();
  pageview('/pricing');
  track('click', { x: 1 }); // dropped without consent
  track('form_start', { form: 'hero' });
  flush();

  const [payload] = await sent();
  expect(beacon).toHaveBeenCalledTimes(1);
  expect(beacon.mock.calls[0][0]).toBe('/api/collect');
  expect(payload.mode).toBe('cookieless');
  expect(payload).not.toHaveProperty('visitorId');
  expect(payload).not.toHaveProperty('sessionId');
  expect(payload.events).toHaveLength(1);
  expect(payload.events[0]).toMatchObject({ type: 'pageview', path: '/pricing', props: { device: 'desktop', ref: null, utm_source: 'google' } });
  expect(payload.events[0].props).not.toHaveProperty('pv');
  expect(document.cookie).toBe('');
  expect(sessionStorage.length).toBe(0);
  expect(getAttribution()).toEqual({ utmSource: 'google', utmMedium: 'cpc', landingPath: '/pricing' });
});

test('declined: the same anonymous mode, with only the choice itself remembered', async () => {
  setConsent('denied');
  startTracker();
  pageview('/');
  track('scroll', { depth: 25 });
  flush();
  const [payload] = await sent();
  expect(payload.mode).toBe('cookieless');
  expect(payload.events.map((e) => e.type)).toEqual(['pageview']);
  expect(document.cookie).toBe('dq_consent=denied');
  expect(sessionStorage.length).toBe(0);
});

test('?dq_heatmap=1 switches the tracker off entirely', () => {
  history.replaceState(null, '', '/?dq_heatmap=1');
  setConsent('granted');
  startTracker();
  pageview('/');
  track('click', { x: 1 });
  flush();
  expect(trackingMode()).toBe('off');
  expect(queued()).toEqual([]);
  expect(beacon).not.toHaveBeenCalled();
  expect(document.cookie).not.toContain('dq_vid');
});

test('Global Privacy Control keeps even a consenting browser anonymous', () => {
  Object.defineProperty(navigator, 'globalPrivacyControl', { value: true, configurable: true });
  setConsent('granted');
  expect(trackingMode()).toBe('cookieless');
  startTracker();
  pageview('/');
  expect(document.cookie).not.toContain('dq_vid');
});

test('untracked paths record nothing', () => {
  setConsent('granted');
  startTracker();
  pageview('/admin/analytics');
  track('click', {});
  expect(queued()).toEqual([]);
});

/* ------------------------------------------------------------ identified */

test('granted: a visitor cookie, a session, and pageview detail', async () => {
  history.replaceState(null, '', '/?utm_source=newsletter&utm_campaign=launch');
  setConsent('granted');
  startTracker();
  pageview('/');
  track('form_view', { form: 'hero', role: 'patient' });
  pageview('/pricing');
  flush();

  const vid = document.cookie.match(/dq_vid=([^;]+)/)?.[1];
  expect(vid).toMatch(UUID);
  const session = JSON.parse(sessionStorage.getItem('dq_sid')!);
  expect(session.id).toMatch(UUID);

  const [payload] = await sent();
  expect(payload).toMatchObject({ mode: 'identified', visitorId: vid, sessionId: session.id });
  const [first, form, second] = payload.events;
  expect(first).toMatchObject({ type: 'pageview', path: '/', props: {
    utm_source: 'newsletter', utm_campaign: 'launch', utm_medium: null, referrer: null, prev: null,
    vw: window.innerWidth, vh: window.innerHeight, device: 'desktop',
  } });
  expect(first.props.pv).toMatch(/^[0-9a-f]{8}$/);
  expect(form).toMatchObject({ type: 'form_view', path: '/', props: { form: 'hero', pv: first.props.pv } });
  expect(second).toMatchObject({ type: 'pageview', path: '/pricing', props: { prev: '/' } });
  expect(second.props.pv).not.toBe(first.props.pv);

  expect(getAttribution()).toEqual({ visitorId: vid, utmSource: 'newsletter', utmCampaign: 'launch', landingPath: '/' });
});

test('a session idle for 30 minutes starts a new one', () => {
  setConsent('granted');
  sessionStorage.setItem('dq_sid', JSON.stringify({ id: '22222222-2222-4222-8222-222222222222', last: Date.now() - 31 * 60_000 }));
  startTracker();
  pageview('/');
  expect(queued()[0].sessionId).not.toBe('22222222-2222-4222-8222-222222222222');
  resetTrackerForTests();
  const live = JSON.parse(sessionStorage.getItem('dq_sid')!).id;
  startTracker();
  pageview('/about');
  expect(queued()[0].sessionId).toBe(live);
});

test('consent given mid-visit starts identified tracking on the same page', () => {
  startTracker();
  pageview('/');
  expect(queued().map((q) => q.mode)).toEqual(['cookieless']);
  setConsent('granted');
  const [, after] = queued();
  expect(after.mode).toBe('identified');
  expect(after.event).toMatchObject({ type: 'pageview', path: '/', props: { after_consent: true, prev: null } });
  expect(document.cookie).toContain('dq_vid=');
});

test('withdrawing consent removes the visitor cookie and the session, and drops unsent events', () => {
  setConsent('granted');
  startTracker();
  pageview('/');
  expect(document.cookie).toContain('dq_vid=');
  setConsent('denied');
  expect(document.cookie).not.toContain('dq_vid=');
  expect(sessionStorage.getItem('dq_sid')).toBeNull();
  expect(queued()).toEqual([]);
  expect(getAttribution()).not.toHaveProperty('visitorId');
});

test('clicks record position, selector, text and bucket; CTAs and outbound links are named', () => {
  document.body.innerHTML = `
    <a id="nav-cta" href="#join" data-cta="nav">Join the waitlist</a>
    <a class="tel" href="tel:999">call 999</a>
    <a href="https://www.gmc-uk.org/registers?q=1">GMC register</a>`;
  const stay = (e: Event) => e.preventDefault(); // jsdom cannot navigate
  document.addEventListener('click', stay);
  setConsent('granted');
  startTracker();
  pageview('/');
  fireEvent.click(document.querySelector('#nav-cta')!, { detail: 1 });
  fireEvent.click(document.querySelector('.tel')!, { detail: 1 });
  fireEvent.click(document.querySelector('a[href^="https"]')!, { detail: 1 });
  const evs = queued().map((q) => q.event);
  const clicks = evs.filter((e) => e.type === 'click');
  expect(clicks).toHaveLength(3);
  expect(clicks[0].props).toMatchObject({ sel: 'a#nav-cta', text: 'Join the waitlist', vp: 'desktop' });
  expect(typeof clicks[0].props.x).toBe('number');
  expect(typeof clicks[0].props.y).toBe('number');
  expect(evs.find((e) => e.type === 'cta_click')!.props).toMatchObject({ cta: 'nav', text: 'Join the waitlist' });
  expect(evs.filter((e) => e.type === 'outbound_click').map((e) => e.props.href)).toEqual(['tel:999', 'www.gmc-uk.org/registers']);
  document.removeEventListener('click', stay);
});

test('the flush splits by batch size and falls back to fetch without sendBeacon', async () => {
  Object.defineProperty(navigator, 'sendBeacon', { value: undefined, configurable: true });
  const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetchMock);
  setConsent('granted');
  startTracker();
  pageview('/');
  for (let i = 0; i < 60; i++) track('field_focus', { form: 'hero', field: 'email' });
  flush();
  const bodies = fetchMock.mock.calls.map((c) => JSON.parse((c as unknown as [string, RequestInit])[1].body as string) as Payload);
  expect(bodies.length).toBeGreaterThanOrEqual(2);
  expect(bodies.every((b) => b.events.length <= 50)).toBe(true);
  expect(bodies.reduce((n, b) => n + b.events.length, 0)).toBe(61);
  const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  expect(init.keepalive).toBe(true);
});

/* ------------------------------------------------------------ the forms */

const jsonRes = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

test('with consent, the form sends the visitor id and first touch, and records its funnel', async () => {
  history.replaceState(null, '', '/?utm_source=newsletter');
  setConsent('granted');
  startTracker();
  pageview('/');
  const vid = document.cookie.match(/dq_vid=([^;]+)/)![1];
  const fetchMock = vi.fn<typeof fetch>(async () => jsonRes(200, { ok: true, alreadyJoined: false }));
  vi.stubGlobal('fetch', fetchMock);

  const { container } = render(<WaitlistForm role="patient" source="hero" cta="Join the waitlist" inputId="join" />);
  const input = screen.getByLabelText('Email address');
  fireEvent.submit(container.querySelector('form')!); // empty: a field error first
  await userEvent.type(input, 'name@example.com');
  fireEvent.submit(container.querySelector('form')!);
  await screen.findByText(/on the list/);

  expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toEqual({
    email: 'name@example.com', role: 'patient', source: 'hero', company: '',
    visitorId: vid, utmSource: 'newsletter', landingPath: '/',
  });
  const types = queued().map((q) => q.event.type);
  expect(types).toEqual(expect.arrayContaining(['field_focus', 'field_error', 'form_start', 'form_submit', 'form_success']));
  const ev = (t: string) => queued().find((q) => q.event.type === t)!.event.props;
  expect(ev('field_error')).toMatchObject({ form: 'hero', role: 'patient', field: 'email', error: 'missing_email' });
  expect(ev('field_focus')).toMatchObject({ form: 'hero', field: 'email' });
  expect(ev('form_success')).toMatchObject({ form: 'hero', already: false });
  // Values typed into the form never reach an event.
  expect(JSON.stringify(queued())).not.toContain('name@example.com');
});

test('a failed submission records form_fail with its code', async () => {
  setConsent('granted');
  startTracker();
  pageview('/');
  vi.stubGlobal('fetch', vi.fn(async () => jsonRes(503, { ok: false })));
  const { container } = render(<WaitlistForm role="patient" source="recap" cta="Join the waitlist" inputId="join2" />);
  await userEvent.type(screen.getByLabelText('Email address'), 'name@example.com');
  fireEvent.submit(container.querySelector('form')!);
  await screen.findByText(/Couldn/);
  expect(queued().find((q) => q.event.type === 'form_fail')!.event.props).toMatchObject({ form: 'recap', error: 'http_503' });
});
