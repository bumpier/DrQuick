// Sending email through Resend's HTTP API — plain fetch, no SDK — and logging
// every attempt to email_log so the admin can see what went out.
//
//   RESEND_API_KEY      unset: nothing is sent; each attempt is logged 'skipped'
//   EMAIL_FROM          e.g. "Dr Quick <hello@drquick.co.uk>" (a Resend-verified domain)
//   ADMIN_ALERT_EMAILS  comma-separated; who hears about each new GP application
//
// Sending never throws: a sign-up is saved before any email is attempted, and a
// mail outage must not turn a saved sign-up into an error on the form.
import type { DB } from '@/lib/db';
import { emailLog } from '@/lib/db/schema';
import { feeLabel } from '@/lib/gp-fee';
import { siteUrl } from '@/lib/site-url';
import type { Signup } from '@/lib/waitlist';
import { adminNewGp, gpApplicationReceived, patientWelcome, type Email } from '@/lib/email-templates';

export type Template = 'patient_welcome' | 'gp_received' | 'admin_new_gp';

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export function adminAlertAddresses(): string[] {
  return (process.env.ADMIN_ALERT_EMAILS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}

export async function sendEmail(
  db: DB,
  to: string,
  template: Template,
  email: Email,
  signupId: string | null = null,
): Promise<'sent' | 'failed' | 'skipped'> {
  let status: 'sent' | 'failed' | 'skipped' = 'skipped';
  let providerId: string | null = null;
  let error: string | null = null;

  if (emailConfigured()) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject: email.subject, html: email.html, text: email.text }),
        signal: AbortSignal.timeout(5000),
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (res.ok) { status = 'sent'; providerId = body.id ?? null; }
      else { status = 'failed'; error = `${res.status}: ${body.message ?? 'unknown error'}`.slice(0, 500); }
    } catch (err) {
      status = 'failed';
      error = (err as Error).message.slice(0, 500);
    }
  } else {
    error = 'RESEND_API_KEY or EMAIL_FROM not set';
  }

  try {
    await db.insert(emailLog).values({ to, template, subject: email.subject, status, providerId, error, signupId });
  } catch (err) {
    console.error('email_log write failed:', (err as Error).message);
  }
  if (status === 'failed') console.error(`Email ${template} failed: ${error}`);
  return status;
}

export const unsubscribeUrl = (token: string) => new URL(`/unsubscribe?token=${encodeURIComponent(token)}`, siteUrl()).toString();

export function renderFor(signup: Signup): { template: Template; email: Email } {
  return signup.role === 'gp'
    ? {
        template: 'gp_received',
        email: gpApplicationReceived(
          signup.name ?? 'there', unsubscribeUrl(signup.unsubscribeToken),
          signup.feeStatus === 'paid' && signup.feePence != null ? feeLabel(signup.feePence) : null,
        ),
      }
    : { template: 'patient_welcome', email: patientWelcome(unsubscribeUrl(signup.unsubscribeToken)) };
}

// The confirmation to the person, and for a GP an alert to the team.
export async function sendSignupEmails(db: DB, signup: Signup): Promise<void> {
  try {
    const { template, email } = renderFor(signup);
    await sendEmail(db, signup.email, template, email, signup.id);
    if (signup.role === 'gp') {
      const alert = adminNewGp(signup, new URL(`/admin/waitlist/gps/${signup.id}`, siteUrl()).toString());
      for (const to of adminAlertAddresses()) await sendEmail(db, to, 'admin_new_gp', alert, signup.id);
    }
  } catch (err) {
    console.error('Sign-up emails failed:', (err as Error).message);
  }
}
