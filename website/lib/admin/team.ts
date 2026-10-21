// The admin team: accounts, their roles and the one-time links that set their
// passwords. Server-only. The design is
// docs/superpowers/specs/2026-10-21-admin-team-and-roles-design.md.
//
// Three rules to keep when changing this file:
//  - Only hashes are stored. A link's token exists in the email (or on the
//    screen of the admin who added the person) and nowhere else; a password
//    hash leaves this file only through accountByEmail / accountById, for
//    lib/admin-auth.ts.
//  - An active person's reset is never shown on screen, only emailed. Showing
//    it would let whoever clicked "send reset" sign in as them.
//  - The last-Admin check runs in the change's own transaction. It takes the
//    lock on the active Admin rows first, in id order, and only then reads the
//    target, so concurrent changes queue behind each other: two Admins removing
//    each other at once cannot both pass the check, and cannot deadlock.
//
// This file must not import lib/admin-auth.ts, which imports it.
import { createHash, randomBytes } from 'node:crypto';
import { and, asc, eq, gt, inArray, isNull, lte, ne, sql } from 'drizzle-orm';
import { adminAccounts } from '@/lib/admin/backstop';
import { isRole, ROLE_LABELS, type Admin, type Role } from '@/lib/admin/roles';
import type { DB } from '@/lib/db';
import { adminTokens, adminUsers } from '@/lib/db/schema';
import { sendEmail } from '@/lib/email';
import { adminSetPassword } from '@/lib/email-templates';
import { MAX_EMAIL, normaliseEmail } from '@/lib/gp-signup';
import { hashPassword, PASSWORD_MAX, PASSWORD_MIN } from '@/lib/password';
import { siteUrl } from '@/lib/site-url';

export const LINK_HOURS = 24;
export const NAME_MAX = 100;

export type AccountRow = typeof adminUsers.$inferSelect;
export type Member = Omit<AccountRow, 'passwordHash'>;

export type TeamError =
  | 'invalid_name' | 'invalid_email' | 'invalid_role' | 'on_backstop' | 'already_member'
  | 'not_found' | 'self' | 'last_admin' | 'not_sent';

export type LinkOutcome =
  | { ok: true; id: string; delivery: 'sent' }
  | { ok: true; id: string; delivery: 'shown'; url: string }
  | { ok: false; error: TeamError };
export type RoleChange = { ok: true; id: string; from: Role; to: Role } | { ok: false; error: TeamError };
export type Removal = { ok: true; id: string; role: Role; name: string } | { ok: false; error: TeamError };
export type SetPasswordResult =
  | { ok: true; member: Member; accepted: boolean }
  | { ok: false; error: 'invalid_link' | 'weak_password' };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNIQUE_VIOLATION = '23505';

const digest = (token: string) => createHash('sha256').update(token).digest('hex');
const toMember = ({ passwordHash: _hash, ...rest }: AccountRow): Member => rest;

export const setPasswordUrl = (token: string) =>
  new URL(`/admin/set-password?token=${encodeURIComponent(token)}`, siteUrl()).toString();

/* --------------------------------------------------------------- reading */

export async function listTeam(db: DB, now = new Date()): Promise<Array<Member & { linkExpiresAt: Date | null }>> {
  const rows = await db.select().from(adminUsers).where(ne(adminUsers.status, 'removed')).orderBy(asc(adminUsers.name));
  if (rows.length === 0) return [];
  const links = await db.select({ id: adminTokens.adminUserId, expiresAt: adminTokens.expiresAt }).from(adminTokens)
    .where(and(inArray(adminTokens.adminUserId, rows.map((r) => r.id)), isNull(adminTokens.usedAt), gt(adminTokens.expiresAt, now)));
  const latest = new Map<string, Date>();
  for (const l of links) if (!latest.has(l.id) || l.expiresAt > latest.get(l.id)!) latest.set(l.id, l.expiresAt);
  return rows.map((r) => ({ ...toMember(r), linkExpiresAt: latest.get(r.id) ?? null }));
}

// For lib/admin-auth.ts only: the only ways a password hash leaves this file.
export async function accountByEmail(db: DB, email: string): Promise<AccountRow | null> {
  const [row] = await db.select().from(adminUsers)
    .where(and(eq(adminUsers.email, normaliseEmail(email)), eq(adminUsers.status, 'active')));
  return row ?? null;
}

export async function accountById(db: DB, id: string): Promise<AccountRow | null> {
  if (!UUID.test(id)) return null;
  const [row] = await db.select().from(adminUsers).where(eq(adminUsers.id, id));
  return row ?? null;
}

export async function recordSignIn(db: DB, id: string, now = new Date()): Promise<void> {
  if (!UUID.test(id)) return;
  await db.update(adminUsers).set({ lastSignInAt: now }).where(eq(adminUsers.id, id));
}

/* ---------------------------------------------------------------- adding */

