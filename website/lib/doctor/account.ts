// A doctor's portal account: claiming it and resetting its password, both
// through the same one-time emailed link. Server-only.
//
// There is no separate registration. A GP signs up (and pays the fee) on the
// landing page; the address they used is the only thing that can claim the
// account, because the link goes to that inbox and nowhere else. Anyone can
// type anyone's email into the form, so the form never says whether an address
// has signed up and the link is the only proof of ownership.
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull, lte, or, sql } from 'drizzle-orm';
import { hashPassword } from '@/lib/admin-auth';
import type { DB } from '@/lib/db';
import { doctorTokens, gps, waitlistSignups, type GpAccountStatus } from '@/lib/db/schema';
import { normaliseEmail, type GpRow } from '@/lib/doctor-auth';
import { emailConfigured, sendEmail } from '@/lib/email';
import { doctorSetPassword } from '@/lib/email-templates';
import { hashKey, hit } from '@/lib/rate-limit';
import { siteUrl } from '@/lib/site-url';

export const LINK_MINUTES = 60;
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 256;

// The waitlist pipeline is where the team approves a GP; the account follows it.
export function accountStatusFor(signupStatus: string): GpAccountStatus {
  if (signupStatus === 'active') return 'active';
  if (signupStatus === 'rejected') return 'offboarded';
  return 'onboarding';
}

const digest = (token: string) => createHash('sha256').update(token).digest('hex');

export const setPasswordUrl = (token: string) =>
  new URL(`/doctor/set-password?token=${encodeURIComponent(token)}`, siteUrl()).toString();

// Who a link may be sent to: an existing doctor who has not been offboarded,
// or a GP sign-up complete enough to become an account and not rejected.
async function recipient(db: DB, email: string): Promise<{ name: string; signupId: string | null; isNew: boolean } | null> {
  const [gp] = await db.select().from(gps).where(eq(gps.email, email));
  if (gp) return gp.status === 'offboarded' ? null : { name: gp.name, signupId: gp.signupId, isNew: !gp.passwordHash };
  const [signup] = await db.select().from(waitlistSignups)
    .where(and(eq(waitlistSignups.role, 'gp'), eq(waitlistSignups.email, email)));
  if (!signup || !signup.name || !signup.gmc || signup.status === 'rejected') return null;
  return { name: signup.name, signupId: signup.id, isNew: true };
}

/**
 * Emails a set-password link to the address, if it belongs to a GP. True when
 * a link was issued; the caller must not tell the person which it was. A new
 * link replaces any earlier one for the address.
 */
export async function requestSetPasswordLink(db: DB, rawEmail: string, now = new Date()): Promise<boolean> {
  const email = normaliseEmail(rawEmail);
  const who = await recipient(db, email);
  if (!who) return false;

  const token = randomBytes(32).toString('base64url');
  // Unused links for this address stop working; spent and expired ones are swept.
  await db.delete(doctorTokens).where(or(
    and(eq(doctorTokens.email, email), isNull(doctorTokens.usedAt)),
    lte(doctorTokens.expiresAt, now),
  ));
  await db.insert(doctorTokens).values({
    tokenHash: digest(token), email, expiresAt: new Date(now.getTime() + LINK_MINUTES * 60_000), createdAt: now,
  });

  const url = setPasswordUrl(token);
  // With no mail provider on a development machine the link would be lost.
  if (!emailConfigured() && process.env.NODE_ENV === 'development') console.info(`Set-password link for ${email}: ${url}`);
  await sendEmail(db, email, 'doctor_set_password', doctorSetPassword(who.name, url, LINK_MINUTES, who.isNew), who.signupId);
  return true;
}

const live = (hash: string, now: Date) =>
  and(eq(doctorTokens.tokenHash, hash), isNull(doctorTokens.usedAt), gt(doctorTokens.expiresAt, now));

/** Whether a link can still be used, so the page can say so before asking for a password. */
export async function linkIsLive(db: DB, token: string, now = new Date()): Promise<boolean> {
  if (!token) return false;
  const [row] = await db.select({ email: doctorTokens.email }).from(doctorTokens).where(live(digest(token), now));
  return Boolean(row);
}

export type SetPasswordResult =
  | { ok: true; gp: GpRow }
  | { ok: false; error: 'invalid_link' | 'weak_password' | 'gmc_taken' };

const UNIQUE_VIOLATION = '23505';

/**
 * Spends a link and sets the password. On an existing account it is a reset:
 * the session epoch moves on, so every earlier session ends. Otherwise it
 * creates the account from the GP's sign-up. A refused attempt leaves the link
 * usable, so a mistyped password does not cost the doctor a new email.
 */
export async function setPasswordWithToken(db: DB, token: string, password: string, now = new Date()): Promise<SetPasswordResult> {
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) return { ok: false, error: 'weak_password' };
  if (!token) return { ok: false, error: 'invalid_link' };
  const passwordHash = hashPassword(password);

  try {
    return await db.transaction(async (tx) => {
      const [spent] = await tx.update(doctorTokens).set({ usedAt: now }).where(live(digest(token), now))
        .returning({ email: doctorTokens.email });
      if (!spent) return { ok: false, error: 'invalid_link' } as const;

      const [existing] = await tx.update(gps)
        .set({ passwordHash, sessionEpoch: sql`${gps.sessionEpoch} + 1`, updatedAt: now })
        .where(eq(gps.email, spent.email)).returning();
      if (existing) return { ok: true, gp: existing } as const;

      const [signup] = await tx.select().from(waitlistSignups)
        .where(and(eq(waitlistSignups.role, 'gp'), eq(waitlistSignups.email, spent.email)));
      // The sign-up was erased, or lost its details, after the link was sent.
      if (!signup?.name || !signup.gmc) return { ok: false, error: 'invalid_link' } as const;
      const [created] = await tx.insert(gps).values({
        signupId: signup.id, name: signup.name, email: signup.email, gmc: signup.gmc, mobile: signup.mobile,
        status: accountStatusFor(signup.status), passwordHash, createdAt: now, updatedAt: now,
      }).returning();
      return { ok: true, gp: created } as const;
    });
  } catch (err) {
    // The rollback has put the link back. The only unique value a claim can
    // collide on is the GMC number: the email was just looked up and not found.
    const cause = (err as { cause?: { code?: string } }).cause;
    if (cause?.code === UNIQUE_VIOLATION || (err as { code?: string }).code === UNIQUE_VIOLATION) return { ok: false, error: 'gmc_taken' };
    throw err;
  }
}

/* ------------------------------------------------------------- throttle */

// Three links an hour for one address, however many places ask; twenty an hour
// from one client, whichever addresses it names.
const PER_EMAIL = 3;
const PER_CLIENT = 20;
const WINDOW_S = 3600;

export async function linkAllowed(db: DB, ip: string, email: string, now = new Date()): Promise<boolean> {
  const byClient = await hit(db, hashKey('rl:doctor-link:ip', ip), WINDOW_S, now);
  const byEmail = await hit(db, hashKey('rl:doctor-link:email', normaliseEmail(email)), WINDOW_S, now);
  return byClient <= PER_CLIENT && byEmail <= PER_EMAIL;
}
