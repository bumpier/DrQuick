# Admin team and roles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an Admin add, re-role and remove people from `/admin/system/team`, each person seeing and doing only what one of four roles allows, enforced on the server.

**Architecture:** One pure module (`lib/admin/roles.ts`) says which role reaches which area. Accounts live in two new tables (`admin_users`, `admin_tokens`) behind `lib/admin/team.ts`. `ADMIN_USERS` stays as an always-Admin backstop. `lib/admin-auth.ts` reads both sources, and every page, action and route in `app/admin/(panel)` names its area through one of three guards: `requireAdmin(area)`, `actionAdmin(area)` and `routeAdmin(area)`. A file-scanning test fails any file that forgets.

**Tech Stack:** Next.js 16 (app router, server actions), Drizzle ORM on Postgres / PGlite, Vitest, shadcn/ui, `node:crypto`.

**Spec:** `docs/superpowers/specs/2026-10-21-admin-team-and-roles-design.md`. Read it before starting. It holds the reasons this plan doesn't repeat.

All paths are relative to `website/`. Run every command from `website/`.

## Global Constraints

- This repo's Next.js is not the one you know. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next code. Do not use `forbidden()` / `authInterrupts`: they are experimental here.
- No new dependencies.
- Role values `admin`, `operations`, `finance`, `marketing`. Labels `Admin`, `Operations`, `Finance`, `Marketing`.
- Set-password links: single use, valid **24 hours**, only the SHA-256 hex of the token stored. The token itself is `randomBytes(32).toString('base64url')`.
- Passwords: `PASSWORD_MIN = 12`, `PASSWORD_MAX = 256`, hashed with the existing scrypt `hashPassword` / `verifyPassword`.
- Session cookie unchanged: `dq_admin`, httpOnly, SameSite=Strict, path `/admin`, 8 hours, signed with `ADMIN_SESSION_SECRET` (32+ characters) through `lib/signed-token.ts`.
- Refusal copy, exactly: `This is not part of your role. Ask an Admin if you need it.`
- Audit: `audit(db, actor, action, target, meta)` from `lib/admin/audit.ts`. Action names lower case with underscores only (`parseAuditQuery` filters on `^[a-z_]{1,60}$`). The target is an `admin_users.id`, never the email of the person acted on.
- Schema conventions (`lib/db/schema.ts`): text enums, `timestamptz`, uuid ids, no foreign keys. `schema.ts` imports with relative paths only, never `@/` (drizzle-kit reads it outside the bundler).
- Client components (`'use client'`) never import `lib/admin-auth.ts`, `lib/admin/team.ts` or `lib/signed-token.ts`. `tests/bundle-boundary.test.ts` already enforces the last.
- UI: shadcn components from `components/ui/`, restyled per `DESIGN.md`, lucide icons at `strokeWidth={2}`, toasts through `sonner` as `components/admin/SignupControls.tsx` does, confirmations through `components/admin/ConfirmAction.tsx`.
- Server actions are untrusted: validate every argument on the server and take "who is acting" only from the session.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Done means `npm run typecheck` and `npm test` both pass.

## Review Focus

- **The same address typed differently** (`' Asif@Example.com '` after `'asif@example.com'`). It is one person, so the second add is refused as `already_member`. Test: Task 2.
- **Someone removed and added again.** Their old link and their old session must both be dead. Tests: Task 2 (link), Task 3 (session).
- **A mail scanner opening the link first.** Opening the page must not spend the link; only submitting the form does. Test: Task 2 (`linkIsLive` twice, then use). The page only ever calls `linkIsLive`: Task 6.
- **Marketing typing `?q=someone@example.com` into the Visitors address.** The search is ignored, so no email is confirmed or denied. Test: Task 5 (`visitorQueryFor`).
- **An invited person who has not set a password, trying to sign in.** They get the same "Email or password not recognised." as a wrong password, and no cookie. Test: Task 3.

---

### Task 1: Roles and areas

**Files:**
- Create: `lib/admin/roles.ts`
- Test: `tests/admin-roles-table.test.ts`

**Interfaces:**
- Produces (all exported from `lib/admin/roles.ts`, a module with **no imports at all**, because `lib/db/schema.ts` and client components both import it):
  - `ROLES = ['admin', 'operations', 'finance', 'marketing'] as const`, `type Role`
  - `ROLE_LABELS: Record<Role, string>`
  - `ROLE_SUMMARIES: Record<Role, string>`: `admin: 'Everything, including the team'`, `operations: 'The waitlist and emails'`, `finance: 'Finance'`, `marketing: 'Analytics and the blog'`
  - `AREAS = ['overview', 'waitlist', 'waitlist_export', 'erase', 'emails', 'analytics', 'finance', 'blog', 'team', 'settings', 'technical', 'audit'] as const`, `type Area`
  - `can(role: Role, area: Area): boolean`
  - `isRole(value: unknown): value is Role`
  - `type Admin = { id: string | null; email: string; name: string; role: Role }`, where `id` is `null` for an `ADMIN_USERS` backstop entry

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from 'vitest';
import { AREAS, ROLES, ROLE_LABELS, can, isRole, type Area, type Role } from '@/lib/admin/roles';

// In AREAS order.
const ALLOWED: Record<Role, Area[]> = {
  admin: [...AREAS],
  operations: ['overview', 'waitlist', 'emails'],
  finance: ['overview', 'finance'],
  marketing: ['overview', 'analytics', 'blog'],
};

test('each role reaches exactly the areas the design gives it', () => {
  for (const role of ROLES) expect(AREAS.filter((a) => can(role, a))).toEqual(ALLOWED[role]);
});

test('the admin-only areas belong to Admin alone', () => {
  for (const area of ['team', 'settings', 'technical', 'audit', 'waitlist_export', 'erase'] as const) {
    expect(ROLES.filter((r) => can(r, area))).toEqual(['admin']);
  }
});

test('labels', () => {
  expect(ROLE_LABELS).toEqual({ admin: 'Admin', operations: 'Operations', finance: 'Finance', marketing: 'Marketing' });
});