export async function addMember(
  db: DB, actor: Admin, input: { name: unknown; email: unknown; role: unknown }, now = new Date(),
): Promise<LinkOutcome> {
  const name = String(input.name ?? '').trim();
  if (name.length < 1 || name.length > NAME_MAX) return { ok: false, error: 'invalid_name' };
  const email = normaliseEmail(input.email);
  if (!EMAIL.test(email) || email.length > MAX_EMAIL) return { ok: false, error: 'invalid_email' };
  if (!isRole(input.role)) return { ok: false, error: 'invalid_role' };
  const role = input.role;
  if (adminAccounts().has(email)) return { ok: false, error: 'on_backstop' };

  let row: AccountRow;
  try {
    row = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(adminUsers).where(eq(adminUsers.email, email));
      if (existing && existing.status !== 'removed') throw new TeamRefusal('already_member');
      if (!existing) {
        const [created] = await tx.insert(adminUsers)
          .values({ email, name, role, createdBy: actor.email, createdAt: now }).returning();
        return created;
      }
      // Someone removed and added again: the same row, started afresh, so the
      // audit trail keeps one id for them. Their sessions and old links are dead.
      await tx.delete(adminTokens).where(eq(adminTokens.adminUserId, existing.id));
      const [revived] = await tx.update(adminUsers).set({
        name, role, status: 'invited', passwordHash: null, sessionEpoch: sql`${adminUsers.sessionEpoch} + 1`,
        removedAt: null, lastSignInAt: null, createdBy: actor.email, createdAt: now,
      }).where(eq(adminUsers.id, existing.id)).returning();
      return revived;
    });
  } catch (err) {
    if (err instanceof TeamRefusal) return { ok: false, error: err.error };
    const cause = (err as { cause?: { code?: string } }).cause;
    if (cause?.code === UNIQUE_VIOLATION || (err as { code?: string }).code === UNIQUE_VIOLATION) return { ok: false, error: 'already_member' };
    throw err;
  }
  return issueLink(db, actor, row, now);
}

class TeamRefusal extends Error {
  constructor(readonly error: TeamError) { super(error); }
}

/* ----------------------------------------------------------------- links */

// Makes a link for the member and emails it. An invited person who cannot be
// emailed gets the link shown to the admin; an active person never does.
async function issueLink(db: DB, actor: Admin, member: AccountRow, now: Date): Promise<LinkOutcome> {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = digest(token);
  await db.delete(adminTokens).where(lte(adminTokens.expiresAt, now)); // spent time, swept
  await db.insert(adminTokens).values({
    tokenHash, adminUserId: member.id, expiresAt: new Date(now.getTime() + LINK_HOURS * 3600_000), createdAt: now,
  });

  const url = setPasswordUrl(token);
  const invite = member.status === 'invited' ? { by: actor.name, role: ROLE_LABELS[member.role as Role] } : null;
  const outcome = await sendEmail(db, member.email, 'admin_set_password', adminSetPassword(member.name, url, LINK_HOURS, invite), null);

  const others = and(eq(adminTokens.adminUserId, member.id), isNull(adminTokens.usedAt), ne(adminTokens.tokenHash, tokenHash));
  if (outcome === 'sent') {
    await db.delete(adminTokens).where(others);
    return { ok: true, id: member.id, delivery: 'sent' };
  }
  if (member.status === 'invited') {
    // The status was read before the email attempt, which can take seconds. If
    // the person spent a link meanwhile they are active now, and a link shown
    // on screen would be a way into their account: withdraw it instead. The row
    // lock orders this against setPasswordWithLink, which locks it first too.
    const stillInvited = await db.transaction(async (tx) => {
      const [current] = await tx.select({ status: adminUsers.status }).from(adminUsers)
        .where(eq(adminUsers.id, member.id)).for('update');
      if (current?.status !== 'invited') {
        await tx.delete(adminTokens).where(eq(adminTokens.tokenHash, tokenHash));
        return false;
      }
      await tx.delete(adminTokens).where(others);
      return true;
    });
    return stillInvited ? { ok: true, id: member.id, delivery: 'shown', url } : { ok: false, error: 'not_sent' };
  }
  // An unsent reset is withdrawn and the earlier link keeps working, so a mail
  // outage cannot cost a person the only link they have.
  await db.delete(adminTokens).where(eq(adminTokens.tokenHash, tokenHash));
  return { ok: false, error: 'not_sent' };
}

export async function sendLink(db: DB, actor: Admin, id: unknown, now = new Date()): Promise<LinkOutcome> {
  const member = typeof id === 'string' ? await accountById(db, id) : null;
  if (!member || member.status === 'removed') return { ok: false, error: 'not_found' };
  return issueLink(db, actor, member, now);
}

const live = (hash: string, now: Date) =>
  and(eq(adminTokens.tokenHash, hash), isNull(adminTokens.usedAt), gt(adminTokens.expiresAt, now));

