# Doctor portal design

2026-10-01. As built on `feat/doctor-portal`. `PRODUCT.md` holds the product decisions and `CLAUDE.md` ("Doctor portal") the working rules; this is the design behind them.

## Why

GPs sign up and pay the sign-up fee on the landing page, and the team manages them in `/admin`, but a GP had nowhere to sign in. The finance tables (`gps`, `consultations`, `payments`, `payouts`) existed and nothing wrote to them. The portal at `/doctor` is the doctor's side: sign in, go online, take consultations, see earnings, edit a profile, and see a rating out of five.

## Decisions

Made by the user on 2026-10-01.

| Question | Decision |
|---|---|
| Real or prototype | Real: database-backed, with a doctor sign-in. Not the fixture prototype in `docs/superpowers/plans/2026-09-02-doctor-admin-surfaces.md`. |
| Jobs | One offer at a time to one online doctor, 45 seconds; a decline or a timeout passes it on. |
| Accounts | Claimed through a link emailed to the address the GP signed up with. Unlocked when the team marks the application Active. |
| Funds | Read-only earnings and payout history. No withdrawals, no Stripe Connect. |
| Ratings | Patients give one to five stars. Shown to the doctor and on the patient's matched-GP card. Reverses "no ratings". |

Not in this build: the video call, clinical notes, a real patient flow or payment that creates a consultation, creating a payout, patient accounts.

**The consequence to hold on to:** nothing creates a consultation in production yet. Offers, earnings and ratings are empty on a live server until a real patient flow exists. The local demo seed exercises all of it.

## Data model

Migration `0004_doctor_portal`. Conventions as elsewhere: text status columns with TypeScript enums, `timestamptz`, uuid ids, integer pence, no foreign keys.

