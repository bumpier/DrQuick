'use server';
// The profile's server actions. Each is an untrusted POST (Next checks only
// that it is same-origin), so each starts with requireDoctor() and acts on
// that doctor alone: no id is ever taken from the browser.
import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { requireDoctor, startDoctorSession } from '@/lib/doctor-auth';
import { PASSWORD_MIN } from '@/lib/doctor/account';
import { changePassword, saveProfile, type ProfileErrors } from '@/lib/doctor/profile';
import { hashKey, hit } from '@/lib/rate-limit';

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };
export type ProfileResult = ActionResult & { fieldErrors?: ProfileErrors };

const NO_DB: ActionResult = { ok: false, error: 'The database is not configured on this server (set DATABASE_URL).' };

export async function saveProfileAction(input: Record<string, unknown>): Promise<ProfileResult> {
  const doctor = await requireDoctor();
  const db = await getDb();
  if (!db) return NO_DB;
  const result = await saveProfile(db, doctor.id, input ?? {});
  if (!result.ok) return { ok: false, error: 'Check the highlighted fields.', fieldErrors: result.errors };
  // The name is in the sidebar, which belongs to the layout.
  revalidatePath('/doctor', 'layout');
  return { ok: true, message: 'Profile saved.' };
}

// Five tries per ten minutes: a stolen session must not be a way to guess the
// password behind it.
const ATTEMPTS = 5;
const WINDOW_S = 600;

export async function changePasswordAction(current: string, next: string, confirm: string): Promise<ActionResult> {
  const doctor = await requireDoctor();
  const db = await getDb();
  if (!db) return NO_DB;
  if (String(next) !== String(confirm)) return { ok: false, error: 'The two new passwords do not match.' };
  if ((await hit(db, hashKey('rl:doctor-password', doctor.id), WINDOW_S)) > ATTEMPTS) {
    return { ok: false, error: 'Too many attempts. Try again in ten minutes.' };
  }
  const result = await changePassword(db, doctor.id, String(current ?? ''), String(next ?? ''));
  if (!result.ok) {
    return {
      ok: false,
      error: result.error === 'wrong_password' ? 'Your current password is not right.' : `Use at least ${PASSWORD_MIN} characters.`,
    };
  }
  // Every earlier session has just ended, this one included; sign this device back in.
  await startDoctorSession(result.gp);
  return { ok: true, message: 'Password changed. Other devices have been signed out.' };
}
