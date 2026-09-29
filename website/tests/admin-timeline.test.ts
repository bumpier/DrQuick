import { describe, expect, test } from 'vitest';
import { buildPages, buildTimeline, describe as sentence, type TimelineEventInput } from '@/lib/admin/timeline';
import { errorLabel, fmtDuration } from '@/lib/admin/analytics-labels';

let id = 0;
const ev = (type: string, props: Record<string, unknown>, ts: string, path = '/'): TimelineEventInput =>
  ({ id: ++id, type, path, ts: new Date(`2026-09-25T10:${ts}Z`), props });

describe('sentences', () => {
  test('each event reads as plain English', () => {
    expect(sentence('scroll', { depth: 75, max: 80 })).toBe('Reached 75% of the page');
    expect(sentence('section_view', { section: 'patient-how-it-works', dwell_ms: 12_300 })).toBe('Read “How it works” for 12s');
    expect(sentence('click', { text: 'Join the waitlist', sel: 'a' })).toBe('Clicked “Join the waitlist”');
    expect(sentence('click', { text: '', sel: 'main > div.x' })).toBe('Clicked main > div.x');
    expect(sentence('click', { text: '', sel: 'input#gp-join' })).toBe('Clicked into a form field');
    expect(sentence('cta_click', { cta: 'nav', text: 'Join' })).toBe('Clicked the “Join” button');
    expect(sentence('outbound_click', { href: 'tel:999' })).toBe('Tapped to call 999');
    expect(sentence('outbound_click', { href: 'mailto' })).toBe('Clicked an email link');
    expect(sentence('outbound_click', { href: 'gmc-uk.org/register' })).toBe('Left for gmc-uk.org/register');
    expect(sentence('form_start', { form: 'hero-gp', role: 'gp' })).toBe('Started the GP form');
    expect(sentence('form_view', { form: 'recap', role: 'patient' })).toBe('Saw the patient form');
    expect(sentence('field_focus', { field: 'gmc' })).toBe('Moved to GMC number');
    expect(sentence('field_error', { field: 'gmc', error: 'invalid_gmc' })).toBe('Error on GMC number: invalid');
    expect(sentence('field_error', { field: 'email', error: 'invalid_email', from: 'server' })).toBe('Error on Email: invalid (from the server)');
    expect(sentence('form_success', { role: 'gp', already: false })).toBe('Joined the GP waitlist');
    expect(sentence('form_success', { role: 'patient', already: true })).toBe('Was already on the waitlist');
    expect(sentence('form_fail', { form: 'hero', role: 'patient', error: 'rate_limited' })).toBe('The patient form failed to send (rate limited)');
    expect(sentence('engaged_time', { seconds: 5 })).toBeNull();
  });

  test('labels and durations', () => {
    expect(errorLabel('missing_email')).toBe('missing');
    expect(errorLabel('http_502')).toBe('server error 502');
    expect(fmtDuration(0)).toBe('0s');
    expect(fmtDuration(65)).toBe('1m 05s');
    expect(fmtDuration(3725)).toBe('1h 02m');
    expect(fmtDuration(null)).toBe('—');
  });
});

describe('grouping', () => {
  test('events group under their pageview; sections sum; engaged time is a summary; CTA clicks are not doubled', () => {
    const pages = buildPages([
      ev('pageview', { pv: 'p1', role: 'patient' }, '00:00'),
      ev('section_view', { pv: 'p1', section: 'patient-hero', dwell_ms: 4000 }, '00:05'),
      ev('scroll', { pv: 'p1', depth: 25, max: 30 }, '00:06'),
      ev('engaged_time', { pv: 'p1', seconds: 10, max_scroll: 30 }, '00:10'),
      ev('section_view', { pv: 'p1', section: 'patient-hero', dwell_ms: 2000 }, '00:20'),
      ev('click', { pv: 'p1', text: 'Join', sel: 'a' }, '00:21'),
      ev('cta_click', { pv: 'p1', cta: 'nav', text: 'Join' }, '00:21'),
      ev('engaged_time', { pv: 'p1', seconds: 15, max_scroll: 40 }, '00:30'),
      ev('pageview', { pv: 'p2' }, '01:00', '/pricing'),
      ev('click', { pv: 'p2', text: 'Back' }, '01:05', '/pricing'),
    ]);
    expect(pages.map((p) => p.path)).toEqual(['/', '/pricing']);
    const [home, pricing] = pages;
    expect(home.role).toBe('patient');
    expect(home.engagedSeconds).toBe(25);
    expect(home.maxScroll).toBe(40);
    expect(home.items.map((i) => i.text)).toEqual([
      'Read “Hero” for 6s',
      'Reached 25% of the page',
      'Clicked the “Join” button',
    ]);
    expect(pricing.items.map((i) => i.text)).toEqual(['Clicked “Back”']);
  });

  test('sessions come newest first and flag a sign-up', () => {
    const base = {
      lastSeen: new Date(), entryPath: '/', pageviews: 1, engagedSeconds: 0, maxScroll: 0, referrer: null,
      utmSource: null, utmMedium: null, utmCampaign: null, device: 'mobile', browser: 'Safari', os: 'iOS',
    };
    const t = buildTimeline([
      { ...base, id: 'old', startedAt: new Date('2026-09-01T10:00:00Z'), events: [ev('pageview', { pv: 'a' }, '00:00')] },
      { ...base, id: 'new', startedAt: new Date('2026-09-20T10:00:00Z'), events: [ev('form_success', { pv: 'b', role: 'gp' }, '00:00')] },
    ]);
    expect(t.map((s) => s.id)).toEqual(['new', 'old']);
    expect(t[0].converted).toBe(true);
    expect(t[1].converted).toBe(false);
  });
});