test('isRole accepts the four values and nothing else', () => {
  expect(ROLES.every(isRole)).toBe(true);
  for (const v of ['Finance', 'owner', '', null, undefined, 3]) expect(isRole(v)).toBe(false);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/admin-roles-table.test.ts`
Expected: FAIL, cannot resolve `@/lib/admin/roles`.

- [ ] **Step 3: Implement `lib/admin/roles.ts`**

A `const ACCESS: Record<Role, readonly Area[]>` holding the table above, with `can` reading it. Head the file with a comment saying this is the one place access is defined, and why it imports nothing.

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run tests/admin-roles-table.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/roles.ts tests/admin-roles-table.test.ts
git commit -m "feat(admin): the four roles and the areas each reaches"
```

---

### Task 2: Team accounts and their links

**Files:**
- Create: `lib/password.ts`. Move `hashPassword`, `verifyPassword`, `SCRYPT_N`, `KEYLEN` here verbatim from `lib/admin-auth.ts`, and add `PASSWORD_MIN = 12`, `PASSWORD_MAX = 256`.
- Create: `lib/admin/backstop.ts`. Move `adminAccounts(env = process.env.ADMIN_USERS ?? '')` and its `Account` type (rename it `BackstopAccount = { email: string; name: string; hash: string }`) here verbatim.
- Modify: `lib/admin-auth.ts`. Delete the moved code and add `export { hashPassword, verifyPassword } from '@/lib/password';` and `export { adminAccounts } from '@/lib/admin/backstop';`. Behaviour is unchanged.
- Modify: `lib/doctor/account.ts:21-22`. Replace its own `PASSWORD_MIN` / `PASSWORD_MAX` with `export { PASSWORD_MIN, PASSWORD_MAX } from '@/lib/password';`, and import them there too.
- Modify: `lib/db/schema.ts`. Add the two tables after `adminAuditLog`.
- Create: `drizzle/0006_admin_team.sql`, `drizzle/meta/0006_snapshot.json`, `drizzle/meta/_journal.json` (generated).
- Modify: `lib/email.ts:17`. Add `'admin_set_password'` to `Template`.
- Modify: `lib/email-templates.ts`. Add `adminSetPassword` after `doctorSetPassword`.
- Create: `lib/admin/team.ts`
- Create: `tests/helpers/mail.ts`
- Test: `tests/admin-team.test.ts`

**Interfaces:**
- Consumes: `Role`, `ROLES`, `ROLE_LABELS`, `isRole`, `Admin` (Task 1). `sendEmail`, `emailConfigured` (`lib/email.ts`). `normaliseEmail`, `MAX_EMAIL` (`lib/gp-signup.ts`). `siteUrl` (`lib/site-url.ts`).
- Produces:
  - Schema: `ADMIN_USER_STATUSES = ['invited', 'active', 'removed'] as const`, `type AdminUserStatus`.
    - `adminUsers = pgTable('admin_users', …)` with `id` uuid pk defaultRandom, `email` text notNull, `name` text notNull, `role` text enum `ROLES` notNull (import `ROLES` from `'../admin/roles'`), `status` text enum notNull default `'invited'`, `passwordHash` text, `sessionEpoch` integer notNull default 0, `createdBy` text notNull, `createdAt: created()`, `lastSignInAt` timestamptz, `removedAt` timestamptz, and `uniqueIndex('admin_users_email').on(t.email)`.
    - `adminTokens = pgTable('admin_tokens', …)` with `tokenHash` text pk, `adminUserId` uuid notNull, `expiresAt` timestamptz notNull, `usedAt` timestamptz, `createdAt: created()`, and `index('admin_tokens_user').on(t.adminUserId)`.
  - `adminSetPassword(name: string, url: string, hours: number, invite: { by: string; role: string } | null): Email`
  - From `lib/admin/team.ts`:
    - `LINK_HOURS = 24`, `NAME_MAX = 100`
    - `type AccountRow = typeof adminUsers.$inferSelect`, `type Member = Omit<AccountRow, 'passwordHash'>`
    - `type TeamError = 'invalid_name' | 'invalid_email' | 'invalid_role' | 'on_backstop' | 'already_member' | 'not_found' | 'self' | 'last_admin' | 'not_sent'`
    - `type LinkOutcome = { ok: true; id: string; delivery: 'sent' } | { ok: true; id: string; delivery: 'shown'; url: string } | { ok: false; error: TeamError }`
    - `type RoleChange = { ok: true; id: string; from: Role; to: Role } | { ok: false; error: TeamError }`
    - `type Removal = { ok: true; id: string; role: Role; name: string } | { ok: false; error: TeamError }`
    - `type SetPasswordResult = { ok: true; member: Member; accepted: boolean } | { ok: false; error: 'invalid_link' | 'weak_password' }`
    - `setPasswordUrl(token: string): string`, which builds `/admin/set-password?token=…` on `siteUrl()`
    - `listTeam(db: DB, now?: Date): Promise<Array<Member & { linkExpiresAt: Date | null }>>`. Everyone not `removed`, ordered by name. `linkExpiresAt` is the latest live link's expiry, or null.
    - `addMember(db: DB, actor: Admin, input: { name: unknown; email: unknown; role: unknown }, now?: Date): Promise<LinkOutcome>`
    - `sendLink(db: DB, actor: Admin, id: unknown, now?: Date): Promise<LinkOutcome>`
    - `changeRole(db: DB, actor: Admin, id: unknown, role: unknown): Promise<RoleChange>`
    - `removeMember(db: DB, actor: Admin, id: unknown, now?: Date): Promise<Removal>`
    - `linkIsLive(db: DB, token: string, now?: Date): Promise<boolean>`
    - `setPasswordWithLink(db: DB, token: string, password: string, now?: Date): Promise<SetPasswordResult>`
    - These two are for `lib/admin-auth.ts` only, and are the only way a hash leaves this file: `accountByEmail(db: DB, email: string): Promise<AccountRow | null>` (status `active` only) and `accountById(db: DB, id: string): Promise<AccountRow | null>` (any status; null for a non-uuid id).
    - `recordSignIn(db: DB, id: string, now?: Date): Promise<void>`
  - `tests/helpers/mail.ts`: `mailWorks(): Array<{ to: string[]; text: string }>`, which stubs `fetch` as `tests/doctor-account.test.ts:60` does, stubs `RESEND_API_KEY` and `EMAIL_FROM`, and returns the array the sent bodies are pushed to. Also `mailIsDown()` and `tokenIn(text: string): string`, which pulls the `token=` value out of an email's text.

**Rules for `lib/admin/team.ts`** (the spec's "Accounts" section, made exact):
- Validation: name trimmed, 1 to `NAME_MAX` characters (`invalid_name`). Email `normaliseEmail`'d, matching `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, at most `MAX_EMAIL` (`invalid_email`). Role passes `isRole` (`invalid_role`). An id that is not a uuid, or that names no row or a `removed` row, is `not_found`.
- `addMember`: an email in `adminAccounts()` is `on_backstop`. A row that exists and is not `removed` is `already_member`. A `removed` row is revived: new name, new role, `status 'invited'`, `passwordHash null`, `sessionEpoch + 1`, `removedAt null`, `lastSignInAt null`, `createdBy` and `createdAt` reset, its tokens deleted. Otherwise insert, with `createdBy = actor.email`. Then issue an invite link.
- Issuing a link (internal): sweep expired tokens, insert the new one, send `adminSetPassword(member.name, setPasswordUrl(token), LINK_HOURS, invite)` with template `'admin_set_password'` and no sign-up id. `invite` is `{ by: actor.name, role: ROLE_LABELS[member.role] }` for someone `invited`, and `null` for someone `active`.
  - Outcome `sent`: delete the member's other unused tokens and return `delivery: 'sent'`.
  - `failed` or `skipped`, member `invited`: delete the other unused tokens and return `delivery: 'shown', url`.
  - `failed` or `skipped`, member `active`: delete the **new** token, keep the old ones, and return `not_sent`.
- `sendLink`: issues a link to any member who is not `removed`, yourself included.
- `changeRole`: `actor.id === id` is `self`. Changing to the same role returns ok with `from === to` and writes nothing. Moving an `admin` to another role runs the last-Admin check.
- `removeMember`: `self` as above. An active `admin` target runs the last-Admin check. It then sets `status 'removed'`, `removedAt`, `sessionEpoch + 1` and `passwordHash null`, and deletes the member's tokens.
- **Last-Admin check:** inside the same `db.transaction`, lock the active admin rows (`select … for update`). If the active `admin` rows other than the target plus `adminAccounts().size` equal 0, return `last_admin`. Inside a transaction use `tx` only (the PGlite rule in `CLAUDE.md`).
- `setPasswordWithLink`: refuse a length outside `PASSWORD_MIN..PASSWORD_MAX` (`weak_password`) before touching the link. In one transaction: spend a live token (unused, unexpired), load its row, and if the row is missing or `removed` return `invalid_link`. Otherwise set the hash, `status 'active'` and `sessionEpoch + 1`. `accepted` is whether the row was `invited`. Model it on `setPasswordWithToken` in `lib/doctor/account.ts`.

- [ ] **Step 1: Write the failing tests**

Set up the file as `tests/doctor-account.test.ts` does (`useTestDb` / `resetDb`, `vi.unstubAllEnvs()`, `RESEND_API_KEY` and `EMAIL_FROM` stubbed to `''`, so mail is "skipped" by default), with `ADMIN_USERS` set to `lead@example.com|Lead Admin|<hashPassword('x')>` and:

```ts
const LEAD: Admin = { id: null, email: 'lead@example.com', name: 'Lead Admin', role: 'admin' };
const NOW = new Date('2026-10-21T09:00:00Z');
const add = (email = 'asif@example.com', role = 'admin', name = 'Dr Asif') => addMember(db, LEAD, { name, email, role }, NOW);
const member = async (id: string) => (await db.select().from(adminUsers).where(eq(adminUsers.id, id)))[0];
const tokenOf = (o: LinkOutcome) => { if (!o.ok || o.delivery !== 'shown') throw new Error('no link'); return new URL(o.url).searchParams.get('token')!; };
```

The tests:

```ts
test('adding stores the person invited and, with no email set up, hands back the link to show', async () => {
  const o = await addMember(db, LEAD, { name: ' Dr Asif ', email: ' Asif@Example.com ', role: 'admin' }, NOW);
  expect(o).toMatchObject({ ok: true, delivery: 'shown' });
  const row = await member(o.ok ? o.id : '');
  expect(row).toMatchObject({ email: 'asif@example.com', name: 'Dr Asif', role: 'admin', status: 'invited', passwordHash: null, createdBy: 'lead@example.com' });
  const [token] = await db.select().from(adminTokens);
  expect(token.expiresAt).toEqual(new Date(NOW.getTime() + 24 * 3600_000));
  expect(token.tokenHash).not.toBe(tokenOf(o)); // only the hash is stored
});

test('with email working, the invite is emailed, names the inviter and the role, and is not handed back', async () => {
  const sent = mailWorks();
  const o = await add();
  expect(o).toEqual({ ok: true, id: expect.any(String), delivery: 'sent' });
  expect(sent[0].to).toEqual(['asif@example.com']);
  expect(sent[0].text).toContain('Lead Admin has added you to the Dr Quick admin as Admin.');
  expect(sent[0].text).toContain('24 hours');
});

test('refuses a bad name, email or role, a backstop address, and someone already on the team however it is typed', async () => {
  expect(await add('asif@example.com', 'admin', '   ')).toEqual({ ok: false, error: 'invalid_name' });
  expect(await add('not-an-email')).toEqual({ ok: false, error: 'invalid_email' });
  expect(await add('asif@example.com', 'owner')).toEqual({ ok: false, error: 'invalid_role' });
  expect(await add(' LEAD@example.com')).toEqual({ ok: false, error: 'on_backstop' });
  await add();
  expect(await add(' ASIF@Example.com ')).toEqual({ ok: false, error: 'already_member' });
});

test('checking a link does not spend it; using it sets the password once and activates the person', async () => {
  const token = tokenOf(await add());
  expect(await linkIsLive(db, token, NOW)).toBe(true);
  expect(await linkIsLive(db, token, NOW)).toBe(true);
  const r = await setPasswordWithLink(db, token, 'a long enough password', NOW);
  expect(r).toMatchObject({ ok: true, accepted: true, member: { status: 'active', sessionEpoch: 1 } });
  expect(r.ok && 'passwordHash' in r.member).toBe(false);
  expect(await setPasswordWithLink(db, token, 'a long enough password', NOW)).toEqual({ ok: false, error: 'invalid_link' });
  expect(await linkIsLive(db, token, NOW)).toBe(false);
});

test('a short password is refused and leaves the link usable', async () => {
  const token = tokenOf(await add());
  expect(await setPasswordWithLink(db, token, 'short', NOW)).toEqual({ ok: false, error: 'weak_password' });
  expect(await linkIsLive(db, token, NOW)).toBe(true);
});

test('a link is dead after 24 hours', async () => {
  const token = tokenOf(await add());
  const later = new Date(NOW.getTime() + 24 * 3600_000 + 1);
  expect(await linkIsLive(db, token, later)).toBe(false);
  expect(await setPasswordWithLink(db, token, 'a long enough password', later)).toEqual({ ok: false, error: 'invalid_link' });
});

test('a new link for an invited person replaces the earlier one', async () => {
  const o = await add();
  const first = tokenOf(o);
  const second = tokenOf(await sendLink(db, LEAD, o.ok ? o.id : '', NOW));
  expect(await linkIsLive(db, first, NOW)).toBe(false);
  expect(await linkIsLive(db, second, NOW)).toBe(true);
});

test('a reset for an active person goes by email only: unsent, it is withdrawn and the earlier link keeps working', async () => {
  const o = await add();
  const id = o.ok ? o.id : '';
  await setPasswordWithLink(db, tokenOf(o), 'a long enough password', NOW);
  const sent = mailWorks();
  expect(await sendLink(db, LEAD, id, NOW)).toEqual({ ok: true, id, delivery: 'sent' });
  const emailed = tokenIn(sent[0].text);
  mailIsDown();
  expect(await sendLink(db, LEAD, id, NOW)).toEqual({ ok: false, error: 'not_sent' });
  expect(await linkIsLive(db, emailed, NOW)).toBe(true);
  expect((await db.select().from(adminTokens).where(isNull(adminTokens.usedAt))).length).toBe(1);
});

test('changing a role: refuses yourself, an unknown id and a bad role; a no-op writes nothing', async () => {
  const o = await add('ops@example.com', 'operations', 'Olu Ops');
  const id = o.ok ? o.id : '';
  const self: Admin = { id, email: 'ops@example.com', name: 'Olu Ops', role: 'admin' };
  expect(await changeRole(db, self, id, 'finance')).toEqual({ ok: false, error: 'self' });
  expect(await changeRole(db, LEAD, 'nope', 'finance')).toEqual({ ok: false, error: 'not_found' });
  expect(await changeRole(db, LEAD, id, 'boss')).toEqual({ ok: false, error: 'invalid_role' });
  expect(await changeRole(db, LEAD, id, 'operations')).toEqual({ ok: true, id, from: 'operations', to: 'operations' });
  expect(await changeRole(db, LEAD, id, 'finance')).toEqual({ ok: true, id, from: 'operations', to: 'finance' });
  expect((await member(id)).role).toBe('finance');
});

test('removing someone kills their links; adding them again starts afresh and the old link stays dead', async () => {
  const o = await add('ops@example.com', 'operations', 'Olu Ops');
  const id = o.ok ? o.id : '';
  const oldLink = tokenOf(o);
  expect(await removeMember(db, LEAD, id, NOW)).toEqual({ ok: true, id, role: 'operations', name: 'Olu Ops' });
  expect(await member(id)).toMatchObject({ status: 'removed', sessionEpoch: 1, passwordHash: null });
  expect(await db.select().from(adminTokens)).toEqual([]);
  expect(await sendLink(db, LEAD, id, NOW)).toEqual({ ok: false, error: 'not_found' });
  const again = await add('ops@example.com', 'finance', 'Olu Ops');
  expect(again).toMatchObject({ ok: true, id, delivery: 'shown' }); // the same row, revived
  expect(await member(id)).toMatchObject({ status: 'invited', role: 'finance', sessionEpoch: 2, removedAt: null });
  expect(await setPasswordWithLink(db, oldLink, 'a long enough password', NOW)).toEqual({ ok: false, error: 'invalid_link' });
});

test('you cannot remove yourself', async () => {
  const o = await add();
  const id = o.ok ? o.id : '';
  expect(await removeMember(db, { id, email: 'asif@example.com', name: 'Dr Asif', role: 'admin' }, id, NOW)).toEqual({ ok: false, error: 'self' });
});

test('the last Admin who can sign in can be neither removed nor moved to another role', async () => {
  vi.stubEnv('ADMIN_USERS', '');
  const a = await add('a@example.com'); const b = await add('b@example.com');
  for (const o of [a, b]) await setPasswordWithLink(db, tokenOf(o), 'a long enough password', NOW);
  const aId = a.ok ? a.id : ''; const bId = b.ok ? b.id : '';
  // A's request passed its guard just before B removed A: A is gone, B is the last Admin.
  await db.update(adminUsers).set({ status: 'removed' }).where(eq(adminUsers.id, aId));
  const staleA: Admin = { id: aId, email: 'a@example.com', name: 'Dr Asif', role: 'admin' };
  expect(await removeMember(db, staleA, bId, NOW)).toEqual({ ok: false, error: 'last_admin' });
  expect(await changeRole(db, staleA, bId, 'finance')).toEqual({ ok: false, error: 'last_admin' });
  expect(await member(bId)).toMatchObject({ role: 'admin', status: 'active' });
});

test('the team list leaves out removed people and shows when an invite expires', async () => {
  const a = await add('a@example.com'); const b = await add('b@example.com', 'finance');
  await removeMember(db, LEAD, b.ok ? b.id : '', NOW);
  const team = await listTeam(db, NOW);
  expect(team.map((m) => m.email)).toEqual(['a@example.com']);
  expect(team[0].linkExpiresAt).toEqual(new Date(NOW.getTime() + 24 * 3600_000));
  expect('passwordHash' in team[0]).toBe(false);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/admin-team.test.ts`
Expected: FAIL, cannot resolve `@/lib/admin/team`.

- [ ] **Step 3: Move the password and backstop code, and add the constants**

Make the file moves and re-exports listed under Files. Then run `npx vitest run tests/admin-auth.test.ts tests/doctor-account.test.ts`. Expected: PASS, unchanged.

- [ ] **Step 4: Add the two tables and generate the migration**

Edit `lib/db/schema.ts` as in Interfaces, then run `npm run db:generate -- --name admin_team`.
Expected: `drizzle/0006_admin_team.sql` contains `CREATE TABLE "admin_users"`, `CREATE TABLE "admin_tokens"` and `CREATE UNIQUE INDEX "admin_users_email"`, and the journal's last entry is `0006_admin_team`.

- [ ] **Step 5: Add `adminSetPassword` to `lib/email-templates.ts`**

Build it the way `doctorSetPassword` is built (`layout`, `esc`, `strip`), with this copy:
- Invite. Subject `You have been added to the Dr Quick admin`, heading `Set up your sign-in`. Paragraphs: `Hello {name},` / `{by} has added you to the Dr Quick admin as {role}.` / the link `Choose your password` / `The link works once and for {hours} hours.`
- Reset (`invite` null). Subject `Reset your Dr Quick admin password`, heading `Reset your password`. Paragraphs: `Hello {name},` / `Use the link below to choose a new password for the Dr Quick admin.` / the same link / the same expiry line.
- Footer for both: `If you were not expecting this, ignore this email. Nothing changes until the link is used.`

- [ ] **Step 6: Implement `lib/admin/team.ts` and `tests/helpers/mail.ts`**

Follow the signatures and rules above. Head the file with a comment naming the spec and the three rules a reader most needs: only hashes are stored, an active person's reset is never shown, and the last-Admin check runs in the change's own transaction.

- [ ] **Step 7: Run the tests and watch them pass**

Run: `npx vitest run tests/admin-team.test.ts && npm run typecheck`
Expected: PASS, 13 tests. No type errors.

- [ ] **Step 8: Commit**

```bash
git add lib/password.ts lib/admin/backstop.ts lib/admin-auth.ts lib/doctor/account.ts lib/db/schema.ts drizzle lib/email.ts lib/email-templates.ts lib/admin/team.ts tests/helpers/mail.ts tests/admin-team.test.ts
git commit -m "feat(admin): team accounts, one-time links and the last-Admin rule"
```

---

### Task 3: Sign-in and sessions over both account sources

**Files:**
- Modify: `lib/admin-auth.ts`
- Modify: `app/admin/actions.ts` (`signIn`)
- Modify: `.env.example:23-27` (the `ADMIN_USERS` comment)
- Create: `tests/helpers/admin.ts`
- Modify: `tests/admin-auth.test.ts`

**Interfaces:**
- Consumes: `Admin`, `Area`, `can` (Task 1). `accountByEmail`, `accountById`, `recordSignIn` (Task 2). `adminAccounts` (`lib/admin/backstop.ts`).
- Produces, from `lib/admin-auth.ts`:
  - `export type { Admin } from '@/lib/admin/roles'`
  - `verifyCredentials(email: string, password: string): Promise<Admin | null>`
  - `signSession(email: string, now?: number): string | null`, for a backstop entry. Payload `{ email, exp }` is unchanged, so existing cookies and tests keep working.
  - `signAccountSession(id: string, epoch: number, now?: number): string | null`, with payload `{ uid, epoch, exp }`
  - `readSession(token: string | undefined, now?: number): Promise<Admin | null>` (now async)
  - `currentAdmin(): Promise<Admin | null>`
  - `requireAdmin(area?: Area): Promise<Admin>`. Signed out, it redirects to `/admin/login`. Outside the role, it redirects to `NO_ACCESS_PATH`. Task 4 makes `area` required.
  - `actionAdmin(area: Area): Promise<Admin | null>`. Signed out, it redirects to `/admin/login`. Outside the role, it returns `null`.
  - `routeAdmin(area: Area): Promise<Admin | Response>`. Signed out: `new Response('Sign in first.', { status: 401 })`. Outside the role: `new Response('This is not part of your role.', { status: 403 })`.
  - `NOT_YOUR_ROLE = { ok: false, error: 'This is not part of your role. Ask an Admin if you need it.' } as const`
  - `NO_ACCESS_PATH = '/admin/no-access'`
  - `startSession(admin: Admin): Promise<boolean>`. A backstop entry signs `signSession(admin.email)`. An account reads its current `sessionEpoch` with `accountById` and signs `signAccountSession`. It returns false with no secret or no row.
- Produces, from `tests/helpers/admin.ts`: `addTestMember(db: DB, role: Role, over?: Partial<typeof adminUsers.$inferInsert>): Promise<{ id: string; email: string; token: string }>`. It inserts an `active` row (email `${role}@team.example`, name `Test ${ROLE_LABELS[role]}`, `passwordHash: hashPassword('correct horse battery')`, `createdBy: 'test'`) and returns `signAccountSession(id, sessionEpoch)`. The caller must stub `ADMIN_SESSION_SECRET` first.

**Rules:**
- `verifyCredentials` costs exactly one scrypt whatever the outcome. It uses the backstop entry if the email has one, otherwise `accountByEmail` when a database exists, otherwise the existing `DECOY`. A backstop entry is checked against its own hash only, even if a team row shares the address.
- `readSession` with an `email` payload returns the backstop entry as `{ id: null, email, name, role: 'admin' }`, or null if it has left `ADMIN_USERS`. With a `uid` payload, it needs a row that is `active` with `sessionEpoch === epoch`. If that row's email is in `ADMIN_USERS`, the backstop identity wins. No database means null for an account and no change for a backstop entry.
- `signIn`: after `startSession` succeeds and before the redirect, call `recordSignIn` for an account and write `audit(db, admin, 'sign_in', admin.id, { backstop: admin.id === null })`.

- [ ] **Step 1: Update the existing tests to the new shapes**

In `tests/admin-auth.test.ts`, every `verifyCredentials` and `readSession` call becomes awaited, and the expected admin becomes `{ id: null, email: 'editor@example.com', name: 'Sam Editor', role: 'admin' }`. `readSession(cookie.value)?.email` becomes `(await readSession(cookie.value))?.email`.

- [ ] **Step 2: Add the failing tests**

Append to `tests/admin-auth.test.ts` (it already mocks `next/headers` with `jar` and `next/navigation`):

```ts
describe('team accounts', () => {
  const signInAs = (email: string, password: string) => {
    const f = new FormData(); f.set('email', email); f.set('password', password);
    return signIn({ error: null, email: '' }, f);
  };
  const as = (token: string) => jar.set(SESSION_COOKIE, { value: token });

  test('an active member signs in with their own role; the sign-in is recorded and audited', async () => {
    const m = await addTestMember(db, 'finance');
    await expect(signInAs(m.email, 'correct horse battery')).rejects.toThrow('NEXT_REDIRECT /admin');
    expect(await readSession(jar.get(SESSION_COOKIE)!.value)).toEqual({ id: m.id, email: m.email, name: 'Test Finance', role: 'finance' });
    expect((await db.select().from(adminUsers))[0].lastSignInAt).toBeInstanceOf(Date);
    expect(await db.select().from(adminAuditLog)).toMatchObject([{ adminEmail: m.email, action: 'sign_in', target: m.id }]);
  });

  test('an invited person, a removed person and a wrong password all get the same answer and no cookie', async () => {
    await addTestMember(db, 'operations', { status: 'invited', passwordHash: null });
    await addTestMember(db, 'marketing', { status: 'removed' });
    for (const [email, pw] of [['operations@team.example', 'correct horse battery'], ['marketing@team.example', 'correct horse battery'], ['editor@example.com', 'nope']]) {
      expect((await signInAs(email, pw)).error).toBe('Email or password not recognised.');
    }
    expect(jar.has(SESSION_COOKIE)).toBe(false);
  });

  test('ADMIN_USERS wins over a team row with the same address', async () => {
    await addTestMember(db, 'marketing', { email: 'editor@example.com', passwordHash: hashPassword('another password here') });
    expect(await verifyCredentials('editor@example.com', 'correct horse battery')).toMatchObject({ id: null, role: 'admin' });
    expect(await verifyCredentials('editor@example.com', 'another password here')).toBeNull();
  });

  test('removal and a password change end a session on the next request; a role change applies without signing in again', async () => {
    const m = await addTestMember(db, 'operations');
    await db.update(adminUsers).set({ role: 'finance' }).where(eq(adminUsers.id, m.id));
    expect((await readSession(m.token))?.role).toBe('finance');
    await db.update(adminUsers).set({ sessionEpoch: 1 }).where(eq(adminUsers.id, m.id));
    expect(await readSession(m.token)).toBeNull();
    const n = await addTestMember(db, 'marketing');
    await db.update(adminUsers).set({ status: 'removed' }).where(eq(adminUsers.id, n.id));
    expect(await readSession(n.token)).toBeNull();
  });

  test('someone removed and added again cannot use their old session', async () => {
    const m = await addTestMember(db, 'operations');
    const lead = { id: null, email: 'editor@example.com', name: 'Sam Editor', role: 'admin' } as const;
    await removeMember(db, lead, m.id);
    await addMember(db, lead, { name: 'Back Again', email: m.email, role: 'operations' });
    expect(await readSession(m.token)).toBeNull();
  });

  test('the guards: outside your role a page redirects, an action gets null, a route gets 403', async () => {
    as((await addTestMember(db, 'marketing')).token);
    await expect(requireAdmin('finance')).rejects.toThrow('NEXT_REDIRECT /admin/no-access');
    await expect(requireAdmin('blog')).resolves.toMatchObject({ role: 'marketing' });
    expect(await actionAdmin('finance')).toBeNull();
    expect(((await routeAdmin('finance')) as Response).status).toBe(403);
    expect(await routeAdmin('analytics')).toMatchObject({ role: 'marketing' });
    jar.clear();
    expect(((await routeAdmin('analytics')) as Response).status).toBe(401);
    await expect(actionAdmin('blog')).rejects.toThrow('NEXT_REDIRECT /admin/login');
  });
});
```

- [ ] **Step 3: Run them and watch them fail**

Run: `npx vitest run tests/admin-auth.test.ts`
Expected: FAIL. `addTestMember`, `signAccountSession`, `actionAdmin` and `routeAdmin` are undefined, and `readSession` is not yet async.

- [ ] **Step 4: Implement `tests/helpers/admin.ts`, then the `lib/admin-auth.ts` and `signIn` changes**

Follow the Interfaces and Rules above. Update the file's head comment: accounts now come from `admin_users` as well as `ADMIN_USERS`, and the page, action and route guards each take an area. Rewrite the `.env.example` comment: `ADMIN_USERS` entries are **backstop** Admins that the Team page (`/admin/system/team`) cannot remove, the way back in if the team list goes wrong, and everyone else is added from the Team page. Keep the format line and the `npm run admin:hash` line.

- [ ] **Step 5: Run the tests and watch them pass**

Run: `npx vitest run tests/admin-auth.test.ts tests/admin-waitlist.test.ts tests/admin-system.test.ts tests/admin-doctor.test.ts tests/blog-actions.test.ts && npm run typecheck`
Expected: all PASS. The four action suites sign in through `signSession(email)` on `ADMIN_USERS`, so they are unchanged.

- [ ] **Step 6: Commit**

```bash
git add lib/admin-auth.ts app/admin/actions.ts .env.example tests/helpers/admin.ts tests/admin-auth.test.ts
git commit -m "feat(admin): sign-in and sessions for team accounts, and the role guards"
```

---

### Task 4: Every page, action and route names its area

**Files:**
- Modify: `lib/admin-auth.ts`. `requireAdmin(area: Area)`, now required.
- Modify, with the area each guard names:

| File | Guard |
|---|---|
| `app/admin/(panel)/layout.tsx`, `app/admin/(panel)/page.tsx` | `requireAdmin('overview')` |
| `app/admin/(panel)/analytics/page.tsx`, `…/traffic`, `…/engagement`, `…/funnels`, `…/heatmaps`, `…/live`, `…/visitors`, `…/visitors/[id]` (`page.tsx` each) | `requireAdmin('analytics')` |
| `app/admin/(panel)/blog/page.tsx`, `…/new/page.tsx`, `…/[id]/page.tsx` | `requireAdmin('blog')` |
| `app/admin/(panel)/finance/revenue`, `…/consultations`, `…/payouts`, `…/payouts/[id]` (`page.tsx` each) | `requireAdmin('finance')` |
| `app/admin/(panel)/system/audit/page.tsx` | `requireAdmin('audit')` |
| `app/admin/(panel)/system/emails/page.tsx` | `requireAdmin('emails')` |
| `app/admin/(panel)/system/settings/page.tsx` | `requireAdmin('settings')` |
| `app/admin/(panel)/system/technical/page.tsx` | `requireAdmin('technical')` |
| `app/admin/(panel)/waitlist/page.tsx`. Make it `async` and guard it before its redirect. | `requireAdmin('waitlist')` |
| `app/admin/(panel)/waitlist/patients/page.tsx`, `…/patients/[id]`, `…/gps`, `…/gps/[id]` | `requireAdmin('waitlist')` |
| `app/admin/(panel)/waitlist/actions.ts`: `setStatusAction`, `setDoctorPausedAction`, `sendDoctorLinkAction`, `saveNotesAction`, `bulkUnsubscribeAction`, `resendConfirmationAction` | `actionAdmin('waitlist')` |
| `app/admin/(panel)/waitlist/actions.ts`: `erasePersonAction` | `actionAdmin('erase')` |
| `app/admin/(panel)/system/actions.ts`: `resendEmailAction` | `actionAdmin('emails')` |
| `app/admin/(panel)/system/actions.ts`: `eraseByEmailAction` | `actionAdmin('erase')` |
| `app/admin/(panel)/blog/actions.ts`: all four | `actionAdmin('blog')` |
| `app/admin/(panel)/waitlist/export/route.ts` | `routeAdmin('waitlist_export')` |
| `app/admin/(panel)/finance/revenue/export/route.ts` | `routeAdmin('finance')` |

- Create: `app/admin/(panel)/no-access/page.tsx`, guarded by `requireAdmin('overview')`
- Modify: the head comments of the three `actions.ts` files, which say "requireAdmin()", to name the new guard.
- Modify: `CLAUDE.md` (the "Admins." bullet under "Blog and admin", and the "Admin (2026-09-29)" paragraph)
- Test: `tests/admin-access.test.ts` (the source scan) and `tests/admin-role-access.test.ts` (behaviour)

**Interfaces:**
- Consumes: `requireAdmin`, `actionAdmin`, `routeAdmin`, `NOT_YOUR_ROLE`, `NO_ACCESS_PATH` (Task 3). `addTestMember` (Task 3). `AREAS` (Task 1).
- Produces: the page at `/admin/no-access`. Every action shape works the same way: after `const admin = await actionAdmin('…')`, `if (!admin) return NOT_YOUR_ROLE;` fits both `ActionResult` and the blog's `EditorResult`, because both accept `{ ok: false, error: string }`.

- [ ] **Step 1: Write the failing scan test**

```ts
// tests/admin-access.test.ts. Every file in the admin panel names the area it belongs to, so a new page,
// action or route that forgets is caught here and not by a colleague who opens it.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { AREAS } from '@/lib/admin/roles';

const ROOT = join(__dirname, '..');
const PANEL = 'app/admin/(panel)';
const walk = (dir: string): string[] => readdirSync(join(ROOT, dir), { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : /\.tsx?$/.test(e.name) ? [`${dir}/${e.name}`] : []));
const files = walk(PANEL);
const read = (f: string) => readFileSync(join(ROOT, f), 'utf8');
const areasIn = (src: string, guard: string) => [...src.matchAll(new RegExp(`await ${guard}\\('([a-z_]+)'\\)`, 'g'))].map((m) => m[1]);
const valid = (areas: string[]) => areas.length > 0 && areas.every((a) => (AREAS as readonly string[]).includes(a));

test('every page and layout calls requireAdmin with a real area', () => {
  const pages = files.filter((f) => /\/(page|layout)\.tsx$/.test(f));
  expect(pages.length).toBeGreaterThan(25);
  expect(pages.filter((f) => !valid(areasIn(read(f), 'requireAdmin')))).toEqual([]);
});

test('every exported server action calls actionAdmin with a real area', () => {
  for (const f of files.filter((f) => f.endsWith('/actions.ts'))) {
    const src = read(f);
    const exported = src.match(/^export async function /gm)?.length ?? 0;
    const areas = areasIn(src, 'actionAdmin');
    expect({ f, guarded: areas.length, valid: valid(areas) }).toEqual({ f, guarded: exported, valid: true });
  }
});

test('every route handler calls routeAdmin with a real area', () => {
  expect(files.filter((f) => f.endsWith('/route.ts') && !valid(areasIn(read(f), 'routeAdmin')))).toEqual([]);
});

test('nothing in the panel uses a guard without an area', () => {
  expect(files.filter((f) => /\brequireAdmin\(\)|\bcurrentAdmin\(/.test(read(f)))).toEqual([]);
});
```

- [ ] **Step 2: Write the failing behaviour test**

`tests/admin-role-access.test.ts` uses the same mocks as `tests/admin-waitlist.test.ts:10-22` (`next/headers` with a `jar`, `next/navigation`, `next/cache`), `ADMIN_SESSION_SECRET` stubbed, email off, and a helper `as(role)` that sets `jar` to `addTestMember(db, role)`'s token. Seed one GP with `joinWaitlist` as `tests/admin-waitlist.test.ts:40` does. Import the two routes as `GET as exportCsv` (waitlist) and `GET as revenueCsv` (finance revenue).

```ts
test('Operations works the waitlist but can neither erase it nor download it, and refusals write no audit', async () => {
  const { g } = await seed(); await as('operations');
  expect(await setStatusAction(g.id, 'contacted')).toMatchObject({ ok: true });
  expect(await erasePersonAction(g.id)).toEqual(NOT_YOUR_ROLE);
  expect(await eraseByEmailAction('gp@example.com')).toEqual(NOT_YOUR_ROLE);
  expect((await exportCsv(new Request('http://localhost/admin/waitlist/export?role=gp'))).status).toBe(403);
  expect(await resendEmailAction(999)).toEqual({ ok: false, error: 'That email is not in the log.' }); // past the guard
  expect(await row(g.id)).toBeDefined();
  expect((await auditRows()).map((r) => r.action)).toEqual(['status_change']);
});

test('Finance downloads revenue and cannot touch the waitlist or the blog', async () => {
  const { g } = await seed(); await as('finance');
  expect((await revenueCsv(new Request('http://localhost/admin/finance/revenue/export'))).status).toBe(200);
  expect(await setStatusAction(g.id, 'contacted')).toEqual(NOT_YOUR_ROLE);
  expect(await savePostAction(null, {})).toEqual(NOT_YOUR_ROLE);
});

test('Marketing reaches the blog and not the waitlist', async () => {
  const { g } = await seed(); await as('marketing');
  expect(await savePostAction(null, {})).not.toEqual(NOT_YOUR_ROLE);
  expect(await saveNotesAction(g.id, 'x')).toEqual(NOT_YOUR_ROLE);
});

test('a page outside your role sends you to the no-access page', async () => {
  await as('marketing');
  const { default: RevenuePage } = await import('@/app/admin/(panel)/finance/revenue/page');
  await expect(RevenuePage({ searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_REDIRECT /admin/no-access');
});
```

- [ ] **Step 3: Run both and watch them fail**

Run: `npx vitest run tests/admin-access.test.ts tests/admin-role-access.test.ts`
Expected: FAIL. The scan lists every file in the table, and the behaviour tests find actions that are not refused.

- [ ] **Step 4: Make `area` required and apply the table**

In each action, the guard line becomes `const admin = await actionAdmin('…'); if (!admin) return NOT_YOUR_ROLE;`. In each route, `const admin = await routeAdmin('…'); if (admin instanceof Response) return admin;`.

The no-access page: `metadata.title = 'Not part of your role'`, an `AdminPageHeader` titled `Not part of your role` with the description `This section is not part of your role. Ask an Admin if you need it.`, and a link `Back to the overview` to `/admin`.

- [ ] **Step 5: Update `CLAUDE.md`**

Replace "`requireAdmin()` … is the real check, in the panel layout and at the top of every server action — keep it there in any new one" and "every server action calls `requireAdmin()`" with this rule: every page and layout in `app/admin/(panel)` calls `requireAdmin('<area>')`, every server action `actionAdmin('<area>')` (returning `NOT_YOUR_ROLE` on null), and every route `routeAdmin('<area>')`. Roles and areas live in `lib/admin/roles.ts`, and `tests/admin-access.test.ts` fails a file that forgets.

- [ ] **Step 6: Run everything and watch it pass**

Run: `npm run typecheck && npm test`
Expected: no type errors. All suites pass, including `admin-access` (4 tests) and `admin-role-access` (4 tests). Update the one call in `tests/admin-auth.test.ts` (`requireAdmin()` with no session) to `requireAdmin('overview')`.

- [ ] **Step 7: Commit**

```bash
git add lib/admin-auth.ts app/admin CLAUDE.md tests/admin-access.test.ts tests/admin-role-access.test.ts tests/admin-auth.test.ts
git commit -m "feat(admin): every page, action and route is held to its area"
```

---

### Task 5: What each role sees

**Files:**
- Modify: `lib/admin/roles.ts`. Add `overviewTilesFor`.
- Modify: `components/admin/nav.ts`. Give each item an `area`, and add `navFor`.
- Modify: `components/admin/AdminSidebar.tsx`, `components/app/PortalSidebar.tsx`, `app/admin/(panel)/layout.tsx`
- Modify: `app/admin/(panel)/page.tsx` (the Overview)
- Modify: `lib/admin/queries/visitors.ts`. Add `visitorQueryFor`.
- Modify: `components/admin/ListToolbar.tsx`. Add an optional `search` prop.
- Modify: `app/admin/(panel)/analytics/visitors/page.tsx`, `app/admin/(panel)/analytics/visitors/[id]/page.tsx`
- Modify: `components/admin/SignupDetail.tsx`, `app/admin/(panel)/waitlist/gps/[id]/page.tsx`, `app/admin/(panel)/waitlist/patients/[id]/page.tsx`
- Modify: `app/admin/(panel)/waitlist/patients/page.tsx:35`, `app/admin/(panel)/waitlist/gps/page.tsx:39` (the CSV links)
- Test: `tests/admin-role-views.test.ts`

**Interfaces:**
- Consumes: `can`, `Role`, `ROLE_LABELS` (Task 1). The `admin` returned by `requireAdmin` (Task 3).
- Produces:
  - `overviewTilesFor(role: Role): { analytics: boolean; signups: boolean; latestGps: boolean; finance: boolean }`. `analytics` = `can(role, 'analytics')`. `signups` = `can(role, 'waitlist') || can(role, 'analytics')`, because these are counts only. `latestGps` = `can(role, 'waitlist')`. `finance` = `can(role, 'finance')`.
  - `AdminNavItem = { href: string; label: string; icon: LucideIcon; area: Area }`. `navFor(role: Role): AdminNavGroup[]` keeps the items a role can reach and drops empty groups. The areas: Overview `overview`, Patients and GPs `waitlist`, the six Analytics items `analytics`, the three Finance items `finance`, Blog `blog`, Technical `technical`, Emails `emails`, Audit log `audit`, Settings `settings`.
  - `AdminSidebar({ name, email, role }: { name: string; email: string; role: Role })`. It passes `groups={navFor(role)}` and `detail={ROLE_LABELS[role]}`.
  - `PortalSidebar` gains `detail?: string`, rendered as a third line under the email in the footer, styled like the email. The doctor portal passes nothing and is unchanged.
  - `visitorQueryFor(params: Params, canSeeEmails: boolean): VisitorQuery`, which is `parseVisitorQuery(params)` with `q` set to `undefined` when `!canSeeEmails`
  - `ListToolbar` gains `search?: boolean` (default `true`). When false, there is no search field. The filters stay.
  - `SignupDetail` gains `canErase: boolean` and `canOpenVisitor: boolean`. `EraseButton` renders only with `canErase`. The "Open this visitor" link (`SignupDetail.tsx:206`) renders only with `canOpenVisitor`.

**What changes on screen** (the spec's "Overview, per role" and "Analytics → Visitors, for Marketing"):
- **Overview:** the Visitors and "Visitors who signed up" KPIs, "Visitors per day", "Top referrers" and "On the site now" need `tiles.analytics`. The Patient and GP sign-ups KPIs and "Sign-ups per day" need `tiles.signups`. "Latest GP applications" needs `tiles.latestGps`. "Revenue this month" and "GP payouts pending" need `tiles.finance`. A grid left with one card makes it span the full width, and no empty cells show. The single `overview()` query stays as it is.
- **Visitors list:** `canSeeEmails = can(admin.role, 'waitlist')`. Without it: `search={false}`, the query from `visitorQueryFor`, and each row labelled by `v.id.slice(0, 8)` in `font-mono`, never `v.signup.email`. The "GP sign-up" / "Patient sign-up" badge stays.
- **Visitor page:** without `canSeeEmails`, the title is `Visitor ${v.id.slice(0, 8)}`, and the Sign-up field lists `GP` / `patient` with the date, with no email and no link.
- **Waitlist lists:** the CSV download link renders only with `can(admin.role, 'waitlist_export')`.
- **Signup detail pages:** pass `canErase={can(admin.role, 'erase')}` and `canOpenVisitor={can(admin.role, 'analytics')}`.

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from 'vitest';
import { navFor } from '@/components/admin/nav';
import { overviewTilesFor } from '@/lib/admin/roles';
import { visitorQueryFor } from '@/lib/admin/queries/visitors';

const shape = (role: Parameters<typeof navFor>[0]) => navFor(role).map((g) => [g.label, g.items.map((i) => i.label)]);

test('each role’s sidebar holds its own sections and no empty groups', () => {
  expect(shape('operations')).toEqual([['Home', ['Overview']], ['Waitlist', ['Patients', 'GPs']], ['System', ['Emails']]]);
  expect(shape('finance')).toEqual([['Home', ['Overview']], ['Finance', ['Revenue', 'Consultations', 'Payouts']]]);
  expect(shape('marketing')).toEqual([['Home', ['Overview']], ['Analytics', ['Traffic', 'Engagement', 'Funnels', 'Heatmaps', 'Visitors', 'Live']], ['Content', ['Blog']]]);
  expect(shape('admin').find(([label]) => label === 'System')).toEqual(['System', ['Technical', 'Emails', 'Audit log', 'Settings']]);
});

test('each role’s overview tiles', () => {
  expect(overviewTilesFor('admin')).toEqual({ analytics: true, signups: true, latestGps: true, finance: true });
  expect(overviewTilesFor('operations')).toEqual({ analytics: false, signups: true, latestGps: true, finance: false });
  expect(overviewTilesFor('finance')).toEqual({ analytics: false, signups: false, latestGps: false, finance: true });
  expect(overviewTilesFor('marketing')).toEqual({ analytics: true, signups: true, latestGps: false, finance: false });
});

test('a visitor search by email is ignored for a role that cannot see emails', () => {
  const params = { q: 'someone@example.com', signed: 'yes' };
  expect(visitorQueryFor(params, true).q).toBe('someone@example.com');
  expect(visitorQueryFor(params, false)).toMatchObject({ q: undefined, signed: 'yes' });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/admin-role-views.test.ts`
Expected: FAIL. `navFor`, `overviewTilesFor` and `visitorQueryFor` are not exported.

- [ ] **Step 3: Implement the three functions, then the screens listed above**

- [ ] **Step 4: Run everything and watch it pass**

Run: `npm run typecheck && npm test`
Expected: no type errors, everything passes. `tests/bundle-boundary.test.ts` still passes, because `AdminSidebar` reaches only `nav.ts` and `roles.ts`.

- [ ] **Step 5: Look at it**

Run `npm run dev`. Insert one active member of each non-Admin role into the dev database, either with a scratch script that calls `addMember` and then `setPasswordWithLink`, or after Task 7 from the Team page. Sign in as each role at 1440px and 390px (the screenshot recipe is under "Verifying changes" in `CLAUDE.md`). Check the sidebar, the Overview and the footer's role line. As Marketing, check the Visitors list shows ids and no search box. As Operations, check a GP record has no Erase button and no "Open this visitor" link.

- [ ] **Step 6: Commit**

```bash
git add lib/admin/roles.ts components/admin components/app/PortalSidebar.tsx app/admin lib/admin/queries/visitors.ts tests/admin-role-views.test.ts
git commit -m "feat(admin): each role sees its own sidebar, overview and records"
```

---

### Task 6: Setting a password from a link

**Files:**
- Create: `app/admin/set-password/page.tsx`, `app/admin/set-password/SetPasswordForm.tsx`
- Modify: `app/admin/actions.ts`. Add `setPassword`.
- Modify: `proxy.ts:23`. Admin `open: ['/admin/login', '/admin/set-password']`.
- Modify: `tests/proxy.test.ts` (the "the admin" describe)
- Test: `tests/admin-set-password.test.ts`

**Interfaces:**
- Consumes: `linkIsLive`, `setPasswordWithLink`, `recordSignIn`, `addMember`, `sendLink` (Task 2). `startSession`, `readSession`, `SESSION_COOKIE` (Task 3). `PASSWORD_MIN` (`lib/password.ts`). `mailWorks`, `tokenIn` (Task 2's helper).
- Produces: `type SetPasswordState = { error: string | null }` and `setPassword(_prev: SetPasswordState, form: FormData): Promise<SetPasswordState>` in `app/admin/actions.ts`.

**Behaviour:** this mirrors `app/doctor/set-password/` and `setPassword` in `app/doctor/actions.ts:96`.
- The page reads `token` (sliced to 200), and calls only `linkIsLive`, because opening the page must spend nothing. Live: heading `Choose your password`, `At least {PASSWORD_MIN} characters.`, then the form ("New password", "Type it again", the button `Save and sign in`). Dead: heading `This link has expired`, body `A link works once and for 24 hours. Ask an Admin to send you a new one.`, and a link `Back to sign in` to `/admin/login`. It has the same card as `app/admin/login/page.tsx` and sits outside `(panel)`, so there's no sidebar.
- `setPassword` errors: `The two passwords do not match.`, `Use at least {PASSWORD_MIN} characters.`, and `This link has expired or has already been used. Ask an Admin to send you a new one.`. No database gets the `signIn` action's database message. When `startSession` returns false: `Sign-in is not set up on this server (ADMIN_SESSION_SECRET).`
- On success: `startSession`, `recordSignIn`, `audit(db, admin, accepted ? 'team_accept' : 'team_password', member.id)`, then `redirect('/admin')` outside any try.

- [ ] **Step 1: Write the failing tests**

In `tests/proxy.test.ts`'s admin describe: `expect(sentTo('/admin/set-password')).toBeNull();`

`tests/admin-set-password.test.ts` uses the `tests/admin-auth.test.ts` mocks and `LEAD` from Task 2:

```ts
const form = (token: string, password: string, confirm = password) => {
  const f = new FormData(); f.set('token', token); f.set('password', password); f.set('confirm', confirm); return f;
};
const tokenOf = (o: LinkOutcome) => new URL((o as { url: string }).url).searchParams.get('token')!;

test('an invited person sets a password, is signed in with their role, and it is audited as team_accept', async () => {
  const o = await addMember(db, LEAD, { name: 'Olu Ops', email: 'ops@example.com', role: 'operations' });
  await expect(setPassword({ error: null }, form(tokenOf(o), 'a long enough password'))).rejects.toThrow('NEXT_REDIRECT /admin');
  expect(await readSession(jar.get(SESSION_COOKIE)!.value)).toMatchObject({ email: 'ops@example.com', role: 'operations' });
  expect(await db.select().from(adminAuditLog)).toMatchObject([{ adminEmail: 'ops@example.com', action: 'team_accept', target: o.ok ? o.id : '' }]);
});

test('a mismatch and a short password are refused and the link still works', async () => {
  const token = tokenOf(await addMember(db, LEAD, { name: 'Olu Ops', email: 'ops@example.com', role: 'operations' }));
  expect((await setPassword({ error: null }, form(token, 'a long enough password', 'something else entirely'))).error).toBe('The two passwords do not match.');
  expect((await setPassword({ error: null }, form(token, 'short'))).error).toBe('Use at least 12 characters.');
  expect(await linkIsLive(db, token)).toBe(true);
  expect(jar.has(SESSION_COOKIE)).toBe(false);
});

test('an unknown or used link is refused', async () => {
  expect((await setPassword({ error: null }, form('not-a-token', 'a long enough password'))).error)
    .toBe('This link has expired or has already been used. Ask an Admin to send you a new one.');
});

test('a reset is audited as team_password and ends the person’s older session', async () => {
  const m = await addTestMember(db, 'finance');
  const sent = mailWorks();
  await sendLink(db, LEAD, m.id);
  await expect(setPassword({ error: null }, form(tokenIn(sent[0].text), 'a brand new password'))).rejects.toThrow('NEXT_REDIRECT /admin');
  expect(await readSession(m.token)).toBeNull();
  expect((await db.select().from(adminAuditLog)).map((r) => r.action)).toEqual(['team_password']);
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/admin-set-password.test.ts tests/proxy.test.ts`
Expected: FAIL. `setPassword` is not exported, and the proxy redirects `/admin/set-password` to sign-in.

- [ ] **Step 3: Implement the page, the form, the action and the proxy line**

- [ ] **Step 4: Run them and watch them pass**

Run: `npx vitest run tests/admin-set-password.test.ts tests/proxy.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/admin/set-password app/admin/actions.ts proxy.ts tests/proxy.test.ts tests/admin-set-password.test.ts
git commit -m "feat(admin): choose a password from an invite or reset link"
```

---

### Task 7: The Team page

**Files:**
- Create: `app/admin/(panel)/system/team/page.tsx`, guarded by `requireAdmin('team')`
- Create: `app/admin/(panel)/system/team/actions.ts`
- Create: `components/admin/TeamControls.tsx` (`'use client'`)
- Modify: `components/admin/nav.ts`. Add `{ href: '/admin/system/team', label: 'Team', icon: UserCogIcon, area: 'team' }` as the System group's first item.
- Modify: `tests/admin-role-views.test.ts`. Admin's System group becomes `['Team', 'Technical', 'Emails', 'Audit log', 'Settings']`.
- Modify: `lib/admin/queries/system.ts` (`AUDIT_LABELS`, `summariseMeta`)
- Modify: `app/admin/(panel)/system/settings/page.tsx:30-48`. The Admins card becomes a Team card.
- Modify: `scripts/hash-password.mjs` (head comment), `CLAUDE.md` ("Admin" section, "Before deploy")
- Test: `tests/admin-team-actions.test.ts`

**Interfaces:**
- Consumes: everything in Task 2's `lib/admin/team.ts`. `actionAdmin`, `requireAdmin`, `NOT_YOUR_ROLE`, `adminAccounts` (Task 3). `ROLE_LABELS`, `ROLE_SUMMARIES`, `ROLES` (Task 1).
- Produces, from `actions.ts`, each starting `const admin = await actionAdmin('team'); if (!admin) return NOT_YOUR_ROLE;`, then `getDb()` (none gives the waitlist actions' `NO_DB`), then calling the store, writing the audit, and running `revalidatePath('/admin/system/team')`:
  - `type TeamResult = { ok: true; message: string; link?: string } | { ok: false; error: string }`
  - `addMemberAction(input: { name: string; email: string; role: string }): Promise<TeamResult>` audits `team_add` with meta `{ role, linkShown }`.
  - `sendLinkAction(id: string): Promise<TeamResult>` audits `team_link` with meta `{ linkShown }`.
  - `changeRoleAction(id: string, role: string): Promise<TeamResult>` audits `team_role` with meta `{ from, to }`, and nothing when `from === to`.
  - `removeMemberAction(id: string): Promise<TeamResult>` audits `team_remove` with meta `{ role }`.
  - The audit target is always the member's id. Nothing is audited on a refusal.

**Copy:**

| Outcome | Message |
|---|---|
| add, `sent` | `Invite sent to {email}.` |
| add or link, `shown` | `The email could not be sent. Copy this link and pass it on yourself. It works once, for 24 hours, and will not be shown again.` (with `link`) |
| link, `sent` | `New link sent.` |
| role changed / unchanged | `Role changed to {ROLE_LABELS[to]}.` / `No change.` |
| removed | `{name} no longer has access.` |
| `invalid_name` | `Enter their name.` |
| `invalid_email` | `Enter a full email address.` |
| `invalid_role` | `Choose a role.` |
| `on_backstop` | `This address is already a backstop Admin in the server settings.` |
| `already_member` | `This person is already on the team.` |
| `not_found` | `This person is no longer on the team.` |
| `self` | `You cannot change your own role or remove yourself.` |
| `last_admin` | `The team needs at least one Admin who can sign in.` |
| `not_sent` | `The email could not be sent, so no new link was made. Their earlier link, if they have one, still works.` |

Audit labels: `sign_in` "Signed in", `team_add` "Added a team member", `team_role` "Changed a role", `team_link` "Sent a set-password link", `team_remove` "Removed a team member", `team_accept` "Accepted an invite", `team_password` "Set a new password".

`summariseMeta`:
- `team_add`: `{Role label}` plus `, link shown on screen` when `linkShown`
- `team_role`: `{from label} → {to label}`
- `team_link`: `Link shown on screen` or `Emailed`
- `team_remove`: `{Role label}`
- `sign_in`: `Backstop account` when `backstop`, otherwise empty

**The page** (spec, "Managing people"): an `AdminPageHeader` titled `Team`, with the description `Who can sign in to the admin, and what each person can do.`
- **Add a person** card: Name, Email, and a Role `Select` whose items show `ROLE_LABELS` with `ROLE_SUMMARIES` beneath, then a `Send invite` button. On `link`, it shows the message, the link in a read-only field and a `Copy link` button (`navigator.clipboard.writeText`). On `ok`, it clears the form.
- **People** table: Name (with `(you)` on your own row), Email, Role, Status, and actions.
  - Status for invited: `Invite sent, expires {fmtDateTime(linkExpiresAt)}`, or `Invite expired` when the expiry is null.
  - Status for active: `Active, last signed in {ago(lastSignInAt)}`, or `Active, never signed in`.
  - Role is a `Select` with `Save role`, modelled on `StatusControl`. On your own row it is text.
  - Actions: `Send new link`, and `Remove` (a destructive `ConfirmAction` titled `Remove {name}?` with the description `They lose access on their next click. You can add them again later.` and the confirm label `Remove`). Neither shows on your own row, except `Send new link`.
- **Backstop rows**, from `adminAccounts()`: Role `Admin`, Status `From server settings`, no controls.
- Below 900px the table follows how the panel's other tables behave there.

**Settings card:** titled `Team`, with the text `Who can sign in, and what each person can do.` and a link button `Manage the team` to `/admin/system/team`. Remove the now-unused `adminAccounts` import.

**`scripts/hash-password.mjs` head comment:** it prints one *backstop* `ADMIN_USERS` entry, always an Admin, that the Team page cannot remove. Everyone else is added from the Team page.

**`CLAUDE.md`:**
- Under "Admin": a paragraph on the four roles (`lib/admin/roles.ts`), the Team page, invites by one-time 24-hour link (shown on screen only for someone not yet set up, and resets by email only), and `ADMIN_USERS` as the always-Admin backstop.
- Fix the "Admins." bullet under "Blog and admin" so it no longer says `ADMIN_USERS` is the only way in.
- Under "Before deploy": `run npm run db:migrate (migration 0006_admin_team) before adding anyone from the Team page`.

- [ ] **Step 1: Write the failing tests**

`tests/admin-team-actions.test.ts` uses the `tests/admin-waitlist.test.ts` mocks, `ADMIN_USERS` = `lead@example.com|Lead Admin|…` signed in with `signSession('lead@example.com')` unless a test sets another session, and email off.

```ts
test('only an Admin can manage the team', async () => {
  jar.set(SESSION_COOKIE, (await addTestMember(db, 'operations')).token);
  expect(await addMemberAction({ name: 'X', email: 'x@example.com', role: 'admin' })).toEqual(NOT_YOUR_ROLE);
  expect((await db.select().from(adminUsers)).length).toBe(1); // only the test member
});

test('adding audits the role and whether the link was shown, by id and never by address', async () => {
  const r = await addMemberAction({ name: 'Dr Asif', email: 'asif@example.com', role: 'admin' });
  expect(r).toMatchObject({ ok: true, link: expect.stringContaining('/admin/set-password?token=') });
  const [m] = await db.select().from(adminUsers);
  const [a] = await db.select().from(adminAuditLog);
  expect(a).toMatchObject({ adminEmail: 'lead@example.com', action: 'team_add', target: m.id, meta: { role: 'admin', linkShown: true } });
  expect(JSON.stringify(a)).not.toContain('asif@example.com');
});

test('a role change and a removal are audited with the id', async () => {
  await addMemberAction({ name: 'Olu Ops', email: 'ops@example.com', role: 'operations' });
  const [m] = await db.select().from(adminUsers);
  expect(await changeRoleAction(m.id, 'finance')).toEqual({ ok: true, message: 'Role changed to Finance.' });
  expect(await removeMemberAction(m.id)).toEqual({ ok: true, message: 'Olu Ops no longer has access.' });
  expect((await db.select().from(adminAuditLog)).map((r) => [r.action, r.target, r.meta]))
    .toEqual([['team_add', m.id, { role: 'operations', linkShown: true }], ['team_role', m.id, { from: 'operations', to: 'finance' }], ['team_remove', m.id, { role: 'finance' }]]);
});

test('refusals come back as sentences and write no audit', async () => {
  const me = await addTestMember(db, 'admin');
  jar.set(SESSION_COOKIE, me.token);
  expect(await removeMemberAction(me.id)).toEqual({ ok: false, error: 'You cannot change your own role or remove yourself.' });
  expect(await addMemberAction({ name: 'Lead', email: 'lead@example.com', role: 'admin' }))
    .toEqual({ ok: false, error: 'This address is already a backstop Admin in the server settings.' });
  expect(await db.select().from(adminAuditLog)).toEqual([]);
});

test('a reset link for an active person is never handed back', async () => {
  const m = await addTestMember(db, 'finance');
  const r = await sendLinkAction(m.id);
  expect(r).toEqual({ ok: false, error: 'The email could not be sent, so no new link was made. Their earlier link, if they have one, still works.' });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/admin-team-actions.test.ts`
Expected: FAIL, cannot resolve `@/app/admin/(panel)/system/team/actions`.

- [ ] **Step 3: Implement the actions, labels, page, controls, nav item, Settings card and docs**

- [ ] **Step 4: Run everything and watch it pass**

Run: `npm run typecheck && npm test`
Expected: no type errors, and every suite passes. That includes `admin-access`, which now also scans `system/team/page.tsx` and `system/team/actions.ts`, and `admin-role-views`, whose Admin System group now includes Team.

- [ ] **Step 5: Look at it, end to end**

Run `npm run dev`, with email unset and a backstop `ADMIN_USERS` entry in `.env.local`.
1. Sign in as the backstop. Open Team at 1440px and 390px.
2. Add `Olu Ops` as Operations. Expect the link panel to show. Copy the link.
3. In a private window, open the link, set a password, and land on the Overview with the Operations sidebar.
4. Back as the backstop, change Olu to Finance. In the private window, click any link. Expect the Finance sidebar.
5. Remove Olu. Expect the private window's next click to land on sign-in.
6. Open the Audit log. Expect `Added a team member`, `Accepted an invite`, `Signed in`, `Changed a role` and `Removed a team member`, with no email of Olu's in the details.

Screenshot the Team page at both widths, including the footer (`CLAUDE.md`, "Verifying changes").

- [ ] **Step 6: Commit**

```bash
git add "app/admin/(panel)/system" components/admin lib/admin/queries/system.ts scripts/hash-password.mjs CLAUDE.md tests/admin-team-actions.test.ts tests/admin-role-views.test.ts
git commit -m "feat(admin): the Team page: add, re-role, re-link and remove people"
```
