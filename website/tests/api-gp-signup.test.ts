import { test, expect, beforeAll, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { resetDb, useTestDb } from './helpers/db';
import { setDb, type DB } from '@/lib/db';
import { emailLog, rateLimits, waitlistSignups } from '@/lib/db/schema';

// Stripe is never called for real: the SDK is replaced by a class whose
// Checkout Sessions calls are spies. What the route sends is asserted against
// them, since that request is the one thing no test can make against Stripe.
const stripe = vi.hoisted(() => ({
  create: vi.fn(),
  retrieve: vi.fn(),
  expire: vi.fn(),
  keys: [] as string[],
}));
vi.mock('stripe', () => ({
  default: class {
    checkout = { sessions: { create: stripe.create, retrieve: stripe.retrieve, expire: stripe.expire } };
    constructor(key: string) { stripe.keys.push(key); }
  },
}));

import { POST } from '@/app/api/gp-signup/route';

const GP = {
  name: 'Dr Jane Okafor',
  email: 'jane@example.com',
  mobile: '07700 900123',
  gmc: '1234567',
  source: 'hero-gp',
};

function req(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/gp-signup', {
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
  vi.stubEnv('STRIPE_SECRET_KEY', 'rk_test_placeholder');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://drquick.example');
  stripe.create.mockReset().mockResolvedValue({ id: 'cs_test_a1b2c3d4e5f6', url: 'https://checkout.stripe.com/c/pay/cs_test_a1b2c3d4e5f6' });
  stripe.retrieve.mockReset();
  stripe.expire.mockReset().mockResolvedValue({});
  setDb(db);
  await resetDb(db);
});

test('503 when there is no database', async () => {
  setDb(null);
  const res = await POST(req(GP));
  expect(res.status).toBe(503);
  expect(res.headers.get('Cache-Control')).toBe('no-store');
  expect(await res.json()).toEqual({ ok: false, error: 'store_unavailable' });
});

test('with no Stripe key nothing is stored and nothing is charged', async () => {
  vi.stubEnv('STRIPE_SECRET_KEY', '');
  const res = await POST(req(GP));
  expect(res.status).toBe(503);
  expect(await res.json()).toEqual({ ok: false, error: 'payments_unavailable' });
  expect(await rows()).toEqual([]);
  expect(stripe.create).not.toHaveBeenCalled();
});

test('a valid sign-up is stored unpaid and answered with Stripe’s payment page', async () => {
  const res = await POST(req(
    { ...GP, name: '  Dr   Jane  Okafor ', email: ' Jane@Example.com', mobile: '+44 7700 900123', gmc: ' 1234567 ' },
    { 'x-forwarded-for': '1.2.3.4' },
  ));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, url: 'https://checkout.stripe.com/c/pay/cs_test_a1b2c3d4e5f6' });

  const [row] = await rows();
  // Whitespace collapsed, lowercased, +44 folded to the 07 form, GMC stripped.
  expect(row).toMatchObject({
    role: 'gp', name: 'Dr Jane Okafor', email: 'jane@example.com', mobile: '07700900123', gmc: '1234567',
    source: 'hero-gp', status: 'new',
    feeStatus: 'unpaid', feePence: null, feePaidAt: null, stripePaymentIntentId: null,
    stripeCheckoutSessionId: 'cs_test_a1b2c3d4e5f6',
  });
  // No confirmation and no team alert until the fee is actually paid.
  expect(await db.select().from(emailLog)).toEqual([]);
});

