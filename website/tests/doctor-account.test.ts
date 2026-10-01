import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { resetDb, useTestDb } from './helpers/db';
import { setDb, type DB } from '@/lib/db';
import { doctorTokens, emailLog, gps, waitlistSignups } from '@/lib/db/schema';

const jar = new Map<string, { value: string; opts?: Record<string, unknown> }>();
const reqHeaders = new Headers();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)!.value } : undefined),
    set: (name: string, value: string, opts?: Record<string, unknown>) => { jar.set(name, { value, opts }); },
    delete: (arg: string | { name: string }) => { jar.delete(typeof arg === 'string' ? arg : arg.name); },
  }),
  headers: async () => reqHeaders,
}));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => { throw Object.assign(new Error(`NEXT_REDIRECT ${to}`), { digest: `NEXT_REDIRECT;${to}` }); },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { hashPassword, verifyPassword } from '@/lib/admin-auth';
import { DOCTOR_COOKIE, doctorForSession, signDoctorSession } from '@/lib/doctor-auth';
import { LINK_MINUTES, accountStatusFor, linkIsLive, requestSetPasswordLink, setPasswordWithToken } from '@/lib/doctor/account';
import { requestLink, setPassword } from '@/app/doctor/actions';
import { joinWaitlist } from '@/lib/waitlist';

const NOW = new Date('2026-10-01T09:00:00Z');
const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);
const PASSWORD = 'a long enough password';

// Every email the code sends, as Resend would receive it.
const sent: Array<{ to: string[]; subject: string; text: string; html: string }> = [];

let db: DB;
beforeAll(async () => { db = await useTestDb(); });

beforeEach(async () => {
  vi.unstubAllEnvs();
  setDb(db);
  vi.stubEnv('DOCTOR_SESSION_SECRET', 'd'.repeat(40));
  vi.stubEnv('RESEND_API_KEY', 're_test');
  vi.stubEnv('EMAIL_FROM', 'Dr Quick <hello@example.com>');
  sent.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    sent.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify({ id: 'em_1' }), { status: 200 });
  }));
  jar.clear();
  reqHeaders.set('x-forwarded-for', '203.0.113.9');
  await resetDb(db);
});

async function gpSignup(email = 'ada@example.com', gmc = '7000001', status = 'new') {
  const { signup } = await joinWaitlist(db, { role: 'gp', email, source: 'hero-gp', name: 'Dr Ada Example', gmc, mobile: '07700900123' });
  if (status !== 'new') await db.update(waitlistSignups).set({ status }).where(eq(waitlistSignups.id, signup.id));
  return signup;
}

// The token in the link the last email carried.
function emailedToken(): string {
  const match = sent.at(-1)?.text.match(/\/doctor\/set-password\?token=([A-Za-z0-9_-]+)/);
  if (!match) throw new Error('no set-password link in the last email');
  return match[1];
}

test('a waitlist status maps to an account status', () => {
  expect(accountStatusFor('active')).toBe('active');
  expect(accountStatusFor('rejected')).toBe('offboarded');
  for (const s of ['new', 'contacted', 'gmc_verified', 'onboarding']) expect(accountStatusFor(s)).toBe('onboarding');
});

