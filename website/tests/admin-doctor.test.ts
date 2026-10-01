import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import { resetDb, useTestDb } from './helpers/db';
import { setDb, type DB } from '@/lib/db';
import {
  adminAuditLog, consultationOffers, consultationRatings, consultations, doctorTokens, emailLog, gps, waitlistSignups,
} from '@/lib/db/schema';

let db: DB;
beforeAll(async () => { db = await useTestDb(); });

const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: async () => new Headers(),
}));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => { throw new Error(`NEXT_REDIRECT ${to}`); },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { sendDoctorLinkAction, setDoctorPausedAction, setStatusAction } from '@/app/admin/(panel)/waitlist/actions';
import { SESSION_COOKIE, hashPassword, signSession } from '@/lib/admin-auth';
import { doctorForSession, signDoctorSession } from '@/lib/doctor-auth';
import { requestSetPasswordLink, setPasswordWithToken } from '@/lib/doctor/account';
import { portalAccountFor } from '@/lib/doctor/admin';
import { dispatch } from '@/lib/doctor/dispatch';
import { splitPrice } from '@/lib/finance/commission';
import { erasePerson, joinWaitlist } from '@/lib/waitlist';

// Every email the code sends, as Resend would receive it.
const sent: Array<{ to: string[]; subject: string; text: string }> = [];

beforeEach(async () => {
  setDb(db);
  vi.unstubAllEnvs();
  vi.stubEnv('ADMIN_SESSION_SECRET', 'y'.repeat(40));
  vi.stubEnv('DOCTOR_SESSION_SECRET', 'd'.repeat(40));
  vi.stubEnv('ADMIN_USERS', `ops@example.com|Olu Ops|${hashPassword('correct horse battery')}`);
  vi.stubEnv('RESEND_API_KEY', 're_test');
  vi.stubEnv('EMAIL_FROM', 'Dr Quick <hello@example.com>');
  sent.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    sent.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify({ id: 'em_1' }), { status: 200 });
  }));
  jar.clear();
  jar.set(SESSION_COOKIE, signSession('ops@example.com')!);
  await resetDb(db);
});

const PASSWORD = 'a long enough password';
const signupRow = async (id: string) => (await db.select().from(waitlistSignups).where(eq(waitlistSignups.id, id)))[0];
const account = async () => (await db.select().from(gps))[0];
const audits = () => db.select().from(adminAuditLog).orderBy(asc(adminAuditLog.id));

async function applicant(email = 'ada@example.com', gmc = '7000001') {
  const { signup } = await joinWaitlist(db, { role: 'gp', email, source: 'hero-gp', name: 'Dr Ada Example', gmc, mobile: '07700900123' });
  return signup;
}

// The applicant sets a password through an emailed link, as they would.
async function claim(email = 'ada@example.com') {
  await requestSetPasswordLink(db, email);
  const token = sent.at(-1)!.text.match(/token=([A-Za-z0-9_-]+)/)![1];
  const result = await setPasswordWithToken(db, token, PASSWORD);
  if (!result.ok) throw new Error(result.error);
  sent.length = 0;
  return result.gp;
}

const goOnline = (id: string, now = new Date()) =>
  db.update(gps).set({ onlineSince: now, lastSeenAt: now, availableSince: now }).where(eq(gps.id, id));

async function waitingRequest(now = new Date()) {
  const [row] = await db.insert(consultations).values({
    patientId: randomUUID(), status: 'requested', requestedAt: now, pricePence: 4000, ...splitPrice(4000, 0),
  }).returning();
  return row;
}

