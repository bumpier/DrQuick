# Admin team and roles: design

2026-10-21. Agreed with the user in conversation; not built yet. Calls the user made are marked **(user)**; calls made for them, which they can overrule, are marked **(our call)**. Anything unmarked follows from the code as it stands.

## Why

`/admin` has one way in: an `ADMIN_USERS` entry made with `npm run admin:hash`, pasted into the server's environment, followed by a redeploy. Everyone who gets in can do everything: read every waitlist record, download the lists as CSV, erase people, see the finances. That is fine for one person and wrong for a team. The user wants to add administrators, staff and other roles quickly, from the panel, without touching the server.

Dr Quick handles personal data (waitlist emails, GP applications with GMC numbers and mobiles, payments) and is heading towards health data. `Docs/Dr_Quick_Research_Report.md` sets the rule this follows: need-to-know access, with everything audited. Staff outside the clinical side see the minimum they need for their job.

## Who it is for

- **Dr Asif**, the lead admin: everything **(user)**.
- **The user**, the developer: everything **(user)**.
- People added later. Nobody specific yet; the user asked for roles "based on your own vision", so the roles below are **(our call)**, approved by the user.

## Goals

1. An Admin adds a person from the panel in under a minute: name, email, role, send.
2. Each person sees and does only what their role allows, enforced on the server, on every page, action and download.
3. Changing someone's role, or removing them, takes effect on their next request. No sign-out is needed.
4. Nobody can lock the team out of the panel.
5. Every change to the team is in the Audit log.

## Non-goals (this round)

- Two-step sign-in codes. The user was told this is the next thing to add **(our call, user agreed)**. Leave room for it: nothing here should make it harder.
- A "forgot password" link on the sign-in page. An Admin sends a fresh link instead **(our call, user agreed)**.
- Custom roles, per-person permissions, or more than one role per person. A need for a mix becomes a fifth role later **(our call, user agreed)**.
- Single sign-on, Google accounts, or anything external.
- Changes to the doctor portal (`/doctor`), the patient surface, or the investor demo. The demo deployment uses no admin accounts (`docs/demo-deploy.md`).
- Moving the existing `ADMIN_USERS` entry into the database (see "The backstop").
- Logging who opened which record. Today only actions and downloads are audited, never page views. The research report's "every access is logged and reviewable" would mean logging every non-Admin visit to a waitlist record, an email log or a visitor's journey, plus filters on the Audit log page to make it reviewable. That is its own piece of work, to follow this one with two-step sign-in **(our call)**.
- Sign-up fee income for the Finance role. Fees and refunds show only on Waitlist → GPs (`feeSummary`, the fee chips), which Finance cannot open, and Finance → Revenue counts consultation payments only. While `GP_FEE_ENABLED` is false there is nothing to show. When the fee comes back, add a names-free fee summary to Finance → Revenue **(our call)**.

## Anti-goals: it fails if…

- a section is hidden from the sidebar but still opens when its address is typed in, or a server action or download route answers someone whose role does not allow it;
- someone removed, or moved to a smaller role, keeps their old access until they sign out or their 8-hour cookie expires;
- the team can be left with no Admin who can sign in;
- an Admin chooses, sees or is emailed someone else's password, or can take over the account of someone who already has one;
- a set-password link is stored anywhere in a form that could be used (only its hash is stored, as with `doctor_tokens`);
- a role that has no need for a patient's or GP's email address is shown one.

## Roles

Approved by the user. Every role sees Overview, filtered (below).

| Role | Who it is for | Sections |
|---|---|---|
| **Admin** | Dr Asif, the user | Everything, including the Team page |
| **Operations** | Onboarding GPs, handling patient sign-ups | Waitlist (Patients, GPs, both detail pages), System → Emails |
| **Finance** | A bookkeeper or accountant | Finance (Revenue, Consultations, Payouts, the revenue CSV) |
| **Marketing** | Blog and growth | Analytics (all six pages), Blog |

