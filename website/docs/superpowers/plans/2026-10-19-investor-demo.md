# Investor Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One presenter, on one laptop, can click through the whole of Dr Quick for investors (website, patient app, doctor portal, the encrypted video call between them) without a terminal, a crash or anything that looks unfinished.

**Architecture:** A demo switch (`NEXT_PUBLIC_DEMO=1`, development only) turns on a presenter page, joins the patient prototype to the real doctor portal through dev-only routes, gives the patient side a generated camera so one person can play both sides, and hides developer chrome. Everything demo-only is gated on `demoMode()`; a production build is unchanged. Polish fixes from the three audits ride alongside.

**Tech Stack:** Next.js 16 (App Router, Turbopack dev), React 19, TypeScript, Tailwind + shadcn (Radix), Drizzle over PGlite in development, livekit-client 2.22.4 with E2EE, Vitest (jsdom / in-memory PGlite via `tests/helpers/db.ts`).

**Spec:** No separate design document: the user asked to skip questions ("Just carry on skip the questions"). The decisions below are the spec; the audits behind them are summarised under "Audit findings".

## Decisions (the spec)

- The demo runs on the dev server with `npm run demo` (port 3100), not a production build: a production build has no local database and must keep its dev routes at 404. (Claude's call.)
- The presenter is one person switching windows on one laptop (the user). The patient's side therefore sends a generated "Demo patient" picture and no microphone, and does not play the GP's audio, so there is no echo and no camera conflict. The presenter's real camera is the GP's.
- The demo patient books in the patient app; that booking becomes the real waiting request the demo doctor is offered. The patient is matched when the doctor accepts, and sees the outcome when the doctor completes.
- Nothing invents a person: the demo patient picture is an illustration labelled "Demo patient", never a photo or a face.
- Left for the user (not in this plan): the contact email address (`NEXT_PUBLIC_CONTACT_EMAIL`), blog posts, real photographs, whether subpages should follow the GP or patient audience, and putting the demo on a public address.

## Global Constraints

- Every demo behaviour is gated on `demoMode()` from `lib/demo.ts`: true only when `process.env.NODE_ENV !== 'production'` and `process.env.NEXT_PUBLIC_DEMO === '1'`.
- Every `/dev/demo*` route: 404 unless `demoMode()`; 403 `{ error: 'not_local' }` unless the Host is `localhost`, `127.0.0.1` or `[::1]` and `sec-fetch-site` is absent or `same-origin`; then `assertLocal()` (lib/dev/seed-doctor.ts). Copy the guard shape from `app/dev/call/route.ts`. Responses carry `Cache-Control: no-store`.
- Design rules in `website/CLAUDE.md` and `website/DESIGN.md` hold: tokens only, no gradients/glass/emoji, lucide icons only in dashboards and the call screen at `strokeWidth={2}`, no unneeded text.
- Patient-surface copy rules hold (`tests/constraints.test.ts`): no time pressure, no "priority", "This call is not recorded." stays.
- Verify with `npx tsc --noEmit` and `npx vitest run <files> --maxWorkers=2` (the machine is heavily loaded). Run `tests/constraints.test.ts` when touching any copy.
- Do not commit: the user has not asked for commits in this session.
- A GateGuard hook refuses the first Edit/Write of each file and asks for facts (importers, affected functions, the instruction). State them and retry.
- A dev server may be running on :3100 from the user's terminal. Do not stop or restart it. Do not click "Start video" / "Join video" against it: that joins a real video room.

## Review Focus

1. A reload of `/patient/book/ready` followed by "Join the call": no React error, End call opens its dialog (Task 1).
2. The patient requests while the doctor is offline: the patient waits ("any moment now"), and the offer reaches the doctor as soon as they go online (Task 4).
3. The patient cancels while the doctor is being offered them: the offer is withdrawn and the doctor is back to waiting (Task 4).
4. The presenter presses Reset during a live call: nothing is left in progress and the call is closed for both sides (Task 3).
5. The presenter switches away from the patient window during the call (the window is hidden or occluded): the generated camera keeps producing frames, so the doctor's lock badge does not drop (Task 5).

## Audit findings (2026-10-19, screenshots in the session scratchpad)

- Patient: removeChild crash after a full load of Ready (root cause: React adopts the ready-title `<title>`; fix `itemprop="name"`); empty pre-join video box; stepper "Sympto…" at 1440; call length "00:14" vs "1 minute"; new consultation dated "28 August 2026"; "Your GP is ready" toast over the heading at 390; detail/Account facts outside tiles; blank Account "No practice saved" beside sharing on.
- Doctor: video below the fold behind a small button; blank green idle frame; live consultation invisible on other pages; offer card duller than waiting; finished card without fee or length; stacked tables misaligned at 390; payout KPIs at 390; reserved error line gap on login and password; unbranded 404; a waiting patient needs a terminal command.
- Site: Recap tile cramped; Pricing step headings staggered; How-it-works jump pills look like an unselected toggle; subpage heroes with an empty right side; garbled sentence in Terms; Blog in the nav with no posts; dev badge over the cookie banner.

---

### Task 1: Fix the call-screen crash

**Files:**
- Modify: `components/patient/BookingProvider.tsx` (the ready-title effect)
- Test: `tests/booking-provider.test.tsx` (create if no test covers the ready-title; otherwise extend the existing one, find it with `grep -rln ready-title tests`)

- [ ] **Step 1: Write the failing test** `the ready title is never one React can adopt`: render the provider on a matched Ready state in jsdom, then `expect(document.head.querySelector('title[data-slot="ready-title"]')?.getAttribute('itemprop')).toBe('name')`.
- [ ] **Step 2: Run it, expect FAIL** (attribute null).
- [ ] **Step 3: Implement**: `title.setAttribute('itemprop', 'name')` before the first `keepFirst()`, with a comment saying why (React 19 adopts the first `<title>` without `itemprop` when hydrating the metadata boundary, then throws on deleting it).
- [ ] **Step 4: Run it, expect PASS**, plus the existing patient flow tests.

### Task 2: The demo switch

**Files:**
- Create: `lib/demo.ts`, `scripts/demo.mjs`, `tests/demo.test.ts`
- Modify: `package.json` (script `"demo": "node scripts/demo.mjs"`), `next.config.ts` (`devIndicators: false` when `NEXT_PUBLIC_DEMO === '1'`), `components/app/StateJumper.tsx`, `components/patient/ProtoNote.tsx`, `app/doctor/login/page.tsx` + `LoginForm.tsx`, the site nav (`components/site/NavLinks.tsx`, landing `components/Nav.tsx`, `components/site/SiteMenu.tsx` if it lists Blog)

**Interfaces:**
- Produces: `demoMode(): boolean`; `showPrototypeChrome(jumper: string | null): boolean` (true when `jumper === '1'`, or in development when not in demo mode).

- [ ] **Step 1: Failing tests** in `tests/demo.test.ts` with `vi.stubEnv`: `demoMode()` is true only for NODE_ENV development + NEXT_PUBLIC_DEMO '1' (false in production with the flag, false without it); `showPrototypeChrome`: dev without demo → true; dev demo → false; demo with jumper '1' → true; production → false; production with jumper '1' → true.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement `lib/demo.ts`**, and use `showPrototypeChrome` in StateJumper and ProtoNote in place of their inline rule.
- [ ] **Step 4: Login prefill**: `page.tsx` passes `demo={demoMode() ? { email: DEMO_DOCTOR.email, password: DEMO_DOCTOR.password } : null}`; `LoginForm` uses them as `defaultValue`. Also in `LoginForm`: the reserved error line takes no height until there is an error. Test in the existing login test file (or `tests/demo.test.ts`): rendered with a demo prop, the fields hold the demo email and password; without it, empty.
- [ ] **Step 5: Hide Blog in demo mode** in every nav that lists it. Test: the nav rendered with NEXT_PUBLIC_DEMO '1' has no link to `/blog`.
- [ ] **Step 6: `scripts/demo.mjs`**: spawns `next dev -p ${PORT ?? 3100}` with `NEXT_PUBLIC_DEMO=1` inherited stdio; waits until `GET /` answers; requests each of these once to compile them: `/`, `/?role=patient`, `/about`, `/how-it-works`, `/pricing`, `/patient?data=seeded`, every `/patient/book/<step>?data=seeded` in `BOOKING_STEPS`, `/patient/consultations?data=seeded`, `/doctor/login`, `/dev/demo`; then prints `Demo ready: http://localhost:<port>/dev/demo`. Exits with the child. If the port is taken, print "Port <port> is in use: stop the other dev server first." and exit 1.
- [ ] **Step 7: Verify**: `npx tsc --noEmit`, `npx vitest run tests/demo.test.ts tests/constraints.test.ts --maxWorkers=2`.

### Task 3: The presenter page and Reset

**Files:**
- Create: `app/dev/demo/page.tsx`, `app/dev/demo/DemoControls.tsx` (client), `app/dev/demo/reset/route.ts`, `app/dev/demo/status/route.ts`, `lib/demo/guard.ts`, `lib/demo/reset.ts`, `tests/demo-presenter.test.ts`

**Interfaces:**
- Consumes: `demoMode()` (Task 2), `seedDoctorDemo` and `assertLocal` (lib/dev/seed-doctor.ts), the call lifecycle in `lib/video/calls.ts` (closing a call).
- Produces: `demoGuard(request: Request): Response | null` in `lib/demo/guard.ts` (null when allowed; the Global Constraints' 404/403/assertLocal sequence); `resetDemo(db: DB, now?: Date): Promise<SeedResult>`; `demoStatus(db: DB): Promise<{ doctor: 'offline' | 'online' | 'offer' | 'consultation' | 'resting'; consultation: { id: string; status: string } | null }>`.

- [ ] **Step 1: Failing tests**: `demoGuard` → 404 with demo off, 403 for Host `192.168.1.37:3100`, 403 for `sec-fetch-site: cross-site`, null for `localhost:3100`. `resetDemo` on an in-memory PGlite holding an `in_progress` consultation with an open call → afterwards no `in_progress` or `requested` consultation remains, the call is closed (no keys kept), and the demo doctor is offline. `demoStatus` reflects an online doctor and an accepted consultation.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** `lib/demo/guard.ts`, `lib/demo/reset.ts` (close every open call through the existing call-lifecycle function, then `seedDoctorDemo`), and the two routes (`POST /dev/demo/reset`, `GET /dev/demo/status`), each starting with `demoGuard`.
- [ ] **Step 4: The page** (`notFound()` unless `demoMode()`): an h1 "Demo", a Reset button (confirms, then shows "Reset done"), three large links that open in new windows: "Website" `/`, "Patient app" `/patient?data=seeded`, "Doctor portal" `/doctor`; a status line polled every 3 s from `/dev/demo/status` ("Doctor offline", "Doctor online, waiting", "Offer showing", "In a consultation", "Consultation finished"); and the run sheet as a numbered list: 1 Reset. 2 Website: GP page, switch to Patients. 3 Doctor portal: sign in (prefilled), Go online. 4 Patient app: See a GP now, through to Request a GP. 5 Doctor portal: Accept. 6 Patient: Join the call. 7 Doctor: Start video; both show the lock. 8 Doctor: Complete consultation; the patient sees the outcome. 9 Doctor: Earnings. Built from the shadcn Card/Button already installed, styled to DESIGN.md. Test (jsdom) the page component renders the three links with `target="_blank"`.
- [ ] **Step 5: Verify**: tsc, `npx vitest run tests/demo-presenter.test.ts --maxWorkers=2`.

### Task 4: The patient's booking reaches the doctor

**Files:**
- Create: `lib/demo/booking.ts`, `app/dev/demo/booking/route.ts`, `components/patient/useDemoBooking.ts`, `tests/demo-booking.test.ts`
- Modify: `lib/booking-flow.ts` (actions), `components/patient/BookingProvider.tsx` (use the hook in demo mode), `components/patient/steps/Finding.tsx` (wait copy at eta 0, cancel), `tests/booking-flow.test.ts` (or the existing reducer test file)

**Interfaces:**
- Consumes: `demoGuard`, `demoMode` (Tasks 2–3); `dispatch(db, now, { wait: true })` (lib/doctor/dispatch.ts); `splitPrice` (lib/finance/commission.ts); `COMPLAINTS` (lib/booking.ts).
- Produces:
  - `createDemoRequest(db: DB, input: { complaint: ComplaintId; pricePence: number; recordConsent: boolean }, now?: Date): Promise<{ consultationId: string }>`: one live demo patient `demo-patient-live@example.com`; cancels that patient's earlier `requested` consultations first; inserts `status: 'requested'`, `reason: COMPLAINTS[complaint].label`, `ageBand` one of the seed's existing bands (fixed), `recordConsent`, the split from `splitPrice(pricePence, 0)`, a succeeded payment (as `addWaitingRequest` does); runs dispatch.
  - `demoRequestStatus(db: DB, id: string, now?: Date): Promise<'waiting' | 'matched' | 'completed' | 'ended'>`: runs dispatch first; `requested`→waiting, `in_progress`→matched, `completed`→completed, `cancelled`/`no_show`/unknown id→ended.
  - `cancelDemoRequest(db: DB, id: string, now?: Date): Promise<void>`: a guarded single statement from `requested` to `cancelled`, withdrawing any live offer.
  - Route `/dev/demo/booking`: `POST` body `{ complaint, pricePence, recordConsent }` → `{ consultationId }` (400 on a bad body); `GET ?id=` → `{ status }`; `DELETE ?id=` → 204.
  - Reducer actions: `{ type: 'tickQueue'; now; gps?; waitForDoctor?: boolean }` (at zero remaining with `waitForDoctor` it holds at position 1, eta 0 instead of resolving); `{ type: 'matchDoctor'; now: number }` (from `finding` only, resolves exactly as the queue does with the fixture GPs); `{ type: 'doctorCompleted'; now: number }` (from `call` only, moves to `outcome`, never `ended-early`, fixing `seconds`).
  - `useDemoBooking(state, act)`: in demo mode only. On reaching `finding` with an authorised hold, POST once (quote in pence, complaint, `nhsGpConsent === true`); poll GET every 2 s while on `finding`, `ready` or `call`; `matched` on `finding` → `matchDoctor`; `completed` on `call` → `doctorCompleted`; a `cancel` from `finding` → DELETE. Forgets the id when the booking leaves those screens.

- [ ] **Step 1: Failing reducer tests**: `waitForDoctor` holds at position 1 / eta 0 and stays on `finding`; `matchDoctor` moves `finding` → `ready` with a GP and a captured hold, and is ignored on any other screen; `doctorCompleted` after 14 s in the call lands on `outcome` (not `ended-early`) with `seconds` 14; plain `endCall` after 14 s still lands on `ended-early`.
- [ ] **Step 2: Failing store tests** (in-memory PGlite, demo doctor seeded): request with the doctor offline → `waiting`; doctor goes online, poll → the doctor's shift shows an offer whose fee matches `splitPrice(pricePence, 0)` and whose reason is the complaint label; doctor accepts → `matched`; doctor completes → `completed`. Cancel while offered → `ended`, and the doctor's shift is idle with no offer. A second request cancels the first.
- [ ] **Step 3: Failing route tests**: 400 on `{ complaint: 'nope' }`; POST then GET returns `waiting`; guard behaviour delegated to `demoGuard` (one 404 case with demo off).
- [ ] **Step 4: Run all three, expect FAIL.**
- [ ] **Step 5: Implement** the store, route, reducer actions and hook; in `BookingProvider`, pass `waitForDoctor: demoMode()` to the queue tick and call `useDemoBooking` (it does nothing outside demo mode). `Finding`: at eta 0 the wait tile says "Any moment now" instead of a number; the ProtoNote shortcuts stay as they are (hidden in demo by Task 2).
- [ ] **Step 6: Verify**: tsc; the three test files plus the existing booking-flow and constraints tests pass.

### Task 5: One presenter, two sides of the call

**Files:**
- Create: `components/call/demoCamera.ts`, `tests/demo-camera.test.ts`
- Modify: `components/call/useEncryptedCall.ts`, `components/call/CallView.tsx`, `components/patient/VideoFrame.tsx`, `tests/call-hook.test.tsx`, `tests/call-ui.test.tsx` (not `CallPanel.tsx`: Task 6 owns it)

**Interfaces:**
- Produces:
  - `createDemoCamera(): { track: MediaStreamTrack; stop: () => void }`: a 640×480 canvas drawn on a `setInterval` of 66 ms (never `requestAnimationFrame`, which stops in a hidden window): the band colour as background, an illustrated head-and-shoulders in the sage and stone tokens that rises and falls gently, and "Demo patient" in white at the bottom left. `track` from `canvas.captureStream(15)`.
  - `useEncryptedCall({ requestPass, demoPatient?: boolean })`: with `demoPatient`, publishes the demo camera as the `Camera` source and no microphone, keeps the remote audio element muted, `toggleCamera` mutes/unmutes that publication, and `cleanup` stops the demo camera.
  - `CallView` props gain `autoStart?: boolean` (calls `start()` once on mount) and `demoPatient?: boolean` (passed to the hook; hides Mute).
- Behaviour:
  - Idle frame (both sides) is never a blank block: a `VideoIcon` and one line, GP "Start the video when you’re ready.", patient "Connecting you to your GP…". The start button is `size="lg"`.
  - Patient call screen (`VideoFrame`, video on): `autoStart`, and `demoPatient` when `demoMode()`; the "Not recorded" badge stays visible.

- [ ] **Step 1: Failing tests**: `createDemoCamera` (jsdom with a stubbed `HTMLCanvasElement.prototype.captureStream` and `getContext`) draws on a timer and `stop()` clears it and stops the track. In `call-hook.test.tsx` (mocked livekit-client): with `demoPatient` the hook publishes one track with source Camera and never calls `setMicrophoneEnabled`; the remote audio element is muted. In `call-ui.test.tsx`: idle shows the two lines per side; `autoStart` calls `start` exactly once; `demoPatient` hides Mute.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Verify**: tsc; `npx vitest run tests/demo-camera.test.ts tests/call-hook.test.tsx tests/call-ui.test.tsx tests/bundle-boundary.test.ts --maxWorkers=2`.

### Task 6: Doctor portal polish

**Files:**
- Modify: `app/doctor/(portal)/layout.tsx`, `app/doctor/(portal)/page.tsx`, `components/doctor/ShiftPanel.tsx`, `components/doctor/CallPanel.tsx` (placement and frame height: at most `calc(100svh-22rem)` at 1440; Task 5 owns the CallView props), `components/ui/table.tsx`, `components/doctor/EarningsTables.tsx`, `app/doctor/(portal)/earnings/payouts/[id]/page.tsx`, the change-password form (error-line gap; Task 2 owns `LoginForm.tsx` entirely)
- Create: `app/not-found.tsx`
- Test: the existing `tests/doctor-*.test.ts(x)` that cover these, plus new cases below

- [ ] **Step 1: Failing tests**: on the dashboard during a consultation, the call panel comes before the KPI row in document order; on Earnings during a consultation, a consultation bar (patient reason, the call length, "Back to the consultation" linking `/doctor`) is the first thing in `main`; the offer card carries the lime tone class used by `OfferNotice`; the resting card shows the fee earned (formatted with the portal's money formatter) and the consultation's length; `TableCell` inside a stacked table resets to `text-left` below the stack breakpoint.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement**: the call stays mounted once in the layout (it must survive navigation), placed above `{children}` on the dashboard and directly under the consultation bar elsewhere; at 1440×900 the video and "Complete consultation" are both above the fold. Payout KPIs: one column below 560px. The reserved error line takes no height until there is an error. `app/not-found.tsx`: the site's nav-less branded page, "Page not found" and a link home.
- [ ] **Step 4: Verify**: tsc; doctor tests; then screenshots at 1440 and 390 of dashboard (offer, consultation, resting), Earnings and payout detail with `scripts/shoot.mjs`.

### Task 7: Patient app polish

**Files:**
- Modify: `components/app/Stepper.tsx`, `components/patient/steps/Done.tsx` and `lib/booking.ts` (call length), `lib/fixtures.ts` + the screens that date a new consultation, `components/patient/PatientShell.tsx` (toast offset), `components/patient/ConsultationDetail.tsx`, `components/patient/Account.tsx`, `components/patient/steps/Quote.tsx` / `PriceQuote.tsx`

- [ ] **Step 1: Failing tests**: `callLength(14)` is "Under a minute", `callLength(119)` is "1 minute", `callLength(600)` is "10 minutes", and the receipt and the home row use it; a consultation created in the session is dated today (`new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })`), while seeded history keeps its fixture dates; blank Account shows sharing off and disabled when no practice is saved.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement**, plus the visual fixes without their own test: the stepper labels never truncate at 1440 (wrap or shorten to the step names already in `BOOKING_STEPS`); the toast sits below the top bar at 390; consultation detail and Account facts sit in white tiles like the rest; the quote's wait never wraps at 1440.
- [ ] **Step 4: Verify**: tsc; patient and constraints tests; screenshots of the changed screens at 1440 and 390.

### Task 8: Website polish

**Files:**
- Modify: `components/Recap.tsx`, `components/site/PageParts.tsx` (`NumberedTile`, `PageHero`), `app/(site)/how-it-works/page.tsx`, `app/(site)/terms/content.ts`

- [ ] **Step 1: Implement**: Recap has a row gap and the form a top margin at every width (text never touches the field or button); `NumberedTile` headings align across a row; How-it-works jump links render as plain secondary pill links, not the segmented switch; `PageHero` without art sizes to its content (no empty right column, no stretched height); Terms line 16 reads as a sentence while keeping "CQC-registered clinical service at launch" verbatim.
- [ ] **Step 2: Verify**: `npx vitest run tests/constraints.test.ts tests/metadata.test.ts --maxWorkers=2`; screenshots of `/`, `/?role=patient`, `/pricing`, `/how-it-works`, `/contact` at 1440 and 390 show the fixes and nothing else moved.

### Task 9: The run sheet and the full rehearsal

**Files:**
- Create: `docs/demo.md` (how to start: `npm run demo`, open the printed link; the run sheet from Task 3; what to say when asked why there is no fixed price; known limits)
- Modify: `website/CLAUDE.md` (a short "Investor demo" section pointing at `docs/demo.md` and `lib/demo.ts`)

- [ ] **Step 1: Write the docs.**
- [ ] **Step 2: Rehearse end to end** in Chrome for Testing over CDP with `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`, against `npm run demo`: Reset; patient books to "Request a GP"; doctor signs in (prefilled), goes online, accepts; patient joins; doctor starts video; both show the lock; toggle the patient camera; doctor completes; patient lands on the outcome; Earnings shows the new fee. Expect no console error on any page and screenshots of each step at 1440.
- [ ] **Step 3: Full suite**: `npx tsc --noEmit && npx vitest run --maxWorkers=2`.
