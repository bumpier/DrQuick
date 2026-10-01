// @vitest-environment jsdom
import { test, expect, beforeAll, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { eq } from 'drizzle-orm';
import { resetDb, useTestDb } from './helpers/db';
import { installIOStub } from './helpers/io-stub';
import { setDb, type DB } from '@/lib/db';
import { emailLog, waitlistSignups } from '@/lib/db/schema';
import { startGpSignup } from '@/lib/waitlist';

vi.mock('next/link', () => import('./helpers/next-link'));

// The page reads the session back from Stripe; that call is a spy here.
const stripe = vi.hoisted(() => ({ retrieve: vi.fn() }));
vi.mock('stripe', () => ({
  default: class { checkout = { sessions: { create: vi.fn(), retrieve: stripe.retrieve } }; },
}));

import GpWelcomePage, { metadata } from '@/app/(site)/gp/welcome/page';

const SESSION = 'cs_test_fee0000000001';

let db: DB;
beforeAll(async () => { db = await useTestDb(); });

beforeEach(async () => {
  cleanup();
  vi.unstubAllEnvs();
  installIOStub();
  vi.stubEnv('STRIPE_SECRET_KEY', 'rk_test_placeholder');
  stripe.retrieve.mockReset();
  setDb(db);
  await resetDb(db);
});

async function application() {
  const { signup } = await startGpSignup(db, {
    name: 'Dr Jane Okafor', email: 'jane@example.com', mobile: '07700900123', gmc: '1234567', source: 'hero-gp',
  });
  return signup;
}
const session = (signupId: string, over: Record<string, unknown> = {}) => ({
  id: SESSION, status: 'complete', payment_status: 'paid', payment_intent: 'pi_fee_1', amount_total: 5000,
  currency: 'gbp', created: 1_790_000_000, metadata: { kind: 'gp_signup_fee', signup_id: signupId }, ...over,
});
const open = async (params: Record<string, string | string[] | undefined>) =>
  render(await GpWelcomePage({ searchParams: Promise.resolve(params) }));
const row = async (id: string) => (await db.select().from(waitlistSignups).where(eq(waitlistSignups.id, id)))[0];

test('the page is one person’s receipt: never indexed', () => {
  expect(metadata.robots).toEqual({ index: false, follow: false });
});

test('a paid session confirms the sign-up, says what happens next, and records the payment', async () => {
  const s = await application();
  stripe.retrieve.mockResolvedValue(session(s.id));
  const { container } = await open({ session_id: SESSION });

  expect(stripe.retrieve).toHaveBeenCalledWith(SESSION);
  expect(container.querySelectorAll('h1')).toHaveLength(1);
  expect(container.querySelector('h1')).toHaveTextContent('You’re signed up.');
  expect(container).toHaveTextContent('Your £50 sign-up fee is paid.');
  expect([...container.querySelectorAll('h3')].map((h) => h.textContent)).toEqual([
    'We check the register.', 'We get in touch.', 'You go on the rota.',
    'Refunded in full if we can’t verify your GMC registration or don’t take you on.',
  ]);
  // The landing here records the payment, so the page is true even when the
  // webhook is a second behind, and sends the confirmation once.
  expect(await row(s.id)).toMatchObject({ feeStatus: 'paid', feePence: 5000, stripePaymentIntentId: 'pi_fee_1' });
  expect((await db.select().from(emailLog)).map((l) => l.template)).toEqual(['gp_received']);
});

test('reloading the page, or the webhook having got there first, sends nothing twice', async () => {
  const s = await application();
  stripe.retrieve.mockResolvedValue(session(s.id));
  await open({ session_id: SESSION });
  cleanup();
  const { container } = await open({ session_id: SESSION });
  expect(container.querySelector('h1')).toHaveTextContent('You’re signed up.');
  expect(await db.select().from(emailLog)).toHaveLength(1);
});

test('it says a confirmation is coming only when email is switched on', async () => {
  const s = await application();
  stripe.retrieve.mockResolvedValue(session(s.id));
  expect((await open({ session_id: SESSION })).container).not.toHaveTextContent('on its way to your email');
  cleanup();
  vi.stubEnv('RESEND_API_KEY', 're_test');
  vi.stubEnv('EMAIL_FROM', 'Dr Quick <hello@example.com>');
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ id: 'email_1' }) })));
  expect((await open({ session_id: SESSION })).container).toHaveTextContent('A confirmation is on its way to your email address.');
  vi.unstubAllGlobals();
});

test('a payment still clearing is described as that, and is not recorded as paid', async () => {
  const s = await application();
  stripe.retrieve.mockResolvedValue(session(s.id, { payment_status: 'unpaid' }));
  const { container } = await open({ session_id: SESSION });
  expect(container.querySelector('h1')).toHaveTextContent('Your payment is on its way.');
  expect((await row(s.id)).feeStatus).toBe('unpaid');
  expect(await db.select().from(emailLog)).toEqual([]);
});

