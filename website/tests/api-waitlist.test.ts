import { test, expect, beforeAll, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { resetDb, useTestDb } from './helpers/db';
import { setDb, type DB } from '@/lib/db';
import { emailLog, rateLimits, waitlistSignups } from '@/lib/db/schema';
import { POST } from '@/app/api/waitlist/route';

// A complete GP sign-up. This route no longer takes it (tests/api-gp-signup.test.ts
// covers the one that does); a patient still posts an email and nothing else.
const GP = {
  name: 'Dr Jane Okafor',
  email: 'jane@example.com',
  mobile: '07700 900123',
  gmc: '1234567',
  role: 'gp',
  source: 'hero-gp',
};

function req(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/waitlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

let db: DB;
beforeAll(async () => { db = await useTestDb(); });

const rows = () => db.select().from(waitlistSignups);

beforeEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  setDb(db);
  await resetDb(db);
});

test('503 when there is no database', async () => {
  setDb(null);
  const res = await POST(req({ email: 'a@b.co', role: 'patient' }));
  expect(res.status).toBe(503);
  expect(res.headers.get('Cache-Control')).toBe('no-store');
  expect(await res.json()).toEqual({ ok: false, error: 'store_unavailable' });
});

test('honeypot value returns a fake success without touching the store', async () => {
  const res = await POST(req({ email: 'a@b.co', role: 'patient', company: 'bot inc' }));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, alreadyJoined: false });
  expect(await rows()).toEqual([]);
});

test('invalid email and invalid role are 400s', async () => {
  expect((await POST(req({ email: 'nope', role: 'patient' }))).status).toBe(400);
  expect((await POST(req({ email: 'a@b.co', role: 'admin' }))).status).toBe(400);
  const long = `${'a'.repeat(250)}@example.com`;
  expect((await POST(req({ email: long, role: 'patient' }))).status).toBe(400);
});

test('unparseable and oversize bodies are 400 bad_request', async () => {
  expect((await POST(req('not json'))).status).toBe(400);
  const big = JSON.stringify({ email: 'a@b.co', role: 'patient', pad: 'x'.repeat(9000) });
  expect((await POST(req(big))).status).toBe(400);
});

test('sixth submission in the window is rate limited', async () => {
  const ip = { 'x-forwarded-for': '203.0.113.9' };
  for (let i = 0; i < 5; i += 1) expect((await POST(req({ email: `p${i}@b.co`, role: 'patient' }, ip))).status).toBe(200);
  const res = await POST(req({ email: 'a@b.co', role: 'patient' }, ip));
  expect(res.status).toBe(429);
  expect(await res.json()).toEqual({ ok: false, error: 'rate_limited' });
});

test('the rate-limit key is a salted hash — the raw IP never reaches the store', async () => {
  vi.stubEnv('RATE_LIMIT_SALT', 'pepper');
  await POST(req({ email: 'a@b.co', role: 'patient' }, { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }));
  const keys = (await db.select().from(rateLimits)).map((r) => r.key);
  expect(keys).toHaveLength(1);
  expect(keys[0]).toMatch(/^rl:waitlist:[0-9a-f]{24}$/);
  expect(JSON.stringify(await rows())).not.toContain('203.0.113.9');
});

test('a new address stores and reports alreadyJoined false; a repeat reports true', async () => {
  let res = await POST(req({ email: 'New@B.co ', role: 'patient', source: 'hero' }, { 'x-forwarded-for': '1.2.3.4' }));
  expect(await res.json()).toEqual({ ok: true, alreadyJoined: false });
  const [row] = await rows();
  expect(row).toMatchObject({ email: 'new@b.co', role: 'patient', source: 'hero', status: 'subscribed' }); // trimmed + lowercased
  expect(row.createdAt).toBeInstanceOf(Date);

  res = await POST(req({ email: 'new@b.co', role: 'patient' }, { 'x-forwarded-for': '1.2.3.4' }));
  expect(await res.json()).toEqual({ ok: true, alreadyJoined: true });
  expect(await rows()).toHaveLength(1);
});

