# Prompt: port the doctor and admin dashboards from `preview/` into the Next.js app

Copy everything below the line into a fresh session in `website/`. Prerequisite: the shadcn foundation (`plans/005-shadcn-foundation-prompt.md`) is done — `components/ui/` exists, `/dev/ui` renders, `CLAUDE.md` has a **Component layer** section. Do not start this without it. The patient surface (`/patient`, the booking flow) is a separate task and is out of scope here.

---

Port the doctor and admin surfaces of the Dr Quick role prototype from the vanilla-JS pages in `preview/` (`doctor.html`, `admin.html`, `preview/js/*`, `preview/css/*`) into the Next.js 16 app at the root of `website/`, as real routes built entirely from `components/ui/` (shadcn/ui, restyled to `DESIGN.md`). The result must be a dashboard a GP or an operations lead would recognise as a serious professional tool — dense where density serves, calm everywhere else, every control functional — while remaining, visibly and on every screen, a fixture-driven prototype of a service that has not launched.

"Functional" means: every button, toggle, tab, filter and stepper changes state, and that state is reflected everywhere it should be. A GP can register, clear every gate, go online, receive an offer, accept it, sit in a consultation, complete it, watch their earnings update, go offline, and hit every failure state on the way. An admin can watch the floor tick, drill into a GP's credential matrix, read prescribing against the register, and switch between blank and seeded data. Nothing is a dead click. "Prototype" means: no backend, no auth, no persistence beyond the session, fixture data only, blank by default, and a ribbon saying so.

## Read first, in this order

1. `CLAUDE.md` — design rules, the component layer, compliance, the no-JS and motion rules.
2. `DESIGN.md` — tokens and the shadcn token mapping.
3. `docs/superpowers/specs/2026-08-28-react-migration-design.md` — the approved architecture: routes, reducers, providers, what ports unchanged, the placeholder rules, the palette guard, the noindex headers. This prompt implements its milestones 3 and 4 minus the deletion of `preview/`, which waits for the patient port.
4. `docs/superpowers/specs/2026-08-27-role-dashboards-prototype-design.md` — *why* each screen exists and the five decisions the prototype is meant to settle. Every screen you build must still be able to settle its decision.
5. `preview/README.md`, then `preview/doctor.html`, `preview/admin.html`, `preview/js/doctor.js`, `preview/js/alerts.js`, `preview/js/placeholder.js`, `preview/js/fixtures.js`, `preview/js/charts.js`, `preview/js/shell.js`, `preview/js/rail.js`, and `preview/tests/*.mjs` — the source of truth for content, behaviour and the assertions that must survive.
6. `app/dev/ui/page.tsx` and `components/ui/*` — what you have to build with. Open `/dev/ui` and look at it before writing a screen.
7. `Docs/Dr_Quick_Research_Report.md` §5 and the compliance section of `PRODUCT.md` if any wording question arises.

## Scope

**In.** Routes, layouts, providers and reducers for `/doctor/**` and `/admin/**`; a shared authenticated-app shell; the fixture, placeholder, alert and chart modules ported with types; the prototype ribbon and a development state-jumper replacing the rail; the doctor and admin portions of the three preview test suites moved to Vitest; noindex headers verified; docs updated.

**Out.** The patient surface. Authentication, a database, real GP routing, video, payments, prescribing or Semble integration. Deleting `preview/` or `index.html`. Any new fixture that reads as traction. Any new screen the prototype spec does not name — if you think one is missing, list it in the report rather than building it.

## Architecture (decided in the migration spec; implement, do not redesign)

### Routes

```
/doctor                              dashboard, or one of the four blocking gates
/doctor/earnings
/doctor/profile
/doctor/onboarding/[[...step]]       register → identity → credentials → indemnity → skills → done
/doctor/session/[[...state]]         offline → online-idle → offer → consultation → complete, plus the failure states

/admin                               live floor (opens here)
/admin/governance
/admin/supply
/admin/business
```

Route groups: `app/(app)/doctor/layout.tsx` and `app/(app)/admin/layout.tsx` each mount their own providers and the shell. The landing page never imports any of it — `SidebarProvider`, `sonner`, the session reducer and the fixtures must not appear in the `/` bundle. Verify with `next build` output.

Every route is `dynamic = 'force-static'` or statically renderable; state lives client-side. Each page renders a complete server shell (nav, headings, ribbon, empty states) so a screenshot of the HTML without JavaScript is not blank.

### State