**`gps`**, added:
- Sign-in: `password_hash` (null until claimed), `session_epoch` (bumped by a password change, which ends every earlier session).
- Profile: `mobile`, `bio`, `languages`, `updated_at`.
- Shift: `online_since` (null is offline), `last_seen_at` (the portal's heartbeat), `available_since` (null is "not in the rotation"; otherwise the fairness key).
- A unique index on `email`.

**`doctor_tokens`**: the one-time set-password links. `token_hash` (SHA-256; the token itself exists only in the email), `email`, `expires_at`, `used_at`.

**`consultations`**, added: `reason`, `age_band`, `record_consent` (the three things a GP sees before accepting), a partial unique index on `gp_id` where the status is `in_progress` (a doctor holds one consultation), and a partial index on `requested_at` for the waiting queue. `gp_fee_pence` is NOT NULL, so a request carries a provisional split until a doctor accepts.

**`consultation_offers`**: `consultation_id`, `gp_id`, `status` (offered, accepted, declined, expired, withdrawn), `gp_fee_pence`, `offered_at`, `expires_at`, `responded_at`.
- Unique on `(consultation_id, gp_id)`: never offered to the same doctor twice.
- Partial unique indexes on `consultation_id` and on `gp_id` where the status is `offered`: one live offer per consultation and per doctor, enforced by the database.
- The partial-index predicates are written with the literal inline (``sql`${t.status} = 'offered'` ``). `eq(t.status, 'offered')` produces a bound parameter, which drizzle-kit drops.

**`consultation_ratings`**: `consultation_id` (primary key, so one rating each), `gp_id`, `stars`. No comment column.

## Accounts and sign-in

- `lib/doctor/account.ts`. `requestSetPasswordLink` sends a link to an existing doctor who is not offboarded, or to a GP sign-up that has a name and a GMC number, is not rejected, and whose fee is not unpaid or refunded. An unpaid sign-up is excluded because anyone can type anyone's GMC number into the form for nothing, and `gps.gmc` is unique: a stranger could otherwise lock a real GP out. The public form answers every address in the same words and runs the work in `after()`, once the response has gone, so the wait says nothing either. A link that reaches the inbox replaces the last; one whose email failed is withdrawn, the earlier one keeps working, and the admin is told. `setPasswordWithToken` spends the link in a transaction: on an existing account it is a reset and bumps the epoch; otherwise it creates the `gps` row from the sign-up. A refused attempt (a short password, a GMC number another account holds) rolls back, so the link is still good.
- `lib/doctor-auth.ts`, modelled on `lib/admin-auth.ts`. Cookie `dq_doctor`, httpOnly, SameSite=Strict, path `/doctor`, 12 hours, signed with `DOCTOR_SESSION_SECRET`. The HMAC signing moved to `lib/signed-token.ts`, shared with the admin cookie. Every read loads the `gps` row and refuses an offboarded doctor or a stale epoch. The type the rest of the app handles has no password hash.
- `proxy.ts` branches by area. It lets the three pre-sign-in pages and `/doctor/pulse` through; the poll answers 401 itself, because a redirected fetch would return the sign-in page with a 200.
- Approval is the existing waitlist pipeline. `setStatusAction` calls `syncAccountStatus`: Active maps to `active`, Rejected to `offboarded`, anything else to `onboarding`, and anything but Active takes the doctor off the floor.

## Offers

`lib/doctor/dispatch.ts`. `dispatch(db, now, { wait })` runs in one transaction:

1. Take the advisory lock. The poll uses the try-lock and steps aside if another dispatch is running; an event that must not be lost (a decline, going offline, coming back) waits for it.
2. Withdraw live offers whose consultation is no longer `requested`. Not the doctor's doing, so they keep their place.
3. Expire live offers that are past `expires_at`, or whose doctor is no longer active, online and seen within 15 seconds. Those doctors leave the rotation.
4. Take doctors silent for two minutes offline, unless they are in a consultation.
5. For each waiting consultation, oldest first, offer it to the eligible doctor who has been available longest. Never ordered by price. The fee is `splitPrice()` at the doctor's tier, fixed at offer time. A request older than fifteen minutes is skipped.

There is no background worker. The dispatcher is run by whoever is waiting on its outcome: the doctor's poll, and every shift action. The patient side must run it too, when it creates a consultation and from the wait screen; if the only doctor holding an offer shuts their laptop, nothing else is left to drive the clock.

Why it is safe:
- One clock. Every statement uses the `now` passed in, never the database's.
- The lock makes dispatches run one at a time; the partial unique indexes refuse a second live offer even if the lock were bypassed.
- A doctor's own writes (`lib/doctor/shift.ts`) do not need the lock: each is one guarded statement. Accept locks the offer row, takes the consultation at the quoted fee, takes the doctor out of the rotation and marks the offer accepted, in one statement; if the consultation cannot be taken, none of it happens. A statement that changes nothing is then asked why.
- The stored window is 48 seconds and the countdown 45, so a click made at the last second lands.

Verified on a real Postgres 17 over postgres.js (`tests/doctor-postgres-integration.test.ts`): sixteen simultaneous dispatches leave exactly one live offer per consultation and per doctor, and an accept racing the expiry never leaves a consultation half taken. PGlite runs every transaction behind one mutex and cannot show either.

## The shift

`shiftState` returns what the portal shows: unavailable (not approved, or paused), offline, idle, offer, consultation, or resting. Durations are measured on the server and sent as milliseconds, never as absolute times, so a doctor's own clock cannot stretch a window.

A consultation in progress outranks everything, the account's status included: whatever else has happened, the doctor can end it.

After a missed offer or a finished consultation the doctor rests until they tap "Back online". A decline returns them to the back of the queue with no tap.

The poll is `POST /doctor/pulse`, a route handler. A server action would work but is wrong for a three-second loop: Next runs a client's actions one at a time, so a slow poll would queue in front of the Accept click. The actions (accept, decline, complete and the rest) are server actions that return the new state and never set a cookie or revalidate a path.

`ShiftProvider` sits in the portal layout so an offer reaches the doctor on any page. It re-arms the poll only after each answer, drops an answer older than the doctor's last click, and reloads once after a deploy when nothing is in hand. It stops while the tab is hidden and checks in at once when it is shown again: the poll is the heartbeat, and a doctor who cannot see the portal must not be offered a patient. When a poll cannot reach the server it shows "Connection lost"; when a click cannot, it says so in a toast and the panel stays up.

## Earnings

`lib/doctor/queries/earnings.ts`, read-only. The definitions are the admin's: a fee is earned by a completed consultation whose payment succeeded, in the month the patient paid. Every earned penny is in one of three places: awaiting a payout, in a payout that is on its way, or paid; a failed payout puts its fees back. The lists are the admin's own finance queries filtered to one doctor. A no-show or cancelled row shows "Not paid" instead of the fee it was accepted at.

## Ratings

`lib/ratings.ts` and the pure `lib/rating-rules.ts`.

- `recordRating` writes one rating for a completed consultation, once. It is the only writer, and nothing in production calls it yet.
- A doctor sees their average to two places, the count and the spread. They are not shown which consultation a rating came from, but the figures move as each rating arrives, so they could work it out. No screen tells a patient that a rating cannot be traced. Batching ratings so that one cannot be traced is an open product decision.
- A patient sees the matched GP's rating to one place, once five patients have given one. Still no name and no face.
- A figure never rounds up to a five the doctor does not have, and the star row fills in proportion.
- In the patient prototype, the receipt asks for the stars after a consultation the patient really finished and holds the answer on the screen. A first patient's GP shows no rating: nobody has rated anyone on an empty floor.

## Admin

The "Doctor portal" card on a GP's application page shows whether the account is claimed, its status, whether the doctor is online, their completed consultations and their rating, with Pause or Resume and "Email a sign-in link". Each action is audited by sign-up id. There is no separate doctors page.

`erasePerson` deletes a portal account that never took a consultation. One that did keeps its name and GMC number, as the payee on financial records, and loses the sign-in, the address, the mobile and the profile.

## Local data

`npm run db:seed:doctor` and `npm run doctor:request` call the dev-only route `app/dev/doctor`, which answers 404 in a production build. The seed is a typed module (`lib/dev/seed-doctor.ts`) that refuses in production and against a database on another machine. It is a route rather than a script because local development runs on PGlite, which only the dev server's process can open. Demo requests carry a paid payment up front: nothing captures a payment at the match yet.

## Risks

- **Health data.** `consultations.reason` is a presenting complaint. Only the demo seed fills it. A real patient flow must not write it until the privacy notice is complete and the legal entity exists.
- **The patient side must drive the dispatcher** (above).
- **A doctor is offered a consultation only while the portal is in view.** A hidden tab does not check in, so within fifteen seconds its doctor is out of the rotation, and after two minutes offline. That keeps a patient from waiting on an offer nobody can see, at the cost that a doctor working in another tab gets nothing. Alerting a doctor who is looking elsewhere (a sound, a browser notification) is not built and is an open decision.
- **Offboarding waits for a consultation to end.** Rejecting a doctor, and erasing one, are refused while they are in a consultation: an offboarded doctor cannot sign in, and nothing else can end it.
- **Erasure.** Keeping a name and GMC number against financial records is a judgment about data protection that a person should confirm.
- **No video.** The consultation screen shows a timer and the two ways to end; the call itself is not built.

## Defaults chosen while building

Each is a small change: ratings are public from five; a missed offer and a finished consultation need a "Back online" tap and a decline does not; requests older than fifteen minutes are not offered; three seconds of grace on accept; fifteen seconds of silence loses an offer and two minutes goes offline; there is no minimum wait before a no-show; a no-show pays nothing.
