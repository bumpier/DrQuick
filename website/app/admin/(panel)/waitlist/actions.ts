'use server';
// The waitlist's server actions. Each is an untrusted POST (Next checks only
// that it is same-origin), so each starts with requireAdmin(), validates its
// input from scratch and writes one admin_audit_log row. The audit never holds
// the address of the person acted on, only the sign-up id.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, eq, inArray } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin-auth';
import { audit } from '@/lib/admin/audit';
import { getSignup, statusesFor } from '@/lib/admin/queries/waitlist';
import { getDb } from '@/lib/db';
import { waitlistSignups } from '@/lib/db/schema';
import { renderFor, sendEmail } from '@/lib/email';
import { NOTES_MAX } from '@/lib/admin/format';
import { erasePerson, UUID } from '@/lib/waitlist';

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const NO_DB: ActionResult = { ok: false, error: 'The database is not configured on this server (set DATABASE_URL).' };
const GONE: ActionResult = { ok: false, error: 'This sign-up no longer exists. It may have been erased.' };

const listPath = (role: string) => (role === 'gp' ? '/admin/waitlist/gps' : '/admin/waitlist/patients');

function refresh(role: string, id?: string) {
  revalidatePath(listPath(role));
  if (id) revalidatePath(`${listPath(role)}/${id}`);
  revalidatePath('/admin');
}

export async function setStatusAction(id: string, status: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const db = await getDb();
  if (!db) return NO_DB;
  const signup = await getSignup(db, String(id));
  if (!signup) return GONE;
  if (!statusesFor(signup.role).includes(status)) return { ok: false, error: 'That is not a status this sign-up can have.' };
  if (signup.status === status) return { ok: true, message: 'No change.' };

  const now = new Date();
  await db.update(waitlistSignups).set({
    status,
    updatedAt: now,
    ...(signup.role === 'patient' ? { unsubscribedAt: status === 'unsubscribed' ? now : null } : {}),
  }).where(eq(waitlistSignups.id, signup.id));
  await audit(db, admin, 'status_change', signup.id, { role: signup.role, from: signup.status, to: status });
  refresh(signup.role, signup.id);
  return { ok: true, message: 'Status updated.' };
}

export async function saveNotesAction(id: string, notes: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const db = await getDb();
  if (!db) return NO_DB;
  const text = String(notes ?? '');
  if (text.length > NOTES_MAX) return { ok: false, error: `Notes can be up to ${NOTES_MAX.toLocaleString('en-GB')} characters.` };
  const signup = await getSignup(db, String(id));
  if (!signup) return GONE;
  await db.update(waitlistSignups).set({ notes: text, updatedAt: new Date() }).where(eq(waitlistSignups.id, signup.id));
  // The length only: notes can name the person, and the audit log outlives an erasure.
  await audit(db, admin, 'notes_update', signup.id, { length: text.length });
  refresh(signup.role, signup.id);
  return { ok: true, message: 'Notes saved.' };
}

export async function bulkUnsubscribeAction(ids: string[]): Promise<ActionResult> {
  const admin = await requireAdmin();
  const db = await getDb();
  if (!db) return NO_DB;
  const clean = [...new Set((Array.isArray(ids) ? ids : []).map(String).filter((id) => UUID.test(id)))].slice(0, 1000);
  if (clean.length === 0) return { ok: false, error: 'Select at least one patient.' };
  const now = new Date();
  const changed = await db.update(waitlistSignups)
    .set({ status: 'unsubscribed', unsubscribedAt: now, updatedAt: now })
    .where(and(inArray(waitlistSignups.id, clean), eq(waitlistSignups.role, 'patient'), eq(waitlistSignups.status, 'subscribed')))
    .returning({ id: waitlistSignups.id });
  await audit(db, admin, 'bulk_unsubscribe', null, { ids: changed.map((c) => c.id), count: changed.length });
  refresh('patient');
  const n = changed.length;
  return { ok: true, message: n === 0 ? 'They were already unsubscribed.' : `${n} ${n === 1 ? 'patient' : 'patients'} unsubscribed.` };
}

export async function resendConfirmationAction(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const db = await getDb();
  if (!db) return NO_DB;
  const signup = await getSignup(db, String(id));
  if (!signup) return GONE;
  const { template, email } = renderFor(signup);
  const status = await sendEmail(db, signup.email, template, email, signup.id);
  await audit(db, admin, 'resend_confirmation', signup.id, { template, status });
  refresh(signup.role, signup.id);
  if (status === 'sent') return { ok: true, message: 'Confirmation email sent.' };
  if (status === 'skipped') return { ok: false, error: 'Email is not set up on this server (RESEND_API_KEY and EMAIL_FROM), so nothing was sent. The attempt is logged.' };
  return { ok: false, error: 'The email provider refused the message. The error is in the email history below.' };
}

// A right-to-erasure request, made by an admin. Removes every sign-up for the
// address (both roles), the linked visitor's analytics and the email log, then
// returns to the list with a notice. The confirm dialog is in the browser; this
// action is the real gate.
export async function erasePersonAction(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const db = await getDb();
  if (!db) return NO_DB;
  const signup = await getSignup(db, String(id));
  if (!signup) return GONE;
  const removed = await erasePerson(db, signup.email);
  await audit(db, admin, 'erase_person', signup.id, { role: signup.role, signupsRemoved: removed });
  refresh(signup.role, signup.id);
  redirect(`${listPath(signup.role)}?notice=erased`);
}