| Concern | Implementation |
|---|---|
| GP session | `useReducer` in `SessionProvider` (doctor layout). States: `offline`, `online-idle`, `no-patients-waiting`, `offer`, `offer-consent-refused`, `consultation`, `complete`, `offer-declined`, `offer-timed-out`, `patient-no-show`. Transitions exactly as `preview/js/doctor.js` — go online → idle; offer arrives on a timer while online; accept → consultation; decline → `offer-declined` then back to idle (the offer passes to the next GP, it does not wait); 45 s elapse → `offer-timed-out`; complete → `complete` → idle; go offline from any non-consultation state. |
| Onboarding | `useReducer` in `OnboardingProvider`. Steps in order; each gate carries its own status (`pending / verified / rejected / expiring / expired`) from the credential record; the indemnity step forks block cover (primary) vs own certificate with expiry. |
| Credential record | Derived from `fixtures.GPS` for `DOCTOR.ref`; `credentialAlerts()` from `alerts.ts` is the *only* source of alerts. `/doctor` renders a gate instead of the dashboard when the record demands one: `verification-pending`, `verification-rejected`, `indemnity-expired` (hard stop — the online control is disabled and says why), `revalidation-due` (a banner, not a block; see `BLOCKING` in `alerts.js`). |
| Data mode | `DataModeProvider` reading `?data=seeded`; persists across client navigation within the surface (keep the query on internal links, or hold it in provider state seeded from the URL on mount — pick one and document it). |
| Availability | One piece of state, echoed everywhere: the top-bar control, the dashboard tile, the session route. The test from `structure.test.mjs` that says "availability, not a schedule" is rewritten against the rendered dashboard and must still pass: no schedule screen, no calendar, one online/offline control that moves the GP between `offline` and `online-idle`. |
| Active nav | Derived from the pathname (`shell.ts` `activeNav` / `areaOf` port unchanged). |
| Live values | `live.ts` (`formatEta`, `tickQueue`, `startInterval`) drives the offer countdown, the consultation timer and the admin floor counters. Intervals are cleared on unmount and paused when `document.hidden`. |

No global store. The admin surface cannot read the doctor's session and vice versa.

### URL-addressable states (the rail's replacement)

Every session and onboarding state has a URL (`/doctor/session/offer-timed-out`, `/doctor/onboarding/indemnity`). Landing on one seeds the provider with that state and the worked-example fixtures, so a reviewer can jump straight to `patient-no-show` without walking there. Then build `components/app/StateJumper.tsx`: a bottom-pinned, monospace, dark, obviously-not-the-product bar listing every route and state for the current surface, rendered only when `process.env.NODE_ENV !== 'production'` **or** `?jumper=1` is present. It replaces `rail.js`. Keep it visually identical in intent to the prototype rail — it must never be mistaken for product chrome.

### Placeholder rules (not negotiable)

Port `placeholder.js` as `lib/placeholder.ts` with `shown()` and `live()` and their exact semantics, and route *every* figure through one of them. `shown(v)` is a figure only a running platform could produce: an em dash until `?data=seeded`. `live(v)` is a figure this session produced (a consultation the GP just completed appears in today's list and today's earnings immediately). Zero renders as a dash. Lists render their empty state. The £39 fee, the 999 band, the restricted-items register and the credential *labels* are product and policy facts and render in both modes. A dashboard that reads "£1,248 earned" in blank mode has made a claim about a service that has not seen a patient; that is a bug of the highest severity.

### What ports unchanged (types added, logic untouched, unit tests moved)

`booking.js` (the parts the doctor offer uses: `matchGp`, `outcomeFor`, `consultationRecord`, `formatClock`), `charts.js`, `placeholder.js`, `live.js`, `shell.js`, `alerts.js`, `fixtures.js`. Put them under `lib/` with the same export names. `fixtures.ts` stays one file; figures that appear twice are derived once (earnings are always consults × `FEE`).

## The shell

One `AppShell` for both surfaces, built from `components/ui/sidebar.tsx` (collapsible left nav on desktop, `Sheet` drawer under 900px per `DESIGN.md`), a top bar (wordmark → `/`, surface name, the doctor's availability control or the admin's data-mode switch, an `Avatar` with the fixture ref `GP-002` / `Admin`), and the page container. The prototype ribbon — "Prototype. Not a live service — no real patients, GPs, or data." — is the first element in the shell, sticky, on every route, and cannot be dismissed. `X-Robots-Tag: noindex, nofollow` is already configured for `/doctor/*` and `/admin/*` in `next.config.ts`; confirm `tests/headers.test.ts` covers both and add a `<meta name="robots" content="noindex, nofollow">` via `metadata` on both layouts as belt and braces.

## Doctor surface — screen by screen