**Admin only:** System → Team (new), Settings, Technical, Audit log; the waitlist CSV download (`/admin/waitlist/export`); erasing a person, from a waitlist record (`erasePersonAction`) or from Settings (`eraseByEmailAction`) **(user)**.

What that means, action by action:

| Action (file) | Admin | Operations | Finance | Marketing |
|---|---|---|---|---|
| `setStatusAction`, `saveNotesAction`, `setDoctorPausedAction`, `sendDoctorLinkAction`, `resendConfirmationAction`, `bulkUnsubscribeAction` (`waitlist/actions.ts`) | yes | yes | | |
| `erasePersonAction` (`waitlist/actions.ts`) | yes | | | |
| `waitlist/export/route.ts` | yes | | | |
| `resendEmailAction` (`system/actions.ts`) | yes | yes | | |
| `eraseByEmailAction` (`system/actions.ts`) | yes | | | |
| `finance/revenue/export/route.ts` | yes | | yes | |
| `savePostAction`, `publishPostAction`, `unpublishPostAction`, `deletePostAction` (`blog/actions.ts`) | yes | | | yes |
| The team actions (new) | yes | | | |

An Operations user opening a waitlist record sees the Erase control disabled or absent; the action refuses them regardless.

### Overview, per role (our call)

The Overview is everyone's landing page after sign-in. It shows only the tiles a role's sections cover:

| Tile on `app/admin/(panel)/page.tsx` | Shown to |
|---|---|
| Visitors, Visitors who signed up, Visitors per day, Top referrers, On the site now | Admin, Marketing |
| Patient sign-ups, GP sign-ups, Sign-ups per day (counts only, no names) | Admin, Operations, Marketing |
| Latest GP applications (names, GMC numbers) | Admin, Operations |
| Revenue this month, GP payouts pending | Admin, Finance |

Queries for tiles a role cannot see need not run.

### Analytics → Visitors, for Marketing (our call)

`analytics/visitors/page.tsx` and `analytics/visitors/[id]/page.tsx` show a visitor's sign-up email: as the row label, as the page title, in a "Search by sign-up email" box, and as a link to the waitlist record. For a role without Waitlist access (Marketing), show the short visitor id instead of the email, drop the email search, and drop the link. "Signed up: Yes, Patient" stays, because the journey to sign-up is the point of the page. Admin sees the page as it is today. This keeps the user's "all six pages" while keeping emails with the roles that work the waitlist.

## Enforcement

- **One table of roles and areas**, in one server-only module, is the only place a role's access is defined. The sidebar, the Overview, the pages, the actions and the routes all read it.
- **Every page, server action and route handler under `app/admin/(panel)` names the area it belongs to**, and is refused on the server when the signed-in person's role does not include it. This replaces today's bare `requireAdmin()`. There are about 70 call sites (`grep -rn requireAdmin app`), so add a test that fails when any file there calls the guard without an area, or calls nothing at all. A new page that forgets must not slip through.
- The panel layout's check stays, but it is not enough by itself: a layout does not re-render for a server action (the comment in `app/admin/(panel)/layout.tsx` says so already).
- **A page outside your role** shows a short message ("This section is not part of your role. Ask an Admin if you need it.") inside the panel, with the sidebar. It does not use the generic not-found page, which would look broken to a colleague following a link **(our call)**. A server action outside your role returns the usual `ActionResult` error without doing anything. A download route outside your role answers 403.
- **The sidebar** (`components/admin/nav.ts`, `ADMIN_NAV`) shows only the items for your role, and drops a group left empty.
- **Every request re-reads the person**, as `readSession` re-checks `ADMIN_USERS` today and `doctor-auth.ts` re-loads the `gps` row. A removed person, a role change or a password reset applies on the next request. One database read per request is acceptable; the doctor portal does the same.
- `proxy.ts` still only redirects a request with no cookie. Add the new set-password page to the admin's `open` list there.