// A GP sign-up carries a fee and ends in a payment (app/api/gp-signup). If this
// route still took the role, it would be a way to sign up as a GP without paying.
test('the GP role is refused here, however complete the details, and nothing is stored', async () => {
  const res = await POST(req({ ...GP }, { 'x-forwarded-for': '1.2.3.4' }));
  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({ ok: false, error: 'gp_signup_moved' });
  expect(await rows()).toEqual([]);
  expect(await db.select().from(emailLog)).toEqual([]);
});

test('a patient still needs nothing but an email — the GP fields are not asked of them', async () => {
  const res = await POST(req({ email: 'a@b.co', role: 'patient', source: 'hero', name: 'ignored' }));
  expect(res.status).toBe(200);
  expect((await rows())[0]).toMatchObject({ email: 'a@b.co', role: 'patient', source: 'hero', status: 'subscribed', name: null });
});

test('attribution is kept when well formed and dropped when not', async () => {
  await POST(req({
    email: 'a@b.co', role: 'patient', visitorId: '0f8e2a8c-3b1d-4c55-9d0e-1a2b3c4d5e6f',
    utmSource: 'instagram', utmCampaign: 'launch', referrer: 'https://www.instagram.com/', landingPath: '/?role=gp',
  }));
  await POST(req({ email: 'c@b.co', role: 'patient', visitorId: 'not-a-uuid', utmSource: 'x'.repeat(500) }));
  const [a, c] = await rows();
  expect(a).toMatchObject({ visitorId: '0f8e2a8c-3b1d-4c55-9d0e-1a2b3c4d5e6f', utmSource: 'instagram', utmCampaign: 'launch', landingPath: '/?role=gp' });
  expect(c.visitorId).toBeNull();
  expect(c.utmSource).toHaveLength(100);
});

test('each new sign-up logs its confirmation email; with no Resend key it is skipped, not failed', async () => {
  await POST(req({ email: 'a@b.co', role: 'patient' }));
  const log = await db.select().from(emailLog);
  expect(log.map((l) => [l.template, l.status])).toEqual([['patient_welcome', 'skipped']]);
});

// The team alert is for GPs, and goes out when a GP's fee is paid
// (tests/stripe-webhook.test.ts); a patient joining alerts nobody.
test('a mail outage never fails the sign-up, and a patient joining alerts nobody', async () => {
  vi.stubEnv('RESEND_API_KEY', 're_test');
  vi.stubEnv('EMAIL_FROM', 'Dr Quick <hello@example.com>');
  vi.stubEnv('ADMIN_ALERT_EMAILS', 'ops@example.com');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
  const res = await POST(req({ email: 'a@b.co', role: 'patient' }));
  expect(await res.json()).toEqual({ ok: true, alreadyJoined: false });
  const log = await db.select().from(emailLog);
  expect(log.map((l) => [l.to, l.template, l.status])).toEqual([
    ['a@b.co', 'patient_welcome', 'failed'],
  ]);
});

test('a database failure during the write is a 502', async () => {
  setDb({ execute: () => { throw new Error('down'); }, insert: () => { throw new Error('down'); } } as unknown as DB);
  const res = await POST(req({ email: 'a@b.co', role: 'patient' }, { 'x-forwarded-for': '1.2.3.4' }));
  expect(res.status).toBe(502);
  expect(await res.json()).toEqual({ ok: false, error: 'store_write_failed' });
});

test('with no client IP the rate limit is skipped and the write still happens', async () => {
  const res = await POST(req({ email: 'a@b.co', role: 'patient' }));
  expect(res.status).toBe(200);
  expect(await db.select().from(rateLimits)).toEqual([]);
  expect(await rows()).toHaveLength(1);
});

test('rows are keyed by role and email, never duplicated', async () => {
  await POST(req({ email: 'a@b.co', role: 'patient' }));
  await POST(req({ email: 'A@B.CO', role: 'patient' }));
  expect(await db.select().from(waitlistSignups).where(eq(waitlistSignups.email, 'a@b.co'))).toHaveLength(1);
});