Desktop-first at 1440; every screen must still work at 390 (the GP checking earnings on a phone), but the consultation and offer screens are designed for the desk.

**`/doctor` dashboard** (`preview/doctor.html` `dashboard`). Top row: availability control (the one big control — `Switch` plus a labelled state, "You're offline / You're online", and the reason when disabled); "Today" stat tiles (consults, earnings today, time online, patients waiting — all `shown()`/`live()`); "Next payout". Then "Before you go online": the `credentialAlerts()` list as `Alert`s ordered by tone (`blocking` → `act` → `watch`), each with a `Button` to the credential. Then two charts: "Consultations, last 14 days" (bar) and "When it is worth being online" (demand by hour, line) drawn from `charts.ts` geometry as inline SVG, 2px strokes, `stroke-primary`, `--color-ink-2` axes, no Recharts. Then "Offers today" and "Today's consultations" as `Table`s with proper `<th scope>`, and "How you are doing" (performance: acceptance rate, median consult length — `shown()`). No ratings, no stars, no patient names, ever.

**Gates.** When `credentialAlerts()` returns a `blocking` alert with `status === 'expired'` for indemnity, `/doctor` renders `indemnity-expired`: a full-width `Card variant="band"` stating that the GP cannot go online, why, and the single action (upload certificate / renew block cover). `verification-pending` and `verification-rejected` replace the dashboard during onboarding review; `revalidation-due` is a top `Alert` on the dashboard with days remaining, not a block.

**`/doctor/onboarding/[[...step]]`.** A `Stepper` (build it in `components/app/` from `Separator` + `Badge` — there is no shadcn stepper) across the top; one step per screen; each step's gate status shown as a `Badge` (15% semantic fill, 700-weight text, per `DESIGN.md`) — `pending` in ink-2, `verified` in success, `rejected` in error. Steps: **Register** (name-free: email, GMC number field with format validation only), **Verify it's you** (identity handoff panel — a described external step, not a fake camera), **Credentials** (GMC registration, licence to practise, CCT, enhanced DBS with barred-list check, right to work — each a row with status and, where it exists, an expiry countdown), **Indemnity cover** (block cover as the primary `Card`, own certificate with expiry as the reachable alternative — this screen exists to force decision 2 in the prototype spec, so both options must be equally real), **Clinical skills** (checkbox list from `SKILLS`), **You're ready** (leads to `/doctor`). Skipping ahead by URL is allowed and seeds earlier steps as complete.

**`/doctor/session/[[...state]]`.** Render the whole session inside the shell with the sidebar collapsed. `offline`: earnings to date, consults completed, credential status, next revalidation, one `Button` "Go online". `online-idle` (the default state of a shift, designed as such): queue depth, patients waiting, time online ticking, earnings today, and a visible signal that the platform is alive (the floor counters, `shown()`). `no-patients-waiting`: the honest quiet state with the demand-by-hour chart pointing at when to come back. `offer`: a 45-second countdown as a `Progress` bar plus numerals, announced by `aria-live="assertive"` at 30/15/5 s, showing only presenting complaint, age band and NHS-GP-summary consent — nothing else before acceptance — with **Accept** (primary) and **Decline** (secondary; there is no outline variant). `offer-consent-refused`: the same offer with the consent line rendered as a constraint, not a warning colour. `consultation`: a `videoframe` placeholder (a `Card` with the text "Patient video — not recorded", never a fake stream), the patient context panel, the consultation timer, and the **Semble handoff panel**: "Notes, prescribing and the consultation outcome are recorded in Semble, not here" with an "Open in Semble" `Button` that opens a `Dialog` explaining the handoff — no notes editor, no prescribing UI, by design (decision 1). `complete`: outcome recorded in Semble, £39 captured, earnings updated via `live()`, back to idle. `offer-declined`, `offer-timed-out`, `patient-no-show`: terminal cards with the consequence stated plainly and one route back.

**`/doctor/earnings`.** Next payout; "Daily earnings, last 14 days" (bar); "What is in this payout" `Table` with tabular numerals. Earnings are always consults × `FEE`; there is no per-hour figure anywhere.