test('the Checkout Session is the fee, in pounds, tied to the sign-up, and carries no more than it must', async () => {
  await POST(req(GP));
  const [row] = await rows();
  expect(stripe.create).toHaveBeenCalledTimes(1);
  const params = stripe.create.mock.calls[0][0];
  expect(params).toMatchObject({
    mode: 'payment',
    customer_email: 'jane@example.com',
    client_reference_id: row.id,
    metadata: { kind: 'gp_signup_fee', signup_id: row.id },
    payment_intent_data: { metadata: { kind: 'gp_signup_fee', signup_id: row.id } },
    // Built from NEXT_PUBLIC_SITE_URL, never from the request's Host header.
    success_url: 'https://drquick.example/gp/welcome?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://drquick.example/?checkout=cancelled#gp-join',
  });
  expect(params.line_items).toHaveLength(1);
  expect(params.line_items[0]).toMatchObject({
    quantity: 1,
    price_data: { currency: 'gbp', unit_amount: 5000, product_data: { name: 'Dr Quick GP sign-up fee' } },
  });
  expect(params.integration_identifier).toMatch(/^gp-signup-fee-[a-z]{8}$/);
  // Pounds only, so the amount that comes back can be checked exactly, and an
  // abandoned checkout stops being payable after an hour rather than a day.
  expect(params.adaptive_pricing).toEqual({ enabled: false });
  const lifetime = params.expires_at - Math.floor(Date.now() / 1000);
  expect(lifetime).toBeGreaterThan(55 * 60);
  expect(lifetime).toBeLessThanOrEqual(60 * 60);
  // No discount of any kind can make the fee anything but the fee.
  expect(params).not.toHaveProperty('allow_promotion_codes');
  expect(params).not.toHaveProperty('discounts');
  // Payment methods are left to Stripe's dynamic selection.
  expect(params).not.toHaveProperty('payment_method_types');
  // The name, mobile and GMC number stay here: Stripe gets the email and an id.
  const sent = JSON.stringify(params);
  for (const kept of ['Okafor', '07700900123', '1234567']) expect(sent).not.toContain(kept);
  // The key is read from the environment and goes nowhere but the client.
  expect(stripe.keys.at(-1)).toBe('rk_test_placeholder');
});

test('a sign-up missing a field is a 400 naming that field, and nothing reaches the store or Stripe', async () => {
  const cases: Array<[Record<string, unknown>, string]> = [
    [{ name: '' }, 'invalid_name'],
    [{ email: 'nope' }, 'invalid_email'],
    [{ mobile: '0161 496 0000' }, 'invalid_mobile'],   // a landline is not a mobile
    [{ gmc: '12345' }, 'invalid_gmc'],                 // seven digits, not five
  ];
  for (const [override, error] of cases) {
    const res = await POST(req({ ...GP, ...override }));
    expect(res.status, `${error} should be a 400`).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error });
  }
  expect(await rows()).toEqual([]);
  expect(stripe.create).not.toHaveBeenCalled();
});

test('unparseable, oversize and non-object bodies are 400 bad_request', async () => {
  expect((await POST(req('not json'))).status).toBe(400);
  expect((await POST(req(JSON.stringify({ ...GP, pad: 'x'.repeat(9000) })))).status).toBe(400);
  expect((await POST(req('[1,2]'))).status).toBe(400);
  expect((await POST(req('null'))).status).toBe(400);
});

test('the honeypot gets a quiet success: no row, no checkout, no charge', async () => {
  const res = await POST(req({ ...GP, company: 'bot inc' }));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, alreadyPaid: true });
  expect(await rows()).toEqual([]);
  expect(stripe.create).not.toHaveBeenCalled();
});

