import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { resetDb, useTestDb } from './helpers/db';
import { setDb, type DB } from '@/lib/db';
import { gps } from '@/lib/db/schema';

// next/headers is request-scoped; stand in a cookie jar and a header bag.
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

import { hashPassword } from '@/lib/admin-auth';
import { signToken } from '@/lib/signed-token';
import {
  DOCTOR_COOKIE, DOCTOR_SESSION_HOURS, doctorForSession, doctorLoginAllowed, requireDoctor,
  signDoctorSession, verifyDoctorCredentials,
} from '@/lib/doctor-auth';
import { signIn, signOut } from '@/app/doctor/actions';

const SECRET = 'd'.repeat(40);
const PASSWORD = 'correct horse battery';
const HASH = hashPassword(PASSWORD);

let db: DB;
beforeAll(async () => { db = await useTestDb(); });

beforeEach(async () => {
  vi.unstubAllEnvs();
  setDb(db);
  vi.stubEnv('DOCTOR_SESSION_SECRET', SECRET);
  jar.clear();
  reqHeaders.set('x-forwarded-for', '203.0.113.9');
  await resetDb(db);
});

type GpInsert = typeof gps.$inferInsert;
async function makeGp(over: Partial<GpInsert> = {}) {
  const [row] = await db.insert(gps).values({
    name: 'Dr Ada Example', email: 'ada@example.com', gmc: '7000001', status: 'active', passwordHash: HASH, ...over,
  }).returning();
  return row;
}

describe('sessions', () => {
  test('a signed session reads back as its doctor, without the password hash', async () => {
    const gp = await makeGp();
    const doctor = await doctorForSession(db, signDoctorSession(gp, 1000)!, 2000);
    expect(doctor).toMatchObject({ id: gp.id, name: 'Dr Ada Example', email: 'ada@example.com', status: 'active' });
    expect(doctor).not.toHaveProperty('passwordHash');
  });

  test('a session signed before the password changed is refused', async () => {
    const gp = await makeGp();
    const token = signDoctorSession(gp)!;
    await db.update(gps).set({ sessionEpoch: gp.sessionEpoch + 1 }).where(eq(gps.id, gp.id));
    expect(await doctorForSession(db, token)).toBeNull();
  });

  test('an offboarded doctor has no session; one still onboarding or paused does', async () => {
    const gp = await makeGp();
    const token = signDoctorSession(gp)!;
    for (const status of ['onboarding', 'paused'] as const) {
      await db.update(gps).set({ status }).where(eq(gps.id, gp.id));
      expect((await doctorForSession(db, token))?.status).toBe(status);
    }
    await db.update(gps).set({ status: 'offboarded' }).where(eq(gps.id, gp.id));
    expect(await doctorForSession(db, token)).toBeNull();
  });

  test('a session expires', async () => {
    const gp = await makeGp();
    const token = signDoctorSession(gp, 0)!;
    expect(await doctorForSession(db, token, DOCTOR_SESSION_HOURS * 3600_000 - 1)).not.toBeNull();
    expect(await doctorForSession(db, token, DOCTOR_SESSION_HOURS * 3600_000)).toBeNull();
  });

  test('with no secret, or a short one, nothing is signed and nothing reads', async () => {
    const gp = await makeGp();
    const token = signDoctorSession(gp)!;
    vi.stubEnv('DOCTOR_SESSION_SECRET', 'short');
    expect(signDoctorSession(gp)).toBeNull();
    expect(await doctorForSession(db, token)).toBeNull();
  });

  test('a token of another shape, even signed with the same key, is not a doctor session', async () => {
    await makeGp();
    const adminShaped = signToken({ email: 'ada@example.com', exp: Date.now() + 1e9 }, SECRET);
    expect(await doctorForSession(db, adminShaped)).toBeNull();
    expect(await doctorForSession(db, 'garbage')).toBeNull();
    expect(await doctorForSession(db, undefined)).toBeNull();
  });

  test('requireDoctor sends a visitor with no session to sign in', async () => {
    await expect(requireDoctor()).rejects.toThrow('NEXT_REDIRECT /doctor/login');
  });
});