## Accounts

### Data (our call)

A new migration (the next number after `0005_consultation_calls`), following the schema's conventions: text status columns with TypeScript enums, `timestamptz`, uuid ids, no foreign keys.

**`admin_users`**: `id`, `email` (unique, lower-cased), `name`, `role` (`admin`, `operations`, `finance`, `marketing`), `status` (`invited`, `active`, `removed`), `password_hash` (null until they set one), `session_epoch` (bumped by a password change or removal, ending older sessions), `created_at`, `created_by` (the adding admin's email), `last_sign_in_at`, `removed_at`.

Removing someone sets `status = 'removed'`. The row is kept, so the team's history (who had access, and when) survives. Re-adding the same email brings the row back with the new role and a fresh invite.

**`admin_tokens`**: the set-password links, as `doctor_tokens`: `token_hash` (SHA-256), `admin_user_id`, `expires_at`, `used_at`, `created_at`.

### The backstop: `ADMIN_USERS` stays (our call, user agreed)

Entries in `ADMIN_USERS` keep working exactly as now, always as **Admin**. They are the way back in if the database list goes wrong. The Team page lists them as "From server settings": they cannot be edited, re-roled or removed from the page, only on the server. An email that is in `ADMIN_USERS` cannot also be added on the Team page. If the same email somehow ends up in both, the `ADMIN_USERS` entry wins.

The user's current login is one of these. They add Dr Asif from the Team page.

### Sign-in

The existing form, throttle and wording are unchanged (`app/admin/actions.ts`, `lib/admin-auth.ts`). Credentials are checked against `ADMIN_USERS` first, then against an `active` row in `admin_users`. An unknown email, a removed person and someone invited but not yet set up all get the same "Email or password not recognised." and the same scrypt cost (the existing `DECOY`). Passwords use the existing `hashPassword` / `verifyPassword`. A successful sign-in records `last_sign_in_at`.

The session cookie stays `dq_admin`, signed with `ADMIN_SESSION_SECRET`, 8 hours, path `/admin`. For a database account it carries the id and the session epoch it was signed under, as the doctor cookie does.

### Adding a person (user)

On **System → Team** an Admin enters a name, an email and a role, and sends. That:

1. creates or revives the `admin_users` row as `invited`;
2. makes a one-time link to a new page, `/admin/set-password?token=…`, valid for **24 hours** **(our call)**. Only its hash is stored;
3. emails it to the person through `lib/email.ts`, with a new template in `lib/email-templates.ts` that names who invited them and their role;
4. writes an audit entry.

If the email cannot be sent (`emailConfigured()` is false, as on a dev machine, or the send fails), the page shows the link once, to the Admin who just sent it, to copy and pass on another way **(user)**. The link is never stored in plain text and is never shown again. Leaving the page loses it, and sending a new one is the fix. The audit entry records that the link was shown (`meta: { linkShown: true }`). This applies only to someone still `invited`: they have no account yet, so there is nothing to take over (see "Send a new link" below for everyone else).

The set-password page asks for a password twice. It uses the doctor portal's length rules (`PASSWORD_MIN` 12, `PASSWORD_MAX` 256, `lib/doctor/account.ts`), marks the account `active`, spends the link, bumps the epoch, and signs them in. A refused attempt (too short, the two do not match) leaves the link usable. An expired or used link says so and tells them to ask an Admin for a new one.

### Managing people (user)

The Team page lists everyone: name, email, role, status ("Invite sent, expires …" or "Active, last signed in …"), and the backstop entries, marked as such. Per person, an Admin can:

- **Change role.** Takes effect on that person's next request.
- **Send a new link.** For a forgotten password, or an invite that expired. Their current password keeps working until the link is used.
  - To someone still **invited**, it works as adding does: emailed, or shown once if the email cannot be sent. The new link replaces the earlier one.
  - To someone **active**, it goes by email only and is never shown on screen **(our call)**. A link on screen would let one Admin choose a colleague's password and then work under that colleague's name in the Audit log. If the email cannot be sent, the new link is withdrawn, the earlier one (if any) keeps working, and the Admin is told it did not send. This is what `requestSetPasswordLink` in `lib/doctor/account.ts` does. Without email, a person who has forgotten their password is removed and added again, so a fresh invite starts the record over.
- **Remove.** Asks for confirmation, then sets `removed` and bumps the epoch. Their next request lands on the sign-in page.

Name and email are fixed once added; to change an email, remove the person and add them again **(our call)**.

### Safety rules (user)

- You cannot change your own role, and you cannot remove yourself.
- There is always at least one active Admin. Count `admin_users` Admins and `ADMIN_USERS` entries together, and check inside the same transaction as the change, so two Admins removing each other at once cannot both succeed.

### Audit

Every add, role change, new link and removal goes through `audit()` (`lib/admin/audit.ts`) with the acting admin, an action name (`team_add`, `team_role`, `team_link`, `team_remove`: lower case and underscores only, because `parseAuditQuery` filters on `^[a-z_]{1,60}$`), the `admin_users.id` as the target, and the old and new role in `meta` where it applies. Use the id, not the email, as the audit log's existing rule says.

Also audited **(our call)**: a person setting their password through a link (`team_accept` for an invite, `team_password` for a reset), and every successful sign-in, backstop accounts included (`sign_in`). With those, the log shows who had access and when they used it. Failed sign-ins are not audited (the throttle already covers them). Page views are not audited this round (see Non-goals).

## Where the existing panel changes

- **Settings** (`system/settings/page.tsx`): the "Admins" card, which lists `ADMIN_USERS` and tells you to run `npm run admin:hash`, becomes a short card linking to Team.
- **Sidebar footer**: shows the person's role under their name **(our call)**.
- **`npm run admin:hash`** and `scripts/hash-password.mjs` stay, now described as making a backstop entry.
- **`.env.example`**: reword the `ADMIN_USERS` comment so it describes a backstop Admin and points to the Team page for everyone else.
- **`CLAUDE.md`** ("Blog and admin", "Admin"): replace "every server action calls `requireAdmin()`" with the rule that every page, action and route names its area. Describe the roles, the Team page and the backstop. Add the migration to "Before deploy".

## Constraints

- This repo's Next.js differs from what you may know. Read the relevant guide in `website/node_modules/next/dist/docs/` before writing code (`website/CLAUDE.md`).
- No new dependencies. The sign-in already uses `node:crypto` scrypt and `lib/signed-token.ts`.
- Server actions are untrusted entry points: validate the role value and the target id on the server, and never take "who is acting" from the browser.
- UI is shadcn components from `components/ui/`, restyled to `DESIGN.md`, with no new primitives the CLI already provides. Confirmations use `Dialog`, as elsewhere in the panel.
- Development without `DATABASE_URL` runs on PGlite, migrated on first use. Tests use the in-memory PGlite in `tests/helpers/db.ts`. A production server with no database already refuses admin sign-in; the backstop does not change that.
- The existing admin tests mock or call `requireAdmin` (`tests/admin-auth.test.ts`, `admin-waitlist.test.ts`, `admin-system.test.ts`, `admin-doctor.test.ts`, `blog-actions.test.ts`). They must keep passing, updated to the new guard.

## Left to the builder

- How the guard is spelled (an area argument to `requireAdmin`, a new function, a wrapper), and how the role table is shaped.
- File layout for the Team page, the set-password page and their actions, the token format, and the email template's wording within the house style.
- Whether the "add person" form sits on the page or in a dialog.
- Test layout, beyond: the role-by-action table above is tested; the "every file names an area" check exists; the backstop, the safety rules, removal and role change taking effect on the next request, link expiry and single use are each tested.