describe('asking for a link', () => {
  test('an address nobody signed up with gets nothing: no token, no email', async () => {
    expect(await requestSetPasswordLink(db, 'nobody@example.com', NOW)).toBe(false);
    expect(await db.select().from(doctorTokens)).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });

  test('a patient sign-up with the address does not count', async () => {
    await joinWaitlist(db, { role: 'patient', email: 'ada@example.com', source: 'hero' });
    expect(await requestSetPasswordLink(db, 'ada@example.com', NOW)).toBe(false);
  });

  test('a rejected GP gets nothing', async () => {
    await gpSignup('ada@example.com', '7000001', 'rejected');
    expect(await requestSetPasswordLink(db, 'ada@example.com', NOW)).toBe(false);
  });

  test('a GP who signed up is emailed a link, and only its hash is stored', async () => {
    const signup = await gpSignup();
    expect(await requestSetPasswordLink(db, ' ADA@example.com ', NOW)).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toEqual(['ada@example.com']);
    const token = emailedToken();
    const [row] = await db.select().from(doctorTokens);
    expect(row.email).toBe('ada@example.com');
    expect(row.tokenHash).not.toContain(token);
    expect(row.expiresAt.getTime()).toBe(later(LINK_MINUTES).getTime());
    const [log] = await db.select().from(emailLog);
    expect(log).toMatchObject({ template: 'doctor_set_password', status: 'sent', signupId: signup.id });
  });

  test('a second link replaces the first', async () => {
    await gpSignup();
    await requestSetPasswordLink(db, 'ada@example.com', NOW);
    const first = emailedToken();
    await requestSetPasswordLink(db, 'ada@example.com', later(1));
    expect(await linkIsLive(db, first, later(2))).toBe(false);
    expect(await linkIsLive(db, emailedToken(), later(2))).toBe(true);
  });
});

describe('setting a password', () => {
  test('the first use creates the account from the sign-up', async () => {
    const signup = await gpSignup();
    await requestSetPasswordLink(db, 'ada@example.com', NOW);
    const result = await setPasswordWithToken(db, emailedToken(), PASSWORD, later(5));
    expect(result.ok).toBe(true);
    const [gp] = await db.select().from(gps);
    expect(gp).toMatchObject({
      signupId: signup.id, name: 'Dr Ada Example', email: 'ada@example.com', gmc: '7000001',
      mobile: '07700900123', status: 'onboarding',
    });
    expect(verifyPassword(PASSWORD, gp.passwordHash!)).toBe(true);
  });

  test('a GP the team has already marked Active starts active', async () => {
    await gpSignup('ada@example.com', '7000001', 'active');
    await requestSetPasswordLink(db, 'ada@example.com', NOW);
    await setPasswordWithToken(db, emailedToken(), PASSWORD, later(5));
    expect((await db.select().from(gps))[0].status).toBe('active');
  });

  test('a link works once', async () => {
    await gpSignup();
    await requestSetPasswordLink(db, 'ada@example.com', NOW);
    const token = emailedToken();
    expect((await setPasswordWithToken(db, token, PASSWORD, later(5))).ok).toBe(true);
    expect(await setPasswordWithToken(db, token, 'another long password', later(6))).toEqual({ ok: false, error: 'invalid_link' });
    expect(verifyPassword(PASSWORD, (await db.select().from(gps))[0].passwordHash!)).toBe(true);
  });

  test('a link stops working when it expires, and an unknown one never did', async () => {
    await gpSignup();
    await requestSetPasswordLink(db, 'ada@example.com', NOW);
    const token = emailedToken();
    expect(await linkIsLive(db, token, later(LINK_MINUTES - 1))).toBe(true);
    expect(await linkIsLive(db, token, later(LINK_MINUTES))).toBe(false);
    expect(await setPasswordWithToken(db, token, PASSWORD, later(LINK_MINUTES))).toEqual({ ok: false, error: 'invalid_link' });
    expect(await setPasswordWithToken(db, 'not-a-token', PASSWORD, NOW)).toEqual({ ok: false, error: 'invalid_link' });
    expect(await db.select().from(gps)).toHaveLength(0);
  });

  test('a short password is refused and the link is still good', async () => {
    await gpSignup();
    await requestSetPasswordLink(db, 'ada@example.com', NOW);
    const token = emailedToken();
    expect(await setPasswordWithToken(db, token, 'short', later(5))).toEqual({ ok: false, error: 'weak_password' });
    expect(await linkIsLive(db, token, later(6))).toBe(true);
  });

  test('a reset changes the password and ends every earlier session', async () => {
    const [gp] = await db.insert(gps).values({
      name: 'Dr Ada Example', email: 'ada@example.com', gmc: '7000001', status: 'active', passwordHash: hashPassword('the old password 1'),
    }).returning();
    const oldSession = signDoctorSession(gp)!;
    expect(await requestSetPasswordLink(db, 'ada@example.com', NOW)).toBe(true);
    const result = await setPasswordWithToken(db, emailedToken(), PASSWORD, later(5));
    expect(result.ok).toBe(true);
    const [after] = await db.select().from(gps);
    expect(after.id).toBe(gp.id);
    expect(after.status).toBe('active');
    expect(verifyPassword(PASSWORD, after.passwordHash!)).toBe(true);
    expect(await doctorForSession(db, oldSession)).toBeNull();
  });

  test('an offboarded doctor cannot reset their way back in', async () => {
    await db.insert(gps).values({
      name: 'Dr Ada Example', email: 'ada@example.com', gmc: '7000001', status: 'offboarded', passwordHash: hashPassword(PASSWORD),
    });
    expect(await requestSetPasswordLink(db, 'ada@example.com', NOW)).toBe(false);
  });

  test('a GMC number another account already holds is refused, and the link is still good', async () => {
    await db.insert(gps).values({ name: 'Dr Other', email: 'other@example.com', gmc: '7000001', status: 'active' });
    await gpSignup('ada@example.com', '7000001');
    await requestSetPasswordLink(db, 'ada@example.com', NOW);
    const token = emailedToken();
    expect(await setPasswordWithToken(db, token, PASSWORD, later(5))).toEqual({ ok: false, error: 'gmc_taken' });
    expect(await linkIsLive(db, token, later(6))).toBe(true);
    expect(await db.select().from(gps)).toHaveLength(1);
  });
});