describe('credentials', () => {
  test('the right password signs in, whatever the case of the email', async () => {
    const gp = await makeGp();
    expect((await verifyDoctorCredentials(db, ' ADA@example.com ', PASSWORD))?.id).toBe(gp.id);
  });

  test('a wrong password, an unknown email, an unclaimed account and an offboarded one are all refused', async () => {
    await makeGp();
    await makeGp({ email: 'new@example.com', gmc: '7000002', passwordHash: null });
    await makeGp({ email: 'gone@example.com', gmc: '7000003', status: 'offboarded' });
    expect(await verifyDoctorCredentials(db, 'ada@example.com', 'wrong')).toBeNull();
    expect(await verifyDoctorCredentials(db, 'nobody@example.com', PASSWORD)).toBeNull();
    expect(await verifyDoctorCredentials(db, 'new@example.com', PASSWORD)).toBeNull();
    expect(await verifyDoctorCredentials(db, 'new@example.com', 'decoy')).toBeNull();
    expect(await verifyDoctorCredentials(db, 'gone@example.com', PASSWORD)).toBeNull();
  });
});

describe('sign in and out', () => {
  const form = (email: string, password: string) => {
    const f = new FormData();
    f.set('email', email);
    f.set('password', password);
    return f;
  };
  const INITIAL = { error: null, email: '' };

  test('the right credentials set a strict, httpOnly cookie on /doctor and go to the dashboard', async () => {
    const gp = await makeGp();
    await expect(signIn(INITIAL, form('ada@example.com', PASSWORD))).rejects.toThrow('NEXT_REDIRECT /doctor');
    const cookie = jar.get(DOCTOR_COOKIE)!;
    expect(cookie.opts).toMatchObject({ httpOnly: true, sameSite: 'strict', path: '/doctor' });
    expect((await doctorForSession(db, cookie.value))?.id).toBe(gp.id);
    await expect(requireDoctor()).resolves.toMatchObject({ name: 'Dr Ada Example' });
  });

  test('a wrong password and an unknown email get the same answer, and no cookie', async () => {
    await makeGp();
    const a = await signIn(INITIAL, form('ada@example.com', 'nope'));
    const b = await signIn(INITIAL, form('nobody@example.com', 'nope'));
    expect(a.error).toBe('Email or password not recognised.');
    expect(b.error).toBe(a.error);
    expect(jar.has(DOCTOR_COOKIE)).toBe(false);
  });

  test('the sixth attempt in ten minutes is refused, even with the right password', async () => {
    await makeGp();
    for (let i = 0; i < 5; i += 1) await signIn(INITIAL, form('ada@example.com', 'nope'));
    const sixth = await signIn(INITIAL, form('ada@example.com', PASSWORD));
    expect(sixth.error).toMatch(/Too many attempts/);
    expect(jar.has(DOCTOR_COOKIE)).toBe(false);
  });

  test('the throttle is per IP and email', async () => {
    for (let i = 0; i < 5; i += 1) expect(await doctorLoginAllowed(db, '1.1.1.1', 'a@example.com')).toBe(true);
    expect(await doctorLoginAllowed(db, '1.1.1.1', 'a@example.com')).toBe(false);
    expect(await doctorLoginAllowed(db, '2.2.2.2', 'a@example.com')).toBe(true);
  });

  test('a server with no database says so, rather than blaming the password', async () => {
    setDb(null);
    const result = await signIn(INITIAL, form('ada@example.com', PASSWORD));
    expect(result.error).toMatch(/database/);
    expect(jar.has(DOCTOR_COOKIE)).toBe(false);
  });

  test('signing out clears the cookie', async () => {
    const gp = await makeGp();
    jar.set(DOCTOR_COOKIE, { value: signDoctorSession(gp)! });
    await expect(signOut()).rejects.toThrow('NEXT_REDIRECT /doctor/login');
    expect(jar.has(DOCTOR_COOKIE)).toBe(false);
  });
});
