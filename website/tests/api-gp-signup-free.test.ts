import { test, expect, beforeAll, beforeEach, vi } from 'vitest';
import { resetDb, useTestDb } from './helpers/db';
import { setDb, type DB } from '@/lib/db';
import { waitlistSignups } from '@/lib/db/schema';
import { GP_FEE_ENABLED } from '@/lib/gp-fee';

// The sign-up with the fee off, which is how the site launches. Stripe must not
// be touched at all, so the SDK is a class that counts being built.
const stripe = vi.hoisted(() => ({ constructed: 0 }));
vi.mock('stripe', () => ({
  default: class { constructor() { stripe.constructed += 1; } },
}));

import { POST } from '@/app/api/gp-signup/route';

const GP = { name: 'Dr Jane Okafor', email: 'jane@example.com', mobile: '07700 900123', gmc: '1234567', source: 'hero-gp' };

const req = (body: unknown) => new Request('http://localhost/api/gp-signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

let db: DB;
beforeAll(async () => { db = await useTestDb(); });
beforeEach(async () => {
  vi.unstubAllEnvs();
  vi.stubEnv('STRIPE_SECRET_KEY', '');
  stripe.constructed = 0;
  setDb(db);
  await resetDb(db);
});

test('the fee is off', () => {
  expect(GP_FEE_ENABLED).toBe(false);
});

test('a GP is signed up with no payment, no fee status and no Stripe', async () => {
  const res = await POST(req(GP));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, signedUp: true });
  const rows = await db.select().from(waitlistSignups);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ role: 'gp', email: 'jane@example.com', status: 'new', feeStatus: null });
  expect(stripe.constructed).toBe(0);
});

test('signing up again keeps one application and still asks for nothing', async () => {
  await POST(req(GP));
  const res = await POST(req({ ...GP, name: 'Someone Else' }));
  expect(await res.json()).toEqual({ ok: true, signedUp: true });
  const rows = await db.select().from(waitlistSignups);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ name: 'Dr Jane Okafor', feeStatus: null });
});