describe('the forms', () => {
  const form = (fields: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(fields)) f.set(k, v);
    return f;
  };

  test('asking for a link gives the same answer whether or not the address signed up', async () => {
    await gpSignup();
    const known = await requestLink({ error: null, sent: false, email: '' }, form({ email: 'ada@example.com' }));
    const unknown = await requestLink({ error: null, sent: false, email: '' }, form({ email: 'nobody@example.com' }));
    expect(known).toEqual({ error: null, sent: true, email: 'ada@example.com' });
    expect(unknown).toEqual({ error: null, sent: true, email: 'nobody@example.com' });
    expect(sent).toHaveLength(1);
  });

  test('something that is not an email address is told so', async () => {
    const result = await requestLink({ error: null, sent: false, email: '' }, form({ email: 'not an email' }));
    expect(result.sent).toBe(false);
    expect(result.error).toMatch(/valid email/);
  });

  test('the fourth request for one address in an hour sends nothing', async () => {
    await gpSignup();
    for (let i = 0; i < 4; i += 1) await requestLink({ error: null, sent: false, email: '' }, form({ email: 'ada@example.com' }));
    expect(sent).toHaveLength(3);
  });

  test('setting a password signs the doctor in and goes to the dashboard', async () => {
    await gpSignup();
    await requestSetPasswordLink(db, 'ada@example.com', new Date());
    const fields = { token: emailedToken(), password: PASSWORD, confirm: PASSWORD };
    await expect(setPassword({ error: null }, form(fields))).rejects.toThrow('NEXT_REDIRECT /doctor');
    const cookie = jar.get(DOCTOR_COOKIE)!;
    expect(cookie.opts).toMatchObject({ httpOnly: true, sameSite: 'strict', path: '/doctor' });
    expect((await doctorForSession(db, cookie.value))?.email).toBe('ada@example.com');
  });

  test('two different passwords, a short one and a dead link are each told plainly', async () => {
    await gpSignup();
    await requestSetPasswordLink(db, 'ada@example.com', new Date());
    const token = emailedToken();
    expect((await setPassword({ error: null }, form({ token, password: PASSWORD, confirm: 'something else entirely' }))).error)
      .toMatch(/do not match/);
    expect((await setPassword({ error: null }, form({ token, password: 'short', confirm: 'short' }))).error)
      .toMatch(/at least 12 characters/);
    expect((await setPassword({ error: null }, form({ token: 'nope', password: PASSWORD, confirm: PASSWORD }))).error)
      .toMatch(/link has expired/);
    expect(jar.has(DOCTOR_COOKIE)).toBe(false);
  });
});