test('the sixth submission in the window is rate limited, on a salted hash of the address', async () => {
  vi.stubEnv('RATE_LIMIT_SALT', 'pepper');
  const ip = { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' };
  for (let i = 0; i < 5; i += 1) expect((await POST(req({ ...GP, email: `gp${i}@example.com` }, ip))).status).toBe(200);
  const res = await POST(req(GP, ip));
  expect(res.status).toBe(429);
  expect(await res.json()).toEqual({ ok: false, error: 'rate_limited' });
  const keys = (await db.select().from(rateLimits)).map((r) => r.key);
  // One bucket for the client, and one for each address it named.
  expect(keys.filter((k) => /^rl:gp-signup:[0-9a-f]{24}$/.test(k))).toHaveLength(1);
  expect(keys.filter((k) => /^rl:gp-signup-email:[0-9a-f]{24}$/.test(k))).toHaveLength(5);
  // Neither the address of the client nor the addresses it named are stored raw.
  expect(JSON.stringify(keys)).not.toMatch(/203\.0\.113\.9|example\.com/);
  expect(JSON.stringify(await rows())).not.toContain('203.0.113.9');
});

// A sender's own address can claim to be anything; the address it names cannot.
test('one email address can only be named a few times, whoever is asking', async () => {
  for (let i = 0; i < 5; i += 1) {
    expect((await POST(req(GP, { 'x-forwarded-for': `198.51.100.${i + 1}` }))).status).toBe(200);
  }
  const res = await POST(req(GP, { 'x-forwarded-for': '198.51.100.99' }));
  expect(res.status).toBe(429);
  expect(stripe.create).toHaveBeenCalledTimes(5);
});

test('a request with no client address is still limited, in one shared bucket', async () => {
  for (let i = 0; i < 30; i += 1) expect((await POST(req({ ...GP, email: `gp${i}@example.com` }))).status).toBe(200);
  expect((await POST(req({ ...GP, email: 'one-more@example.com' }))).status).toBe(429);
  expect(await rows()).toHaveLength(30);
});

// Anyone can type anyone's email. If a later post replaced the details, a
// stranger could rewrite an application; so the row keeps the first details,
// and what a later post typed waits beside its own checkout.
test('a second submission for an address does not rewrite the application', async () => {
  await POST(req(GP));
  stripe.create.mockResolvedValue({ id: 'cs_test_second000001', url: 'https://checkout.stripe.com/c/pay/cs_test_second000001' });
  const res = await POST(req({ ...GP, name: 'Someone Else', mobile: '07700 900999', gmc: '7654321', source: 'recap-gp' }));
  expect(await res.json()).toEqual({ ok: true, url: 'https://checkout.stripe.com/c/pay/cs_test_second000001' });

  const all = await rows();
  expect(all).toHaveLength(1);
  expect(all[0]).toMatchObject({
    name: 'Dr Jane Okafor', mobile: '07700900123', gmc: '1234567', source: 'hero-gp',
    feeStatus: 'unpaid', stripeCheckoutSessionId: 'cs_test_second000001',
  });
  expect(all[0].pendingDetails).toEqual({
    cs_test_a1b2c3d4e5f6: { name: 'Dr Jane Okafor', mobile: '07700900123', gmc: '1234567' },
    cs_test_second000001: { name: 'Someone Else', mobile: '07700900999', gmc: '7654321' },
  });
  // The first checkout is closed before the second opens: one open checkout
  // per sign-up, so there is one chance to pay, not two.
  expect(stripe.expire).toHaveBeenCalledTimes(1);
  expect(stripe.expire).toHaveBeenCalledWith('cs_test_a1b2c3d4e5f6');
  expect(stripe.create).toHaveBeenCalledTimes(2);
});

test('a checkout that cannot be closed (already paid or expired) does not stop the next one', async () => {
  await POST(req(GP));
  stripe.expire.mockRejectedValue(new Error('This Checkout Session has already expired.'));
  stripe.create.mockResolvedValue({ id: 'cs_test_second000001', url: 'https://checkout.stripe.com/c/pay/cs_test_second000001' });
  expect((await POST(req(GP))).status).toBe(200);
});

test('only the last few started checkouts are remembered', async () => {
  for (let i = 0; i < 5; i += 1) {
    stripe.create.mockResolvedValue({ id: `cs_test_attempt00000${i}`, url: 'https://checkout.stripe.com/c/pay/x' });
    await POST(req(GP, { 'x-forwarded-for': `198.51.100.${i + 1}` }));
  }
  await db.delete(rateLimits);
  stripe.create.mockResolvedValue({ id: 'cs_test_attempt000005', url: 'https://checkout.stripe.com/c/pay/x' });
  await POST(req(GP));
  expect(Object.keys((await rows())[0].pendingDetails ?? {})).toEqual([
    'cs_test_attempt000001', 'cs_test_attempt000002', 'cs_test_attempt000003', 'cs_test_attempt000004', 'cs_test_attempt000005',
  ]);
});

test('once the team has started on an application, a form post cannot rewrite it', async () => {
  await POST(req(GP));
  await db.update(waitlistSignups).set({ status: 'contacted' }).where(eq(waitlistSignups.email, 'jane@example.com'));
  await POST(req({ ...GP, name: 'Someone Else', gmc: '7654321' }));
  expect((await rows())[0]).toMatchObject({ name: 'Dr Jane Okafor', gmc: '1234567', status: 'contacted', feeStatus: 'unpaid' });
});

test('a GP from before the fee existed is asked for it, without their details being touched', async () => {
  await db.insert(waitlistSignups).values({
    role: 'gp', email: 'jane@example.com', name: 'Dr Jane Okafor', mobile: '07700900123', gmc: '1234567',
    source: 'hero-gp', status: 'gmc_verified', unsubscribeToken: 'legacy-token-000000000001',
  });
  const res = await POST(req({ ...GP, name: 'Another Name' }));
  expect((await res.json()).url).toBeTruthy();
  expect((await rows())[0]).toMatchObject({ name: 'Dr Jane Okafor', status: 'gmc_verified', feeStatus: 'unpaid' });
});

test('an address that has already paid is told so, and is not sent to pay again', async () => {
  await POST(req(GP));
  await db.update(waitlistSignups).set({ feeStatus: 'paid', feePence: 5000, feePaidAt: new Date() });
  stripe.create.mockClear();
  stripe.expire.mockClear();
  const before = (await rows())[0];
  const res = await POST(req({ ...GP, name: 'Someone Else' }));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, alreadyPaid: true });
  expect(stripe.create).not.toHaveBeenCalled();
  expect(stripe.expire).not.toHaveBeenCalled();
  // A paid application is not touched at all by a form post.
  expect((await rows())[0]).toEqual(before);
});