/** Whether a link can still be used, so the page can say so before asking for a password. */
export async function linkIsLive(db: DB, token: string, now = new Date()): Promise<boolean> {
  if (!token) return false;
  const [row] = await db.select({ id: adminTokens.adminUserId }).from(adminTokens).where(live(digest(token), now));
  return Boolean(row);
}

/**
 * Spends a link and sets the password. A refused attempt leaves the link
 * usable, so a mistyped password does not cost a new email.
 */
export async function setPasswordWithLink(db: DB, token: string, password: string, now = new Date()): Promise<SetPasswordResult> {
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) return { ok: false, error: 'weak_password' };
  if (!token) return { ok: false, error: 'invalid_link' };
  const passwordHash = hashPassword(password);

  // Lock order matches removeMember: the person's row first, then their links.
  const [found] = await db.select({ id: adminTokens.adminUserId }).from(adminTokens).where(live(digest(token), now));
  if (!found) return { ok: false, error: 'invalid_link' };

  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(adminUsers).where(eq(adminUsers.id, found.id)).for('update');
    if (!row || row.status === 'removed') return { ok: false, error: 'invalid_link' } as const;

    const [spent] = await tx.update(adminTokens).set({ usedAt: now }).where(live(digest(token), now))
      .returning({ id: adminTokens.adminUserId });
    if (!spent) return { ok: false, error: 'invalid_link' } as const;

    const [updated] = await tx.update(adminUsers)
      .set({ passwordHash, status: 'active', sessionEpoch: sql`${adminUsers.sessionEpoch} + 1` })
      .where(eq(adminUsers.id, row.id)).returning();
    // Once a link is spent no other may be: one still unused (a reset sent
    // meanwhile, or a link shown to an Admin) would be a second way in.
    await tx.delete(adminTokens).where(and(eq(adminTokens.adminUserId, row.id), isNull(adminTokens.usedAt)));
    return { ok: true, member: toMember(updated), accepted: row.status === 'invited' } as const;
  });
}

/* ------------------------------------------------- roles and removal */

type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];

// Locks every active Admin row, in id order, and returns their ids. Call it
// first in a change that may remove an Admin, before touching the target, so
// every such transaction takes its locks in the same order and they queue
// rather than deadlock.
const lockActiveAdmins = async (tx: Tx): Promise<string[]> =>
  (await tx.select({ id: adminUsers.id }).from(adminUsers)
    .where(and(eq(adminUsers.role, 'admin'), eq(adminUsers.status, 'active')))
    .orderBy(adminUsers.id).for('update')).map((r) => r.id);

// Whether, without this person, someone could still sign in as an Admin: an
// active Admin row or a backstop account.
const anotherAdminRemains = (activeAdmins: string[], targetId: string) =>
  activeAdmins.filter((a) => a !== targetId).length + adminAccounts().size > 0;

export async function changeRole(db: DB, actor: Admin, id: unknown, role: unknown): Promise<RoleChange> {
  if (typeof id === 'string' && actor.id === id) return { ok: false, error: 'self' };
  if (!isRole(role)) return { ok: false, error: 'invalid_role' };
  if (typeof id !== 'string' || !UUID.test(id)) return { ok: false, error: 'not_found' };

  return db.transaction(async (tx) => {
    const activeAdmins = await lockActiveAdmins(tx);
    const [target] = await tx.select().from(adminUsers).where(eq(adminUsers.id, id)).for('update');
    if (!target || target.status === 'removed') return { ok: false, error: 'not_found' } as const;
    const from = target.role as Role;
    if (from === role) return { ok: true, id, from, to: role } as const;
    if (from === 'admin' && target.status === 'active' && !anotherAdminRemains(activeAdmins, id)) {
      return { ok: false, error: 'last_admin' } as const;
    }
    await tx.update(adminUsers).set({ role }).where(eq(adminUsers.id, id));
    return { ok: true, id, from, to: role } as const;
  });
}

export async function removeMember(db: DB, actor: Admin, id: unknown, now = new Date()): Promise<Removal> {
  if (typeof id === 'string' && actor.id === id) return { ok: false, error: 'self' };
  if (typeof id !== 'string' || !UUID.test(id)) return { ok: false, error: 'not_found' };

  return db.transaction(async (tx) => {
    const activeAdmins = await lockActiveAdmins(tx);
    const [target] = await tx.select().from(adminUsers).where(eq(adminUsers.id, id)).for('update');
    if (!target || target.status === 'removed') return { ok: false, error: 'not_found' } as const;
    if (target.role === 'admin' && target.status === 'active' && !anotherAdminRemains(activeAdmins, id)) {
      return { ok: false, error: 'last_admin' } as const;
    }
    await tx.update(adminUsers).set({
      status: 'removed', removedAt: now, sessionEpoch: sql`${adminUsers.sessionEpoch} + 1`, passwordHash: null,
    }).where(eq(adminUsers.id, id));
    await tx.delete(adminTokens).where(eq(adminTokens.adminUserId, id));
    return { ok: true, id, role: target.role as Role, name: target.name } as const;
  });
}
