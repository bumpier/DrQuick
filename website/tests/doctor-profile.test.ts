import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { resetDb, useTestDb } from './helpers/db';
import { setDb, type DB } from '@/lib/db';
import { gps } from '@/lib/db/schema';

const jar = new Map<string, { value: string; opts?: Record<string, unknown> }>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)!.value } : undefined),
    set: (name: string, value: string, opts?: Record<string, unknown>) => { jar.set(name, { value, opts }); },
    delete: (arg: string | { name: string }) => { jar.delete(typeof arg === 'string' ? arg : arg.name); },
  }),
  headers: async () => new Headers(),
}));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => { throw Object.assign(new Error(`NEXT_REDIRECT ${to}`), { digest: `NEXT_REDIRECT;${to}` }); },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { hashPassword, verifyPassword } from '@/lib/admin-auth';
import { DOCTOR_COOKIE, doctorForSession, signDoctorSession } from '@/lib/doctor-auth';
import { BIO_MAX, normaliseProfile, profileErrors, saveProfile } from '@/lib/doctor/profile';
import { changePasswordAction, saveProfileAction } from '@/app/doctor/(portal)/profile/actions';

const PASSWORD = 'correct horse battery';

let db: DB;
beforeAll(async () => { db = await useTestDb(); });

let gp: typeof gps.$inferSelect;
beforeEach(async () => {
  vi.unstubAllEnvs();
  setDb(db);
  vi.stubEnv('DOCTOR_SESSION_SECRET', 'd'.repeat(40));
  jar.clear();
  await resetDb(db);
  [gp] = await db.insert(gps).values({
    name: 'Dr Ada Example', email: 'ada@example.com', gmc: '7000001', status: 'active',
    mobile: '07700900123', passwordHash: hashPassword(PASSWORD),
  }).returning();
  jar.set(DOCTOR_COOKIE, { value: signDoctorSession(gp)! });
});

const row = async () => (await db.select().from(gps).where(eq(gps.id, gp.id)))[0];
const VALID = { name: 'Dr Ada B Example', mobile: '07700 900456', bio: 'A GP in Leeds.', languages: 'English, Urdu' };

describe('the rules', () => {
  test('input is tidied: spacing, the mobile’s prefix, and nothing but the four fields', () => {
    expect(normaliseProfile({
      name: '  Dr   Ada  Example ', mobile: '+44 7700 900456', bio: '  A GP in Leeds.  ', languages: ' English,  Urdu ',
      email: 'someone@else.com', gmc: '9999999',
    })).toEqual({ name: 'Dr Ada Example', mobile: '07700900456', bio: 'A GP in Leeds.', languages: 'English, Urdu' });
  });

  test('a valid profile has no errors', () => {
    expect(profileErrors(normaliseProfile(VALID))).toEqual({});
  });

  test('a one-letter name, a landline and a bio past the limit are each named', () => {
    const errors = profileErrors(normaliseProfile({ ...VALID, name: 'A', mobile: '0113 496 0000', bio: 'x'.repeat(BIO_MAX + 1) }));
    expect(Object.keys(errors).sort()).toEqual(['bio', 'mobile', 'name']);
  });

  test('bio and languages may be left empty', () => {
    expect(profileErrors(normaliseProfile({ ...VALID, bio: '', languages: '' }))).toEqual({});
  });
});

describe('saving', () => {
  test('the four fields are stored and the email and GMC number are untouched', async () => {
    const result = await saveProfile(db, gp.id, { ...VALID, email: 'someone@else.com', gmc: '9999999' });
    expect(result).toEqual({ ok: true });
    expect(await row()).toMatchObject({
      name: 'Dr Ada B Example', mobile: '07700900456', bio: 'A GP in Leeds.', languages: 'English, Urdu',
      email: 'ada@example.com', gmc: '7000001',
    });
  });

  test('an invalid profile is refused whole and says which fields', async () => {
    const result = await saveProfile(db, gp.id, { ...VALID, name: 'A' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors)).toEqual(['name']);
    expect((await row()).name).toBe('Dr Ada Example');
  });

  test('the action saves for the signed-in doctor', async () => {
    expect(await saveProfileAction(VALID)).toMatchObject({ ok: true });
    expect((await row()).bio).toBe('A GP in Leeds.');
  });

  test('the action refuses a visitor with no session', async () => {
    jar.clear();
    await expect(saveProfileAction(VALID)).rejects.toThrow('NEXT_REDIRECT /doctor/login');
    expect((await row()).bio).toBe('');
  });
});

describe('changing the password', () => {
  const NEXT = 'a brand new password';

  test('the wrong current password changes nothing', async () => {
    const result = await changePasswordAction('not my password', NEXT, NEXT);
    expect(result).toMatchObject({ ok: false });
    expect(verifyPassword(PASSWORD, (await row()).passwordHash!)).toBe(true);
  });

  test('a short new password, or two that differ, change nothing', async () => {
    expect(await changePasswordAction(PASSWORD, 'short', 'short')).toMatchObject({ ok: false });
    expect(await changePasswordAction(PASSWORD, NEXT, 'something else entirely')).toMatchObject({ ok: false });
    expect(verifyPassword(PASSWORD, (await row()).passwordHash!)).toBe(true);
  });

  test('the right one changes it, ends every other session and keeps this one signed in', async () => {
    const otherDevice = signDoctorSession(gp)!;
    expect(await changePasswordAction(PASSWORD, NEXT, NEXT)).toMatchObject({ ok: true });
    expect(verifyPassword(NEXT, (await row()).passwordHash!)).toBe(true);
    expect(await doctorForSession(db, otherDevice)).toBeNull();
    expect((await doctorForSession(db, jar.get(DOCTOR_COOKIE)!.value))?.id).toBe(gp.id);
  });

  test('a visitor with no session is refused', async () => {
    jar.clear();
    await expect(changePasswordAction(PASSWORD, NEXT, NEXT)).rejects.toThrow('NEXT_REDIRECT /doctor/login');
  });
});