describe('approving a GP', () => {
  test('marking them Active unlocks an account they have already claimed, and tells them', async () => {
    const signup = await applicant();
    const gp = await claim();
    expect(gp.status).toBe('onboarding');

    expect(await setStatusAction(signup.id, 'active')).toMatchObject({ ok: true });
    expect((await account()).status).toBe('active');
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toEqual(['ada@example.com']);
    expect(sent[0].subject).toMatch(/approved/);
    expect(sent[0].text).toContain('/doctor/login');
    expect((await db.select().from(emailLog)).at(-1)).toMatchObject({ template: 'doctor_approved', signupId: signup.id });
  });

  test('marked Active before they have claimed it, they are sent to set it up, and it starts active', async () => {
    const signup = await applicant();
    await setStatusAction(signup.id, 'active');
    expect(await db.select().from(gps)).toHaveLength(0);
    expect(sent[0].text).toContain('/doctor/register');
    expect((await claim()).status).toBe('active');
  });

  test('the approval email goes out once, on the move to Active, not on every other step', async () => {
    const signup = await applicant();
    await setStatusAction(signup.id, 'contacted');
    await setStatusAction(signup.id, 'gmc_verified');
    expect(sent).toHaveLength(0);
  });

  test('moving them back down the pipeline takes them off the floor', async () => {
    const signup = await applicant();
    const gp = await claim();
    await setStatusAction(signup.id, 'active');
    await goOnline(gp.id);

    await setStatusAction(signup.id, 'onboarding');
    expect(await account()).toMatchObject({ status: 'onboarding', onlineSince: null, availableSince: null });
  });

  test('rejecting them ends their sessions and passes on an offer they were holding', async () => {
    const signup = await applicant();
    const gp = await claim();
    await setStatusAction(signup.id, 'active');
    const other = await claim((await applicant('ben@example.com', '7000002')).email);
    await db.update(gps).set({ status: 'active' }).where(eq(gps.id, other.id));

    const now = new Date();
    await goOnline(gp.id, new Date(now.getTime() - 2000));
    await goOnline(other.id, new Date(now.getTime() - 1000));
    await db.update(gps).set({ lastSeenAt: now });
    await waitingRequest(now);
    await dispatch(db, now, { wait: true });
    const session = signDoctorSession(await account())!;
    expect((await db.select().from(consultationOffers))[0]).toMatchObject({ gpId: gp.id, status: 'offered' });

    await setStatusAction(signup.id, 'rejected');
    const [rejected] = await db.select().from(gps).where(eq(gps.id, gp.id));
    expect(rejected).toMatchObject({ status: 'offboarded', onlineSince: null });
    expect(await doctorForSession(db, session)).toBeNull();
    const offers = await db.select().from(consultationOffers).orderBy(asc(consultationOffers.offeredAt));
    expect(offers.map((o) => [o.gpId, o.status])).toEqual([[gp.id, 'expired'], [other.id, 'offered']]);
  });
});

describe('pausing a doctor', () => {
  async function activeDoctor() {
    const signup = await applicant();
    const gp = await claim();
    await setStatusAction(signup.id, 'active');
    sent.length = 0;
    return { signup, gp };
  }

  test('takes an active doctor off the floor without touching their application, and is audited without their address', async () => {
    const { signup, gp } = await activeDoctor();
    await goOnline(gp.id);

    expect(await setDoctorPausedAction(signup.id, true)).toMatchObject({ ok: true });
    expect(await account()).toMatchObject({ status: 'paused', onlineSince: null, availableSince: null });
    expect((await signupRow(signup.id)).status).toBe('active');
    const entry = (await audits()).at(-1)!;
    expect(entry).toMatchObject({ adminEmail: 'ops@example.com', action: 'doctor_pause', target: signup.id });
    expect(JSON.stringify(entry)).not.toContain('ada@example.com');
  });

  test('resuming puts them back to active, still offline until they choose to go online', async () => {
    const { signup } = await activeDoctor();
    await setDoctorPausedAction(signup.id, true);
    expect(await setDoctorPausedAction(signup.id, false)).toMatchObject({ ok: true });
    expect(await account()).toMatchObject({ status: 'active', onlineSince: null });
    expect((await audits()).at(-1)).toMatchObject({ action: 'doctor_resume' });
  });

  test('a doctor who is not yet approved, or has no account, cannot be paused or resumed', async () => {
    const noAccount = await applicant();
    expect(await setDoctorPausedAction(noAccount.id, true)).toMatchObject({ ok: false });
    await claim();
    expect(await setDoctorPausedAction(noAccount.id, true)).toMatchObject({ ok: false });
    expect(await setDoctorPausedAction(noAccount.id, false)).toMatchObject({ ok: false });
    expect((await account()).status).toBe('onboarding');
  });
});