**`/doctor/profile`.** Credentials matrix (the same seven rows as supply's per-GP view — one component, `CredentialMatrix`, used by both surfaces), clinical skills, account. Severity without a fourth colour: expired rows are band-filled, expiring rows carry a 2px ink border, valid rows are plain; urgent rows sort to the top. Never red/amber/green.

## Admin surface — screen by screen

Desktop-first, deliberately dense, opens on the floor.

**`/admin` Live operations.** "Right now": waiting, GPs online against GPs needed (the cover gap, given a `Card variant="band"` when negative), consults in progress, queue ETA, all ticking via `live.ts`. "Where supply thins first": the four failure counters — offers declined, offers timed out, failed matches, no-shows — as stat tiles at equal weight with the headline numbers, never tucked into a secondary panel. "Demand against cover, by hour": line chart, two series (`stroke-primary` for demand, `stroke-ink-2` for cover). Live values update without animating.

**`/admin/governance` Clinical governance and safety.** Stat row: incidents, safeguarding referrals, red-flag escalations (including patients who reached the 999 screen), complaints with time-to-resolution, break-glass accesses. Then the **restricted items register** as a `Table` (this is a policy fact and renders in blank mode), then **prescribing against the register, per prescriber** — a `Table` of GP refs with count against register, rate, and a `Badge` for outliers; the load-bearing view of the whole admin surface. Then the break-glass access log with a reason on every row. Then the audit log. No medicine is named anywhere; register entries are categories ("Schedule 2 and 3 controlled drugs", …) exactly as in `fixtures.js`.

**`/admin/supply` GP supply operations.** Applications in verification (a `Table` with stage `Badge`s); the per-GP **credential matrix** — GMC, licence, CCT, DBS, right to work, indemnity, revalidation — each cell with status and days-to-expiry, rows sorted so the soonest expiry is first, with a "within 14 days" filter defaulting on (the fortnight of notice is the point of the screen); who is online now; coverage against demand by hour; payout runs. The expired indemnity that blocks GP-00x on the doctor surface must appear here with warning before it bites — same fixture, same `alerts.ts`.

**`/admin/business` Business.** The top of the screen carries exactly two numbers — **real CAC** against the plan's £16 assumption, and **repeat consults per patient per year** against 1.8 — each rendered as actual vs assumption with the gap stated, never alone. Below: consult volume, revenue, refunds, and the waitlist counts (patients, GPs). Waitlist is the one figure with a real upgrade path (the API exists); leave a comment marking it, do not wire it.

## Design language

- **Every primitive is `components/ui/`.** No new `.btn`/`.card`/`.tag` CSS classes; the `preview/css` vocabulary is the *content* spec, not the styling. Compose in `components/app/` (`AppShell`, `StatTile`, `CredentialMatrix`, `Stepper`, `Countdown`, `ChartFrame`, `EmptyState`, `Ribbon`, `StateJumper`) from `ui/` primitives with `cn()`. If a screen needs a primitive that is not installed, add it with the CLI and restyle per the checklist in `CLAUDE.md`, then add it to `/dev/ui`.
- **Palette.** The sixteen tokens and nothing else; `tests/constraints.test.ts` scans `app/`, `components/`, `lib/`. Severity is fill, weight, border and position — never a fourth colour, never hue alone. Success and error appear only on status `Badge`s and the countdown's final seconds, never as decoration.
- **Typography.** Geist for headings, stat numerals (`numeric-data`, tabular) and table headers; Inter for everything read. Density: `body-md` 15px in tables, `body-sm` 13px for secondary cells; row padding 12px per `DESIGN.md` data lists; hairline row dividers in tables are acceptable because scan-ability wins over the "no horizontal dividers" note for data-heavy screens — record that exception in `DESIGN.md`.
- **Cards** are borderless with `shadow-card`; the band variant is for the one payoff or the one hard stop on a screen, never two on the same screen.
- **Charts** are inline SVG from `charts.ts`, drawn at the container's measured width so axis type never shrinks with the viewport, 2px strokes, no gradients, no fills under lines, no animation on update.
- **Motion.** The arrival grammar (`data-reveal`, 16px rise, 70ms stagger, 300ms cap) fires on a route's first paint only — never on tab switches, filter changes or data ticks. The offer countdown and timers are functional motion and persist as static numerals under `prefers-reduced-motion`. Overlays use the retimed `animate-in/out` already in `ui/`. Nothing else moves.
- **Empty states** are sentences, not illustrations: "No consultations yet." with, where honest, the reason ("Nothing has launched.").
- **Density is a virtue on the desk, not on the phone.** At 390px, tables collapse to stacked rows with the header labels inline (`Table` with a `max-cols:` variant), charts drop to one series, and the sidebar becomes the `Sheet`.

## Compliance carried verbatim (the constraints test enforces most; the rest is on you)

- No medicine is named anywhere, including fixtures, placeholders and test strings.
- No surge, priority, dynamic or time-pressure pricing vocabulary. One fee, £39, consults × `FEE`.
- No CQC number, no ratings, no named GPs (refs only), no testimonials, no headcount, no figure tuned to look like traction. Seeded fixtures stay round and visibly synthetic.
- Controlled-drug wording scoped to Schedule 2 and 3.
- The £39 never implies the medicine is included.
- No algorithmic urgency or triage score is displayed anywhere, including to the admin — governance shows counts of escalations, not scores.
- Pre-acceptance offer data is presenting complaint, age band and consent only.
- No notes editor, no prescribing UI, no EHR features.
- No shift booking, rota or calendar on the doctor surface.
- The ribbon on every screen; noindex on every route.

## Accessibility

Floor is the landing page's level: labelled controls, `:focus-visible` on everything, `aria-live` regions. Required here: the offer countdown is announced, not merely drawn; the availability control is a real `Switch` with `aria-checked` and a text label; every `Table` has `<caption>` or `aria-labelledby`, `<th scope>`, and no status conveyed by colour alone; the `Sheet` nav traps focus and returns it; the state jumper is skippable. Keyboard-walk the entire offer → consultation → complete path and the full onboarding without a mouse and say so in the report.

## Tests

- `preview/tests/units.test.mjs` → `tests/lib/*.test.ts`: import-path change only for the ported modules. Every one of the 59 that touches a ported module must still pass.
- `preview/tests/structure.test.mjs` → `tests/doctor.test.tsx`, `tests/admin.test.tsx`: rewritten against rendered components with Testing Library. Keep the assertions, in particular: every doctor screen/state is reachable by URL; the doctor surface offers availability, not a schedule; the ribbon is on every route; blank mode renders dashes and empty states; seeded mode renders the fixtures; the offer shows only the three permitted fields; `indemnity-expired` disables the online control; the four failure counters are on the floor; the two business numbers are shown against their assumptions.
- `tests/constraints.test.ts`: unchanged, and it must pass over the new code. Add the pre-acceptance-fields assertion and a "no `schedule`/`rota`/`calendar` route" assertion.
- `tests/headers.test.ts`: `/doctor/*` and `/admin/*` noindex.
- Reducer tests for `SessionProvider` and `OnboardingProvider`: every transition in the table above, including the illegal ones (cannot go offline mid-consultation; cannot go online with expired indemnity).

## Verify before you report

1. `npm test`, `npm run typecheck`, `NEXT_PUBLIC_SITE_URL=http://localhost:3000 npm run build` pass. Check the build output: `/` must not have grown by more than a few KB — the app shell and fixtures must not be in its bundle.
2. Screenshot **every** route and **every** URL-addressable state, in both `?data=seeded` and blank mode, at 1440px and 390px, per the Verifying changes section of `CLAUDE.md`. That is roughly 30 doctor screens × 2 modes × 2 widths and 4 admin screens × 2 × 2. Look at all of them. For each, confirm: ribbon present; no figure that should be a dash is a number in blank mode; nothing red/amber/green; no borders on cards; no hex leaked; nothing overflows horizontally at 390.
3. Walk the happy path by keyboard only and by mouse only, seeded, and confirm the earnings figure on `/doctor` and `/doctor/earnings` changed by exactly £39 after one completed consultation.
4. Load `/doctor` and `/admin` with JavaScript disabled: the shell, headings, ribbon and empty states render; nothing throws.
5. `grep -rn "dark:\|oklch\|hsl(" app components lib` returns nothing. `grep -rin "schedule\|rota\|calendar" app/(app)/doctor` returns nothing.
6. Open `/dev/ui` and confirm every component you added or restyled appears there.

## Docs to update

- `CLAUDE.md`: a **Dashboards** section — routes, providers, the placeholder rules in two sentences, the state jumper, "fixtures are the only data and they are round on purpose", the severity-without-colour rule, the rota rule, the Semble rule.
- `DESIGN.md`: the table-divider exception and any new component variant you introduced.
- `docs/superpowers/specs/2026-08-28-react-migration-design.md`: a dated addendum — milestones 3 and 4 done except `preview/` deletion, which waits on the patient port.
- `preview/README.md`: a note at the top that the doctor and admin surfaces now live in the app and `preview/doctor.html` / `admin.html` are reference only.

## Report

List: routes built; components added to `ui/` and `app/`; what ported unchanged; every place the prototype's content or behaviour was changed and why; the count of screenshots taken and every visual issue found and fixed; any screen where a `DESIGN.md` rule, a shadcn default and the prototype spec conflicted and how you resolved it; and anything the prototype spec's five decisions can no longer be settled by, if you had to compromise one. Do not report "professional" — report what you checked.