test('the same address may be a patient and a GP, as two records', async () => {
  await db.insert(waitlistSignups).values({
    role: 'patient', email: 'jane@example.com', source: 'hero', status: 'subscribed', unsubscribeToken: 'patient-token-00000000001',
  });
  await POST(req(GP));
  expect((await rows()).map((r) => [r.role, r.feeStatus]).sort()).toEqual([['gp', 'unpaid'], ['patient', null]]);
});

test('if Stripe cannot be reached the answer is 502 and the application waits, unpaid', async () => {
  const err = vi.spyOn(console, 'error').mockImplementation(() => {});
  stripe.create.mockRejectedValue(new Error('connection reset'));
  const res = await POST(req(GP));
  expect(res.status).toBe(502);
  expect(await res.json()).toEqual({ ok: false, error: 'checkout_failed' });
  expect((await rows())[0]).toMatchObject({ feeStatus: 'unpaid', stripeCheckoutSessionId: null });
  // The log names the failure and never the key.
  expect(JSON.stringify(err.mock.calls)).not.toContain('rk_test_placeholder');
  err.mockRestore();
});

test('a database failure during the write is a 502, before Stripe is ever called', async () => {
  const err = vi.spyOn(console, 'error').mockImplementation(() => {});
  setDb({ execute: () => { throw new Error('down'); }, insert: () => { throw new Error('down'); } } as unknown as DB);
  const res = await POST(req(GP, { 'x-forwarded-for': '1.2.3.4' }));
  expect(res.status).toBe(502);
  expect(await res.json()).toEqual({ ok: false, error: 'store_write_failed' });
  expect(stripe.create).not.toHaveBeenCalled();
  err.mockRestore();
});

test('attribution travels with the application', async () => {
  await POST(req({
    ...GP, visitorId: '0f8e2a8c-3b1d-4c55-9d0e-1a2b3c4d5e6f', utmSource: 'linkedin', utmCampaign: 'gp-launch', landingPath: '/',
  }));
  expect((await rows())[0]).toMatchObject({
    visitorId: '0f8e2a8c-3b1d-4c55-9d0e-1a2b3c4d5e6f', utmSource: 'linkedin', utmCampaign: 'gp-launch', landingPath: '/',
  });
});
