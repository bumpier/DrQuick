'use server';
// The System pages' server actions. Like every admin action: requireAdmin()
// first, the input validated from scratch, one audit row, and no email
// address of the person acted on in the audit (a sign-up id or a count).
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/admin-auth';
import { audit } from '@/lib/admin/audit';
import { getSignup } from '@/lib/admin/queries/waitlist';
import { getDb } from '@/lib/db';
import { emailLog } from '@/lib/db/schema';
import { adminNewGp } from '@/lib/email-templates';
import { renderFor, sendEmail } from '@/lib/email';
import { normaliseEmail, MAX_EMAIL } from '@/lib/gp-signup';
import { siteUrl } from '@/lib/site-url';
import { erasePerson } from '@/lib/waitlist';

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const NO_DB: ActionResult = { ok: false, error: 'The database is not configured on this server (set DATABASE_URL).' };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Send a failed or skipped email again, re-rendered from the sign-up as it is
// now (so an erased person can never be written to). A new email_log row
// records the attempt; the old one stays as history.
export async function resendEmailAction(logId: number): Promise<ActionResult> {
  const admin = await requireAdmin();
  const db = await getDb();
  if (!db) return NO_DB;
  const id = Number(logId);
  if (!Number.isSafeInteger(id) || id <= 0) return { ok: false, error: 'That email is not in the log.' };
  const [row] = await db.select().from(emailLog).where(eq(emailLog.id, id));
  if (!row) return { ok: false, error: 'That email is not in the log.' };
  if (row.status === 'sent') return { ok: false, error: 'That email was sent already.' };
  if (!row.signupId) return { ok: false, error: 'This email is not tied to a sign-up, so it cannot be rebuilt.' };
  const signup = await getSignup(db, row.signupId);
  if (!signup) return { ok: false, error: 'The sign-up behind this email no longer exists. It may have been erased.' };

  let status: 'sent' | 'failed' | 'skipped';
  if (row.template === 'admin_new_gp') {
    const alert = adminNewGp(signup, new URL(`/admin/waitlist/gps/${signup.id}`, siteUrl()).toString());
    status = await sendEmail(db, row.to, 'admin_new_gp', alert, signup.id);
  } else {
    const { template, email } = renderFor(signup);
    status = await sendEmail(db, signup.email, template, email, signup.id);
  }
  await audit(db, admin, 'resend_email', signup.id, { logId: id, template: row.template, status });
  revalidatePath('/admin/system/emails');
  if (status === 'sent') return { ok: true, message: 'Email sent.' };
  if (status === 'skipped') return { ok: false, error: 'Email isn’t set up on this server (RESEND_API_KEY and EMAIL_FROM), so nothing was sent. The attempt is logged.' };
  return { ok: false, error: 'Resend refused the message again. The new error is at the top of the log.' };
}

// A right-to-erasure request by address, for someone who never had a link to
// hand: every sign-up for it (both roles), the linked analytics and the email
// log. The audit keeps only how many sign-ups went.
export async function eraseByEmailAction(rawEmail: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const db = await getDb();
  if (!db) return NO_DB;
  const email = normaliseEmail(rawEmail);
  if (!EMAIL.test(email) || email.length > MAX_EMAIL) return { ok: false, error: 'Enter a full email address.' };
  const removed = await erasePerson(db, email);
  await audit(db, admin, 'erase_person', null, { signupsRemoved: removed, via: 'settings' });
  revalidatePath('/admin/waitlist/patients');
  revalidatePath('/admin/waitlist/gps');
  revalidatePath('/admin');
  return removed === 0
    ? { ok: true, message: 'Nobody on the waitlist has that address. Nothing was kept for it.' }
    : { ok: true, message: `Erased: ${removed} ${removed === 1 ? 'sign-up' : 'sign-ups'} and everything linked to them.` };
}