test('a checkout that was never completed gets a plain answer and the way back', async () => {
  const s = await application();
  stripe.retrieve.mockResolvedValue(session(s.id, { status: 'open', payment_status: 'unpaid' }));
  const { container } = await open({ session_id: SESSION });
  expect(container.querySelector('h1')).toHaveTextContent('We couldn’t confirm a payment.');
  expect(container).toHaveTextContent('If you left before paying, nothing was taken');
  expect(container.querySelector('a[data-cta="welcome-retry"]')).toHaveAttribute('href', '/#gp-join');
  expect((await row(s.id)).feeStatus).toBe('unpaid');
});

// The session id is the only thing the address carries, and it is a claim, not
// a fact: nothing is marked paid on its say-so.
test('a missing, malformed or repeated session id never reaches Stripe and confirms nothing', async () => {
  const s = await application();
  for (const params of [{}, { session_id: 'paid' }, { session_id: '../../etc' }, { session_id: ['cs_test_a', 'cs_test_b'] }, { session_id: `${SESSION}?x=1` }]) {
    cleanup();
    const { container } = await open(params);
    expect(container.querySelector('h1')).toHaveTextContent('We couldn’t confirm a payment.');
  }
  expect(stripe.retrieve).not.toHaveBeenCalled();
  expect((await row(s.id)).feeStatus).toBe('unpaid');
});

test('a session that is someone else’s checkout, an outage, or no Stripe key all confirm nothing', async () => {
  const err = vi.spyOn(console, 'error').mockImplementation(() => {});
  const s = await application();

  stripe.retrieve.mockResolvedValue(session(s.id, { metadata: { kind: 'consultation' } }));
  expect((await open({ session_id: SESSION })).container.querySelector('h1')).toHaveTextContent('We couldn’t confirm a payment.');

  cleanup();
  stripe.retrieve.mockRejectedValue(new Error('No such checkout.session'));
  expect((await open({ session_id: SESSION })).container.querySelector('h1')).toHaveTextContent('We couldn’t confirm a payment.');

  cleanup();
  stripe.retrieve.mockClear();
  vi.stubEnv('STRIPE_SECRET_KEY', '');
  expect((await open({ session_id: SESSION })).container.querySelector('h1')).toHaveTextContent('We couldn’t confirm a payment.');
  expect(stripe.retrieve).not.toHaveBeenCalled();

  expect((await row(s.id)).feeStatus).toBe('unpaid');
  err.mockRestore();
});

// The payment is real but there is nothing to attach it to. "You're signed up"
// would be untrue, so the page says what happened and how to get the money back.
test('a payment for a sign-up that was erased while the checkout was open is not called a sign-up', async () => {
  const s = await application();
  await db.delete(waitlistSignups).where(eq(waitlistSignups.id, s.id));
  stripe.retrieve.mockResolvedValue(session(s.id));
  const { container } = await open({ session_id: SESSION });
  expect(container.querySelector('h1')).toHaveTextContent('Your payment went through, but your sign-up is gone.');
  expect(container).toHaveTextContent('Get in touch and we will refund it.');
  expect(container.querySelector('a[data-cta="welcome-contact"]')).toHaveAttribute('href', '/contact');
  expect(await db.select().from(emailLog)).toEqual([]);
});

test('a second payment for a sign-up that was already paid is pointed out, with the way to a refund', async () => {
  const s = await application();
  stripe.retrieve.mockResolvedValue(session(s.id));
  await open({ session_id: SESSION });
  cleanup();
  stripe.retrieve.mockResolvedValue(session(s.id, { id: 'cs_test_fee0000000002', payment_intent: 'pi_fee_2' }));
  const { container } = await open({ session_id: 'cs_test_fee0000000002' });
  expect(container.querySelector('h1')).toHaveTextContent('You’re signed up.');
  expect(container.querySelector('[data-notice="paid-twice"]')).toHaveTextContent(
    'This sign-up was already paid for, so this was a second payment. Get in touch and we will refund it.',
  );
  expect(await row(s.id)).toMatchObject({ feeStatus: 'paid', stripePaymentIntentId: 'pi_fee_1' });
  expect(await db.select().from(emailLog)).toHaveLength(1);
});

test('with the database down, a paid session is still confirmed: the webhook records it', async () => {
  const err = vi.spyOn(console, 'error').mockImplementation(() => {});
  const s = await application();
  stripe.retrieve.mockResolvedValue(session(s.id));
  setDb({ execute: () => { throw new Error('down'); }, select: () => { throw new Error('down'); } } as unknown as DB);
  const { container } = await open({ session_id: SESSION });
  expect(container.querySelector('h1')).toHaveTextContent('You’re signed up.');
  err.mockRestore();
});