describe('sending a sign-in link', () => {
  test('emails the GP a set-password link and audits it', async () => {
    const signup = await applicant();
    expect(await sendDoctorLinkAction(signup.id)).toMatchObject({ ok: true });
    expect(sent[0].text).toMatch(/\/doctor\/set-password\?token=/);
    expect((await audits()).at(-1)).toMatchObject({ action: 'doctor_link_sent', target: signup.id });
    expect(await db.select().from(doctorTokens)).toHaveLength(1);
  });

  test('a rejected GP is not sent one, and the admin is told', async () => {
    const signup = await applicant();
    await setStatusAction(signup.id, 'rejected');
    sent.length = 0;
    expect(await sendDoctorLinkAction(signup.id)).toMatchObject({ ok: false });
    expect(sent).toHaveLength(0);
  });
});

describe('what the admin sees', () => {
  test('nothing for a GP who has not claimed an account', async () => {
    const signup = await applicant();
    expect(await portalAccountFor(db, signup.id)).toBeNull();
  });

  test('the account’s status, whether they are online, their rating and how much they have done', async () => {
    const signup = await applicant();
    const gp = await claim();
    await setStatusAction(signup.id, 'active');
    const now = new Date();
    await goOnline(gp.id, now);
    for (const stars of [5, 4]) {
      const [c] = await db.insert(consultations).values({
        patientId: randomUUID(), gpId: gp.id, status: 'completed', requestedAt: now, pricePence: 4000, ...splitPrice(4000, 0),
      }).returning();
      await db.insert(consultationRatings).values({ consultationId: c.id, gpId: gp.id, stars });
    }
    expect(await portalAccountFor(db, signup.id, now)).toMatchObject({
      id: gp.id, status: 'active', claimed: true, online: true, completed: 2, rating: { average: 4.5, count: 2 },
    });
  });
});

describe('the actions refuse a visitor with no admin session', () => {
  test('pause and send-link redirect to sign-in and change nothing', async () => {
    const signup = await applicant();
    jar.clear();
    await expect(setDoctorPausedAction(signup.id, true)).rejects.toThrow('NEXT_REDIRECT /admin/login');
    await expect(sendDoctorLinkAction(signup.id)).rejects.toThrow('NEXT_REDIRECT /admin/login');
    expect(sent).toHaveLength(0);
  });
});

describe('erasing a GP who has a portal account', () => {
  test('with no consultations, the account goes with everything else', async () => {
    await applicant();
    await claim();
    await requestSetPasswordLink(db, 'ada@example.com');
    await erasePerson(db, 'ada@example.com');
    expect(await db.select().from(gps)).toHaveLength(0);
    expect(await db.select().from(doctorTokens)).toHaveLength(0);
  });

  test('with consultations, the sign-in and the profile are cleared and the financial record is kept', async () => {
    await applicant();
    const gp = await claim();
    await db.update(gps).set({ status: 'active', bio: 'A GP in Leeds.', languages: 'English' }).where(eq(gps.id, gp.id));
    await goOnline(gp.id);
    const session = signDoctorSession(await account())!;
    const [c] = await db.insert(consultations).values({
      patientId: randomUUID(), gpId: gp.id, status: 'completed', requestedAt: new Date(), pricePence: 4000, ...splitPrice(4000, 0),
    }).returning();

    await erasePerson(db, 'ada@example.com');
    const kept = await account();
    // Who was paid for what stays; how to reach them and how to sign in goes.
    expect(kept).toMatchObject({
      id: gp.id, name: 'Dr Ada Example', gmc: '7000001', status: 'offboarded',
      passwordHash: null, mobile: null, bio: '', languages: '', onlineSince: null, signupId: null,
    });
    expect(kept.email).not.toContain('ada@example.com');
    expect(await doctorForSession(db, session)).toBeNull();
    expect((await db.select().from(consultations))[0]).toMatchObject({ id: c.id, gpId: gp.id });
  });
});
