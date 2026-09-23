# Doctor and Admin Surfaces — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. On execution, copy this file to `docs/superpowers/plans/2026-09-02-doctor-admin-surfaces.md` (Task 1) so it lives with the other plans.

**Goal:** Port the doctor and admin surfaces of the Dr Quick prototype from `preview/doctor.html`, `preview/admin.html` and `preview/js/*` into the Next.js 16 app as real routes under `/doctor/**` and `/admin/**`, built only from `components/ui/`, fixture-driven, blank by default, ribboned on every screen, with the preview's tests carried into Vitest.

**Architecture:** Two route groups, `app/(app)/doctor` and `app/(app)/admin`, each with a layout that mounts its own client providers and one shared `AppShell` (shadcn `Sidebar` + top bar + prototype ribbon + development state jumper). Session and onboarding are pure reducers seeded from the pathname, so every state is a URL; the credential record drives the four gates through `alerts.ts`; the data mode is provider state seeded from `?data=seeded` and re-stamped onto the URL after navigation. The seven pure preview modules port to `lib/` with types and their unit tests. Every figure goes through `shown()` or `live()`.

**Tech Stack:** Next.js 16 App Router (static routes, `generateStaticParams` for the two catch-alls), React 19, TypeScript strict, Tailwind v4 `@theme`, shadcn/ui on the unified `radix-ui` package, `lucide-react` (dashboards only), Vitest + React Testing Library + jsdom, puppeteer-core with the cached chrome-headless-shell for screenshots.

**Spec:** `plans/006-doctor-admin-surfaces-prompt.md` (this plan implements it in full), arguing from `docs/superpowers/specs/2026-08-28-react-migration-design.md` (milestones 3 and 4, minus deleting `preview/`) and `docs/superpowers/specs/2026-08-27-role-dashboards-prototype-design.md` (the five decisions). `CLAUDE.md`, `DESIGN.md` and `PRODUCT.md` are binding.

## Context

The React migration's milestone 1 (landing page + API) and the shadcn foundation (`plans/005`) are done; the foundation is in the working tree but **uncommitted** (`components/ui/`, `app/dev/`, `hooks/`, `components.json`, `lib/utils.ts`, and edits to `globals.css`, `CLAUDE.md`, `DESIGN.md`, `next.config.ts`, the tests and `preview/`). The doctor and admin prototypes still live only as vanilla-JS pages in `preview/`, on the retired palette, reachable by hash, with a rail that jumps to any state. This plan gives them real routes, the component layer, the TechMed tokens, typed fixtures and a Vitest suite, while keeping every prototype honesty guard: blank by default, ribbon on every screen, noindex, no invented traction. The patient surface (milestone 2) is not part of this plan and `preview/` is not deleted.

## Global Constraints

Every task's requirements implicitly include these. Exact values are copied from the spec, `CLAUDE.md` and `DESIGN.md`.

- **Palette:** only the sixteen `@theme` colours in `app/globals.css` (`surface #F7F9FB`, `surface-mid #ECEEF0`, `fill #E6E8EA`, `fill-hover #E0E3E5`, `white`, `ink #0F172A`, `ink-2 #434657`, `outline #747688`, `rule #E2E8F0`, `band #0F172A`, `band-ink-2 #94A3B8`, `primary #0047FF`, `primary-strong #0035C5`, `primary-lift #B9C3FF`, `success #10B981`, `error #EF4444`). No hex, no `bg-[rgb(…)]`, no `oklch()/hsl()`, no `dark:` — `tests/constraints.test.ts` scans `app/`, `components/`, `lib/` and must stay green. Never NHS Blue `#005EB8`.
- **Severity without a fourth colour:** fill, weight, border, position. `success` and `error` appear only on status `Badge`s and the offer countdown's final five seconds. Never red/amber/green; never a hue alone.
- **Typography:** Geist (`font-display`) for headings, stat numerals (`numeric-data`, tabular) and table headers; Inter for everything read. Tables at `text-body` (15px), secondary cells `text-fine` (13px). Display tracking never tighter than `-0.04em`.
- **Cards** are borderless with `shadow-card`; `variant="band"` is for the one payoff or the one hard stop on a screen, never two.
- **Breakpoints:** `560 / 900 / 1080` only — `max-phone: / max-cols: / max-forms:` on pages, `sm: / md: / lg:` inside `components/ui/`. The sidebar becomes a `Sheet` below 900 (`hooks/use-mobile.ts`).
- **Motion:** the arrival grammar (`data-reveal`, 16px rise, 70ms stagger capped at 300ms) fires on a route's first paint only — never on tab switches, filter changes or data ticks. Countdown and timers are functional motion and stay as static numerals under `prefers-reduced-motion`. Overlays use the retimed `animate-in/out` already in `components/ui`. Nothing else moves. Live values update without animating.
- **Charts:** inline SVG from `lib/charts.ts` geometry at the container's measured width; 2px strokes; `stroke-primary` / `stroke-ink-2`; no gradients, no fills under lines, no Recharts, no animation on update.
- **Placeholder rules:** `shown(v)` is an em dash until `?data=seeded`; `live(v)` shows what this session produced; zero is a dash; lists render a written empty state. The £39 fee, the restricted-items register and the credential labels render in both modes. A blank-mode screen showing a fixture figure is a bug of the highest severity.
- **Compliance (verbatim, tested):** no medicine named anywhere including fixtures and test strings; no surge/priority/dynamic/time-pressure pricing vocabulary; one fee £39, earnings always consults × `FEE`, no per-hour figure; no CQC number, no ratings, no named GPs (refs `GP-00n` only), no testimonials, no headcount, no figure tuned to look like traction (seeded fixtures stay round); controlled-drug wording scoped to Schedule 2 and 3; £39 never implies the medicine is included; no urgency or triage score anywhere; pre-acceptance offer data is presenting complaint, age band and consent only; no notes editor, no prescribing UI, no EHR features; no shift booking, rota or calendar on the doctor surface (the words `schedule`, `rota`, `calendar` may not appear under `app/(app)/doctor` or `components/doctor`); ribbon on every screen; noindex on every route.
- **Every primitive is `components/ui/`.** No new `.btn`/`.card`/`.tag` CSS classes; compose in `components/app/`, `components/doctor/`, `components/admin/` with `cn()`. A missing primitive is added with `npx shadcn@latest add <name>`, restyled per the checklist in `CLAUDE.md`, and added to `/dev/ui` before a screen uses it.
- **Icons:** `lucide-react` at `strokeWidth={2}` and 20px (the Button/Sidebar defaults) on the dashboards only. No emoji, no icon fonts. Do not import `CalendarIcon` (or any `*Calendar*`) anywhere under the doctor surface.
- **No global store.** The admin surface cannot read the doctor's session and vice versa. Providers mount in each surface's layout, never the root layout; the `/` bundle must not grow by more than a few KB and must not contain `SidebarProvider`, `sonner`, the reducers or the fixtures.
- **Static:** every route is statically renderable; the two catch-alls export `generateStaticParams` and `dynamicParams = false`. No `useSearchParams` anywhere (it would bail the static shell to client rendering); query state is read from `window.location` after mount.
- **Accessibility floor:** labelled controls, the global `:focus-visible` outline on everything, `aria-live` regions; the availability control is a real `Switch` (`role="switch"`, `aria-checked`) with a text label; every `Table` has a `<caption>` (visually hidden is fine) and `<th scope>`; no status by colour alone; the `Sheet` nav traps and returns focus (Radix does this); the state jumper is a `<nav>` landmark placed last in the DOM.
- **Tests:** Vitest; component tests carry `// @vitest-environment jsdom` on line 1 and import `@testing-library/jest-dom/vitest`; ported unit tests keep `node:assert/strict` so the port is an import-path change. `npm test`, `npm run typecheck` and `NEXT_PUBLIC_SITE_URL=http://localhost:3000 npm run build` must pass at the end of every task that says so.
- **Git:** work on `main` in `/Users/liam/development/DrQuick/website` (the git root is `~`; paths in `git add` are relative to the website directory). Commit after every task with the message given. Commit messages end with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- **Screenshot tooling** (from `~/.claude/projects/-Users-liam/memory/reference_drquick_screenshot_tooling.md`): the chrome-devtools MCP has no Chrome; use `puppeteer-core` from `~/.npm/_npx/7d92d9a2d2ccc630/node_modules/puppeteer-core` (load via `createRequire` from an `.mjs` script) with `executablePath` = `~/.cache/puppeteer/chrome-headless-shell/mac_arm-152.0.7977.54/chrome-headless-shell-mac-arm64/chrome-headless-shell`. A Next dev server for this directory may already be running on :3000 from another session — reuse it. Add the `in` class to every `[data-reveal]` before a full-page capture. Wait 4s+ after an edit before an "after" capture.

## Decisions taken in this plan (recorded so the executor does not relitigate them)

1. **Gates are selected by URL, rendered from the record.** `/doctor?gate=verification-pending|verification-rejected|indemnity-expired|revalidation-due` makes the corresponding `GATE_RECORDS[gate]` fixture the GP's credential record; `gateFor(record)` in `lib/alerts.ts` (new, pure, tested) derives which gate to render. With no query, the record is `GP-002`'s and no gate renders (its indemnity is *expiring*, not expired, so the dashboard shows the blocking alert instead). The migration spec says gates are "rendered by `/doctor` itself from the GP's credential record"; the query only chooses whose record is on screen, which is what the rail did.
2. **Query state persists by re-stamping.** `DataModeProvider` (`?data=seeded`), `DoctorProvider` (`?gate=`) and `StateJumper` (`?jumper=1`) each hold their value in provider state, read it from `window.location.search` once after mount, and `history.replaceState` it back onto the URL after every client navigation (`usePathname` change) so a reload or a copied link keeps it. Internal links stay plain. The state jumper's links are ordinary `<a href>` full loads (it is a dev tool), which is also how a gate or a mode is changed.
3. **Session and onboarding state live in the doctor layout**, seeded from `usePathname()` at first render (verified against Next 16.3.3: `usePathname` renders to HTML during prerender with no Suspense boundary, so the static shell for `/doctor/session/offer` already shows the offer and the client's first render agrees). Two effects keep URL and state in step **without fighting**: the reducer carries a `nav` counter that only non-`jump` actions increment when they change the screen; an effect keyed on `state.nav` does `router.replace(sessionHref(screen) + location.search)` while on the session route (or `router.push` when the dashboard tile passed `{ navigate: true }`); an effect keyed on `pathname` dispatches `jump` only when the URL names a *different* screen, and `jump` never touches `nav`. The bare `/doctor/session` and `/doctor/onboarding` paths mean "no opinion" (`sessionScreenFromPath` → `null`), so an in-app link to the bare path can never knock an online GP offline. The page components under the catch-alls render nothing from `params`; they exist so every state is a static URL (`generateStaticParams` returns `{ state: [] }` for the bare route — `{}` throws E618 at build).
4. **The offer arrives on a timer, and the button stays.** While `online-idle`, after `OFFER_AFTER_MS = 8000` in seeded mode an offer arrives (`offer`, or `offer-consent-refused` on every second offer of the session); in blank mode nobody is waiting, so the same timer lands on `no-patients-waiting`. Going offline first clears the timer (effect cleanup). "Simulate an offer" remains on the dashboard and the idle screen as the prototype affordance it was. **The 45-second window is wall-clock**: `offerExpiresAt` is a timestamp, `tickOffer { now }` derives `offerRemaining`, so a hidden tab cannot stretch the window — the offer really does move to the next GP. `tickCountdown` ports for its unit test and is not used by the reducer.
5. **Ratings are removed.** `DOCTOR_DASHBOARD.ratingAverage` / `ratingCount` and the rating tile go; "How you are doing" shows acceptance rate and average consultation length only (spec: no ratings, ever). Recorded as a content change.
6. **Duplicated figures are derived once** in `lib/fixtures.ts`: `DOCTOR.shift.patientsWaiting/gpsOnline/gpsNeeded` come from `FLOOR`; `DOCTOR.credentialsVerified/credentialsTotal` and `daysToRevalidation` come from GP-002's record (7 of 7, 120 days — the preview typed 5 of 5 and 312); `DOCTOR.consultsCompleted` comes from `PRESCRIBING` (40, not 32) and `earningsToDate` from it (£1,560, not £1,248); `BUSINESS.revenue` is `consults × FEE`; `GOVERNANCE.breakGlass` is `BREAK_GLASS_LOG.length`; the payout run is `BUSINESS.consults × FEE`; `SKILLS` moves out of `doctor.js` into fixtures. Recorded as content changes.
7. **Four small fixtures are added** because the prototype spec names the panels and the preview never drew them: `BREAK_GLASS_LOG` (one row, with a reason), `AUDIT_LOG` (three rows), `GOVERNANCE.complaintResolutionDays = 5` and `GOVERNANCE.reachedEmergencyScreen = 2`, and the derived `PAYOUT_RUNS`. All round, all synthetic, none a traction figure. Applications in verification are derived (GPs with any `pending` credential), not typed.
8. **`alerts.ts` gains a `rejected` branch** (`tone: 'blocking'`, sentence "… could not be verified.") because the onboarding statuses include `rejected` and no preview fixture ever produced one. Everything else in the seven ported modules is untouched.
9. **`live.ts` stays as it is; pausing lives in a hook.** `hooks/use-live-interval.ts` wraps `startInterval`, reads `fn` through `useEffectEvent` (React 19.2 — record `"react": "^19.2.0"` as a hard floor), clears on unmount, stops on `document.hidden` and on return ticks once immediately then restarts. Every tick carries `Date.now()`, and every elapsed figure (time online, the consultation clock, the offer window) is computed from a stored timestamp, so a paused tab resumes with the right figure. All dashboard intervals are 1000ms, so `startInterval`'s reduced-motion rule never bites. Timers that must outlive a page (the offer arrival, the offer tick, the shift clock) live in `SessionProvider`; the floor's tick lives in `LiveFloor` and stops when the page unmounts.
10. **Charts render through React, not `innerHTML`.** `svgBars`/`svgLines`/`mountChart` port verbatim for the unit tests; `components/app/BarChart.tsx` and `LineChart.tsx` draw JSX from `barGeometry`/`linePoints`/`toPath`/`labelStride` inside a `ChartFrame` that measures width with `ResizeObserver`. The demand chart's `area: true` fill is dropped (no fills under lines).
11. **Checkbox is installed** (`npx shadcn@latest add checkbox`) for the clinical-skills step, restyled, and added to `/dev/ui`. `components/ui/table.tsx` gains an opt-in `stack` prop (rows collapse to labelled blocks under `max-cols:`); nothing else in `ui/` changes.
12. **Alerts never use the destructive variant.** `blocking` and `act` alerts are `variant="accent"` (primary icon), `watch` is `default`; severity is order, weight and the blocking note "You cannot take a consultation once this lapses." — matching the preview, where the icon went blue for both.
13. **The dashboards get their own arrival component, and "first paint" means the surface's first paint.** `.js [data-reveal] { opacity: 0 }` in `globals.css` is global and only `LandingBehavior` (mounted on `/` alone) ever adds `.in`, so a `data-reveal` on `/doctor` would be permanently invisible with JavaScript on. `components/app/Arrival.tsx` (client, null-render, mounted once in `AppShell`) stamps `--d` with `staggerDelay()` from `lib/reveal.ts` on `[data-reveal]` children of each `[data-stagger]` group (the landing convention — never every `data-reveal` on the page), and after one 60ms frame adds `.in` to everything present **and, in the same tick,** sets `data-arrived="true"` on the `[data-surface]` shell. One authored rule, `.js [data-arrived] [data-reveal]:not(.in) { opacity: 1; transform: none; transition: none; }`, makes anything mounted later (a session transition, a tab, a filtered list, the seeded flip) render visible and still without cancelling the first-paint transition of what already has `.in` — the preview's `is-first-paint` behaviour. StrictMode cleanup clears the timer and deletes `data-arrived` so the second run re-arms. `data-reveal` goes only on `PageHeader`'s h1 and a route's first tile row, never on tables, charts, tab panels or mode-dependent content; a `data-reveal` element whose `className` changes after mount loses its DOM-added `.in` and simply snaps visible.
14. **No-JS phone navigation is a `<noscript>` list.** `useIsMobile()` is `false` on the server, so below 900px the desktop sidebar is `hidden` and the `Sheet` never renders without JavaScript. `TopBar` therefore carries `<noscript><nav aria-label="Sections" class="md:hidden">…plain links…</nav></noscript>` so the shell is navigable at 390 with scripts off and does not duplicate the server-rendered rail at 1440. The mobile `Sheet` hides its default close button (`sidebar.tsx:195`), so `SidebarHeader` renders a visible `SheetClose` ("Close navigation", ghost icon button) when `useSidebar().isMobile`.
15. **The last onboarding step is `done`** (`/doctor/onboarding/done`), as in the spec's route table; the preview id `onboarding-done` survives only as the jumper label "Done". **Every `/doctor/session/*` and `/doctor/onboarding/*` route is a flow**: `SidebarProvider open={open && !flow}` collapses the rail (offcanvas, trigger kept) there; `DOCTOR_DASH_SCREENS` is `['dashboard','earnings','profile']` only — `offline`, `online-idle` and `no-patients-waiting` leave the preview's dashboard area, as the spec places the whole session in the collapsed shell. The rail's 200ms width transition on that collapse is the shell's one motion beyond the arrival grammar and is recorded in DESIGN.md.
22. **Band census, one per screen, never two.** `/doctor` dashboard → the availability tile only (the preview's `card--fill`); `/doctor?gate=indemnity-expired` → the gate card only; `/doctor/earnings` → the "Next payout" tile only; `/admin` → the cover-gap card, `variant="band"` iff `seeded && FLOOR.gpsOnline < FLOOR.gpsNeeded`, and the "Right now" tile is white (the preview filled it; the spec gives the band to the gap). `/doctor/profile`, every onboarding step, every session screen, governance, supply and business → none. Supply's expired *rows* are band-filled table rows, not cards; the video frame is `bg-fill`. A test asserts `≤ 1` band card on every route.
23. **Status badges are an ink ramp, not a primary accent.** `pending` → `secondary` (fill / ink-2); `expiring` → `secondary` with `bg-ink/15 text-ink` (DESIGN.md's 15%-fill chip rule with ink as the colour); `valid` → `success` "Verified"; `expired` and `rejected` → `destructive`; `null` (blank mode) → `secondary` "—" with `aria-label="Not submitted"`. Inside a band-filled row every badge is `bg-white/15 text-white` (the `#EF4444`-on-band chip fails AA at 12px once its own 15% fill lightens the ground); the row is the severity and the badge carries only the word. Band rows also set `hover:bg-band`, and the expiring row's `border-2 border-ink` uses `!` so `TableBody`'s `[&_tr:last-child]:border-0` cannot strip it.
24. **Chart marks are solid tokens.** Non-emphasised bars `fill-outline` (`#747688`, 4.5:1 on white), today's bar `fill-primary`; series one `stroke-primary`, series two `stroke-ink-2` dashed `5 4`, both 2px; baseline `stroke-rule`; axis text `fill-ink-2` in Geist at 11px. Legend swatches match the marks (`primary` solid, `outline` solid, `ink-2` drawn as a 16×2 dashed line) and the legend renders only when the chart does. Below 560px `LineChart` draws `sets[0]` only and the legend drops its second item. Opacity modifiers (`bg-primary/15`, `bg-white/15`, `bg-ink/40`) are a token at an alpha, never a data mark, never stacked.
25. **The ribbon is a note, not a live region**, in the product's label-caps face: `<p role="note" data-slot="ribbon" className="sticky top-0 z-20 bg-band px-4 py-2 font-display text-[11px] font-semibold uppercase leading-[1.2] tracking-[.05em] text-white">`. It sits above `SidebarProvider` in normal flow; the fixed rail is offset with inline `style={{ top: 'var(--ribbon-h)', height: 'var(--shell-h)' }}` (tailwind-merge does not resolve `top-*` against `inset-y-0`). z-order: ribbon 20, rail 10, jumper 30, Sheet/Dialog 50. The jumper alone is `font-mono`.
26. **Dashboard type sizes are DESIGN.md's app ramp, not the landing hero's.** `@theme` gains `--text-headline: 2rem` (line-height 1.2, tracking -.04em) and `--text-headline-sm: 1.5rem` (1.2, -.03em); `PageHeader`'s h1 is `text-headline max-phone:text-headline-sm`; section h2s are `text-xl leading-[1.3] font-semibold tracking-[-.02em]` (= `CardTitle` = headline-md); card titles that were `h2` in the preview render `<CardTitle role="heading" aria-level={2}>`. Stat numerals: `size="lg"` `font-display text-4xl font-bold tracking-[-.03em] leading-none tabular-nums`, `size="sm"` `text-2xl font-semibold tracking-[-.02em] leading-none tabular-nums`; the em dash sits in the same classes.
27. **The countdown announces four times, drains linearly, and hands focus to the offer.** On arrival at an offer screen focus moves to the `h1`; a visually-hidden `aria-live="assertive" aria-atomic="true"` region says "45 seconds to accept" on arrival, then "30 / 15 / 5 seconds left to accept" and nothing in between (the preview's per-second assertive node was the defect); the visible numerals are `aria-hidden`; `<Progress aria-label="Time left to accept" getValueLabel={() => \`${remaining} seconds left\`}>` drains with `[&_[data-slot=progress-indicator]]:duration-1000 [&_[data-slot=progress-indicator]]:ease-linear` so each step lands as the next tick fires (reduced motion zeroes it to discrete steps — the spec's static numerals). Numerals turn `text-error` at ≤ 5s only.
28. **Alerts are a list, with the preview's icons.** The "Before you go online" alerts render inside `<div role="list">` with `role="listitem"` on each `Alert` (its default `role="alert"` would make three assertive live regions); `TriangleAlertIcon` for `blocking`, `ClockIcon` for `act` and `watch`, `strokeWidth={2}`. When the gate is `revalidation-due` the top banner uses the preview's copy (`doctor.html:518-521`) and the list filters out `key === 'revalidation'` so the sentence does not appear twice.
29. **Copy the port changes, because the preview's words made claims the spec forbids:** "Included for shifts booked through Dr Quick. No paperwork." → "Included for every consultation you take through Dr Quick. No paperwork." (a GP does not book shifts); "most GPs hear back within two working days" (onboarding done, verification-pending) → "We'll email you once every check clears." (a service-level claim for a service that has not run). Both are listed in the report.
30. **Fixture details settled:** `PAYOUT_RUNS[0].gps` is `PRESCRIBING.filter(gp => gp.consults > 0).length` (3 — the run pays 120 consults that PRESCRIBING attributes to three GPs), its status is `'Due'` (never "Scheduled"), and both logs use `actor`. `DOCTOR.consultsCompleted` is derived from `PRESCRIBING` (GP-002: 40) so "consultations to date" and governance's per-prescriber count cannot disagree; `earningsToDate` is therefore £1,560. `FEE = 39` is the patient price and the spec mandates it as the GP's unit; no new copy says a GP *earns* £39, and the conflict with PRODUCT.md's £24–33 is listed in the report.
31. **The indemnity fork stays symmetric**: two white `Card`s of equal size and structure; the only asymmetry is `Button` default ("Use Dr Quick cover") versus `secondary` ("Upload certificate") and the honest friction of the file and expiry fields. **The Semble dialog keeps the friction visible**: title "Semble opens in another window", description "Notes, prescribing and the consultation outcome are written in Semble during the call. Dr Quick keeps the video, the timer and the payment, and never holds the clinical record.", footer `DialogFooter showCloseButton` only — no primary action, no field.
32. **Stable markers for tests and the screenshot script:** every session, onboarding and gate root carries `data-screen="<id>"`; `StatTile` marks its numeral `data-slot="stat-value"` and its assumption line `data-slot="stat-against"`; `Facts` marks its `<dl>` `data-slot="facts"`; `StatusBadge` carries `data-status`; `Countdown` marks its numerals `data-slot="countdown-value"`; the consultation clock is `data-slot="consult-clock"`; `DataModeProvider` stamps `document.documentElement.dataset.figures = mode` after mount (the port of `markDocument`, renamed so the landing page's `[data-mode="gp"]` rules can never match), and `AppShell` carries `data-arrived="true"` after arrival — server HTML has neither, so they double as the hydration signal.
16. **Fixture arithmetic is the preview's, not the history report's:** `dailyConsults` = `1,2,0,3,2,1,2,0,2,1,3,1,2,3` → fortnight **23**, last seven **12**, payout **£468**, fortnight earnings **£897**, meter **52%**, payout note "12 consultations at £39 each, by bank transfer.", earnings note "5 most recent of 12".
17. **Wording kept from the preview where the spec paraphrased it:** "Average consultation" (the fixture is `averageConsultMinutes`; "median" would be a different claim); the idle screen's four tiles are `GPs online / Patients waiting / Time online / Earnings today`; the video frame reads "Patient video — not recorded" (the spec's wording, one change from the preview's "Patient video"). The dashboard's primary action stays "Simulate an offer".
18. **Two preview defects are fixed, not reproduced:** blank-mode tables render their empty-state row (the preview's `listOr(…, '')` fallback was dead and put a `<p>` inside `<tbody>`); every static placeholder is `DASH` (U+2014), never the preview's U+2013.
19. **The `schedule`/`rota`/`calendar` guard is scoped** to route segment names under `app/(app)/doctor` and to text under `app/(app)/doctor` + `components/doctor`; the governance register's compliance copy ("Schedule 2 and Schedule 3 controlled drugs …") lives under `components/admin` and is untouched.
20. **`booking.ts` ports whole** (all eleven exports, for the patient milestone and its sixteen unit tests); the doctor surface uses only `formatClock` (consultation timer) and `nextConsultationId` (the session record's reference). `matchGp`, `outcomeFor`, `consultationRecord` are ported and unused here — the spec's clause is carried, and the report says so.
21. **Two untested ported functions get tests:** `svgBars` (draws one rect per datum, the emphasised one flagged) and `startInterval` (returns a stop that clears; under reduced motion a sub-second interval runs once).

## File Structure

```
website/
├── app/(app)/
│   ├── doctor/
│   │   ├── layout.tsx                      server: metadata.robots noindex; <DoctorProviders><AppShell surface="doctor">
│   │   ├── page.tsx                        /doctor: <DoctorHome /> (dashboard or gate)
│   │   ├── earnings/page.tsx
│   │   ├── profile/page.tsx
│   │   ├── onboarding/[[...step]]/page.tsx generateStaticParams over ONBOARDING_STEPS; <OnboardingFlow />
│   │   └── session/[[...state]]/page.tsx   generateStaticParams over SESSION_SCREENS; <SessionScreen />
│   └── admin/
│       ├── layout.tsx                      server: metadata.robots noindex; <DataModeProvider><AppShell surface="admin">
│       ├── page.tsx                        /admin: <LiveFloor />
│       ├── governance/page.tsx
│       ├── supply/page.tsx
│       └── business/page.tsx
├── lib/
│   ├── placeholder.ts   PORT  DASH, setDataMode, dataMode, isSeeded, live, shown, seed, emptyState, listOr, markDocument, dataModeFromLocation
│   ├── live.ts          PORT  formatEta, tickCountdown, tickQueue, startInterval
│   ├── charts.ts        PORT  barGeometry, linePoints, toPath, labelStride, svgBars, svgLines, mountChart
│   ├── shell.ts         PORT  activeNav, areaOf (+ types)
│   ├── booking.ts       PORT  whole file (SECONDS_PER_PLACE, COMPLAINTS, createBooking, waitEstimate, isEligibleGp, matchGp, outcomeFor, endedEarly, nextConsultationId, formatClock, consultationRecord)
│   ├── alerts.ts        PORT+ credentialAlerts, alertSentence, CREDENTIAL_LABELS (exported), CREDENTIAL_KEYS, gateFor (new), types
│   ├── fixtures.ts      PORT+ every export of fixtures.js typed, minus ratings, plus SKILLS, GATE_RECORDS, MY_RECORD, BREAK_GLASS_LOG, AUDIT_LOG, PAYOUT_RUNS, DEMAND_BY_HOUR, applicationsInVerification()
│   ├── format.ts        NEW   money, minutesLabel, daysLabel, percent
│   ├── data-mode.tsx    NEW   DataModeProvider, useDataMode, useFigures, usePersistedQuery
│   ├── earnings.ts      NEW   earningsFor(): every earnings figure derived once, session records included
│   ├── session.ts       NEW   SessionScreen, SESSION_SCREENS, SessionState, SessionAction, sessionReducer, initialSession, sessionScreenFromPath, OFFER_WINDOW_SECONDS, OFFER_AFTER_MS
│   └── onboarding.ts    NEW   OnboardingStep, ONBOARDING_STEPS, OnboardingState, OnboardingAction, onboardingReducer, initialOnboarding, onboardingStepFromPath, GMC_PATTERN
├── hooks/
│   └── use-live-interval.ts NEW  useLiveInterval(fn, ms, active)
├── components/
│   ├── ui/checkbox.tsx          NEW (CLI + restyle)
│   ├── ui/table.tsx             MOD  `stack` prop on Table, `label` prop on TableCell
│   ├── app/                     shared by both surfaces
│   │   ├── Ribbon.tsx, AppShell.tsx, TopBar.tsx, SurfaceNav.tsx, nav.ts, StateJumper.tsx, jumps.ts
│   │   ├── StatTile.tsx, EmptyState.tsx, PageHeader.tsx, Facts.tsx
│   │   ├── ChartFrame.tsx, BarChart.tsx, LineChart.tsx, ChartLegend.tsx
│   │   ├── StatusBadge.tsx, CredentialMatrix.tsx, Stepper.tsx, Countdown.tsx
│   ├── doctor/
│   │   ├── DoctorProviders.tsx, DoctorProvider.tsx, SessionProvider.tsx, OnboardingProvider.tsx
│   │   ├── AvailabilityControl.tsx, DoctorHome.tsx, Dashboard.tsx, Gate.tsx, Earnings.tsx, Profile.tsx
│   │   ├── OnboardingFlow.tsx, steps/{Register,Identity,Credentials,Indemnity,Skills,Done}.tsx
│   │   ├── SessionScreen.tsx, session/{Offline,OnlineIdle,NoPatientsWaiting,Offer,Consultation,Complete,Terminal}.tsx, SembleDialog.tsx
│   └── admin/
│       ├── DataModeSwitch.tsx, LiveFloor.tsx, Governance.tsx, Supply.tsx, Business.tsx
├── app/dev/ui/gallery.tsx       MOD  sections for Checkbox, stacked Table, StatTile, StatusBadge, CredentialMatrix, Stepper, Countdown, charts, Ribbon, StateJumper, EmptyState
├── scripts/screenshot-dashboards.mjs  NEW  the matrix capture (Task 27)
└── tests/
    ├── lib/{placeholder,live,charts,shell,booking,alerts,fixtures,format,earnings}.test.ts
    ├── session-reducer.test.ts, onboarding-reducer.test.ts
    ├── data-mode.test.tsx, use-live-interval.test.tsx
    ├── app-components.test.tsx (StatTile, EmptyState, StatusBadge, Stepper, Countdown, Ribbon, StateJumper, CredentialMatrix)
    ├── charts-components.test.tsx (ChartFrame, BarChart, LineChart, ChartLegend)
    ├── app-shell.test.tsx
    ├── doctor.test.tsx, admin.test.tsx
    ├── constraints.test.ts  MOD, headers.test.ts  MOD
```

## Interface contract

Names, types and copy every task must use. A task's implementer sees only their task; this section is how they match their neighbours. Frozen before Task 2 starts; a task that needs to change it edits this section in the same commit.

### `lib/fixtures.ts` (Task 3)

```ts
export type CredentialStatus = 'valid' | 'expiring' | 'expired' | 'pending' | 'rejected';
export type Credential = { status: CredentialStatus; daysRemaining: number | null };
export type CredentialKey = 'gmc' | 'licence' | 'cct' | 'dbs' | 'rightToWork' | 'indemnity' | 'revalidation';
export type CredentialRecord = Record<CredentialKey, Credential>;
export type Gp = { ref: string; online: boolean; credentials: CredentialRecord };
export type GateId = 'verification-pending' | 'verification-rejected' | 'indemnity-expired' | 'revalidation-due';
export type SkillId = 'general-adult' | 'minor-illness' | 'womens-health' | 'mental-health' | 'paediatrics' | 'dermatology';
export type Skill = { id: SkillId; label: string; defaultOn: boolean };
export type RecentConsult = { id: string; when: string; ageBand: string; minutes: number; outcome: string };
export type DailyConsults = { label: string; consults: number };
export type DemandHour = { hour: string; waiting: number; gps: number };

export const TODAY = '2026-08-28';
export const FEE = 39;
export const PRICE, PATIENT, QUEUE, OFFER, OFFER_CONSENT_REFUSED, GPS, FLOOR, PRESCRIBING, BUSINESS,
             PATIENT_ACCOUNT, CONSULTATIONS, PRESCRIPTIONS   // unchanged values, typed
export const DOCTOR = {
  ref: 'GP-002', earningsToDate: 32 * FEE /* 1248 */, consultsCompleted: 32,
  credentialsVerified: <count of MY_RECORD statuses that are 'valid' | 'expiring'> /* 7 */, credentialsTotal: 7,
  daysToRevalidation: MY_RECORD.revalidation.daysRemaining /* 120 */, revalidationDueInDays: 18,
  shift: { gpsOnline: FLOOR.gpsOnline, gpsNeeded: FLOOR.gpsNeeded, patientsWaiting: FLOOR.waiting, minutesOnline: 42, earningsToday: 3 * FEE /* 117 */ },
};
export const MY_RECORD: CredentialRecord = GPS.find(gp => gp.ref === DOCTOR.ref)!.credentials;
export const GATE_RECORDS: Record<GateId, CredentialRecord> = {
  'verification-pending': GPS[3].credentials,                                              // GP-004
  'verification-rejected': { ...GPS[3].credentials, dbs: { status: 'rejected', daysRemaining: null } },
  'indemnity-expired': GPS[2].credentials,                                                 // GP-003
  'revalidation-due': { ...MY_RECORD, revalidation: { status: 'expiring', daysRemaining: DOCTOR.revalidationDueInDays } },
};
export const SKILLS: Skill[] = [
  { id: 'general-adult', label: 'General adult medicine', defaultOn: true },
  { id: 'minor-illness', label: 'Minor illness', defaultOn: true },
  { id: 'womens-health', label: "Women's health", defaultOn: false },
  { id: 'mental-health', label: 'Mental health', defaultOn: false },
  { id: 'paediatrics', label: 'Paediatrics (age 5+)', defaultOn: false },
  { id: 'dermatology', label: 'Dermatology', defaultOn: false },
];
export const DOCTOR_DASHBOARD = { initials: 'GP', acceptanceRate: 0.86, averageConsultMinutes: 9, dailyConsults, demandByHour, offersToday, recent, payout };   // ratingAverage / ratingCount REMOVED
export const DEMAND_BY_HOUR = DOCTOR_DASHBOARD.demandByHour;
export const GOVERNANCE = { incidents: 2, safeguarding: 1, redFlagEscalations: 3, reachedEmergencyScreen: 2, complaints: 1, complaintResolutionDays: 5, breakGlass: BREAK_GLASS_LOG.length /* 1 */, restrictedRegister };
export const BREAK_GLASS_LOG = [{ when: '26 August, 21:14', who: 'Admin', record: 'C-0031', reason: 'Safeguarding concern raised by GP-002' }];
export const AUDIT_LOG = [
  { when: '28 August, 09:02', actor: 'System', action: 'Indemnity cover for GP-003 marked expired' },
  { when: '27 August, 16:40', actor: 'Admin', action: 'Restricted items register reviewed' },
  { when: '26 August, 21:14', actor: 'Admin', action: 'Break-glass access to C-0031' },
];
export const PAYOUT_RUNS = [{ period: DOCTOR_DASHBOARD.payout.period, date: DOCTOR_DASHBOARD.payout.date, gps: PRESCRIBING.filter(gp => gp.consults > 0).length, consults: BUSINESS.consults, amount: BUSINESS.consults * FEE, status: 'Due' }];   // Decision 30
export type Application = { ref: string; stage: string /* label of the first pending credential */ };
export function applicationsInVerification(gps: Gp[] = GPS): Application[];   // GPs with any pending credential
```

### `lib/alerts.ts` (Task 3)

```ts
export type AlertTone = 'blocking' | 'act' | 'watch';
export type CredentialAlert = { key: CredentialKey; label: string; status: CredentialStatus; daysRemaining: number | null; tone: AlertTone };
export const CREDENTIAL_KEYS: readonly CredentialKey[] = ['gmc','licence','cct','dbs','rightToWork','indemnity','revalidation'];
export const CREDENTIAL_LABELS: Record<CredentialKey, string>;   // the LABELS map from alerts.js, exported
export const STATUS_LABELS: Record<CredentialStatus, string> = { valid: 'Verified', expiring: 'Expiring', expired: 'Expired', pending: 'Pending', rejected: 'Rejected' };
export function credentialAlerts(credentials: Partial<CredentialRecord> | Record<string, Credential>, opts?: { warnWithinDays?: number }): CredentialAlert[];  // + rejected → 'blocking'
export function alertSentence(alert: Pick<CredentialAlert, 'label' | 'status' | 'daysRemaining'>): string;      // + rejected → `${label} could not be verified.`
export function gateFor(credentials: CredentialRecord): GateId | null;   // indemnity expired → 'indemnity-expired'; any rejected → 'verification-rejected'; any pending → 'verification-pending'; revalidation alert present → 'revalidation-due'; else null
```

### `lib/placeholder.ts`, `lib/live.ts`, `lib/charts.ts`, `lib/shell.ts`, `lib/booking.ts` (Task 2)

Same export names and semantics as the `.js` files, typed. `charts.ts` types: `Bar = { x: number; y: number; w: number; h: number; value: number }`, `Point = { x: number; y: number; value: number }`, `BarDatum = { label: string; value: number; emph?: 'true' | 'false' | 'accent' }`, `LineSet = { key: string; values: number[] }`. `shell.ts`: `activeNav(screenId: string, sectionOf?: Record<string,string>): string`, `areaOf(screenId: string, dashScreens: string[]): 'dash' | 'flow'`.

### `lib/format.ts` (Task 2)

```ts
export const money = (v: number) => `£${v.toLocaleString('en-GB')}`;
export const minutesLabel = (m: number) => `${m}m`;
export const daysLabel = (d: number) => `${d} days`;
export const percent = (r: number) => `${Math.round(r * 100)}%`;
```

### `lib/data-mode.tsx` (Task 4)

```tsx
export type DataMode = 'placeholder' | 'seeded';
export function usePersistedQuery(key: string): [value: string | null, set: (v: string | null) => void];
export function DataModeProvider({ children }): JSX.Element;      // 'use client'; mode from usePersistedQuery('data') === 'seeded'; stamps document.documentElement.dataset.figures = mode in an effect
export function useDataMode(): { mode: DataMode; seeded: boolean; setMode: (m: DataMode) => void };
export function useFigures(): { seeded: boolean; DASH: string; shown: <T>(v: T, f?: (v: T) => string) => string; live: typeof live; seedList: <T>(l: readonly T[]) => T[] };
```

`usePersistedQuery` — verified against Next 16.3.3's history patch (`app-router.js:233-306`): the patch is installed in AppRouter's own `useEffect`, which runs *after* child effects on the hydration commit, so a provider must never write to history during mount (a native `replaceState(null, …)` there strips `__NA` and Back to that entry dead-ends); `<Link>` drops the query, so re-stamping is needed; pass `null` as the state argument (the patched method re-attaches `__NA` and dispatches `ACTION_RESTORE`, which never scrolls), never `history.state`.

```tsx
'use client';
import { useCallback, useEffect, useEffectEvent, useState } from 'react';
import { usePathname } from 'next/navigation';

function writeQuery(key: string, value: string | null) {
  const url = new URL(window.location.href);
  if ((url.searchParams.get(key) ?? null) === value) return;      // no-op → no ACTION_RESTORE
  if (value === null) url.searchParams.delete(key); else url.searchParams.set(key, value);
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
}

export function usePersistedQuery(key: string): [string | null, (v: string | null) => void] {
  const pathname = usePathname();
  const [value, setValue] = useState<string | null>(null);   // server and first client render: null
  const [ready, setReady] = useState(false);
  useEffect(() => {                                           // read once after mount; never write here
    setValue(new URLSearchParams(window.location.search).get(key));
    setReady(true);
  }, [key]);
  const restamp = useEffectEvent(() => { if (ready) writeQuery(key, value); });
  useEffect(() => { restamp(); }, [pathname]);                // after every client navigation
  const set = useCallback((v: string | null) => { setValue(v); writeQuery(key, v); }, [key]);
  return [value, set];
}
```

### `lib/earnings.ts` (Task 3)

```ts
export type SessionRecord = RecentConsult & { isNew: true };
export type Earnings = {
  todayConsults: number; weekConsults: number; fortnightConsults: number; toDateConsults: number;
  today: number; week: number; fortnight: number; toDate: number; payoutAmount: number;   // each = consults × FEE
  recent: Array<RecentConsult | SessionRecord>;      // this session's records first, then the fixture's recent when seeded
  dailySeries: BarDatum[];                           // 14 bars, last = todayConsults, emph 'true' on the last
  busiest: DailyConsults | null;                     // null when not seeded and no session consults
};
export function earningsFor(input: { seeded: boolean; session: SessionRecord[] }): Earnings;
```

### `lib/session.ts` (Task 6)

```ts
export const SESSION_SCREENS = ['offline','online-idle','no-patients-waiting','offer','offer-consent-refused','consultation','complete','offer-declined','offer-timed-out','patient-no-show'] as const;
export type SessionScreen = (typeof SESSION_SCREENS)[number];
export const OFFER_WINDOW_SECONDS = 45;     // = OFFER.windowSeconds
export const OFFER_AFTER_MS = 8000;
export type SessionState = {
  screen: SessionScreen; online: boolean; blocked: boolean;
  nav: number;                                   // bumped by every non-jump action that changes `screen`; the URL follows this
  onlineSince: number | null; consultationStartedAt: number | null;
  offerExpiresAt: number | null; offerRemaining: number; offerConsent: boolean; offersSeen: number;
  completed: SessionRecord[]; lastConsultSeconds: number;
};
export type SessionAction =
  | { type: 'jump'; screen: SessionScreen; now: number }
  | { type: 'setBlocked'; blocked: boolean }
  | { type: 'goOnline'; now: number } | { type: 'goOffline' }
  | { type: 'offerArrives'; consent: boolean; now: number } | { type: 'noPatients' } | { type: 'tickOffer'; now: number }
  | { type: 'accept'; now: number } | { type: 'decline' }
  | { type: 'complete'; now: number; id: string; when: string } | { type: 'noShow' }
  | { type: 'backOnline'; now: number };
export function initialSession(screen: SessionScreen | null, opts: { blocked: boolean; now: number }): SessionState;   // null → 'offline'
export function sessionReducer(state: SessionState, action: SessionAction): SessionState;   // returns the same object for an illegal action or a no-op
export function sessionScreenFromPath(pathname: string): SessionScreen | null;   // '/doctor/session/x' → x if valid; the bare path and anything else → null ("no opinion")
export function sessionHref(screen: SessionScreen): string;   // `/doctor/session/${screen}`
```

Transition table (the reducer tests enumerate every (screen, action) pair; every row below bumps `nav` except `jump` and `setBlocked`):

| from | action | to | side effects |
|---|---|---|---|
| offline | goOnline (not blocked) | online-idle | online=true, onlineSince=now |
| offline | goOnline (blocked) | offline | unchanged object |
| any but consultation and offline | goOffline | offline | online=false, onlineSince=null, offerExpiresAt=null |
| consultation, offline | goOffline | same | unchanged object |
| online-idle, no-patients-waiting | offerArrives {consent, now} | offer / offer-consent-refused | offerExpiresAt=now+45000, offerRemaining=45, offerConsent, offersSeen+1 |
| online-idle | noPatients | no-patients-waiting | |
| offer, offer-consent-refused | tickOffer {now} | same, or offer-timed-out when remaining hits 0 | offerRemaining = max(0, ceil((offerExpiresAt−now)/1000)); same object if unchanged and not expired |
| offer, offer-consent-refused | accept | consultation | consultationStartedAt=now, offerExpiresAt=null |
| offer, offer-consent-refused | decline | offer-declined | offerExpiresAt=null |
| consultation | complete | complete | completed.unshift({id, when, ageBand: OFFER.ageBand, minutes: max(1, round(elapsed/60)), outcome: 'Recorded in Semble', isNew}); lastConsultSeconds; consultationStartedAt=null |
| consultation | noShow | patient-no-show | consultationStartedAt=null |
| complete, offer-declined, offer-timed-out, patient-no-show | backOnline | online-idle | onlineSince kept (or now if null) |
| any | jump(screen) | screen | nav untouched; online = screen !== 'offline'; offer screens set offerExpiresAt=now+45000 and offerRemaining=45; consultation sets consultationStartedAt=now; onlineSince=now when online and null |
| any | setBlocked | same | blocked flag only; same object when unchanged |

### `lib/onboarding.ts` (Task 7)

```ts
export const ONBOARDING_STEPS = ['register','identity','credentials','indemnity','skills','done'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
export const GMC_PATTERN = /^\d{7}$/;
export const ONBOARDING_RECORD: Pick<CredentialRecord,'gmc'|'licence'|'cct'|'dbs'|'rightToWork'>;   // gmc/licence/cct/dbs pending, rightToWork valid (preview lines 294–298)
export type OnboardingState = {
  step: OnboardingStep; reached: number;   // index of the furthest step reached (steps below it are done)
  nav: number;                              // bumped by every step-advancing action; never by jump
  email: string; gmc: string; gmcError: string | null; identityVerified: boolean;
  indemnity: { cover: 'block' | 'own' | null; expiry: string; fileName: string; error: string | null };
  skills: SkillId[];
};
export type OnboardingAction =
  | { type: 'jump'; step: OnboardingStep }        // seeds earlier steps as complete
  | { type: 'setEmail'; value: string } | { type: 'setGmc'; value: string } | { type: 'submitRegister' }
  | { type: 'verifyIdentity' } | { type: 'continueCredentials' }
  | { type: 'useBlockCover' } | { type: 'setIndemnityExpiry'; value: string } | { type: 'setIndemnityFile'; name: string } | { type: 'uploadCertificate' }
  | { type: 'toggleSkill'; id: SkillId } | { type: 'finishSkills' };
export function initialOnboarding(step: OnboardingStep | null): OnboardingState;  // null → 'register'; email 'dr.locum@example.com', gmc '4567890' (the preview's worked example), skills = SKILLS.filter(defaultOn)
export function onboardingReducer(state: OnboardingState, action: OnboardingAction): OnboardingState;
export function onboardingStepFromPath(pathname: string): OnboardingStep | null;   // '/doctor/onboarding/x' → x if valid; the bare path → null
export function onboardingHref(step: OnboardingStep): string;   // '/doctor/onboarding/register' … '/doctor/onboarding/done'
export function stepStatus(state: OnboardingState, step: OnboardingStep): 'done' | 'current' | 'todo';
```
Copy: `gmcError` is `'Enter your 7-digit GMC number.'`; `indemnity.error` is `'Enter the expiry date on your certificate.'` (new strings; recorded in the report).

### Providers (Task 12)

```tsx
// components/doctor/DoctorProvider.tsx
export function DoctorProvider({ children })            // 'use client'; gate from usePersistedQuery('gate'); record = GATE_RECORDS[gate] ?? MY_RECORD; derived gate = gateFor(record)
export function useDoctor(): { record: CredentialRecord; gate: GateId | null; blocked: boolean; alerts: CredentialAlert[] /* seeded ? credentialAlerts(record) : [] */ };
// components/doctor/SessionProvider.tsx
export function SessionProvider({ children })
export function useSession(): { state: SessionState; act: (action: SessionAction, opts?: { navigate?: boolean }) => void; onSessionRoute: boolean; secondsOnline: number; consultSeconds: number };
// components/doctor/OnboardingProvider.tsx
export function OnboardingProvider({ children })
export function useOnboarding(): { state: OnboardingState; act: (action: OnboardingAction) => void };
// components/doctor/DoctorProviders.tsx
export function DoctorProviders({ children })          // <DataModeProvider><DoctorProvider><SessionProvider><OnboardingProvider>
```

`SessionProvider`, in full (Task 13 copies this; `OnboardingProvider` is the same shape with `state.nav`, `onboardingStepFromPath`, `onboardingHref` and no timers):

```tsx
'use client';
import { createContext, useCallback, useContext, useEffect, useEffectEvent, useReducer, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLiveInterval } from '@/hooks/use-live-interval';
import { useDataMode } from '@/lib/data-mode';
import { initialSession, sessionReducer, sessionScreenFromPath, sessionHref, OFFER_AFTER_MS,
  type SessionAction, type SessionState } from '@/lib/session';
import { useDoctor } from './DoctorProvider';

type Ctx = { state: SessionState; act: (a: SessionAction, o?: { navigate?: boolean }) => void;
  onSessionRoute: boolean; secondsOnline: number; consultSeconds: number };
const SessionContext = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { blocked } = useDoctor();
  const { seeded } = useDataMode();
  const onSessionRoute = pathname === '/doctor/session' || pathname.startsWith('/doctor/session/');

  // usePathname() is the concrete prerender path, so the server HTML for
  // /doctor/session/offer shows the offer and the client's first render agrees.
  const [state, dispatch] = useReducer(sessionReducer, null, () =>
    initialSession(sessionScreenFromPath(pathname), { blocked, now: Date.now() }));

  const pushNext = useRef(false);
  const act = useCallback((action: SessionAction, opts?: { navigate?: boolean }) => {
    pushNext.current = !!opts?.navigate;   // the dashboard tile only; overwritten on every call
    dispatch(action);
  }, []);

  // URL follows state — only when a non-jump action moved the screen (nav bumped).
  const follow = useEffectEvent(() => {
    const href = sessionHref(state.screen) + window.location.search;   // keeps ?data=seeded
    if (pushNext.current) { pushNext.current = false; router.push(href); return; }
    if (onSessionRoute && pathname !== sessionHref(state.screen)) router.replace(href);
  });
  useEffect(() => { if (state.nav > 0) follow(); }, [state.nav]);

  // State follows URL — only when the URL names a screen the state is not on.
  // `jump` never bumps `nav`, so this can never re-enter `follow`.
  const sync = useEffectEvent(() => {
    const screen = sessionScreenFromPath(pathname);   // null for the bare route → no opinion
    if (screen && screen !== state.screen) dispatch({ type: 'jump', screen, now: Date.now() });
  });
  useEffect(() => { sync(); }, [pathname]);

  // ?gate= is read after mount, so `blocked` flips after the initialiser ran.
  useEffect(() => { dispatch({ type: 'setBlocked', blocked }); }, [blocked]);

  // Decision 4. Cleanup clears the timer: going offline cancels it, StrictMode re-arms it.
  const arrive = useEffectEvent(() => act(seeded
    ? { type: 'offerArrives', consent: state.offersSeen % 2 === 0, now: Date.now() }
    : { type: 'noPatients' }));
  useEffect(() => {
    if (state.screen !== 'online-idle') return;
    const id = window.setTimeout(arrive, OFFER_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [state.screen]);

  // `clock` is null on the server and on the first client render, so every elapsed
  // figure is 0 in both; it starts moving after mount.
  const [clock, setClock] = useState<number | null>(null);
  useLiveInterval(setClock, 1000, state.online);
  useLiveInterval((now) => act({ type: 'tickOffer', now }), 1000,
    state.screen === 'offer' || state.screen === 'offer-consent-refused');
  const elapsed = (since: number | null) =>
    clock !== null && since !== null ? Math.max(0, Math.floor((clock - since) / 1000)) : 0;

  return (
    <SessionContext.Provider value={{ state, act, onSessionRoute,
      secondsOnline: elapsed(state.onlineSince), consultSeconds: elapsed(state.consultationStartedAt) }}>
      {children}
    </SessionContext.Provider>
  );
}
export function useSession() {
  const c = useContext(SessionContext);
  if (!c) throw new Error('useSession outside SessionProvider');
  return c;
}
```

Hydration rule for every provider and component: nothing reads `window`, `document`, `matchMedia` or `Date.now()` *during render*; every flip (mode, gate, jumper, mobile, measured width, the clock) is a post-mount `setState`, never a render-time branch on `typeof window`; no `suppressHydrationWarning` beyond the existing `<html>`.

### Shared app components (Tasks 8–11)

```tsx
<Ribbon className? />                        // <p role="note" data-slot="ribbon" className="sticky top-0 z-20 bg-band px-4 py-2 font-display text-[11px] font-semibold uppercase leading-[1.2] tracking-[.05em] text-white"> "Prototype. Not a live service — no real patients, GPs, or data."
<AppShell surface="doctor" | "admin" title="Doctor" | "Admin" nav={NavItem[]} end={ReactNode}>{children}</AppShell>
<StatTile label value note? size="lg"|"sm" against? />  // value is already a string from shown()/live(); numeral <span data-slot="stat-value"> in the decision-26 classes; `against` renders <span data-slot="stat-against"> e.g. "plan assumed £16 · £26 above plan" (blank: "plan assumed £16")
<EmptyState>No consultations yet.</EmptyState>          // <p data-slot="empty" className="text-ink-2 text-body py-8 text-center rounded-xl border border-dashed border-rule">
<PageHeader title lead? actions? />                     // h1 (text-headline max-phone:text-headline-sm, data-reveal) + optional lead (text-ink-2 max-w-[52ch]) + actions
<Facts items={[label, value][]} />                      // <dl data-slot="facts"> two-column facts list (dt 16ch / dd), rows on hairlines
<ChartFrame height={150} ariaLabel>{(width) => ReactNode}</ChartFrame>   // <div data-slot="chart-frame">; width from ResizeObserver, max(240, …); renders no <svg> until measured, only the ariaLabel as sr-only text; exports AXIS = 20
<BarChart data={BarDatum[]} height format ariaLabel />  // rects: emph 'true' → fill-primary, else fill-outline; baseline stroke-rule; labels fill-ink-2 font-display text-[11px]; <svg role="img" aria-label viewBox="0 0 {width} {height+20}">
<LineChart sets={LineSet[]} labels height ariaLabel />  // set 0 stroke-primary, set 1 stroke-ink-2 strokeDasharray="5 4"; 2px; fill none; below 560 measured width draws sets[0] only (exports ONE_SERIES_BELOW = 560; the ceiling stays shared across every set); BarChart and LineChart are 'use client' because the render prop they hand ChartFrame cannot cross a server boundary
<ChartLegend items={{ label, swatch: 'primary' | 'outline' | 'ink-2' }[]} />   // 'ink-2' is a 16×2 dashed line and its item carries max-phone:hidden (the caption leaves with the second series); rendered only alongside a drawn chart, never with an empty state; exports LegendItem, DAILY_LEGEND (Today / Earlier days) and DEMAND_LEGEND (Patients waiting / GPs online) so no surface retypes them
<StatusBadge status={CredentialStatus | null} onBand? />   // decision 23 mapping; data-status; null → "—" aria-label="Not submitted"
<CredentialMatrix record={CredentialRecord} seeded={boolean} caption={string} keys?={readonly CredentialKey[]} stack?="phone" />  // rows in CREDENTIAL_KEYS order (or `keys`), sorted urgent-first (expired, rejected, pending, expiring by days, valid); expired rows bg-band text-white hover:bg-band with onBand badges; expiring rows border-2! border-ink; valid plain; blank mode: every status null and "Not submitted"
<Stepper steps={{ id, label, status: 'done'|'current'|'todo' }[]} />   // <ol aria-label="Onboarding steps"> of <li aria-current="step"?> bars (bg-ink when done/current, bg-fill when todo) + label + sr-only "completed"/"not started"
<Countdown remaining={number} total={45} />             // decision 27: Progress (linear 1000ms drain, aria-label, getValueLabel) + <span data-slot="countdown-value" aria-hidden> numerals (text-error at ≤5) + sr-only aria-live="assertive" aria-atomic region announcing on arrival and at 30/15/5 only
<StateJumper surface="doctor" | "admin" />              // <nav aria-label="Prototype navigation"> fixed bottom-0 h-11 z-30 bg-band text-white font-mono text-[11px] overflow-x-auto; renders when process.env.NODE_ENV !== 'production' || usePersistedQuery('jumper') === '1'; the shell adds pb-(--jumper-h) while it renders; group labels uppercase text-band-ink-2; items are plain <a href> (state kind: border-dashed) with aria-current="page" → bg-white text-ink; every href carries window.location.search (client component; empty on the server) except the Data group
```

`components/app/nav.ts`: `export type NavItem = { href: string; label: string; icon: LucideIcon; screen: string }`; `DOCTOR_NAV` (Dashboard `/doctor` `LayoutDashboardIcon`, Earnings `/doctor/earnings` `BanknoteIcon`, Profile `/doctor/profile` `UserIcon`), `ADMIN_NAV` (Live floor `/admin` `ActivityIcon`, Governance `/admin/governance` `ShieldCheckIcon`, GP supply `/admin/supply` `UsersIcon`, Business `/admin/business` `ChartColumnIcon`); `screenIdFor(pathname): string` (`/doctor`→`dashboard`, `/doctor/earnings`→`earnings`, `/doctor/profile`→`profile`, `/doctor/session/*`→ the state (bare → `offline`), `/doctor/onboarding/*`→ the step (bare → `register`), `/admin`→`floor`, others → last segment); `DOCTOR_DASH_SCREENS = ['dashboard','earnings','profile']`, `ADMIN_DASH_SCREENS = ['floor','governance','supply','business']`; `DOCTOR_SECTION_OF = { offline: 'dashboard', 'online-idle': 'dashboard', 'no-patients-waiting': 'dashboard' }` so the Dashboard item stays lit in the collapsed rail's tooltip; `AppShell` computes `flow = areaOf(screen, DASH_SCREENS) === 'flow'` and passes `open={open && !flow}` to `SidebarProvider` (never seeded from a cookie — that would make the surface dynamic).

`AppShell` (Task 12 copies this):

```tsx
'use client';
export function AppShell({ surface, title, nav, end, children }: Props) {
  const pathname = usePathname();
  const screen = screenIdFor(pathname);
  const flow = areaOf(screen, surface === 'doctor' ? DOCTOR_DASH_SCREENS : ADMIN_DASH_SCREENS) === 'flow';
  const [open, setOpen] = useState(true);   // same on server and client
  return (
    <div data-surface={surface} className="flex min-h-svh flex-col"
      style={{ '--ribbon-h': '2.25rem', '--shell-h': 'calc(100svh - var(--ribbon-h))' } as React.CSSProperties}>
      {/* First element, full width, above the z-10 rail. Wraps at 390; the fixed rail that
          consumes --ribbon-h only exists from md: (900), where this is one line. */}
      <Ribbon className="min-h-(--ribbon-h) md:h-(--ribbon-h)" />
      <SidebarProvider open={open && !flow} onOpenChange={setOpen} className="min-h-(--shell-h)">
        {/* style lands on the `fixed inset-y-0 h-svh` container; inline beats the utilities. */}
        <Sidebar collapsible="icon" style={{ top: 'var(--ribbon-h)', height: 'var(--shell-h)' }}>
          <SidebarHeader>{/* wordmark → "/", and a SheetClose when useSidebar().isMobile */}</SidebarHeader>
          <SidebarContent><SurfaceNav items={nav} /></SidebarContent>
          <SidebarRail />
        </Sidebar>
        {/* min-w-0: otherwise the flex child grows to its tables' intrinsic width at 390. */}
        <SidebarInset className="min-w-0">
          <TopBar title={title} nav={nav} end={end} />
          <div className="wrap w-full py-8 max-phone:py-6">{children}</div>
          <Arrival />
          <StateJumper surface={surface} />   {/* <nav> landmark, last in the DOM */}
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
```

`TopBar`: `<header className="sticky top-(--ribbon-h) z-10 flex h-16 items-center gap-4 border-b border-rule bg-white px-6 max-phone:px-4">` with `<SidebarTrigger />`, the wordmark link to `/` (`Dr<span className="text-primary">Quick</span>`, `font-display text-xl font-bold tracking-[-.04em]`), the surface `title` in `text-fine text-ink-2`, then `end` (the doctor's `AvailabilityControl` or the admin's `DataModeSwitch`) and `<Avatar size="sm"><AvatarFallback>GP</AvatarFallback></Avatar>` + `<span className="text-fine font-semibold">GP-002</span>` (admin: `AD` / `Admin`), and the no-JS fallback `<noscript><nav aria-label="Sections" className="md:hidden"><ul className="flex flex-wrap gap-3 text-fine">{nav.map(i => <li key={i.href}><a href={i.href}>{i.label}</a></li>)}</ul></nav></noscript>`.

`components/app/jumps.ts`: `DOCTOR_JUMPS` and `ADMIN_JUMPS` as `{ label: string; items: { href: string; label: string; kind: 'screen' | 'state' }[] }[]`, the exact groups and labels of `preview/js/doctor.js:41-73` and `admin.html:210-217`, with gate hrefs `/doctor?gate=<id>` and a final group `Data` with `Blank` (strips `data`) and `Seeded` (`?data=seeded`).

### Copy sources

Every user-facing string is copied verbatim from `preview/doctor.html` / `preview/admin.html` / `preview/js/doctor.js` at the line ranges each task cites. New strings are listed in the task and in the report. The only wholesale changes are those in "Decisions taken" above.

## Spec coverage (self-review, part 1)

Every requirement in `plans/006-doctor-admin-surfaces-prompt.md`, and the task that implements it. A requirement with no task is a plan failure; none was found.

| Spec section | Requirement | Task(s) |
|---|---|---|
| Scope, In | Routes, layouts, providers, reducers for `/doctor/**` and `/admin/**` | 6, 7, 13–25 |
| | Shared authenticated-app shell | 12 |
| | Fixture, placeholder, alert, chart modules ported with types | 2, 3, 10 |
| | Prototype ribbon; development state jumper replacing the rail | 9, 12 |
| | Doctor and admin portions of the three preview suites in Vitest | 2, 3 (units + fixture guards), 26 (structure), 26 (constraints) |
| | Noindex headers verified; docs updated | 13, 27 |
| Scope, Out | Patient surface, auth, DB, video, payments, Semble integration, deleting `preview/`, new traction fixtures, unnamed screens | none built; Decision 7 records the four governance fixtures the prototype spec names; report lists nothing else |
| Routes | The nine routes and two catch-alls; route groups with their own providers; `/` bundle untouched | 13 (+ bundle test), 28 (bundle check) |
| | Every route static; complete server shell without JS | 13 (`force-static`, `generateStaticParams`, `dynamicParams=false`), 14–25 (server-renderable screens), 28 (no-JS captures) |
| State | Session reducer with the ten states and the exact transitions | 6 (Decision 3, 4) |
| | Onboarding reducer, per-gate statuses, indemnity fork | 7, 18 |
| | Credential record from `GPS`, `credentialAlerts()` the only source, the four gates | 3 (`gateFor`), 13 (`DoctorProvider`), 15 |
| | `DataModeProvider` reading `?data=seeded`, persistence documented | 4 (Decision 2) |
| | Availability as one piece of state echoed everywhere; "availability, not a schedule" test | 13 (`AvailabilityControl`), 14, 19, 26 |
| | Active nav derived from the pathname; `shell.ts` ported | 2, 12 |
| | `live.ts` driving countdown, timer, floor; cleared on unmount, paused when hidden | 2, 5, 13, 21, 22 (Decision 9) |
| | No global store; surfaces isolated | 13 (providers per layout), 28 (bundle grep) |
| URL-addressable states | Every session and onboarding state has a URL; landing seeds the provider | 13, 18, 19–21 (Decision 3); gates via `?gate=` (Decision 1) |
| | `StateJumper`: bottom-pinned, monospace, dark, dev-only or `?jumper=1`, replaces `rail.js` | 12 |
| Placeholder rules | `shown()`/`live()` semantics; zero as dash; empty states; £39, register, labels in both modes | 2, 4 (`useFigures`), 14–25, 26 (blank sweep) |
| Ports unchanged | `booking`, `charts`, `placeholder`, `live`, `shell`, `alerts`, `fixtures` under `lib/` with the same names; one fixtures file; derived-once figures | 2, 3 (Decisions 6, 8, 20, 30) |
| The shell | `Sidebar` + `Sheet` under 900; top bar (wordmark → `/`, surface name, availability or data-mode switch, avatar `GP-002`/`Admin`); ribbon first, sticky, undismissable; noindex header confirmed + `metadata.robots` | 12, 13 |
| `/doctor` dashboard | Availability control (`Switch` + label + reason); Today tiles; Next payout; alerts by tone with a Button each; two charts; two tables with `th scope`; performance (acceptance, average) — no ratings | 14 (Decisions 5, 12, 17, 28) |
| Gates | `indemnity-expired` band card with the single action; pending/rejected replace the dashboard; `revalidation-due` banner | 15 |
| Onboarding | Stepper; per-step `Badge`; six steps with the named content; block cover vs own certificate equally real; skip-ahead seeds earlier steps | 7, 18 (Decisions 29, 31) |
| Session | Offline; online-idle with the alive signal; no-patients-waiting with the demand chart; offer with the 45s `Progress` + numerals announced at 30/15/5, three fields only, Accept/Decline; consent-refused as a constraint; consultation with the video placeholder, context, timer, Semble panel + `Dialog`, no notes/prescribing; complete with £39 and `live()`; three terminal cards | 5, 19, 20, 21 (Decisions 4, 27, 31) |
| `/doctor/earnings` | Next payout; daily earnings bar; payout table with tabular numerals; consults × `FEE`; no per-hour figure | 16 |
| `/doctor/profile` | Credential matrix (one component, both surfaces); skills; account; severity by fill/border/position | 11, 17 (Decision 23) |
| `/admin` | Right now (waiting, GPs online vs needed with the band cover gap, in progress, ETA) ticking; the four failure counters at equal weight; two-series demand chart; no animation on update | 22 (Decision 22) |
| `/admin/governance` | Stat row incl. 999-screen count and time-to-resolution; restricted register in blank mode; per-prescriber table with outlier badge; break-glass log with reasons; audit log; no medicine | 23 (Decision 7) |
| `/admin/supply` | Applications with stage badges; per-GP matrix sorted soonest-first with the 14-day filter on; online now; coverage by hour; payout runs; GP-003's expired indemnity visible | 24 (Decision 30) |
| `/admin/business` | Exactly two headline numbers against their assumptions with the gap; consults, revenue, refunds, waitlist with the upgrade-path comment | 25 |
| Design language | `components/ui/` only, composed in `components/app/`; missing primitive via CLI + gallery | 8 (Checkbox, Table stack), 9–12 (gallery sections) |
| | Sixteen tokens; severity without a fourth colour | Global Constraints; 26 (constraints test) |
| | Typography (Geist numerals, tabular; 15/13px tables; 12px rows; divider exception recorded) | 9 (Decision 26), 27 (DESIGN.md) |
| | Cards borderless; one band per screen | Decision 22; 26 (sweep) |
| | Charts: measured width, 2px, no fills, no animation | 10 (Decision 24) |
| | Motion: arrival on first paint only; timers as static numerals under reduced motion | 12 (Decision 13), 5 (Decision 27), 27 (DESIGN.md motion rules) |
| | Empty states as sentences | 9 (`EmptyState`), every screen task |
| | 390px: stacked tables, one chart series, `Sheet` nav | 8, 10, 12 |
| Compliance | Every bullet | Global Constraints; 3 (fixture guards), 26 (constraints additions), 28 (greps) |
| Accessibility | Labelled controls; `:focus-visible`; live regions; real `Switch`; captions and `th scope`; no colour-alone status; `Sheet` focus; skippable jumper; keyboard walk reported | 5, 9, 12, 13, 26 (sweeps), 28 (walks) |
| Tests | 48 unit tests moved; structure assertions rewritten; constraints additions; headers; reducer tests incl. illegal transitions | 2, 3, 6, 7, 13, 26 |
| Verify | Build + bundle; the screenshot matrix in both modes at both widths; keyboard and mouse walks with the £39 delta; no-JS loads; greps; `/dev/ui` | 1 (baselines), 28 |
| Docs | `CLAUDE.md` Dashboards; `DESIGN.md` exceptions; migration addendum; `preview/README.md` note | 27 |
| Report | The listed headings | 28 |

## Task map

Order matters: 1 → 7 are the foundation every screen needs (lib + reducers), 8 → 13 the component layer and the shell, 14 → 21 the doctor surface, 22 → 25 the admin surface, 26 → 28 tests, docs and verification. Tasks 14–17, 18, 19–21 and 22–25 are independent of each other once 13 is in; if scope must be cut, cut whole screens from the end of a surface, never the foundation.

| # | Task | Commit |
|---|---|---|
| 1 | Commit the uncommitted foundation, capture baselines, file this plan | `feat(preview)…`, `feat(ui)…`, `docs(plan)…` |
| 2 | Port `placeholder`, `live`, `charts`, `shell`, `booking`; add `format`; move 48 unit tests | `feat(lib): port the pure preview modules with types and their unit tests` |
| 3 | `fixtures.ts`, `alerts.ts` (+`rejected`, `gateFor`), `earnings.ts`; fixture integrity + alert + earnings tests | `feat(lib): typed fixtures, credential alerts with gates, earnings derived once` |
| 4 | `data-mode.tsx` (`DataModeProvider`, `useFigures`, `usePersistedQuery`); test helpers (`dom-stubs`, `navigation-mock`) | `feat(app): data mode provider with URL-persisted query state` |
| 5 | `use-live-interval.ts`; `Countdown` | `feat(app): live interval hook and the offer countdown` |
| 6 | `lib/session.ts` + the full reducer matrix test | `feat(doctor): session reducer with every transition and its illegal pairs` |
| 7 | `lib/onboarding.ts` + reducer test | `feat(doctor): onboarding reducer` |
| 8 | `components/ui/checkbox.tsx` (CLI + restyle); `Table stack` / `TableCell label`; gallery | `feat(ui): checkbox and a stacked table mode for phones` |
| 9 | `Ribbon`, `EmptyState`, `StatTile`, `PageHeader`, `Facts`, `StatusBadge`, `Stepper`; gallery; tests | `feat(app): stat tile, status badge, stepper, ribbon, empty state` |
| 10 | `ChartFrame`, `BarChart`, `LineChart`, `ChartLegend`; gallery; tests | `feat(app): inline SVG charts drawn at measured width` |
| 11 | `CredentialMatrix`; gallery; tests | `feat(app): credential matrix with severity by fill, border and position` |
| 12 | `Arrival`, `nav.ts`, `jumps.ts`, `StateJumper`, `SurfaceNav`, `TopBar`, `AppShell`; the `data-arrived` CSS rule; gallery; `app-shell.test.tsx` | `feat(app): the app shell — sidebar, top bar, ribbon, arrival, state jumper` |
| 13 | `DoctorProvider`, `SessionProvider`, `OnboardingProvider`, `DoctorProviders`, `AvailabilityControl`, `DataModeSwitch`; both layouts with `metadata.robots`; placeholder pages so every route builds; headers test; bundle-isolation check | `feat(app): doctor and admin layouts with their providers and noindex metadata` |
| 14 | `/doctor` dashboard (`Dashboard`, `DoctorHome`, `page.tsx`) | `feat(doctor): the dashboard` |
| 15 | The four gates (`Gate.tsx`) | `feat(doctor): the four credential gates` |
| 16 | `/doctor/earnings` | `feat(doctor): earnings` |
| 17 | `/doctor/profile` | `feat(doctor): profile` |
| 18 | `/doctor/onboarding/[[...step]]`, `OnboardingFlow`, six step screens | `feat(doctor): onboarding — register to ready` |
| 19 | `/doctor/session/[[...state]]`, `SessionScreen`, `Offline`, `OnlineIdle`, `NoPatientsWaiting` | `feat(doctor): the shift — offline, online, nobody waiting` |
| 20 | `Offer` (both consent cases), the offer-arrival timer, `Terminal` (declined, timed out) | `feat(doctor): the offer window` |
| 21 | `Consultation`, `SembleDialog`, `Complete`, `patient-no-show`; earnings update by exactly £39 | `feat(doctor): consultation, Semble handoff and completion` |
| 22 | `/admin` live floor (`LiveFloor`, the floor tick) | `feat(admin): live operations` |
| 23 | `/admin/governance` | `feat(admin): clinical governance and safety` |
| 24 | `/admin/supply` | `feat(admin): GP supply operations` |
| 25 | `/admin/business` | `feat(admin): business` |
| 26 | `tests/doctor.test.tsx`, `tests/admin.test.tsx` (the surviving structure assertions), `constraints.test.ts` and `headers.test.ts` additions | `test: carry the preview structure assertions into Vitest` |
| 27 | `CLAUDE.md` Dashboards section, `DESIGN.md` exceptions + motion rules, migration-spec addendum, `preview/README.md` note | `docs: dashboards section, design exceptions, migration addendum` |
| 28 | Build, bundle check, the screenshot matrix (`scripts/screenshot-dashboards.mjs`), keyboard and no-JS walks, greps, `/dev/ui`; fixes; the report | `chore(verify): dashboard screenshot matrix and fixes` |

## Tasks

### Task 1: Commit the foundation, capture baselines, file this plan

**Files:**
- Commit (already in the tree, uncommitted): `preview/**`, `docs/superpowers/plans/2026-08-27-role-dashboards-prototype.md`; then `components/ui/**`, `components.json`, `hooks/use-mobile.ts`, `lib/utils.ts`, `app/dev/**`, `app/globals.css`, `components/{Nav,PriceBand,Steps,WaitlistForm}.tsx`, `package.json`, `package-lock.json`, `next.config.ts`, `tests/constraints.test.ts`, `tests/headers.test.ts`, `CLAUDE.md`, `DESIGN.md`, `docs/superpowers/specs/2026-08-28-react-migration-design.md`, `plans/004-*.md`, `plans/005-*.md`, `plans/006-*.md`
- Create: `docs/superpowers/plans/2026-09-02-doctor-admin-surfaces.md` (this file, copied)
- Never commit: `.DS_Store` (add it to `.gitignore` if it is not already ignored globally — check `git check-ignore .DS_Store`)

**Interfaces:**
- Produces: a clean `git status`; the baseline first-load JS figure for `/` and baseline screenshots the final task compares against.

- [ ] **Step 1: Prove the tree is green before touching it**

```bash
cd /Users/liam/development/DrQuick/website
npm test
npm run typecheck
NEXT_PUBLIC_SITE_URL=http://localhost:3000 npm run build 2>&1 | tee /tmp/build-baseline.txt
```
Expected: all three pass. Copy the `/` row of the build's route table (the `First Load JS` figure) into `docs/superpowers/plans/2026-09-02-doctor-admin-surfaces.md` under a `## Baselines` heading at the bottom (Step 5). If anything fails, stop and report — this plan assumes the foundation is complete, and the history report says it is.

- [ ] **Step 2: Commit the preview rewrite on its own**

```bash
git add preview docs/superpowers/plans/2026-08-27-role-dashboards-prototype.md
git commit -m "feat(preview): signed-in dashboards, placeholder mode, charts and credential alerts

The doctor and admin prototypes gain the app shell, the blank-by-default
data mode, authored-SVG charts, credential alerts derived from the record,
and the unit and structure tests that cover them. Reference for the port.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 3: Commit the shadcn foundation and visual-interest work**

```bash
git add components components.json hooks lib app package.json package-lock.json next.config.ts tests CLAUDE.md DESIGN.md docs/superpowers/specs plans
git status --short   # must show nothing but .DS_Store (untracked) — if more remains, add it deliberately or stop
git commit -m "feat(ui): shadcn component layer, gallery route and surface textures (plans/004, 005)

components/ui is shadcn on the unified radix-ui package, restyled to
DESIGN.md; every semantic token aliases one of the sixteen @theme colours.
/dev/ui renders every component on ground, white and band. The landing
page's primitives move onto Button, Input, Card and SegmentedLink at parity.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: Baseline screenshots of the landing page**

Write `/private/tmp/…/scratchpad/shoot-landing.mjs` per the tooling note (puppeteer-core from the npx cache, the cached chrome-headless-shell), start or reuse `npm run dev` on :3000, and capture `/` and `/?role=gp` at 1440×900 and 390×844 full page (add `.in` to every `[data-reveal]` first, wait 1s). Keep the four PNGs in the scratchpad as `landing-before-*.png`. Task 28 diffs against them: the landing page must be pixel-identical after this plan.

- [ ] **Step 5: File the plan**

```bash
cp ~/.claude/plans/ort-the-doctor-and-typed-rabbit.md docs/superpowers/plans/2026-09-02-doctor-admin-surfaces.md
```
Append a `## Baselines` section with the `/` first-load figure from Step 1 and the four screenshot names. Commit:

```bash
git add docs/superpowers/plans/2026-09-02-doctor-admin-surfaces.md
git commit -m "docs(plan): doctor and admin surfaces implementation plan

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Port the pure modules — placeholder, live, charts, shell, booking — and add format

**Files:**
- Create: `lib/placeholder.ts`, `lib/live.ts`, `lib/charts.ts`, `lib/shell.ts`, `lib/booking.ts`, `lib/format.ts`
- Test: `tests/lib/placeholder.test.ts`, `tests/lib/live.test.ts`, `tests/lib/charts.test.ts`, `tests/lib/shell.test.ts`, `tests/lib/booking.test.ts`, `tests/lib/format.test.ts`
- Read: `preview/js/{placeholder,live,charts,shell,booking}.js`, `preview/tests/units.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: exactly the exports listed in the contract. Logic is untouched; only annotations are added. Later tasks import `DASH`, `live`, `tickCountdown`, `startInterval`, `barGeometry`, `linePoints`, `toPath`, `labelStride`, `activeNav`, `areaOf`, `formatClock`, `nextConsultationId`, `waitEstimate`, `money`, `minutesLabel`, `daysLabel`, `percent`.

- [ ] **Step 1: Move the unit tests first, on `node:assert/strict`, so they fail on the missing modules**

Split `preview/tests/units.test.mjs` by module. The port is an import-path change plus `import { test } from 'vitest'`; keep `assert` and every test name and body verbatim. Drop the eleven `router.js` / `rail.js` tests (those modules are retired). Example head of `tests/lib/live.test.ts`:

```ts
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { formatEta, tickCountdown, tickQueue, startInterval } from '@/lib/live';

test('formatEta reads naturally under a minute', () => {
  assert.equal(formatEta(0), 'under a minute');
  assert.equal(formatEta(59), 'under a minute');
});
// … tickCountdown, tickQueue (three tests) verbatim from preview/tests/units.test.mjs:112-145 …

// New: the only timer wrapper the surfaces use had no test.
test('startInterval returns a stop that clears the interval', () => {
  const calls: number[] = [];
  const win = {
    setInterval: (fn: () => void, ms: number) => { calls.push(ms); return 7; },
    clearInterval: (id: number) => { calls.push(-id); },
  } as unknown as typeof globalThis;
  const stop = startInterval(() => {}, 1000, win);
  stop();
  assert.deepEqual(calls, [1000, -7]);
});

test('startInterval runs a sub-second interval once under reduced motion', () => {
  let ran = 0;
  const win = {
    matchMedia: () => ({ matches: true }),
    setInterval: () => { throw new Error('must not schedule'); },
  } as unknown as typeof globalThis;
  const stop = startInterval(() => { ran += 1; }, 500, win);
  assert.equal(ran, 1);
  stop();
});
```

File-by-file split of the 48 ported tests (line ranges are into `preview/tests/units.test.mjs`):

| new file | tests | source lines |
|---|---|---|
| `tests/lib/live.test.ts` | formatEta ×2, tickCountdown, tickQueue ×3 (+2 new above) | 112–145 |
| `tests/lib/charts.test.ts` | barGeometry ×4, linePoints ×2, toPath, labelStride, svgLines axis (+1 new: `svgBars` draws one `<rect>` per datum with `data-emph` on the flagged one and one `<title>` each) | 151–196, 272–287 |
| `tests/lib/booking.test.ts` | waitEstimate ×2, isEligibleGp ×2, matchGp ×4, outcomeFor ×2, endedEarly, formatClock, nextConsultationId, consultationRecord ×3 | 291–407 |
| `tests/lib/shell.test.ts` | activeNav, areaOf | 259–268 |
| `tests/lib/placeholder.test.ts` | defaults, live ×3, shown, seed, unknown mode, listOr | 415–475 |
| `tests/lib/alerts.test.ts` | (Task 3) | 209–253 |

Run: `npx vitest run tests/lib` → every file fails with "Cannot find module '@/lib/…'".

- [ ] **Step 2: `lib/placeholder.ts` — verbatim, typed**

```ts
/* Nothing has launched. A dashboard that reads "£1,248 earned, 32
   consultations" is making a claim about a service that has not seen a single
   patient, and a prototype has no business making one. So every figure that
   could only come from the platform actually running renders as an em dash
   until there is something real behind it, and every list renders its empty
   state rather than a page of invented rows.

   Two rules, deliberately different:

   - `shown()` is for a figure that only a running platform could produce —
     earnings, volumes, waiting counts. It is a dash until the prototype is
     seeded with the demonstration data.
   - `live()` is for a figure this session can genuinely produce. A GP who
     completes a consultation really did earn £39, and it must appear. It is
     a dash only while there is honestly nothing.

   The React surfaces read the mode from DataModeProvider (lib/data-mode.tsx)
   and bind `shown` through useFigures(); this module's own mode is for the
   unit tests and for any non-React caller. Set `?data=seeded` on any
   dashboard URL to see the screens against the fixture data. */

export const DASH = '—';

export type DataMode = 'placeholder' | 'seeded';
const MODES = new Set<DataMode>(['placeholder', 'seeded']);
let mode: DataMode = 'placeholder';

export function setDataMode(next: string): void {
  if (!MODES.has(next as DataMode)) throw new Error(`Unknown data mode: ${next}`);
  mode = next as DataMode;
}

export function dataMode(): DataMode { return mode; }
export function isSeeded(): boolean { return mode === 'seeded'; }

export type Format<T> = (value: T) => string;

/* Zero is a dash here, not a "0". "0 consultations" is a claim that the
   service ran and nobody came; a dash says only that there is nothing to
   show. Before launch those are very different sentences. */
export function live<T>(value: T | null | undefined, format: Format<T> = String as Format<T>): string {
  const nothing = value === null || value === undefined || (value as unknown) === '' || (value as unknown) === 0;
  return nothing ? DASH : format(value as T);
}

export function shown<T>(value: T | null | undefined, format: Format<T> = String as Format<T>): string {
  return isSeeded() ? live(value, format) : DASH;
}

/* A seeded list, or an empty one. Emptying the source array rather than
   guarding each render keeps the "and then a real consultation appears"
   path working: whatever this session creates is appended to the same array. */
export function seed<T>(list: readonly T[]): T[] {
  return isSeeded() ? [...list] : [];
}

export function emptyState(message: string): string {
  return `<p class="empty">${message}</p>`;
}

export function listOr(markup: string, message: string): string {
  return markup === '' ? emptyState(message) : markup;
}

/* Stamp the mode on <html> so CSS and the screenshot script can read it. Named
   `figures`, not `mode`: the landing page's `[data-mode="gp"]` rules must never
   be able to match a dashboard element. */
export function markDocument(doc: Pick<Document, 'documentElement'>): void {
  doc.documentElement.dataset.figures = mode;
}

/* Read once, at startup, so a reviewer can link straight to either mode. */
export function dataModeFromLocation(win: { location?: { search?: string }; document?: Document } = globalThis as never): DataMode {
  const raw = new URLSearchParams(win.location?.search ?? '').get('data');
  if (raw && MODES.has(raw as DataMode)) setDataMode(raw);
  if (win.document) markDocument(win.document);
  return mode;
}
```

- [ ] **Step 3: `lib/live.ts` — verbatim, typed**

```ts
export function formatEta(seconds: number): string {
  if (seconds < 60) return 'under a minute';
  const minutes = Math.ceil(seconds / 60);
  return `about ${minutes} minute${minutes === 1 ? '' : 's'}`;
}

export type Countdown = { remaining: number; expired?: boolean };
export function tickCountdown(state: Countdown): Required<Countdown> {
  const remaining = Math.max(0, state.remaining - 1);
  return { remaining, expired: remaining === 0 };
}

export type QueueState = { position: number; etaSeconds: number };
export function tickQueue(state: QueueState): QueueState {
  const etaSeconds = Math.max(0, state.etaSeconds - 1);
  const crossed = etaSeconds > 0 && etaSeconds % 45 === 0;
  const position = crossed ? Math.max(1, state.position - 1) : state.position;
  return { position, etaSeconds };
}

type TimerWindow = Pick<typeof globalThis, 'setInterval' | 'clearInterval'> & { matchMedia?: (q: string) => { matches: boolean } };

export function startInterval(fn: () => void, ms: number, win: TimerWindow = globalThis): () => void {
  const reduced = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  if (reduced && ms < 1000) {
    fn();
    return () => {};
  }
  const id = win.setInterval(fn, ms);
  return () => win.clearInterval(id);
}
```

- [ ] **Step 4: `lib/charts.ts` — verbatim, typed**

Copy `preview/js/charts.js` whole (all seven exports including the string-building `svgBars`, `svgLines` and `mountChart`; the React charts in Task 10 use only the geometry, but the unit tests exercise the string builders). Add these types at the top and annotate every signature; change nothing else:

```ts
export type Bar = { x: number; y: number; w: number; h: number; value: number };
export type Point = { x: number; y: number; value: number };
export type BarDatum = { label: string; value: number; emph?: 'true' | 'false' | 'accent' };
export type LineSet = { key: string; values: number[] };
export type BarOptions = { width: number; height: number; gap?: number };
export type LineOptions = { width: number; height: number; max?: number | null };
export function barGeometry(values: number[], { width, height, gap = 6 }: BarOptions): Bar[]
export function linePoints(values: number[], { width, height, max = null }: LineOptions): Point[]
export function toPath(points: Point[]): string
export function labelStride(count: number, width: number, minGap = 34): number
export function svgBars(series: BarDatum[], opts?: { width?: number; height?: number; gap?: number; labelEvery?: number | null; format?: (v: number) => string }): string
export function svgLines(sets: LineSet[], labels: string[], opts?: { width?: number; height?: number; area?: boolean }): string
export function mountChart(node: HTMLElement, build: (width: number) => string, win?: Window): () => void
```
`svgBars`/`svgLines` keep their class names (`chart`, `bar`, `baseline`, `line`, `area`) — they are only ever rendered by the unit tests now.

- [ ] **Step 5: `lib/shell.ts` — the two pure functions**

```ts
/* Which product-nav item is lit, and whether the current screen is a
   dashboard or a linear flow. The DOM wiring (mountShell) is retired: the app
   shell derives both from the pathname in components/app/nav.ts. */
export type Area = 'dash' | 'flow';

export function activeNav(screenId: string, sectionOf: Record<string, string> = {}): string {
  return sectionOf[screenId] ?? screenId;
}

export function areaOf(screenId: string, dashScreens: readonly string[]): Area {
  return dashScreens.includes(screenId) ? 'dash' : 'flow';
}
```

- [ ] **Step 6: `lib/booking.ts` — verbatim, typed**

Copy `preview/js/booking.js` whole. Types to add: `Outcome = { prescription: boolean; referral: boolean; fitNote: boolean }`, `Complaint = { label: string; outcome: Outcome; note: string }`, `COMPLAINTS: Record<'sore-throat' | 'stomach' | 'skin' | 'other', Complaint>`, `Booking` (the `createBooking()` shape with `complaint: keyof typeof COMPLAINTS`, `nhsGpConsent: boolean | null`, `gp: { ref: string } | null`, `status?: 'cancelled'`), `Floor = { waiting: number; gpsOnline: number }`, `waitEstimate(floor: Floor): { position: number; etaSeconds: number }`, `isEligibleGp(gp: { online: boolean; credentials: Record<string, { status: string }> }): boolean`, `matchGp(gps, prescribing: { ref: string; consults: number }[], booking?: { nhsGpConsent?: boolean | null }): { ref: string; reasons: string[]; limitedPrescribing: boolean } | null`, `outcomeFor(booking): Outcome & { sharedWithNhsGp: boolean; note: string }`, `endedEarly(seconds: number): boolean`, `nextConsultationId(existing: { id: string }[]): string`, `formatClock(seconds: number): string`, `consultationRecord(booking, meta: { id: string; date: string; fee: number })`. Behaviour unchanged.

- [ ] **Step 7: `lib/format.ts` — new, tiny**

```ts
export const money = (v: number): string => `£${v.toLocaleString('en-GB')}`;
export const minutesLabel = (m: number): string => `${m}m`;
export const daysLabel = (d: number): string => `${d} days`;
export const percent = (r: number): string => `${Math.round(r * 100)}%`;
```
`tests/lib/format.test.ts`: `money(1248) === '£1,248'`, `money(39) === '£39'`, `minutesLabel(42) === '42m'`, `daysLabel(9) === '9 days'`, `percent(0.86) === '86%'`.

- [ ] **Step 8: Run the ported suite and the whole suite**

Run: `npx vitest run tests/lib` → 48 ported + 3 new + 1 format = 52 passing. Then `npm test` and `npm run typecheck` → green. `tests/constraints.test.ts` now scans `lib/booking.ts` and `lib/placeholder.ts`; the complaint labels ("Sore throat or cough", "Stomach pain", "Skin or rash") name no medicine — it must stay green.

- [ ] **Step 9: Commit**

```bash
git add lib/placeholder.ts lib/live.ts lib/charts.ts lib/shell.ts lib/booking.ts lib/format.ts tests/lib
git commit -m "feat(lib): port the pure preview modules with types and their unit tests

placeholder, live, charts, shell and booking move from preview/js with
type annotations and nothing else; 48 of the preview's 59 unit tests move
with them on node:assert (the eleven router/rail tests retire with those
modules). svgBars and startInterval gain the tests they never had.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Typed fixtures, credential alerts with gates, earnings derived once

**Files:**
- Create: `lib/fixtures.ts`, `lib/alerts.ts`, `lib/earnings.ts`
- Test: `tests/lib/fixtures.test.ts`, `tests/lib/alerts.test.ts`, `tests/lib/earnings.test.ts`
- Read: `preview/js/fixtures.js`, `preview/js/alerts.js`, `preview/js/doctor.js:114-132, 270-277`, `preview/tests/constraints.test.mjs:97-157`, `preview/tests/units.test.mjs:198-253`

**Interfaces:**
- Consumes: `FEE`-free `lib/format.ts` (Task 2) is not needed here; `lib/charts.ts` `BarDatum` for `dailySeries`.
- Produces: everything in the contract's `lib/fixtures.ts`, `lib/alerts.ts`, `lib/earnings.ts` sections.

- [ ] **Step 1: Alert tests — the seven ported plus the new branches**

`tests/lib/alerts.test.ts`: the seven tests from `units.test.mjs:209-253` verbatim (with `import { test } from 'vitest'; import assert from 'node:assert/strict'; import { credentialAlerts, alertSentence, gateFor, CREDENTIAL_LABELS } from '@/lib/alerts';`), then:

```ts
test('a rejected credential blocks and says so', () => {
  const [alert] = credentialAlerts(credentials({ dbs: { status: 'rejected', daysRemaining: null } }));
  assert.equal(alert.tone, 'blocking');
  assert.equal(alertSentence(alert), 'DBS check could not be verified.');
});

import { GATE_RECORDS, MY_RECORD, GPS } from '@/lib/fixtures';

test('the shipped record raises no gate — its indemnity is expiring, not expired', () => {
  assert.equal(gateFor(MY_RECORD), null);
  assert.equal(gateFor(GPS[0].credentials), null);
});

test('each gate record derives its own gate, in priority order', () => {
  assert.equal(gateFor(GATE_RECORDS['indemnity-expired']), 'indemnity-expired');
  assert.equal(gateFor(GATE_RECORDS['verification-rejected']), 'verification-rejected');
  assert.equal(gateFor(GATE_RECORDS['verification-pending']), 'verification-pending');
  assert.equal(gateFor(GATE_RECORDS['revalidation-due']), 'revalidation-due');
});

test('expired indemnity outranks a pending check on the same record', () => {
  const record = { ...GATE_RECORDS['verification-pending'], indemnity: { status: 'expired' as const, daysRemaining: 0 } };
  assert.equal(gateFor(record), 'indemnity-expired');
});

test('every credential key has a label', () => {
  assert.deepEqual(Object.keys(CREDENTIAL_LABELS), ['gmc', 'licence', 'cct', 'dbs', 'rightToWork', 'indemnity', 'revalidation']);
});
```

Run: `npx vitest run tests/lib/alerts.test.ts` → fails (module missing).

- [ ] **Step 2: `lib/alerts.ts`**

```ts
/* What the dashboard owes a GP before it owes them anything else: which of
   their credentials is about to stop them working, and how long they have.
   Derived from the credential record rather than typed as a second copy —
   an alert that can drift from the record it describes is worse than none. */
import type { CredentialKey, CredentialRecord, CredentialStatus, Credential, GateId } from '@/lib/fixtures';

export type AlertTone = 'blocking' | 'act' | 'watch';
export type CredentialAlert = {
  key: CredentialKey; label: string; status: CredentialStatus; daysRemaining: number | null; tone: AlertTone;
};

export const CREDENTIAL_KEYS = ['gmc', 'licence', 'cct', 'dbs', 'rightToWork', 'indemnity', 'revalidation'] as const satisfies readonly CredentialKey[];

export const CREDENTIAL_LABELS: Record<CredentialKey, string> = {
  gmc: 'GMC registration',
  licence: 'Licence to practise',
  cct: 'CCT / specialist registration',
  dbs: 'DBS check',
  rightToWork: 'Right to work',
  indemnity: 'Indemnity cover',
  revalidation: 'GMC revalidation',
};

// A status pill carries a word, not only a colour, and the word reads as
// English rather than as the fixture's own key.
export const STATUS_LABELS: Record<CredentialStatus, string> = {
  valid: 'Verified', expiring: 'Expiring', expired: 'Expired', pending: 'Pending', rejected: 'Rejected',
};

// Indemnity is the only credential whose lapse is unlawful to work through
// rather than merely non-compliant, so it is the only one that blocks.
const BLOCKING = new Set<CredentialKey>(['indemnity']);

export function credentialAlerts(
  credentials: Partial<Record<CredentialKey, Credential>>,
  { warnWithinDays = 30 }: { warnWithinDays?: number } = {},
): CredentialAlert[] {
  return (Object.entries(credentials) as [CredentialKey, Credential][])
    .map(([key, credential]) => {
      const { status, daysRemaining } = credential;
      const soon = typeof daysRemaining === 'number' && daysRemaining <= warnWithinDays;
      let tone: AlertTone | null = null;
      if (status === 'expired') tone = 'blocking';
      else if (status === 'rejected') tone = 'blocking';   // added for the onboarding statuses; no preview fixture produced one
      else if (status === 'expiring') tone = BLOCKING.has(key) ? 'blocking' : 'act';
      else if (status === 'pending') tone = 'watch';
      else if (soon) tone = 'watch';
      if (!tone) return null;
      return { key, label: CREDENTIAL_LABELS[key] ?? key, status, daysRemaining, tone };
    })
    .filter((alert): alert is CredentialAlert => alert !== null)
    .sort((a, b) => rank(b) - rank(a) || days(a) - days(b));
}

const RANK: Record<AlertTone, number> = { blocking: 3, act: 2, watch: 1 };
const rank = (alert: CredentialAlert) => RANK[alert.tone] ?? 0;
const days = (alert: CredentialAlert) => (typeof alert.daysRemaining === 'number' ? alert.daysRemaining : Infinity);

export function alertSentence(alert: Pick<CredentialAlert, 'label' | 'status'> & { daysRemaining?: number | null }): string {
  if (alert.status === 'expired') return `${alert.label} has expired.`;
  if (alert.status === 'rejected') return `${alert.label} could not be verified.`;
  if (alert.status === 'pending') return `${alert.label} is still being verified.`;
  const d = alert.daysRemaining;
  return `${alert.label} expires in ${d} day${d === 1 ? '' : 's'}.`;
}

/* Which gate, if any, replaces the dashboard. Derived from the same alerts
   the dashboard lists, so a gate and an alert can never disagree. Indemnity
   is a hard legal stop and wins; a rejected check beats a pending one;
   revalidation only ever warns (BLOCKING does not contain it). */
export function gateFor(credentials: CredentialRecord): GateId | null {
  const alerts = credentialAlerts(credentials);
  if (alerts.some((a) => a.key === 'indemnity' && a.status === 'expired')) return 'indemnity-expired';
  if (alerts.some((a) => a.status === 'rejected')) return 'verification-rejected';
  if (alerts.some((a) => a.status === 'pending')) return 'verification-pending';
  if (alerts.some((a) => a.key === 'revalidation')) return 'revalidation-due';
  return null;
}
```

- [ ] **Step 3: Fixture integrity tests — the preview's eight, plus the derivations**

`tests/lib/fixtures.test.ts` (vitest `test` + `node:assert/strict`, `import * as F from '@/lib/fixtures'`): port `constraints.test.mjs:99-157` verbatim (synthetic refs and no names; PRICE £39 + pharmacy; every GP credential status in `valid|expiring|expired|pending`; at least one expired indemnity; QUEUE 45-aligned; prescribing reconciles with consults and register breaches; prescribing refs synthetic; business pairs). Then add:

```ts
test('figures that appear twice are derived once', () => {
  assert.equal(F.DOCTOR.shift.patientsWaiting, F.FLOOR.waiting);
  assert.equal(F.DOCTOR.shift.gpsOnline, F.FLOOR.gpsOnline);
  assert.equal(F.DOCTOR.shift.gpsNeeded, F.FLOOR.gpsNeeded);
  assert.equal(F.DOCTOR.earningsToDate, F.DOCTOR.consultsCompleted * F.FEE);
  assert.equal(F.DOCTOR.consultsCompleted, F.PRESCRIBING.find((gp) => gp.ref === F.DOCTOR.ref)!.consults);
  assert.equal(F.DOCTOR.shift.earningsToday, F.DOCTOR_DASHBOARD.dailyConsults.at(-1)!.consults * F.FEE);
  assert.equal(F.PAYOUT_RUNS[0].gps, 3);
  assert.equal(F.PAYOUT_RUNS[0].status, 'Due');
  assert.equal(F.DASH, '—');
  assert.equal(F.DOCTOR.daysToRevalidation, F.MY_RECORD.revalidation.daysRemaining);
  assert.equal(F.DOCTOR.credentialsTotal, 7);
  assert.equal(F.BUSINESS.revenue, F.BUSINESS.consults * F.FEE);
  assert.equal(F.GOVERNANCE.breakGlass, F.BREAK_GLASS_LOG.length);
  assert.equal(F.PAYOUT_RUNS[0].amount, F.BUSINESS.consults * F.FEE);
});

test('there is no rating anywhere in the fixtures', () => {
  assert.ok(!JSON.stringify(F).toLowerCase().includes('rating'));
});

test('the gate records are reachable and each carries the status its gate needs', () => {
  assert.equal(F.GATE_RECORDS['indemnity-expired'].indemnity.status, 'expired');
  assert.equal(F.GATE_RECORDS['verification-rejected'].dbs.status, 'rejected');
  assert.equal(F.GATE_RECORDS['verification-pending'].gmc.status, 'pending');
  assert.equal(F.GATE_RECORDS['revalidation-due'].revalidation.daysRemaining, F.DOCTOR.revalidationDueInDays);
});

test('applications in verification are the GPs with a pending credential', () => {
  assert.deepEqual(F.applicationsInVerification(), [{ ref: 'GP-004', stage: 'GMC registration' }]);
});

test('skills carry the six clinical areas with the preview defaults', () => {
  assert.deepEqual(F.SKILLS.map((s) => [s.label, s.defaultOn]), [
    ['General adult medicine', true], ['Minor illness', true], ["Women's health", false],
    ['Mental health', false], ['Paediatrics (age 5+)', false], ['Dermatology', false],
  ]);
});

test('every break-glass row carries a reason', () => {
  for (const row of F.BREAK_GLASS_LOG) assert.ok(row.reason.length > 0);
});
```

- [ ] **Step 4: `lib/fixtures.ts`**

Port `preview/js/fixtures.js` in the same order with the contract's types, applying exactly these edits: (a) `DOCTOR` becomes the derived object in the contract (note `MY_RECORD` must be declared before `DOCTOR` — declare `GPS` first, then `MY_RECORD`, then `DOCTOR`); (b) `DOCTOR_DASHBOARD` loses `ratingAverage` and `ratingCount`; (c) `BUSINESS.revenue` becomes `BUSINESS.consults * FEE` (declare `consults` first: `const CONSULTS_TO_DATE = 120;`); (d) `GOVERNANCE` gains `reachedEmergencyScreen: 2`, `complaintResolutionDays: 5`, and `breakGlass: BREAK_GLASS_LOG.length`; (e) append the new exports. The comment block "Today, for every screen in this prototype, is 28 August 2026." stays. Skeleton of the new tail:

```ts
export const MY_RECORD: CredentialRecord = GPS.find((gp) => gp.ref === 'GP-002')!.credentials;

const verified = (record: CredentialRecord) =>
  Object.values(record).filter((c) => c.status === 'valid' || c.status === 'expiring').length;

// Declaration order: FEE, GPS, MY_RECORD, FLOOR, BREAK_GLASS_LOG, GOVERNANCE, PRESCRIBING,
// BUSINESS, then DOCTOR — every derived figure reads something declared above it.
const MY_PRESCRIBING = PRESCRIBING.find((gp) => gp.ref === 'GP-002')!;

export const DOCTOR = {
  ref: 'GP-002',
  consultsCompleted: MY_PRESCRIBING.consults,        // 40 — governance and "to date" cannot disagree
  earningsToDate: MY_PRESCRIBING.consults * FEE,     // 1560
  credentialsVerified: verified(MY_RECORD),
  credentialsTotal: Object.keys(MY_RECORD).length,
  daysToRevalidation: MY_RECORD.revalidation.daysRemaining,
  // The revalidation-due gate exists to show the warning, so it keeps its own number.
  revalidationDueInDays: 18,
  shift: {
    gpsOnline: FLOOR.gpsOnline, gpsNeeded: FLOOR.gpsNeeded, patientsWaiting: FLOOR.waiting,
    minutesOnline: 42,
    earningsToday: 3 * FEE,   // today's three consultations (dailyConsults ends on 3)
  },
} as const;

export const GATE_RECORDS: Record<GateId, CredentialRecord> = { /* per the contract */ };
export const SKILLS: Skill[] = [ /* per the contract */ ];
export const DEMAND_BY_HOUR = DOCTOR_DASHBOARD.demandByHour;

// Governance evidence the prototype spec names and the preview never drew.
// One row each, round, synthetic; the count above is derived from the log.
export const BREAK_GLASS_LOG = [
  { when: '26 August, 21:14', actor: 'Admin', record: 'C-0031', reason: 'Safeguarding concern raised by GP-002' },
] as const;
export const AUDIT_LOG = [
  { when: '28 August, 09:02', actor: 'System', action: 'Indemnity cover for GP-003 marked expired' },
  { when: '27 August, 16:40', actor: 'Admin', action: 'Restricted items register reviewed' },
  { when: '26 August, 21:14', actor: 'Admin', action: 'Break-glass access to C-0031' },
] as const;
// One run, due on the payout date, paying every consultation PRESCRIBING attributes
// to a GP — so its GP count is the three prescribers, not the two online now.
export const PAYOUT_RUNS = [{
  period: DOCTOR_DASHBOARD.payout.period, date: DOCTOR_DASHBOARD.payout.date,
  gps: PRESCRIBING.filter((gp) => gp.consults > 0).length, consults: BUSINESS.consults,
  amount: BUSINESS.consults * FEE, status: 'Due',
}] as const;

export type Application = { ref: string; stage: string };
export function applicationsInVerification(gps: readonly Gp[] = GPS): Application[] {
  return gps.flatMap((gp) => {
    const pending = (Object.keys(gp.credentials) as CredentialKey[]).find((k) => gp.credentials[k].status === 'pending');
    return pending ? [{ ref: gp.ref, stage: CREDENTIAL_LABELS[pending] }] : [];
  });
}
```
`CREDENTIAL_LABELS` is imported from `@/lib/alerts` — and `alerts.ts` imports only *types* from fixtures, so there is no runtime cycle. (Keep `import type` in `alerts.ts`.)

- [ ] **Step 5: Earnings — one function, tested for the £39 delta**

`lib/earnings.ts`:

```ts
/* Every earnings figure the doctor surface shows, derived once from the
   fixtures and from what this session produced, so the dashboard and the
   earnings screen can never disagree. Consults are the unit; money is
   consults × FEE and nothing else. */
import { DOCTOR, DOCTOR_DASHBOARD as D, FEE, type RecentConsult } from '@/lib/fixtures';
import type { BarDatum } from '@/lib/charts';

export type SessionRecord = RecentConsult & { isNew: true };
export type Earnings = {
  todayConsults: number; weekConsults: number; fortnightConsults: number; toDateConsults: number;
  today: number; week: number; fortnight: number; toDate: number; payoutAmount: number;
  recent: Array<RecentConsult | SessionRecord>;
  dailySeries: BarDatum[];
  busiest: { label: string; consults: number } | null;
};

export function earningsFor({ seeded, session }: { seeded: boolean; session: SessionRecord[] }): Earnings {
  const days = D.dailyConsults.map((d) => ({ ...d, consults: seeded ? d.consults : 0 }));
  days[days.length - 1].consults += session.length;
  const sum = (list: { consults: number }[]) => list.reduce((n, d) => n + d.consults, 0);
  const todayConsults = days[days.length - 1].consults;
  const weekConsults = sum(days.slice(-7));
  const fortnightConsults = sum(days);
  const toDateConsults = (seeded ? DOCTOR.consultsCompleted : 0) + session.length;
  const busiest = fortnightConsults === 0 ? null : days.reduce((b, d) => (d.consults > b.consults ? d : b));
  return {
    todayConsults, weekConsults, fortnightConsults, toDateConsults,
    today: todayConsults * FEE, week: weekConsults * FEE, fortnight: fortnightConsults * FEE,
    toDate: toDateConsults * FEE, payoutAmount: weekConsults * FEE,
    recent: [...session, ...(seeded ? D.recent : [])],
    dailySeries: days.map((d, i) => ({ label: d.label, value: d.consults, emph: i === days.length - 1 ? 'true' : 'false' })),
    busiest,
  };
}
```

`tests/lib/earnings.test.ts`:

```ts
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { earningsFor } from '@/lib/earnings';

const record = { id: 'C-0032', when: 'Today, 15:02', ageBand: '30–39', minutes: 9, outcome: 'Recorded in Semble', isNew: true as const };

test('seeded figures are the preview arithmetic, with consults to date from PRESCRIBING', () => {
  const e = earningsFor({ seeded: true, session: [] });
  assert.deepEqual([e.fortnightConsults, e.weekConsults, e.todayConsults, e.toDateConsults], [23, 12, 3, 40]);
  assert.deepEqual([e.fortnight, e.payoutAmount, e.today, e.toDate], [897, 468, 117, 1560]);
  assert.deepEqual(e.busiest, { label: '18', consults: 3 });   // the first maximum wins
  assert.equal(e.recent.length, 5);
  assert.equal(e.dailySeries.filter((d) => d.emph === 'true').length, 1);
  assert.equal(Math.round((e.weekConsults / e.fortnightConsults) * 100), 52);   // the payout meter
});

test('blank mode plus one session record shows only what happened', () => {
  const e = earningsFor({ seeded: false, session: [record] });
  assert.deepEqual([e.today, e.week, e.fortnight, e.toDate], [39, 39, 39, 39]);
  assert.deepEqual(e.busiest, { label: '28', consults: 1 });
  assert.deepEqual(e.recent, [record]);
});

test('blank mode has nothing, and nothing is the only figure it has', () => {
  const e = earningsFor({ seeded: false, session: [] });
  assert.deepEqual([e.fortnight, e.week, e.today, e.toDate], [0, 0, 0, 0]);
  assert.equal(e.busiest, null);
  assert.deepEqual(e.recent, []);
  assert.ok(e.dailySeries.every((d) => d.value === 0));
});

test('one completed consultation moves every figure by exactly one fee, in both modes', () => {
  for (const seeded of [true, false]) {
    const before = earningsFor({ seeded, session: [] });
    const after = earningsFor({ seeded, session: [record] });
    assert.equal(after.today - before.today, 39);
    assert.equal(after.week - before.week, 39);
    assert.equal(after.fortnight - before.fortnight, 39);
    assert.equal(after.toDate - before.toDate, 39);
    assert.equal(after.recent[0], record);
    assert.equal(after.dailySeries.at(-1)!.value, before.dailySeries.at(-1)!.value + 1);
  }
});
```

- [ ] **Step 6: Run, typecheck, commit**

Run: `npx vitest run tests/lib` → green (52 + 12 alerts + 14 fixtures + 3 earnings). `npm run typecheck` → green. `npm test` → green (constraints scans `lib/fixtures.ts`: no medicine, no `rating`, refs only).

```bash
git add lib/fixtures.ts lib/alerts.ts lib/earnings.ts tests/lib/alerts.test.ts tests/lib/fixtures.test.ts tests/lib/earnings.test.ts
git commit -m "feat(lib): typed fixtures, credential alerts with gates, earnings derived once

fixtures.ts is the preview's data with figures that appeared twice derived
once (the shift from FLOOR, credential counts and revalidation from the
record, revenue from consults × FEE) and the rating removed. alerts.ts gains
a rejected branch and gateFor(), so the four gates come from the record the
alerts come from. earningsFor() folds this session's consultations in, and
a test pins the delta at exactly one fee.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Data mode provider with URL-persisted query state, and the test helpers

> Note on names: the brief and the tests review call the navigation mock `tests/helpers/next-navigation.ts` (the task map's summary says `navigation-mock` — same file). The tests review §9–10 stamps `dataset.mode`; the Interface contract and Decision 32 say `dataset.figures`, and the contract wins. `useFigures().shown` keeps the contract's exact signature `<T>(v: T, f?: (v: T) => string) => string`; `live` is `lib/placeholder.ts`'s own function passed through. `render-doctor.tsx` is not created here — it needs `DoctorProviders` and `AppShell` and is built on `renderAt` in Task 13.

**Files:**
- Create: `lib/data-mode.tsx`, `tests/helpers/dom-stubs.ts`, `tests/helpers/next-navigation.ts`, `tests/helpers/render-at.tsx`
- Test: `tests/data-mode.test.tsx`
- Read: `lib/placeholder.ts` (Task 2: `DASH`, `live`, `Format`, `DataMode`), `preview/js/placeholder.js:59-71` (`markDocument`, `dataModeFromLocation` — the behaviour being ported), `components/LandingBehavior.tsx:71-95` (the landing page's `replaceState` and `data-role` stamping — the precedent for a DOM stamp set in an effect), `tests/landing-behavior.test.tsx:39-47, 116-128` (the `beforeEach` shape and the StrictMode double-mount test), `tests/helpers/io-stub.ts` (the stub-class convention `dom-stubs.ts` extends), `hooks/use-mobile.ts:12` (the unguarded `matchMedia` the stubs exist for), `app/globals.css:440-441` (the `[data-mode="gp"]` rules the stamp must never match)

**Interfaces:**
- Consumes: `DASH`, `live`, `type DataMode` from `@/lib/placeholder` (Task 2); `usePathname` from `next/navigation`; `useEffectEvent` from `react` (React 19.2 — the `"react": "^19.2.0"` floor already in `package.json`); `installIOStub` from `tests/helpers/io-stub.ts`.
- Produces, exactly as the contract's `lib/data-mode.tsx` section: `type DataMode`, `usePersistedQuery(key)`, `DataModeProvider({ children })`, `useDataMode()`, `useFigures()`. Test helpers: `installDomStubs(options?)`, `DomStubOptions`, `ResizeObserverStub`, `installMatchMedia(matches?)`, `setDocumentHidden(hidden)` from `dom-stubs.ts`; `nav`, `resetNav(pathname?)`, `usePathname`, `useRouter`, `useSearchParams`, `notFound` from `next-navigation.ts`; `renderAt(ui, { pathname, query?, providers?, ...stubs })` returning `RenderResult & { setPath(next) }`, `RenderAtOptions`, and a re-exported `nav` from `render-at.tsx`. Later callers: Task 5 (`use-live-interval.test.tsx` uses `installDomStubs` and `setDocumentHidden`), Tasks 9–12 (component tests render through `renderAt`), Task 13 (`DoctorProvider` reads `usePersistedQuery('gate')`, `StateJumper` reads `usePersistedQuery('jumper')`, `SessionProvider` and `DataModeSwitch` read `useDataMode()`, `render-doctor.tsx` wraps `renderAt`), Tasks 14–25 (every figure passes through `useFigures()`).

- [ ] **Step 1: The three test helpers, so the test that follows can be written against them**

`tests/helpers/dom-stubs.ts`:

```ts
import { vi } from 'vitest';
import { installIOStub } from './io-stub';

// jsdom 26 has no ResizeObserver and no matchMedia, a "not implemented" scrollTo
// and no pointer capture. hooks/use-mobile.ts calls matchMedia unguarded inside
// SidebarProvider, so every shell render throws until these are in place. Each
// stub records what it was given so a test can fire it by hand.
export class ResizeObserverStub {
  static instances: ResizeObserverStub[] = [];
  observed: Element[] = [];
  constructor(public cb: ResizeObserverCallback) { ResizeObserverStub.instances.push(this); }
  observe(el: Element) { this.observed.push(el); }
  unobserve(el: Element) { this.observed = this.observed.filter((e) => e !== el); }
  disconnect() { this.observed = []; }
  // ChartFrame reads entry.contentRect.width.
  resize(target: Element, width: number, height = 150) {
    this.cb(
      [{ target, contentRect: { width, height } } as unknown as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
  static forElement(el: Element) {
    return ResizeObserverStub.instances.find((ro) => ro.observed.includes(el));
  }
}

export function installMatchMedia(matches: Record<string, boolean> = {}) {
  vi.stubGlobal('matchMedia', vi.fn((query: string): MediaQueryList => ({
    matches: matches[query] ?? false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  })));
}

// `document.hidden` is a prototype getter tied to jsdom's pretendToBeVisual;
// override it on the instance and raise the event the live-interval hook listens for.
export function setDocumentHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  Object.defineProperty(document, 'visibilityState', {
    configurable: true, get: () => (hidden ? 'hidden' : 'visible'),
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

export type DomStubOptions = { mobile?: boolean; reducedMotion?: boolean; width?: number };

export function installDomStubs({ mobile = false, reducedMotion = false, width }: DomStubOptions = {}) {
  ResizeObserverStub.instances = [];
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  installIOStub();
  installMatchMedia({
    '(max-width: 899px)': mobile,                      // hooks/use-mobile.ts: MOBILE_BREAKPOINT - 1
    '(prefers-reduced-motion: reduce)': reducedMotion, // lib/live.ts startInterval
  });
  Object.defineProperty(window, 'innerWidth', {
    configurable: true, writable: true, value: width ?? (mobile ? 390 : 1440),
  });
  vi.stubGlobal('scrollTo', vi.fn());
  Element.prototype.scrollIntoView ??= vi.fn();          // Radix Select
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  // Put the prototype getters back in case a previous test overrode them.
  delete (document as unknown as Record<string, unknown>).hidden;
  delete (document as unknown as Record<string, unknown>).visibilityState;
  document.documentElement.className = 'js';
}
```

`tests/helpers/next-navigation.ts`:

```ts
import { vi } from 'vitest';

// The mock module for 'next/navigation'. vi.mock is hoisted per test file, so each
// file registers it: vi.mock('next/navigation', () => import('./helpers/next-navigation')).
// One router object for the whole file: an effect keyed on `router` must never see a new one.
export const nav = {
  pathname: '/doctor',
  router: {
    replace: vi.fn<(href: string) => void>(),
    push: vi.fn<(href: string) => void>(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  },
};

export function resetNav(pathname = '/doctor') {
  nav.pathname = pathname;
  nav.router.replace.mockReset();
  nav.router.push.mockReset();
}

export const usePathname = () => nav.pathname;
export const useRouter = () => nav.router;

// The static shell forbids it (it bails the route to client rendering), so the
// mock refuses it too rather than quietly handing back the query.
export const useSearchParams = () => {
  throw new Error('useSearchParams is banned (static shell)');
};

export function notFound(): never {
  const error = new Error('NEXT_HTTP_ERROR_FALLBACK;404') as Error & { digest: string };
  error.digest = 'NEXT_HTTP_ERROR_FALLBACK;404';
  throw error;
}
```

`tests/helpers/render-at.tsx`:

```tsx
import { render, type RenderResult } from '@testing-library/react';
import type { ComponentType, ReactNode } from 'react';
import { nav, resetNav } from './next-navigation';
import { installDomStubs, type DomStubOptions } from './dom-stubs';

export type RenderAtOptions = DomStubOptions & {
  pathname: string;
  query?: string;                                    // without the leading '?'
  providers?: ComponentType<{ children: ReactNode }>;
};

// pushState, as <Link> does: a spy on replaceState then sees only what the app wrote.
function setLocation(pathname: string, query?: string) {
  window.history.pushState(null, '', query ? `${pathname}?${query}` : pathname);
}

// Render `ui` as if the app router were at `pathname`: dom stubs installed, the
// navigation mock pointed there, window.location set so a post-mount read of the
// query finds it. Provider-agnostic — each surface's render helper wraps this.
export function renderAt(
  ui: ReactNode,
  { pathname, query, providers, ...stubs }: RenderAtOptions,
): RenderResult & { setPath: (next: string) => void } {
  installDomStubs(stubs);
  resetNav(pathname);
  setLocation(pathname, query?.replace(/^\?/, ''));
  const result = render(ui, { wrapper: providers });
  return Object.assign(result, {
    // A client navigation: the mocked usePathname changes and the tree re-renders,
    // which is what the providers' pathname-keyed effects run on. A <Link> goes to
    // exactly its href, so a query not in `next` is dropped — the case re-stamping exists for.
    setPath(next: string) {
      const url = new URL(next, window.location.origin);
      nav.pathname = url.pathname;
      setLocation(url.pathname, url.search.slice(1) || undefined);
      result.rerender(ui);
    },
  });
}

export { nav };
```

Run: `npm run typecheck` → green (the helpers are under `**/*.ts(x)` in `tsconfig.json` and must compile strict on their own).

- [ ] **Step 2: The data-mode test, written against the contract, so it fails on the missing module**

`tests/data-mode.test.tsx`:

```tsx
// @vitest-environment jsdom
import { test, expect, beforeEach, vi } from 'vitest';
import { StrictMode, type ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
vi.mock('next/navigation', () => import('./helpers/next-navigation'));
import { renderAt } from './helpers/render-at';
import { DataModeProvider, useDataMode, useFigures, usePersistedQuery } from '@/lib/data-mode';
import { DASH } from '@/lib/placeholder';

beforeEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// Reads every hook the surfaces will read, so one render answers for the mode,
// the stamp and the figures together.
function Probe() {
  const { mode, seeded, setMode } = useDataMode();
  const figures = useFigures();
  return (
    <div>
      <output data-testid="mode">{mode}</output>
      <output data-testid="seeded">{String(seeded)}</output>
      <output data-testid="shown-zero">{figures.shown(0)}</output>
      <output data-testid="shown-three">{figures.shown(3)}</output>
      <output data-testid="shown-money">{figures.shown(39, (v) => `£${v}`)}</output>
      <output data-testid="live-one">{figures.live(1)}</output>
      <output data-testid="live-zero">{figures.live(0)}</output>
      <output data-testid="list">{figures.seedList(['GP-001', 'GP-002']).join(' ')}</output>
      <output data-testid="dash">{figures.DASH}</output>
      <button type="button" onClick={() => setMode('placeholder')}>Blank</button>
      <button type="button" onClick={() => setMode('seeded')}>Seeded</button>
    </div>
  );
}

// A second key on the same URL, the way DoctorProvider will read ?gate= (Task 13).
function GateProbe() {
  const [gate] = usePersistedQuery('gate');
  return <output data-testid="gate">{gate ?? ''}</output>;
}

const out = (id: string) => screen.getByTestId(id);
const text = (id: string) => out(id).textContent;
const stamp = () => document.documentElement.dataset.figures;
const params = () => new URLSearchParams(window.location.search);

test('every surface starts blank: no query is placeholder mode', () => {
  renderAt(<Probe />, { pathname: '/doctor', providers: DataModeProvider });
  expect(text('mode')).toBe('placeholder');
  expect(text('seeded')).toBe('false');
  expect(stamp()).toBe('placeholder');
  expect(text('shown-three')).toBe(DASH);
  expect(text('shown-money')).toBe(DASH);
  expect(out('list')).toBeEmptyDOMElement();
  expect(window.location.search).toBe('');
});

test('?data=seeded seeds the figures and stamps html[data-figures]; leaving the surface removes the stamp', () => {
  const { unmount } = renderAt(<Probe />, { pathname: '/admin', query: 'data=seeded', providers: DataModeProvider });
  expect(text('mode')).toBe('seeded');
  expect(text('seeded')).toBe('true');
  expect(stamp()).toBe('seeded');
  expect(text('shown-three')).toBe('3');
  expect(text('shown-money')).toBe('£39');
  expect(text('list')).toBe('GP-001 GP-002');
  unmount();
  expect(stamp()).toBeUndefined();
});

test('?data=demo is not a mode: the figures stay blank', () => {
  renderAt(<Probe />, { pathname: '/doctor', query: 'data=demo', providers: DataModeProvider });
  expect(text('mode')).toBe('placeholder');
  expect(stamp()).toBe('placeholder');
  expect(text('shown-three')).toBe(DASH);
});

test('nothing is written to history during mount, even under a StrictMode double-mount', () => {
  const replace = vi.spyOn(window.history, 'replaceState');
  const Strict = ({ children }: { children: ReactNode }) => (
    <StrictMode><DataModeProvider>{children}</DataModeProvider></StrictMode>
  );
  const { setPath } = renderAt(<Probe />, { pathname: '/doctor', query: 'data=seeded', providers: Strict });
  expect(text('mode')).toBe('seeded');
  expect(replace).not.toHaveBeenCalled();
  setPath('/doctor/earnings');
  expect(replace).toHaveBeenCalledTimes(1);
});

test('a client navigation drops the query and the provider stamps it back, once', () => {
  const replace = vi.spyOn(window.history, 'replaceState');
  const { setPath } = renderAt(<Probe />, { pathname: '/doctor', query: 'data=seeded', providers: DataModeProvider });
  setPath('/doctor/earnings');
  expect(window.location.pathname).toBe('/doctor/earnings');
  expect(window.location.search).toBe('?data=seeded');
  expect(replace).toHaveBeenCalledTimes(1);
  expect(replace).toHaveBeenCalledWith(null, '', '/doctor/earnings?data=seeded');
  expect(text('mode')).toBe('seeded');
  // The URL already carries the mode: re-stamping is a no-op, so the router sees no restore.
  setPath('/doctor/profile?data=seeded');
  expect(replace).toHaveBeenCalledTimes(1);
  expect(window.location.search).toBe('?data=seeded');
});

test('setMode("placeholder") strips the query and setMode("seeded") writes it', () => {
  renderAt(<Probe />, { pathname: '/admin', query: 'data=seeded', providers: DataModeProvider });
  fireEvent.click(screen.getByRole('button', { name: 'Blank' }));
  expect(text('mode')).toBe('placeholder');
  expect(stamp()).toBe('placeholder');
  expect(window.location.search).toBe('');
  expect(text('shown-three')).toBe(DASH);
  fireEvent.click(screen.getByRole('button', { name: 'Seeded' }));
  expect(text('mode')).toBe('seeded');
  expect(stamp()).toBe('seeded');
  expect(window.location.search).toBe('?data=seeded');
});

test('gate= and data= coexist: each key keeps its own value through a mode change and a navigation', () => {
  const { setPath } = renderAt(<><Probe /><GateProbe /></>, {
    pathname: '/doctor', query: 'gate=indemnity-expired&data=seeded', providers: DataModeProvider,
  });
  expect(text('gate')).toBe('indemnity-expired');
  fireEvent.click(screen.getByRole('button', { name: 'Blank' }));
  expect(window.location.search).toBe('?gate=indemnity-expired');
  fireEvent.click(screen.getByRole('button', { name: 'Seeded' }));
  expect(params().get('gate')).toBe('indemnity-expired');
  expect(params().get('data')).toBe('seeded');
  setPath('/doctor/earnings');   // a <Link> drops both; both hooks stamp theirs back
  expect(params().get('gate')).toBe('indemnity-expired');
  expect(params().get('data')).toBe('seeded');
  expect(text('gate')).toBe('indemnity-expired');
});

test('useFigures: zero is the dash in both modes; live(1) shows in blank mode', () => {
  renderAt(<Probe />, { pathname: '/doctor', providers: DataModeProvider });
  expect(text('shown-zero')).toBe(DASH);
  expect(text('live-zero')).toBe(DASH);
  expect(text('live-one')).toBe('1');
  expect(text('dash')).toBe('—');
  cleanup();
  renderAt(<Probe />, { pathname: '/doctor', query: 'data=seeded', providers: DataModeProvider });
  expect(text('shown-zero')).toBe(DASH);
  expect(text('live-zero')).toBe(DASH);
  expect(text('live-one')).toBe('1');
});

test('useDataMode outside the provider is a programming error, not a silent blank', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});   // the throw is also reported; keep the run quiet
  expect(() => render(<Probe />)).toThrow('useDataMode outside DataModeProvider');
});
```

Run: `npx vitest run tests/data-mode.test.tsx` → the file fails to load: `Failed to resolve import "@/lib/data-mode"`.

- [ ] **Step 3: `lib/data-mode.tsx`**

The hook is the contract's, verbatim (verified against Next 16.3.3's history patch, `app-router.js:233-306`): never write during the mount commit, pass `null` as the state argument, re-stamp on `pathname` only.

```tsx
'use client';

/* Which figures a dashboard may show. The mode is provider state seeded from
   `?data=seeded` once after mount — never a render-time read of the URL, so the
   static shell and the client's first render agree on blank — and stamped back
   onto the URL after every client navigation, so a reload or a copied link
   keeps it. Each surface mounts its own provider in its layout; there is no
   global, and the admin surface cannot see the doctor's mode. */

import {
  createContext, useCallback, useContext, useEffect, useEffectEvent, useMemo, useState, type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { DASH, live, type DataMode } from '@/lib/placeholder';

export type { DataMode };

function writeQuery(key: string, value: string | null) {
  const url = new URL(window.location.href);
  if ((url.searchParams.get(key) ?? null) === value) return;   // no-op → no ACTION_RESTORE
  if (value === null) url.searchParams.delete(key);
  else url.searchParams.set(key, value);
  // `null`, not history.state: Next's patched replaceState re-attaches __NA and the
  // router tree when data is null and dispatches ACTION_RESTORE, so usePathname agrees;
  // passing the existing state, which carries __NA, makes it skip that sync. A restore
  // never scrolls.
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
}

export function usePersistedQuery(key: string): [value: string | null, set: (v: string | null) => void] {
  const pathname = usePathname();
  const [value, setValue] = useState<string | null>(null);   // server and first client render: null
  const [ready, setReady] = useState(false);

  // Read once after mount. Never write here: on the hydration commit this runs before
  // AppRouter's effect has patched history.replaceState, and a native write with null
  // state would strip __NA — Back to this entry would then dead-end (app-router.js onPopState).
  useEffect(() => {
    setValue(new URLSearchParams(window.location.search).get(key));
    setReady(true);
  }, [key]);

  // Re-stamp after every client navigation: <Link> navigates to exactly its href, so the
  // query is dropped. `ready` is false throughout the mount commit and StrictMode's re-run
  // of it, so the first write can only follow a real navigation, once the patch is in.
  const restamp = useEffectEvent(() => { if (ready) writeQuery(key, value); });
  useEffect(() => { restamp(); }, [pathname]);

  const set = useCallback((v: string | null) => { setValue(v); writeQuery(key, v); }, [key]);
  return [value, set];
}

type DataModeContextValue = { mode: DataMode; seeded: boolean; setMode: (m: DataMode) => void };
const DataModeContext = createContext<DataModeContextValue | null>(null);

export function DataModeProvider({ children }: { children: ReactNode }) {
  const [data, setData] = usePersistedQuery('data');
  const mode: DataMode = data === 'seeded' ? 'seeded' : 'placeholder';
  const setMode = useCallback((m: DataMode) => setData(m === 'seeded' ? 'seeded' : null), [setData]);

  // The port of markDocument. Named `figures`, not `mode`, so the landing page's
  // `[data-mode="gp"]` rules (globals.css:440) can never match a dashboard element.
  // Server HTML carries no stamp, so it doubles as the screenshot script's hydration
  // signal; leaving the surface takes it with it.
  useEffect(() => {
    document.documentElement.dataset.figures = mode;
    return () => { delete document.documentElement.dataset.figures; };
  }, [mode]);

  const value = useMemo(() => ({ mode, seeded: mode === 'seeded', setMode }), [mode, setMode]);
  return <DataModeContext.Provider value={value}>{children}</DataModeContext.Provider>;
}

export function useDataMode(): DataModeContextValue {
  const context = useContext(DataModeContext);
  if (!context) throw new Error('useDataMode outside DataModeProvider');
  return context;
}

// shown() and seedList() bound to this surface's mode. A figure only a running
// platform could produce is a dash until seeded; live() is what this session
// produced and passes through as it is (zero is still a dash).
export function useFigures(): {
  seeded: boolean;
  DASH: string;
  shown: <T>(v: T, f?: (v: T) => string) => string;
  live: typeof live;
  seedList: <T>(l: readonly T[]) => T[];
} {
  const { seeded } = useDataMode();
  return useMemo(() => ({
    seeded,
    DASH,
    shown: <T,>(v: T, f?: (v: T) => string) => (seeded ? live(v, f) : DASH),
    live,
    seedList: <T,>(l: readonly T[]) => (seeded ? [...l] : []),
  }), [seeded]);
}
```

The module never touches `lib/placeholder.ts`'s own `setDataMode` singleton: that is module-global, would be shared by both surfaces in one bundle, and would leak between unit tests. The provider is the mode; the singleton stays for the ported unit tests and non-React callers, as the placeholder module's comment says.

Run: `npx vitest run tests/data-mode.test.tsx` → 9 passed.

- [ ] **Step 4: The whole suite and the typecheck**

Run: `npm test` → green (`tests/constraints.test.ts` now scans `lib/data-mode.tsx`: no hex, no `dark:`, no arbitrary colour function, no medicine, no banned wording). `npm run typecheck` → green (the `.tsx` generic arrows use the `<T,>` form; `useEffectEvent` is typed in `@types/react` 19.2.18).

- [ ] **Step 5: Commit**

```bash
git add lib/data-mode.tsx tests/helpers/dom-stubs.ts tests/helpers/next-navigation.ts tests/helpers/render-at.tsx tests/data-mode.test.tsx
git commit -m "feat(app): data mode provider with URL-persisted query state

DataModeProvider holds the blank/seeded mode as provider state, read from
?data=seeded once after mount and stamped back onto the URL after every
client navigation so a reload or a copied link keeps it; nothing writes to
history during the mount commit, and the stamp on <html> is data-figures so
the landing page's data-mode rules can never match. useFigures() binds
shown() and seedList() to that mode. The test helpers — the jsdom stubs, the
next/navigation mock and a provider-agnostic renderAt() — are what every
component test from here on renders through.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Live interval hook and the offer countdown

> Contract notes. (1) `aria-valuenow` on the countdown's `Progress` is a percentage (100 at 45 s), because `components/ui/progress.tsx` maps `value` straight to the bar's percent and Decision 11 freezes `ui/`; the seconds are carried by `aria-valuetext` through `getValueLabel`, exactly as the contract specifies — the tests review's `aria-valuenow="45"` / "empty at 45" recipe is superseded by the contract's "45 seconds to accept on arrival". (2) The Countdown tests live in `tests/countdown.test.tsx` as the brief names them (Task 9's `app-components.test.tsx` does not exist yet). (3) The test helpers are the task map's Task 4 names, `tests/helpers/dom-stubs.ts` and `tests/helpers/navigation-mock.ts` (the tests review calls the second `next-navigation.ts`; the plan's name wins). (4) The hook module carries no `'use client'`, matching `hooks/use-mobile.ts` — a hook is only ever imported by a client component, so the directive would mark nothing.

**Files:**
- Create: `hooks/use-live-interval.ts`, `components/app/Countdown.tsx`
- Modify: `app/dev/ui/gallery.tsx` (one import, one nav entry, a `countdown` section after `progress`)
- Test: `tests/use-live-interval.test.tsx`, `tests/countdown.test.tsx`
- Read: `lib/live.ts` (Task 2 — `startInterval`), `components/ui/progress.tsx`, `app/dev/ui/gallery.tsx`, `preview/doctor.html:407-436` (the two offer screens; the countdown node at 416 and 433), `preview/js/doctor.js:330-343` (the numeral is `${offer.remaining}s`), `preview/css/components.css:70` (`.countdown { font-variant-numeric: tabular-nums; font-weight: 800; font-size: 40px; }`), `tests/helpers/dom-stubs.ts` and `tests/helpers/navigation-mock.ts` (Task 4)

**Interfaces:**
- Consumes: `startInterval(fn: () => void, ms: number, win?): () => void` from `@/lib/live` (Task 2); `Progress` from `@/components/ui/progress` (unchanged: `value` is a percent, `className` merges onto the root, `getValueLabel` and `aria-label` pass through to Radix); `cn` from `@/lib/utils`; from Task 4's helpers, `installDomStubs(opts?: { mobile?: boolean; reducedMotion?: boolean; width?: number }): void` and `setDocumentHidden(hidden: boolean): void` (`tests/helpers/dom-stubs.ts`), and the `next/navigation` mock module (`tests/helpers/navigation-mock.ts`).
- Produces: `useLiveInterval(fn: (now: number) => void, ms: number, active?: boolean): void` (default `active = true`) — called by `SessionProvider` (Task 13: `useLiveInterval(setClock, 1000, state.online)` and the `tickOffer` tick) and `LiveFloor` (Task 22); `<Countdown remaining={number} total={45} />` — rendered by `Offer` (Task 20) on both offer screens; the markers `data-slot="countdown"` (root) and `data-slot="countdown-value"` (the `aria-hidden` numerals); the sr-only `aria-live="assertive" aria-atomic="true"` region whose text is `"45 seconds to accept"` on arrival, then `"30 seconds left to accept"`, `"15 seconds left to accept"`, `"5 seconds left to accept"`, and `""` at every other second; `aria-label="Time left to accept"` and `aria-valuetext="{remaining} seconds left"` on the progressbar.

- [ ] **Step 1: The hook's tests first, so they fail on the missing module**

`tests/use-live-interval.test.tsx`:

```tsx
// @vitest-environment jsdom
import { test, expect, beforeEach, vi } from 'vitest';
import { StrictMode } from 'react';
import { render, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
vi.mock('next/navigation', () => import('./helpers/navigation-mock'));
import { installDomStubs, setDocumentHidden } from './helpers/dom-stubs';
import { useLiveInterval } from '@/hooks/use-live-interval';

const T0 = Date.parse('2026-08-28T14:00:00Z');
const tick = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

function Harness({ fn, ms = 1000, active = true }: { fn: (now: number) => void; ms?: number; active?: boolean }) {
  useLiveInterval(fn, ms, active);
  return null;
}

beforeEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  installDomStubs();
  // Vitest fakes Date with the timers, so every tick sees the advanced clock;
  // setSystemTime must come after useFakeTimers.
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});

test('ticks once a second with the wall clock and clears on unmount', () => {
  const fn = vi.fn();
  const { unmount } = render(<Harness fn={fn} />);
  expect(fn).not.toHaveBeenCalled();
  tick(3_000);
  expect(fn).toHaveBeenCalledTimes(3);
  expect(fn).toHaveBeenLastCalledWith(T0 + 3_000);
  unmount();
  tick(5_000);
  expect(fn).toHaveBeenCalledTimes(3);
});

test('stops while the tab is hidden and catches up the moment it returns', () => {
  const fn = vi.fn();
  render(<Harness fn={fn} />);
  tick(3_000);
  act(() => setDocumentHidden(true));
  tick(5_000);
  expect(fn).toHaveBeenCalledTimes(3);
  act(() => setDocumentHidden(false));
  expect(fn).toHaveBeenCalledTimes(4);
  expect(fn).toHaveBeenLastCalledWith(T0 + 8_000);   // the paused seconds are in the timestamp
  tick(1_000);
  expect(fn).toHaveBeenCalledTimes(5);
  expect(fn).toHaveBeenLastCalledWith(T0 + 9_000);
});

test('mounted in a hidden tab, it waits for the tab', () => {
  const fn = vi.fn();
  setDocumentHidden(true);
  render(<Harness fn={fn} />);
  tick(3_000);
  expect(fn).not.toHaveBeenCalled();
  act(() => setDocumentHidden(false));
  expect(fn).toHaveBeenCalledTimes(1);
  tick(1_000);
  expect(fn).toHaveBeenCalledTimes(2);
});

test('a new closure never restarts the interval; only ms or active do', () => {
  const first = vi.fn();
  const second = vi.fn();
  const { rerender } = render(<Harness fn={first} />);
  tick(500);
  rerender(<Harness fn={second} />);
  tick(500);
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);    // the tick due at 1000ms, not a fresh one at 1500ms
  rerender(<Harness fn={second} ms={500} />);
  tick(500);
  expect(second).toHaveBeenCalledTimes(2);
});

test('inactive schedules nothing; flipping active starts and stops it', () => {
  const fn = vi.fn();
  const { rerender } = render(<Harness fn={fn} active={false} />);
  tick(3_000);
  expect(fn).not.toHaveBeenCalled();
  rerender(<Harness fn={fn} active />);
  tick(2_000);
  expect(fn).toHaveBeenCalledTimes(2);
  rerender(<Harness fn={fn} active={false} />);
  tick(2_000);
  expect(fn).toHaveBeenCalledTimes(2);
});

test('a dev double-mount (StrictMode) runs one interval, not two', () => {
  const fn = vi.fn();
  render(<StrictMode><Harness fn={fn} /></StrictMode>);
  tick(3_000);
  expect(fn).toHaveBeenCalledTimes(3);
});

test('the 1000ms dashboard interval still runs under reduced motion', () => {
  installDomStubs({ reducedMotion: true });
  const fn = vi.fn();
  render(<Harness fn={fn} />);
  tick(2_000);
  expect(fn).toHaveBeenCalledTimes(2);
});
```

Run: `npx vitest run tests/use-live-interval.test.tsx` → 1 failed file: `Error: Failed to resolve import "@/hooks/use-live-interval" from "tests/use-live-interval.test.tsx". Does the file exist?`

- [ ] **Step 2: `hooks/use-live-interval.ts`**

```ts
import { useEffect, useEffectEvent } from 'react';
import { startInterval } from '@/lib/live';

/* One interval, paused while the tab is hidden. `fn` is read through an
   Effect Event, so a new closure on every render never restarts the timer;
   only `ms` or `active` do, and StrictMode's mount → cleanup → mount simply
   re-arms it. Every tick carries Date.now() and the callers compute elapsed
   time from a stored timestamp, so nothing drifts while paused: the moment
   the tab returns the hook ticks once to catch up, then resumes. It wraps
   startInterval so the reduced-motion rule is kept, though at the dashboards'
   1000ms it never bites. */
export function useLiveInterval(fn: (now: number) => void, ms: number, active = true): void {
  const tick = useEffectEvent(() => fn(Date.now()));
  useEffect(() => {
    if (!active) return;
    let stop = () => {};
    const run = () => { stop(); stop = startInterval(tick, ms); };
    const onVisibility = () => {
      if (document.hidden) { stop(); stop = () => {}; } else { tick(); run(); }
    };
    if (!document.hidden) run();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [ms, active]);
}
```

Run: `npx vitest run tests/use-live-interval.test.tsx` → 7 passed.

- [ ] **Step 3: The countdown's tests, failing on the missing component**

`tests/countdown.test.tsx`:

```tsx
// @vitest-environment jsdom
import { test, expect, beforeEach, vi } from 'vitest';
import { useState } from 'react';
import { render, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
vi.mock('next/navigation', () => import('./helpers/navigation-mock'));
import { installDomStubs } from './helpers/dom-stubs';
import { useLiveInterval } from '@/hooks/use-live-interval';
import { Countdown } from '@/components/app/Countdown';

const region = (c: HTMLElement) => c.querySelector('[aria-live="assertive"]')!;
const numerals = (c: HTMLElement) => c.querySelector('[data-slot="countdown-value"]')!;
const bar = (c: HTMLElement) => c.querySelector('[role="progressbar"]')!;

beforeEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  installDomStubs();
});

test('on arrival it announces the window once and hides the numerals from assistive technology', () => {
  const { container } = render(<Countdown remaining={45} total={45} />);
  expect(region(container)).toHaveTextContent('45 seconds to accept');
  expect(region(container)).toHaveAttribute('aria-atomic', 'true');
  expect(region(container)).toHaveClass('sr-only');
  expect(container.querySelectorAll('[aria-live]')).toHaveLength(1);
  expect(numerals(container)).toHaveTextContent('45s');
  expect(numerals(container)).toHaveAttribute('aria-hidden', 'true');
  expect(numerals(container)).toHaveClass('font-display', 'text-4xl', 'tabular-nums');
  expect(bar(container)).toHaveAttribute('aria-label', 'Time left to accept');
  expect(bar(container)).toHaveAttribute('aria-valuenow', '100');
  expect(bar(container)).toHaveAttribute('aria-valuetext', '45 seconds left');
});

test('announces at 30, 15 and 5 and is silent in between', () => {
  const { container, rerender } = render(<Countdown remaining={45} total={45} />);
  const at = (remaining: number) => {
    rerender(<Countdown remaining={remaining} total={45} />);
    return region(container).textContent;
  };
  expect(at(44)).toBe('');
  expect(at(31)).toBe('');
  expect(at(30)).toBe('30 seconds left to accept');
  expect(at(29)).toBe('');
  expect(at(15)).toBe('15 seconds left to accept');
  expect(at(14)).toBe('');
  expect(at(5)).toBe('5 seconds left to accept');
  expect(at(4)).toBe('');
  expect(at(0)).toBe('');
});

test('mounted mid-window it says nothing until the next milestone', () => {
  const { container, rerender } = render(<Countdown remaining={31} total={45} />);
  expect(region(container)).toBeEmptyDOMElement();
  rerender(<Countdown remaining={30} total={45} />);
  expect(region(container)).toHaveTextContent('30 seconds left to accept');
  rerender(<Countdown remaining={29} total={45} />);
  expect(region(container)).toBeEmptyDOMElement();
});

test('error reaches the numerals at five seconds and never the bar', () => {
  const { container, rerender } = render(<Countdown remaining={6} total={45} />);
  expect(numerals(container)).not.toHaveClass('text-error');
  rerender(<Countdown remaining={5} total={45} />);
  expect(numerals(container)).toHaveClass('text-error');
  rerender(<Countdown remaining={0} total={45} />);
  expect(numerals(container)).toHaveClass('text-error');
  expect(numerals(container)).toHaveTextContent('0s');
  expect(bar(container).className).not.toMatch(/error/);
  expect(container.querySelector('[data-slot="progress-indicator"]')!.className).not.toMatch(/error/);
});

test('the bar drains linearly over each second and reports the seconds on demand', () => {
  const { container, rerender } = render(<Countdown remaining={45} total={45} />);
  expect(bar(container)).toHaveClass(
    '[&_[data-slot=progress-indicator]]:duration-1000',
    '[&_[data-slot=progress-indicator]]:ease-linear',
  );
  for (const [remaining, percent] of [[30, '67'], [15, '33'], [5, '11'], [0, '0']] as const) {
    rerender(<Countdown remaining={remaining} total={45} />);
    expect(bar(container)).toHaveAttribute('aria-valuenow', percent);
    expect(bar(container)).toHaveAttribute('aria-valuetext', `${remaining} seconds left`);
  }
});

// The wiring SessionProvider uses (Task 13): an expiry timestamp, one live
// interval, `remaining` derived on every tick — never counted down.
function Offer({ start, total }: { start: number; total: number }) {
  const [now, setNow] = useState(start);
  useLiveInterval(setNow, 1000);
  return <Countdown remaining={Math.max(0, Math.ceil((start + total * 1000 - now) / 1000))} total={total} />;
}

test('driven from a timestamp by useLiveInterval it speaks exactly four times in 45 seconds', () => {
  vi.useFakeTimers();
  const T0 = Date.parse('2026-08-28T14:00:00Z');
  vi.setSystemTime(T0);
  const { container } = render(<Offer start={T0} total={45} />);
  const spoken = [region(container).textContent];
  for (let second = 1; second <= 45; second += 1) {
    act(() => { vi.advanceTimersByTime(1_000); });
    const text = region(container).textContent;
    if (text) spoken.push(text);
  }
  expect(spoken).toEqual([
    '45 seconds to accept', '30 seconds left to accept', '15 seconds left to accept', '5 seconds left to accept',
  ]);
  expect(numerals(container)).toHaveTextContent('0s');
  expect(bar(container)).toHaveAttribute('aria-valuenow', '0');
});
```

Run: `npx vitest run tests/countdown.test.tsx` → 1 failed file: `Error: Failed to resolve import "@/components/app/Countdown" from "tests/countdown.test.tsx". Does the file exist?`

- [ ] **Step 4: `components/app/Countdown.tsx`**

The numeral is the preview's `${remaining}s` (`doctor.js:337,340`) in the stat face of Decision 26 (Geist 700, `tabular-nums`, tracked `-.03em` — the countdown is named in DESIGN.md's numerals rule); the preview's `font-weight: 800; font-size: 40px` (`components.css:70`) becomes `font-bold text-4xl`.

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

/* The offer window as a GP hears it, not only as they see it. The preview put
   aria-live="assertive" on the ticking numeral, which interrupts a screen
   reader forty-five times. Here the numerals are hidden from assistive
   technology and one empty live region is filled four times — on arrival and
   at 30, 15 and 5 seconds — and emptied between, so the removals stay silent
   and only the additions are spoken. The bar drains linearly over each second
   so it reaches the next step as the next tick lands; the global
   reduced-motion rule zeroes that transition and leaves discrete steps. Error
   sits on the numerals for the last five seconds and nowhere else. */

const MILESTONES = new Set([30, 15, 5]);

function announcement(remaining: number, total: number): string {
  if (remaining === total) return `${total} seconds to accept`;
  if (MILESTONES.has(remaining)) return `${remaining} seconds left to accept`;
  return '';
}

export function Countdown({ remaining, total }: { remaining: number; total: number }) {
  // Filled after mount, never in render: a live region announces what is
  // added to it, not what it was born with, and the server HTML stays silent.
  const [said, setSaid] = useState('');
  useEffect(() => { setSaid(announcement(remaining, total)); }, [remaining, total]);

  return (
    <div data-slot="countdown" className="grid gap-3">
      <span
        data-slot="countdown-value"
        aria-hidden="true"
        className={cn(
          'font-display text-4xl font-bold leading-none tracking-[-.03em] tabular-nums',
          remaining <= 5 && 'text-error',
        )}
      >
        {remaining}s
      </span>
      <Progress
        value={Math.round((remaining / total) * 100)}
        aria-label="Time left to accept"
        getValueLabel={() => `${remaining} seconds left`}
        className="[&_[data-slot=progress-indicator]]:duration-1000 [&_[data-slot=progress-indicator]]:ease-linear"
      />
      <p className="sr-only" aria-live="assertive" aria-atomic="true">{said}</p>
    </div>
  );
}
```

Run: `npx vitest run tests/countdown.test.tsx` → 6 passed.

- [ ] **Step 5: Gallery — the countdown held at 45, 30, 5 and 0**

In `app/dev/ui/gallery.tsx`, the import. Old:

```tsx
import { SegmentedLink, SegmentedLinkGroup } from '@/components/ui/segmented-link';
```
New:
```tsx
import { SegmentedLink, SegmentedLinkGroup } from '@/components/ui/segmented-link';
import { Countdown } from '@/components/app/Countdown';
```

The header nav array. Old:

```tsx
          {['button', 'segmented-link', 'fields', 'select', 'choice', 'badge', 'card', 'alert', 'tabs', 'table', 'progress', 'avatar', 'separator', 'skeleton', 'breadcrumb', 'tooltip', 'overlays', 'dropdown', 'toast', 'sidebar'].map((id) => (
```
New:
```tsx
          {['button', 'segmented-link', 'fields', 'select', 'choice', 'badge', 'card', 'alert', 'tabs', 'table', 'progress', 'countdown', 'avatar', 'separator', 'skeleton', 'breadcrumb', 'tooltip', 'overlays', 'dropdown', 'toast', 'sidebar'].map((id) => (
```

The section, directly after the Progress section. Old:

```tsx
            <Progress value={100} aria-label="Complete" />
          </div>
        )} />
      </Section>
```
New:
```tsx
            <Progress value={100} aria-label="Complete" />
          </div>
        )} />
      </Section>

      <Section id="countdown" title="Countdown" note="The offer window: a Progress that drains one second per tick, aria-hidden numerals in the stat face, and one live region that speaks four times — on arrival and at 30, 15 and 5 seconds. Error on the numerals in the last five seconds and nowhere else. Held at 45, 30, 5 and 0.">
        <Surfaces render={(s) => (
          <div className="grid w-full gap-6">
            {[45, 30, 5, 0].map((remaining) => (
              <div key={remaining} className="grid gap-1">
                <p className={cn('text-fine', s.muted)}>Held at {remaining}s</p>
                <Countdown remaining={remaining} total={45} />
              </div>
            ))}
          </div>
        )} />
      </Section>
```

- [ ] **Step 6: Run everything, typecheck, look at the gallery**

```bash
cd /Users/liam/development/DrQuick/website
npm test
npm run typecheck
```
Expected: every suite green — the thirteen new tests plus everything before them; `tests/constraints.test.ts` scans `components/app/Countdown.tsx` and `app/dev/ui/gallery.tsx` and finds no hex, no `dark:`, no colour function and no banned word (`text-error` is a token class). `tsc --noEmit` is clean (`useEffectEvent` is typed in `@types/react` 19.2.18; `setNow`'s `Dispatch<SetStateAction<number>>` is assignable to `(now: number) => void`).

Then, on the dev server already running on :3000 (start one with `npm run dev` only if `curl -sI http://localhost:3000/dev/ui` fails), open `http://localhost:3000/dev/ui#countdown` at 1440 and 390 and confirm: four bars per surface; the bar at 45 full, at 30 two-thirds, at 5 a sliver, at 0 empty; only the numerals held at 5 and 0 are in error; nothing else on the page changed colour; no horizontal overflow at 390.

- [ ] **Step 7: Commit**

```bash
git add hooks/use-live-interval.ts components/app/Countdown.tsx app/dev/ui/gallery.tsx tests/use-live-interval.test.tsx tests/countdown.test.tsx
git commit -m "feat(app): live interval hook and the offer countdown

useLiveInterval wraps startInterval, reads its callback through an Effect
Event, pauses while the tab is hidden and ticks once on return with the
wall clock, so every elapsed figure is computed from a timestamp and a
paused tab resumes right. Countdown draws the offer window as a linearly
draining Progress with aria-hidden numerals and one assertive region that
speaks four times — on arrival and at 30, 15 and 5 seconds — instead of
the preview's forty-five.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---


### Task 6: The session reducer, with every transition and every illegal pair

**Files:**
- Create: `lib/session.ts`
- Test: `tests/session-reducer.test.ts`
- Read: `preview/js/doctor.js:75-105, 330-343` (availability echo, offer countdown), `preview/js/live.js`, `lib/live.ts`, `lib/fixtures.ts` (`OFFER`)

**Interfaces:**
- Consumes: `tickCountdown` from `@/lib/live`; `OFFER`, `FEE` types from `@/lib/fixtures`; `SessionRecord` from `@/lib/earnings`.
- Produces: the contract's `lib/session.ts` exports. `SessionProvider` (Task 13) is the only caller of the reducer; screens call `act()`.

- [ ] **Step 1: The reducer test matrix**

`tests/session-reducer.test.ts` (node environment, vitest `test`/`expect`):

```ts
import { test, expect, describe } from 'vitest';
import {
  SESSION_SCREENS, OFFER_WINDOW_SECONDS, initialSession, sessionReducer, sessionScreenFromPath, sessionHref,
  type SessionScreen, type SessionState, type SessionAction,
} from '@/lib/session';

const T0 = Date.parse('2026-08-28T14:00:00Z');
const at = (screen: SessionScreen, extra: Partial<SessionState> = {}): SessionState =>
  ({ ...initialSession(screen, { blocked: false, now: T0 }), ...extra });

describe('initial state', () => {
  test('null seeds offline; a screen seeds that screen', () => {
    expect(initialSession(null, { blocked: false, now: T0 }).screen).toBe('offline');
    expect(initialSession('offer', { blocked: false, now: T0 })).toMatchObject({ screen: 'offer', online: true, offerRemaining: OFFER_WINDOW_SECONDS });
    expect(initialSession('consultation', { blocked: false, now: T0 }).consultationStartedAt).toBe(T0);
  });
  test('the blocked flag is carried', () => {
    expect(initialSession(null, { blocked: true, now: T0 }).blocked).toBe(true);
  });
});

describe('legal transitions', () => {
  test('offline → goOnline → online-idle', () => {
    const s = sessionReducer(at('offline'), { type: 'goOnline', now: T0 });
    expect(s).toMatchObject({ screen: 'online-idle', online: true, onlineSince: T0 });
  });
  test.each(['online-idle', 'no-patients-waiting', 'offer', 'offer-consent-refused', 'complete', 'offer-declined', 'offer-timed-out', 'patient-no-show'] as const)(
    '%s → goOffline → offline', (screen) => {
      expect(sessionReducer(at(screen), { type: 'goOffline' })).toMatchObject({ screen: 'offline', online: false, onlineSince: null });
    });
  test.each(['online-idle', 'no-patients-waiting'] as const)('%s → offerArrives → offer (consent) / offer-consent-refused', (screen) => {
    expect(sessionReducer(at(screen), { type: 'offerArrives', consent: true, now: T0 })).toMatchObject({ screen: 'offer', offerRemaining: 45, offerExpiresAt: T0 + 45_000, offerConsent: true, offersSeen: 1 });
    expect(sessionReducer(at(screen), { type: 'offerArrives', consent: false, now: T0 })).toMatchObject({ screen: 'offer-consent-refused', offerConsent: false });
  });
  test('online-idle → noPatients → no-patients-waiting', () => {
    expect(sessionReducer(at('online-idle'), { type: 'noPatients' }).screen).toBe('no-patients-waiting');
  });
  test.each(['offer', 'offer-consent-refused'] as const)('%s counts down on the wall clock and times out at zero', (screen) => {
    const s = at(screen);                                                  // offerExpiresAt = T0 + 45_000
    expect(sessionReducer(s, { type: 'tickOffer', now: T0 + 1_000 }).offerRemaining).toBe(44);
    expect(sessionReducer(s, { type: 'tickOffer', now: T0 + 30_000 }).offerRemaining).toBe(15);
    expect(sessionReducer(s, { type: 'tickOffer', now: T0 })).toBe(s);   // nothing changed → same object
    // A hidden tab that comes back late has missed the window: the offer moved on.
    expect(sessionReducer(s, { type: 'tickOffer', now: T0 + 60_000 })).toMatchObject({ screen: 'offer-timed-out', offerRemaining: 0 });
  });
  test('every screen-changing action bumps nav once; jump and setBlocked never do', () => {
    const s = at('offline');
    expect(sessionReducer(s, { type: 'goOnline', now: T0 }).nav).toBe(s.nav + 1);
    expect(sessionReducer(at('offer'), { type: 'accept', now: T0 }).nav).toBe(1);
    expect(sessionReducer(at('offer'), { type: 'jump', screen: 'consultation', now: T0 }).nav).toBe(0);
    expect(sessionReducer(at('offer'), { type: 'setBlocked', blocked: true }).nav).toBe(0);
    expect(sessionReducer(at('offer'), { type: 'tickOffer', now: T0 + 1_000 }).nav).toBe(0);   // a tick that stays on the screen
    expect(sessionReducer(at('offer'), { type: 'tickOffer', now: T0 + 60_000 }).nav).toBe(1);  // a tick that times out
  });
  test.each(['offer', 'offer-consent-refused'] as const)('%s → accept → consultation; → decline → offer-declined', (screen) => {
    expect(sessionReducer(at(screen), { type: 'accept', now: T0 })).toMatchObject({ screen: 'consultation', consultationStartedAt: T0 });
    expect(sessionReducer(at(screen), { type: 'decline' }).screen).toBe('offer-declined');
  });
  test('consultation → complete records one consultation of at least a minute', () => {
    const s = sessionReducer(at('consultation'), { type: 'complete', now: T0 + 545_000, id: 'C-0032', when: 'Today, 15:02' });
    expect(s.screen).toBe('complete');
    expect(s.completed).toEqual([{ id: 'C-0032', when: 'Today, 15:02', ageBand: '30–39', minutes: 9, outcome: 'Recorded in Semble', isNew: true }]);
    expect(s.lastConsultSeconds).toBe(545);
    const short = sessionReducer(at('consultation'), { type: 'complete', now: T0 + 20_000, id: 'C-0033', when: 'Today, 15:03' });
    expect(short.completed[0].minutes).toBe(1);
  });
  test('consultation → noShow → patient-no-show, nothing recorded', () => {
    const s = sessionReducer(at('consultation'), { type: 'noShow' });
    expect(s).toMatchObject({ screen: 'patient-no-show', completed: [] });
  });
  test.each(['complete', 'offer-declined', 'offer-timed-out', 'patient-no-show'] as const)('%s → backOnline → online-idle', (screen) => {
    expect(sessionReducer(at(screen), { type: 'backOnline', now: T0 })).toMatchObject({ screen: 'online-idle', online: true });
  });
  test('jump seeds any screen and its timers', () => {
    for (const screen of SESSION_SCREENS) {
      const s = sessionReducer(at('offline'), { type: 'jump', screen, now: T0 });
      expect(s.screen).toBe(screen);
      expect(s.online).toBe(screen !== 'offline');
    }
  });
  test('setBlocked only changes the flag', () => {
    const s = at('online-idle');
    expect(sessionReducer(s, { type: 'setBlocked', blocked: true })).toEqual({ ...s, blocked: true });
  });
});

describe('illegal transitions return the same object', () => {
  const same = (state: SessionState, action: SessionAction) => expect(sessionReducer(state, action)).toBe(state);
  test('cannot go online with expired indemnity', () => same(at('offline', { blocked: true }), { type: 'goOnline', now: T0 }));
  test('cannot go offline mid-consultation', () => same(at('consultation'), { type: 'goOffline' }));
  test('goOnline only from offline', () => { for (const s of SESSION_SCREENS.filter((x) => x !== 'offline')) same(at(s), { type: 'goOnline', now: T0 }); });
  test('goOffline from offline is a no-op', () => same(at('offline'), { type: 'goOffline' }));
  test('an offer only arrives while idle', () => { for (const s of SESSION_SCREENS.filter((x) => x !== 'online-idle' && x !== 'no-patients-waiting')) same(at(s), { type: 'offerArrives', consent: true, now: T0 }); });
  test('noPatients only from online-idle', () => { for (const s of SESSION_SCREENS.filter((x) => x !== 'online-idle')) same(at(s), { type: 'noPatients' }); });
  test('tick, accept and decline only on an offer', () => {
    for (const s of SESSION_SCREENS.filter((x) => x !== 'offer' && x !== 'offer-consent-refused')) {
      same(at(s), { type: 'tickOffer', now: T0 + 1_000 }); same(at(s), { type: 'accept', now: T0 }); same(at(s), { type: 'decline' });
    }
  });
  test('complete and noShow only from consultation', () => {
    for (const s of SESSION_SCREENS.filter((x) => x !== 'consultation')) {
      same(at(s), { type: 'complete', now: T0, id: 'C-0032', when: 'Today' }); same(at(s), { type: 'noShow' });
    }
  });
  test('backOnline only from a terminal screen', () => {
    for (const s of ['offline', 'online-idle', 'no-patients-waiting', 'offer', 'offer-consent-refused', 'consultation'] as const) same(at(s), { type: 'backOnline', now: T0 });
  });
});

describe('paths', () => {
  test('sessionScreenFromPath has no opinion on the bare path', () => {
    expect(sessionScreenFromPath('/doctor/session')).toBeNull();
    expect(sessionScreenFromPath('/doctor/session/')).toBeNull();
    expect(sessionScreenFromPath('/doctor/session/patient-no-show')).toBe('patient-no-show');
    expect(sessionScreenFromPath('/doctor/session/nope')).toBeNull();
    expect(sessionScreenFromPath('/doctor')).toBeNull();
  });
  test('sessionHref', () => { expect(sessionHref('offer')).toBe('/doctor/session/offer'); });
});
```

Run: `npx vitest run tests/session-reducer.test.ts` → fails (module missing).

- [ ] **Step 2: `lib/session.ts`**

```ts
/* The shift as a state machine. One piece of state — online or offline —
   with the offer, the consultation and the terminal states arranged around
   it. Pure: every transition takes state and returns state, so it can be
   tested without a browser, and the URL follows it rather than driving it. */
import { OFFER } from '@/lib/fixtures';
import type { SessionRecord } from '@/lib/earnings';

export const SESSION_SCREENS = [
  'offline', 'online-idle', 'no-patients-waiting', 'offer', 'offer-consent-refused',
  'consultation', 'complete', 'offer-declined', 'offer-timed-out', 'patient-no-show',
] as const;
export type SessionScreen = (typeof SESSION_SCREENS)[number];

export const OFFER_WINDOW_SECONDS = OFFER.windowSeconds; // 45
export const OFFER_AFTER_MS = 8000;                       // how long an idle GP waits before something happens

export type SessionState = {
  screen: SessionScreen;
  online: boolean;
  blocked: boolean;
  nav: number;                     // bumped by every non-jump action that changes the screen; the URL follows this, never `screen` alone
  onlineSince: number | null;
  consultationStartedAt: number | null;
  offerExpiresAt: number | null;   // wall clock: a hidden tab cannot stretch the window
  offerRemaining: number;
  offerConsent: boolean;
  offersSeen: number;
  completed: SessionRecord[];
  lastConsultSeconds: number;
};

export type SessionAction =
  | { type: 'jump'; screen: SessionScreen; now: number }
  | { type: 'setBlocked'; blocked: boolean }
  | { type: 'goOnline'; now: number }
  | { type: 'goOffline' }
  | { type: 'offerArrives'; consent: boolean; now: number }
  | { type: 'noPatients' }
  | { type: 'tickOffer'; now: number }
  | { type: 'accept'; now: number }
  | { type: 'decline' }
  | { type: 'complete'; now: number; id: string; when: string }
  | { type: 'noShow' }
  | { type: 'backOnline'; now: number };

const OFFER_SCREENS = new Set<SessionScreen>(['offer', 'offer-consent-refused']);
const TERMINAL = new Set<SessionScreen>(['complete', 'offer-declined', 'offer-timed-out', 'patient-no-show']);
const IDLE = new Set<SessionScreen>(['online-idle', 'no-patients-waiting']);
const WINDOW_MS = OFFER_WINDOW_SECONDS * 1000;

export function initialSession(screen: SessionScreen | null, { blocked, now }: { blocked: boolean; now: number }): SessionState {
  const base: SessionState = {
    screen: 'offline', online: false, blocked, nav: 0, onlineSince: null, consultationStartedAt: null,
    offerExpiresAt: null, offerRemaining: OFFER_WINDOW_SECONDS, offerConsent: true, offersSeen: 0,
    completed: [], lastConsultSeconds: 0,
  };
  return screen && screen !== 'offline' ? sessionReducer(base, { type: 'jump', screen, now }) : base;
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  // A screen change the GP (or a timer) caused: the URL must follow it.
  const move = (patch: Partial<SessionState>): SessionState => ({ ...state, ...patch, nav: state.nav + 1 });

  switch (action.type) {
    case 'jump': {
      const online = action.screen !== 'offline';
      const onOffer = OFFER_SCREENS.has(action.screen);
      return {
        ...state,
        screen: action.screen,
        online,
        onlineSince: online ? (state.onlineSince ?? action.now) : null,
        offerExpiresAt: onOffer ? action.now + WINDOW_MS : null,
        offerRemaining: onOffer ? OFFER_WINDOW_SECONDS : state.offerRemaining,
        offerConsent: action.screen === 'offer-consent-refused' ? false : action.screen === 'offer' ? true : state.offerConsent,
        consultationStartedAt: action.screen === 'consultation' ? action.now : null,
      };
    }
    case 'setBlocked':
      return state.blocked === action.blocked ? state : { ...state, blocked: action.blocked };
    case 'goOnline':
      if (state.screen !== 'offline' || state.blocked) return state;
      return move({ screen: 'online-idle', online: true, onlineSince: action.now });
    case 'goOffline':
      if (state.screen === 'consultation' || state.screen === 'offline') return state;
      return move({ screen: 'offline', online: false, onlineSince: null, offerExpiresAt: null });
    case 'offerArrives':
      if (!IDLE.has(state.screen)) return state;
      return move({
        screen: action.consent ? 'offer' : 'offer-consent-refused',
        offerExpiresAt: action.now + WINDOW_MS, offerRemaining: OFFER_WINDOW_SECONDS,
        offerConsent: action.consent, offersSeen: state.offersSeen + 1,
      });
    case 'noPatients':
      return state.screen === 'online-idle' ? move({ screen: 'no-patients-waiting' }) : state;
    case 'tickOffer': {
      if (!OFFER_SCREENS.has(state.screen) || state.offerExpiresAt === null) return state;
      const remaining = Math.max(0, Math.ceil((state.offerExpiresAt - action.now) / 1000));
      if (remaining === 0) return move({ screen: 'offer-timed-out', offerRemaining: 0, offerExpiresAt: null });
      return remaining === state.offerRemaining ? state : { ...state, offerRemaining: remaining };
    }
    case 'accept':
      if (!OFFER_SCREENS.has(state.screen)) return state;
      return move({ screen: 'consultation', consultationStartedAt: action.now, offerExpiresAt: null });
    case 'decline':
      return OFFER_SCREENS.has(state.screen) ? move({ screen: 'offer-declined', offerExpiresAt: null }) : state;
    case 'complete': {
      if (state.screen !== 'consultation') return state;
      const seconds = Math.max(0, Math.floor((action.now - (state.consultationStartedAt ?? action.now)) / 1000));
      const record: SessionRecord = {
        id: action.id, when: action.when, ageBand: OFFER.ageBand,
        minutes: Math.max(1, Math.round(seconds / 60)), outcome: 'Recorded in Semble', isNew: true,
      };
      return move({ screen: 'complete', completed: [record, ...state.completed], lastConsultSeconds: seconds, consultationStartedAt: null });
    }
    case 'noShow':
      return state.screen === 'consultation' ? move({ screen: 'patient-no-show', consultationStartedAt: null }) : state;
    case 'backOnline':
      if (!TERMINAL.has(state.screen)) return state;
      return move({ screen: 'online-idle', online: true, onlineSince: state.onlineSince ?? action.now });
    default:
      return state;
  }
}

const SESSION_ROOT = '/doctor/session';

/* The bare path has no opinion: an in-app link to /doctor/session must never
   knock an online GP offline, so only a named state seeds the reducer. */
export function sessionScreenFromPath(pathname: string): SessionScreen | null {
  if (!pathname.startsWith(`${SESSION_ROOT}/`)) return null;
  const tail = pathname.slice(SESSION_ROOT.length + 1).replace(/\/+$/g, '');
  return (SESSION_SCREENS as readonly string[]).includes(tail) ? (tail as SessionScreen) : null;
}

export function sessionHref(screen: SessionScreen): string {
  return `${SESSION_ROOT}/${screen}`;
}
```

- [ ] **Step 3: Run, commit**

Run: `npx vitest run tests/session-reducer.test.ts` → green; `npm run typecheck` → green.

```bash
git add lib/session.ts tests/session-reducer.test.ts
git commit -m "feat(doctor): session reducer with every transition and its illegal pairs

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: The onboarding reducer

**Files:**
- Create: `lib/onboarding.ts`
- Test: `tests/onboarding-reducer.test.ts`
- Read: `preview/doctor.html:259-364` (the six steps and their worked-example values)

**Interfaces:**
- Consumes: `SKILLS`, `SkillId`, `Credential`, `CredentialRecord` from `@/lib/fixtures`.
- Produces: the contract's `lib/onboarding.ts` exports. `OnboardingProvider` (Task 13) and the six step screens (Task 18) are the callers.

- [ ] **Step 1: Tests**

```ts
import { test, expect } from 'vitest';
import {
  ONBOARDING_STEPS, initialOnboarding, onboardingReducer, onboardingStepFromPath, onboardingHref, stepStatus, GMC_PATTERN,
} from '@/lib/onboarding';

test('starts on register with the worked example filled in and the default skills on', () => {
  const s = initialOnboarding(null);
  expect(s).toMatchObject({ step: 'register', reached: 0, nav: 0, email: 'dr.locum@example.com', gmc: '4567890', identityVerified: false });
  expect(s.skills).toEqual(['general-adult', 'minor-illness']);
});

test('landing on a later step seeds every earlier step as complete', () => {
  const s = initialOnboarding('indemnity');
  expect(s.step).toBe('indemnity');
  expect(s.reached).toBe(3);
  expect(s.identityVerified).toBe(true);
  expect(ONBOARDING_STEPS.slice(0, 3).map((step) => stepStatus(s, step))).toEqual(['done', 'done', 'done']);
  expect(stepStatus(s, 'indemnity')).toBe('current');
  expect(stepStatus(s, 'skills')).toBe('todo');
});

test('register validates the GMC number as seven digits and only then continues', () => {
  let s = onboardingReducer(initialOnboarding(null), { type: 'setGmc', value: '12' });
  s = onboardingReducer(s, { type: 'submitRegister' });
  expect(s).toMatchObject({ step: 'register', gmcError: 'Enter your 7-digit GMC number.' });
  s = onboardingReducer(s, { type: 'setGmc', value: '1234567' });
  expect(s.gmcError).toBeNull();
  s = onboardingReducer(s, { type: 'submitRegister' });
  expect(s).toMatchObject({ step: 'identity', reached: 1 });
  expect(GMC_PATTERN.test('1234567')).toBe(true);
});

test('the happy path walks every step in order', () => {
  let s = initialOnboarding(null);
  s = onboardingReducer(s, { type: 'submitRegister' });
  s = onboardingReducer(s, { type: 'verifyIdentity' });
  expect(s).toMatchObject({ step: 'credentials', identityVerified: true });
  s = onboardingReducer(s, { type: 'continueCredentials' });
  expect(s.step).toBe('indemnity');
  s = onboardingReducer(s, { type: 'useBlockCover' });
  expect(s).toMatchObject({ step: 'skills', indemnity: { cover: 'block' } });
  s = onboardingReducer(s, { type: 'toggleSkill', id: 'dermatology' });
  expect(s.skills).toContain('dermatology');
  s = onboardingReducer(s, { type: 'toggleSkill', id: 'minor-illness' });
  expect(s.skills).not.toContain('minor-illness');
  s = onboardingReducer(s, { type: 'finishSkills' });
  expect(s).toMatchObject({ step: 'done', reached: 5 });
});

test('the own-certificate path needs an expiry date and is equally real', () => {
  let s = initialOnboarding('indemnity');
  s = onboardingReducer(s, { type: 'uploadCertificate' });
  expect(s).toMatchObject({ step: 'indemnity', indemnity: { error: 'Enter the expiry date on your certificate.' } });
  s = onboardingReducer(s, { type: 'setIndemnityFile', name: 'cover.pdf' });
  s = onboardingReducer(s, { type: 'setIndemnityExpiry', value: '2027-08-31' });
  s = onboardingReducer(s, { type: 'uploadCertificate' });
  expect(s).toMatchObject({ step: 'skills', indemnity: { cover: 'own', expiry: '2027-08-31', fileName: 'cover.pdf', error: null } });
});

test('a step action fired from the wrong step is ignored', () => {
  const s = initialOnboarding('skills');
  expect(onboardingReducer(s, { type: 'verifyIdentity' })).toBe(s);
  expect(onboardingReducer(s, { type: 'useBlockCover' })).toBe(s);
});

test('paths — the bare path has no opinion and the preview id does not survive as a URL', () => {
  expect(onboardingStepFromPath('/doctor/onboarding')).toBeNull();
  expect(onboardingStepFromPath('/doctor/onboarding/skills')).toBe('skills');
  expect(onboardingStepFromPath('/doctor/onboarding/onboarding-done')).toBeNull();
  expect(onboardingStepFromPath('/doctor/onboarding/nope')).toBeNull();
  expect(onboardingHref('done')).toBe('/doctor/onboarding/done');
});

test('nav counts forward moves only', () => {
  let s = initialOnboarding(null);
  expect(s.nav).toBe(0);
  s = onboardingReducer(s, { type: 'submitRegister' });
  expect(s.nav).toBe(1);
  s = onboardingReducer(s, { type: 'jump', step: 'skills' });
  expect(s.nav).toBe(1);
  s = onboardingReducer(s, { type: 'toggleSkill', id: 'dermatology' });
  expect(s.nav).toBe(1);
});
```

- [ ] **Step 2: `lib/onboarding.ts`**

```ts
/* Registration through to "you're ready", as data. Each step's gate carries
   its own status because they clear at very different speeds; the reducer
   only moves forward on the action that step offers, and landing on a later
   step by URL seeds everything before it as done so no screen is ever blank. */
import { SKILLS, type SkillId, type Credential } from '@/lib/fixtures';

export const ONBOARDING_STEPS = ['register', 'identity', 'credentials', 'indemnity', 'skills', 'done'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
export const GMC_PATTERN = /^\d{7}$/;

// preview/doctor.html:294-298 — four checks pending, right to work already verified.
export const ONBOARDING_RECORD = {
  gmc: { status: 'pending', daysRemaining: null },
  licence: { status: 'pending', daysRemaining: null },
  cct: { status: 'pending', daysRemaining: null },
  dbs: { status: 'pending', daysRemaining: null },
  rightToWork: { status: 'valid', daysRemaining: null },
} as const satisfies Record<'gmc' | 'licence' | 'cct' | 'dbs' | 'rightToWork', Credential>;

export type OnboardingState = {
  step: OnboardingStep;
  reached: number;
  nav: number;                     // bumped by every step-advancing action; the URL follows this, never by jump
  email: string;
  gmc: string;
  gmcError: string | null;
  identityVerified: boolean;
  indemnity: { cover: 'block' | 'own' | null; expiry: string; fileName: string; error: string | null };
  skills: SkillId[];
};

export type OnboardingAction =
  | { type: 'jump'; step: OnboardingStep }
  | { type: 'setEmail'; value: string }
  | { type: 'setGmc'; value: string }
  | { type: 'submitRegister' }
  | { type: 'verifyIdentity' }
  | { type: 'continueCredentials' }
  | { type: 'useBlockCover' }
  | { type: 'setIndemnityExpiry'; value: string }
  | { type: 'setIndemnityFile'; name: string }
  | { type: 'uploadCertificate' }
  | { type: 'toggleSkill'; id: SkillId }
  | { type: 'finishSkills' };

export const GMC_ERROR = 'Enter your 7-digit GMC number.';
export const INDEMNITY_ERROR = 'Enter the expiry date on your certificate.';

const index = (step: OnboardingStep) => ONBOARDING_STEPS.indexOf(step);

function advance(state: OnboardingState, to: OnboardingStep): OnboardingState {
  return { ...state, step: to, reached: Math.max(state.reached, index(to)), nav: state.nav + 1 };
}

export function initialOnboarding(step: OnboardingStep | null): OnboardingState {
  const base: OnboardingState = {
    step: 'register', reached: 0, nav: 0,
    email: 'dr.locum@example.com', gmc: '4567890', gmcError: null,
    identityVerified: false,
    indemnity: { cover: null, expiry: '', fileName: '', error: null },
    skills: SKILLS.filter((s) => s.defaultOn).map((s) => s.id),
  };
  return step && step !== 'register' ? onboardingReducer(base, { type: 'jump', step }) : base;
}

export function onboardingReducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case 'jump': {
      const i = index(action.step);
      return {
        ...state, step: action.step, reached: Math.max(state.reached, i),
        identityVerified: state.identityVerified || i >= index('credentials'),
        indemnity: i >= index('skills') && state.indemnity.cover === null ? { ...state.indemnity, cover: 'block' } : state.indemnity,
      };
    }
    case 'setEmail':
      return { ...state, email: action.value };
    case 'setGmc':
      return { ...state, gmc: action.value, gmcError: GMC_PATTERN.test(action.value.trim()) ? null : state.gmcError };
    case 'submitRegister':
      if (state.step !== 'register') return state;
      if (!GMC_PATTERN.test(state.gmc.trim())) return { ...state, gmcError: GMC_ERROR };
      return advance({ ...state, gmcError: null }, 'identity');
    case 'verifyIdentity':
      return state.step === 'identity' ? advance({ ...state, identityVerified: true }, 'credentials') : state;
    case 'continueCredentials':
      return state.step === 'credentials' ? advance(state, 'indemnity') : state;
    case 'useBlockCover':
      return state.step === 'indemnity' ? advance({ ...state, indemnity: { ...state.indemnity, cover: 'block', error: null } }, 'skills') : state;
    case 'setIndemnityExpiry':
      return { ...state, indemnity: { ...state.indemnity, expiry: action.value, error: action.value ? null : state.indemnity.error } };
    case 'setIndemnityFile':
      return { ...state, indemnity: { ...state.indemnity, fileName: action.name } };
    case 'uploadCertificate':
      if (state.step !== 'indemnity') return state;
      if (!state.indemnity.expiry) return { ...state, indemnity: { ...state.indemnity, error: INDEMNITY_ERROR } };
      return advance({ ...state, indemnity: { ...state.indemnity, cover: 'own', error: null } }, 'skills');
    case 'toggleSkill':
      return {
        ...state,
        skills: state.skills.includes(action.id) ? state.skills.filter((id) => id !== action.id) : [...state.skills, action.id],
      };
    case 'finishSkills':
      return state.step === 'skills' ? advance(state, 'done') : state;
    default:
      return state;
  }
}

export function stepStatus(state: OnboardingState, step: OnboardingStep): 'done' | 'current' | 'todo' {
  if (step === state.step) return 'current';
  return index(step) < index(state.step) || index(step) < state.reached ? 'done' : 'todo';
}

const ROOT = '/doctor/onboarding';
/* The bare path has no opinion (see sessionScreenFromPath): it must never rewind `reached`. */
export function onboardingStepFromPath(pathname: string): OnboardingStep | null {
  if (!pathname.startsWith(`${ROOT}/`)) return null;
  const tail = pathname.slice(ROOT.length + 1).replace(/\/+$/g, '');
  return (ONBOARDING_STEPS as readonly string[]).includes(tail) ? (tail as OnboardingStep) : null;
}
export function onboardingHref(step: OnboardingStep): string { return `${ROOT}/${step}`; }
```

- [ ] **Step 3: Run, commit**

Run: `npx vitest run tests/onboarding-reducer.test.ts` → green; `npm run typecheck` → green.

```bash
git add lib/onboarding.ts tests/onboarding-reducer.test.ts
git commit -m "feat(doctor): onboarding reducer

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Checkbox, and a stacked table mode for phones

**Files:**
- Create: `components/ui/checkbox.tsx` (via the CLI, then restyled)
- Modify: `components/ui/table.tsx` (`stack` on `Table`, `label` on `TableCell`), `app/dev/ui/gallery.tsx` (a `checkbox` section; a stacked example in the `table` section; the section list in the header nav)
- Test: `tests/ui-additions.test.tsx`
- Read: `CLAUDE.md` "Component layer" (the restyle checklist), `components/ui/radio-group.tsx` (the sibling control to match), `components/ui/table.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `Checkbox` (`React.ComponentProps<typeof CheckboxPrimitive.Root>`; `data-slot="checkbox"`); `Table` gains `stack?: 'cols' | 'phone'` (collapse below 900 or below 560); `TableCell` gains `label?: string` which renders as `data-label` and is what the stacked layout prints before the cell. Stacking changes `display` on `tr`/`td`, which drops table semantics in Chrome and Safari, so a stacked table re-asserts `role="table" / rowgroup / row / columnheader / cell` on its parts — the `<th scope>` still names every cell for assistive technology and the printed label is decoration (`aria-hidden` via `::before`).

- [ ] **Step 1: Install the primitive with the CLI, then strip what the checklist forbids**

```bash
npx shadcn@latest add checkbox
git diff --stat   # the CLI must have touched only components/ui/checkbox.tsx; if it wrote to globals.css or package.json, revert those hunks
```
Then restyle `components/ui/checkbox.tsx` to match `radio-group.tsx`: a 20px square (`size-5 rounded-sm`) with `border-2 border-outline bg-white`, `data-checked:border-primary data-checked:bg-primary data-checked:text-white`, the `after:` hit-area widening, `disabled:` and `aria-invalid:` treatments copied from the radio item; remove any `focus-visible:ring-*`, `outline-none`, `dark:` and `shadow-xs`; keep the Radix structure, the `CheckIcon` from `lucide-react` at `strokeWidth={2}` inside the indicator (`size-3.5`), and `data-slot`. Add the file's why-comment in the house voice.

- [ ] **Step 2: The stacked table**

In `components/ui/table.tsx`:

```tsx
// A wide, data-heavy table is a virtue on the desk and a smear on a phone. With
// `stack`, below the cols line each row becomes a block and every cell prints
// its column label first, read from data-label; the header row goes to screen
// readers only, so the semantics are unchanged.
const STACK = {
  cols: [
    "max-cols:block max-cols:[&_thead]:sr-only max-cols:[&_tbody]:block max-cols:[&_tr]:block max-cols:[&_tr]:py-2",
    "max-cols:[&_th[scope=row]]:block max-cols:[&_th[scope=row]]:px-3 max-cols:[&_th[scope=row]]:pt-3 max-cols:[&_th[scope=row]]:pb-1 max-cols:[&_th[scope=row]]:text-left",
    "max-cols:[&_td]:grid max-cols:[&_td]:grid-cols-[minmax(0,12ch)_1fr] max-cols:[&_td]:gap-3 max-cols:[&_td]:py-1.5 max-cols:[&_td]:whitespace-normal",
    "max-cols:[&_td]:before:content-[attr(data-label)] max-cols:[&_td]:before:font-display max-cols:[&_td]:before:text-[11px] max-cols:[&_td]:before:font-semibold max-cols:[&_td]:before:tracking-[.05em] max-cols:[&_td]:before:uppercase max-cols:[&_td]:before:text-ink-2",
  ],
  phone: [ /* the same eight utilities with the max-phone: prefix */ ],
} as const

function Table({ className, stack, ...props }: React.ComponentProps<"table"> & { stack?: "cols" | "phone" }) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      {/* Stacking changes display on tr/td, which drops table semantics in Chrome and
          Safari; the explicit roles keep every <th scope> naming its cells. */}
      <table
        data-slot="table"
        data-stack={stack}
        role={stack ? "table" : undefined}
        className={cn("w-full caption-bottom text-body", stack && STACK[stack], className)}
        {...props}
      />
    </div>
  )
}
```
`TableHeader`, `TableBody`, `TableRow`, `TableHead` and `TableCell` each add `role={…}` (`rowgroup`, `rowgroup`, `row`, `columnheader`, `cell`) — always present, harmless on a real table, load-bearing on a stacked one. `TableCell`:
```tsx

function TableCell({ className, label, ...props }: React.ComponentProps<"td"> & { label?: string }) {
  return (
    <td data-slot="table-cell" data-label={label}
        className={cn("p-3 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0", className)} {...props} />
  )
}
```
`TableRow` keeps its hairline (`border-b border-rule`) in both modes — the recorded exception. Everything else in the file is unchanged.

- [ ] **Step 3: Gallery**

Add `'checkbox'` after `'choice'` in the header nav array and a section:

```tsx
<Section id="checkbox" title="Checkbox" note="The clinical-skills list: a 20px square on white, filled primary when chosen; the whole row is the target.">
  <Surfaces render={(s) => (
    <div className="grid w-full gap-2">
      {[['general', 'General adult medicine', true], ['minor', 'Minor illness', true], ['derm', 'Dermatology', false]].map(([id, label, on]) => (
        <label key={String(id)} className={cn('flex items-center gap-3 rounded-md px-3 py-3 cursor-pointer text-body font-semibold', s.id === 'band' ? 'bg-white/10' : 'bg-surface-mid')}>
          <Checkbox id={`${s.id}-${id}`} defaultChecked={Boolean(on)} /> {label}
        </label>
      ))}
      <label className={cn('flex items-center gap-3 rounded-md px-3 py-3 text-body font-semibold text-outline', s.id === 'band' ? 'bg-white/10' : 'bg-surface-mid')}><Checkbox disabled /> Disabled</label>
    </div>
  )} />
</Section>
```
In the `table` section add a second example: the same table with `stack` and `label` on every `TableCell`, captioned "Stacked below 900px" — narrow the gallery window to see it collapse.

- [ ] **Step 4: Tests**

`tests/ui-additions.test.tsx` (jsdom): `Checkbox` renders `role="checkbox"` and toggles `aria-checked` on click; `Table stack` sets `data-stack` and `TableCell label="Fee"` renders `data-label="Fee"`; a plain `Table` has no `data-stack`.

- [ ] **Step 5: Run and commit**

`npm test`, `npm run typecheck` → green (the constraints test scans the new file: no hex, no `dark:`).

```bash
git add components/ui/checkbox.tsx components/ui/table.tsx app/dev/ui/gallery.tsx tests/ui-additions.test.tsx
git commit -m "feat(ui): checkbox and a stacked table mode for phones

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Stat tile, status badge, stepper, ribbon, empty state, page header, facts

> Note: brief and contract agree throughout. Two files beyond the brief's list are touched, for reasons the contract implies: `lib/utils.ts` registers `headline` / `headline-sm` with tailwind-merge (otherwise `cn('text-headline', 'text-white')` would drop the size, exactly why `text-body` and friends are registered today), and `app/dev/ui/gallery.tsx` gains a one-line `useEffect` that adds `.in` to `[data-reveal]` (the root layout sets `.js` on `<html>` at `app/layout.tsx:51`, so `PageHeader`'s `data-reveal` h1 would otherwise be invisible in the gallery until Task 12's `Arrival` exists). Where the spec said "build the stepper from Separator + Badge", the contract's `ol`/`li` bars win. `font-display` is on both stat sizes (Global Constraints: stat numerals are Geist); the Ribbon carries the decision-25 classes plus `flex items-center` so the sentence centres inside the shell's fixed `--ribbon-h`.

**Files:**
- Create: `components/app/Ribbon.tsx`, `components/app/EmptyState.tsx`, `components/app/StatTile.tsx`, `components/app/PageHeader.tsx`, `components/app/Facts.tsx`, `components/app/StatusBadge.tsx`, `components/app/Stepper.tsx`
- Modify: `app/globals.css` (the two `@theme` text sizes and their companions), `lib/utils.ts` (register the two names with tailwind-merge), `app/dev/ui/gallery.tsx` (seven sections, the nav list, the reveal release)
- Test: `tests/app-components.test.tsx` (part 1; Tasks 10, 11 and 12 append to this file)
- Read: `components/ui/{badge,card,separator,progress}.tsx`, `app/globals.css`, `app/dev/ui/gallery.tsx`, `lib/alerts.ts` (`STATUS_LABELS`, Task 3), `lib/placeholder.ts` (`DASH`, Task 2), `preview/css/components.css:30-38`, `preview/css/base.css:60-71`, `preview/doctor.html:18, 41-44, 55-58, 65-69, 306-307, 401`, `preview/admin.html:17, 174-182, 278`, `preview/js/doctor.js:47-54, 125-126, 244-268, 284-291`, `preview/js/fixtures.js:33-38`

**Interfaces:**
- Consumes: `Badge` from `@/components/ui/badge`; `Card`, `CardContent` from `@/components/ui/card` (gallery only); `cn()` from `@/lib/utils`; `STATUS_LABELS` from `@/lib/alerts` and the `CredentialStatus` type from `@/lib/fixtures` (Task 3); `DASH` from `@/lib/placeholder` (Task 2); `installDomStubs` from `tests/helpers/dom-stubs.ts` and the `next/navigation` mock `tests/helpers/navigation-mock.ts` (Task 4).
- Produces, exactly as the contract's "Shared app components" section: `<Ribbon className? />`, `<EmptyState>…</EmptyState>`, `<StatTile label value note? size="lg"|"sm" against? />` (`size` defaults to `"lg"`, the preview's unmodified `.stat__value`), `<PageHeader title lead? actions? />`, `<Facts items={[label, value][]} />`, `<StatusBadge status={CredentialStatus | null} onBand? />`, `<Stepper steps={{ id, label, status: 'done'|'current'|'todo' }[]} />` with the exported types `StepStatus` and `Step`; the `text-headline` / `text-headline-sm` utilities (decision 26); and the decision-32 markers: `[data-slot="stat-tile"][data-size]`, `[data-slot="stat-value"]`, `[data-slot="stat-against"]`, `[data-slot="facts"]`, `[data-status]` (absent when `status` is `null`, so a `[data-status]` sweep finds real statuses only), `[data-slot="ribbon"]`, `[data-slot="empty"]`, `[data-slot="page-header"]`, `[data-slot="stepper"]`, `[data-slot="step-bar"]`, `li[data-step]`. Consumers: `AppShell` (Task 12: Ribbon), every screen (StatTile, PageHeader, EmptyState), Profile and Offer (Facts), `CredentialMatrix` (Task 11) and the credentials step (StatusBadge), `OnboardingFlow` (Task 18: `Stepper` fed by `stepStatus()` from `lib/onboarding.ts`).

- [ ] **Step 1: Write the component tests first, so every import fails to resolve**

`tests/app-components.test.tsx` — the whole of part 1. The navigation mock and the dom stubs are the file's standing header: nothing in part 1 navigates or measures, but Tasks 10–12 append to this file and rely on both being installed in `beforeEach`.

```tsx
// @vitest-environment jsdom
import { test, expect, describe, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { installDomStubs } from './helpers/dom-stubs';
import { Ribbon } from '@/components/app/Ribbon';
import { EmptyState } from '@/components/app/EmptyState';
import { StatTile } from '@/components/app/StatTile';
import { PageHeader } from '@/components/app/PageHeader';
import { Facts } from '@/components/app/Facts';
import { StatusBadge } from '@/components/app/StatusBadge';
import { Stepper, type Step } from '@/components/app/Stepper';
import { STATUS_LABELS } from '@/lib/alerts';
import type { CredentialStatus } from '@/lib/fixtures';

// Part 1 (Task 9): the static compositions. The charts (Task 10), CredentialMatrix
// (Task 11) and the shell pieces (Task 12) append to this file, so the navigation
// mock and the dom stubs are its standing header even though nothing in part 1
// navigates or measures.
vi.mock('next/navigation', () => import('./helpers/navigation-mock'));

beforeEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  installDomStubs();
});

const STATUSES = Object.keys(STATUS_LABELS) as CredentialStatus[];

describe('StatTile', () => {
  test('marks its numeral, defaults to the headline size and sizes it per decision 26', () => {
    const { container } = render(<StatTile label="Earned today" value="£117" />);
    const tile = container.querySelector('[data-slot="stat-tile"]')!;
    expect(tile).toHaveAttribute('data-size', 'lg');
    const value = tile.querySelector('[data-slot="stat-value"]')!;
    expect(value).toHaveTextContent('£117');
    for (const cls of ['font-display', 'text-4xl', 'font-bold', 'leading-none', 'tabular-nums']) expect(value).toHaveClass(cls);
    expect(tile).toHaveTextContent('Earned today');
    expect(tile.querySelector('[data-slot="stat-against"]')).toBeNull();
  });

  test('the small size keeps the face and the figure spacing', () => {
    const { container } = render(<StatTile size="sm" label="Time online today" value="42m" />);
    expect(container.querySelector('[data-slot="stat-tile"]')).toHaveAttribute('data-size', 'sm');
    const value = container.querySelector('[data-slot="stat-value"]')!;
    for (const cls of ['font-display', 'text-2xl', 'font-semibold', 'leading-none', 'tabular-nums']) expect(value).toHaveClass(cls);
    expect(value).not.toHaveClass('text-4xl');
  });

  test('a dash sits in the numeral slot, in the same classes as a figure', () => {
    const { container } = render(<StatTile label="Earned today" value="—" />);
    const value = container.querySelector('[data-slot="stat-value"]')!;
    expect(value).toHaveTextContent('—');
    expect(value).toHaveClass('text-4xl');
  });

  test('note and against are their own lines; against carries its slot', () => {
    const { container } = render(
      <StatTile label="Next payout" value="—" note="Nothing to pay out yet" against="plan assumed £16" />,
    );
    expect(container.querySelector('[data-slot="stat-tile"]')).toHaveTextContent('Nothing to pay out yet');
    expect(container.querySelector('[data-slot="stat-against"]')).toHaveTextContent('plan assumed £16');
  });
});

describe('StatusBadge', () => {
  const VARIANT: Record<CredentialStatus, string> = {
    pending: 'secondary', expiring: 'secondary', valid: 'success', expired: 'destructive', rejected: 'destructive',
  };

  test('every status carries its word, its data-status and the ink-ramp variant', () => {
    expect(STATUSES).toHaveLength(5);
    for (const status of STATUSES) {
      const { container, unmount } = render(<StatusBadge status={status} />);
      const badge = container.querySelector('[data-slot="badge"]')!;
      expect(badge).toHaveTextContent(STATUS_LABELS[status]);
      expect(badge).toHaveAttribute('data-status', status);
      expect(badge).toHaveAttribute('data-variant', VARIANT[status]);
      unmount();
    }
  });

  test('expiring is ink at 15 percent, not the primary accent', () => {
    const { container } = render(<StatusBadge status="expiring" />);
    const badge = container.querySelector('[data-slot="badge"]')!;
    expect(badge).toHaveClass('bg-ink/15');
    expect(badge).toHaveClass('text-ink');
    for (const cls of ['bg-fill', 'text-ink-2', 'bg-primary/15', 'text-primary']) expect(badge).not.toHaveClass(cls);
  });

  test('blank mode has no status: a dash named "Not submitted" with no data-status', () => {
    const { container } = render(<StatusBadge status={null} />);
    const badge = container.querySelector('[data-slot="badge"]')!;
    expect(badge).toHaveTextContent('—');
    expect(badge).toHaveAttribute('aria-label', 'Not submitted');
    expect(badge).not.toHaveAttribute('data-status');
    expect(badge).toHaveAttribute('data-variant', 'secondary');
  });

  test('on the band every badge is white at 15 percent — the row is the severity', () => {
    for (const status of [...STATUSES, null]) {
      const { container, unmount } = render(<StatusBadge status={status} onBand />);
      const badge = container.querySelector('[data-slot="badge"]')!;
      expect(badge).toHaveClass('bg-white/15');
      expect(badge).toHaveClass('text-white');
      for (const cls of ['bg-error/15', 'text-error', 'bg-success/15', 'text-success', 'bg-ink/15', 'text-ink', 'bg-fill', 'text-ink-2']) {
        expect(badge).not.toHaveClass(cls);
      }
      unmount();
    }
  });
});

describe('Stepper', () => {
  // preview/js/doctor.js:47-54 — the six steps as the rail named them.
  const LABELS = ['Register', 'Identity', 'Credentials', 'Indemnity', 'Skills', 'Done'];
  const at = (current: number): Step[] => LABELS.map((label, i) => ({
    id: label.toLowerCase(), label, status: i < current ? 'done' : i === current ? 'current' : 'todo',
  }));

  test('is an ordered list with one aria-current step and the words a bar cannot say', () => {
    const { container } = render(<Stepper steps={at(3)} />);
    const ol = container.querySelector('ol[aria-label="Onboarding steps"]')!;
    const items = Array.from(ol.children);
    expect(items).toHaveLength(6);
    expect(items.every((li) => li.tagName === 'LI')).toBe(true);
    expect(ol.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
    expect(items[3]).toHaveAttribute('aria-current', 'step');
    expect(items[3]).toHaveTextContent('Indemnity');
    expect(items[3]).not.toHaveTextContent(/completed|not started/);
    expect(items[0]).toHaveTextContent('Register completed');
    expect(items[5]).toHaveTextContent('Done not started');
    expect(items[0].querySelector('.sr-only')).toHaveTextContent('completed');
  });

  test('severity by fill: ink up to and including the current step, fill beyond it', () => {
    const { container } = render(<Stepper steps={at(3)} />);
    const bars = Array.from(container.querySelectorAll('[data-slot="step-bar"]'));
    expect(bars).toHaveLength(6);
    expect(bars.slice(0, 4).every((b) => b.classList.contains('bg-ink'))).toBe(true);
    expect(bars.slice(4).every((b) => b.classList.contains('bg-fill'))).toBe(true);
    expect(Array.from(container.querySelectorAll('li')).map((li) => li.getAttribute('data-step')))
      .toEqual(['done', 'done', 'done', 'current', 'todo', 'todo']);
  });
});

describe('Ribbon', () => {
  test('is a note carrying the sentence verbatim, in the label-caps face on the band', () => {
    const { container } = render(<Ribbon />);
    const ribbon = container.querySelector('[data-slot="ribbon"]')!;
    expect(ribbon.tagName).toBe('P');
    expect(ribbon).toHaveAttribute('role', 'note');
    expect(ribbon).not.toHaveAttribute('aria-live');
    expect(ribbon.textContent).toBe('Prototype. Not a live service — no real patients, GPs, or data.');
    for (const cls of ['sticky', 'top-0', 'z-20', 'bg-band', 'text-white', 'font-display', 'uppercase']) expect(ribbon).toHaveClass(cls);
    expect(ribbon).not.toHaveClass('font-mono');
  });

  test('className merges through cn: the shell sets its height, the gallery unsticks it', () => {
    const { container } = render(<Ribbon className="static min-h-(--ribbon-h)" />);
    const ribbon = container.querySelector('[data-slot="ribbon"]')!;
    expect(ribbon).toHaveClass('static');
    expect(ribbon).toHaveClass('min-h-(--ribbon-h)');
    expect(ribbon).not.toHaveClass('sticky');
  });
});

describe('EmptyState', () => {
  test('is a written sentence marked data-slot="empty"', () => {
    const { container } = render(<EmptyState>No consultations yet.</EmptyState>);
    const empty = container.querySelector('p[data-slot="empty"]')!;
    expect(empty).toHaveTextContent('No consultations yet.');
    for (const cls of ['text-ink-2', 'text-body', 'border-dashed', 'border-rule', 'text-center']) expect(empty).toHaveClass(cls);
  });
});

describe('PageHeader', () => {
  test('the h1 carries data-reveal, the app headline sizes and a focus target', () => {
    const { container } = render(
      <PageHeader title="Today" lead="lead copy" actions={<button type="button">Simulate an offer</button>} />,
    );
    const h1 = container.querySelector('h1')!;
    expect(h1).toHaveTextContent('Today');
    expect(h1).toHaveAttribute('data-reveal');
    expect(h1).toHaveAttribute('tabindex', '-1');
    expect(h1).toHaveClass('text-headline');
    expect(h1).toHaveClass('max-phone:text-headline-sm');
    const lead = container.querySelector('[data-slot="page-header"] p')!;
    expect(lead).toHaveTextContent('lead copy');
    expect(lead).toHaveClass('text-ink-2');
    expect(lead).toHaveClass('max-w-[52ch]');
    expect(container.querySelector('button')).toHaveTextContent('Simulate an offer');
  });

  test('without a lead there is no empty paragraph', () => {
    const { container } = render(<PageHeader title="Earnings" />);
    expect(container.querySelector('[data-slot="page-header"] p')).toBeNull();
    expect(container.querySelectorAll('h1')).toHaveLength(1);
  });
});

describe('Facts', () => {
  test('is a dl of exactly the rows it was given, terms then values', () => {
    const { container } = render(
      <Facts items={[
        ['Presenting complaint', 'Sore throat and fever, three days'],
        ['Age band', '30–39'],
        ['NHS GP summary consent', 'Yes'],
      ]} />,
    );
    const dl = container.querySelector('dl[data-slot="facts"]')!;
    expect(Array.from(dl.querySelectorAll('dt')).map((d) => d.textContent))
      .toEqual(['Presenting complaint', 'Age band', 'NHS GP summary consent']);
    expect(Array.from(dl.querySelectorAll('dd')).map((d) => d.textContent))
      .toEqual(['Sore throat and fever, three days', '30–39', 'Yes']);
    expect(dl.querySelectorAll('dt')).toHaveLength(dl.querySelectorAll('dd').length);
  });
});
```

Run: `npx vitest run tests/app-components.test.tsx` → the file fails to load: `Error: Failed to resolve import "@/components/app/Ribbon" from "tests/app-components.test.tsx". Does the file exist?` (one failed suite, no tests run). Every component below exists only once all seven are written, so the file is red until Step 10.

- [ ] **Step 2: The two app headline sizes**

`app/globals.css`, inside `@theme`, directly after the named type sizes. Old:

```css
  --text-body: .9375rem;
  --text-label: .9375rem;
  --text-fine: .8125rem;
```

New:

```css
  --text-body: .9375rem;
  --text-label: .9375rem;
  --text-fine: .8125rem;

  /* The dashboards' page title (DESIGN.md headline-lg and its mobile size). The
     h1 element scale in base is the landing hero's clamp — 44 to 80px — and a
     route inside the shell must never inherit it. The companions ride with the
     utility, so `text-headline` sets size, line-height and tracking together. */
  --text-headline: 2rem;
  --text-headline--line-height: 1.2;
  --text-headline--letter-spacing: -.04em;
  --text-headline-sm: 1.5rem;
  --text-headline-sm--line-height: 1.2;
  --text-headline-sm--letter-spacing: -.03em;
```

`lib/utils.ts` — tailwind-merge must know the two names are font sizes, or `cn('text-headline', 'text-white')` would treat both as colours and drop the size. Old:

```ts
      text: ["lead", "title-lead", "question", "body", "label", "fine"],
```

New:

```ts
      text: ["lead", "title-lead", "question", "body", "label", "fine", "headline", "headline-sm"],
```

- [ ] **Step 3: `components/app/Ribbon.tsx`**

The sentence is `preview/doctor.html:18` / `preview/admin.html:17`, verbatim. Decision 25's markup; `flex items-center` added so the line centres inside the height `AppShell` fixes (`--ribbon-h`), and it still wraps within `min-h` at 390.

```tsx
import { cn } from '@/lib/utils';

// Prototype chrome, deliberately not the product: the sentence that has to be on
// every dashboard screen and cannot be dismissed. A note rather than a live
// region — it never changes, so it has nothing to announce — and the product's
// label-caps face rather than a third typeface: only the state jumper is
// monospace. Sticky at z-20 it sits above the rail (z-10); AppShell fixes its
// height to --ribbon-h and offsets the rail by the same amount.
export function Ribbon({ className }: { className?: string }) {
  return (
    <p
      role="note"
      data-slot="ribbon"
      className={cn(
        'sticky top-0 z-20 flex items-center bg-band px-4 py-2 font-display text-[11px] font-semibold uppercase leading-[1.2] tracking-[.05em] text-white',
        className,
      )}
    >
      Prototype. Not a live service — no real patients, GPs, or data.
    </p>
  );
}
```

- [ ] **Step 4: `components/app/EmptyState.tsx`**

```tsx
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

// A list with nothing in it says so in a sentence — "No consultations yet." —
// never an illustration and never a skeleton: nothing is loading, nothing has
// happened. Every list on the dashboards renders this until the platform has
// produced something, in both data modes.
export function EmptyState({ className, ...props }: ComponentProps<'p'>) {
  return (
    <p
      data-slot="empty"
      className={cn('rounded-xl border border-dashed border-rule py-8 text-center text-body text-ink-2', className)}
      {...props}
    />
  );
}
```

- [ ] **Step 5: `components/app/StatTile.tsx`**

Decision 26's numeral classes; the tile is a block, not a `Card`, so a screen can group several inside one card the way the preview's `.card > .grid > .stat` did. Muted lines switch to `band-ink-2` inside a `Card variant="band"` through the card's `group/card`.

```tsx
import { cn } from '@/lib/utils';

// A figure and what it is. The value arrives already formatted — through
// shown() or live() — so a blank-mode tile carries the em dash in the same face
// and size as the number it stands in for, and nothing shifts when data lands.
// Both sizes are Geist, tabular, tracked no tighter than -.03em (DESIGN.md
// numerals). The tile is not a card: several sit inside one.
const VALUE = {
  lg: 'font-display text-4xl font-bold tracking-[-.03em] leading-none tabular-nums',
  sm: 'font-display text-2xl font-semibold tracking-[-.02em] leading-none tabular-nums',
} as const;

// ink-2 on white; band-ink-2 inside a band Card.
const MUTED = 'text-fine text-ink-2 group-data-[variant=band]/card:text-band-ink-2';

type Props = {
  label: string;
  value: string;
  note?: string;
  size?: 'lg' | 'sm';
  against?: string;
  className?: string;
};

export function StatTile({ label, value, note, size = 'lg', against, className }: Props) {
  return (
    <div data-slot="stat-tile" data-size={size} className={cn('grid min-w-0 content-start gap-1', className)}>
      <span data-slot="stat-value" className={VALUE[size]}>{value}</span>
      <span className={MUTED}>{label}</span>
      {note && <span className={MUTED}>{note}</span>}
      {against && <span data-slot="stat-against" className={MUTED}>{against}</span>}
    </div>
  );
}
```

- [ ] **Step 6: `components/app/PageHeader.tsx`**

```tsx
import type { ReactNode } from 'react';

// The one h1 on a route, at DESIGN.md's headline-lg — the base h1 scale is the
// landing hero's and is far too large inside the shell. It carries data-reveal
// (a route's first arrival, decision 13) and tabIndex -1 so a screen that must
// move focus on arrival — the offer — can hand it to the heading, as the landing
// hero does on a mode switch. The actions do not reveal: only the h1 and a
// route's first tile row do.
export function PageHeader({ title, lead, actions }: { title: string; lead?: string; actions?: ReactNode }) {
  return (
    <div data-slot="page-header" className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 max-phone:mb-6">
      <div className="min-w-0">
        <h1 data-reveal tabIndex={-1} className="text-headline max-phone:text-headline-sm">{title}</h1>
        {lead && <p className="mt-2 max-w-[52ch] text-body text-ink-2">{lead}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}
```

- [ ] **Step 7: `components/app/Facts.tsx`**

```tsx
import type { ReactNode } from 'react';

// Label and value, two columns, one fact per row on a hairline. A screen may
// state exactly the rows it passes in and nothing else — the offer's three
// permitted facts are three rows — so the list is the audit trail of what was
// shown. Values arrive formatted through shown() or live().
export function Facts({ items }: { items: ReadonlyArray<readonly [label: string, value: ReactNode]> }) {
  return (
    <dl data-slot="facts" className="text-body">
      {items.map(([label, value]) => (
        <div
          key={label}
          className="grid grid-cols-[16ch_1fr] gap-x-4 border-b border-rule py-3 max-phone:grid-cols-1 max-phone:gap-y-1"
        >
          <dt className="text-ink-2">{label}</dt>
          <dd className="min-w-0 font-semibold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
```

- [ ] **Step 8: `components/app/StatusBadge.tsx`**

Decision 23. `Badge` spreads its props after `data-variant`, so `data-status` and `aria-label` land on the span; `cn()` lets the later `bg-white/15 text-white` displace the variant's and the expiring override's colours (the `onBand` class is last on purpose).

```tsx
import { Badge } from '@/components/ui/badge';
import { STATUS_LABELS } from '@/lib/alerts';
import type { CredentialStatus } from '@/lib/fixtures';
import { DASH } from '@/lib/placeholder';
import { cn } from '@/lib/utils';

// Status is an ink ramp, not a primary accent (decision 23): pending sits on the
// fill in ink-2, expiring steps up to ink on a 15% ink fill, and Verified, Expired
// and Rejected are the only places success and error appear on the surfaces.
// Blank mode has no status and says so. Inside a band-filled row every badge is
// white at 15% — error on the band fails AA at 12px once the badge's own fill
// lightens the ground — so the row is the severity and the badge carries the word.
const VARIANT = {
  pending: 'secondary',
  expiring: 'secondary',
  valid: 'success',
  expired: 'destructive',
  rejected: 'destructive',
} as const satisfies Record<CredentialStatus, 'secondary' | 'success' | 'destructive'>;

type Props = { status: CredentialStatus | null; onBand?: boolean; className?: string };

export function StatusBadge({ status, onBand = false, className }: Props) {
  const tone = cn(status === 'expiring' && 'bg-ink/15 text-ink', onBand && 'bg-white/15 text-white', className);
  if (status === null) {
    return <Badge variant="secondary" aria-label="Not submitted" className={tone}>{DASH}</Badge>;
  }
  return <Badge variant={VARIANT[status]} data-status={status} className={tone}>{STATUS_LABELS[status]}</Badge>;
}
```

- [ ] **Step 9: `components/app/Stepper.tsx`**

The preview's stepper (`components.css:30-32`) was six 3px bars with no words. The contract adds the label and the screen-reader words; `h-0.75` is 3px on the 4px scale.

```tsx
import { cn } from '@/lib/utils';

export type StepStatus = 'done' | 'current' | 'todo';
export type Step = { id: string; label: string; status: StepStatus };

// The preview's stepper was six bars and nothing else. A bar's fill is colour
// and weight alone, so each step also carries its label and, for a screen
// reader, whether it is done; the current step is the one with aria-current.
// Below the phone line only the current label is visible — six labels do not
// fit in 358px — the rest stay in the accessible name.
export function Stepper({ steps }: { steps: readonly Step[] }) {
  return (
    <ol aria-label="Onboarding steps" data-slot="stepper" className="mb-6 flex gap-1">
      {steps.map((step) => (
        <li
          key={step.id}
          data-step={step.status}
          aria-current={step.status === 'current' ? 'step' : undefined}
          className="min-w-0 flex-1"
        >
          <div data-slot="step-bar" className={cn('h-0.75 rounded-pill', step.status === 'todo' ? 'bg-fill' : 'bg-ink')} />
          <span
            className={cn(
              'mt-2 block truncate text-fine',
              step.status === 'current' ? 'font-semibold text-ink' : 'text-ink-2 max-phone:sr-only',
            )}
          >
            {step.label}
            {step.status === 'done' && <span className="sr-only"> completed</span>}
            {step.status === 'todo' && <span className="sr-only"> not started</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
```

- [ ] **Step 10: Run the component tests**

Run: `npx vitest run tests/app-components.test.tsx` → `Test Files 1 passed`, `Tests 16 passed` (StatTile 4, StatusBadge 4, Stepper 2, Ribbon 2, EmptyState 1, PageHeader 2, Facts 1). Then `npm run typecheck` → green (the `satisfies` on `VARIANT` proves every `CredentialStatus` has a variant, so adding a sixth status to `fixtures.ts` breaks the build here rather than rendering the default primary badge).

- [ ] **Step 11: Gallery — seven sections on the three surfaces**

`app/dev/ui/gallery.tsx`, five edits.

(a) Imports — old:

```tsx
import { SegmentedLink, SegmentedLinkGroup } from '@/components/ui/segmented-link';
```

New:

```tsx
import { SegmentedLink, SegmentedLinkGroup } from '@/components/ui/segmented-link';
import { Ribbon } from '@/components/app/Ribbon';
import { EmptyState } from '@/components/app/EmptyState';
import { StatTile } from '@/components/app/StatTile';
import { PageHeader } from '@/components/app/PageHeader';
import { Facts } from '@/components/app/Facts';
import { StatusBadge } from '@/components/app/StatusBadge';
import { Stepper, type StepStatus } from '@/components/app/Stepper';
import { STATUS_LABELS } from '@/lib/alerts';
import type { CredentialStatus } from '@/lib/fixtures';
import { DASH } from '@/lib/placeholder';
```

(b) Fixture strings, after the `Surface` type — old:

```tsx
type Surface = (typeof SURFACES)[number];
```

New:

```tsx
type Surface = (typeof SURFACES)[number];

// preview/js/doctor.js:47-54 — the onboarding steps as the rail named them.
const STEP_LABELS = ['Register', 'Identity', 'Credentials', 'Indemnity', 'Skills', 'Done'] as const;
const stepsAt = (current: number) =>
  STEP_LABELS.map((label, i) => ({
    id: label.toLowerCase(),
    label,
    status: (i < current ? 'done' : i === current ? 'current' : 'todo') as StepStatus,
  }));

// preview/js/doctor.js:284-291 — the profile's account facts, blank and seeded.
const FACTS_BLANK = [
  ['Reference', 'GP-002'], ['Credentials', DASH], ['Consultations', DASH], ['Earned to date', DASH], ['Working in', 'England only'],
] as const;
const FACTS_SEEDED = [
  ['Reference', 'GP-002'], ['Credentials', '7 of 7 verified'], ['Consultations', '40'], ['Earned to date', '£1,560'], ['Working in', 'England only'],
] as const;
```

(c) The reveal release, in `Gallery()` — old:

```tsx
  const [switchOn, setSwitchOn] = React.useState(true);
```

New:

```tsx
  const [switchOn, setSwitchOn] = React.useState(true);
  // The root layout's .js class holds every [data-reveal] at opacity 0 until
  // something adds .in, and the gallery mounts no Arrival — so release them here.
  React.useEffect(() => {
    document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('in'));
  }, []);
```

(d) The section nav — old (as Task 8 left it, ending in `'sidebar'`):

```tsx
'toast', 'sidebar'].map((id) => (
```

New:

```tsx
'toast', 'sidebar', 'stat-tile', 'status-badge', 'stepper', 'ribbon', 'empty-state', 'page-header', 'facts'].map((id) => (
```

(e) The sections, immediately before the footer — old:

```tsx
      <footer className="border-t border-rule py-10">
```

New:

```tsx
      {/* ---- components/app: the dashboard compositions (Task 9) ---- */}

      <Section id="stat-tile" title="StatTile" note="A figure through shown()/live() and its label. lg is the headline figure at 36px, sm the secondary at 24px, both Geist and tabular; the em dash sits in the same face and size. A tile is not a card — several sit in one. `against` is the business screen's assumption line and renders in both modes.">
        <Surfaces render={(s) => (
          <Card variant={s.id === 'band' ? 'band' : 'default'} className={cn('w-full', s.id === 'band' && 'band-grid')}>
            <CardContent className="grid grid-cols-2 gap-6">
              <StatTile label="Earned today" value="£117" />
              <StatTile label="Earned today" value={DASH} />
              <StatTile size="sm" label="GPs online vs needed" value="2 of 3" />
              <StatTile size="sm" label="Time online today" value={DASH} />
              <StatTile label="Next payout" value="£468" note="Paid Friday 4 September" />
              <StatTile label="Next payout" value={DASH} note="Nothing to pay out yet" />
              <StatTile label="Real CAC" value="£42" against="plan assumed £16 · £26 above plan" />
              <StatTile label="Real CAC" value={DASH} against="plan assumed £16" />
            </CardContent>
          </Card>
        )} />
      </Section>

      <Section id="status-badge" title="StatusBadge" note="The credential ink ramp (decision 23): pending on the fill in ink-2, expiring steps up to ink at 15%, and Verified, Expired and Rejected are the only success and error on the surfaces. Blank mode has no status — a dash named “Not submitted”. On the band every badge is white at 15%: the row is the severity, the badge carries the word.">
        <Surfaces render={(s) => (
          <div className="flex flex-wrap gap-2">
            {(Object.keys(STATUS_LABELS) as CredentialStatus[]).map((status) => (
              <StatusBadge key={status} status={status} onBand={s.id === 'band'} />
            ))}
            <StatusBadge status={null} onBand={s.id === 'band'} />
          </div>
        )} />
      </Section>

      <Section id="stepper" title="Stepper" note="Six bars, ink up to and including the current step and fill beyond it, each with its label; below the phone line only the current label shows. Screen readers get the position from aria-current and the words “completed” / “not started”. The onboarding is never on the band.">
        <div className="grid gap-4">
          <div className="rounded-xl bg-surface p-6"><Stepper steps={stepsAt(0)} /></div>
          <Card className="block p-6"><Stepper steps={stepsAt(3)} /></Card>
          <div className="rounded-xl bg-surface p-6"><Stepper steps={stepsAt(5)} /></div>
        </div>
      </Section>

      <Section id="ribbon" title="Ribbon" note="Prototype chrome, deliberately not the product: a note (not a live region) in the label-caps face, sticky above the rail on every dashboard route. Shown static here.">
        <Ribbon className="static rounded-md" />
      </Section>

      <Section id="empty-state" title="EmptyState" note="A sentence, never an illustration or a skeleton: what every list renders until the platform has produced something.">
        <Surfaces render={(s) => (
          <div className="grid w-full gap-3">
            <EmptyState className={s.id === 'band' ? 'border-band-ink-2 text-band-ink-2' : undefined}>No consultations yet.</EmptyState>
            <EmptyState className={s.id === 'band' ? 'border-band-ink-2 text-band-ink-2' : undefined}>No patients in the queue.</EmptyState>
          </div>
        )} />
      </Section>

      <Section id="page-header" title="PageHeader" note="The route's h1 at headline-lg (32px, 24px below the phone line) — never the landing hero's clamp — with an optional lead and actions. The h1 carries data-reveal and is the focus target on arrival where a screen needs one.">
        <div className="grid gap-8">
          <PageHeader title="Today" actions={<Button>Simulate an offer</Button>} />
          <PageHeader title="Indemnity cover" lead="State-backed NHS indemnity does not cover private telehealth. You need separate cover to consult here." />
        </div>
      </Section>

      <Section id="facts" title="Facts" note="Label and value in two columns on hairlines: the profile's account facts here, the offer's three permitted facts on the session. Values arrive through shown()/live(), so the blank list is dashes, not zeros.">
        <div className="grid grid-cols-2 gap-4 max-cols:grid-cols-1">
          <div className="rounded-xl bg-surface p-6"><p className="text-fine text-ink-2 mb-4">Blank</p><Facts items={FACTS_BLANK} /></div>
          <Card className="block p-6"><p className="text-fine text-ink-2 mb-4">Seeded</p><Facts items={FACTS_SEEDED} /></Card>
        </div>
      </Section>

      <footer className="border-t border-rule py-10">
```

Strings and their sources: "Earned today", "GPs online vs needed", "Time online today" (`doctor.html:55-58`); "Next payout" (`doctor.html:65`); "Paid Friday 4 September" / "Nothing to pay out yet" (`doctor.js:126` with `fixtures.js:255`); "Real CAC", "plan assumed £16" (`admin.html:176`, `:278`), the seeded against line per decision 18; "Today", "Simulate an offer" (`doctor.html:41-44`); "Indemnity cover" + lead (`doctor.html:306-307`); "No patients in the queue." (`doctor.html:401`); "No consultations yet." (spec); the facts (`doctor.js:284-291`, with decision 6's 7 of 7 / 40 / £1,560). Every figure is a fixture-derived round number and renders on `/dev/ui` only.

Open `http://localhost:3000/dev/ui#stat-tile` on the running dev server and look at the seven sections at 1440 and at 390: the em dashes line up with the figures at both sizes; the band card's labels are `band-ink-2`; the five badges plus the dash read as a ramp with no blue; on the band every badge is white-on-white-15; at 390 the steppers show only the current label; the page-header h1s are 32px then 24px, never the hero's 44–80.

- [ ] **Step 12: Full suite, typecheck, build**

```bash
cd /Users/liam/development/DrQuick/website
npm test
npm run typecheck
NEXT_PUBLIC_SITE_URL=http://localhost:3000 npm run build
```

Expected: all green. `tests/constraints.test.ts` now scans the seven new files, the CSS and the gallery — no hex, no `dark:`, no colour function (`bg-ink/15`, `bg-white/15` are a token at an alpha, decision 24). The build compiles `/dev/ui` with the two new `@theme` sizes. Nothing on `/` imports `components/app` (the only new import edges are the gallery and the test), so the `/` row of `.next/diagnostics/route-bundle-stats.json` matches Task 1's baseline byte for byte.

- [ ] **Step 13: Commit**

```bash
git add components/app/Ribbon.tsx components/app/EmptyState.tsx components/app/StatTile.tsx components/app/PageHeader.tsx components/app/Facts.tsx components/app/StatusBadge.tsx components/app/Stepper.tsx app/globals.css lib/utils.ts app/dev/ui/gallery.tsx tests/app-components.test.tsx
git commit -m "feat(app): stat tile, status badge, stepper, ribbon, empty state

The first components/app compositions, built only from components/ui and
cn(): the ribbon as a note in the label-caps face, stat tiles whose numeral
and assumption line carry stable slots, the credential status badge as an
ink ramp that turns white inside a band-filled row, the onboarding stepper
as an ordered list with aria-current, the written empty state, the page
header at DESIGN.md's headline size, and the facts list. Two @theme text
sizes give the dashboards a page title that is not the landing hero's clamp.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Inline SVG charts drawn at measured width

> **Note — brief vs contract.** The contract names no test file; the brief's `tests/charts-components.test.tsx` is kept and the File Structure entry is corrected in Step 8. Three small additions to the contract are made in the same commit (Step 8): `ChartLegend` exports `LegendItem`, `DAILY_LEGEND` and `DEMAND_LEGEND` and its `'ink-2'` item carries `max-phone:hidden`; `ChartFrame` renders `ariaLabel` as sr-only text until measured and exports `AXIS`; `LineChart` exports `ONE_SERIES_BELOW`. `BarChart` and `LineChart` are `'use client'` because the render prop they hand `ChartFrame` cannot cross a server boundary. The preview's `<svg role="img">` had no accessible name, so every `ariaLabel` is a new string: each surface names its chart with its own heading; the gallery and the tests use the headings verbatim. Width facts for the record (wrap 1200/24px, card padding 24px, rail 256px): a full-width card chart measures 1088 at 1440, 803 at 899 (Sheet), 548–559 at 900–911 (rail open — the phone form on a small desktop) and 294 at 390. The legend keys on the viewport (`max-phone:`) while `LineChart` keys on its measured width, so between 560 and 655 the chart shows one series under a two-item caption; the 1440/390 matrix never lands in either band. Recorded for Task 28.

**Files:**
- Create: `components/app/ChartFrame.tsx`, `components/app/BarChart.tsx`, `components/app/LineChart.tsx`, `components/app/ChartLegend.tsx`
- Modify: `app/dev/ui/gallery.tsx` (a `charts` section; `'charts'` in the header nav array), `docs/superpowers/plans/2026-09-02-doctor-admin-surfaces.md` (the contract lines this task extends; the File Structure test entry)
- Test: `tests/charts-components.test.tsx`
- Read: `lib/charts.ts` (Task 2: `barGeometry`, `linePoints`, `toPath`, `labelStride`, `BarDatum`, `LineSet`), `lib/fixtures.ts` `DEMAND_BY_HOUR` and `lib/earnings.ts` `earningsFor` (Task 3), `lib/data-mode.tsx` `DataModeProvider` / `useFigures` and `tests/helpers/dom-stubs.ts` (`installDomStubs`, `ResizeObserverStub`) / `tests/helpers/navigation-mock.ts` (Task 4), `components/app/EmptyState.tsx` (Task 9), `preview/css/dashboard.css:176-201`, `preview/js/doctor.js:156-194`, `preview/doctor.html:84-107, 194-200`, `preview/admin.html:72-79, 309-318`, `app/dev/ui/gallery.tsx`

**Interfaces:**
- Consumes: `barGeometry`, `linePoints`, `toPath`, `labelStride`, `BarDatum`, `LineSet` from `@/lib/charts`; `cn` from `@/lib/utils`. Gallery and tests only: `earningsFor` from `@/lib/earnings`, `DEMAND_BY_HOUR` from `@/lib/fixtures`, `DataModeProvider` and `useFigures` from `@/lib/data-mode`, `EmptyState` from `@/components/app/EmptyState`, `installDomStubs` and `ResizeObserverStub` from `tests/helpers/dom-stubs`.
- Produces: `<ChartFrame height ariaLabel>{(width) => ReactNode}</ChartFrame>` (`data-slot="chart-frame"`, `AXIS = 20`); `<BarChart data height? format? ariaLabel />`; `<LineChart sets labels height? ariaLabel />` (`ONE_SERIES_BELOW = 560`); `<ChartLegend items />` (`data-slot="chart-legend"`, `LegendItem`, `DAILY_LEGEND`, `DEMAND_LEGEND`). Consumers: Task 14 (the dashboard's daily bars with `format={(v) => \`${v} consultations\`}` and the demand line), Task 16 (earnings bars with `format={money}`), Task 19 (`NoPatientsWaiting`'s demand line), Task 22 (`LiveFloor`'s demand line), Task 26 (the blank-mode sweep asserts zero `svg[role="img"]` and zero `[data-slot="chart-legend"]` on every route). Every caller renders `EmptyState` instead of the chart in blank mode and renders the legend only in the seeded branch — the composition in Step 1's last two tests.

- [ ] **Step 1: The component tests, so they fail on the missing modules**

`tests/charts-components.test.tsx`:

```tsx
// @vitest-environment jsdom
import { test, expect, beforeEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
vi.mock('next/navigation', () => import('./helpers/navigation-mock'));
import { installDomStubs, ResizeObserverStub } from './helpers/dom-stubs';
import { ChartFrame } from '@/components/app/ChartFrame';
import { BarChart } from '@/components/app/BarChart';
import { LineChart, ONE_SERIES_BELOW } from '@/components/app/LineChart';
import { ChartLegend, DAILY_LEGEND, DEMAND_LEGEND } from '@/components/app/ChartLegend';
import { EmptyState } from '@/components/app/EmptyState';
import { DataModeProvider, useFigures } from '@/lib/data-mode';
import { earningsFor } from '@/lib/earnings';
import { DEMAND_BY_HOUR } from '@/lib/fixtures';
import { labelStride } from '@/lib/charts';

const DAILY = earningsFor({ seeded: true, session: [] }).dailySeries;
const SETS = [
  { key: 'first', values: DEMAND_BY_HOUR.map((h) => h.waiting) },
  { key: 'second', values: DEMAND_BY_HOUR.map((h) => h.gps) },
];
const HOURS = DEMAND_BY_HOUR.map((h) => h.hour);

beforeEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  installDomStubs();
  window.history.replaceState(null, '', '/doctor');
});

// jsdom measures every box at 0, so the frame is measured by hand — what a
// browser's ResizeObserver does on observe.
function measure(container: HTMLElement, width: number) {
  const frame = container.querySelector('[data-slot="chart-frame"]')!;
  act(() => ResizeObserverStub.forElement(frame)!.resize(frame, width));
  return frame;
}

test('ChartFrame draws nothing until measured, then at the measured width and never under 240', () => {
  const { container } = render(
    <ChartFrame height={150} ariaLabel="Consultations, last 14 days">{(w) => <svg data-width={w} />}</ChartFrame>,
  );
  const frame = container.querySelector('[data-slot="chart-frame"]')!;
  expect(frame).toHaveStyle({ minHeight: '170px' });
  expect(container.querySelector('svg')).toBeNull();
  expect(frame).toHaveTextContent('Consultations, last 14 days');   // named before it is drawn
  measure(container, 100);
  expect(container.querySelector('svg')).toHaveAttribute('data-width', '240');
  expect(container.querySelector('.sr-only')).toBeNull();           // the svg carries the name now
  measure(container, 640);
  expect(container.querySelector('svg')).toHaveAttribute('data-width', '640');
});

test('ChartFrame stops observing when it unmounts', () => {
  const { container, unmount } = render(<BarChart data={DAILY} ariaLabel="Consultations, last 14 days" />);
  const frame = container.querySelector('[data-slot="chart-frame"]')!;
  expect(ResizeObserverStub.forElement(frame)).toBeDefined();
  unmount();
  expect(ResizeObserverStub.forElement(frame)).toBeUndefined();
});

test('BarChart draws one rect per day at the measured width, today in primary, the rest in outline', () => {
  const { container } = render(
    <BarChart data={DAILY} height={150} format={(v) => `${v} consultations`} ariaLabel="Consultations, last 14 days" />,
  );
  expect(container.querySelector('svg')).toBeNull();
  measure(container, 640);
  const svg = container.querySelector('svg')!;
  expect(svg).toHaveAttribute('role', 'img');
  expect(svg).toHaveAttribute('aria-label', 'Consultations, last 14 days');
  expect(svg).toHaveAttribute('viewBox', '0 0 640 170');
  const rects = [...container.querySelectorAll('rect')];
  expect(rects).toHaveLength(14);
  expect(rects.filter((r) => r.classList.contains('fill-primary'))).toHaveLength(1);
  expect(rects.at(-1)).toHaveClass('fill-primary');
  expect(rects.slice(0, -1).every((r) => r.classList.contains('fill-outline'))).toBe(true);
  expect(container.querySelectorAll('rect > title')).toHaveLength(14);
  expect(container.querySelector('rect > title')).toHaveTextContent('15: 1 consultations');
  expect(container.querySelector('line')).toHaveClass('stroke-rule');
});

test('BarChart prints fewer day labels when narrow, via labelStride', () => {
  const { container } = render(<BarChart data={DAILY} height={150} ariaLabel="Consultations, last 14 days" />);
  measure(container, 640);
  expect(container.querySelectorAll('text')).toHaveLength(14);
  measure(container, 300);
  expect(labelStride(14, 300)).toBe(2);
  expect(container.querySelectorAll('text')).toHaveLength(7);
  for (const t of container.querySelectorAll('text')) expect(t).toHaveClass('fill-ink-2', 'font-display', 'text-[11px]');
});

test('LineChart draws two paths at 640 and one at 390, on one shared ceiling', () => {
  const { container } = render(
    <LineChart sets={SETS} labels={HOURS} height={150} ariaLabel="Demand against cover, by hour" />,
  );
  measure(container, 640);
  expect(container.querySelector('svg')).toHaveAttribute('viewBox', '0 0 640 170');
  const paths = container.querySelectorAll('path');
  expect(paths).toHaveLength(2);
  expect(paths[0]).toHaveAttribute('data-key', 'first');
  expect(paths[0]).toHaveClass('stroke-primary');
  expect(paths[0]).not.toHaveAttribute('stroke-dasharray');
  expect(paths[1]).toHaveAttribute('data-key', 'second');
  expect(paths[1]).toHaveClass('stroke-ink-2');
  expect(paths[1]).toHaveAttribute('stroke-dasharray', '5 4');
  for (const p of paths) {
    expect(p).toHaveAttribute('stroke-width', '2');
    expect(p).toHaveAttribute('fill', 'none');
  }
  // Patients waiting peaks at 9 and touches the top; GPs online peaks at 4 and does not.
  expect(paths[0].getAttribute('d')).toMatch(/ 0\.0\b/);
  expect(paths[1].getAttribute('d')).not.toMatch(/ 0\.0\b/);
  measure(container, 390);
  expect(container.querySelectorAll('path')).toHaveLength(1);
  expect(container.querySelector('path')).toHaveAttribute('data-key', 'first');
  measure(container, ONE_SERIES_BELOW - 1);
  expect(container.querySelectorAll('path')).toHaveLength(1);
  measure(container, ONE_SERIES_BELOW);
  expect(container.querySelectorAll('path')).toHaveLength(2);
});

test('LineChart labels both ends and drops the tick that would collide with the last', () => {
  const labels = Array.from({ length: 16 }, (_, i) => String(i));
  const { container } = render(
    <LineChart sets={[{ key: 'first', values: labels.map(Number) }]} labels={labels} height={150} ariaLabel="Ticks" />,
  );
  measure(container, 300);
  const ticks = [...container.querySelectorAll('text')];
  const printed = ticks.map((t) => Number(t.textContent));
  expect(printed[0]).toBe(0);
  expect(printed.at(-1)).toBe(15);
  expect(printed).not.toContain(14);
  expect(ticks[0]).toHaveAttribute('text-anchor', 'start');
  expect(ticks.at(-1)).toHaveAttribute('text-anchor', 'end');
});

test('ChartLegend swatches are the marks: solid primary and outline, and an ink-2 dashed line that leaves at phone width', () => {
  const { container } = render(<><ChartLegend items={DAILY_LEGEND} /><ChartLegend items={DEMAND_LEGEND} /></>);
  const [daily, demand] = container.querySelectorAll('[data-slot="chart-legend"]');
  expect(daily).toHaveTextContent('Today');
  expect(daily).toHaveTextContent('Earlier days');
  expect(daily.querySelector('[data-swatch="primary"] span')).toHaveClass('bg-primary');
  expect(daily.querySelector('[data-swatch="outline"] span')).toHaveClass('bg-outline');
  const dashed = demand.querySelector('[data-swatch="ink-2"]')!;
  expect(dashed).toHaveTextContent('GPs online');
  expect(dashed.querySelector('line')).toHaveClass('stroke-ink-2');
  expect(dashed.querySelector('line')).toHaveAttribute('stroke-dasharray', '5 4');
  expect(dashed).toHaveClass('max-phone:hidden');
  expect(demand.querySelector('[data-swatch="primary"]')).not.toHaveClass('max-phone:hidden');
});

// The composition every chart card copies. A legend is a caption for a picture:
// in blank mode there is no picture, so there is no legend either.
function DailyChartCard() {
  const { seeded } = useFigures();
  if (!seeded) return <EmptyState>No consultations yet.</EmptyState>;
  return (
    <>
      <BarChart data={DAILY} height={150} ariaLabel="Consultations, last 14 days" />
      <ChartLegend items={DAILY_LEGEND} />
    </>
  );
}

test('no picture, no legend: blank mode renders the written empty state alone', () => {
  const { container } = render(<DataModeProvider><DailyChartCard /></DataModeProvider>);
  expect(container.querySelector('[data-slot="empty"]')).toHaveTextContent('No consultations yet.');
  expect(container.querySelector('[data-slot="chart-frame"]')).toBeNull();
  expect(container.querySelector('svg')).toBeNull();
  expect(container.querySelector('[data-slot="chart-legend"]')).toBeNull();
});

test('seeded mode draws the chart with its legend', () => {
  window.history.replaceState(null, '', '/doctor?data=seeded');
  const { container } = render(<DataModeProvider><DailyChartCard /></DataModeProvider>);
  expect(container.querySelector('[data-slot="empty"]')).toBeNull();
  measure(container, 640);
  expect(container.querySelectorAll('rect')).toHaveLength(14);
  expect(container.querySelector('[data-slot="chart-legend"]')).toHaveTextContent('Today');
});
```

Run: `npx vitest run tests/charts-components.test.tsx` → the file fails to load: `Failed to resolve import "@/components/app/ChartFrame"`. 0 tests run.

- [ ] **Step 2: `components/app/ChartFrame.tsx`**

```tsx
'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';

/* A chart is drawn at the width its box really has, so one SVG unit is one
   CSS pixel and the axis type renders at the size it was authored at. A
   fixed viewBox scaled down to a phone shrinks the labels with it, which is
   how a chart ends up with an axis nobody can read (the port of mountChart).
   The width is only known after mount, so the server shell reserves the
   height and draws nothing, the client's first render agrees with it, and
   the picture appears on the first measurement. */

export const AXIS = 20;   // the label band under the baseline
const MIN_WIDTH = 240;    // a collapsed or hidden box still gets a legible chart

type Props = { height: number; ariaLabel: string; children: (width: number) => ReactNode };

export function ChartFrame({ height, ariaLabel, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(MIN_WIDTH, Math.round(entry.contentRect.width)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} data-slot="chart-frame" className="w-full" style={{ minHeight: height + AXIS }}>
      {/* Until there is a picture the frame still says what will be here, so the
          server shell and a scripts-off page are not silent about it. */}
      {width === null ? <span className="sr-only">{ariaLabel}</span> : children(width)}
    </div>
  );
}
```

- [ ] **Step 3: `components/app/BarChart.tsx`**

```tsx
'use client';
import { barGeometry, labelStride, type BarDatum } from '@/lib/charts';
import { AXIS, ChartFrame } from './ChartFrame';

/* The daily bars. Today is the one primary mark; every earlier day is the
   solid outline grey, which reads at 4.5:1 on white where a tint would not.
   A client component only because the render prop it hands ChartFrame
   cannot cross a server boundary. */

type Props = {
  data: BarDatum[];
  height?: number;
  format?: (value: number) => string;
  ariaLabel: string;
};

export function BarChart({ data, height = 150, format = String, ariaLabel }: Props) {
  return (
    <ChartFrame height={height} ariaLabel={ariaLabel}>
      {(width) => {
        const bars = barGeometry(data.map((d) => d.value), { width, height });
        const stride = labelStride(data.length, width);
        return (
          <svg
            role="img"
            aria-label={ariaLabel}
            viewBox={`0 0 ${width} ${height + AXIS}`}
            preserveAspectRatio="xMidYMid meet"
            className="block h-auto w-full"
          >
            <line className="stroke-rule" x1={0} y1={height + 0.5} x2={width} y2={height + 0.5} />
            {bars.map((bar, i) => (
              <rect
                key={i}
                data-emph={data[i].emph ?? 'false'}
                className={data[i].emph === 'true' ? 'fill-primary' : 'fill-outline'}
                x={bar.x}
                y={bar.y}
                width={bar.w}
                height={bar.h}
                rx={2}
              >
                <title>{`${data[i].label}: ${format(bar.value)}`}</title>
              </rect>
            ))}
            {bars.map((bar, i) => i % stride === 0 && (
              <text
                key={i}
                className="fill-ink-2 font-display text-[11px]"
                x={bar.x + bar.w / 2}
                y={height + 14}
                textAnchor="middle"
              >
                {data[i].label}
              </text>
            ))}
          </svg>
        );
      }}
    </ChartFrame>
  );
}
```

- [ ] **Step 4: `components/app/LineChart.tsx`**

```tsx
'use client';
import { labelStride, linePoints, toPath, type LineSet } from '@/lib/charts';
import { AXIS, ChartFrame } from './ChartFrame';

/* Two series on one pair of axes and no fill under either line. The
   ceiling is shared across every set, drawn or not, so a value sits at the
   same height on the phone as on the desk. Below the phone line only the
   first series is drawn: two lines at 300px cross into a smear, and the
   second — cover — is the one a GP can least act on. A client component
   only because the render prop it hands ChartFrame cannot cross a server
   boundary. */

export const ONE_SERIES_BELOW = 560;

type Props = { sets: LineSet[]; labels: string[]; height?: number; ariaLabel: string };

export function LineChart({ sets, labels, height = 150, ariaLabel }: Props) {
  return (
    <ChartFrame height={height} ariaLabel={ariaLabel}>
      {(width) => {
        const drawn = width < ONE_SERIES_BELOW ? sets.slice(0, 1) : sets;
        const max = Math.max(...sets.flatMap((s) => s.values), 1);
        const stride = labelStride(labels.length, width);
        const last = labels.length - 1;
        return (
          <svg
            role="img"
            aria-label={ariaLabel}
            viewBox={`0 0 ${width} ${height + AXIS}`}
            preserveAspectRatio="xMidYMid meet"
            className="block h-auto w-full"
          >
            <line className="stroke-rule" x1={0} y1={height + 0.5} x2={width} y2={height + 0.5} />
            {drawn.map((set, i) => (
              <path
                key={set.key}
                data-key={set.key}
                d={toPath(linePoints(set.values, { width, height, max }))}
                className={i === 0 ? 'stroke-primary' : 'stroke-ink-2'}
                strokeDasharray={i === 0 ? undefined : '5 4'}
                fill="none"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            {labels.map((label, i) => {
              // Both ends always print; a tick within one stride of the last would sit on top of it.
              if (i !== last && (i % stride !== 0 || last - i < stride)) return null;
              return (
                <text
                  key={i}
                  className="fill-ink-2 font-display text-[11px]"
                  x={last === 0 ? 0 : (i / last) * width}
                  y={height + 14}
                  textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'}
                >
                  {label}
                </text>
              );
            })}
          </svg>
        );
      }}
    </ChartFrame>
  );
}
```

- [ ] **Step 5: `components/app/ChartLegend.tsx`**

```tsx
import { cn } from '@/lib/utils';

/* A legend is a caption for a picture. The swatches are the marks themselves
   — the solid squares of the bars, the dashed line of the second series —
   and a caller renders it only beside a drawn chart, never above an empty
   state: with no data there is no picture (dashboard.css:194). */

export type LegendItem = { label: string; swatch: 'primary' | 'outline' | 'ink-2' };

// doctor.html:95 and :199; doctor.html:105 and admin.html:78.
export const DAILY_LEGEND: LegendItem[] = [
  { label: 'Today', swatch: 'primary' },
  { label: 'Earlier days', swatch: 'outline' },
];
export const DEMAND_LEGEND: LegendItem[] = [
  { label: 'Patients waiting', swatch: 'primary' },
  { label: 'GPs online', swatch: 'ink-2' },
];

function Swatch({ swatch }: { swatch: LegendItem['swatch'] }) {
  if (swatch === 'ink-2') {
    return (
      <svg aria-hidden="true" width={16} height={2} viewBox="0 0 16 2" className="shrink-0">
        <line className="stroke-ink-2" x1={0} y1={1} x2={16} y2={1} strokeWidth={2} strokeDasharray="5 4" />
      </svg>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn('size-2.5 shrink-0 rounded-[2px]', swatch === 'primary' ? 'bg-primary' : 'bg-outline')}
    />
  );
}

export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <div data-slot="chart-legend" className="mt-3 flex flex-wrap gap-4 text-fine text-ink-2">
      {items.map((item) => (
        // Below the phone line LineChart draws its first series only; the caption
        // for the dashed second series leaves with it.
        <span
          key={item.label}
          data-swatch={item.swatch}
          className={cn('inline-flex items-center gap-1.5', item.swatch === 'ink-2' && 'max-phone:hidden')}
        >
          <Swatch swatch={item.swatch} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Run the chart tests**

Run: `npx vitest run tests/charts-components.test.tsx` → 9 passed. `npm run typecheck` → green.

- [ ] **Step 7: Gallery — both charts on the three surfaces, and the blank-mode pairing**

In `app/dev/ui/gallery.tsx`, after the line `import { SegmentedLink, SegmentedLinkGroup } from '@/components/ui/segmented-link';` add:

```tsx
import { BarChart } from '@/components/app/BarChart';
import { LineChart } from '@/components/app/LineChart';
import { ChartLegend, DAILY_LEGEND, DEMAND_LEGEND } from '@/components/app/ChartLegend';
import { EmptyState } from '@/components/app/EmptyState';
import { earningsFor } from '@/lib/earnings';
import { DEMAND_BY_HOUR } from '@/lib/fixtures';
```

After `type Surface = (typeof SURFACES)[number];` add the seeded series, derived once from the same modules the surfaces read:

```tsx
// The seeded fixture series every chart card draws (lib/earnings, lib/fixtures).
const DAILY_SERIES = earningsFor({ seeded: true, session: [] }).dailySeries;
const DEMAND_SETS = [
  { key: 'first', values: DEMAND_BY_HOUR.map((h) => h.waiting) },
  { key: 'second', values: DEMAND_BY_HOUR.map((h) => h.gps) },
];
const DEMAND_LABELS = DEMAND_BY_HOUR.map((h) => h.hour);
```

In the header nav array, old `'progress', 'avatar'` → new `'progress', 'charts', 'avatar'`.

Immediately before `<Section id="avatar" title="Avatar"` insert the section. Each surface gets its own full-width panel rather than the three-column `Surfaces` grid: a third of the wrap measures under 560 and the line chart would show its phone form on the desk.

```tsx
      <Section id="charts" title="Charts" note="Inline SVG from lib/charts.ts geometry, drawn at the box's measured width so the axis type never shrinks with the viewport. Today's bar and the first series are the one primary mark; earlier bars are the solid outline grey and the second series is ink-2, dashed. Below 560px the line chart draws one series and the legend drops its caption — narrow the window to see it. No product chart sits on the band; the band panel is here so the marks can be checked against it. In blank mode a chart card renders its written empty state and no legend: a legend is a caption for a picture.">
        <div className="grid gap-4">
          {SURFACES.map((s) => (
            <div key={s.id} data-surface={s.id} className={cn('grid gap-6 rounded-xl p-6', s.panel)}>
              <p className={cn('text-fine', s.muted)}>{s.label}</p>
              <div>
                <p className="text-body font-semibold mb-3">Consultations, last 14 days</p>
                <BarChart data={DAILY_SERIES} height={150} format={(v) => `${v} consultations`} ariaLabel="Consultations, last 14 days" />
                <ChartLegend items={DAILY_LEGEND} />
              </div>
              <div>
                <p className="text-body font-semibold mb-3">Demand against cover, by hour</p>
                <LineChart sets={DEMAND_SETS} labels={DEMAND_LABELS} height={150} ariaLabel="Demand against cover, by hour" />
                <ChartLegend items={DEMAND_LEGEND} />
              </div>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-4 max-cols:grid-cols-1">
            <Card className="w-full">
              <CardHeader><CardTitle>Seeded</CardTitle><CardDescription>The picture and its caption.</CardDescription></CardHeader>
              <CardContent>
                <BarChart data={DAILY_SERIES} height={150} format={(v) => `${v} consultations`} ariaLabel="Consultations, last 14 days" />
                <ChartLegend items={DAILY_LEGEND} />
              </CardContent>
            </Card>
            <Card className="w-full">
              <CardHeader><CardTitle>Blank</CardTitle><CardDescription>No picture, no legend.</CardDescription></CardHeader>
              <CardContent><EmptyState>No consultations yet.</EmptyState></CardContent>
            </Card>
          </div>
        </div>
      </Section>
```

Copy sources: "Consultations, last 14 days" `preview/doctor.html:86`; "Demand against cover, by hour" `preview/admin.html:74`; "Today" / "Earlier days" `doctor.html:95, 199`; "Patients waiting" / "GPs online" `doctor.html:105`, `admin.html:78`; "No consultations yet." and the `${v} consultations` format `doctor.js:173-174`. "Seeded", "Blank", "The picture and its caption." and "No picture, no legend." are gallery-only labels.

Open `http://localhost:3000/dev/ui#charts` on the running dev server: at 1440 every panel shows fourteen bars (the last in primary) and two lines (the second dashed); narrow the window below 560 and the second line and "GPs online" leave together; the Blank card shows the dashed empty state with no legend under it.

- [ ] **Step 8: Record the additions in the contract**

In `docs/superpowers/plans/2026-09-02-doctor-admin-surfaces.md`, "Shared app components (Tasks 8–11)":

Old:
```
<ChartFrame height={150} ariaLabel>{(width) => ReactNode}</ChartFrame>   // <div data-slot="chart-frame">; width from ResizeObserver, max(240, …); renders no <svg> until measured
```
New:
```
<ChartFrame height={150} ariaLabel>{(width) => ReactNode}</ChartFrame>   // <div data-slot="chart-frame">; width from ResizeObserver, max(240, …); renders no <svg> until measured, only the ariaLabel as sr-only text; exports AXIS = 20
```

Old:
```
<LineChart sets={LineSet[]} labels height ariaLabel />  // set 0 stroke-primary, set 1 stroke-ink-2 strokeDasharray="5 4"; 2px; fill none; below 560 measured width draws sets[0] only
```
New:
```
<LineChart sets={LineSet[]} labels height ariaLabel />  // set 0 stroke-primary, set 1 stroke-ink-2 strokeDasharray="5 4"; 2px; fill none; below 560 measured width draws sets[0] only (exports ONE_SERIES_BELOW = 560; the ceiling stays shared across every set); BarChart and LineChart are 'use client' because the render prop they hand ChartFrame cannot cross a server boundary
```

Old:
```
<ChartLegend items={{ label, swatch: 'primary' | 'outline' | 'ink-2' }[]} />   // 'ink-2' is a 16×2 dashed line; rendered only alongside a drawn chart, never with an empty state
```
New:
```
<ChartLegend items={{ label, swatch: 'primary' | 'outline' | 'ink-2' }[]} />   // 'ink-2' is a 16×2 dashed line and its item carries max-phone:hidden (the caption leaves with the second series); rendered only alongside a drawn chart, never with an empty state; exports LegendItem, DAILY_LEGEND (Today / Earlier days) and DEMAND_LEGEND (Patients waiting / GPs online) so no surface retypes them
```

In "File Structure", old:
```
    ├── app-components.test.tsx (StatTile, EmptyState, StatusBadge, Stepper, Countdown, charts, Ribbon, StateJumper, CredentialMatrix)
```
New:
```
    ├── app-components.test.tsx (StatTile, EmptyState, StatusBadge, Stepper, Countdown, Ribbon, StateJumper, CredentialMatrix)
    ├── charts-components.test.tsx (ChartFrame, BarChart, LineChart, ChartLegend)
```

- [ ] **Step 9: Run the whole suite, typecheck, commit**

Run: `npm test` → green (`tests/constraints.test.ts` scans the four new files and the gallery: every colour is a token class — `fill-primary`, `fill-outline`, `fill-ink-2`, `stroke-primary`, `stroke-ink-2`, `stroke-rule`, `bg-primary`, `bg-outline`, `text-ink-2` — and `text-[11px]` / `rounded-[2px]` carry no colour function; no `dark:`, no hex). `npm run typecheck` → green.

```bash
git add components/app/ChartFrame.tsx components/app/BarChart.tsx components/app/LineChart.tsx components/app/ChartLegend.tsx app/dev/ui/gallery.tsx tests/charts-components.test.tsx docs/superpowers/plans/2026-09-02-doctor-admin-surfaces.md
git commit -m "feat(app): inline SVG charts drawn at measured width

ChartFrame measures its box with a ResizeObserver and draws nothing until
it has a width, so the server shell and the client's first render agree;
BarChart and LineChart draw JSX from the ported geometry at that width
with solid token marks (today and the first series in primary, earlier
bars in outline, the second series in ink-2 dashed) over a stroke-rule
baseline. Below the phone line the line chart draws one series and the
legend drops the matching caption. The gallery shows both charts on the
three surfaces and the blank-mode pairing: no picture, no legend.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: The credential matrix — severity by fill, border and position

> Note: the brief and the Interface contract agree on every name, prop and type. The one divergence is location: the tests live in `tests/credential-matrix.test.tsx` as the brief says, not inside the File Structure's `tests/app-components.test.tsx` (Task 9's file is not touched). One wording refinement, both halves from the preview: a `pending` or `rejected` check with `daysRemaining: null` renders the dash (`admin.html:229`), not "No expiry" (`doctor.js:263`), because "No expiry" on a DBS check that has not been verified yet would claim the check never expires.

**Files:**
- Create: `components/app/CredentialMatrix.tsx`
- Modify: `app/dev/ui/gallery.tsx` (a `credential-matrix` section; the id in the header nav; two imports)
- Test: `tests/credential-matrix.test.tsx`
- Read: `components/ui/table.tsx` (as modified in Task 8: `stack` on `Table`, `label` on `TableCell`, the explicit roles), `components/app/StatusBadge.tsx` (Task 9), `lib/alerts.ts` (`CREDENTIAL_KEYS`, `CREDENTIAL_LABELS`, `STATUS_LABELS`), `lib/fixtures.ts` (`GPS`, `MY_RECORD`, `GATE_RECORDS`, the credential types), `lib/format.ts` (`daysLabel`), `lib/placeholder.ts` (`DASH`), `preview/admin.html:148-166` (the supply table, `Days remaining`) and `:225-240` (the per-GP cells, the null dash, "an expired credential must be unmissable, so its row leads"), `preview/js/doctor.js:244-268` (the profile rows: "No expiry", "N days remaining", "Not submitted", the dash badge in blank mode), `preview/css/components.css:40-54` (expired/rejected = dark fill + white text; expiring = dark border; the high-severity row is filled and bold), `preview/doctor.html:229-238` (profile "Credentials" section) and `:292-299` (the five onboarding credentials)

**Interfaces:**
- Consumes: `Table` (`stack?: 'cols' | 'phone'`), `TableBody`, `TableCaption`, `TableCell` (`label?: string` → `data-label`), `TableHead`, `TableHeader`, `TableRow` from `@/components/ui/table` (Task 8); `StatusBadge` (`status: CredentialStatus | null`, `onBand?: boolean`, `data-status`, `null` → "—" with `aria-label="Not submitted"`) from `@/components/app/StatusBadge` (Task 9); `CREDENTIAL_KEYS`, `CREDENTIAL_LABELS` from `@/lib/alerts` and `CredentialKey`, `CredentialRecord`, `CredentialStatus` from `@/lib/fixtures` (Task 3); `daysLabel` from `@/lib/format` and `DASH` from `@/lib/placeholder` (Task 2); `cn` from `@/lib/utils`.
- Produces: `<CredentialMatrix record={CredentialRecord} seeded={boolean} caption={string} keys?={readonly CredentialKey[]} stack?="phone" />` exactly as the contract states — rows in `CREDENTIAL_KEYS` order (or `keys`), sorted urgent-first when seeded (expired, rejected, pending, expiring by days ascending, valid; ties keep key order); expired rows `bg-band text-white hover:bg-band` with `onBand` badges; expiring rows `border-2! border-ink`; valid rows plain; blank mode: every status `null`, no sort, every expiry cell "Not submitted". No hook, no handler, so no `'use client'`; nothing reads `window`, `document` or `Date.now()`. Consumed by Task 17 (profile, `MY_RECORD`), Task 18 (the credentials step, `keys={['gmc','licence','cct','dbs','rightToWork']}` with a full `CredentialRecord` — `GATE_RECORDS['verification-pending']`'s five onboarding rows are identical to `ONBOARDING_RECORD`) and Task 24 (supply's per-GP view).

- [ ] **Step 1: Write the tests first — order, fill, border, blank, keys, caption**

`tests/credential-matrix.test.tsx`:

```tsx
// @vitest-environment jsdom
import { test, expect, beforeEach, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
vi.mock('next/navigation', () => import('./helpers/navigation-mock'));
import { installDomStubs } from './helpers/dom-stubs';
import { CredentialMatrix } from '@/components/app/CredentialMatrix';
import { GATE_RECORDS, MY_RECORD, type CredentialRecord } from '@/lib/fixtures';
import { CREDENTIAL_KEYS, CREDENTIAL_LABELS } from '@/lib/alerts';
import { DASH } from '@/lib/placeholder';

// The matrix has no hook, so the navigation mock is inert; it is installed
// anyway so every component test in this suite starts from the same floor.
beforeEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); installDomStubs(); });

const rows = (c: HTMLElement) => [...c.querySelectorAll<HTMLTableRowElement>('tbody tr')];
const labels = (c: HTMLElement) => rows(c).map((r) => r.querySelector('th')!.textContent);
const expiry = (c: HTMLElement) => rows(c).map((r) => r.querySelectorAll('td')[1].textContent);
const badge = (row: HTMLElement) => row.querySelector<HTMLElement>('[data-slot="badge"]')!;

test('blank mode: every credential in record order, no status, "Not submitted" throughout', () => {
  const { container } = render(<CredentialMatrix record={MY_RECORD} seeded={false} caption="Your credentials" />);
  expect(labels(container)).toEqual(CREDENTIAL_KEYS.map((k) => CREDENTIAL_LABELS[k]));
  expect(expiry(container)).toEqual(Array(7).fill('Not submitted'));
  expect(screen.getAllByLabelText('Not submitted')).toHaveLength(7);
  for (const row of rows(container)) {
    expect(badge(row)).toHaveTextContent(DASH);
    expect(row).not.toHaveClass('bg-band');
    expect(row).not.toHaveClass('border-ink');
  }
});

test('GP-003: the expired indemnity leads on a band row whose badge goes white', () => {
  const { container } = render(<CredentialMatrix record={GATE_RECORDS['indemnity-expired']} seeded caption="GP-003" />);
  expect(labels(container)).toEqual([
    'Indemnity cover', 'GMC registration', 'Licence to practise', 'CCT / specialist registration',
    'DBS check', 'Right to work', 'GMC revalidation',
  ]);
  const [lead, ...rest] = rows(container);
  expect(lead).toHaveClass('bg-band', 'text-white', 'hover:bg-band');
  expect(lead.querySelector('[data-status="expired"]')).toHaveTextContent('Expired');
  expect(badge(lead)).toHaveClass('text-white');
  expect(expiry(container)[0]).toBe('0 days');
  for (const row of rest) expect(row).not.toHaveClass('bg-band');
  expect(container.querySelectorAll('[data-status="valid"]')).toHaveLength(6);
});

test('GP-002: expiring rows lead soonest-first with an ink border, then the valid rows in record order', () => {
  const { container } = render(<CredentialMatrix record={MY_RECORD} seeded caption="Your credentials" />);
  expect(labels(container)).toEqual([
    'Indemnity cover', 'DBS check', 'GMC registration', 'Licence to practise',
    'CCT / specialist registration', 'Right to work', 'GMC revalidation',
  ]);
  expect(expiry(container)).toEqual(['9 days', '12 days', '250 days', '250 days', 'No expiry', 'No expiry', '120 days']);
  const all = rows(container);
  for (const row of all.slice(0, 2)) expect(row).toHaveClass('border-2!', 'border-ink');
  for (const row of all.slice(2)) expect(row).not.toHaveClass('border-ink');
  expect(container.querySelector('.bg-band')).toBeNull();
  expect(container.querySelectorAll('[data-status="expiring"]')).toHaveLength(2);
});

test('the full order is expired, rejected, pending, expiring by days, valid', () => {
  const mixed: CredentialRecord = {
    ...MY_RECORD,
    gmc: { status: 'pending', daysRemaining: null },
    licence: { status: 'rejected', daysRemaining: null },
    cct: { status: 'expired', daysRemaining: 0 },
  };
  const { container } = render(<CredentialMatrix record={mixed} seeded caption="Mixed" />);
  expect(labels(container)).toEqual([
    'CCT / specialist registration', 'Licence to practise', 'GMC registration',
    'Indemnity cover', 'DBS check', 'Right to work', 'GMC revalidation',
  ]);
  expect(expiry(container)).toEqual(['0 days', DASH, DASH, '9 days', '12 days', 'No expiry', '120 days']);
  const all = rows(container);
  expect(all[0]).toHaveClass('bg-band');
  expect(all[1]).not.toHaveClass('bg-band');                      // rejected is a badge, not a fill
  expect(all[1].querySelector('[data-status="rejected"]')).toHaveTextContent('Rejected');
  expect(container.querySelectorAll('.bg-band')).toHaveLength(1);
});

test('GP-004: a pending check has no expiry yet, so its cell is the dash, not "No expiry"', () => {
  const { container } = render(<CredentialMatrix record={GATE_RECORDS['verification-pending']} seeded caption="GP-004" />);
  expect(labels(container)).toEqual([
    'GMC registration', 'Licence to practise', 'CCT / specialist registration', 'DBS check',
    'Indemnity cover', 'GMC revalidation', 'Right to work',
  ]);
  expect(expiry(container)).toEqual([DASH, DASH, DASH, DASH, DASH, DASH, 'No expiry']);
  expect(container.querySelectorAll('[data-status="pending"]')).toHaveLength(6);
});

test('keys renders the five onboarding credentials and nothing else', () => {
  const { container } = render(
    <CredentialMatrix record={GATE_RECORDS['verification-pending']} seeded caption="Credentials"
      keys={['gmc', 'licence', 'cct', 'dbs', 'rightToWork']} />,
  );
  expect(labels(container)).toEqual(['GMC registration', 'Licence to practise', 'CCT / specialist registration', 'DBS check', 'Right to work']);
  expect(container.textContent).not.toMatch(/Indemnity cover|GMC revalidation/);
});

test('the table is captioned, every header is scoped, and stack marks the table and labels its cells', () => {
  const { container, unmount } = render(<CredentialMatrix record={MY_RECORD} seeded caption="Your credentials" stack="phone" />);
  expect(screen.getByRole('table', { name: 'Your credentials' })).toBeInTheDocument();
  expect(container.querySelector('caption')).toHaveTextContent('Your credentials');
  const heads = [...container.querySelectorAll('th')];
  expect(heads).toHaveLength(10);
  for (const th of heads) expect(th).toHaveAttribute('scope');
  expect(container.querySelectorAll('th[scope="col"]')).toHaveLength(3);
  expect(container.querySelectorAll('th[scope="row"]')).toHaveLength(7);
  expect(container.querySelector('table')).toHaveAttribute('data-stack', 'phone');
  expect(container.querySelectorAll('td[data-label="Status"]')).toHaveLength(7);
  expect(container.querySelectorAll('td[data-label="Days remaining"]')).toHaveLength(7);
  const band = within(container).queryByText('Not submitted');
  expect(band).toBeNull();
  unmount();
  const plain = render(<CredentialMatrix record={MY_RECORD} seeded caption="Your credentials" />);
  expect(plain.container.querySelector('table')).not.toHaveAttribute('data-stack');
});
```

Run: `npx vitest run tests/credential-matrix.test.tsx` → the file fails to load: `Error: Failed to resolve import "@/components/app/CredentialMatrix" from "tests/credential-matrix.test.tsx". Does the file exist?`

- [ ] **Step 2: `components/app/CredentialMatrix.tsx`**

Copy sources: the credential labels are `CREDENTIAL_LABELS` (`alerts.js:6-14`, `doctor.js:248-256`); "No expiry" and "Not submitted" are `doctor.js:263-264`; "N days" is `admin.html:229`; the dash for a null expiry is `admin.html:229`; "Days remaining" is `admin.html:163`; "Status" is `admin.html:105`. The column header "Credential" is a new string (listed in the report). The severity treatment is `components.css:47-49, 54` and the sort rule is `admin.html:235-237`.

```tsx
import {
  Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/app/StatusBadge';
import { CREDENTIAL_KEYS, CREDENTIAL_LABELS } from '@/lib/alerts';
import { daysLabel } from '@/lib/format';
import { DASH } from '@/lib/placeholder';
import { cn } from '@/lib/utils';
import type { CredentialKey, CredentialRecord, CredentialStatus } from '@/lib/fixtures';

/* The credential record as a table, ordered by how soon each row stops the GP
   working. Severity is fill, border and position, never a hue: an expired
   credential is band-filled and leads, an expiring one carries a 2px ink
   border and follows soonest-first, a valid one is plain. One component for
   the profile, the onboarding credentials step (`keys`) and supply's per-GP
   view, so the three can never disagree about what is urgent. */

type Props = {
  record: CredentialRecord;
  seeded: boolean;
  caption: string;
  keys?: readonly CredentialKey[];
  stack?: 'phone';
};

// Position is the first channel: the lower the rank, the higher the row.
const RANK: Record<CredentialStatus, number> = { expired: 0, rejected: 1, pending: 2, expiring: 3, valid: 4 };

const daysOf = (days: number | null) => (days === null ? Infinity : days);

function order(record: CredentialRecord, keys: readonly CredentialKey[]): CredentialKey[] {
  return keys
    .map((key, index) => ({ key, index, status: record[key].status, days: daysOf(record[key].daysRemaining) }))
    .sort((a, b) =>
      RANK[a.status] - RANK[b.status]
      || (a.status === 'expiring' ? a.days - b.days : 0)
      || a.index - b.index)
    .map((row) => row.key);
}

// A pending or rejected check has no expiry *yet*: its cell is the dash
// (admin.html:229), not "No expiry", which would claim the check never expires.
function expiry(status: CredentialStatus, days: number | null): string {
  if (days !== null) return daysLabel(days);
  return status === 'pending' || status === 'rejected' ? DASH : 'No expiry';
}

export function CredentialMatrix({ record, seeded, caption, keys = CREDENTIAL_KEYS, stack }: Props) {
  // `seeded` is this table's shown(): the record is the only figure here, and
  // blank mode has no record, so nothing is sorted and every row reads
  // "Not submitted" (doctor.js:262-267).
  const rows = seeded ? order(record, keys) : [...keys];

  return (
    <Table stack={stack}>
      <TableCaption className="sr-only">{caption}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col">Credential</TableHead>
          <TableHead scope="col">Status</TableHead>
          <TableHead scope="col">Days remaining</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((key) => {
          const { status, daysRemaining } = record[key];
          const shown = seeded ? status : null;
          const band = shown === 'expired';
          const bordered = shown === 'expiring';
          return (
            <TableRow
              key={key}
              data-credential={key}
              className={cn(
                // hover:bg-band: TableRow's surface-mid hover would turn the fill light.
                // The stacked label (::before) is ink-2, invisible on the band, so it goes band-ink-2.
                band && 'bg-band font-semibold text-white hover:bg-band [&>td]:before:text-band-ink-2!',
                // `!`: TableBody strips the last row's border with [&_tr:last-child]:border-0.
                bordered && 'border-2! border-ink',
              )}
            >
              {/* The label is read, not scanned: body face and size, not the column header's label-caps. */}
              <TableHead
                scope="row"
                className={cn('font-sans text-body font-semibold normal-case tracking-normal whitespace-normal', band ? 'text-white' : 'text-ink')}
              >
                {CREDENTIAL_LABELS[key]}
              </TableHead>
              <TableCell label="Status">
                <StatusBadge status={shown} onBand={band} />
              </TableCell>
              <TableCell label="Days remaining" className={cn('text-fine tabular-nums', band ? 'text-band-ink-2' : 'text-ink-2')}>
                {seeded ? expiry(status, daysRemaining) : 'Not submitted'}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
```

Why these choices, for the record: the caption is `sr-only` because every caller places a visible heading directly above the table (`doctor.html:231` "Credentials"; the supply per-GP view is titled by its GP ref), and a second visible title would be the fine print `CLAUDE.md` forbids — the table still has an accessible name. The row header overrides `TableHead`'s label-caps through `cn()` (tailwind-merge resolves the font-size, family, transform, tracking and colour conflicts because `text-body` is registered in `lib/utils.ts`); nothing in `components/ui/` changes. `[&>td]:before:` is the only place the stacked layout's printed label needs a colour, and only on the band row. Every colour is a token class (`bg-band`, `text-white`, `border-ink`, `text-ink`, `text-ink-2`, `text-band-ink-2`); `success`/`error` appear only inside `StatusBadge`.

Run: `npx vitest run tests/credential-matrix.test.tsx` → 7 passed.

- [ ] **Step 3: Gallery — the four records, on white**

In `app/dev/ui/gallery.tsx`:

Imports — add after the `SegmentedLink` import (if Task 9 or 10 already imports from `@/lib/fixtures`, merge `GATE_RECORDS`, `MY_RECORD` and the `CredentialRecord` type into that line instead of adding a second):

```tsx
import { CredentialMatrix } from '@/components/app/CredentialMatrix';
import { GATE_RECORDS, MY_RECORD, type CredentialRecord } from '@/lib/fixtures';
```

Module scope, after `type Surface = …`:

```tsx
// The four records the matrix must tell apart: two expiring, one expired,
// one still in verification, and blank mode with no record at all.
const MATRIX_EXAMPLES: Array<[title: string, record: CredentialRecord, seeded: boolean]> = [
  ['GP-002 — two expiring', MY_RECORD, true],
  ['GP-003 — indemnity expired', GATE_RECORDS['indemnity-expired'], true],
  ['GP-004 — in verification', GATE_RECORDS['verification-pending'], true],
  ['Blank mode', MY_RECORD, false],
];
```

Header nav array — old:
```tsx
'sidebar'].map((id) => (
```
new:
```tsx
'credential-matrix', 'sidebar'].map((id) => (
```

Section — insert immediately before `<Section id="sidebar" …>`:

```tsx
      <Section id="credential-matrix" title="CredentialMatrix" note="Severity by fill, border and position, never a hue: an expired row is band-filled and leads, its badges go white; an expiring row carries a 2px ink border and follows, soonest first; valid rows are plain. Blank mode has no record, so every row reads Not submitted. Stacks below 560px.">
        <div className="grid grid-cols-2 gap-4 max-cols:grid-cols-1">
          {MATRIX_EXAMPLES.map(([title, record, seeded]) => (
            <Card key={title} className="w-full">
              <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
              <CardContent>
                <CredentialMatrix record={record} seeded={seeded} caption={title} stack="phone" />
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>
```

Run: `npm run typecheck` → green. With the dev server on :3000 (reuse the one already running), open `http://localhost:3000/dev/ui#credential-matrix` and confirm: four white cards; in GP-002 the first two rows carry the ink border and read 9 days then 12 days; in GP-003 the first row is band-filled with white text and a white-on-band "Expired" chip; in GP-004 six pending rows lead with a dash and "Right to work" closes with "No expiry"; the blank card has seven "—" chips and seven "Not submitted"; nothing red, amber or green outside the "Verified" chips. Narrow the window below 560px: each row becomes a block headed by the credential label with "Status" and "Days remaining" printed before their cells, and the band row's printed labels are legible.

- [ ] **Step 4: Run everything, and the greps**

```bash
cd /Users/liam/development/DrQuick/website
npm test
npm run typecheck
grep -nE 'dark:|oklch\(|hsl\(|#[0-9a-fA-F]{3,8}\b' components/app/CredentialMatrix.tsx ; echo "exit $?"
```
Expected: `npm test` green including `tests/constraints.test.ts` (which now scans `components/app/CredentialMatrix.tsx`: no hex, no arbitrary colour function, no `dark:`, no medicine, no banned wording) and `tests/credential-matrix.test.tsx` (7 passed); `npm run typecheck` green; the grep prints nothing and `exit 1`.

- [ ] **Step 5: Commit**

```bash
git add components/app/CredentialMatrix.tsx app/dev/ui/gallery.tsx tests/credential-matrix.test.tsx
git commit -m "feat(app): credential matrix with severity by fill, border and position

One table for the profile, the onboarding credentials step and supply's
per-GP view. Rows sort urgent-first (expired, rejected, pending, expiring
soonest-first, valid); an expired row is band-filled and its badges go
white, an expiring row carries a 2px ink border, a valid row is plain.
Blank mode has no record, so every row reads Not submitted. A pending
check's empty expiry is the dash, not 'No expiry'.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: The app shell — sidebar, top bar, ribbon, arrival, state jumper

> **Note (contract amendments, recorded in Step 11):** (1) `AppShell.nav` is **optional** and defaults from `surface` — `NavItem.icon` is a component, which a server layout cannot pass as a prop (React refuses functions/forwardRef objects across the server→client boundary), so Task 13's layouts omit it and tests may pass it; `TopBar` takes `surface` so the account block (`GP`/`GP-002` vs `AD`/`Admin`) is not derived from the display title. (2) `AppShell` wraps `SidebarProvider` in `TooltipProvider`: `components/ui/sidebar.tsx` mounts none and Radix throws `Tooltip must be used within TooltipProvider` on the collapsed rail's tooltips (the gallery wraps it itself). (3) `--ribbon-h` is set by class (`[--ribbon-h:2.25rem] max-phone:[--ribbon-h:2.75rem]`) rather than inline, because the ribbon is two lines at 390 and a fixed 2.25rem would tuck the sticky top bar 13px under it; `--shell-h` and `--jumper-h` stay inline. (4) Where the tests review and the contract differ, the contract wins: the ribbon is `role="note"` (Decision 25, not `status`), the jumper is `aria-label="Prototype navigation"` (`preview/js/rail.js:21`, not "Development states"), and the jumper reads `window.location` after mount (the hydration rule), never during render. The Task 4 helper is `tests/helpers/navigation-mock.ts` (task map row 4) exporting the shape the tests review gives — `nav`, `resetNav`, `usePathname`, `useRouter` — and `tests/helpers/dom-stubs.ts` exporting `installDomStubs`.

**Files:**
- Create: `components/app/Arrival.tsx`, `components/app/nav.ts`, `components/app/jumps.ts`, `components/app/StateJumper.tsx`, `components/app/SurfaceNav.tsx`, `components/app/TopBar.tsx`, `components/app/AppShell.tsx`
- Modify: `app/globals.css` (one rule after `.js [data-reveal].in`), `app/dev/ui/gallery.tsx` (a `shell` section), `docs/superpowers/plans/2026-09-02-doctor-admin-surfaces.md` (the contract amendments above)
- Test: `tests/app-shell.test.tsx`
- Read: `components/ui/{sidebar,sheet,tooltip,avatar,button}.tsx`, `hooks/use-mobile.ts`, `lib/shell.ts`, `lib/reveal.ts`, `components/LandingBehavior.tsx`, `components/Nav.tsx`, `app/globals.css:236-268`, `preview/js/rail.js`, `preview/js/doctor.js:41-73`, `preview/doctor.html:17-32`, `preview/admin.html:16-31, 210-217`, `preview/css/base.css:60-104`, `preview/css/dashboard.css:1-97`

**Interfaces:**
- Consumes: `Ribbon` (`className?`, Task 9); `DataModeProvider`, `useDataMode`, `usePersistedQuery` from `@/lib/data-mode` (Task 4); `staggerDelay` from `@/lib/reveal`; `activeNav`, `areaOf` from `@/lib/shell` (Task 2); `DOCTOR.ref` (`'GP-002'`) and `DOCTOR_DASHBOARD.initials` (`'GP'`) from `@/lib/fixtures` (Task 3); `SESSION_SCREENS` (Task 6), `ONBOARDING_STEPS` (Task 7), `GATE_RECORDS` (Task 3) in the test only; `installDomStubs` (`tests/helpers/dom-stubs.ts`) and `resetNav` (`tests/helpers/navigation-mock.ts`) from Task 4; `Sidebar`, `SidebarContent`, `SidebarHeader`, `SidebarInset`, `SidebarProvider`, `SidebarRail`, `SidebarTrigger`, `SidebarGroup`, `SidebarGroupContent`, `SidebarMenu`, `SidebarMenuButton`, `SidebarMenuItem`, `useSidebar`, `SheetClose`, `TooltipProvider`, `Avatar`, `AvatarFallback`, `Button`, `cn`.
- Produces: `components/app/nav.ts` — `NavItem`, `DOCTOR_NAV`, `ADMIN_NAV`, `DOCTOR_DASH_SCREENS`, `ADMIN_DASH_SCREENS`, `DOCTOR_SECTION_OF`, `screenIdFor(pathname)`; `components/app/jumps.ts` — `Jump`, `JumpGroup`, `JumpKind`, `JumpLocation`, `DOCTOR_JUMPS`, `ADMIN_JUMPS`, `DATA_JUMPS`, `jumpHref(href, loc)`, `isCurrentJump(href, loc)`; `<Arrival />`, `<StateJumper surface />`, `<SurfaceNav items />`, `<TopBar surface title nav end? />`, `<AppShell surface title nav? end?>`. The shell root carries `data-surface="doctor|admin"` (server), `data-arrived="true"` (after Arrival) and `data-jumper="true"` (while the jumper renders). `AppShell` must sit inside `DataModeProvider` (the jumper reads the mode); Task 13's layouts render `<AppShell surface="doctor" title="Doctor" end={<AvailabilityControl />}>` and `<AppShell surface="admin" title="Admin" end={<DataModeSwitch />}>`. Screens hand `data-reveal` to Arrival only on `PageHeader`'s h1 and a route's first `[data-stagger]` tile row (Decision 13).

- [ ] **Step 1: Write the shell tests first**

`tests/app-shell.test.tsx`:

```tsx
// @vitest-environment jsdom
import { test, expect, beforeEach, afterEach, describe, vi } from 'vitest';
import { StrictMode, act } from 'react';
import { render, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import '@testing-library/jest-dom/vitest';
vi.mock('next/navigation', () => import('./helpers/navigation-mock'));
import { resetNav } from './helpers/navigation-mock';
import { installDomStubs } from './helpers/dom-stubs';
import { DataModeProvider } from '@/lib/data-mode';
import { SESSION_SCREENS } from '@/lib/session';
import { ONBOARDING_STEPS } from '@/lib/onboarding';
import { GATE_RECORDS } from '@/lib/fixtures';
import { AppShell } from '@/components/app/AppShell';
import { Arrival } from '@/components/app/Arrival';
import {
  ADMIN_DASH_SCREENS, ADMIN_NAV, DOCTOR_DASH_SCREENS, DOCTOR_NAV, screenIdFor,
} from '@/components/app/nav';
import { ADMIN_JUMPS, DOCTOR_JUMPS, isCurrentJump, jumpHref } from '@/components/app/jumps';

const RIBBON = 'Prototype. Not a live service — no real patients, GPs, or data.';
const tick = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

type Surface = 'doctor' | 'admin';

// The shell around a page that carries one headline and one staggered tile row —
// the only two places a route may put data-reveal (Decision 13).
function shell(surface: Surface) {
  return (
    <DataModeProvider>
      <AppShell
        surface={surface}
        title={surface === 'doctor' ? 'Doctor' : 'Admin'}
        nav={surface === 'doctor' ? DOCTOR_NAV : ADMIN_NAV}
        end={<span data-testid="end">end slot</span>}
      >
        <h1 data-reveal>Heading</h1>
        <div data-stagger>{Array.from({ length: 7 }, (_, i) => <div key={i} data-reveal />)}</div>
      </AppShell>
    </DataModeProvider>
  );
}

function renderAt(
  pathname: string,
  { surface = 'doctor', query = '', strict = false, mobile = false }:
    { surface?: Surface; query?: string; strict?: boolean; mobile?: boolean } = {},
) {
  installDomStubs({ mobile });
  resetNav(pathname);
  window.history.replaceState(null, '', query ? `${pathname}?${query}` : pathname);
  const ui = shell(surface);
  return render(strict ? <StrictMode>{ui}</StrictMode> : ui);
}

const sidebar = () => document.querySelector<HTMLElement>('[data-slot="sidebar"]')!;
const jumperNav = () => document.querySelector<HTMLElement>('nav[aria-label="Prototype navigation"]');

beforeEach(() => { cleanup(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('nav.ts', () => {
  test('screenIdFor maps every route to the screen it stands for', () => {
    expect(screenIdFor('/doctor')).toBe('dashboard');
    expect(screenIdFor('/doctor/')).toBe('dashboard');
    expect(screenIdFor('/doctor/earnings')).toBe('earnings');
    expect(screenIdFor('/doctor/profile')).toBe('profile');
    expect(screenIdFor('/doctor/session')).toBe('offline');
    expect(screenIdFor('/doctor/session/offer-timed-out')).toBe('offer-timed-out');
    expect(screenIdFor('/doctor/onboarding')).toBe('register');
    expect(screenIdFor('/doctor/onboarding/skills')).toBe('skills');
    expect(screenIdFor('/admin')).toBe('floor');
    expect(screenIdFor('/admin/governance')).toBe('governance');
  });

  test('the nav items and dashboard screens are the preview top nav, with the flows removed', () => {
    expect(DOCTOR_NAV.map((i) => [i.href, i.label, i.screen])).toEqual([
      ['/doctor', 'Dashboard', 'dashboard'], ['/doctor/earnings', 'Earnings', 'earnings'], ['/doctor/profile', 'Profile', 'profile'],
    ]);
    expect(ADMIN_NAV.map((i) => [i.href, i.label, i.screen])).toEqual([
      ['/admin', 'Live floor', 'floor'], ['/admin/governance', 'Governance', 'governance'],
      ['/admin/supply', 'GP supply', 'supply'], ['/admin/business', 'Business', 'business'],
    ]);
    expect(DOCTOR_DASH_SCREENS).toEqual(['dashboard', 'earnings', 'profile']);
    expect(ADMIN_DASH_SCREENS).toEqual(['floor', 'governance', 'supply', 'business']);
  });
});

describe('jumps.ts', () => {
  const DOCTOR_ROUTES = new Set([
    '/doctor', '/doctor/earnings', '/doctor/profile',
    ...SESSION_SCREENS.map((s) => `/doctor/session/${s}`),
    ...ONBOARDING_STEPS.map((s) => `/doctor/onboarding/${s}`),
  ]);
  const GATES = new Set(Object.keys(GATE_RECORDS));

  test('every doctor jump is a known route, and every gate jump names a gate record', () => {
    for (const group of DOCTOR_JUMPS) for (const { href } of group.items) {
      const [path, query = ''] = href.split('?');
      if (path === '') { expect(group.label).toBe('Data'); continue; }
      expect(DOCTOR_ROUTES.has(path), href).toBe(true);
      const gate = new URLSearchParams(query).get('gate');
      if (gate !== null) expect(GATES.has(gate), href).toBe(true);
    }
    expect(ADMIN_JUMPS.flatMap((g) => g.items.map((i) => i.href))).toEqual([
      '/admin', '/admin/governance', '/admin/supply', '/admin/business', '?data=', '?data=seeded',
    ]);
  });

  test("the groups and labels are the preview rail's, plus Data", () => {
    expect(DOCTOR_JUMPS.map((g) => g.label)).toEqual(['Dashboard', 'Onboarding', 'Shift', 'States', 'Data']);
    expect(DOCTOR_JUMPS[1].items.map((i) => i.label)).toEqual(['Register', 'Identity', 'Credentials', 'Indemnity', 'Skills', 'Done']);
    expect(DOCTOR_JUMPS[1].items.at(-1)).toEqual({ href: '/doctor/onboarding/done', label: 'Done', kind: 'screen' });
    expect(DOCTOR_JUMPS[2].items.map((i) => i.label)).toEqual(['Offline', 'Online', 'Offer', 'Consult', 'Complete']);
    expect(DOCTOR_JUMPS[3].items.map((i) => i.label)).toEqual([
      'Pending', 'Rejected', 'Indemnity expired', 'Offer — consent refused', 'Declined', 'Timed out', 'No-show', 'Revalidation', 'Nobody waiting',
    ]);
    expect(DOCTOR_JUMPS[3].items.every((i) => i.kind === 'state')).toBe(true);
    expect(ADMIN_JUMPS.map((g) => g.label)).toEqual(['Sections', 'Data']);
  });

  test('jumpHref carries the current query, lets the jump win, and strips on an empty value', () => {
    const loc = { pathname: '/doctor/earnings', search: '?data=seeded&jumper=1' };
    expect(jumpHref('/doctor/session/offer', loc)).toBe('/doctor/session/offer?data=seeded&jumper=1');
    expect(jumpHref('/doctor?gate=indemnity-expired', loc)).toBe('/doctor?data=seeded&jumper=1&gate=indemnity-expired');
    expect(jumpHref('?data=', loc)).toBe('/doctor/earnings?jumper=1');
    expect(jumpHref('?data=seeded', { pathname: '/admin', search: '' })).toBe('/admin?data=seeded');
    expect(jumpHref('/doctor?gate=revalidation-due', { pathname: '/doctor', search: '?gate=indemnity-expired' })).toBe('/doctor?gate=revalidation-due');
    expect(jumpHref('/doctor', { pathname: '/doctor', search: '' })).toBe('/doctor');
  });

  test('isCurrentJump: a gate is not the dashboard, and the data items read the mode', () => {
    const gated = { pathname: '/doctor', search: '?gate=indemnity-expired&data=seeded' };
    expect(isCurrentJump('/doctor?gate=indemnity-expired', gated)).toBe(true);
    expect(isCurrentJump('/doctor', gated)).toBe(false);
    expect(isCurrentJump('/doctor/earnings', gated)).toBe(false);
    expect(isCurrentJump('/doctor', { pathname: '/doctor', search: '?data=seeded' })).toBe(true);
    expect(isCurrentJump('?data=seeded', gated)).toBe(true);
    expect(isCurrentJump('?data=', gated)).toBe(false);
    expect(isCurrentJump('?data=', { pathname: '/admin/supply', search: '' })).toBe(true);
  });
});

describe('AppShell', () => {
  test('the ribbon is the first element of the shell, a note, with the sentence', () => {
    const { container } = renderAt('/doctor');
    const root = container.querySelector<HTMLElement>('[data-surface="doctor"]')!;
    const first = root.firstElementChild!;
    expect(first).toHaveAttribute('role', 'note');
    expect(first).toHaveAttribute('data-slot', 'ribbon');
    expect(first).toHaveTextContent(RIBBON);
    expect(root.querySelectorAll('[data-slot="ribbon"]')).toHaveLength(1);
    expect(root.className).toContain('[--ribbon-h:2.25rem]');
    expect(root.className).toContain('max-phone:[--ribbon-h:2.75rem]');
    expect(root.style.getPropertyValue('--shell-h')).toBe('calc(100svh - var(--ribbon-h))');
    expect(root.style.getPropertyValue('--jumper-h')).toBe('2.75rem');
  });

  test('the top bar carries the trigger, the wordmark home, the title, the end slot and the fixture ref', () => {
    renderAt('/doctor');
    const bar = document.querySelector<HTMLElement>('[data-slot="top-bar"]')!;
    expect(bar.querySelector('[data-slot="sidebar-trigger"]')).toBeInTheDocument();
    for (const a of screen.getAllByRole('link', { name: 'DrQuick' })) expect(a).toHaveAttribute('href', '/');
    expect(bar).toHaveTextContent('Doctor');
    expect(within(bar).getByTestId('end')).toHaveTextContent('end slot');
    expect(bar.querySelector('[data-slot="avatar-fallback"]')).toHaveTextContent('GP');
    expect(bar).toHaveTextContent('GP-002');
  });

  test('the admin surface reads Admin / AD, its own nav, and lights the floor', () => {
    renderAt('/admin', { surface: 'admin' });
    const bar = document.querySelector<HTMLElement>('[data-slot="top-bar"]')!;
    expect(bar).toHaveTextContent('Admin');
    expect(bar.querySelector('[data-slot="avatar-fallback"]')).toHaveTextContent('AD');
    expect(within(sidebar()).getByRole('link', { name: 'Live floor' })).toHaveAttribute('aria-current', 'page');
    expect(within(sidebar()).getByRole('link', { name: 'Business' })).not.toHaveAttribute('aria-current');
  });

  test('the rail lights the item the pathname stands for, and the dashboard during the availability screens', () => {
    renderAt('/doctor/earnings');
    expect(within(sidebar()).getByRole('link', { name: 'Earnings' })).toHaveAttribute('aria-current', 'page');
    expect(within(sidebar()).getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
    cleanup();
    renderAt('/doctor/session/online-idle');
    expect(within(sidebar()).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
  });

  test('the rail collapses on every session and onboarding route and is expanded on the dashboards', () => {
    const cases = [
      ['/doctor/session/offer', 'collapsed'], ['/doctor/onboarding/skills', 'collapsed'],
      ['/doctor/session', 'collapsed'], ['/doctor', 'expanded'], ['/doctor/earnings', 'expanded'],
    ] as const;
    for (const [path, state] of cases) {
      renderAt(path);
      expect(sidebar(), path).toHaveAttribute('data-state', state);
      cleanup();
    }
    renderAt('/admin/supply', { surface: 'admin' });
    expect(sidebar()).toHaveAttribute('data-state', 'expanded');
  });

  test('nav defaults from the surface when the layout omits it', () => {
    installDomStubs();
    resetNav('/admin');
    window.history.replaceState(null, '', '/admin');
    render(<DataModeProvider><AppShell surface="admin" title="Admin"><p>page</p></AppShell></DataModeProvider>);
    expect([...sidebar().querySelectorAll('a')].map((a) => a.textContent)).toEqual([
      'DrQuick', 'Live floor', 'Governance', 'GP supply', 'Business',
    ]);
  });

  test('without JavaScript the top bar carries a plain list of the sections, hidden from md up, and no jumper', () => {
    vi.stubEnv('NODE_ENV', 'production');
    installDomStubs();
    resetNav('/doctor');
    const html = renderToStaticMarkup(shell('doctor'));
    expect(html).toContain('role="note"');
    expect(html.indexOf('data-slot="ribbon"')).toBeLessThan(html.indexOf('data-slot="top-bar"'));
    expect(html).toContain('<noscript><nav aria-label="Sections" class="md:hidden">');
    for (const item of DOCTOR_NAV) expect(html).toContain(`<a href="${item.href}">${item.label}</a>`);
    expect(html).not.toContain('Prototype navigation');
    expect(html).not.toContain('data-arrived');
  });
});

describe('Arrival', () => {
  test('stamps the capped stagger on [data-stagger] children only, then releases everything and marks the shell', () => {
    const { container } = renderAt('/doctor');
    const tiles = [...container.querySelectorAll<HTMLElement>('[data-stagger] [data-reveal]')];
    expect(tiles.map((el) => el.style.getPropertyValue('--d'))).toEqual(['0ms', '70ms', '140ms', '210ms', '280ms', '300ms', '300ms']);
    const h1 = container.querySelector<HTMLElement>('h1[data-reveal]')!;
    expect(h1.style.getPropertyValue('--d')).toBe('');
    const root = container.querySelector<HTMLElement>('[data-surface]')!;
    expect(root.dataset.arrived).toBeUndefined();
    expect(h1.classList.contains('in')).toBe(false);
    tick(80);
    expect(h1.classList.contains('in')).toBe(true);
    expect(tiles.every((el) => el.classList.contains('in'))).toBe(true);
    expect(root.dataset.arrived).toBe('true');
  });

  test('a dev double-mount (StrictMode) still arrives', () => {
    const { container } = renderAt('/doctor', { strict: true });
    tick(80);
    expect(container.querySelector('h1')!.classList.contains('in')).toBe(true);
    expect(container.querySelector<HTMLElement>('[data-surface]')!.dataset.arrived).toBe('true');
  });

  test('with no [data-surface] shell it touches nothing', () => {
    installDomStubs();
    render(<><h1 data-reveal /><Arrival /></>);
    tick(80);
    expect(document.querySelector('h1')!.classList.contains('in')).toBe(false);
  });

  test('the still rule for later mounts is authored once, after the first-paint rule', () => {
    const css = readFileSync(join(__dirname, '../app/globals.css'), 'utf8');
    const first = css.indexOf('.js [data-reveal].in { opacity: 1; transform: none; }');
    const still = css.indexOf('.js [data-arrived] [data-reveal]:not(.in) { opacity: 1; transform: none; transition: none; }');
    expect(first).toBeGreaterThan(-1);
    expect(still).toBeGreaterThan(first);
    expect(css.split('[data-arrived]').length).toBe(2);
  });
});

describe('StateJumper', () => {
  test('is hidden in production without ?jumper=1, and shown with it', () => {
    vi.stubEnv('NODE_ENV', 'production');
    renderAt('/doctor');
    tick(80);
    expect(jumperNav()).toBeNull();
    expect(document.querySelector('[data-surface]')).not.toHaveAttribute('data-jumper');
    cleanup();
    renderAt('/doctor', { query: 'jumper=1' });
    tick(80);
    expect(jumperNav()).toBeInTheDocument();
    expect(document.querySelector('[data-surface]')).toHaveAttribute('data-jumper', 'true');
    expect(jumperNav()!.querySelector('a')).toHaveAttribute('href', '/doctor?jumper=1');
  });

  test('renders in development, last in the DOM, as plain full-load links that carry the query', () => {
    renderAt('/doctor', { query: 'data=seeded' });
    tick(80);
    const nav = jumperNav()!;
    const all = document.body.querySelectorAll('*');
    expect(nav.contains(all[all.length - 1])).toBe(true);
    expect(nav.className).toContain('font-mono');
    expect([...nav.querySelectorAll('span')].map((s) => s.textContent)).toEqual(['Dashboard', 'Onboarding', 'Shift', 'States', 'Data']);
    const links = [...nav.querySelectorAll('a')];
    const item = (label: string) => links.find((a) => a.textContent === label)!;
    expect(links).toHaveLength(DOCTOR_JUMPS.reduce((n, g) => n + g.items.length, 0));
    expect(links.every((a) => a.getAttribute('href'))).toBe(true);
    expect(item('Dashboard')).toHaveAttribute('href', '/doctor?data=seeded');
    expect(item('Dashboard')).toHaveAttribute('aria-current', 'page');
    expect(item('Earnings')).toHaveAttribute('href', '/doctor/earnings?data=seeded');
    expect(item('Earnings')).not.toHaveAttribute('aria-current');
    expect(item('Offer')).toHaveAttribute('href', '/doctor/session/offer?data=seeded');
    expect(item('Offer')).toHaveAttribute('data-kind', 'screen');
    expect(item('Indemnity expired')).toHaveAttribute('href', '/doctor?data=seeded&gate=indemnity-expired');
    expect(item('Indemnity expired')).toHaveAttribute('data-kind', 'state');
    expect(item('Seeded')).toHaveAttribute('aria-current', 'page');
    expect(item('Blank')).toHaveAttribute('href', '/doctor');
    expect(item('Blank')).not.toHaveAttribute('aria-current');
  });

  test('under a gate the gate item is current and the dashboard item is not', () => {
    renderAt('/doctor', { query: 'gate=revalidation-due' });
    tick(80);
    const links = [...jumperNav()!.querySelectorAll('a')];
    const item = (label: string) => links.find((a) => a.textContent === label)!;
    expect(item('Revalidation')).toHaveAttribute('aria-current', 'page');
    expect(item('Dashboard')).not.toHaveAttribute('aria-current');
    expect(item('Earnings')).toHaveAttribute('href', '/doctor/earnings?gate=revalidation-due');
    expect(item('Blank')).toHaveAttribute('aria-current', 'page');
  });

  test('the admin jumper lists the four sections and the data pair', () => {
    renderAt('/admin/governance', { surface: 'admin' });
    tick(80);
    const links = [...jumperNav()!.querySelectorAll('a')];
    expect(links.map((a) => a.textContent)).toEqual(['Live floor', 'Governance', 'GP supply', 'Business', 'Blank', 'Seeded']);
    expect(links[1]).toHaveAttribute('aria-current', 'page');
    expect(links[4]).toHaveAttribute('aria-current', 'page');
  });
});

describe('phone', () => {
  test('below 900 the rail is a Sheet with a visible close control', () => {
    renderAt('/doctor', { mobile: true });
    expect(document.querySelector('[data-slot="sidebar"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle Sidebar' }));
    const sheet = document.querySelector<HTMLElement>('[data-slot="sidebar"][data-mobile="true"]')!;
    expect(sheet).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Close navigation' })).toBeInTheDocument();
    expect(within(sheet).getByRole('link', { name: 'Earnings' })).toHaveAttribute('href', '/doctor/earnings');
  });
});
```

Run: `npx vitest run tests/app-shell.test.tsx` → fails at import: `Cannot find module '@/components/app/AppShell'`.

- [ ] **Step 2: The one CSS rule (Decision 13)**

In `app/globals.css`, replace:

```css
  .js [data-reveal].in { opacity: 1; transform: none; }
```

with:

```css
  .js [data-reveal].in { opacity: 1; transform: none; }
  /* Once a surface has arrived (components/app/Arrival.tsx), anything mounted later
     renders visible and still. `:not(.in)` leaves the first-paint transition of what
     already has .in untouched. */
  .js [data-arrived] [data-reveal]:not(.in) { opacity: 1; transform: none; transition: none; }
```

Nothing else in the file changes; the `prefers-reduced-motion` block below it already forces the end state.

- [ ] **Step 3: `components/app/nav.ts`**

Labels are `preview/doctor.html:22-24` and `preview/admin.html:21-24` verbatim.

```ts
/* The product nav of each surface, and the screen a pathname stands for. The
   preview's router knew screens by hash; here the pathname is the screen, and
   the rail, the top bar and the collapse decision all read this one map. */
import {
  ActivityIcon, BanknoteIcon, ChartColumnIcon, LayoutDashboardIcon, ShieldCheckIcon, UserIcon, UsersIcon,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = { href: string; label: string; icon: LucideIcon; screen: string };

export const DOCTOR_NAV: NavItem[] = [
  { href: '/doctor', label: 'Dashboard', icon: LayoutDashboardIcon, screen: 'dashboard' },
  { href: '/doctor/earnings', label: 'Earnings', icon: BanknoteIcon, screen: 'earnings' },
  { href: '/doctor/profile', label: 'Profile', icon: UserIcon, screen: 'profile' },
];

export const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'Live floor', icon: ActivityIcon, screen: 'floor' },
  { href: '/admin/governance', label: 'Governance', icon: ShieldCheckIcon, screen: 'governance' },
  { href: '/admin/supply', label: 'GP supply', icon: UsersIcon, screen: 'supply' },
  { href: '/admin/business', label: 'Business', icon: ChartColumnIcon, screen: 'business' },
];

// Decision 15: every session and onboarding route is a flow, so the rail collapses there.
export const DOCTOR_DASH_SCREENS: readonly string[] = ['dashboard', 'earnings', 'profile'];
export const ADMIN_DASH_SCREENS: readonly string[] = ['floor', 'governance', 'supply', 'business'];

// The availability screens belong to the dashboard, so its item stays lit in the
// collapsed rail and its tooltip.
export const DOCTOR_SECTION_OF: Record<string, string> = {
  offline: 'dashboard', 'online-idle': 'dashboard', 'no-patients-waiting': 'dashboard',
};

export function screenIdFor(pathname: string): string {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/doctor') return 'dashboard';
  if (path === '/admin') return 'floor';
  if (path === '/doctor/session') return 'offline';
  if (path === '/doctor/onboarding') return 'register';
  return path.slice(path.lastIndexOf('/') + 1);
}
```

- [ ] **Step 4: `components/app/jumps.ts`**

Groups and labels are `preview/js/doctor.js:41-73` and `preview/admin.html:210-217` verbatim; the gate ids move to `/doctor?gate=` (Decision 1) and `onboarding-done` survives only as the label "Done" (Decision 15). The `Data` group is the contract's addition.

```ts
/* The prototype rail, as data. preview/js/doctor.js:41-73 and admin.html:210-217
   listed every screen and state by id; here each is the URL it lives at, and a
   gate is the record the dashboard renders from (Decision 1). The jumper is a
   development tool: every jump is a full page load. */
export type JumpKind = 'screen' | 'state';
export type Jump = { href: string; label: string; kind: JumpKind };
export type JumpGroup = { label: string; items: Jump[] };
export type JumpLocation = { pathname: string; search: string };

const session = (state: string) => `/doctor/session/${state}`;
const step = (id: string) => `/doctor/onboarding/${id}`;
const gate = (id: string) => `/doctor?gate=${id}`;

// A query-only href keeps the current path; an empty value strips the key.
export const DATA_JUMPS: JumpGroup = {
  label: 'Data',
  items: [
    { href: '?data=', label: 'Blank', kind: 'screen' },
    { href: '?data=seeded', label: 'Seeded', kind: 'screen' },
  ],
};

export const DOCTOR_JUMPS: JumpGroup[] = [
  { label: 'Dashboard', items: [
    { href: '/doctor', label: 'Dashboard', kind: 'screen' },
    { href: '/doctor/earnings', label: 'Earnings', kind: 'screen' },
    { href: '/doctor/profile', label: 'Profile', kind: 'screen' },
  ] },
  { label: 'Onboarding', items: [
    { href: step('register'), label: 'Register', kind: 'screen' },
    { href: step('identity'), label: 'Identity', kind: 'screen' },
    { href: step('credentials'), label: 'Credentials', kind: 'screen' },
    { href: step('indemnity'), label: 'Indemnity', kind: 'screen' },
    { href: step('skills'), label: 'Skills', kind: 'screen' },
    { href: step('done'), label: 'Done', kind: 'screen' },
  ] },
  { label: 'Shift', items: [
    { href: session('offline'), label: 'Offline', kind: 'screen' },
    { href: session('online-idle'), label: 'Online', kind: 'screen' },
    { href: session('offer'), label: 'Offer', kind: 'screen' },
    { href: session('consultation'), label: 'Consult', kind: 'screen' },
    { href: session('complete'), label: 'Complete', kind: 'screen' },
  ] },
  { label: 'States', items: [
    { href: gate('verification-pending'), label: 'Pending', kind: 'state' },
    { href: gate('verification-rejected'), label: 'Rejected', kind: 'state' },
    { href: gate('indemnity-expired'), label: 'Indemnity expired', kind: 'state' },
    { href: session('offer-consent-refused'), label: 'Offer — consent refused', kind: 'state' },
    { href: session('offer-declined'), label: 'Declined', kind: 'state' },
    { href: session('offer-timed-out'), label: 'Timed out', kind: 'state' },
    { href: session('patient-no-show'), label: 'No-show', kind: 'state' },
    { href: gate('revalidation-due'), label: 'Revalidation', kind: 'state' },
    { href: session('no-patients-waiting'), label: 'Nobody waiting', kind: 'state' },
  ] },
  DATA_JUMPS,
];

export const ADMIN_JUMPS: JumpGroup[] = [
  { label: 'Sections', items: [
    { href: '/admin', label: 'Live floor', kind: 'screen' },
    { href: '/admin/governance', label: 'Governance', kind: 'screen' },
    { href: '/admin/supply', label: 'GP supply', kind: 'screen' },
    { href: '/admin/business', label: 'Business', kind: 'screen' },
  ] },
  DATA_JUMPS,
];

const split = (href: string): [path: string, query: string] => {
  const i = href.indexOf('?');
  return i === -1 ? [href, ''] : [href.slice(0, i), href.slice(i + 1)];
};

/* The href a jump really loads: the current query is carried (Decision 2 — a
   copied link keeps its mode and gate), the jump's own keys win, an empty value strips. */
export function jumpHref(href: string, loc: JumpLocation): string {
  const [path, query] = split(href);
  const params = new URLSearchParams(loc.search);
  for (const [key, value] of new URLSearchParams(query)) {
    if (value === '') params.delete(key); else params.set(key, value);
  }
  const qs = params.toString();
  return `${path || loc.pathname}${qs ? `?${qs}` : ''}`;
}

// `gate` chooses what /doctor shows, so the Dashboard jump is not current under a gate.
const SCREEN_KEYS = ['gate'];

export function isCurrentJump(href: string, loc: JumpLocation): boolean {
  const [path, query] = split(href);
  if (path && path !== loc.pathname) return false;
  const want = new URLSearchParams(query);
  const have = new URLSearchParams(loc.search);
  for (const [key, value] of want) if ((have.get(key) ?? '') !== value) return false;
  return !path || SCREEN_KEYS.every((key) => want.has(key) === have.has(key));
}
```

- [ ] **Step 5: `components/app/Arrival.tsx`**

```tsx
'use client';
/* The arrival grammar for the signed-in surfaces. `.js [data-reveal]` is hidden
   globally and only LandingBehavior, mounted on / alone, ever adds `.in`, so
   without this a dashboard's headline would stay invisible for good. It stamps
   the capped stagger on the tiles of each [data-stagger] group (the landing
   convention — never every data-reveal on the page), releases everything present
   after one painted frame, and marks the shell arrived in the same tick, so
   whatever mounts later — a session screen, a tab, the seeded flip — renders
   visible and still under the one rule in app/globals.css (Decision 13). */
import { useEffect } from 'react';
import { staggerDelay } from '@/lib/reveal';

export function Arrival() {
  useEffect(() => {
    const shell = document.querySelector<HTMLElement>('[data-surface]');
    if (!shell) return;
    shell.querySelectorAll<HTMLElement>('[data-stagger]').forEach((group) =>
      group.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el, i) =>
        el.style.setProperty('--d', `${staggerDelay(i)}ms`)));
    // A timer rather than nested rAF so the release cannot stall in a throttled tab.
    const id = window.setTimeout(() => {
      shell.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('in'));
      shell.dataset.arrived = 'true';
    }, 60);
    // StrictMode runs mount → cleanup → mount: clear both so the second run re-arms.
    return () => { window.clearTimeout(id); delete shell.dataset.arrived; };
  }, []);
  return null;
}
```

- [ ] **Step 6: `components/app/StateJumper.tsx`**

```tsx
'use client';
/* The prototype rail's replacement: a development tool, deliberately not the
   product — band-filled, monospace, pinned to the bottom, last in the DOM. Every
   item is a full page load, which is also how a gate or a data mode is chosen. */
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useDataMode, usePersistedQuery } from '@/lib/data-mode';
import { ADMIN_JUMPS, DOCTOR_JUMPS, isCurrentJump, jumpHref, type JumpLocation } from './jumps';

export function StateJumper({ surface }: { surface: 'doctor' | 'admin' }) {
  const pathname = usePathname();
  const { mode } = useDataMode();
  const [jumper] = usePersistedQuery('jumper');
  const show = process.env.NODE_ENV !== 'production' || jumper === '1';
  const ref = useRef<HTMLElement>(null);

  // The URL is read after the commit's effects, not during them: the providers
  // re-stamp their query keys in their own effects, which run after this
  // descendant's, so a same-tick read would miss ?data=seeded after a navigation.
  // Null on the server and the first client render, so the HTML never differs.
  const [loc, setLoc] = useState<JumpLocation | null>(null);
  useEffect(() => {
    if (!show) return;
    const id = window.setTimeout(
      () => setLoc({ pathname: window.location.pathname, search: window.location.search }), 0);
    return () => window.clearTimeout(id);
  }, [show, pathname, mode, jumper]);

  // The shell pads its bottom edge by --jumper-h while the jumper is there, so
  // Accept and Decline never sit under it at 390.
  useEffect(() => {
    const shell = ref.current?.closest<HTMLElement>('[data-surface]');
    if (!shell) return;
    shell.dataset.jumper = 'true';
    return () => { delete shell.dataset.jumper; };
  }, [show]);

  if (!show) return null;
  const groups = surface === 'doctor' ? DOCTOR_JUMPS : ADMIN_JUMPS;
  return (
    <nav
      ref={ref}
      aria-label="Prototype navigation"
      data-slot="state-jumper"
      className="fixed inset-x-0 bottom-0 z-30 flex h-11 items-center gap-2 overflow-x-auto border-t border-white/20 bg-band px-3 font-mono text-[11px] text-white"
    >
      {groups.map((group) => (
        <div key={group.label} className="flex shrink-0 items-center gap-2">
          <span className="uppercase tracking-[.06em] text-band-ink-2">{group.label}</span>
          {group.items.map((item) => {
            const current = loc !== null && isCurrentJump(item.href, loc);
            return (
              <a
                key={item.href}
                href={loc ? jumpHref(item.href, loc) : item.href}
                data-kind={item.kind}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'rounded-md border border-white/20 px-2 py-1 whitespace-nowrap no-underline hover:bg-white/15',
                  item.kind === 'state' && 'border-dashed',
                  current && 'bg-white text-ink hover:bg-white',
                )}
              >
                {item.label}
              </a>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
```

- [ ] **Step 7: `components/app/SurfaceNav.tsx`**

```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from '@/components/ui/sidebar';
import { activeNav } from '@/lib/shell';
import { DOCTOR_SECTION_OF, screenIdFor, type NavItem } from './nav';

// The product nav in the rail. Which item is lit comes from the pathname through
// the two functions the preview's shell used; the tooltip is the label the
// icon-only rail cannot show.
export function SurfaceNav({ items }: { items: NavItem[] }) {
  const current = activeNav(screenIdFor(usePathname()), DOCTOR_SECTION_OF);
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <nav aria-label="Sections">
          <SidebarMenu>
            {items.map(({ href, label, icon: Icon, screen }) => {
              const active = screen === current;
              return (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton asChild isActive={active} tooltip={label}>
                    <Link href={href} aria-current={active ? 'page' : undefined} className="no-underline">
                      <Icon strokeWidth={2} />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </nav>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
```

- [ ] **Step 8: `components/app/TopBar.tsx`**

No `'use client'`: it has no hook or handler of its own (`SidebarTrigger` carries its own boundary). The wordmark is `components/Nav.tsx:14-16`'s markup; the account block is the preview's `[data-gp="ref"]` / `[data-gp="initials"]` (`doctor.js:103-104`) read from the fixture, and the contract's `AD` / `Admin` for the admin surface.

```tsx
import Link from 'next/link';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { DOCTOR, DOCTOR_DASHBOARD } from '@/lib/fixtures';
import type { NavItem } from './nav';

type Props = { surface: 'doctor' | 'admin'; title: string; nav: NavItem[]; end?: React.ReactNode };

// The product's top bar: the trigger, the wordmark home, the surface's name, the
// one control the surface owns (availability or the data mode), and who is signed
// in — a fixture ref, never a name.
export function TopBar({ surface, title, nav, end }: Props) {
  const who = surface === 'doctor'
    ? { initials: DOCTOR_DASHBOARD.initials, name: DOCTOR.ref }
    : { initials: 'AD', name: 'Admin' };
  return (
    <header
      data-slot="top-bar"
      className="sticky top-(--ribbon-h) z-10 flex h-16 items-center gap-4 border-b border-rule bg-white px-6 max-phone:px-4"
    >
      <SidebarTrigger />
      <Link href="/" className="font-display text-xl font-bold tracking-[-.04em] whitespace-nowrap no-underline">
        Dr<span className="text-primary">Quick</span>
      </Link>
      <span className="text-fine text-ink-2">{title}</span>
      {/* useIsMobile() is false on the server: below 900 the desktop rail is `hidden`
          and the Sheet never mounts without JavaScript, so scripts-off at 390 needs
          real links. md:hidden keeps it from doubling the server-rendered rail at 1440. */}
      <noscript>
        <nav aria-label="Sections" className="md:hidden">
          <ul className="flex flex-wrap gap-3 text-fine">
            {nav.map((item) => <li key={item.href}><a href={item.href}>{item.label}</a></li>)}
          </ul>
        </nav>
      </noscript>
      <div className="ml-auto flex items-center gap-3">
        {end}
        <Avatar size="sm"><AvatarFallback>{who.initials}</AvatarFallback></Avatar>
        <span className="text-fine font-semibold max-phone:sr-only">{who.name}</span>
      </div>
    </header>
  );
}
```

- [ ] **Step 9: `components/app/AppShell.tsx`**

```tsx
'use client';
/* One shell for both surfaces: the prototype ribbon first and full width, then
   the shadcn rail and the page. Every session and onboarding route is a flow, so
   the rail collapses to icons there (Decision 15); the collapse is computed from
   the pathname on server and client alike, never from a cookie, so the surface
   stays static and the first paint is already right. */
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SheetClose } from '@/components/ui/sheet';
import {
  Sidebar, SidebarContent, SidebarHeader, SidebarInset, SidebarProvider, SidebarRail, useSidebar,
} from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { areaOf } from '@/lib/shell';
import { Arrival } from './Arrival';
import { Ribbon } from './Ribbon';
import { StateJumper } from './StateJumper';
import { SurfaceNav } from './SurfaceNav';
import { TopBar } from './TopBar';
import {
  ADMIN_DASH_SCREENS, ADMIN_NAV, DOCTOR_DASH_SCREENS, DOCTOR_NAV, screenIdFor, type NavItem,
} from './nav';

type Surface = 'doctor' | 'admin';
type Props = {
  surface: Surface;
  title: string;
  nav?: NavItem[];   // defaults by surface: an icon is a component, which a server layout cannot pass
  end?: React.ReactNode;
  children: React.ReactNode;
};

// --ribbon-h lives in the className (2.25rem, 2.75rem for the two-line ribbon below
// the phone line); these two are constant at every width.
const SHELL_VARS = {
  '--shell-h': 'calc(100svh - var(--ribbon-h))',
  '--jumper-h': '2.75rem',
} as React.CSSProperties;

function RailHeader() {
  const { isMobile } = useSidebar();
  return (
    <SidebarHeader className="flex-row items-center justify-between">
      <Link
        href="/"
        className="px-2 py-1 font-display text-xl font-bold tracking-[-.04em] whitespace-nowrap no-underline group-data-[collapsible=icon]:hidden"
      >
        Dr<span className="text-primary">Quick</span>
      </Link>
      {/* sidebar.tsx hides the Sheet's own close button; without this, Escape is the only way out. */}
      {isMobile && (
        <SheetClose asChild>
          <Button variant="ghost" size="icon-sm">
            <XIcon strokeWidth={2} />
            <span className="sr-only">Close navigation</span>
          </Button>
        </SheetClose>
      )}
    </SidebarHeader>
  );
}

export function AppShell({
  surface, title, nav = surface === 'doctor' ? DOCTOR_NAV : ADMIN_NAV, end, children,
}: Props) {
  const pathname = usePathname();
  const screen = screenIdFor(pathname);
  const flow = areaOf(screen, surface === 'doctor' ? DOCTOR_DASH_SCREENS : ADMIN_DASH_SCREENS) === 'flow';
  const [open, setOpen] = useState(true);   // same on server and client; never seeded from a cookie
  return (
    <div
      data-surface={surface}
      className="flex min-h-svh flex-col [--ribbon-h:2.25rem] max-phone:[--ribbon-h:2.75rem] data-[jumper=true]:pb-(--jumper-h)"
      style={SHELL_VARS}
    >
      {/* First element, full width, above the z-10 rail. Two lines at 390, one from 560;
          the fixed rail that consumes --ribbon-h only exists from md: (900). */}
      <Ribbon className="flex h-(--ribbon-h) items-center" />
      {/* sidebar.tsx mounts no TooltipProvider and Radix throws without one. */}
      <TooltipProvider>
        <SidebarProvider open={open && !flow} onOpenChange={setOpen} className="min-h-(--shell-h)">
          {/* style lands on the `fixed inset-y-0 h-svh` container; inline beats the utilities. */}
          <Sidebar collapsible="icon" style={{ top: 'var(--ribbon-h)', height: 'var(--shell-h)' }}>
            <RailHeader />
            <SidebarContent><SurfaceNav items={nav} /></SidebarContent>
            <SidebarRail />
          </Sidebar>
          {/* min-w-0: otherwise the flex child grows to its tables' intrinsic width at 390. */}
          <SidebarInset className="min-w-0">
            <TopBar surface={surface} title={title} nav={nav} end={end} />
            <div className="wrap w-full py-8 max-phone:py-6">{children}</div>
            <Arrival />
            <StateJumper surface={surface} />
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </div>
  );
}
```

Run: `npx vitest run tests/app-shell.test.tsx` → 22 passed (2 nav, 4 jumps, 7 AppShell, 4 Arrival, 4 StateJumper, 1 phone). `npm run typecheck` → green.

- [ ] **Step 10: Gallery — the prototype chrome in flow**

In `app/dev/ui/gallery.tsx`, add to the imports (skip `Ribbon` if Task 9 already imports it):

```tsx
import { DataModeProvider } from '@/lib/data-mode';
import { Ribbon } from '@/components/app/Ribbon';
import { StateJumper } from '@/components/app/StateJumper';
```

Append `'shell'` as the last entry of the header nav array (after whatever Tasks 8–11 appended after `'sidebar'`), and insert this section immediately before `<footer className="border-t border-rule py-10">`:

```tsx
      <Section id="shell" title="Ribbon and state jumper" note="The prototype chrome, deliberately not the product. The ribbon is a note in the label-caps face, sticky above the app shell on every dashboard route and never dismissable. The jumper is the rail's replacement: monospace, band-filled, pinned to the bottom, plain full-load links that carry the query, rendered in development or with ?jumper=1; a dashed border marks a state, a white fill the current one. Both are taken out of flow here so the page can be read.">
        <DataModeProvider>
          <div className="grid w-full gap-4">
            <Ribbon className="static rounded-md" />
            <div className="[&>nav]:static [&>nav]:rounded-md">
              <StateJumper surface="doctor" />
            </div>
            <div className="[&>nav]:static [&>nav]:rounded-md">
              <StateJumper surface="admin" />
            </div>
          </div>
        </DataModeProvider>
      </Section>
```

Open `/dev/ui#shell` on the dev server: the ribbon reads as one line on white, both jumpers show their groups, `Dashboard`/`Live floor` carry no current fill (the pathname is `/dev/ui`), and `Blank` is filled white.

- [ ] **Step 11: Record the contract amendments in the filed plan**

In `docs/superpowers/plans/2026-09-02-doctor-admin-surfaces.md`, three exact edits.

Replace:
```
<AppShell surface="doctor" | "admin" title="Doctor" | "Admin" nav={NavItem[]} end={ReactNode}>{children}</AppShell>
```
with:
```
<AppShell surface="doctor" | "admin" title="Doctor" | "Admin" nav?={NavItem[]} end={ReactNode}>{children}</AppShell>   // nav defaults to DOCTOR_NAV / ADMIN_NAV by surface — NavItem.icon is a component, which a server layout cannot pass as a prop (Task 12); the layouts omit it. --ribbon-h is set by class (2.25rem; 2.75rem below the phone line for the two-line ribbon); --shell-h and --jumper-h are inline
```

Replace:
```
          <TopBar title={title} nav={nav} end={end} />
```
with:
```
          <TopBar surface={surface} title={title} nav={nav} end={end} />   {/* surface picks the account block: GP / GP-002 or AD / Admin */}
```

Replace:
```
      <SidebarProvider open={open && !flow} onOpenChange={setOpen} className="min-h-(--shell-h)">
```
with:
```
      <TooltipProvider>{/* sidebar.tsx mounts none; Radix throws without one on the collapsed rail's tooltips */}
      <SidebarProvider open={open && !flow} onOpenChange={setOpen} className="min-h-(--shell-h)">
```
and, in the same block, replace:
```
      </SidebarProvider>
    </div>
```
with:
```
      </SidebarProvider>
      </TooltipProvider>
    </div>
```

- [ ] **Step 12: Run everything, then commit**

```bash
cd /Users/liam/development/DrQuick/website
npx vitest run tests/app-shell.test.tsx     # 22 passed
npm test                                    # green — constraints scans components/app: no hex, no dark:, border-white/20 and bg-white/15 are a token at an alpha
npm run typecheck                           # green
NEXT_PUBLIC_SITE_URL=http://localhost:3000 npm run build   # green; /dev/ui renders the new section; no route mounts the shell yet
grep -rnE 'dark:|oklch\(|hsl\(' components/app ; echo "exit $?"   # no lines, exit 1
grep -rinwE 'schedule|rota|calendar' components/app ; echo "exit $?"   # no lines, exit 1 (nav.ts carries no Calendar icon)
```

```bash
git add components/app/Arrival.tsx components/app/nav.ts components/app/jumps.ts components/app/StateJumper.tsx components/app/SurfaceNav.tsx components/app/TopBar.tsx components/app/AppShell.tsx app/globals.css app/dev/ui/gallery.tsx docs/superpowers/plans/2026-09-02-doctor-admin-surfaces.md tests/app-shell.test.tsx
git commit -m "feat(app): the app shell — sidebar, top bar, ribbon, arrival, state jumper

One AppShell for both surfaces: the ribbon first and full width, the shadcn
rail offset beneath it and collapsed to icons on every session and onboarding
route, a top bar with a no-JS section list, Arrival for the surface's first
paint (with the data-arrived rule so later mounts render still), and the
StateJumper as the rail's replacement — plain full-load links that carry the
query, rendered in development or with ?jumper=1.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Doctor and admin layouts with their providers and noindex metadata

> Notes where the brief and the contract part company (the contract wins): (1) `nav={DOCTOR_NAV}` cannot be passed from a server layout to the client `AppShell` — every `NavItem.icon` is a lucide component, and React Flight refuses functions as props — so each layout renders the shell through a two-line client wrapper (`DoctorShell` / `AdminShell`) that owns `nav` and `end`; the layouts stay server components so `metadata` is legal. (2) Those wrappers also mount the `TooltipProvider`: the restyled `components/ui/sidebar.tsx` `SidebarProvider` no longer wraps shadcn's, and Radix throws "`Tooltip` must be used within `TooltipProvider`" the moment `SurfaceNav` gives a `SidebarMenuButton` a `tooltip`. (3) The avatar is `TopBar`'s own (contract: `GP` / `GP-002`, admin `AD` / `Admin`); the layouts pass only `end`. (4) Task 4's navigation mock is `tests/helpers/navigation-mock.ts` (the plan's task-map name; the tests review called it `next-navigation.ts`). (5) The availability control's ids come from `useId()` rather than the literal `id="availability"`: the top bar and the dashboard tile both render it on `/doctor`. New strings, listed for the report: the labels "Availability" and "Seeded data", and the disabled reason "You can't go online — indemnity cover has expired." (composed from `preview/doctor.html:492-493`).

**Files:**
- Create: `components/doctor/DoctorProvider.tsx`, `components/doctor/SessionProvider.tsx`, `components/doctor/OnboardingProvider.tsx`, `components/doctor/DoctorProviders.tsx`, `components/doctor/AvailabilityControl.tsx`, `components/doctor/DoctorShell.tsx`, `components/admin/DataModeSwitch.tsx`, `components/admin/AdminShell.tsx`, `app/(app)/doctor/layout.tsx`, `app/(app)/doctor/page.tsx`, `app/(app)/doctor/earnings/page.tsx`, `app/(app)/doctor/profile/page.tsx`, `app/(app)/doctor/onboarding/[[...step]]/page.tsx`, `app/(app)/doctor/session/[[...state]]/page.tsx`, `app/(app)/admin/layout.tsx`, `app/(app)/admin/page.tsx`, `app/(app)/admin/governance/page.tsx`, `app/(app)/admin/supply/page.tsx`, `app/(app)/admin/business/page.tsx`
- Modify: `tests/headers.test.ts`
- Test: `tests/helpers/render-doctor.tsx`, `tests/helpers/render-admin.tsx`, `tests/providers.test.tsx`, `tests/headers.test.ts`, `tests/bundle.test.ts`
- Read: the contract's Providers section; routing review §1–4, §7–11; tests review §1, §7, §8; `components/ui/{switch,label,avatar,tooltip,sidebar}.tsx`; `lib/{session,onboarding,alerts,fixtures,data-mode}.ts(x)` (Tasks 3–7); `app/layout.tsx`; `app/dev/ui/page.tsx`; `next.config.ts`; `tests/headers.test.ts`; `tests/metadata.test.ts`; `preview/js/doctor.js:75-105`; `preview/doctor.html:14-60, 366-405, 488-498`; `preview/admin.html:14-40`

**Interfaces:**
- Consumes: `DataModeProvider`, `useDataMode`, `usePersistedQuery` from `@/lib/data-mode` (Task 4); `useLiveInterval` from `@/hooks/use-live-interval` (Task 5); `initialSession`, `sessionReducer`, `sessionScreenFromPath`, `sessionHref`, `OFFER_AFTER_MS`, `SESSION_SCREENS`, `SessionAction`, `SessionState` from `@/lib/session` (Task 6); `initialOnboarding`, `onboardingReducer`, `onboardingStepFromPath`, `onboardingHref`, `ONBOARDING_STEPS`, `OnboardingAction`, `OnboardingState` from `@/lib/onboarding` (Task 7); `GATE_RECORDS`, `MY_RECORD`, `CredentialRecord`, `GateId` from `@/lib/fixtures` and `credentialAlerts`, `gateFor`, `CredentialAlert` from `@/lib/alerts` (Task 3); `AppShell` (`surface`, `title`, `nav`, `end`), `DOCTOR_NAV`, `ADMIN_NAV` from `components/app/{AppShell,nav}` (Task 12); `PageHeader` (Task 9); `Switch`, `Label`, `TooltipProvider` from `components/ui`; the test helpers `tests/helpers/navigation-mock.ts` (`nav`, `resetNav`, `usePathname`, `useRouter`) and `tests/helpers/dom-stubs.ts` (`installDomStubs`, `DomStubOptions`) (Task 4). Markers relied on from Task 12: `[data-surface]` on the shell root, `[data-slot="ribbon"]` on the ribbon.
- Produces: `DoctorProvider` / `useDoctor(): { record, gate, blocked, alerts }`; `SessionProvider` / `useSession(): { state, act(action, opts?: { navigate?: boolean }), onSessionRoute, secondsOnline, consultSeconds }`; `OnboardingProvider` / `useOnboarding(): { state, act }`; `DoctorProviders` (`DataModeProvider > DoctorProvider > SessionProvider > OnboardingProvider`); `DoctorShell` and `AdminShell` (client; `TooltipProvider > AppShell` with the surface's `nav` and `end`); `AvailabilityControl({ navigate?: boolean; className?: string })` — `Label` "Availability" + `Switch` (`role="switch"`, `aria-checked`, `aria-describedby` → "You're offline" / "You're online" / the disabled reason); `DataModeSwitch()` — `Label` "Seeded data" + `Switch` bound to `useDataMode`; both layouts exporting `metadata` (`title`, `robots: { index: false, follow: false }`) and `dynamic = 'force-static'`; nine placeholder pages (the two catch-alls with `generateStaticParams` and `dynamicParams = false`); `renderDoctor(ui, { pathname, query?, shell?, ...DomStubOptions })` and `renderAdmin(ui, { pathname?, query?, shell?, ... })`, each returning `RenderResult & { setPath(next) }`. Tasks 14–25 replace the placeholder pages; Task 26 renders routes through these helpers; Task 28 reruns the bundle check in Step 11.

- [ ] **Step 1: The render helpers — the layout's exact tree, minus the layout**

`tests/helpers/render-doctor.tsx`:

```tsx
import { render, type RenderResult } from '@testing-library/react';
import type { ReactNode } from 'react';
import { nav, resetNav } from './navigation-mock';
import { installDomStubs, type DomStubOptions } from './dom-stubs';
import { DoctorProviders } from '@/components/doctor/DoctorProviders';
import { DoctorShell } from '@/components/doctor/DoctorShell';

export type RenderDoctorOptions = DomStubOptions & { pathname: string; query?: string; shell?: boolean };

// The doctor layout's tree — DoctorProviders, and DoctorShell when `shell` is on —
// around any element, at a pathname the mocked usePathname() returns and a
// window.location the providers read after mount.
export function renderDoctor(
  ui: ReactNode,
  { pathname, query, shell = false, ...stubs }: RenderDoctorOptions,
): RenderResult & { setPath: (next: string) => void } {
  installDomStubs(stubs);
  resetNav(pathname);
  window.history.replaceState(null, '', query ? `${pathname}?${query}` : pathname);
  const wrap = (node: ReactNode) => (
    <DoctorProviders>{shell ? <DoctorShell>{node}</DoctorShell> : node}</DoctorProviders>
  );
  const result = render(wrap(ui));
  return Object.assign(result, {
    // A client navigation: <Link> lands on the bare href (the query is dropped, as
    // Next does), the mocked pathname changes and the tree re-renders — which is
    // what the providers' `jump` and usePersistedQuery's re-stamp key on.
    setPath(next: string) {
      nav.pathname = next;
      window.history.replaceState(null, '', next);
      result.rerender(wrap(ui));
    },
  });
}

export { nav };
```

`tests/helpers/render-admin.tsx`:

```tsx
import { render, type RenderResult } from '@testing-library/react';
import type { ReactNode } from 'react';
import { nav, resetNav } from './navigation-mock';
import { installDomStubs, type DomStubOptions } from './dom-stubs';
import { DataModeProvider } from '@/lib/data-mode';
import { AdminShell } from '@/components/admin/AdminShell';

export type RenderAdminOptions = DomStubOptions & { pathname?: string; query?: string; shell?: boolean };

// The admin layout's tree: DataModeProvider alone, and AdminShell when `shell` is on.
export function renderAdmin(
  ui: ReactNode,
  { pathname = '/admin', query, shell = false, ...stubs }: RenderAdminOptions = {},
): RenderResult & { setPath: (next: string) => void } {
  installDomStubs(stubs);
  resetNav(pathname);
  window.history.replaceState(null, '', query ? `${pathname}?${query}` : pathname);
  const wrap = (node: ReactNode) => (
    <DataModeProvider>{shell ? <AdminShell>{node}</AdminShell> : node}</DataModeProvider>
  );
  const result = render(wrap(ui));
  return Object.assign(result, {
    setPath(next: string) {
      nav.pathname = next;
      window.history.replaceState(null, '', next);
      result.rerender(wrap(ui));
    },
  });
}

export { nav };
```

- [ ] **Step 2: The provider, header and bundle tests, written to fail**

`tests/providers.test.tsx`:

```tsx
// @vitest-environment jsdom
import { test, expect, beforeEach, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
vi.mock('next/navigation', () => import('./helpers/navigation-mock'));
import { renderDoctor, nav } from './helpers/render-doctor';
import { renderAdmin } from './helpers/render-admin';
import { installDomStubs } from './helpers/dom-stubs';
import { resetNav } from './helpers/navigation-mock';
import { useSession } from '@/components/doctor/SessionProvider';
import { useOnboarding } from '@/components/doctor/OnboardingProvider';
import { useDoctor } from '@/components/doctor/DoctorProvider';
import { AvailabilityControl } from '@/components/doctor/AvailabilityControl';
import { DataModeSwitch } from '@/components/admin/DataModeSwitch';
import DoctorLayout from '@/app/(app)/doctor/layout';
import AdminLayout from '@/app/(app)/admin/layout';
import { GATE_RECORDS, type GateId } from '@/lib/fixtures';

beforeEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

// Reads every provider through its hook and offers the reducer actions the tests
// need as plain buttons, so every assertion is on a rendered attribute.
function Probe() {
  const session = useSession();
  const onboarding = useOnboarding();
  const doctor = useDoctor();
  return (
    <>
      <span data-testid="session" data-screen={session.state.screen} data-nav={session.state.nav}
        data-online={String(session.state.online)} data-blocked={String(session.state.blocked)}
        data-started={String(session.state.consultationStartedAt)} />
      <span data-testid="onboarding" data-step={onboarding.state.step} data-nav={onboarding.state.nav}
        data-reached={onboarding.state.reached} />
      <span data-testid="doctor" data-gate={doctor.gate ?? 'none'} data-blocked={String(doctor.blocked)}
        data-alerts={doctor.alerts.length} data-indemnity={doctor.record.indemnity.status} />
      <button type="button" onClick={() => session.act({ type: 'goOnline', now: Date.now() })}>goOnline</button>
      <button type="button" onClick={() => session.act({ type: 'accept', now: Date.now() })}>accept</button>
      <button type="button" onClick={() => onboarding.act({ type: 'submitRegister' })}>submitRegister</button>
    </>
  );
}
const sessionProbe = () => screen.getByTestId('session');
const onboardingProbe = () => screen.getByTestId('onboarding');
const doctorProbe = () => screen.getByTestId('doctor');

test('the session seeds from the pathname and the bare path has no opinion', () => {
  const { setPath } = renderDoctor(<Probe />, { pathname: '/doctor/session/offer' });
  expect(sessionProbe()).toHaveAttribute('data-screen', 'offer');
  expect(sessionProbe()).toHaveAttribute('data-online', 'true');
  expect(sessionProbe()).toHaveAttribute('data-nav', '0');
  setPath('/doctor/session');
  expect(sessionProbe()).toHaveAttribute('data-screen', 'offer');
  expect(nav.router.replace).not.toHaveBeenCalled();
});

test('a GP action moves the URL once, keeping the query, and the URL landing does not re-jump', () => {
  const { setPath } = renderDoctor(<Probe />, { pathname: '/doctor/session/offer', query: 'data=seeded' });
  fireEvent.click(screen.getByRole('button', { name: 'accept' }));
  expect(sessionProbe()).toHaveAttribute('data-screen', 'consultation');
  expect(sessionProbe()).toHaveAttribute('data-nav', '1');
  const started = sessionProbe().getAttribute('data-started');
  expect(nav.router.replace).toHaveBeenCalledTimes(1);
  expect(nav.router.replace).toHaveBeenCalledWith('/doctor/session/consultation?data=seeded');
  setPath('/doctor/session/consultation');
  expect(sessionProbe()).toHaveAttribute('data-nav', '1');
  expect(sessionProbe()).toHaveAttribute('data-started', started!);   // no second jump reset the clock
  expect(nav.router.replace).toHaveBeenCalledTimes(1);
  expect(nav.router.push).not.toHaveBeenCalled();
  expect(window.location.search).toBe('?data=seeded');                // re-stamped after the navigation
});

test('the URL drives the state through jump without bumping nav', () => {
  const { setPath } = renderDoctor(<Probe />, { pathname: '/doctor/session/offline' });
  expect(sessionProbe()).toHaveAttribute('data-screen', 'offline');
  setPath('/doctor/session/consultation');
  expect(sessionProbe()).toHaveAttribute('data-screen', 'consultation');
  expect(sessionProbe()).toHaveAttribute('data-online', 'true');
  expect(sessionProbe()).toHaveAttribute('data-nav', '0');
  expect(nav.router.replace).not.toHaveBeenCalled();
});

test('the top bar switch echoes the session and changes it in place', () => {
  renderDoctor(<><Probe /><AvailabilityControl /></>, { pathname: '/doctor' });
  const sw = screen.getByRole('switch', { name: 'Availability' });
  expect(sw).toHaveAttribute('aria-checked', 'false');
  expect(sw).toHaveAccessibleDescription("You're offline");
  fireEvent.click(sw);
  expect(sw).toHaveAttribute('aria-checked', 'true');
  expect(sw).toHaveAccessibleDescription("You're online");
  expect(sessionProbe()).toHaveAttribute('data-screen', 'online-idle');
  expect(nav.router.push).not.toHaveBeenCalled();
  expect(nav.router.replace).not.toHaveBeenCalled();
  fireEvent.click(sw);
  expect(sw).toHaveAttribute('aria-checked', 'false');
  expect(sessionProbe()).toHaveAttribute('data-screen', 'offline');
});

test("the dashboard tile's switch also navigates to the session", () => {
  renderDoctor(<><Probe /><AvailabilityControl navigate /></>, { pathname: '/doctor' });
  fireEvent.click(screen.getByRole('switch'));
  expect(sessionProbe()).toHaveAttribute('data-screen', 'online-idle');
  expect(nav.router.push).toHaveBeenCalledTimes(1);
  expect(nav.router.push).toHaveBeenCalledWith('/doctor/session/online-idle');
  expect(nav.router.replace).not.toHaveBeenCalled();
});

test('going offline mid-consultation is refused and the switch stays on', () => {
  renderDoctor(<><Probe /><AvailabilityControl /></>, { pathname: '/doctor/session/consultation' });
  const sw = screen.getByRole('switch');
  expect(sw).toHaveAttribute('aria-checked', 'true');
  fireEvent.click(sw);
  expect(sw).toHaveAttribute('aria-checked', 'true');
  expect(sessionProbe()).toHaveAttribute('data-screen', 'consultation');
  expect(nav.router.replace).not.toHaveBeenCalled();
});

test('expired indemnity blocks going online and the switch says why', () => {
  renderDoctor(<><Probe /><AvailabilityControl /></>, { pathname: '/doctor', query: 'gate=indemnity-expired' });
  expect(doctorProbe()).toHaveAttribute('data-gate', 'indemnity-expired');
  expect(doctorProbe()).toHaveAttribute('data-blocked', 'true');
  expect(sessionProbe()).toHaveAttribute('data-blocked', 'true');
  const sw = screen.getByRole('switch');
  expect(sw).toBeDisabled();
  expect(sw).toHaveAccessibleDescription("You can't go online — indemnity cover has expired.");
  fireEvent.click(screen.getByRole('button', { name: 'goOnline' }));
  expect(sessionProbe()).toHaveAttribute('data-screen', 'offline');
  expect(sessionProbe()).toHaveAttribute('data-online', 'false');
});

test('each ?gate= selects its record and derives its own gate', () => {
  for (const gate of Object.keys(GATE_RECORDS) as GateId[]) {
    const { unmount } = renderDoctor(<Probe />, { pathname: '/doctor', query: `gate=${gate}` });
    expect(doctorProbe()).toHaveAttribute('data-gate', gate);
    expect(doctorProbe()).toHaveAttribute('data-blocked', String(gate === 'indemnity-expired'));
    unmount();
  }
});

test("no query is GP-002's record with no gate; an unknown gate is ignored", () => {
  const { unmount } = renderDoctor(<Probe />, { pathname: '/doctor' });
  expect(doctorProbe()).toHaveAttribute('data-gate', 'none');
  expect(doctorProbe()).toHaveAttribute('data-blocked', 'false');
  expect(doctorProbe()).toHaveAttribute('data-indemnity', 'expiring');   // expiring, not expired: no gate
  unmount();
  renderDoctor(<Probe />, { pathname: '/doctor', query: 'gate=nope' });
  expect(doctorProbe()).toHaveAttribute('data-gate', 'none');
  expect(doctorProbe()).toHaveAttribute('data-indemnity', 'expiring');
});

test('alerts come from the record on screen, and only when seeded', () => {
  const blank = renderDoctor(<Probe />, { pathname: '/doctor' });
  expect(doctorProbe()).toHaveAttribute('data-alerts', '0');
  blank.unmount();
  const seeded = renderDoctor(<Probe />, { pathname: '/doctor', query: 'data=seeded' });
  expect(doctorProbe()).toHaveAttribute('data-alerts', '2');   // GP-002: indemnity 9 days, DBS 12 days
  seeded.unmount();
  renderDoctor(<Probe />, { pathname: '/doctor', query: 'gate=verification-pending&data=seeded' });
  expect(doctorProbe()).toHaveAttribute('data-alerts', '6');   // GP-004: six checks pending
});

test('the onboarding step seeds from the pathname and the URL follows a completed step once', () => {
  const { setPath } = renderDoctor(<Probe />, { pathname: '/doctor/onboarding/register', query: 'data=seeded' });
  expect(onboardingProbe()).toHaveAttribute('data-step', 'register');
  fireEvent.click(screen.getByRole('button', { name: 'submitRegister' }));
  expect(onboardingProbe()).toHaveAttribute('data-step', 'identity');
  expect(onboardingProbe()).toHaveAttribute('data-nav', '1');
  expect(nav.router.replace).toHaveBeenCalledTimes(1);
  expect(nav.router.replace).toHaveBeenCalledWith('/doctor/onboarding/identity?data=seeded');
  setPath('/doctor/onboarding/identity');
  expect(onboardingProbe()).toHaveAttribute('data-nav', '1');
  expect(nav.router.replace).toHaveBeenCalledTimes(1);
});

test('landing on a later onboarding step by URL jumps without bumping nav, and the bare path has no opinion', () => {
  const { setPath } = renderDoctor(<Probe />, { pathname: '/doctor/onboarding/register' });
  setPath('/doctor/onboarding/skills');
  expect(onboardingProbe()).toHaveAttribute('data-step', 'skills');
  expect(onboardingProbe()).toHaveAttribute('data-reached', '4');
  expect(onboardingProbe()).toHaveAttribute('data-nav', '0');
  setPath('/doctor/onboarding');
  expect(onboardingProbe()).toHaveAttribute('data-step', 'skills');
  expect(nav.router.replace).not.toHaveBeenCalled();
});

test('the admin data-mode switch flips the mode and stamps the URL and the document', () => {
  renderAdmin(<DataModeSwitch />);
  const sw = screen.getByRole('switch', { name: 'Seeded data' });
  expect(sw).toHaveAttribute('aria-checked', 'false');
  expect(document.documentElement.dataset.figures).toBe('placeholder');
  fireEvent.click(sw);
  expect(sw).toHaveAttribute('aria-checked', 'true');
  expect(window.location.search).toBe('?data=seeded');
  expect(document.documentElement.dataset.figures).toBe('seeded');
  fireEvent.click(sw);
  expect(sw).toHaveAttribute('aria-checked', 'false');
  expect(window.location.search).toBe('');
  expect(document.documentElement.dataset.figures).toBe('placeholder');
});

test('the doctor layout mounts the providers, the shell and the availability control around its child', () => {
  installDomStubs();
  // A flow route: the rail collapses and SurfaceNav's tooltips mount, so this
  // also proves the TooltipProvider is above them.
  resetNav('/doctor/session/offline');
  window.history.replaceState(null, '', '/doctor/session/offline');
  render(<DoctorLayout><p>child</p></DoctorLayout>);
  expect(document.querySelector('[data-slot="ribbon"]')).toHaveTextContent('Prototype. Not a live service — no real patients, GPs, or data.');
  expect(document.querySelector('[data-surface="doctor"]')).toBeInTheDocument();
  expect(screen.getByRole('switch', { name: 'Availability' })).toHaveAccessibleDescription("You're offline");
  expect(screen.getByText('child')).toBeInTheDocument();
});

test('the admin layout mounts the data mode provider, the shell and the data-mode switch', () => {
  installDomStubs();
  resetNav('/admin');
  window.history.replaceState(null, '', '/admin');
  render(<AdminLayout><p>child</p></AdminLayout>);
  expect(document.querySelector('[data-slot="ribbon"]')).toBeInTheDocument();
  expect(document.querySelector('[data-surface="admin"]')).toBeInTheDocument();
  expect(screen.getByRole('switch', { name: 'Seeded data' })).toHaveAttribute('aria-checked', 'false');
  expect(screen.getByText('child')).toBeInTheDocument();
});
```

`tests/headers.test.ts` — change the import line and append two tests. Old:

```ts
import { test, expect } from 'vitest';
import nextConfig, { PROD_CSP } from '@/next.config';
```

New:

```ts
import { test, expect, vi } from 'vitest';
import { createRequire } from 'node:module';
import nextConfig, { PROD_CSP } from '@/next.config';
```

Append after the last test:

```ts
test('the doctor and admin layouts declare noindex metadata as belt and braces', async () => {
  // Neither layout loads a font (Geist and Inter are loaded once in app/layout.tsx);
  // the mock is here so a later import cannot turn this into a network fetch.
  vi.doMock('next/font/google', () => ({
    Geist: () => ({ variable: '--font-geist', className: '' }),
    Inter: () => ({ variable: '--font-inter', className: '' }),
  }));
  const [{ metadata: doctor }, { metadata: admin }] = await Promise.all([
    import('@/app/(app)/doctor/layout'),
    import('@/app/(app)/admin/layout'),
  ]);
  expect(doctor.robots).toEqual({ index: false, follow: false });
  expect(admin.robots).toEqual({ index: false, follow: false });
  expect(doctor.title).toBe('Dr Quick — Doctor');
  expect(admin.title).toBe('Dr Quick — Admin');
});

test('the noindex rules match the bare /doctor and /admin paths, not only their children', () => {
  // next.config `source` uses path-to-regexp v6 semantics: `:path*` is zero-or-more segments.
  const { pathToRegexp } = createRequire(import.meta.url)('next/dist/compiled/path-to-regexp') as {
    pathToRegexp: (path: string) => RegExp;
  };
  for (const prefix of ['doctor', 'admin']) {
    const re = pathToRegexp(`/${prefix}/:path*`);
    expect(re.test(`/${prefix}`)).toBe(true);
    expect(re.test(`/${prefix}/session/offer-timed-out`)).toBe(true);
    expect(re.test(`/${prefix}x`)).toBe(false);
  }
});
```

`tests/bundle.test.ts` (node environment; skipped when there is no build):

```ts
import { test, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
// Written by the Next 16 Turbopack build: per-route first-load bytes and chunk paths
// (relative to the website directory). There is no app-build-manifest any more.
const STATS = join(ROOT, '.next', 'diagnostics', 'route-bundle-stats.json');

// Minified chunks mangle identifiers, so the lock is on strings that survive:
// attribute values, fixture literals, screen ids and copy that only the dashboards carry.
const NEEDLES = [
  'sidebar-wrapper', 'toaster', 'GP-002', 'Schedule 2 controlled drugs',
  'offer-consent-refused', 'Not a live service', 'verification-rejected',
];

type RouteStats = { route: string; firstLoadUncompressedJsBytes: number; firstLoadChunkPaths: string[] };

test.skipIf(!existsSync(STATS))('the landing bundle carries no app shell, toaster or fixtures', () => {
  const routes = JSON.parse(readFileSync(STATS, 'utf8')) as RouteStats[];
  const home = routes.find((r) => r.route === '/')!;
  expect(home.firstLoadChunkPaths.length).toBeGreaterThan(0);
  for (const chunk of home.firstLoadChunkPaths) {
    const text = readFileSync(join(ROOT, chunk), 'utf8');
    for (const needle of NEEDLES) expect(text.includes(needle), `${needle} in ${chunk}`).toBe(false);
  }
});
```

Run: `npx vitest run tests/providers.test.tsx tests/headers.test.ts tests/bundle.test.ts` → `providers.test.tsx` fails to load (`Failed to resolve import "@/components/doctor/DoctorProviders" from "tests/helpers/render-doctor.tsx"`); in `headers.test.ts` the three existing tests pass and the metadata test fails on the missing layout modules (the path-to-regexp test passes — it needs nothing new); `bundle.test.ts` passes against the Task 1 build (or skips if `.next/` is absent).

- [ ] **Step 3: `components/doctor/DoctorProvider.tsx`**

```tsx
'use client';
import { createContext, useContext, useMemo } from 'react';
import { useDataMode, usePersistedQuery } from '@/lib/data-mode';
import { GATE_RECORDS, MY_RECORD, type CredentialRecord, type GateId } from '@/lib/fixtures';
import { credentialAlerts, gateFor, type CredentialAlert } from '@/lib/alerts';

type Ctx = { record: CredentialRecord; gate: GateId | null; blocked: boolean; alerts: CredentialAlert[] };
const DoctorContext = createContext<Ctx | null>(null);

const isGateId = (value: string | null): value is GateId =>
  value !== null && Object.hasOwn(GATE_RECORDS, value);

/* Decision 1. ?gate= only chooses whose credential record is on screen — what
   the prototype's rail did. The gate itself is derived from that record by the
   same alerts the dashboard lists, so a gate and an alert can never disagree.
   The query is read after mount, so the server and the first client render
   both show GP-002's record and no gate; the flip is a post-mount setState. */
export function DoctorProvider({ children }: { children: React.ReactNode }) {
  const [gateQuery] = usePersistedQuery('gate');
  const { seeded } = useDataMode();
  const value = useMemo<Ctx>(() => {
    const record = isGateId(gateQuery) ? GATE_RECORDS[gateQuery] : MY_RECORD;
    const gate = gateFor(record);
    return {
      record,
      gate,
      // Indemnity is the one lapse that is unlawful to work through (lib/alerts.ts BLOCKING).
      blocked: gate === 'indemnity-expired',
      alerts: seeded ? credentialAlerts(record) : [],
    };
  }, [gateQuery, seeded]);
  return <DoctorContext.Provider value={value}>{children}</DoctorContext.Provider>;
}

export function useDoctor() {
  const c = useContext(DoctorContext);
  if (!c) throw new Error('useDoctor outside DoctorProvider');
  return c;
}
```

- [ ] **Step 4: `components/doctor/SessionProvider.tsx` — the contract's text, verbatim**

```tsx
'use client';
import { createContext, useCallback, useContext, useEffect, useEffectEvent, useReducer, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLiveInterval } from '@/hooks/use-live-interval';
import { useDataMode } from '@/lib/data-mode';
import { initialSession, sessionReducer, sessionScreenFromPath, sessionHref, OFFER_AFTER_MS,
  type SessionAction, type SessionState } from '@/lib/session';
import { useDoctor } from './DoctorProvider';

type Ctx = { state: SessionState; act: (a: SessionAction, o?: { navigate?: boolean }) => void;
  onSessionRoute: boolean; secondsOnline: number; consultSeconds: number };
const SessionContext = createContext<Ctx | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { blocked } = useDoctor();
  const { seeded } = useDataMode();
  const onSessionRoute = pathname === '/doctor/session' || pathname.startsWith('/doctor/session/');

  // usePathname() is the concrete prerender path, so the server HTML for
  // /doctor/session/offer shows the offer and the client's first render agrees.
  const [state, dispatch] = useReducer(sessionReducer, null, () =>
    initialSession(sessionScreenFromPath(pathname), { blocked, now: Date.now() }));

  const pushNext = useRef(false);
  const act = useCallback((action: SessionAction, opts?: { navigate?: boolean }) => {
    pushNext.current = !!opts?.navigate;   // the dashboard tile only; overwritten on every call
    dispatch(action);
  }, []);

  // URL follows state — only when a non-jump action moved the screen (nav bumped).
  const follow = useEffectEvent(() => {
    const href = sessionHref(state.screen) + window.location.search;   // keeps ?data=seeded
    if (pushNext.current) { pushNext.current = false; router.push(href); return; }
    if (onSessionRoute && pathname !== sessionHref(state.screen)) router.replace(href);
  });
  useEffect(() => { if (state.nav > 0) follow(); }, [state.nav]);

  // State follows URL — only when the URL names a screen the state is not on.
  // `jump` never bumps `nav`, so this can never re-enter `follow`.
  const sync = useEffectEvent(() => {
    const screen = sessionScreenFromPath(pathname);   // null for the bare route → no opinion
    if (screen && screen !== state.screen) dispatch({ type: 'jump', screen, now: Date.now() });
  });
  useEffect(() => { sync(); }, [pathname]);

  // ?gate= is read after mount, so `blocked` flips after the initialiser ran.
  useEffect(() => { dispatch({ type: 'setBlocked', blocked }); }, [blocked]);

  // Decision 4. Cleanup clears the timer: going offline cancels it, StrictMode re-arms it.
  const arrive = useEffectEvent(() => act(seeded
    ? { type: 'offerArrives', consent: state.offersSeen % 2 === 0, now: Date.now() }
    : { type: 'noPatients' }));
  useEffect(() => {
    if (state.screen !== 'online-idle') return;
    const id = window.setTimeout(arrive, OFFER_AFTER_MS);
    return () => window.clearTimeout(id);
  }, [state.screen]);

  // `clock` is null on the server and on the first client render, so every elapsed
  // figure is 0 in both; it starts moving after mount.
  const [clock, setClock] = useState<number | null>(null);
  useLiveInterval(setClock, 1000, state.online);
  useLiveInterval((now) => act({ type: 'tickOffer', now }), 1000,
    state.screen === 'offer' || state.screen === 'offer-consent-refused');
  const elapsed = (since: number | null) =>
    clock !== null && since !== null ? Math.max(0, Math.floor((clock - since) / 1000)) : 0;

  return (
    <SessionContext.Provider value={{ state, act, onSessionRoute,
      secondsOnline: elapsed(state.onlineSince), consultSeconds: elapsed(state.consultationStartedAt) }}>
      {children}
    </SessionContext.Provider>
  );
}
export function useSession() {
  const c = useContext(SessionContext);
  if (!c) throw new Error('useSession outside SessionProvider');
  return c;
}
```

- [ ] **Step 5: `components/doctor/OnboardingProvider.tsx` — the same shape, no timers**

```tsx
'use client';
import { createContext, useContext, useEffect, useEffectEvent, useReducer } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { initialOnboarding, onboardingReducer, onboardingStepFromPath, onboardingHref,
  type OnboardingAction, type OnboardingState } from '@/lib/onboarding';

type Ctx = { state: OnboardingState; act: (action: OnboardingAction) => void };
const OnboardingContext = createContext<Ctx | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const onOnboardingRoute = pathname === '/doctor/onboarding' || pathname.startsWith('/doctor/onboarding/');

  // Seeded from the prerender path, as the session is: landing on
  // /doctor/onboarding/skills marks every earlier step done on the server too.
  const [state, act] = useReducer(onboardingReducer, null, () =>
    initialOnboarding(onboardingStepFromPath(pathname)));

  // URL follows state — only when a step-advancing action bumped `nav`.
  const follow = useEffectEvent(() => {
    const target = onboardingHref(state.step);
    if (onOnboardingRoute && pathname !== target) router.replace(target + window.location.search);
  });
  useEffect(() => { if (state.nav > 0) follow(); }, [state.nav]);

  // State follows URL. `jump` never bumps `nav`, so this can never re-enter `follow`,
  // and the bare path is null — it must never rewind what was reached.
  const sync = useEffectEvent(() => {
    const step = onboardingStepFromPath(pathname);
    if (step && step !== state.step) act({ type: 'jump', step });
  });
  useEffect(() => { sync(); }, [pathname]);

  return <OnboardingContext.Provider value={{ state, act }}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const c = useContext(OnboardingContext);
  if (!c) throw new Error('useOnboarding outside OnboardingProvider');
  return c;
}
```

- [ ] **Step 6: `components/doctor/DoctorProviders.tsx`**

No hooks, no directive: it only composes the four client providers, in the contract's order.

```tsx
import { DataModeProvider } from '@/lib/data-mode';
import { DoctorProvider } from './DoctorProvider';
import { SessionProvider } from './SessionProvider';
import { OnboardingProvider } from './OnboardingProvider';

// Mounted in the doctor layout and nowhere else: the admin surface never sees
// the session, and the landing page never loads any of this.
export function DoctorProviders({ children }: { children: React.ReactNode }) {
  return (
    <DataModeProvider>
      <DoctorProvider>
        <SessionProvider>
          <OnboardingProvider>{children}</OnboardingProvider>
        </SessionProvider>
      </DoctorProvider>
    </DataModeProvider>
  );
}
```

- [ ] **Step 7: The two top-bar controls**

`components/doctor/AvailabilityControl.tsx`:

```tsx
'use client';
import { useId } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useDoctor } from './DoctorProvider';
import { useSession } from './SessionProvider';

// preview/doctor.html:369 and :399 — the two availability screens' headings.
const OFFLINE = "You're offline";
const ONLINE = "You're online";
// preview/doctor.html:492-493, as one sentence beside the disabled control.
const BLOCKED = "You can't go online — indemnity cover has expired.";

/* The one big control, echoed everywhere (preview/js/doctor.js:75-105): a real
   switch with a fixed label, its state read as a description. The top bar
   flips the session in place; the dashboard tile passes `navigate` and also
   goes to the session route. A refused transition — going offline mid-
   consultation, or online without indemnity — leaves the reducer's state
   untouched, so the switch simply stays where it was. */
export function AvailabilityControl({ navigate = false, className }: { navigate?: boolean; className?: string }) {
  const { state, act } = useSession();
  const { blocked } = useDoctor();
  const id = useId();   // the top bar and the dashboard tile share /doctor
  const stateId = `${id}-state`;
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Label htmlFor={id}>Availability</Label>
      <Switch
        id={id}
        checked={state.online}
        disabled={blocked}
        aria-describedby={stateId}
        onCheckedChange={(checked) =>
          act(checked ? { type: 'goOnline', now: Date.now() } : { type: 'goOffline' }, navigate ? { navigate: true } : undefined)}
      />
      {/* Severity by weight: the hard stop is ink and semibold, the state is ink-2. */}
      <p id={stateId} role="status" className={cn('text-fine', blocked ? 'font-semibold text-ink' : 'text-ink-2')}>
        {blocked ? BLOCKED : state.online ? ONLINE : OFFLINE}
      </p>
    </div>
  );
}
```

`components/admin/DataModeSwitch.tsx`:

```tsx
'use client';
import { useId } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useDataMode } from '@/lib/data-mode';

// The preview switched modes by URL alone; the admin top bar makes the same
// choice a control. DataModeProvider re-stamps ?data=seeded onto the URL, so
// the link a reviewer copies keeps the mode.
export function DataModeSwitch() {
  const { seeded, setMode } = useDataMode();
  const id = useId();
  return (
    <div className="flex items-center gap-3">
      <Label htmlFor={id}>Seeded data</Label>
      <Switch id={id} checked={seeded} onCheckedChange={(on) => setMode(on ? 'seeded' : 'placeholder')} />
    </div>
  );
}
```

- [ ] **Step 8: The shell wrappers and the two layouts**

`components/doctor/DoctorShell.tsx`:

```tsx
'use client';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppShell } from '@/components/app/AppShell';
import { DOCTOR_NAV } from '@/components/app/nav';
import { AvailabilityControl } from './AvailabilityControl';

// A client component so DOCTOR_NAV's icon components are props between client
// components and never cross the server boundary from the layout (React Flight
// refuses functions as props). The restyled SidebarProvider no longer mounts
// shadcn's TooltipProvider; the collapsed rail's item tooltips need one above them.
export function DoctorShell({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <AppShell surface="doctor" title="Doctor" nav={DOCTOR_NAV} end={<AvailabilityControl />}>
        {children}
      </AppShell>
    </TooltipProvider>
  );
}
```

`components/admin/AdminShell.tsx`:

```tsx
'use client';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AppShell } from '@/components/app/AppShell';
import { ADMIN_NAV } from '@/components/app/nav';
import { DataModeSwitch } from './DataModeSwitch';

// See DoctorShell: the nav's icons stay on the client side of the boundary,
// and the rail's tooltips get their provider.
export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <AppShell surface="admin" title="Admin" nav={ADMIN_NAV} end={<DataModeSwitch />}>
        {children}
      </AppShell>
    </TooltipProvider>
  );
}
```

`app/(app)/doctor/layout.tsx` (server component — a `metadata` export is not allowed in a `'use client'` file; never calls `cookies()`/`headers()`, which would make the surface dynamic):

```tsx
import type { Metadata } from 'next';
import { DoctorProviders } from '@/components/doctor/DoctorProviders';
import { DoctorShell } from '@/components/doctor/DoctorShell';

// Belt and braces with next.config's X-Robots-Tag: the child robots entry
// replaces the root's outright, and the title stops the landing title applying.
export const metadata: Metadata = {
  title: 'Dr Quick — Doctor',
  robots: { index: false, follow: false },
};

// Every route beneath is static; the providers hold all state on the client.
export const dynamic = 'force-static';

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return (
    <DoctorProviders>
      <DoctorShell>{children}</DoctorShell>
    </DoctorProviders>
  );
}
```

`app/(app)/admin/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import { DataModeProvider } from '@/lib/data-mode';
import { AdminShell } from '@/components/admin/AdminShell';

export const metadata: Metadata = {
  title: 'Dr Quick — Admin',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-static';

// No global store: the admin surface mounts the data mode alone and can never
// read the doctor's session.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <DataModeProvider>
      <AdminShell>{children}</AdminShell>
    </DataModeProvider>
  );
}
```

- [ ] **Step 9: Placeholder pages, so the whole tree builds now**

Each renders `PageHeader` with the preview's `h1` text; Tasks 14–25 replace them. They carry no `data-screen` on purpose, so Task 26's structure assertions stay honestly red until the real screens land.

`app/(app)/doctor/page.tsx`:

```tsx
import { PageHeader } from '@/components/app/PageHeader';

// preview/doctor.html:41. Task 14 replaces this with <DoctorHome />.
export default function Page() {
  return <PageHeader title="Today" />;
}
```

`app/(app)/doctor/earnings/page.tsx`:

```tsx
import { PageHeader } from '@/components/app/PageHeader';

// preview/doctor.html:173. Task 16 replaces this with <Earnings />.
export default function Page() {
  return <PageHeader title="Earnings" />;
}
```

`app/(app)/doctor/profile/page.tsx`:

```tsx
import { PageHeader } from '@/components/app/PageHeader';

// preview/doctor.html:227. Task 17 replaces this with <Profile />.
export default function Page() {
  return <PageHeader title="Profile" />;
}
```

`app/(app)/doctor/onboarding/[[...step]]/page.tsx`:

```tsx
import { ONBOARDING_STEPS } from '@/lib/onboarding';
import { PageHeader } from '@/components/app/PageHeader';

export const dynamic = 'force-static';
export const dynamicParams = false;   // anything not listed → 404

// The bare route MUST be `{ step: [] }`; `{}` throws E618 at build (static-paths/app.js:252,264).
export function generateStaticParams(): Array<{ step: string[] }> {
  return [{ step: [] }, ...ONBOARDING_STEPS.map((step) => ({ step: [step] }))];
}

// `params` is deliberately unused: the segment exists so every step is a static
// URL. The step renders from OnboardingProvider, seeded from usePathname(), which
// is identical on the server and the client — nothing is handed down.
// preview/doctor.html:263 is the register heading. Task 18 replaces this with <OnboardingFlow />.
export default function Page() {
  return <PageHeader title="Join Dr Quick" />;
}
```

`app/(app)/doctor/session/[[...state]]/page.tsx`:

```tsx
import { SESSION_SCREENS } from '@/lib/session';
import { PageHeader } from '@/components/app/PageHeader';

export const dynamic = 'force-static';
export const dynamicParams = false;   // anything not listed → 404

// The bare route MUST be `{ state: [] }`; `{}` throws E618 at build (static-paths/app.js:252,264).
export function generateStaticParams(): Array<{ state: string[] }> {
  return [{ state: [] }, ...SESSION_SCREENS.map((state) => ({ state: [state] }))];
}

// `params` is deliberately unused: the segment exists so every state is a static
// URL. The screen renders from SessionProvider, seeded from usePathname(), which
// is identical on the server and the client — nothing is handed down.
// preview/doctor.html:369 is the offline heading. Task 19 replaces this with <SessionScreen />.
export default function Page() {
  return <PageHeader title="You're offline" />;
}
```

`app/(app)/admin/page.tsx`:

```tsx
import { PageHeader } from '@/components/app/PageHeader';

// preview/admin.html:38. Task 22 replaces this with <LiveFloor />.
export default function Page() {
  return <PageHeader title="Live operations" />;
}
```

`app/(app)/admin/governance/page.tsx`:

```tsx
import { PageHeader } from '@/components/app/PageHeader';

// preview/admin.html:85. Task 23 replaces this with <Governance />.
export default function Page() {
  return <PageHeader title="Clinical governance and safety" />;
}
```

`app/(app)/admin/supply/page.tsx`:

```tsx
import { PageHeader } from '@/components/app/PageHeader';

// preview/admin.html:146. Task 24 replaces this with <Supply />.
export default function Page() {
  return <PageHeader title="GP supply operations" />;
}
```

`app/(app)/admin/business/page.tsx`:

```tsx
import { PageHeader } from '@/components/app/PageHeader';

// preview/admin.html:171. Task 25 replaces this with <Business />.
export default function Page() {
  return <PageHeader title="Business" />;
}
```

- [ ] **Step 10: Run the three files, then typecheck**

Run: `npx vitest run tests/providers.test.tsx tests/headers.test.ts tests/bundle.test.ts` → 15 + 5 + 1 passing. If the metadata test fails with a `window is not defined` thrown at module scope, move that one test into a `// @vitest-environment jsdom` file rather than giving `headers.test.ts` a DOM. Then `npm run typecheck` → green (the `(app)` paths resolve through the `@/*` alias; `useEffectEvent` is in `@types/react` 19.2; `Object.hasOwn` is in the ES2022 lib). Then `npm test` → green: `tests/constraints.test.ts` scans the new files and finds no hex, no `dark:`, no arbitrary colour, no medicine, and nothing under `app/(app)/doctor` or `components/doctor` says schedule, rota or calendar.

- [ ] **Step 11: Build, then the bundle-isolation check (Task 28 reruns this after the last screen lands)**

```bash
cd /Users/liam/development/DrQuick/website
NEXT_PUBLIC_SITE_URL=http://localhost:3000 npm run build
```

Expected: the route table lists `/doctor`, `/doctor/earnings`, `/doctor/profile`, `/doctor/onboarding/[[...step]]` with its seven paths and `/doctor/session/[[...state]]` with its eleven, plus `/admin`, `/admin/governance`, `/admin/supply`, `/admin/business` — every one `○` (Static) or `●` (SSG), none `ƒ`; the build ends without an E618 (the bare `{ state: [] }` / `{ step: [] }` rows are why). Then:

```bash
node -e '
const fs = require("fs");
const r = require("./.next/diagnostics/route-bundle-stats.json").find(x => x.route === "/");
console.log("/ first load:", r.firstLoadUncompressedJsBytes, "(baseline 494295)");
const needles = ["sidebar-wrapper", "toaster", "GP-002", "Schedule 2 controlled drugs",
                 "offer-consent-refused", "Not a live service", "verification-rejected"];
for (const p of r.firstLoadChunkPaths) { const s = fs.readFileSync(p, "utf8");
  for (const n of needles) if (s.includes(n)) console.error("LEAK", JSON.stringify(n), p); }'
grep -o '"\[project\]/[^"]*"' .next/server/app/page_client-reference-manifest.js | sort -u
```

Expected: `/ first load:` within a few KB of 494,295 (the Task 1 baseline), no `LEAK` line, and the manifest grep shows nothing under `components/app`, `components/doctor`, `components/admin`, `components/ui/{sidebar,sheet,sonner,tooltip}` or `lib/{fixtures,session,onboarding,data-mode}`. Finally `npx vitest run tests/bundle.test.ts` → 1 passing against the fresh build (not skipped).

- [ ] **Step 12: Commit**

```bash
git add 'app/(app)' components/doctor components/admin tests/helpers/render-doctor.tsx tests/helpers/render-admin.tsx tests/providers.test.tsx tests/headers.test.ts tests/bundle.test.ts
git commit -m "feat(app): doctor and admin layouts with their providers and noindex metadata

Two route groups, each mounting its own providers and the shared shell:
the doctor layout holds the data mode, the credential record chosen by
?gate=, the session reducer and the onboarding reducer; the admin layout
holds the data mode alone. Session and onboarding state follow the URL and
the URL follows them without fighting (the nav counter). The availability
control is a real switch that says why it is disabled. Every route under
/doctor and /admin builds as a static page with noindex metadata, and a
test locks the landing bundle against the shell, the toaster and the
fixtures.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: The doctor dashboard

> Contract-over-brief notes (one line each): (1) the brief says `shown(payoutAmount)`; the contract's `earningsFor()` folds this session's records into `payoutAmount` and the spec's £39-delta test needs the tile to move in blank mode, so "Next payout" is `live(e.payoutAmount, money)` and its when/note/meter switch on `e.weekConsults > 0` / `e.fortnightConsults > 0` (identical output to `seeded ?` in both pure modes; a lone session record reads "1 consultation …", the only template change). (2) "Busiest day" goes through `live(e.busiest, …)` so a null busiest is the dash without a literal branch. (3) The preview's `ACTIONS.revalidation → 'revalidation-due'` becomes `/doctor/profile`: that gate is a `?gate=` development state (Decision 1), not a product destination. (4) The `next/navigation` mock is `tests/helpers/navigation-mock.ts`, the name the task map gives Task 4 (the tests review called it `next-navigation.ts`; if Task 4 used that name, change the two import paths). (5) `AvailabilityControl` is not in the contract; this task consumes it as `<AvailabilityControl variant="navigate" />` (see Consumes) and Task 13 must export that prop.

**Files:**
- Create: `components/doctor/Dashboard.tsx`, `components/doctor/DoctorHome.tsx`, `components/doctor/Gate.tsx` (a temporary heading-only stub, created **only if Task 15 has not already created it**; Task 15 replaces the file wholesale)
- Modify: `app/(app)/doctor/page.tsx` (Task 13's placeholder page)
- Test: `tests/doctor-dashboard.test.tsx`
- Read: `preview/doctor.html:36-166` (the dashboard), `preview/doctor.html:517-522` (the revalidation banner copy), `preview/js/doctor.js:107-225` (figures, alerts, charts, table, performance), `preview/js/doctor.js:136` (`ACTIONS`), `preview/js/doctor.js:293-308`, `lib/earnings.ts`, `lib/fixtures.ts`, `lib/alerts.ts`, `lib/data-mode.tsx`, `lib/format.ts`, `components/app/{StatTile,EmptyState,PageHeader,ChartFrame,BarChart,LineChart,ChartLegend}.tsx`, `components/doctor/{DoctorProvider,SessionProvider,DoctorProviders,AvailabilityControl}.tsx`, `components/ui/{card,alert,button,progress,table,switch}.tsx`, `tests/helpers/{navigation-mock,dom-stubs}.ts`

**Interfaces:**
- Consumes:
  - `useDoctor(): { record: CredentialRecord; gate: GateId | null; blocked: boolean; alerts: CredentialAlert[] }` (Task 13) — `alerts` is already `seeded ? credentialAlerts(record) : []`.
  - `useSession(): { state: SessionState; act: (action: SessionAction, opts?: { navigate?: boolean }) => void; onSessionRoute: boolean; secondsOnline: number; consultSeconds: number }` (Task 13); `state.completed: SessionRecord[]`, `state.online`, `state.screen`.
  - `useFigures(): { seeded; DASH; shown; live; seedList }` (Task 4).
  - `earningsFor({ seeded, session }): Earnings` (Task 3) — `today`, `fortnight`, `fortnightConsults`, `weekConsults`, `payoutAmount`, `recent`, `dailySeries`, `busiest`.
  - `DOCTOR.shift.{patientsWaiting,gpsOnline,gpsNeeded,minutesOnline}`, `DOCTOR.revalidationDueInDays`, `DOCTOR_DASHBOARD.{offersToday,acceptanceRate,averageConsultMinutes,payout}`, `DEMAND_BY_HOUR`, `FEE`, types `CredentialKey`, `GateId` (Task 3); `alertSentence`, `CredentialAlert` (Task 3); `money`, `minutesLabel`, `percent`, `daysLabel` (Task 2).
  - `<StatTile label value size="lg"|"sm" />`, `<EmptyState>`, `<PageHeader title actions />`, `<BarChart data height format ariaLabel />`, `<LineChart sets labels height ariaLabel />`, `<ChartLegend items />` with swatches `'primary' | 'outline' | 'ink-2'` (Tasks 9–10). Four `StatTile`s sit inside the band card: `StatTile`'s label must read the band through the card group the way `CardDescription` does (`text-ink-2 group-data-[variant=band]/card:text-band-ink-2`; the numeral is `text-current`) — Task 9 owns that class, this task adds no override.
  - `<AvailabilityControl variant?: 'bar' | 'navigate' />` (Task 13): one Radix `Switch` (`role="switch"`, `aria-checked`, `checked={state.online}`, a text label, disabled with the reason when `blocked`); the `navigate` variant calls `act({ type: online ? 'goOffline' : 'goOnline', now }, { navigate: true })` (the preview's echo button, `doctor.js:90-94`), the default variant the same without `navigate`. Its label and status text read the band through `group-data-[variant=band]/card:text-white`. The tile hosts the `navigate` variant; the top bar hosts the default; a screen rendered without the shell therefore has exactly one switch.
  - `<Gate id={GateId} />` (Task 15) — the root carries `data-screen={id}`.
  - `DoctorProviders` (Task 13); test helpers `tests/helpers/navigation-mock.ts` (`nav.router.push/replace` as `vi.fn`, `resetNav(pathname)`, `usePathname`, `useRouter`) and `tests/helpers/dom-stubs.ts` (`installDomStubs()`, `ResizeObserverStub.forElement(el)` / `.resize(el, width)`) (Task 4).
- Produces: `Dashboard()` (client; root `<section data-screen="dashboard">`), `DoctorHome()` (client; gate switch + the revalidation banner carrying `data-gate="revalidation-due"` and `data-slot="alert"`), `Gate({ id })` stub (until Task 15), `app/(app)/doctor/page.tsx` rendering `<DoctorHome />`. New strings for the report: the demand chart's `ariaLabel` "Patients waiting and GPs online, by hour"; the sr-only credential name after "Fix" so the two links have distinct names; the singular "1 consultation at £39 each …" branch of the payout note.

- [ ] **Step 1: Write the dashboard test and watch it fail on the missing modules**

`tests/doctor-dashboard.test.tsx`:

```tsx
// @vitest-environment jsdom
import { test, expect, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, act, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
vi.mock('next/navigation', () => import('./helpers/navigation-mock'));
import { nav, resetNav } from './helpers/navigation-mock';
import { installDomStubs, ResizeObserverStub } from './helpers/dom-stubs';
import { DoctorProviders } from '@/components/doctor/DoctorProviders';
import { DoctorHome } from '@/components/doctor/DoctorHome';

const DASH = '—';
const NOTE = 'You cannot take a consultation once this lapses.';

// No shell: the dashboard alone, so the tile's switch is the only switch on screen.
function renderHome(query = '') {
  installDomStubs();
  resetNav('/doctor');
  window.history.replaceState(null, '', query ? `/doctor?${query}` : '/doctor');   // read after mount by usePersistedQuery
  return render(<DoctorProviders><DoctorHome /></DoctorProviders>);
}

const values = (root: ParentNode) =>
  [...root.querySelectorAll('[data-slot="stat-value"]')].map((el) => el.textContent?.trim());

const section = (name: string) => screen.getByRole('heading', { level: 2, name }).closest('section')!;

// ChartFrame draws nothing until ResizeObserver has measured it.
function measureCharts(container: HTMLElement) {
  for (const frame of container.querySelectorAll('[data-slot="chart-frame"]')) {
    act(() => ResizeObserverStub.forElement(frame)!.resize(frame, 640));
  }
}

beforeEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

test('blank mode: every figure is a dash, every list is a sentence, nothing is drawn', () => {
  const { container } = renderHome();
  expect(container.querySelector('[data-screen="dashboard"]')).toBeInTheDocument();
  const stats = values(container);
  expect(stats).toHaveLength(13);                           // 4 shift + 1 payout + 3 fortnight + 3 offers + 2 performance
  expect(stats.every((v) => v === DASH)).toBe(true);
  expect(screen.getByText('No consultations yet.')).toHaveAttribute('data-slot', 'empty');
  expect(screen.getByText('No demand recorded yet.')).toHaveAttribute('data-slot', 'empty');
  expect(screen.getByText('No credentials on file yet. Add them and anything close to lapsing appears here.')).toHaveAttribute('data-slot', 'empty');
  expect(screen.getByText('No consultations today.')).toBeInTheDocument();
  expect(container.querySelectorAll('[data-slot="chart-frame"]')).toHaveLength(0);
  expect(container.querySelectorAll('svg[role="img"]')).toHaveLength(0);
  expect(container.querySelectorAll('[data-slot="alert"]')).toHaveLength(0);
  expect(container.querySelector('[data-slot="alert-count"]')).toHaveTextContent(DASH);
  expect(screen.getByText('Nothing to pay out yet')).toBeInTheDocument();
  expect(screen.getByText('Paid by bank transfer at £39 per completed consultation.')).toBeInTheDocument();
  for (const bar of container.querySelectorAll('[role="progressbar"]')) expect(bar).toHaveAttribute('aria-valuenow', '0');
  expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  expect(screen.getByRole('heading', { level: 2, name: 'You are offline' })).toBeInTheDocument();
  expect(screen.getByText('Not taking offers')).toBeInTheDocument();
  expect(container.textContent).not.toMatch(/\brating\b/i);
});

test('seeded mode: the preview arithmetic, in the preview order', () => {
  const { container } = renderHome('data=seeded');

  const band = container.querySelectorAll('[data-slot="card"][data-variant="band"]');
  expect(band).toHaveLength(1);                             // Decision 22: the availability tile only
  expect(values(band[0])).toEqual(['4', '2 of 3', '42m', '£117']);

  expect(screen.getByText('£468')).toHaveAttribute('data-slot', 'stat-value');
  expect(screen.getByText('Paid Friday 4 September')).toBeInTheDocument();
  expect(screen.getByText('12 consultations at £39 each, by bank transfer.')).toBeInTheDocument();
  expect(container.querySelector('[aria-labelledby="payout-note"]')).toHaveAttribute('aria-valuenow', '52');

  const items = [...container.querySelectorAll('[role="list"] [data-slot="alert"]')];
  expect(items).toHaveLength(2);
  expect(items.map((i) => i.getAttribute('role'))).toEqual(['listitem', 'listitem']);   // Decision 28: not three live regions
  expect(items.map((i) => i.querySelector('[data-slot="alert-title"]')?.textContent)).toEqual([
    'Indemnity cover expires in 9 days.',
    'DBS check expires in 12 days.',
  ]);
  expect(items[0]).toHaveTextContent(NOTE);
  expect(items[1]).not.toHaveTextContent(NOTE);
  expect(items.map((i) => i.getAttribute('data-variant'))).toEqual(['accent', 'accent']);   // Decision 12: never destructive
  expect(screen.getByRole('link', { name: 'Fix Indemnity cover' })).toHaveAttribute('href', '/doctor/onboarding/indemnity');
  expect(screen.getByRole('link', { name: 'Fix DBS check' })).toHaveAttribute('href', '/doctor/onboarding/credentials');
  expect(container.querySelector('[data-slot="alert-count"]')).toHaveTextContent('2 to sort');

  const daily = section('Consultations, last 14 days');
  expect(values(daily)).toEqual(['23', '£897', '18 Aug · 3']);
  const demand = section('When it is worth being online');
  expect(container.querySelectorAll('[data-slot="chart-frame"]')).toHaveLength(2);
  expect(container.querySelectorAll('svg[role="img"]')).toHaveLength(0);   // nothing before measurement
  measureCharts(container);
  const charts = container.querySelectorAll('svg[role="img"]');
  expect(charts).toHaveLength(2);
  expect(charts[0]).toHaveAttribute('aria-label', 'Consultations, last 14 days');
  expect(charts[0].querySelectorAll('rect')).toHaveLength(14);
  expect(charts[1]).toHaveAttribute('aria-label', 'Patients waiting and GPs online, by hour');
  expect(within(daily).getByText('Today')).toBeInTheDocument();
  expect(within(daily).getByText('Earlier days')).toBeInTheDocument();
  expect(within(demand).getByText('Patients waiting')).toBeInTheDocument();
  expect(within(demand).getByText('GPs online')).toBeInTheDocument();

  expect(values(section('Offers today'))).toEqual(['4', '3', '1']);

  const table = screen.getByRole('table');
  expect(table.querySelector('caption')).toHaveTextContent("Today's consultations");
  const rows = table.querySelectorAll('tbody tr');
  expect(rows).toHaveLength(5);
  expect(rows[0].querySelector('th[scope="row"]')).toHaveTextContent('C-0031');
  expect(rows[0]).toHaveTextContent('9 min');
  expect([...rows].every((r) => r.lastElementChild?.textContent === '£39')).toBe(true);

  const perf = section('How you are doing');
  expect(values(perf)).toEqual(['86%', '9 min']);
  expect(within(perf).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '86');
  expect(container.textContent).not.toMatch(/\brating\b/i);
});

test('the tile switch is the availability control: it goes online and navigates to the shift', () => {
  renderHome('data=seeded');
  const toggle = screen.getByRole('switch');
  expect(toggle).toHaveAccessibleName();
  expect(toggle).toHaveAttribute('aria-checked', 'false');
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-checked', 'true');
  expect(nav.router.push).toHaveBeenCalledWith('/doctor/session/online-idle?data=seeded');
  expect(screen.getByRole('heading', { level: 2, name: 'You are online' })).toBeInTheDocument();
  expect(screen.getByText('Taking offers')).toBeInTheDocument();
});

test('"Simulate an offer" goes online first and lands on the offer in one navigation', () => {
  renderHome('data=seeded');
  fireEvent.click(screen.getByRole('button', { name: 'Simulate an offer' }));
  // Both actions dispatch in one handler; the URL follows once, to the offer.
  expect(nav.router.push.mock.calls.map(([href]) => href)).toEqual(['/doctor/session/offer?data=seeded']);
  expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
});

test('a blocking gate replaces the dashboard', () => {
  for (const id of ['indemnity-expired', 'verification-pending', 'verification-rejected'] as const) {
    const { container, unmount } = renderHome(`gate=${id}&data=seeded`);
    expect(container.querySelector(`[data-screen="${id}"]`)).toBeInTheDocument();
    expect(container.querySelector('[data-screen="dashboard"]')).toBeNull();
    unmount(); cleanup();
  }
});

test('the revalidation gate is a banner above the dashboard, and the list does not repeat it', () => {
  const { container } = renderHome('gate=revalidation-due&data=seeded');
  const banner = container.querySelector<HTMLElement>('[data-gate="revalidation-due"]')!;
  expect(banner).toHaveAttribute('data-slot', 'alert');
  expect(banner).toHaveTextContent('Revalidation due soon');
  expect(banner).toHaveTextContent('18 days until your GMC revalidation is due');
  expect(within(banner).getByRole('link', { name: 'See all credentials' })).toHaveAttribute('href', '/doctor/profile');
  expect(container.querySelector('[data-screen="dashboard"]')).toBeInTheDocument();
  expect(container.querySelector('[data-screen="indemnity-expired"]')).toBeNull();
  const titles = [...container.querySelectorAll('[role="list"] [data-slot="alert-title"]')].map((t) => t.textContent);
  expect(titles).toEqual(['Indemnity cover expires in 9 days.', 'DBS check expires in 12 days.']);
  expect(container.querySelector('[data-slot="alert-count"]')).toHaveTextContent('2 to sort');
  expect(container.textContent?.match(/GMC revalidation/g)).toHaveLength(1);
});

test('every table has a caption and scoped headers, and no route shows two band cards', () => {
  for (const query of ['', 'data=seeded', 'gate=revalidation-due&data=seeded']) {
    const { container, unmount } = renderHome(query);
    const tables = container.querySelectorAll('table');
    expect(tables.length).toBeGreaterThan(0);
    for (const table of tables) {
      expect(table.querySelector('caption')).not.toBeNull();
      for (const th of table.querySelectorAll('th')) expect(th).toHaveAttribute('scope');
    }
    expect(container.querySelectorAll('[data-slot="card"][data-variant="band"]').length).toBeLessThanOrEqual(1);
    unmount(); cleanup();
  }
});
```

Run: `npx vitest run tests/doctor-dashboard.test.tsx` → fails with `Cannot find module '@/components/doctor/DoctorHome'`.

- [ ] **Step 2: The `Gate` stub — only if Task 15 has not run**

```bash
ls components/doctor/Gate.tsx
```
If the file exists, skip this step: Task 15's `Gate` already carries `data-screen` on its root and takes `id`. If it does not, create `components/doctor/Gate.tsx` so `DoctorHome` and its tests do not depend on task order. Task 15 replaces this file wholesale.

```tsx
/* Temporary: Task 15 replaces this file. Until then /doctor can render the
   three blocking gates by heading alone, so DoctorHome does not wait on it. */
import { PageHeader } from '@/components/app/PageHeader';
import type { GateId } from '@/lib/fixtures';

// preview/doctor.html:475, 485, 492, 518
const TITLES: Record<GateId, string> = {
  'verification-pending': 'Credentials under review',
  'verification-rejected': "We couldn't verify a credential",
  'indemnity-expired': "You can't go online",
  'revalidation-due': 'Revalidation due soon',
};

export function Gate({ id }: { id: GateId }) {
  return (
    <section data-screen={id} data-gate={id}>
      <PageHeader title={TITLES[id]} />
    </section>
  );
}
```

> **This file and `DoctorHome` are both replaced by Task 15**, which builds the four
> gates in full and narrows the prop to `GateScreen` (the three that replace the
> dashboard; `revalidation-due` is a banner). Task 15's `RevalidationBanner` takes
> **no props** — it reads the record from the provider — so the `days` prop below is
> temporary too. Everything here exists only so Task 14 can be executed, reviewed
> and committed on its own.

- [ ] **Step 3: `components/doctor/Dashboard.tsx`**

Copy sources: `preview/doctor.html:38-166` for every label, heading and column; `preview/js/doctor.js:109-112` (shift tiles), `122-132` (fortnight and payout), `136-154` (alerts), `158-192` (charts), `198-200` (offers), `204-209` (table), `222-224` (performance). Ratings are gone (Decision 5). Alerts are a list with the preview's icons (Decisions 12, 28). Charts are the Task 10 components with solid-token marks and a legend only when a chart is drawn (Decision 24). `data-reveal` sits on the first tile row only (Decision 13).

```tsx
'use client';
/* The dashboard's first job is to say whether the GP is taking offers and
   what needs sorting before they can; below that is the fortnight in figures.
   Every number passes through shown() or live(): blank mode is honest dashes
   and written empty states, and a consultation this session completed moves
   today's figures by exactly one fee. */
import Link from 'next/link';
import { ClockIcon, TriangleAlertIcon } from 'lucide-react';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { BarChart } from '@/components/app/BarChart';
import { ChartLegend } from '@/components/app/ChartLegend';
import { EmptyState } from '@/components/app/EmptyState';
import { LineChart } from '@/components/app/LineChart';
import { PageHeader } from '@/components/app/PageHeader';
import { StatTile } from '@/components/app/StatTile';
import { AvailabilityControl } from '@/components/doctor/AvailabilityControl';
import { useDoctor } from '@/components/doctor/DoctorProvider';
import { useSession } from '@/components/doctor/SessionProvider';
import { alertSentence, type CredentialAlert } from '@/lib/alerts';
import { useFigures } from '@/lib/data-mode';
import { earningsFor } from '@/lib/earnings';
import { DEMAND_BY_HOUR, DOCTOR, DOCTOR_DASHBOARD as D, FEE, type CredentialKey } from '@/lib/fixtures';
import { minutesLabel, money, percent } from '@/lib/format';

// preview/js/doctor.js:136. The preview sent revalidation to its own state
// screen; that is a ?gate= development state now (Decision 1), not a product
// destination, so revalidation goes where every other key goes: the profile.
const FIX_HREF: Partial<Record<CredentialKey, string>> = {
  indemnity: '/doctor/onboarding/indemnity',
  dbs: '/doctor/onboarding/credentials',
};
const fixHref = (key: CredentialKey) => FIX_HREF[key] ?? '/doctor/profile';

const BLOCKING_NOTE = 'You cannot take a consultation once this lapses.';

const DEMAND_SETS = [
  { key: 'waiting', values: DEMAND_BY_HOUR.map((h) => h.waiting) },
  { key: 'gps', values: DEMAND_BY_HOUR.map((h) => h.gps) },
];
const DEMAND_LABELS = DEMAND_BY_HOUR.map((h) => h.hour);

// Decision 26: section h2s are headline-md, the same face as CardTitle.
const H2 = 'mb-4 font-display text-xl leading-[1.3] font-semibold tracking-[-.02em]';
// TableHead is the column-header face (label-caps); a row header reads as a cell.
const ROW_HEAD = 'p-3 text-left align-middle font-semibold whitespace-nowrap';
const CAN_TAKE_OFFER = new Set(['offline', 'online-idle', 'no-patients-waiting']);

export function Dashboard() {
  const { gate, alerts: everyAlert } = useDoctor();
  const { state, act, secondsOnline } = useSession();
  const { seeded, DASH, shown, live } = useFigures();
  const e = earningsFor({ seeded, session: state.completed });

  // Decision 28: with the revalidation banner above, the list must not say it twice.
  const alerts = gate === 'revalidation-due' ? everyAlert.filter((a) => a.key !== 'revalidation') : everyAlert;

  // The fixture's 42 minutes plus whatever this session has added; blank mode has only the session.
  const minutesOnline = (seeded ? DOCTOR.shift.minutesOnline : 0) + Math.floor(secondsOnline / 60);
  const meter = e.fortnightConsults > 0 ? Math.round((e.weekConsults / e.fortnightConsults) * 100) : 0;
  const method = D.payout.method.toLowerCase();

  // The prototype affordance (Decision 4): from offline it goes online first, then the offer
  // arrives. Both dispatch in one handler, so the URL follows once, to the offer.
  const simulate = () => {
    const now = Date.now();
    if (state.screen === 'offline') act({ type: 'goOnline', now }, { navigate: true });
    act({ type: 'offerArrives', consent: true, now }, { navigate: true });
  };

  return (
    <section data-screen="dashboard">
      <PageHeader
        title="Today"
        actions={
          <Button type="button" onClick={simulate} disabled={!CAN_TAKE_OFFER.has(state.screen)}>
            Simulate an offer
          </Button>
        }
      />

      <div className="grid grid-cols-6 gap-4 max-cols:grid-cols-1" data-stagger>
        {/* Decision 22: the one band card on this screen. */}
        <Card variant="band" className="band-grid col-span-4 min-h-55 justify-end max-cols:col-span-full" data-reveal>
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>{state.online ? 'You are online' : 'You are offline'}</CardTitle>
            <CardAction className="text-fine text-band-ink-2">{state.online ? 'Taking offers' : 'Not taking offers'}</CardAction>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 max-phone:grid-cols-2">
              <StatTile size="sm" label="Patients waiting" value={shown(DOCTOR.shift.patientsWaiting)} />
              <StatTile size="sm" label="GPs online vs needed" value={shown(DOCTOR.shift.gpsOnline, (n) => `${n} of ${DOCTOR.shift.gpsNeeded}`)} />
              <StatTile size="sm" label="Time online today" value={live(minutesOnline, minutesLabel)} />
              <StatTile size="sm" label="Earned today" value={live(e.today, money)} />
            </div>
            <div className="mt-6">
              <AvailabilityControl variant="navigate" />
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-2 min-h-55 justify-end max-cols:col-span-full" data-reveal>
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>Next payout</CardTitle>
          </CardHeader>
          <CardContent>
            <StatTile
              size="lg"
              label={e.weekConsults > 0 ? `Paid ${D.payout.date}` : 'Nothing to pay out yet'}
              value={live(e.payoutAmount, money)}
            />
            <Progress className="mt-4" value={meter} aria-labelledby="payout-note" />
            <p id="payout-note" className="mt-2 text-fine text-ink-2">
              {e.weekConsults > 0
                ? `${e.weekConsults} consultation${e.weekConsults === 1 ? '' : 's'} at ${money(FEE)} each, by ${method}.`
                : `Paid by ${method} at ${money(FEE)} per completed consultation.`}
            </p>
          </CardContent>
        </Card>

        <Card className="col-span-full" data-reveal>
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>Before you go online</CardTitle>
            <CardAction className="text-fine text-ink-2">
              <span data-slot="alert-count">
                {alerts.length === 0 ? (seeded ? 'All clear' : DASH) : `${alerts.length} to sort`}
              </span>
            </CardAction>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <EmptyState>
                {seeded
                  ? 'Nothing needs you. Every credential is valid for more than a month.'
                  : 'No credentials on file yet. Add them and anything close to lapsing appears here.'}
              </EmptyState>
            ) : (
              <div role="list" className="grid gap-2">
                {alerts.map((alert) => <CredentialAlertItem key={alert.key} alert={alert} />)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="mt-12">
        <h2 className={H2}>Consultations, last 14 days</h2>
        <Card>
          <CardContent>
            <div className="mb-6 grid grid-cols-3 gap-4 max-phone:grid-cols-1">
              <StatTile size="sm" label="Consultations" value={live(e.fortnightConsults)} />
              <StatTile size="sm" label="Earned" value={live(e.fortnight, money)} />
              <StatTile size="sm" label="Busiest day" value={live(e.busiest, (b) => `${b.label} Aug · ${b.consults}`)} />
            </div>
            {e.fortnightConsults > 0 ? (
              <>
                <BarChart data={e.dailySeries} height={150} format={(v) => `${v} consultations`} ariaLabel="Consultations, last 14 days" />
                <ChartLegend items={[{ label: 'Today', swatch: 'primary' }, { label: 'Earlier days', swatch: 'outline' }]} />
              </>
            ) : (
              <EmptyState>No consultations yet.</EmptyState>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-12">
        <h2 className={H2}>When it is worth being online</h2>
        <Card>
          <CardContent>
            {seeded ? (
              <>
                <LineChart sets={DEMAND_SETS} labels={DEMAND_LABELS} height={150} ariaLabel="Patients waiting and GPs online, by hour" />
                <ChartLegend items={[{ label: 'Patients waiting', swatch: 'primary' }, { label: 'GPs online', swatch: 'ink-2' }]} />
              </>
            ) : (
              <EmptyState>No demand recorded yet.</EmptyState>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-12">
        <h2 className={H2}>Offers today</h2>
        <div className="grid grid-cols-3 gap-4 max-phone:grid-cols-1">
          <Card><CardContent><StatTile size="lg" label="Offers received" value={shown(D.offersToday.offered)} /></CardContent></Card>
          <Card><CardContent><StatTile size="lg" label="Accepted" value={shown(D.offersToday.accepted)} /></CardContent></Card>
          <Card><CardContent><StatTile size="lg" label="Declined — passed to another GP" value={shown(D.offersToday.declined)} /></CardContent></Card>
        </div>
      </section>

      <section className="mt-12">
        <h2 className={H2}>Today's consultations</h2>
        <Card>
          <Table>
            <TableCaption className="sr-only">Today's consultations</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Reference</TableHead>
                <TableHead scope="col">When</TableHead>
                <TableHead scope="col">Age band</TableHead>
                <TableHead scope="col">Length</TableHead>
                <TableHead scope="col">Outcome</TableHead>
                <TableHead scope="col">Fee</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {e.recent.length === 0 ? (
                <TableRow>
                  <th scope="row" className={ROW_HEAD}>{DASH}</th>
                  <TableCell colSpan={5} className="whitespace-normal text-ink-2">No consultations today.</TableCell>
                </TableRow>
              ) : (
                e.recent.map((c) => (
                  <TableRow key={c.id} data-new={'isNew' in c ? 'true' : undefined} className={'isNew' in c ? 'font-semibold' : undefined}>
                    <th scope="row" className={ROW_HEAD}>{c.id}</th>
                    <TableCell>{c.when}</TableCell>
                    <TableCell>{c.ageBand}</TableCell>
                    <TableCell className="tabular-nums">{c.minutes} min</TableCell>
                    <TableCell>{c.outcome}</TableCell>
                    <TableCell className="tabular-nums">{money(FEE)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </section>

      <section className="mt-12">
        <h2 className={H2}>How you are doing</h2>
        <div className="grid grid-cols-2 gap-4 max-phone:grid-cols-1">
          <Card>
            <CardContent>
              <StatTile size="lg" label="Offers accepted" value={shown(D.acceptanceRate, percent)} />
              <Progress className="mt-4" value={seeded ? Math.round(D.acceptanceRate * 100) : 0} aria-label="Offers accepted" />
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <StatTile size="lg" label="Average consultation" value={shown(D.averageConsultMinutes, (m) => `${m} min`)} />
            </CardContent>
          </Card>
        </div>
      </section>
    </section>
  );
}

// Decision 28: a list item, not a live region; the preview's icon split
// (doctor.js:144); accent for blocking and act, default for watch (Decision 12).
function CredentialAlertItem({ alert }: { alert: CredentialAlert }) {
  const Icon = alert.tone === 'blocking' ? TriangleAlertIcon : ClockIcon;
  return (
    <Alert role="listitem" variant={alert.tone === 'watch' ? 'default' : 'accent'} data-tone={alert.tone}>
      <Icon strokeWidth={2} />
      <AlertTitle>{alertSentence(alert)}</AlertTitle>
      {alert.tone === 'blocking' && <AlertDescription>{BLOCKING_NOTE}</AlertDescription>}
      <AlertAction>
        <Button asChild size="xs" variant="secondary">
          <Link href={fixHref(alert.key)}>
            Fix<span className="sr-only"> {alert.label}</span>
          </Link>
        </Button>
      </AlertAction>
    </Alert>
  );
}
```

Notes on choices the code does not explain: `min-h-55` is the preview's 220px `card--bottom` on the 4px scale; the bento is the preview's six columns collapsing to one below 900 (`max-cols:`), its inner tile rows to two or one below 560 (`max-phone:`); `Alert` spreads props after its own `role="alert"`, so `role="listitem"` wins; the row header is a plain `<th scope="row">` because `TableHead` is the uppercase column-header face; `data-new` marks a session record's row and the row is bold — that is the whole mark, nothing coloured.

- [ ] **Step 4: `components/doctor/DoctorHome.tsx`**

Copy source for the banner: `preview/doctor.html:517-522` verbatim, with the `revalidationDueInDays` figure from the record the gate selected (Decision 1) — the preview rendered it without `shown()` on purpose (`doctor.js:300-301`), and it does the same here in both modes.

```tsx
'use client';
/* /doctor is the dashboard unless the credential record says otherwise. Three
   gates replace it outright; the fourth is a warning that sits above it. */
import Link from 'next/link';
import { ClockIcon } from 'lucide-react';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dashboard } from '@/components/doctor/Dashboard';
import { useDoctor } from '@/components/doctor/DoctorProvider';
import { Gate } from '@/components/doctor/Gate';
import { DOCTOR } from '@/lib/fixtures';
import { daysLabel } from '@/lib/format';

export function DoctorHome() {
  const { gate, record } = useDoctor();
  if (gate === 'indemnity-expired' || gate === 'verification-pending' || gate === 'verification-rejected') {
    return <Gate id={gate} />;
  }
  return (
    <>
      {gate === 'revalidation-due' && (
        <RevalidationBanner days={record.revalidation.daysRemaining ?? DOCTOR.revalidationDueInDays} />
      )}
      <Dashboard />
    </>
  );
}

// preview/doctor.html:517-522 — the one gate that warns rather than blocks.
// It mounts after hydration (the gate is read from the URL post-mount), so the
// Alert's own role announces it once, which is what a gate should do.
function RevalidationBanner({ days }: { days: number }) {
  return (
    <Alert variant="accent" data-gate="revalidation-due" className="mb-8">
      <ClockIcon strokeWidth={2} />
      <AlertTitle>Revalidation due soon</AlertTitle>
      <AlertDescription>
        <p>
          <span className="font-display font-semibold text-ink tabular-nums">{daysLabel(days)}</span> until your GMC revalidation is due
        </p>
        <p>Submit your revalidation portfolio through the GMC before this date, or you won't be able to take further shifts.</p>
      </AlertDescription>
      <AlertAction>
        <Button asChild size="sm" variant="secondary">
          <Link href="/doctor/profile">See all credentials</Link>
        </Button>
      </AlertAction>
    </Alert>
  );
}
```

- [ ] **Step 5: `app/(app)/doctor/page.tsx`**

Replace Task 13's placeholder with the whole file:

```tsx
import { DoctorHome } from '@/components/doctor/DoctorHome';

export const dynamic = 'force-static';

// The dashboard, or the gate the credential record demands. Which record is
// on screen comes from ?gate=, read after mount (Decision 1), so the static
// shell is always the dashboard and a gate lands on hydration.
export default function Page() {
  return <DoctorHome />;
}
```

- [ ] **Step 6: Run everything**

```bash
npx vitest run tests/doctor-dashboard.test.tsx
```
Expected: 7 tests pass (blank, seeded, switch, simulate, blocking gates, revalidation banner, table/band sweep).

```bash
npm test
npm run typecheck
NEXT_PUBLIC_SITE_URL=http://localhost:3000 npm run build
grep -rinwE 'schedule|rota|calendar' 'app/(app)/doctor' components/doctor ; echo "exit $?"
grep -rnE 'dark:|oklch\(|hsl\(|#[0-9a-fA-F]{3,8}\b' components/doctor 'app/(app)/doctor' ; echo "exit $?"
```
Expected: all three green (`tests/constraints.test.ts` scans the three new files: no hex, no `dark:`, no medicine, no banned wording); both greps print nothing and `exit 1`. The build's route table lists `/doctor` as static (`○`). If Task 15 has already landed, `git status` must show `components/doctor/Gate.tsx` untouched.

- [ ] **Step 7: Commit**

```bash
git add components/doctor/Dashboard.tsx components/doctor/DoctorHome.tsx 'app/(app)/doctor/page.tsx' tests/doctor-dashboard.test.tsx
git add components/doctor/Gate.tsx   # only if Step 2 created the stub
git commit -m "feat(doctor): the dashboard

/doctor renders the preview's bento — the availability tile as the one band
card with its switch, next payout, the credential alerts as a list with the
blocking note, the fortnight and demand charts, offers, today's consultations
and the two performance tiles (no rating). Every figure passes through
shown() or live(), so blank mode is dashes and written empty states and a
completed consultation moves today's figures by one fee. DoctorHome swaps
the dashboard for a gate when the record demands one and places the
revalidation warning above it, filtered out of the list so it is said once.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: The four credential gates

> Contract notes. (1) The brief puts "the disabled AvailabilityControl" inside the indemnity gate's band card; the contract gives `AvailabilityControl` no props and it is written for the white top bar, so this task extends the contract with `AvailabilityControl({ onBand?: boolean })` and ids from `useId()` (two instances share the page), edited into the plan in the same commit — the contract wins on every other name. (2) `revalidation-due` is not a screen: it has no `data-screen`; the three real gates do. (3) Decision 28's filter (`key === 'revalidation'` dropped from the "Before you go online" list while the banner shows) lives in Task 14's `Dashboard`; this task's test is the one that proves it, and Step 5 gives the exact line if Task 14 left it out. (4) The gate matrices render their statuses in both data modes (`seeded` forced on), as the preview's static pills did (`doctor.html:476-494`) — a gate whose rows all read "Not submitted" would contradict its own heading; the only figure on any gate, days to revalidation, goes through `live()` as the preview kept its number in both modes (`doctor.js:300-301`).

**Files:**
- Create: `components/doctor/Gate.tsx`
- Modify: `components/doctor/DoctorHome.tsx` (Task 14 left it rendering `<Dashboard />` for every record; replaced whole), `components/doctor/AvailabilityControl.tsx` (Task 13; `onBand` prop, ids from `useId()`), `docs/superpowers/plans/2026-09-02-doctor-admin-surfaces.md` (the contract line for `AvailabilityControl`)
- Test: `tests/doctor-gates.test.tsx`
- Read: `preview/doctor.html:474-522`, `preview/js/doctor.js:293-301`, `lib/alerts.ts` (`gateFor`, `CREDENTIAL_KEYS`, `CREDENTIAL_LABELS`), `lib/fixtures.ts` (`GATE_RECORDS`, `MY_RECORD`), `components/app/{CredentialMatrix,StatusBadge,StatTile,PageHeader}.tsx`, `components/doctor/{DoctorProvider,AvailabilityControl,DoctorHome,Dashboard}.tsx`, `components/ui/{card,alert,button}.tsx`, `tests/helpers/{render-doctor.tsx,next-navigation.ts,dom-stubs.ts}`

**Interfaces:**
- Consumes: `useDoctor()` → `{ record, gate }` (Task 13); `AvailabilityControl` (Task 13, gains `onBand`); `Dashboard` (Task 14 — reads `useDoctor().gate` and, per Decision 28, filters `key === 'revalidation'` out of its alerts list when the gate is `revalidation-due`; its root carries `data-screen="dashboard"`); `useFigures().live` (Task 4); `CredentialMatrix record seeded caption keys? stack?="phone"`, `StatusBadge status onBand?`, `StatTile label value size`, `PageHeader title` (Tasks 9, 11); `CREDENTIAL_KEYS`, `CREDENTIAL_LABELS` and the types `CredentialRecord`, `CredentialKey`, `GateId` (Task 3); `daysLabel` (Task 2); `onboardingHref` (Task 7); `Card`, `CardContent`, `Alert`, `AlertTitle`, `AlertDescription`, `Button` (`components/ui`); `text-headline` / `text-headline-sm` (Task 9, Decision 26); `.band-grid` (`app/globals.css`); `renderDoctor` (`tests/helpers/render-doctor.tsx`), `resetNav` (`tests/helpers/next-navigation.ts`), `installDomStubs` (`tests/helpers/dom-stubs.ts`) (Task 4); `app/(app)/doctor/layout.tsx` (Task 13) for the one test that needs the top bar's control on the page.
- Produces: from `components/doctor/Gate.tsx` — `export type GateScreen = Exclude<GateId, 'revalidation-due'>`, `export function Gate({ id }: { id: GateScreen })`, `export function RevalidationBanner()`; `components/doctor/DoctorHome.tsx` finalised (`export function DoctorHome()`); the contract extension `AvailabilityControl({ onBand?: boolean })`; stable markers `section[data-screen="verification-pending"]`, `section[data-screen="verification-rejected"]`, `section[data-screen="indemnity-expired"]` and the banner `[data-slot="alert"][role="status"]`. Task 28's screenshot script and Task 26's sweeps select on these.

- [ ] **Step 1: Write the gate tests first, against `DoctorHome`, and watch six of the seven fail**

`tests/doctor-gates.test.tsx`:

```tsx
// @vitest-environment jsdom
import { test, expect, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
vi.mock('next/navigation', () => import('./helpers/next-navigation'));
import { renderDoctor } from './helpers/render-doctor';
import { resetNav } from './helpers/next-navigation';
import { installDomStubs } from './helpers/dom-stubs';
import { DoctorHome } from '@/components/doctor/DoctorHome';
import DoctorLayout from '@/app/(app)/doctor/layout';
import { CREDENTIAL_LABELS } from '@/lib/alerts';

beforeEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const GATE_SCREENS = ['verification-pending', 'verification-rejected', 'indemnity-expired'] as const;
const gateSections = (root: HTMLElement) =>
  GATE_SCREENS.map((id) => root.querySelector(`[data-screen="${id}"]`)).filter(Boolean);
const bandCards = (root: HTMLElement) => root.querySelectorAll('[data-slot="card"][data-variant="band"]');

// renderDoctor wraps render() in act(), so the effect that reads ?gate= after
// mount and the re-render it schedules have both run by the time it returns.
const home = (query?: string) => renderDoctor(<DoctorHome />, { pathname: '/doctor', query });

test('no query: the dashboard, no gate, no banner', () => {
  const { container } = home();
  expect(container.querySelector('[data-screen="dashboard"]')).toBeInTheDocument();
  expect(gateSections(container)).toEqual([]);
  expect(screen.queryByText('Revalidation due soon')).toBeNull();
  expect(bandCards(container).length).toBeLessThanOrEqual(1);
});

test('verification-pending replaces the dashboard with the five onboarding checks and their statuses', () => {
  const { container } = home('gate=verification-pending');
  const section = container.querySelector<HTMLElement>('[data-screen="verification-pending"]')!;
  expect(section).toBeInTheDocument();
  expect(container.querySelector('[data-screen="dashboard"]')).toBeNull();
  expect(within(section).getByRole('heading', { level: 1 })).toHaveTextContent('Credentials under review');

  const rows = [...section.querySelectorAll('tbody tr')];
  expect(rows).toHaveLength(5);
  const labels = (['gmc', 'licence', 'cct', 'dbs', 'rightToWork'] as const).map((k) => CREDENTIAL_LABELS[k]);
  rows.forEach((row, i) => expect(row).toHaveTextContent(labels[i]));
  expect(section.querySelectorAll('[data-status="pending"]')).toHaveLength(4);
  expect(section.querySelector('[data-status="valid"]')).toHaveTextContent('Verified');
  expect(section.querySelector('table caption')).toBeInTheDocument();
  for (const th of section.querySelectorAll('th')) expect(th).toHaveAttribute('scope');

  expect(section).toHaveTextContent("We'll email you once every check clears.");
  expect(section.textContent).not.toMatch(/two working days/);   // Decision 29
  expect(bandCards(container)).toHaveLength(0);
});

test('verification-rejected shows only the rejected check, with its own status, and one way back', () => {
  const { container } = home('gate=verification-rejected');
  const section = container.querySelector<HTMLElement>('[data-screen="verification-rejected"]')!;
  expect(section).toBeInTheDocument();
  expect(within(section).getByRole('heading', { level: 1 })).toHaveTextContent("We couldn't verify a credential");
  const rows = section.querySelectorAll('tbody tr');
  expect(rows).toHaveLength(1);
  expect(rows[0]).toHaveTextContent('DBS check');
  expect(section.querySelector('[data-status="rejected"]')).toHaveTextContent('Rejected');
  expect(section.querySelector('[data-status="expired"]')).toBeNull();
  expect(section).toHaveTextContent(
    'Your DBS certificate could not be confirmed. Upload a new certificate, issued within the last 12 months, to continue.',
  );
  expect(within(section).getByRole('link', { name: 'Resubmit credentials' }))
    .toHaveAttribute('href', '/doctor/onboarding/credentials');
  expect(bandCards(container)).toHaveLength(0);
});

test('indemnity-expired is one band card: the online control is disabled and says why, the single action renews cover', () => {
  const { container } = home('gate=indemnity-expired');
  const section = container.querySelector<HTMLElement>('[data-screen="indemnity-expired"]')!;
  expect(section).toBeInTheDocument();
  expect(container.querySelector('[data-screen="dashboard"]')).toBeNull();
  expect(bandCards(container)).toHaveLength(1);
  expect(within(section).getByRole('heading', { level: 1 })).toHaveTextContent("You can't go online");

  const control = within(section).getByRole('switch');
  expect(control).toBeDisabled();
  expect(control).toHaveAttribute('aria-checked', 'false');
  expect(section.textContent).toMatch(/indemnity/i);
  expect(section.querySelector('[data-status="expired"]')).toHaveTextContent('Expired');

  expect(within(section).getByRole('link', { name: 'Renew indemnity cover' }))
    .toHaveAttribute('href', '/doctor/onboarding/indemnity');
  expect(within(section).getAllByRole('link')).toHaveLength(1);   // the single action
});

test('in the real layout both availability controls — top bar and gate — are disabled, and no id is shared', () => {
  installDomStubs();
  resetNav('/doctor');
  window.history.replaceState(null, '', '/doctor?gate=indemnity-expired');
  const { container } = render(<DoctorLayout><DoctorHome /></DoctorLayout>);
  const switches = screen.getAllByRole('switch');
  expect(switches).toHaveLength(2);
  for (const s of switches) expect(s).toBeDisabled();
  const ids = [...container.querySelectorAll('[id]')].map((el) => el.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(bandCards(container)).toHaveLength(1);
  expect(container.querySelector('[data-slot="ribbon"]')).toBeInTheDocument();
});

test('revalidation-due is a banner on the dashboard, not a gate', () => {
  const { container } = home('gate=revalidation-due');
  expect(container.querySelector('[data-screen="dashboard"]')).toBeInTheDocument();
  expect(gateSections(container)).toEqual([]);

  const banner = container.querySelector<HTMLElement>('[data-slot="alert"][role="status"]')!;
  expect(banner).toBeInTheDocument();
  expect(banner).toHaveTextContent('Revalidation due soon');
  expect(banner.querySelector('[data-slot="stat-value"]')).toHaveTextContent('18 days');
  expect(banner).toHaveTextContent('until your GMC revalidation is due');
  expect(banner).toHaveTextContent(
    "Submit your revalidation portfolio through the GMC before this date, or you won't be able to take further shifts.",
  );
  expect(within(banner).getByRole('link', { name: 'See all credentials' })).toHaveAttribute('href', '/doctor/profile');
  expect(banner.querySelector('svg')).toHaveAttribute('stroke-width', '2');
  expect(bandCards(container).length).toBeLessThanOrEqual(1);
});

test("seeded, the banner is the list's revalidation entry: the sentence appears once", () => {
  const { container } = home('gate=revalidation-due&data=seeded');
  expect(container.querySelectorAll('[data-slot="alert"][role="status"]')).toHaveLength(1);
  const items = [...container.querySelectorAll('[role="list"] [role="listitem"]')];
  expect(items).toHaveLength(2);                                   // indemnity (blocking) and DBS (act) stay
  for (const item of items) expect(item.textContent).not.toMatch(/revalidation/i);
  expect(screen.getAllByText(/18 days/)).toHaveLength(1);
});
```

Run: `npx vitest run tests/doctor-gates.test.tsx` → 1 passes (no query), 6 fail: the three gate sections are missing, the layout test finds one switch not two, and neither revalidation test finds `[data-slot="alert"][role="status"]`.

- [ ] **Step 2: Extend the contract — `AvailabilityControl` gains `onBand` and reads its ids from `useId()`**

In `docs/superpowers/plans/2026-09-02-doctor-admin-surfaces.md`, "Providers (Task 12)" block, old:

```tsx
export function DoctorProviders({ children })          // <DataModeProvider><DoctorProvider><SessionProvider><OnboardingProvider>
```

new:

```tsx
export function DoctorProviders({ children })          // <DataModeProvider><DoctorProvider><SessionProvider><OnboardingProvider>
// components/doctor/AvailabilityControl.tsx
export function AvailabilityControl({ onBand }: { onBand?: boolean })   // Label + Switch + role="status" line; ids from useId() (the indemnity gate mounts a second instance beside the top bar's); onBand → white label, band-ink-2 state line
```

In `components/doctor/AvailabilityControl.tsx` the control keeps Task 13's structure (the accessibility floor and design review #20 fix it: a `Label`, the `Switch`, a `role="status"` line that carries the reason when blocked). Three things change. Old (Task 13's form):

```tsx
export function AvailabilityControl() {
  …
      <Label htmlFor="availability">Availability</Label>
      <Switch id="availability" aria-describedby="availability-state" … />
      <p id="availability-state" role="status" className="text-fine text-ink-2">…</p>
```

new:

```tsx
export function AvailabilityControl({ onBand = false }: { onBand?: boolean }) {
  const id = useId();   // the indemnity gate mounts a second instance beside the top bar's
  …
      <Label htmlFor={id} className={cn(onBand && 'text-white')}>Availability</Label>
      <Switch id={id} aria-describedby={`${id}-state`} … />
      <p id={`${id}-state`} role="status" className={cn('text-fine', onBand ? 'text-band-ink-2' : 'text-ink-2')}>…</p>
```

(`useId` joins the `react` import; `cn` from `@/lib/utils`. If Task 13 already read its ids from `useId()`, only the colour threading is new.) The layout test in Step 1 is what proves the ids no longer collide.

- [ ] **Step 3: `components/doctor/Gate.tsx`**

```tsx
'use client';
/* The three screens that stand in for the dashboard while the credential
   record says the GP cannot work: two verification holds and the indemnity
   hard stop. Each renders from the record the URL selected (Decision 1), so a
   gate can never disagree with the alerts derived from the same record. The
   statuses are the reason these screens exist, so they show in both data
   modes, as the preview's static pills did (doctor.html:476-494); the only
   figure on any of them, days to revalidation, goes through live().
   RevalidationBanner is the fourth "gate": a warning on the dashboard, not a
   screen. */
import Link from 'next/link';
import { ClockIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CredentialMatrix } from '@/components/app/CredentialMatrix';
import { PageHeader } from '@/components/app/PageHeader';
import { StatTile } from '@/components/app/StatTile';
import { StatusBadge } from '@/components/app/StatusBadge';
import { CREDENTIAL_KEYS, CREDENTIAL_LABELS } from '@/lib/alerts';
import { useFigures } from '@/lib/data-mode';
import type { CredentialKey, CredentialRecord, GateId } from '@/lib/fixtures';
import { daysLabel } from '@/lib/format';
import { onboardingHref } from '@/lib/onboarding';
import { AvailabilityControl } from './AvailabilityControl';
import { useDoctor } from './DoctorProvider';

export type GateScreen = Exclude<GateId, 'revalidation-due'>;

// preview/doctor.html:476-480 — the five checks onboarding verifies, in that order.
const ONBOARDING_KEYS: CredentialKey[] = ['gmc', 'licence', 'cct', 'dbs', 'rightToWork'];

export function Gate({ id }: { id: GateScreen }) {
  const { record } = useDoctor();
  if (id === 'indemnity-expired') return <IndemnityExpired record={record} />;
  if (id === 'verification-rejected') return <VerificationRejected record={record} />;
  return <VerificationPending record={record} />;
}

// preview/doctor.html:474-482; the closing sentence loses its service-level claim (Decision 29).
function VerificationPending({ record }: { record: CredentialRecord }) {
  return (
    <section data-screen="verification-pending" className="max-w-[620px]">
      <PageHeader title="Credentials under review" />
      <Card size="sm" className="mt-6">
        <CardContent>
          <CredentialMatrix
            record={record}
            seeded
            caption="Credentials being verified"
            keys={ONBOARDING_KEYS}
            stack="phone"
          />
        </CardContent>
      </Card>
      <p className="mt-6 text-body text-ink-2">We'll email you once every check clears.</p>
    </section>
  );
}

// preview/doctor.html:484-489. The row comes from the record, so whichever check was
// rejected is the one shown; the sentence is the preview's, and the fixture only ever
// rejects the DBS check.
function VerificationRejected({ record }: { record: CredentialRecord }) {
  const rejected = CREDENTIAL_KEYS.filter((key) => record[key].status === 'rejected');
  return (
    <section data-screen="verification-rejected" className="max-w-[620px]">
      <PageHeader title="We couldn't verify a credential" />
      <Card size="sm" className="mt-6">
        <CardContent>
          <CredentialMatrix
            record={record}
            seeded
            caption="Credential that could not be verified"
            keys={rejected}
            stack="phone"
          />
        </CardContent>
      </Card>
      <p className="mt-6 text-body">
        Your DBS certificate could not be confirmed. Upload a new certificate, issued within the last 12 months, to continue.
      </p>
      <Button asChild className="mt-6 w-full">
        <Link href={onboardingHref('credentials')}>Resubmit credentials</Link>
      </Button>
    </section>
  );
}

// preview/doctor.html:491-497. The screen's one band card (Decision 22): the hard
// stop, its reason, the disabled control, the one way out.
function IndemnityExpired({ record }: { record: CredentialRecord }) {
  return (
    <section data-screen="indemnity-expired">
      <Card variant="band" className="band-grid">
        <CardContent className="flex flex-col gap-6">
          {/* Not PageHeader: its lead is ink-2, which vanishes on the band. */}
          <div className="max-w-[52ch]">
            <h1 className="text-headline max-phone:text-headline-sm">You can't go online</h1>
            <p className="mt-3 text-lg text-band-ink-2">
              Your indemnity cover expired. State-backed NHS indemnity does not cover private telehealth, so you cannot lawfully take a consultation until it's renewed.
            </p>
          </div>
          <div className="flex items-center justify-between gap-4 border-y border-white/15 py-3">
            <span className="font-semibold">{CREDENTIAL_LABELS.indemnity}</span>
            <StatusBadge status={record.indemnity.status} onBand />
          </div>
          <AvailabilityControl onBand />
          <Button asChild className="self-start max-phone:self-stretch">
            <Link href={onboardingHref('indemnity')}>Renew indemnity cover</Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}

// preview/doctor.html:517-522. The figure is the record's own days to revalidation,
// through live(): the state exists to show the warning, so it keeps its number in
// both modes (doctor.js:300-301). role="status", not the Alert's default role="alert":
// the banner appears after mount, and a due date is worth a polite announcement,
// not an interruption.
export function RevalidationBanner() {
  const { record } = useDoctor();
  const { live } = useFigures();
  return (
    <Alert variant="accent" role="status" className="mb-6">
      <ClockIcon strokeWidth={2} />
      <AlertTitle>Revalidation due soon</AlertTitle>
      {/* The figure is the message, so the description reads in ink, not the alert's secondary ink-2. */}
      <AlertDescription className="text-ink">
        <StatTile
          size="sm"
          value={live(record.revalidation.daysRemaining, daysLabel)}
          label="until your GMC revalidation is due"
        />
        <p className="mt-3">
          Submit your revalidation portfolio through the GMC before this date, or you won't be able to take further shifts.
        </p>
        <Button variant="secondary" size="sm" asChild>
          <Link href="/doctor/profile">See all credentials</Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
```

Colour census for this file: `text-ink`, `text-ink-2`, `text-band-ink-2`, `border-white/15` (a token at an alpha over the band, never stacked — the badge sits on the band, not on a filled row), and the band itself through `Card variant="band"`. `success`/`error` appear only inside `StatusBadge`. No `data-reveal` outside `PageHeader` (Decision 13). New strings, for the report: the two sr-only captions "Credentials being verified" and "Credential that could not be verified"; the pending sentence shortened per Decision 29.

- [ ] **Step 4: Finalise `components/doctor/DoctorHome.tsx`**

Replace the file whole:

```tsx
'use client';
/* /doctor is the dashboard, or whichever gate the credential record demands.
   The gate arrives through the provider from gateFor(), never from the query
   itself, so this switch and the alerts list always describe one record. The
   server renders the dashboard (the query is read after mount); a gate
   replaces it on the client. */
import { Dashboard } from './Dashboard';
import { useDoctor } from './DoctorProvider';
import { Gate, RevalidationBanner } from './Gate';

export function DoctorHome() {
  const { gate } = useDoctor();
  if (gate === 'revalidation-due') {
    return (
      <>
        <RevalidationBanner />
        <Dashboard />
      </>
    );
  }
  if (gate) return <Gate id={gate} />;
  return <Dashboard />;
}
```

`app/(app)/doctor/page.tsx` (Task 14) already renders `<DoctorHome />` and needs no change.

- [ ] **Step 5: Run the gate tests, then the whole suite, typecheck and build**

Run: `npx vitest run tests/doctor-gates.test.tsx` → 7 passed.

If only "seeded, the banner is the list's revalidation entry" fails on `items` having length 3, Task 14's list is missing Decision 28's filter. In `components/doctor/Dashboard.tsx`, where the "Before you go online" list is built from `useDoctor()`, derive the rendered list as

```tsx
const listed = gate === 'revalidation-due' ? alerts.filter((a) => a.key !== 'revalidation') : alerts;
```

(`gate` and `alerts` both from `useDoctor()`) and map `listed` instead of `alerts`; nothing else in that file changes.

Then: `npm test` → green (`tests/constraints.test.ts` now scans `components/doctor/Gate.tsx`: no hex, no `dark:`, no medicine, and — once Task 26 adds the guard — no `schedule`, `rota` or `calendar` and no `*Calendar*` icon; the copy above contains none). `npm run typecheck` → green. `NEXT_PUBLIC_SITE_URL=http://localhost:3000 npm run build` → `/doctor` still listed as static; the four gate URLs are the same static shell (the query is read after mount), which is Decision 1 working as designed.

Visual check while the dev server is up: `/doctor?gate=indemnity-expired&data=seeded` at 1440 shows one band card with the white h1, the slate-400 lead, the "Indemnity cover — Expired" row with a `bg-white/15` badge, the greyed switch with its reason in slate-400, and the primary button; `/doctor?gate=verification-pending` shows five rows on a white card within 620px; `/doctor?gate=revalidation-due` shows the accent banner above "Today" with "18 days" in Geist.

- [ ] **Step 6: Commit**

```bash
git add components/doctor/Gate.tsx components/doctor/DoctorHome.tsx components/doctor/AvailabilityControl.tsx docs/superpowers/plans/2026-09-02-doctor-admin-surfaces.md tests/doctor-gates.test.tsx
git commit -m "feat(doctor): the four credential gates

verification-pending and verification-rejected replace the dashboard with
the record's own rows; indemnity-expired is the screen's one band card with
the disabled availability control and the single action; revalidation-due
is a banner on the dashboard whose alerts list drops its duplicate. Every
gate is derived from the record the URL selected, never from the query
itself. AvailabilityControl gains onBand and useId() ids so two instances
can share a page.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: `/doctor/earnings`

> **Note (brief vs placeholder rule):** the brief passes the five session-inclusive figures (next payout, earned to date, consultations completed, earned this week, the chart's presence) through `shown()`; this task uses `live()` for them and keeps `shown()` for the two fixture-only strings (the payout period, the chart's date range). `earningsFor()` already folds this session's consultations into every figure, `live(0)` is the same em dash in blank mode, and `shown()` would print "—" for Next payout while the table beneath it listed the session's £39 row — the spec's placeholder rule says a consultation this session completed appears immediately. Seeded output is identical either way; the sixth test below is the only one that depends on it.

**Files:**
- Create: `components/doctor/Earnings.tsx`
- Modify: `app/(app)/doctor/earnings/page.tsx` (replaces the Task 13 placeholder page)
- Test: `tests/doctor-earnings.test.tsx`
- Read: `preview/doctor.html:168-222`, `preview/js/doctor.js:114-132, 226-240`, `lib/earnings.ts`, `lib/fixtures.ts` (`DOCTOR_DASHBOARD.payout`, `dailyConsults`, `recent`), `components/app/{PageHeader,StatTile,EmptyState,BarChart,ChartLegend}.tsx`, `components/ui/card.tsx`, `components/ui/table.tsx`, `components/doctor/SessionProvider.tsx`, `tests/helpers/{render-doctor,dom-stubs,navigation-mock}.ts(x)`

**Interfaces:**
- Consumes: `earningsFor`, `type Earnings` from `@/lib/earnings` (Task 3 — `payoutAmount`, `toDate`, `toDateConsults`, `week`, `weekConsults`, `fortnightConsults`, `recent`, `dailySeries`); `DOCTOR_DASHBOARD` (`payout.period/date/method`, `dailyConsults[].label`) and `FEE` from `@/lib/fixtures` (Task 3); `money` from `@/lib/format` (Task 2); `useFigures()` → `{ seeded, DASH, shown, live }` from `@/lib/data-mode` (Task 4); `useSession()` → `{ state, act }` with `state.completed: SessionRecord[]` from `@/components/doctor/SessionProvider` (Task 13); `PageHeader`, `StatTile` (its label switches to `text-band-ink-2` inside `Card variant="band"` through the card's `group/card` data-variant selector, the `CardDescription` pattern — the Next payout tile relies on it) and `EmptyState` (Task 9); `BarChart`, `ChartLegend` (Task 10); `Card`, `CardHeader`, `CardTitle`, `CardAction`, `CardContent` from `components/ui/card.tsx`; `Table stack="cols"`, `TableCell label` (Task 8) and `TableCaption`, `TableHeader`, `TableHead`, `TableBody`, `TableRow` from `components/ui/table.tsx`; test helpers `renderDoctor`, `nav` (`tests/helpers/render-doctor.tsx`, Task 13), `installDomStubs`, `ResizeObserverStub` (`tests/helpers/dom-stubs.ts`, Task 4) and the `next/navigation` mock module `tests/helpers/navigation-mock.ts` (Task 4).
- Produces: `export function Earnings()` (`'use client'`, no props) in `components/doctor/Earnings.tsx`; the static `/doctor/earnings` route; a root `data-screen="earnings"`; exactly one `Card variant="band"` on the screen (Decision 22); session rows in the payout table carry `data-new="true"`; every table cell's column label is its `data-label` (Task 8). Consumed by Task 26's sweeps (blank digits, band census, captions and `th scope`) and Task 28's screenshot matrix.

- [ ] **Step 1: Write the test first**

`tests/doctor-earnings.test.tsx`:

```tsx
// @vitest-environment jsdom
import { test, expect, beforeEach, vi } from 'vitest';
import { act } from 'react';
import { cleanup, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
vi.mock('next/navigation', () => import('./helpers/navigation-mock'));
import { renderDoctor, nav } from './helpers/render-doctor';
import { installDomStubs, ResizeObserverStub } from './helpers/dom-stubs';
import { Earnings } from '@/components/doctor/Earnings';
import { useSession } from '@/components/doctor/SessionProvider';
import * as page from '@/app/(app)/doctor/earnings/page';

beforeEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); installDomStubs(); });

const T0 = Date.parse('2026-08-28T14:00:00Z');
function freeze() { vi.useFakeTimers(); vi.setSystemTime(T0); }   // setSystemTime after useFakeTimers

// The provider's act(), captured so a test can complete a consultation without
// walking the session route — the earnings screen only reads state.completed.
let sessionAct: ReturnType<typeof useSession>['act'] | null = null;
function CaptureSession() { sessionAct = useSession().act; return null; }
function completeOne() {
  act(() => {
    sessionAct!({ type: 'jump', screen: 'consultation', now: T0 });
    sessionAct!({ type: 'complete', now: T0 + 545_000, id: 'C-0032', when: 'Today, 15:02' });
  });
}

const band = (root: HTMLElement) => root.querySelector<HTMLElement>('[data-slot="card"][data-variant="band"]')!;
const bandValue = (root: HTMLElement) => band(root).querySelector('[data-slot="stat-value"]')!.textContent;
// A tile is the nearest ancestor of its label that also holds a numeral.
function valueFor(label: string): string {
  let node: HTMLElement | null = screen.getByText(label);
  while (node && !node.querySelector('[data-slot="stat-value"]')) node = node.parentElement;
  return node!.querySelector('[data-slot="stat-value"]')!.textContent ?? '';
}
function drawChart(root: HTMLElement) {
  const frame = root.querySelector('[data-slot="chart-frame"]')!;
  act(() => ResizeObserverStub.forElement(frame)!.resize(frame, 640));
}

test('blank mode: every figure is a dash, the fee is the only number, and the table has its empty row', () => {
  const { container } = renderDoctor(<Earnings />, { pathname: '/doctor/earnings' });
  expect(screen.getByRole('heading', { level: 1, name: 'Earnings' })).toBeInTheDocument();
  expect(bandValue(container)).toBe('—');
  expect(band(container)).toHaveTextContent('Bank transfer, weekly');
  expect(band(container)).not.toHaveTextContent('August');
  expect(valueFor('Earned to date')).toBe('—');
  expect(valueFor('Consultations completed')).toBe('—');
  expect(valueFor('Fee per consultation')).toBe('£39');
  expect(valueFor('Earned this week')).toBe('—');
  expect(screen.getByText('No earnings yet.')).toBeInTheDocument();
  expect(container.querySelector('[data-slot="chart-frame"]')).toBeNull();
  expect(container.querySelector('svg')).toBeNull();
  expect(screen.queryByText('Earlier days')).toBeNull();
  const rows = container.querySelectorAll('tbody tr');
  expect(rows).toHaveLength(1);
  expect(rows[0]).toHaveTextContent('Nothing in this payout yet.');
  expect(rows[0].querySelector('th[scope="row"]')).toHaveTextContent('—');
  expect(screen.queryByText(/most recent of/)).toBeNull();
  // The blank sweep: no figure but the fee, no digit in any cell.
  for (const v of container.querySelectorAll('[data-slot="stat-value"]')) expect(['—', '£39']).toContain(v.textContent);
  for (const td of container.querySelectorAll('td')) expect(td.textContent).not.toMatch(/\d/);
});

test('seeded mode: the preview arithmetic — £468 next payout, £1,560 to date, 40 consultations, 5 rows of 12', () => {
  const { container } = renderDoctor(<Earnings />, { pathname: '/doctor/earnings', query: 'data=seeded' });
  expect(bandValue(container)).toBe('£468');
  expect(band(container)).toHaveTextContent('22 – 28 August');
  expect(band(container)).toHaveTextContent('Bank transfer, Friday 4 September');
  expect(valueFor('Earned to date')).toBe('£1,560');
  expect(valueFor('Consultations completed')).toBe('40');
  expect(valueFor('Fee per consultation')).toBe('£39');
  expect(valueFor('Earned this week')).toBe('£468');
  expect(screen.getByText('5 most recent of 12')).toBeInTheDocument();
  const rows = container.querySelectorAll('tbody tr');
  expect(rows).toHaveLength(5);
  expect([...rows].map((r) => r.querySelector('th[scope="row"]')!.textContent))
    .toEqual(['C-0031', 'C-0030', 'C-0029', 'C-0028', 'C-0027']);
  expect(rows[0]).toHaveTextContent('Today, 14:20');
  expect(rows[0]).toHaveTextContent('9 min');
  expect(rows[0]).toHaveTextContent('Prescription issued');
  const fees = container.querySelectorAll('td[data-label="Fee"]');
  expect(fees).toHaveLength(5);
  for (const fee of fees) { expect(fee).toHaveTextContent('£39'); expect(fee).toHaveClass('tabular-nums'); }
  expect(container.querySelector('[data-new]')).toBeNull();
});

test('the daily earnings chart draws money at the measured width, marks today, and carries its legend', () => {
  const { container } = renderDoctor(<Earnings />, { pathname: '/doctor/earnings', query: 'data=seeded' });
  expect(screen.getByText('15–28 August')).toBeInTheDocument();
  expect(container.querySelector('svg')).toBeNull();            // nothing until measured
  drawChart(container);
  const svg = screen.getByRole('img', { name: 'Daily earnings, last 14 days' });
  const rects = svg.querySelectorAll('rect');
  expect(rects).toHaveLength(14);
  expect([...rects].filter((r) => r.classList.contains('fill-primary'))).toHaveLength(1);
  expect(screen.getByText('Today')).toBeInTheDocument();
  expect(screen.getByText('Earlier days')).toBeInTheDocument();
  expect(screen.queryByText('No earnings yet.')).toBeNull();
});

test('exactly one band card in either mode: the next payout', () => {
  for (const query of [undefined, 'data=seeded']) {
    const { container, unmount } = renderDoctor(<Earnings />, { pathname: '/doctor/earnings', query });
    const bands = container.querySelectorAll<HTMLElement>('[data-slot="card"][data-variant="band"]');
    expect(bands).toHaveLength(1);
    expect(within(bands[0]).getByRole('heading', { level: 2 })).toHaveTextContent('Next payout');
    unmount();
  }
});

test('one completed consultation moves the payout and the total by exactly one fee and prepends its row', () => {
  freeze();
  const { container } = renderDoctor(<><Earnings /><CaptureSession /></>, { pathname: '/doctor/earnings', query: 'data=seeded' });
  expect(bandValue(container)).toBe('£468');
  expect(valueFor('Earned to date')).toBe('£1,560');
  completeOne();
  expect(bandValue(container)).toBe('£507');
  expect(valueFor('Earned to date')).toBe('£1,599');
  expect(valueFor('Earned this week')).toBe('£507');
  expect(valueFor('Consultations completed')).toBe('41');
  const rows = container.querySelectorAll('tbody tr');
  expect(rows).toHaveLength(6);
  expect(rows[0]).toHaveAttribute('data-new', 'true');
  expect(rows[0].querySelector('th[scope="row"]')).toHaveTextContent('C-0032');
  expect(rows[0]).toHaveTextContent('Today, 15:02');
  expect(rows[0]).toHaveTextContent('9 min');
  expect(rows[0]).toHaveTextContent('Recorded in Semble');
  expect(rows[0]).toHaveTextContent('£39');
  expect(rows[1].querySelector('th[scope="row"]')).toHaveTextContent('C-0031');
  expect(screen.getByText('6 most recent of 13')).toBeInTheDocument();
  // Completing a consultation while reading earnings never yanks the GP to the session route.
  expect(nav.router.replace).not.toHaveBeenCalled();
  expect(nav.router.push).not.toHaveBeenCalled();
});

test('in blank mode the only figure on the screen is what this session produced', () => {
  freeze();
  const { container } = renderDoctor(<><Earnings /><CaptureSession /></>, { pathname: '/doctor/earnings' });
  completeOne();
  expect(bandValue(container)).toBe('£39');
  expect(band(container)).toHaveTextContent('Bank transfer, weekly');
  expect(valueFor('Earned to date')).toBe('£39');
  expect(valueFor('Consultations completed')).toBe('1');
  expect(valueFor('Earned this week')).toBe('£39');
  const rows = container.querySelectorAll('tbody tr');
  expect(rows).toHaveLength(1);
  expect(rows[0].querySelector('th[scope="row"]')).toHaveTextContent('C-0032');
  expect(screen.queryByText(/most recent of/)).toBeNull();
  expect(screen.queryByText('No earnings yet.')).toBeNull();
  drawChart(container);
  expect(screen.getByRole('img', { name: 'Daily earnings, last 14 days' })).toBeInTheDocument();
  // No fixture figure came along with it.
  expect(container.textContent).not.toMatch(/C-0031|£468|£1,560|August/);
});

test('three h2s, a captioned table with scoped headers, and no per-hour figure in the DOM or the source', () => {
  const { container } = renderDoctor(<Earnings />, { pathname: '/doctor/earnings', query: 'data=seeded' });
  expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent))
    .toEqual(['Next payout', 'Daily earnings, last 14 days', 'What is in this payout']);
  const table = container.querySelector('table')!;
  expect(table.querySelector('caption')).toHaveTextContent('What is in this payout');
  expect([...table.querySelectorAll('thead th')].map((th) => th.textContent))
    .toEqual(['Reference', 'When', 'Length', 'Outcome', 'Fee']);
  for (const th of table.querySelectorAll('th')) expect(th).toHaveAttribute('scope');
  expect(container.textContent).not.toMatch(/per hour|\/hour|\/hr\b|hourly/i);
  const source = readFileSync(join(__dirname, '..', 'components', 'doctor', 'Earnings.tsx'), 'utf8');
  expect(source).not.toMatch(/\bhour|\/hr\b|hourly/i);
});

test('the route is static and renders the screen', () => {
  expect(page.dynamic).toBe('force-static');
  renderDoctor(page.default(), { pathname: '/doctor/earnings' });
  expect(document.querySelector('[data-screen="earnings"]')).toBeInTheDocument();
});
```

Run: `npx vitest run tests/doctor-earnings.test.tsx` → fails: `Cannot find module '@/components/doctor/Earnings'`.

- [ ] **Step 2: `components/doctor/Earnings.tsx`**

Copy is verbatim from `preview/doctor.html:170-222` (headings, labels, column names, legend, the empty row) and `preview/js/doctor.js:226-240` (the payout label, the date range, the payout note). The note's two numbers come from `earningsFor` rather than `D.recent.length` / the fixture week so it stays true after a session consultation is prepended ("6 most recent of 13").

```tsx
'use client';
/* The money screen. Every figure here is consults × FEE, derived once by
   earningsFor() from the fixtures and from what this session produced, so
   this screen and the dashboard can never disagree. Nothing is per hour:
   a GP is paid per consultation and the screen says only that. */
import type { ComponentProps, ReactNode } from 'react';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { BarChart } from '@/components/app/BarChart';
import { ChartLegend } from '@/components/app/ChartLegend';
import { EmptyState } from '@/components/app/EmptyState';
import { PageHeader } from '@/components/app/PageHeader';
import { StatTile } from '@/components/app/StatTile';
import { useSession } from '@/components/doctor/SessionProvider';
import { useFigures } from '@/lib/data-mode';
import { earningsFor, type Earnings as EarningsFigures } from '@/lib/earnings';
import { DOCTOR_DASHBOARD as D, FEE } from '@/lib/fixtures';
import { money } from '@/lib/format';

const CHART_TITLE = 'Daily earnings, last 14 days';
// preview/doctor.js:236-237 — the fortnight the fixture covers, a fixture fact.
const RANGE = `${D.dailyConsults[0].label}–${D.dailyConsults.at(-1)!.label} August`;
// Swatches match the marks (Decision 24): today's bar is fill-primary, the rest fill-outline.
const LEGEND: ComponentProps<typeof ChartLegend>['items'] = [
  { label: 'Today', swatch: 'primary' },
  { label: 'Earlier days', swatch: 'outline' },
];

export function Earnings() {
  const { seeded } = useFigures();
  const { state } = useSession();
  const e = earningsFor({ seeded, session: state.completed });
  return (
    <div data-screen="earnings" className="flex flex-col gap-8">
      <PageHeader title="Earnings" />
      <div data-stagger className="grid grid-cols-6 gap-4 max-cols:grid-cols-1">
        <NextPayout e={e} />
        <Totals e={e} />
        <DailyEarnings e={e} />
      </div>
      <PayoutTable e={e} />
    </div>
  );
}

// The one band on the screen: the payoff (preview `card--fill card--bottom`).
function NextPayout({ e }: { e: EarningsFigures }) {
  const { seeded, shown, live } = useFigures();
  return (
    <Card variant="band" data-reveal className="col-span-3 min-h-[220px] justify-end max-cols:col-span-1">
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>Next payout</CardTitle>
        <CardAction className="text-fine whitespace-nowrap text-band-ink-2">{shown(D.payout.period)}</CardAction>
      </CardHeader>
      <CardContent>
        <StatTile
          size="lg"
          value={live(e.payoutAmount, money)}
          label={seeded ? `${D.payout.method}, ${D.payout.date}` : `${D.payout.method}, weekly`}
        />
      </CardContent>
    </Card>
  );
}

function Totals({ e }: { e: EarningsFigures }) {
  const { live } = useFigures();
  return (
    <Card data-reveal className="col-span-3 max-cols:col-span-1">
      <CardContent className="grid grid-cols-2 gap-4">
        <StatTile size="sm" label="Earned to date" value={live(e.toDate, money)} />
        <StatTile size="sm" label="Consultations completed" value={live(e.toDateConsults)} />
        {/* A product fact, not a figure the platform produced: it renders in both modes. */}
        <StatTile size="sm" label="Fee per consultation" value={money(FEE)} />
        <StatTile size="sm" label="Earned this week" value={live(e.week, money)} />
      </CardContent>
    </Card>
  );
}

function DailyEarnings({ e }: { e: EarningsFigures }) {
  const { seeded, DASH } = useFigures();
  const drawn = e.fortnightConsults > 0;
  return (
    <Card className="col-span-6 max-cols:col-span-1">
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>{CHART_TITLE}</CardTitle>
        <CardAction className="text-fine whitespace-nowrap text-ink-2">{seeded ? RANGE : DASH}</CardAction>
      </CardHeader>
      <CardContent>
        {drawn ? (
          <>
            <BarChart
              data={e.dailySeries.map((d) => ({ ...d, value: d.value * FEE }))}
              height={150}
              format={money}
              ariaLabel={CHART_TITLE}
            />
            <ChartLegend items={LEGEND} />
          </>
        ) : (
          <EmptyState>No earnings yet.</EmptyState>
        )}
      </CardContent>
    </Card>
  );
}

function PayoutTable({ e }: { e: EarningsFigures }) {
  const { seeded, DASH } = useFigures();
  return (
    <section aria-labelledby="payout-heading" className="mt-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 id="payout-heading" className="font-display text-xl leading-[1.3] font-semibold tracking-[-.02em]">
          What is in this payout
        </h2>
        {/* A five-row table under a twelve-consultation payout invites the reader
            to add it up and find it short. Say which five these are. */}
        {seeded && (
          <p className="max-w-[60ch] text-fine text-ink-2">
            {e.recent.length} most recent of {e.weekConsults}
          </p>
        )}
      </div>
      <Card className="py-0">
        <Table stack="cols">
          <TableCaption className="sr-only">What is in this payout</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Reference</TableHead>
              <TableHead scope="col">When</TableHead>
              <TableHead scope="col">Length</TableHead>
              <TableHead scope="col">Outcome</TableHead>
              <TableHead scope="col">Fee</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {e.recent.length === 0 ? (
              <TableRow>
                <RowHead>{DASH}</RowHead>
                <TableCell colSpan={4}>Nothing in this payout yet.</TableCell>
              </TableRow>
            ) : (
              e.recent.map((c) => (
                <TableRow key={c.id} data-new={'isNew' in c ? 'true' : undefined}>
                  <RowHead>{c.id}</RowHead>
                  <TableCell label="When">{c.when}</TableCell>
                  <TableCell label="Length" className="tabular-nums">{c.minutes} min</TableCell>
                  <TableCell label="Outcome">{c.outcome}</TableCell>
                  <TableCell label="Fee" className="font-display font-semibold tabular-nums">{money(FEE)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </section>
  );
}

// A row header is a <th> in the body. TableHead is the column header (Task 8 gives
// it role="columnheader"), so the reference cell is its own element in the table face.
function RowHead({ children }: { children: ReactNode }) {
  return (
    <th scope="row" role="rowheader" className="p-3 text-left align-middle font-display font-semibold whitespace-nowrap">
      {children}
    </th>
  );
}
```

Checks against the constraints: colours are `text-band-ink-2`, `text-ink-2` and the card variants only; the band is the Next payout card alone; no icon, no `dark:`, no hex; `data-reveal` sits on the two tiles of the first row (Decision 13) and never on the chart card or the table; nothing reads `window`, `document` or `Date.now()` in render; `'use client'` because of `useFigures` and `useSession`; the words `schedule`, `rota`, `calendar`, `hour` do not appear.

- [ ] **Step 3: `app/(app)/doctor/earnings/page.tsx`**

Replace the Task 13 placeholder with:

```tsx
import { Earnings } from '@/components/doctor/Earnings';

export const dynamic = 'force-static';

// The layout (Task 13) owns the providers, the shell and the noindex metadata;
// the page is the screen and nothing else, so the server shell renders blank.
export default function Page() {
  return <Earnings />;
}
```

- [ ] **Step 4: Run, typecheck, build, grep**

```bash
npx vitest run tests/doctor-earnings.test.tsx
```
Expected: 8 passed.

```bash
npm test
npm run typecheck
NEXT_PUBLIC_SITE_URL=http://localhost:3000 npm run build
```
Expected: the suite green (`tests/constraints.test.ts` now scans `components/doctor/Earnings.tsx`: no medicine, no banned wording, no hex, no `dark:`); typecheck clean; the build lists `/doctor/earnings` as a static route (○).

```bash
grep -rinwE 'schedule|rota|calendar' 'app/(app)/doctor' components/doctor ; echo "exit $?"   # no lines, exit 1
grep -inE 'hour|/hr\b|hourly' components/doctor/Earnings.tsx ; echo "exit $?"               # no lines, exit 1
grep -rnE 'dark:|oklch\(|hsl\(' components/doctor/Earnings.tsx 'app/(app)/doctor/earnings' ; echo "exit $?"   # no lines, exit 1
```

If the dev server on :3000 is up, `http://localhost:3000/doctor/earnings` shows dashes and the empty row; `?data=seeded` shows £468 / £1,560 / 40 / £39 / £468, the 14-bar chart with its legend, and five rows of 12.

- [ ] **Step 5: Commit**

```bash
git add components/doctor/Earnings.tsx 'app/(app)/doctor/earnings/page.tsx' tests/doctor-earnings.test.tsx
git commit -m "feat(doctor): earnings

Next payout (the screen's one band), the four totals, the daily earnings
bar chart and the payout table, every figure from earningsFor() so a
consultation completed this session moves the payout, the total and the
table by exactly one fee. No per-hour figure anywhere.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 17: Profile

> Notes on the brief vs the contract and the task map: (1) `app/(app)/doctor/profile/page.tsx` is **Modify**, not Create — Task 13 leaves a placeholder page there so every route builds; this task replaces the whole file. (2) The test mocks `next/navigation` through the helper the task map names for Task 4, `tests/helpers/navigation-mock.ts` (exports `nav`, `resetNav`), and installs `installDomStubs()` from `tests/helpers/dom-stubs.ts`. (3) The "Credentials" fact counts the record on screen (`useDoctor().record`, the contract's `GATE_RECORDS[gate] ?? MY_RECORD`) rather than reading `DOCTOR.credentialsVerified` directly: for GP-002 the two are the same "7 of 7 verified", and under `?gate=` the fact can never contradict the matrix above it. (4) One new string, required by the accessibility floor and absent from the preview: the matrix caption "Your credentials" (sr-only permitted) — list it in the report.

**Files:**
- Create: `components/doctor/Profile.tsx`
- Modify: `app/(app)/doctor/profile/page.tsx` (Task 13's placeholder; replaced whole)
- Test: `tests/doctor-profile.test.tsx`
- Read: `preview/doctor.html:224-255`, `preview/js/doctor.js:242-291`, `lib/fixtures.ts`, `lib/alerts.ts`, `components/app/CredentialMatrix.tsx`, `components/app/Facts.tsx`, `components/app/PageHeader.tsx`, `components/doctor/OnboardingProvider.tsx`, `components/doctor/DoctorProvider.tsx`, `components/ui/button.tsx`

**Interfaces:**
- Consumes: `useFigures()` → `{ seeded, DASH, shown }` from `@/lib/data-mode` (Task 4); `useDoctor()` → `{ record }` from `@/components/doctor/DoctorProvider` and `useOnboarding()` → `{ state, act }` from `@/components/doctor/OnboardingProvider`, `DoctorProviders` from `@/components/doctor/DoctorProviders` (Task 13); `<CredentialMatrix record seeded caption stack="phone" />`, `<Facts items />`, `<PageHeader title />` from `@/components/app/*` (Tasks 9, 11); `Button` (`variant="secondary" size="sm" asChild`) from `@/components/ui/button`; `CREDENTIAL_KEYS`, `CREDENTIAL_LABELS` from `@/lib/alerts` and `DOCTOR`, `SKILLS`, `GATE_RECORDS`, `CredentialRecord`, `SkillId` from `@/lib/fixtures` (Task 3); `money` from `@/lib/format` (Task 2); `onboardingHref` from `@/lib/onboarding` (Task 7); test helpers `installDomStubs` (`tests/helpers/dom-stubs.ts`) and `nav`, `resetNav` (`tests/helpers/navigation-mock.ts`) from Task 4.
- Produces: `export function Profile(): JSX.Element` (`'use client'`; root `<div data-screen="profile" className="max-w-[620px]">`; no band card; no chart; no timer) and the static `/doctor/profile` route. Task 26's sweeps (ribbon on every route, ≤ 1 band card, every table captioned with scoped headers, blank mode has no digit in a `td`) run over it; `DOCTOR_NAV` (Task 12) already links to it.

- [ ] **Step 1: Write the test first — it fails on the missing module**

`tests/doctor-profile.test.tsx`:

```tsx
// @vitest-environment jsdom
import { test, expect, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ReactNode } from 'react';
vi.mock('next/navigation', () => import('./helpers/navigation-mock'));
import { nav, resetNav } from './helpers/navigation-mock';
import { installDomStubs } from './helpers/dom-stubs';
import { DoctorProviders } from '@/components/doctor/DoctorProviders';
import { useOnboarding } from '@/components/doctor/OnboardingProvider';
import { Profile } from '@/components/doctor/Profile';
import * as route from '@/app/(app)/doctor/profile/page';
import { CREDENTIAL_LABELS } from '@/lib/alerts';
import { DOCTOR, type SkillId } from '@/lib/fixtures';

// The providers read ?data= and ?gate= from window.location after mount, so the
// query is set on the document before render, as a real load would have it.
function renderProfile(query = '', extra?: ReactNode) {
  window.history.replaceState(null, '', `/doctor/profile${query ? `?${query}` : ''}`);
  return render(
    <DoctorProviders>
      <Profile />
      {extra}
    </DoctorProviders>,
  );
}

// A stand-in for the skills step: the only way to change a skill is the
// onboarding reducer, and the profile must reflect it without a reload.
function ToggleSkill({ id }: { id: SkillId }) {
  const { act } = useOnboarding();
  return (
    <button type="button" onClick={() => act({ type: 'toggleSkill', id })}>
      toggle {id}
    </button>
  );
}

const rowsOf = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLTableRowElement>('[data-screen="profile"] table tbody tr')];
const factValues = (container: HTMLElement) =>
  [...container.querySelectorAll('[data-slot="facts"] dd')].map((dd) => dd.textContent?.trim());
const factTerms = (container: HTMLElement) =>
  [...container.querySelectorAll('[data-slot="facts"] dt')].map((dt) => dt.textContent?.trim());
const skillRows = (container: HTMLElement) =>
  [...container.querySelectorAll('[data-screen="profile"] ul li')].map((li) => {
    const [label, state] = [...li.querySelectorAll('span')].map((s) => s.textContent?.trim());
    return [label, state];
  });

beforeEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  installDomStubs();
  resetNav('/doctor/profile');
});

test('seeded: all seven credentials, sorted urgent-first with indemnity at nine days, then DBS at twelve', () => {
  const { container } = renderProfile('data=seeded');
  const rows = rowsOf(container);
  expect(rows).toHaveLength(7);
  for (const label of Object.values(CREDENTIAL_LABELS)) {
    expect(rows.filter((row) => row.textContent?.includes(label)), label).toHaveLength(1);
  }
  expect(rows[0]).toHaveTextContent('Indemnity cover');
  expect(rows[0]).toHaveTextContent(/9 days/);
  expect(rows[0].querySelector('[data-status]')).toHaveAttribute('data-status', 'expiring');
  expect(rows[1]).toHaveTextContent('DBS check');
  expect(rows[1]).toHaveTextContent(/12 days/);
  expect(rows[1].querySelector('[data-status]')).toHaveAttribute('data-status', 'expiring');
  for (const row of rows.slice(2)) expect(row.querySelector('[data-status]')).toHaveAttribute('data-status', 'valid');
  // The accessibility floor on this route: a caption and scoped headers.
  expect(container.querySelector('[data-screen="profile"] table caption')).toHaveTextContent('Your credentials');
  for (const th of container.querySelectorAll('[data-screen="profile"] table th')) expect(th).toHaveAttribute('scope');
});

test('blank: every credential label renders, every status is Not submitted, and no cell carries a figure', () => {
  const { container } = renderProfile();
  const rows = rowsOf(container);
  expect(rows).toHaveLength(7);
  for (const label of Object.values(CREDENTIAL_LABELS)) expect(container).toHaveTextContent(label);
  expect(container.querySelectorAll('[data-screen="profile"] [aria-label="Not submitted"]')).toHaveLength(7);
  expect(container.querySelectorAll('[data-status="valid"], [data-status="expiring"], [data-status="expired"], [data-status="pending"], [data-status="rejected"]')).toHaveLength(0);
  for (const td of container.querySelectorAll('[data-screen="profile"] td')) expect(td.textContent ?? '').not.toMatch(/\d/);
});

test('the account facts read the fixtures when seeded and dashes when blank; reference and region in both', () => {
  const seeded = renderProfile('data=seeded');
  expect(factTerms(seeded.container)).toEqual(['Reference', 'Credentials', 'Consultations', 'Earned to date', 'Working in']);
  expect(factValues(seeded.container)).toEqual(['GP-002', '7 of 7 verified', '40', '£1,560', 'England only']);
  expect(factValues(seeded.container)[1]).toBe(`${DOCTOR.credentialsVerified} of ${DOCTOR.credentialsTotal} verified`);
  seeded.unmount();

  const blank = renderProfile();
  expect(factValues(blank.container)).toEqual(['GP-002', '—', '—', '—', 'England only']);
});

test('the credential count follows the record on screen, so a gate and the profile cannot disagree', () => {
  const { container } = renderProfile('gate=verification-pending&data=seeded');
  expect(container.querySelectorAll('[data-status="pending"]')).toHaveLength(6);
  expect(container.querySelectorAll('[data-status="valid"]')).toHaveLength(1);
  expect(factValues(container)[1]).toBe('1 of 7 verified');
});

test('clinical skills mirror the onboarding state, so a change on the skills step shows here', () => {
  const { container } = renderProfile('', <ToggleSkill id="dermatology" />);
  expect(container).toHaveTextContent('This decides which consultations you are offered.');
  expect(skillRows(container)).toEqual([
    ['General adult medicine', 'On'],
    ['Minor illness', 'On'],
    ["Women's health", 'Off'],
    ['Mental health', 'Off'],
    ['Paediatrics (age 5+)', 'Off'],
    ['Dermatology', 'Off'],
  ]);
  fireEvent.click(screen.getByRole('button', { name: 'toggle dermatology' }));
  expect(skillRows(container)[5]).toEqual(['Dermatology', 'On']);
  // A skill toggle is not a step move: nothing navigates.
  expect(nav.router.replace).not.toHaveBeenCalled();
  expect(nav.router.push).not.toHaveBeenCalled();
});

test('the three actions link into onboarding as small secondary buttons, and the page has no band card', () => {
  const { container } = renderProfile('data=seeded');
  const links = [
    ['Update credentials', '/doctor/onboarding/credentials'],
    ['Indemnity cover', '/doctor/onboarding/indemnity'],
    ['Change skills', '/doctor/onboarding/skills'],
  ] as const;
  for (const [name, href] of links) {
    const link = screen.getByRole('link', { name });
    expect(link).toHaveAttribute('href', href);
    expect(link).toHaveAttribute('data-variant', 'secondary');
    expect(link).toHaveAttribute('data-size', 'sm');
  }
  expect(container.querySelectorAll('[data-slot="card"][data-variant="band"]')).toHaveLength(0);
  expect(container.querySelector('svg[role="img"]')).toBeNull();
});

test('an expired indemnity is a band row, never a band card', () => {
  const { container } = renderProfile('gate=indemnity-expired&data=seeded');
  const rows = rowsOf(container);
  expect(rows[0]).toHaveTextContent('Indemnity cover');
  expect(rows[0].querySelector('[data-status]')).toHaveAttribute('data-status', 'expired');
  expect(rows[0].className).toContain('bg-band');
  expect(container.querySelectorAll('[data-slot="card"][data-variant="band"]')).toHaveLength(0);
});

test('the route is static and renders the profile', () => {
  expect(route.dynamic).toBe('force-static');
  window.history.replaceState(null, '', '/doctor/profile');
  const { container } = render(<DoctorProviders>{route.default()}</DoctorProviders>);
  expect(container.querySelector('[data-screen="profile"]')).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Profile');
  expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Credentials', 'Clinical skills', 'Account']);
});
```

Run: `npx vitest run tests/doctor-profile.test.tsx` → fails: `Error: Failed to resolve import "@/components/doctor/Profile"`.

- [ ] **Step 2: `components/doctor/Profile.tsx`**

Copy is verbatim from `preview/doctor.html:227-252` (h1 "Profile"; h2s "Credentials", "Clinical skills", "Account"; the note "This decides which consultations you are offered."; buttons "Update credentials", "Indemnity cover", "Change skills") and `preview/js/doctor.js:270-291` (the six skill labels with On/Off; the five facts "Reference", "Credentials" `${verified} of ${total} verified`, "Consultations", "Earned to date", "Working in" "England only"). The narrow page is the preview's `.page--narrow { max-width: 620px }`; sections are the preview's `.section` rhythm (48px apart, 16px under a section head); the skill rows are the preview's `.row` (12px vertical padding on a hairline, 700-weight title, 500-weight ink-2 value). As in the preview, the narrow page carries no cards. The only `data-reveal` is `PageHeader`'s h1 (Decision 13).

```tsx
'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CredentialMatrix } from '@/components/app/CredentialMatrix';
import { Facts } from '@/components/app/Facts';
import { PageHeader } from '@/components/app/PageHeader';
import { useDoctor } from '@/components/doctor/DoctorProvider';
import { useOnboarding } from '@/components/doctor/OnboardingProvider';
import { useFigures } from '@/lib/data-mode';
import { CREDENTIAL_KEYS } from '@/lib/alerts';
import { DOCTOR, SKILLS, type CredentialRecord } from '@/lib/fixtures';
import { money } from '@/lib/format';
import { onboardingHref } from '@/lib/onboarding';

// Decision 26: section headings are DESIGN.md's headline-md, the same face and
// size as a card title.
const SECTION_TITLE = 'text-xl leading-[1.3] font-semibold tracking-[-.02em]';

// "Verified" is what the platform has accepted. A credential that is valid but
// about to lapse still counts; the lapse is the alert's job, not this line's.
// Counted from the record on screen so a gate record and its matrix agree.
const verifiedCount = (record: CredentialRecord) =>
  CREDENTIAL_KEYS.filter((key) => record[key].status === 'valid' || record[key].status === 'expiring').length;

export function Profile() {
  const { seeded, DASH, shown } = useFigures();
  const { record } = useDoctor();
  const { state: onboarding } = useOnboarding();

  return (
    <div data-screen="profile" className="max-w-[620px]">
      <PageHeader title="Profile" />

      <div className="grid gap-12">
        <section aria-labelledby="profile-credentials">
          <h2 id="profile-credentials" className={`mb-4 ${SECTION_TITLE}`}>Credentials</h2>
          <CredentialMatrix record={record} seeded={seeded} caption="Your credentials" stack="phone" />
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild variant="secondary" size="sm">
              <Link href={onboardingHref('credentials')}>Update credentials</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href={onboardingHref('indemnity')}>Indemnity cover</Link>
            </Button>
          </div>
        </section>

        <section aria-labelledby="profile-skills">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-4">
            <h2 id="profile-skills" className={SECTION_TITLE}>Clinical skills</h2>
            <p className="max-w-[60ch] text-body text-ink-2">This decides which consultations you are offered.</p>
          </div>
          {/* The GP's own choices, so they read in both modes: nothing here is a platform figure. */}
          <ul>
            {SKILLS.map((skill) => (
              <li key={skill.id} className="flex items-center justify-between gap-4 border-b border-rule py-3 last:border-0">
                <span className="font-bold">{skill.label}</span>
                <span className="font-medium text-ink-2">{onboarding.skills.includes(skill.id) ? 'On' : 'Off'}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild variant="secondary" size="sm">
              <Link href={onboardingHref('skills')}>Change skills</Link>
            </Button>
          </div>
        </section>

        <section aria-labelledby="profile-account">
          <h2 id="profile-account" className={`mb-4 ${SECTION_TITLE}`}>Account</h2>
          <Facts
            items={[
              ['Reference', DOCTOR.ref],
              ['Credentials', seeded ? `${verifiedCount(record)} of ${CREDENTIAL_KEYS.length} verified` : DASH],
              ['Consultations', shown(DOCTOR.consultsCompleted)],
              ['Earned to date', shown(DOCTOR.earningsToDate, money)],
              ['Working in', 'England only'],
            ]}
          />
        </section>
      </div>
    </div>
  );
}
```

What each rule in the brief maps to: every platform figure passes through `shown()` (consultations, earnings) or the `seeded ? … : DASH` branch the preview used for the credential count (`doctor.js:286-287`); the reference and "England only" are facts of the account, not traction, and render in both modes (`doctor.js:285, 290`); the credential labels render in both modes inside the matrix (blank → "Not submitted", contract); severity in the matrix is fill, border and position (Decision 23) and the badge word; no `success`/`error` class appears in this file; no icon is imported; `onboardingHref` keeps the three links on the route table rather than string literals; `stack="phone"` collapses the matrix to labelled blocks below 560 so nothing scrolls sideways at 390.

- [ ] **Step 3: The page — replace Task 13's placeholder whole**

`app/(app)/doctor/profile/page.tsx`:

```tsx
import { Profile } from '@/components/doctor/Profile';

export const dynamic = 'force-static';

// A server page around a client screen: the static shell already carries the
// headings, the credential labels and the empty states before any script runs.
export default function Page() {
  return <Profile />;
}
```

The doctor layout (Task 13) supplies `metadata.robots` and the title; the page adds nothing that would make the route dynamic.

- [ ] **Step 4: Run, typecheck, build, grep**

```bash
cd /Users/liam/development/DrQuick/website
npx vitest run tests/doctor-profile.test.tsx      # 8 passing
npm test                                           # green; constraints.test.ts scans components/doctor/Profile.tsx (no hex, no dark:, no oklch/hsl, no medicine, no rating)
npm run typecheck                                  # green
NEXT_PUBLIC_SITE_URL=http://localhost:3000 npm run build   # green; /doctor/profile listed as a static route
grep -rinwE 'schedule|rota|calendar' 'app/(app)/doctor' components/doctor ; echo "exit $?"   # no lines, exit 1
grep -nE 'lucide-react|useSearchParams|Date\.now|window\.|document\.' components/doctor/Profile.tsx ; echo "exit $?"   # no lines, exit 1
```

Expected: the profile route renders the ribbon and headings without JavaScript (the layout's shell is server-rendered, the screen's headings and the matrix labels are in the static HTML); with `?data=seeded` the matrix reads indemnity 9 days first and the facts read 7 of 7 / 40 / £1,560; blank, every status badge is the dash with "Not submitted" and every fact but the reference and the region is a dash.

- [ ] **Step 5: Commit**

```bash
git add components/doctor/Profile.tsx 'app/(app)/doctor/profile/page.tsx' tests/doctor-profile.test.tsx
git commit -m "feat(doctor): profile

The narrow profile page: the credential matrix of the record on screen,
sorted urgent-first and reading Not submitted in blank mode; clinical
skills read from the onboarding state so a change on the skills step
shows here; the account facts with every platform figure through shown()
and the credential count taken from the same record as the matrix. No
band card, no chart, no timer.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 18: Onboarding — register to ready

**Files:**
- Create: `app/(app)/doctor/onboarding/[[...step]]/page.tsx`, `components/doctor/OnboardingFlow.tsx`, `components/doctor/steps/Register.tsx`, `components/doctor/steps/Identity.tsx`, `components/doctor/steps/Credentials.tsx`, `components/doctor/steps/Indemnity.tsx`, `components/doctor/steps/Skills.tsx`, `components/doctor/steps/Done.tsx`
- Test: `tests/doctor-onboarding.test.tsx`
- Read: `preview/doctor.html:257-364` (all six steps, the copy this task ports verbatim except Decision 29), `lib/onboarding.ts` (Task 7), `lib/fixtures.ts` `SKILLS` (Task 3), `components/app/Stepper.tsx` (Task 9), `components/app/CredentialMatrix.tsx` (Task 11), `components/doctor/OnboardingProvider.tsx` (Task 13)

**Interfaces:**
- Consumes: `useOnboarding()` from `@/components/doctor/OnboardingProvider`; `ONBOARDING_STEPS`, `ONBOARDING_RECORD`, `stepStatus`, `type OnboardingStep` from `@/lib/onboarding`; `SKILLS` from `@/lib/fixtures`; `Stepper`, `PageHeader` from `@/components/app/*`; `CredentialMatrix` from `@/components/app/CredentialMatrix`; `Button`, `Card`, `CardHeader`, `CardTitle`, `CardContent`, `Input`, `Label`, `Checkbox` from `@/components/ui/*`.
- Produces: `OnboardingFlow` (default-exported from its file as a named export `OnboardingFlow`), the six step components, and the route. Nothing else imports the step components.

- [ ] **Step 1: The route**

`app/(app)/doctor/onboarding/[[...step]]/page.tsx` — a server component; the layout's provider reads the pathname, so the page only has to exist at every step URL.

```tsx
import { notFound } from 'next/navigation';
import { ONBOARDING_STEPS } from '@/lib/onboarding';
import { OnboardingFlow } from '@/components/doctor/OnboardingFlow';

export const dynamic = 'force-static';
export const dynamicParams = false;

// The bare route and one path per step. An optional catch-all needs the key
// present with an empty array; omitting it throws E618 at build.
export function generateStaticParams() {
  return [{ step: [] }, ...ONBOARDING_STEPS.map((step) => ({ step: [step] }))];
}

export default async function Page({ params }: { params: Promise<{ step?: string[] }> }) {
  const { step } = await params;
  if (step && (step.length > 1 || !(ONBOARDING_STEPS as readonly string[]).includes(step[0]))) notFound();
  return <OnboardingFlow />;
}
```

- [ ] **Step 2: `components/doctor/OnboardingFlow.tsx`**

```tsx
'use client';

import { ONBOARDING_STEPS, stepStatus } from '@/lib/onboarding';
import { Stepper } from '@/components/app/Stepper';
import { useOnboarding } from './OnboardingProvider';
import { Register } from './steps/Register';
import { Identity } from './steps/Identity';
import { Credentials } from './steps/Credentials';
import { Indemnity } from './steps/Indemnity';
import { Skills } from './steps/Skills';
import { Done } from './steps/Done';

const LABELS = {
  register: 'Register', identity: 'Identity', credentials: 'Credentials',
  indemnity: 'Indemnity', skills: 'Skills', done: 'Done',
} as const;

const SCREENS = { register: Register, identity: Identity, credentials: Credentials, indemnity: Indemnity, skills: Skills, done: Done };

export function OnboardingFlow() {
  const { state } = useOnboarding();
  const Screen = SCREENS[state.step];
  return (
    <section data-screen={state.step} className="mx-auto w-full max-w-[480px]">
      <Stepper steps={ONBOARDING_STEPS.map((id) => ({ id, label: LABELS[id], status: stepStatus(state, id) }))} />
      <Screen />
    </section>
  );
}
```

- [ ] **Step 3: Register and Identity**

`components/doctor/steps/Register.tsx` — copy from `preview/doctor.html:262-273`; the GMC field gains the format check the reducer already owns.

```tsx
'use client';

import { PageHeader } from '@/components/app/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOnboarding } from '../OnboardingProvider';

export function Register() {
  const { state, act } = useOnboarding();
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); act({ type: 'submitRegister' }); }}
      className="grid gap-4"
    >
      <PageHeader title="Join Dr Quick" lead="For GMC-registered doctors picking up private GP shifts." />
      <div className="grid gap-2">
        <Label htmlFor="reg-email">Email</Label>
        <Input id="reg-email" name="email" type="email" autoComplete="email"
          value={state.email} onChange={(e) => act({ type: 'setEmail', value: e.target.value })} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="reg-gmc">GMC number</Label>
        <Input id="reg-gmc" name="gmc" type="text" inputMode="numeric" placeholder="7 digits"
          value={state.gmc} onChange={(e) => act({ type: 'setGmc', value: e.target.value })}
          aria-invalid={state.gmcError ? true : undefined}
          aria-describedby={state.gmcError ? 'reg-gmc-error' : undefined} />
        {state.gmcError && <p id="reg-gmc-error" className="text-fine text-error">{state.gmcError}</p>}
      </div>
      <Button type="submit" size="lg" className="w-full">Continue</Button>
    </form>
  );
}
```

`components/doctor/steps/Identity.tsx` — `preview/doctor.html:279-288`. A described external step, never a fake camera.

```tsx
'use client';

import { PageHeader } from '@/components/app/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useOnboarding } from '../OnboardingProvider';

export function Identity() {
  const { act } = useOnboarding();
  return (
    <div className="grid gap-4">
      <PageHeader title="Verify it's you" lead="We use Stripe Identity to check a photo ID — a passport or driving licence." />
      <Card>
        <CardContent>You'll be asked to photograph your ID and take a quick selfie. This takes about a minute.</CardContent>
      </Card>
      <Button size="lg" className="w-full" onClick={() => act({ type: 'verifyIdentity' })}>Verify identity</Button>
    </div>
  );
}
```

- [ ] **Step 4: Credentials, Indemnity, Skills, Done**

`components/doctor/steps/Credentials.tsx` — the five onboarding gates (`preview/doctor.html:290-299`) through the shared matrix, so the onboarding view and the profile view can never disagree about a status.

```tsx
'use client';

import { PageHeader } from '@/components/app/PageHeader';
import { CredentialMatrix } from '@/components/app/CredentialMatrix';
import { Button } from '@/components/ui/button';
import { ONBOARDING_RECORD } from '@/lib/onboarding';
import { useOnboarding } from '../OnboardingProvider';

export function Credentials() {
  const { act } = useOnboarding();
  return (
    <div className="grid gap-4">
      <PageHeader title="Credentials" lead="We verify these before you can take your first consultation." />
      <CredentialMatrix
        record={ONBOARDING_RECORD}
        keys={['gmc', 'licence', 'cct', 'dbs', 'rightToWork']}
        seeded
        caption="Credentials we verify"
        stack="phone"
      />
      <Button size="lg" className="w-full" onClick={() => act({ type: 'continueCredentials' })}>Continue</Button>
    </div>
  );
}
```

> The lead is the one wording change on this step: the preview said "before you can take your first shift", and a GP does not book shifts here (Decision 29). `seeded` is passed literally: these five statuses are the application's own state, not a platform figure, so they render in both data modes.

`components/doctor/steps/Indemnity.tsx` — `preview/doctor.html:302-325`, with Decision 29's block-cover line and Decision 31's symmetry. Two white cards of equal weight; the only asymmetry is the button variant and the honest friction of the two fields.

```tsx
'use client';

import { PageHeader } from '@/components/app/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOnboarding } from '../OnboardingProvider';

export function Indemnity() {
  const { state, act } = useOnboarding();
  const { error } = state.indemnity;
  return (
    <div className="grid gap-4">
      <PageHeader
        title="Indemnity cover"
        lead="State-backed NHS indemnity does not cover private telehealth. You need separate cover to consult here."
      />
      <Card>
        <CardHeader><CardTitle role="heading" aria-level={2}>Dr Quick block cover</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <p>Included for every consultation you take through Dr Quick. No paperwork.</p>
          <Button className="w-full" onClick={() => act({ type: 'useBlockCover' })}>Use Dr Quick cover</Button>
        </CardContent>
      </Card>
      <p className="text-center text-ink-2">or</p>
      <Card>
        <CardHeader><CardTitle role="heading" aria-level={2}>Your own certificate</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="indemnity-file">Certificate of cover</Label>
            <Input id="indemnity-file" name="indemnity-file" type="file"
              onChange={(e) => act({ type: 'setIndemnityFile', name: e.target.files?.[0]?.name ?? '' })} />
            {state.indemnity.fileName && <p className="text-fine text-ink-2">{state.indemnity.fileName}</p>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="indemnity-expiry">Expiry date</Label>
            <Input id="indemnity-expiry" name="indemnity-expiry" type="date" value={state.indemnity.expiry}
              onChange={(e) => act({ type: 'setIndemnityExpiry', value: e.target.value })}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'indemnity-error' : undefined} />
            {error && <p id="indemnity-error" className="text-fine text-error">{error}</p>}
          </div>
          <Button variant="secondary" className="w-full" onClick={() => act({ type: 'uploadCertificate' })}>Upload certificate</Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

`components/doctor/steps/Skills.tsx` — `preview/doctor.html:327-354`; the whole row is the target, and the state is the reducer's.

```tsx
'use client';

import { PageHeader } from '@/components/app/PageHeader';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SKILLS } from '@/lib/fixtures';
import { useOnboarding } from '../OnboardingProvider';

export function Skills() {
  const { state, act } = useOnboarding();
  return (
    <div className="grid gap-4">
      <PageHeader title="Clinical skills" lead="This determines which consultations you're offered." />
      <div className="grid gap-2">
        {SKILLS.map((skill) => (
          <label key={skill.id} htmlFor={`skill-${skill.id}`}
            className="flex cursor-pointer items-center gap-3 rounded-md bg-surface-mid px-3 py-3 text-body font-semibold">
            <Checkbox id={`skill-${skill.id}`} checked={state.skills.includes(skill.id)}
              onCheckedChange={() => act({ type: 'toggleSkill', id: skill.id })} />
            {skill.label}
          </label>
        ))}
      </div>
      <Button size="lg" className="w-full" onClick={() => act({ type: 'finishSkills' })}>Continue</Button>
    </div>
  );
}
```

`components/doctor/steps/Done.tsx` — `preview/doctor.html:356-363`, with Decision 29's second wording change: the preview promised "most GPs hear back within two working days", a service-level claim for a service that has not run.

```tsx
import Link from 'next/link';
import { PageHeader } from '@/components/app/PageHeader';
import { Button } from '@/components/ui/button';

export function Done() {
  return (
    <div className="grid gap-4">
      <PageHeader title="You're ready" />
      <p>Your application is under review. We'll email you once every check clears.</p>
      <Button asChild size="lg" className="w-full"><Link href="/doctor">Go to your dashboard</Link></Button>
    </div>
  );
}
```

- [ ] **Step 5: `tests/doctor-onboarding.test.tsx`**

```tsx
// @vitest-environment jsdom
import { test, expect, beforeEach, vi } from 'vitest';
import { cleanup, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
vi.mock('next/navigation', () => import('./helpers/next-navigation'));
import { renderDoctor, nav } from './helpers/render-doctor';
import OnboardingPage from '@/app/(app)/doctor/onboarding/[[...step]]/page';
import { ONBOARDING_STEPS, onboardingHref } from '@/lib/onboarding';

beforeEach(() => { cleanup(); vi.useRealTimers(); });

const stepEl = (step?: string) => OnboardingPage({ params: Promise.resolve(step ? { step: [step] } : {}) });

test('every step is reachable by URL and names itself', async () => {
  for (const step of ONBOARDING_STEPS) {
    const { container, unmount } = renderDoctor(await stepEl(step), { pathname: onboardingHref(step) });
    expect(container.querySelector(`[data-screen="${step}"]`)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    unmount();
  }
});

test('an unknown step is a 404, and the preview id is not a URL', async () => {
  await expect(stepEl('nope')).rejects.toMatchObject({ digest: expect.stringMatching(/^NEXT_HTTP_ERROR_FALLBACK;404/) });
  await expect(stepEl('onboarding-done')).rejects.toMatchObject({ digest: expect.stringMatching(/^NEXT_HTTP_ERROR_FALLBACK;404/) });
});

test('the stepper marks earlier steps done, the current step current, the rest not started', async () => {
  const { container } = renderDoctor(await stepEl('indemnity'), { pathname: '/doctor/onboarding/indemnity' });
  const items = [...container.querySelectorAll('ol[aria-label="Onboarding steps"] li')];
  expect(items).toHaveLength(6);
  expect(items.slice(0, 3).every((li) => within(li as HTMLElement).getByText('completed', { exact: false }))).toBe(true);
  expect(items[3]).toHaveAttribute('aria-current', 'step');
  expect(items[5].getAttribute('aria-current')).toBeNull();
});

test('the GMC number is checked for format, and the error clears on edit', async () => {
  renderDoctor(await stepEl('register'), { pathname: '/doctor/onboarding/register' });
  const gmc = screen.getByLabelText('GMC number');
  fireEvent.change(gmc, { target: { value: '12345' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByText('Enter your 7-digit GMC number.')).toBeInTheDocument();
  expect(gmc).toHaveAttribute('aria-invalid', 'true');
  expect(nav.router.replace).not.toHaveBeenCalled();
  fireEvent.change(gmc, { target: { value: '4567890' } });
  expect(screen.queryByText('Enter your 7-digit GMC number.')).not.toBeInTheDocument();
});

test('the happy path walks every step and the URL follows the reducer', async () => {
  const view = renderDoctor(await stepEl('register'), { pathname: '/doctor/onboarding/register' });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(nav.router.replace).toHaveBeenLastCalledWith('/doctor/onboarding/identity');
  view.setPath('/doctor/onboarding/identity');
  fireEvent.click(screen.getByRole('button', { name: 'Verify identity' }));
  expect(nav.router.replace).toHaveBeenLastCalledWith('/doctor/onboarding/credentials');
  view.setPath('/doctor/onboarding/credentials');
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(nav.router.replace).toHaveBeenLastCalledWith('/doctor/onboarding/indemnity');
  view.setPath('/doctor/onboarding/indemnity');
  fireEvent.click(screen.getByRole('button', { name: 'Use Dr Quick cover' }));
  expect(nav.router.replace).toHaveBeenLastCalledWith('/doctor/onboarding/skills');
  view.setPath('/doctor/onboarding/skills');
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(nav.router.replace).toHaveBeenLastCalledWith('/doctor/onboarding/done');
});

test('the own-certificate path is equally real and needs an expiry date', async () => {
  renderDoctor(await stepEl('indemnity'), { pathname: '/doctor/onboarding/indemnity' });
  expect(screen.getByRole('heading', { name: 'Dr Quick block cover', level: 2 })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Your own certificate', level: 2 })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Upload certificate' }));
  expect(screen.getByText('Enter the expiry date on your certificate.')).toBeInTheDocument();
  expect(nav.router.replace).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Expiry date'), { target: { value: '2027-08-31' } });
  fireEvent.click(screen.getByRole('button', { name: 'Upload certificate' }));
  expect(nav.router.replace).toHaveBeenLastCalledWith('/doctor/onboarding/skills');
});

test('the skills list toggles and every control is labelled', async () => {
  renderDoctor(await stepEl('skills'), { pathname: '/doctor/onboarding/skills' });
  const derm = screen.getByRole('checkbox', { name: 'Dermatology' });
  expect(derm).toHaveAttribute('aria-checked', 'false');
  expect(screen.getByRole('checkbox', { name: 'Minor illness' })).toHaveAttribute('aria-checked', 'true');
  fireEvent.click(derm);
  expect(screen.getByRole('checkbox', { name: 'Dermatology' })).toHaveAttribute('aria-checked', 'true');
});

test('no band card anywhere in onboarding, and the indemnity paths are the same shape', async () => {
  for (const step of ONBOARDING_STEPS) {
    const { container, unmount } = renderDoctor(await stepEl(step), { pathname: onboardingHref(step) });
    expect(container.querySelectorAll('[data-slot="card"][data-variant="band"]')).toHaveLength(0);
    unmount();
  }
});
```

- [ ] **Step 6: Run, then commit**

Run: `npx vitest run tests/doctor-onboarding.test.tsx` → green. `npm test`, `npm run typecheck`, `NEXT_PUBLIC_SITE_URL=http://localhost:3000 npm run build` → green; the build lists seven `/doctor/onboarding` paths.

```bash
git add 'app/(app)/doctor/onboarding' components/doctor/OnboardingFlow.tsx components/doctor/steps tests/doctor-onboarding.test.tsx
git commit -m "feat(doctor): onboarding — register to ready

Six steps, one per URL, with the stepper reading its status from the
reducer. The credentials step renders the same matrix the profile does;
the indemnity step draws block cover and an own certificate as two cards
of equal weight, because that is the decision this screen exists to force.
Two wordings change: a GP takes consultations, not shifts, and the page no
longer promises a reply within two working days.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 19: The shift — offline, online, nobody waiting

**Files:**
- Create: `app/(app)/doctor/session/[[...state]]/page.tsx`, `components/doctor/SessionScreen.tsx`, `components/doctor/session/Offline.tsx`, `components/doctor/session/OnlineIdle.tsx`, `components/doctor/session/NoPatientsWaiting.tsx`
- Test: `tests/doctor-session-idle.test.tsx`
- Read: `preview/doctor.html:366-403`, `preview/js/doctor.js:293-308`, `lib/session.ts` (Task 6), `lib/earnings.ts` (Task 3), `components/doctor/SessionProvider.tsx` (Task 13)

**Interfaces:**
- Consumes: `useSession()`; `SESSION_SCREENS`, `sessionHref` from `@/lib/session`; `earningsFor` from `@/lib/earnings`; `useFigures`, `useDataMode` from `@/lib/data-mode`; `DOCTOR`, `FLOOR`, `DEMAND_BY_HOUR` from `@/lib/fixtures`; `money`, `minutesLabel`, `daysLabel` from `@/lib/format`; `StatTile`, `PageHeader`, `EmptyState`, `LineChart`, `ChartLegend` from `@/components/app/*`.
- Produces: `SessionScreen` (the switch every session URL renders), `Offline`, `OnlineIdle`, `NoPatientsWaiting`. Tasks 20 and 21 add the remaining branches to `SessionScreen`'s map.

- [ ] **Step 1: The route**

`app/(app)/doctor/session/[[...state]]/page.tsx`, the same shape as onboarding's:

```tsx
import { notFound } from 'next/navigation';
import { SESSION_SCREENS } from '@/lib/session';
import { SessionScreen } from '@/components/doctor/SessionScreen';

export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ state: [] }, ...SESSION_SCREENS.map((state) => ({ state: [state] }))];
}

export default async function Page({ params }: { params: Promise<{ state?: string[] }> }) {
  const { state } = await params;
  if (state && (state.length > 1 || !(SESSION_SCREENS as readonly string[]).includes(state[0]))) notFound();
  return <SessionScreen />;
}
```

- [ ] **Step 2: `components/doctor/SessionScreen.tsx`**

```tsx
'use client';

import { useSession } from './SessionProvider';
import { Offline } from './session/Offline';
import { OnlineIdle } from './session/OnlineIdle';
import { NoPatientsWaiting } from './session/NoPatientsWaiting';
import { Offer } from './session/Offer';
import { Consultation } from './session/Consultation';
import { Complete } from './session/Complete';
import { Terminal } from './session/Terminal';

// One component per screen, keyed by the reducer's own state names, so a new
// state cannot be reachable by URL without a screen to render.
const SCREENS = {
  offline: Offline,
  'online-idle': OnlineIdle,
  'no-patients-waiting': NoPatientsWaiting,
  offer: Offer,
  'offer-consent-refused': Offer,
  consultation: Consultation,
  complete: Complete,
  'offer-declined': Terminal,
  'offer-timed-out': Terminal,
  'patient-no-show': Terminal,
} as const;

export function SessionScreen() {
  const { state } = useSession();
  const Screen = SCREENS[state.screen];
  return (
    <section data-screen={state.screen} className="mx-auto w-full max-w-[620px] data-[screen=consultation]:max-w-none">
      <Screen />
    </section>
  );
}
```

> `Offer` and `Terminal` are built in Task 20, `Consultation` and `Complete` in Task 21. Execute 19 → 20 → 21 in order; if 19 lands alone, stub the four missing files with a heading-only component so the build stays green, and delete the stubs in the tasks that own them.

- [ ] **Step 3: `Offline` — `preview/doctor.html:368-380`**

```tsx
'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/app/PageHeader';
import { StatTile } from '@/components/app/StatTile';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useDataMode, useFigures } from '@/lib/data-mode';
import { earningsFor } from '@/lib/earnings';
import { DOCTOR } from '@/lib/fixtures';
import { daysLabel, money } from '@/lib/format';
import { useDoctor } from '../DoctorProvider';
import { useSession } from '../SessionProvider';

export function Offline() {
  const { state, act } = useSession();
  const { blocked } = useDoctor();
  const { seeded } = useDataMode();
  const { shown } = useFigures();
  const earnings = earningsFor({ seeded, session: state.completed });
  return (
    <div className="grid gap-4">
      <PageHeader title="You're offline" lead="No offers will reach you until you go online." />
      <Card>
        <CardContent className="grid gap-6">
          <div className="grid grid-cols-2 gap-4">
            <StatTile size="sm" label="Earnings to date" value={shown(earnings.toDate, money)} />
            <StatTile size="sm" label="Consults completed" value={shown(earnings.toDateConsults)} />
            <StatTile size="sm" label="Credentials" value={shown(`${DOCTOR.credentialsVerified} of ${DOCTOR.credentialsTotal} verified`)} />
            <StatTile size="sm" label="Next revalidation" value={shown(DOCTOR.daysToRevalidation, daysLabel)} />
          </div>
          <div className="grid gap-2">
            <Button size="lg" className="w-full" disabled={blocked}
              onClick={() => act({ type: 'goOnline', now: Date.now() })}>Go online</Button>
            {blocked && <p className="text-fine text-ink-2">You can't go online — indemnity cover has expired.</p>}
          </div>
        </CardContent>
      </Card>
      <Button asChild variant="secondary" className="w-full"><Link href="/doctor">Back to dashboard</Link></Button>
    </div>
  );
}
```

- [ ] **Step 4: `OnlineIdle` — `preview/doctor.html:382-395`**

The four tiles are the preview's, and "Time online" is the signal that the platform is alive: it ticks from the provider's clock, so a GP who goes online at 9pm to an empty queue can see the shift running.

```tsx
'use client';

import { PageHeader } from '@/components/app/PageHeader';
import { StatTile } from '@/components/app/StatTile';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useDataMode, useFigures } from '@/lib/data-mode';
import { earningsFor } from '@/lib/earnings';
import { DOCTOR, FLOOR } from '@/lib/fixtures';
import { minutesLabel, money } from '@/lib/format';
import { useSession } from '../SessionProvider';

export function OnlineIdle() {
  const { state, act, secondsOnline } = useSession();
  const { seeded } = useDataMode();
  const { shown, live } = useFigures();
  const earnings = earningsFor({ seeded, session: state.completed });
  // Seeded, the GP is 42 minutes into a shift the fixtures describe; blank, the
  // only minutes that exist are the ones this session has actually run.
  const minutes = (seeded ? DOCTOR.shift.minutesOnline * 60 : 0) + secondsOnline;
  return (
    <div className="grid gap-4">
      <PageHeader title="Waiting for a patient" lead="Offers arrive with a 45-second window to accept or decline." />
      <Card>
        <CardContent className="grid grid-cols-2 gap-4">
          <StatTile size="sm" label="GPs online" value={shown(`${FLOOR.gpsOnline} of ${FLOOR.gpsNeeded}`)} />
          <StatTile size="sm" label="Patients waiting" value={shown(FLOOR.waiting)} />
          <StatTile size="sm" label="Time online" value={live(Math.floor(minutes / 60), minutesLabel)} />
          <StatTile size="sm" label="Earnings today" value={live(earnings.today, money)} />
        </CardContent>
      </Card>
      <Button size="lg" className="w-full"
        onClick={() => act({ type: 'offerArrives', consent: state.offersSeen % 2 === 0, now: Date.now() })}>Simulate an offer</Button>
      <Button variant="secondary" className="w-full" onClick={() => act({ type: 'goOffline' })}>Go offline</Button>
    </div>
  );
}
```

- [ ] **Step 5: `NoPatientsWaiting` — `preview/doctor.html:397-402`, plus the chart the spec asks for**

```tsx
'use client';

import { ChartLegend } from '@/components/app/ChartLegend';
import { EmptyState } from '@/components/app/EmptyState';
import { LineChart } from '@/components/app/LineChart';
import { PageHeader } from '@/components/app/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDataMode } from '@/lib/data-mode';
import { DEMAND_BY_HOUR } from '@/lib/fixtures';
import { useSession } from '../SessionProvider';

export function NoPatientsWaiting() {
  const { act } = useSession();
  const { seeded } = useDataMode();
  return (
    <div className="grid gap-4">
      <PageHeader title="You're online" lead="Nobody is waiting right now. You'll get an offer the moment a patient needs a GP." />
      <Card>
        <CardHeader><CardTitle role="heading" aria-level={2}>When it is worth being online</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          {seeded ? (
            <>
              <LineChart
                sets={[
                  { key: 'waiting', values: DEMAND_BY_HOUR.map((h) => h.waiting) },
                  { key: 'gps', values: DEMAND_BY_HOUR.map((h) => h.gps) },
                ]}
                labels={DEMAND_BY_HOUR.map((h) => h.hour)}
                height={150}
                ariaLabel="Patients waiting and GPs online, by hour"
              />
              <ChartLegend items={[{ label: 'Patients waiting', swatch: 'primary' }, { label: 'GPs online', swatch: 'ink-2' }]} />
              <p className="text-fine text-ink-2">Busiest between 17:00 and 20:00 on the days recorded.</p>
            </>
          ) : (
            <EmptyState>No demand recorded yet.</EmptyState>
          )}
        </CardContent>
      </Card>
      <Button variant="secondary" className="w-full" onClick={() => act({ type: 'goOffline' })}>Go offline</Button>
    </div>
  );
}
```

> The preview's `No patients in the queue.` empty line is replaced by the chart card the spec names ("the honest quiet state with the demand-by-hour chart pointing at when to come back"); the sentence under the chart is new and is listed in the report.

- [ ] **Step 6: `tests/doctor-session-idle.test.tsx`**

```tsx
// @vitest-environment jsdom
import { test, expect, beforeEach, vi } from 'vitest';
import { cleanup, screen, fireEvent, act as rtlAct } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
vi.mock('next/navigation', () => import('./helpers/next-navigation'));
import { renderDoctor, nav } from './helpers/render-doctor';
import SessionPage from '@/app/(app)/doctor/session/[[...state]]/page';

const T0 = Date.parse('2026-08-28T14:00:00Z');
const sessionEl = (state?: string) => SessionPage({ params: Promise.resolve(state ? { state: [state] } : {}) });
const tick = (ms: number) => rtlAct(() => { vi.advanceTimersByTime(ms); });

beforeEach(() => { cleanup(); vi.useRealTimers(); });

test('the three idle screens are reachable by URL', async () => {
  for (const state of ['offline', 'online-idle', 'no-patients-waiting'] as const) {
    const { container, unmount } = renderDoctor(await sessionEl(state), { pathname: `/doctor/session/${state}` });
    expect(container.querySelector(`[data-screen="${state}"]`)).toBeInTheDocument();
    unmount();
  }
});

test('offline shows what a GP has earned, and blank mode shows none of it', async () => {
  const seeded = renderDoctor(await sessionEl('offline'), { pathname: '/doctor/session/offline', query: 'data=seeded' });
  expect(screen.getByText('£1,560')).toBeInTheDocument();
  expect(screen.getByText('40')).toBeInTheDocument();
  expect(screen.getByText('7 of 7 verified')).toBeInTheDocument();
  expect(screen.getByText('120 days')).toBeInTheDocument();
  seeded.unmount(); cleanup();
  const { container } = renderDoctor(await sessionEl('offline'), { pathname: '/doctor/session/offline' });
  expect([...container.querySelectorAll('[data-slot="stat-value"]')].map((e) => e.textContent)).toEqual(['—', '—', '—', '—']);
});

test('an expired indemnity disables going online and says why', async () => {
  renderDoctor(await sessionEl('offline'), { pathname: '/doctor/session/offline', query: 'gate=indemnity-expired&data=seeded' });
  expect(screen.getByRole('button', { name: 'Go online' })).toBeDisabled();
  expect(screen.getByText("You can't go online — indemnity cover has expired.")).toBeInTheDocument();
});

test('going online moves the GP and the URL, keeping the data mode', async () => {
  renderDoctor(await sessionEl('offline'), { pathname: '/doctor/session/offline', query: 'data=seeded' });
  fireEvent.click(screen.getByRole('button', { name: 'Go online' }));
  expect(nav.router.replace).toHaveBeenLastCalledWith('/doctor/session/online-idle?data=seeded');
});

test('time online ticks from the shift figure when seeded and from nothing when blank', async () => {
  vi.useFakeTimers(); vi.setSystemTime(T0);
  const view = renderDoctor(await sessionEl('online-idle'), { pathname: '/doctor/session/online-idle', query: 'data=seeded' });
  expect(screen.getByText('42m')).toBeInTheDocument();
  tick(60_000);
  expect(screen.getByText('43m')).toBeInTheDocument();
  view.unmount(); cleanup(); vi.useRealTimers();
  const { container } = renderDoctor(await sessionEl('online-idle'), { pathname: '/doctor/session/online-idle' });
  const tiles = [...container.querySelectorAll('[data-slot="stat-value"]')].map((e) => e.textContent);
  expect(tiles).toEqual(['—', '—', '—', '—']); // zero minutes is a dash, not "0m"
});

test('simulating an offer moves to the offer, and going offline moves back', async () => {
  const view = renderDoctor(await sessionEl('online-idle'), { pathname: '/doctor/session/online-idle', query: 'data=seeded' });
  fireEvent.click(screen.getByRole('button', { name: 'Simulate an offer' }));
  expect(nav.router.replace).toHaveBeenLastCalledWith('/doctor/session/offer?data=seeded');
  view.unmount(); cleanup();
  renderDoctor(await sessionEl('no-patients-waiting'), { pathname: '/doctor/session/no-patients-waiting', query: 'data=seeded' });
  fireEvent.click(screen.getByRole('button', { name: 'Go offline' }));
  expect(nav.router.replace).toHaveBeenLastCalledWith('/doctor/session/offline?data=seeded');
});

test('the quiet state points at when to come back, and says nothing when there is nothing', async () => {
  const seeded = renderDoctor(await sessionEl('no-patients-waiting'), { pathname: '/doctor/session/no-patients-waiting', query: 'data=seeded' });
  expect(screen.getByText('Busiest between 17:00 and 20:00 on the days recorded.')).toBeInTheDocument();
  seeded.unmount(); cleanup();
  renderDoctor(await sessionEl('no-patients-waiting'), { pathname: '/doctor/session/no-patients-waiting' });
  expect(screen.getByText('No demand recorded yet.')).toBeInTheDocument();
});

test('no band card on any idle screen', async () => {
  for (const state of ['offline', 'online-idle', 'no-patients-waiting'] as const) {
    const { container, unmount } = renderDoctor(await sessionEl(state), { pathname: `/doctor/session/${state}`, query: 'data=seeded' });
    expect(container.querySelectorAll('[data-slot="card"][data-variant="band"]')).toHaveLength(0);
    unmount();
  }
});
```

- [ ] **Step 7: Run, then commit**

Run: `npx vitest run tests/doctor-session-idle.test.tsx` → green; `npm test`, `npm run typecheck` → green.

```bash
git add 'app/(app)/doctor/session' components/doctor/SessionScreen.tsx components/doctor/session tests/doctor-session-idle.test.tsx
git commit -m "feat(doctor): the shift — offline, online, nobody waiting

One URL per state, rendered from the reducer. Online and idle is drawn as
the default state of a shift rather than an edge case: the clock ticks so
the GP can see the platform is alive, and the quiet state points at the
hours worth coming back for instead of apologising.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 20: The offer window

**Files:**
- Create: `components/doctor/session/Offer.tsx`, `components/doctor/session/Terminal.tsx`
- Test: `tests/doctor-offer.test.tsx`
- Read: `preview/doctor.html:405-436` (both offer screens) and `499-515` (the three terminal cards), `preview/js/doctor.js:313-343`, `lib/session.ts` (Task 6), `components/app/Countdown.tsx` (Task 5), `components/app/Facts.tsx` (Task 9)

**Interfaces:**
- Consumes: `useSession()`; `Countdown`, `Facts`, `PageHeader` from `@/components/app/*`; `Button` from `@/components/ui/button`; `Card`, `CardContent` from `@/components/ui/card`; **from `@/lib/fixtures`, `OFFER` and `OFFER_CONSENT_REFUSED` and nothing else** — `tests/constraints.test.ts` scans this file's import list and fails on any other fixture name.
- Produces: `Offer` (renders both `offer` and `offer-consent-refused` from `state.offerConsent`), `Terminal` (renders `offer-declined`, `offer-timed-out`, `patient-no-show` from `state.screen`).

- [ ] **Step 1: `components/doctor/session/Offer.tsx`**

Three facts, a countdown, two buttons. Nothing else exists on this screen, because what a GP sees before accepting is the question the prototype is here to settle.

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { Countdown } from '@/components/app/Countdown';
import { Facts } from '@/components/app/Facts';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { OFFER, OFFER_CONSENT_REFUSED } from '@/lib/fixtures';
import { OFFER_WINDOW_SECONDS } from '@/lib/session';
import { useSession } from '../SessionProvider';

export function Offer() {
  const { state, act } = useSession();
  const facts = state.offerConsent ? OFFER : OFFER_CONSENT_REFUSED;
  const heading = useRef<HTMLHeadingElement>(null);

  // An offer arrives while the GP is looking at something else, and it lasts
  // 45 seconds. Focus moves to the heading so a keyboard or screen-reader user
  // starts at the top of it rather than wherever they happened to be.
  useEffect(() => { heading.current?.focus(); }, []);

  return (
    <div className="grid gap-4">
      <h1 ref={heading} tabIndex={-1} data-reveal
        className="font-display text-headline max-phone:text-headline-sm font-bold tracking-[-.04em] outline-none">New offer</h1>
      <Card>
        <CardContent>
          <Facts
            items={[
              ['Presenting complaint', facts.presentingComplaint],
              ['Age band', facts.ageBand],
              ['NHS GP summary consent', facts.nhsGpConsent ? 'Yes' : 'No'],
            ]}
          />
        </CardContent>
      </Card>
      {!state.offerConsent && (
        // A constraint on what can be done safely, not a warning: the colour
        // stays ink, and the sentence says what to do about it.
        <p className="text-ink-2">
          This patient has not consented to share this consultation with their NHS GP. Without access to
          their record, you may be unable to prescribe safely — decline if you don't have enough
          information to treat them.
        </p>
      )}
      <Countdown remaining={state.offerRemaining} total={OFFER_WINDOW_SECONDS} />
      <Button size="lg" className="w-full" onClick={() => act({ type: 'accept', now: Date.now() })}>Accept</Button>
      <Button variant="secondary" className="w-full" onClick={() => act({ type: 'decline' })}>Decline</Button>
    </div>
  );
}
```

- [ ] **Step 2: `components/doctor/session/Terminal.tsx` — `preview/doctor.html:499-515`, verbatim**

```tsx
'use client';

import { PageHeader } from '@/components/app/PageHeader';
import { Button } from '@/components/ui/button';
import { useSession } from '../SessionProvider';

// Each terminal state states the consequence plainly and offers one way back.
// A GP who declines needs to know the patient is not sitting waiting on them.
const COPY = {
  'offer-declined': {
    title: 'Offer declined',
    body: 'The patient has been returned to the queue.',
  },
  'offer-timed-out': {
    title: 'Offer window closed',
    body: "You didn't respond within 45 seconds, so the offer moved to another GP.",
  },
  'patient-no-show': {
    title: "Patient didn't join",
    body: "We'll let the patient know and release you back to the queue. No outcome is needed.",
  },
} as const;

export function Terminal() {
  const { state, act } = useSession();
  const copy = COPY[state.screen as keyof typeof COPY];
  return (
    <div className="grid gap-4">
      <PageHeader title={copy.title} />
      <p>{copy.body}</p>
      <Button size="lg" className="w-full" onClick={() => act({ type: 'backOnline', now: Date.now() })}>Back online</Button>
    </div>
  );
}
```

- [ ] **Step 3: `tests/doctor-offer.test.tsx`**

```tsx
// @vitest-environment jsdom
import { test, expect, beforeEach, vi } from 'vitest';
import { cleanup, screen, fireEvent, act as rtlAct } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
vi.mock('next/navigation', () => import('./helpers/next-navigation'));
import { renderDoctor, nav } from './helpers/render-doctor';
import SessionPage from '@/app/(app)/doctor/session/[[...state]]/page';

const T0 = Date.parse('2026-08-28T14:00:00Z');
const sessionEl = (state: string) => SessionPage({ params: Promise.resolve({ state: [state] }) });
const tick = (ms: number) => rtlAct(() => { vi.advanceTimersByTime(ms); });

beforeEach(() => { cleanup(); vi.useRealTimers(); });

test('the offer shows exactly three facts and nothing that belongs after acceptance', async () => {
  for (const state of ['offer', 'offer-consent-refused'] as const) {
    const { container, unmount } = renderDoctor(await sessionEl(state), { pathname: `/doctor/session/${state}`, query: 'data=seeded' });
    const terms = [...container.querySelectorAll('[data-slot="facts"] dt')].map((d) => d.textContent?.trim());
    expect(terms).toEqual(['Presenting complaint', 'Age band', 'NHS GP summary consent']);
    expect(container.querySelectorAll('[data-slot="facts"] dd')).toHaveLength(3);
    expect(container.textContent).not.toMatch(/full record|clinical history|past consultations|NHS number|date of birth/i);
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
    unmount();
  }
});

test('the countdown is drawn, announced, and takes focus at the heading', async () => {
  const { container } = renderDoctor(await sessionEl('offer'), { pathname: '/doctor/session/offer', query: 'data=seeded' });
  expect(container.querySelector('[role="progressbar"]')).toHaveAttribute('aria-valuenow', '45');
  expect(container.querySelector('[aria-live="assertive"]')).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1, name: 'New offer' })).toHaveFocus();
});

test('the window announces at 30, 15 and 5 only, then hands the offer on', async () => {
  vi.useFakeTimers(); vi.setSystemTime(T0);
  const { container } = renderDoctor(await sessionEl('offer'), { pathname: '/doctor/session/offer', query: 'data=seeded' });
  const live = container.querySelector('[aria-live="assertive"]')!;
  const numerals = container.querySelector('[data-slot="countdown-value"]')!;
  expect(live).toHaveTextContent('45 seconds to accept');
  tick(14_000); expect(live).toHaveTextContent('45 seconds to accept');   // 31s: nothing new
  tick(1_000);  expect(live).toHaveTextContent('30 seconds left to accept');
  tick(1_000);  expect(live).toHaveTextContent('30 seconds left to accept'); // 29s: still silent
  tick(14_000); expect(live).toHaveTextContent('15 seconds left to accept');
  tick(10_000); expect(live).toHaveTextContent('5 seconds left to accept');
  expect(numerals.className).toContain('text-error');
  tick(5_000);
  expect(nav.router.replace).toHaveBeenLastCalledWith('/doctor/session/offer-timed-out?data=seeded');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Offer window closed');
  expect(screen.getByText("You didn't respond within 45 seconds, so the offer moved to another GP.")).toBeInTheDocument();
});

test('a hidden tab does not stretch the window', async () => {
  vi.useFakeTimers(); vi.setSystemTime(T0);
  renderDoctor(await sessionEl('offer'), { pathname: '/doctor/session/offer', query: 'data=seeded' });
  rtlAct(() => { vi.setSystemTime(T0 + 60_000); vi.advanceTimersByTime(1_000); });
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Offer window closed');
});

test('accepting starts the consultation; declining says where the offer went', async () => {
  const view = renderDoctor(await sessionEl('offer'), { pathname: '/doctor/session/offer', query: 'data=seeded' });
  fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
  expect(nav.router.replace).toHaveBeenLastCalledWith('/doctor/session/consultation?data=seeded');
  view.unmount(); cleanup(); nav.router.replace.mockReset();
  renderDoctor(await sessionEl('offer'), { pathname: '/doctor/session/offer', query: 'data=seeded' });
  fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
  expect(nav.router.replace).toHaveBeenLastCalledWith('/doctor/session/offer-declined?data=seeded');
  expect(screen.getByText('The patient has been returned to the queue.')).toBeInTheDocument();
});

test('the consent-refused fork states the constraint without colouring it', async () => {
  const { container } = renderDoctor(await sessionEl('offer-consent-refused'), { pathname: '/doctor/session/offer-consent-refused', query: 'data=seeded' });
  expect(screen.getByText(/has not consented to share this consultation/)).toBeInTheDocument();
  const dds = [...container.querySelectorAll('[data-slot="facts"] dd')].map((d) => d.textContent);
  expect(dds[2]).toBe('No');
  const errors = [...container.querySelectorAll('.text-error')];
  expect(errors.every((el) => el.closest('[data-slot="countdown-value"]'))).toBe(true);
});

test('every terminal state is reachable by URL and offers one way back', async () => {
  for (const state of ['offer-declined', 'offer-timed-out', 'patient-no-show'] as const) {
    const { container, unmount } = renderDoctor(await sessionEl(state), { pathname: `/doctor/session/${state}`, query: 'data=seeded' });
    expect(container.querySelector(`[data-screen="${state}"]`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back online' }));
    expect(nav.router.replace).toHaveBeenLastCalledWith('/doctor/session/online-idle?data=seeded');
    unmount();
  }
});
```

- [ ] **Step 4: Run, then commit**

Run: `npx vitest run tests/doctor-offer.test.tsx` → green. `npm test` → green, including the constraints test's scan of `Offer.tsx` (its only fixture imports are `OFFER` and `OFFER_CONSENT_REFUSED`, and no post-acceptance word appears in it).

```bash
git add components/doctor/session/Offer.tsx components/doctor/session/Terminal.tsx tests/doctor-offer.test.tsx
git commit -m "feat(doctor): the offer window

Presenting complaint, age band and consent — the three facts a GP gets
before accepting, and nothing else, with a 45-second window on the wall
clock so a backgrounded tab cannot hold a patient. The consent-refused
fork states the constraint in ink rather than colouring it as an alarm.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 21: Consultation, Semble handoff and completion

**Files:**
- Create: `components/doctor/session/Consultation.tsx`, `components/doctor/SembleDialog.tsx`, `components/doctor/session/Complete.tsx`
- Test: `tests/doctor-consultation.test.tsx`
- Read: `preview/doctor.html:438-470`, `preview/js/doctor.js:308, 323-328`, `lib/booking.ts` (`formatClock`, `nextConsultationId`), `lib/session.ts`, `components/ui/dialog.tsx`

**Interfaces:**
- Consumes: `useSession()`; `formatClock`, `nextConsultationId` from `@/lib/booking`; `OFFER`, `OFFER_CONSENT_REFUSED`, `FEE`, `DOCTOR_DASHBOARD` from `@/lib/fixtures`; `money` from `@/lib/format`; `Facts`, `PageHeader` from `@/components/app/*`; `Dialog…` from `@/components/ui/dialog`.
- Produces: `Consultation`, `SembleDialog`, `Complete`.

- [ ] **Step 1: `components/doctor/SembleDialog.tsx`**

The handoff is the decision this screen exists to settle, so the dialog describes the friction rather than smoothing it: no field, no primary action, nothing that looks like the record living here.

```tsx
'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';

export function SembleDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" className="w-full">Open in Semble</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Semble opens in another window</DialogTitle>
          <DialogDescription>
            Notes, prescribing and the consultation outcome are written in Semble during the call.
            Dr Quick keeps the video, the timer and the payment, and never holds the clinical record.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: `components/doctor/session/Consultation.tsx` — `preview/doctor.html:438-458`**

```tsx
'use client';

import { PageHeader } from '@/components/app/PageHeader';
import { Facts } from '@/components/app/Facts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatClock, nextConsultationId } from '@/lib/booking';
import { useDataMode } from '@/lib/data-mode';
import { DOCTOR_DASHBOARD, OFFER, OFFER_CONSENT_REFUSED } from '@/lib/fixtures';
import { SembleDialog } from '../SembleDialog';
import { useSession } from '../SessionProvider';

const clockTime = (ms: number) =>
  new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export function Consultation() {
  const { state, act, consultSeconds } = useSession();
  const { seeded } = useDataMode();
  const facts = state.offerConsent ? OFFER : OFFER_CONSENT_REFUSED;

  const finish = () => {
    const now = Date.now();
    const existing = [...state.completed, ...(seeded ? DOCTOR_DASHBOARD.recent : [])];
    act({ type: 'complete', now, id: nextConsultationId(existing), when: `Today, ${clockTime(now)}` });
  };

  return (
    <div className="grid gap-6">
      <PageHeader title="Consultation" />
      <div className="flex flex-wrap items-start gap-6">
        {/* Never a fake stream: a labelled placeholder that says what it is. */}
        <div className="grid aspect-[3/4] max-h-[42vh] w-full max-w-[320px] place-items-center rounded-xl bg-fill px-4 text-center text-body text-ink-2">
          Patient video — not recorded
        </div>
        <div className="grid min-w-[280px] flex-1 gap-4">
          <Card>
            <CardHeader><CardTitle role="heading" aria-level={2}>Patient context</CardTitle></CardHeader>
            <CardContent>
              <Facts
                items={[
                  ['Complaint', facts.presentingComplaint],
                  ['Age band', facts.ageBand],
                  ['NHS GP summary', facts.nhsGpConsent ? 'Consent given' : 'Consent refused'],
                  ['Recording', 'This call is not recorded'],
                ]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle role="heading" aria-level={2}>Time in consultation</CardTitle></CardHeader>
            <CardContent>
              <span data-slot="consult-clock"
                className="font-display text-4xl font-bold leading-none tracking-[-.03em] tabular-nums">
                {formatClock(consultSeconds)}
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle role="heading" aria-level={2}>Clinical record</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <p>Notes, prescribing and the consultation outcome are recorded in Semble, not here.</p>
              <SembleDialog />
            </CardContent>
          </Card>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button onClick={finish}>Finish consultation</Button>
        <Button variant="secondary" onClick={() => act({ type: 'noShow' })}>Patient didn't join</Button>
      </div>
    </div>
  );
}
```

> "Finish consultation" never mentions Semble. A GP opens Semble repeatedly during a call and finishes it once; one label for both would make the handoff look frictionless, which is exactly the question this screen is asking honestly.

- [ ] **Step 3: `components/doctor/session/Complete.tsx` — `preview/doctor.html:460-470`**

```tsx
'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/app/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FEE } from '@/lib/fixtures';
import { money } from '@/lib/format';
import { useSession } from '../SessionProvider';

export function Complete() {
  const { act } = useSession();
  return (
    <div className="grid gap-4">
      <PageHeader title="Consultation complete" />
      <Card><CardContent>Outcome recorded in Semble.</CardContent></Card>
      {/* The fee is a product fact, not a platform figure: it renders in both modes. */}
      <Card><CardContent>{`Payment confirmed — ${money(FEE)} for this consultation.`}</CardContent></Card>
      <Button size="lg" className="w-full" onClick={() => act({ type: 'backOnline', now: Date.now() })}>Back online</Button>
      <Button asChild variant="secondary" className="w-full"><Link href="/doctor">Back to dashboard</Link></Button>
    </div>
  );
}
```

- [ ] **Step 4: `tests/doctor-consultation.test.tsx`**

```tsx
// @vitest-environment jsdom
import { test, expect, beforeEach, vi } from 'vitest';
import { cleanup, screen, fireEvent, act as rtlAct } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
vi.mock('next/navigation', () => import('./helpers/next-navigation'));
import { renderDoctor, nav } from './helpers/render-doctor';
import { setDocumentHidden } from './helpers/dom-stubs';
import SessionPage from '@/app/(app)/doctor/session/[[...state]]/page';
import { DoctorHome } from '@/components/doctor/DoctorHome';
import { Earnings } from '@/components/doctor/Earnings';

const T0 = Date.parse('2026-08-28T14:00:00Z');
const sessionEl = (state: string) => SessionPage({ params: Promise.resolve({ state: [state] }) });
const tick = (ms: number) => rtlAct(() => { vi.advanceTimersByTime(ms); });

beforeEach(() => { cleanup(); vi.useRealTimers(); });

test('the consultation shows a placeholder, the context and the handoff — and no editor', async () => {
  const { container } = renderDoctor(await sessionEl('consultation'), { pathname: '/doctor/session/consultation', query: 'data=seeded' });
  expect(screen.getByText('Patient video — not recorded')).toBeInTheDocument();
  const terms = [...container.querySelectorAll('[data-slot="facts"] dt')].map((d) => d.textContent);
  expect(terms).toEqual(['Complaint', 'Age band', 'NHS GP summary', 'Recording']);
  expect(screen.getByText('Notes, prescribing and the consultation outcome are recorded in Semble, not here.')).toBeInTheDocument();
  expect(container.querySelector('textarea')).toBeNull();
  expect(container.querySelector('[contenteditable]')).toBeNull();
});

test('opening Semble explains the handoff and does not finish the consultation', async () => {
  renderDoctor(await sessionEl('consultation'), { pathname: '/doctor/session/consultation', query: 'data=seeded' });
  fireEvent.click(screen.getByRole('button', { name: 'Open in Semble' }));
  expect(await screen.findByRole('dialog')).toHaveTextContent('never holds the clinical record');
  expect(nav.router.replace).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Finish consultation' }).textContent).not.toMatch(/semble/i);
});

test('the clock reads mm:ss from timestamps and catches up after a hidden tab', async () => {
  vi.useFakeTimers(); vi.setSystemTime(T0);
  const { container } = renderDoctor(await sessionEl('consultation'), { pathname: '/doctor/session/consultation', query: 'data=seeded' });
  const clock = container.querySelector('[data-slot="consult-clock"]')!;
  expect(clock).toHaveTextContent('00:00');
  tick(65_000); expect(clock).toHaveTextContent('01:05');
  rtlAct(() => setDocumentHidden(true));
  tick(30_000); expect(clock).toHaveTextContent('01:05');
  rtlAct(() => setDocumentHidden(false));
  tick(1_000);  expect(clock).toHaveTextContent('01:36');
});

test('finishing records the outcome in Semble and confirms the fee', async () => {
  renderDoctor(await sessionEl('consultation'), { pathname: '/doctor/session/consultation', query: 'data=seeded' });
  fireEvent.click(screen.getByRole('button', { name: 'Finish consultation' }));
  expect(nav.router.replace).toHaveBeenLastCalledWith('/doctor/session/complete?data=seeded');
  expect(screen.getByText('Outcome recorded in Semble.')).toBeInTheDocument();
  expect(screen.getByText('Payment confirmed — £39 for this consultation.')).toBeInTheDocument();
});

test("a patient who doesn't join costs nothing and needs no outcome", async () => {
  renderDoctor(await sessionEl('consultation'), { pathname: '/doctor/session/consultation', query: 'data=seeded' });
  fireEvent.click(screen.getByRole('button', { name: "Patient didn't join" }));
  expect(nav.router.replace).toHaveBeenLastCalledWith('/doctor/session/patient-no-show?data=seeded');
  expect(screen.getByText(/No outcome is needed\./)).toBeInTheDocument();
});

// The highest-severity rule in the plan, exercised end to end: a consultation this
// session produced must appear, and must move the money by exactly one fee.
test('one completed consultation moves the dashboard and the payout by exactly £39', async () => {
  vi.useFakeTimers(); vi.setSystemTime(T0);
  const view = renderDoctor(await sessionEl('consultation'), { pathname: '/doctor/session/consultation', query: 'data=seeded' });
  tick(545_000);
  fireEvent.click(screen.getByRole('button', { name: 'Finish consultation' }));
  view.setPath('/doctor');
  view.rerenderWith(<DoctorHome />);
  expect(screen.getByText('£156')).toBeInTheDocument();          // earnings today: 117 + 39
  view.setPath('/doctor/earnings');
  view.rerenderWith(<Earnings />);
  expect(screen.getByText('£507')).toBeInTheDocument();          // next payout: 468 + 39
  expect(screen.getByText('£1,599')).toBeInTheDocument();        // earned to date: 1560 + 39
});

test('blank mode turns a dash into exactly one fee, and nothing else', async () => {
  vi.useFakeTimers(); vi.setSystemTime(T0);
  const view = renderDoctor(await sessionEl('consultation'), { pathname: '/doctor/session/consultation' });
  tick(545_000);
  fireEvent.click(screen.getByRole('button', { name: 'Finish consultation' }));
  view.setPath('/doctor');
  view.rerenderWith(<DoctorHome />);
  expect(screen.getByText('£39')).toBeInTheDocument();
  expect(screen.getAllByText('—').length).toBeGreaterThan(0);
});
```

> `renderDoctor` gains one helper for these two tests: `rerenderWith(node)` re-renders the same provider tree around a different screen, which is what a client navigation does. Add it to `tests/helpers/render-doctor.tsx` in Task 13 alongside `setPath` (`rerenderWith(node) { result.rerender(wrap(node)); }`) — the providers live in the layout, so their state survives, which is the point being tested.

- [ ] **Step 5: Run, then commit**

Run: `npx vitest run tests/doctor-consultation.test.tsx` → green; `npm test`, `npm run typecheck` → green.

```bash
git add components/doctor/session/Consultation.tsx components/doctor/session/Complete.tsx components/doctor/SembleDialog.tsx tests/doctor-consultation.test.tsx
git commit -m "feat(doctor): consultation, Semble handoff and completion

The clinical record is written in Semble and the screen says so: a
handoff panel and a dialog that describes the context switch rather than
hiding it, and no notes editor anywhere. Finishing records the
consultation this session produced, and a test pins the earnings delta at
exactly one fee on both the dashboard and the payout.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 22: Live operations

**Files:**
- Create: `components/admin/LiveFloor.tsx`
- Modify: `app/(app)/admin/page.tsx` (Task 13's placeholder)
- Test: `tests/admin-floor.test.tsx`
- Read: `preview/admin.html:35-81` (the floor markup) and `219-223, 298-318` (the figures, the cover gap and the chart), `lib/live.ts`, `lib/booking.ts` (`waitEstimate`)

**Interfaces:**
- Consumes: `useDataMode`, `useFigures` from `@/lib/data-mode`; `FLOOR`, `DEMAND_BY_HOUR` from `@/lib/fixtures`; `waitEstimate` from `@/lib/booking`; `tickQueue`, `formatEta` from `@/lib/live`; `useLiveInterval` from `@/hooks/use-live-interval`; `StatTile`, `EmptyState`, `PageHeader`, `LineChart`, `ChartLegend` from `@/components/app/*`.
- Produces: `LiveFloor`. Task 24 reuses `DEMAND_BY_HOUR` and the same two-series chart for coverage.

- [ ] **Step 1: `components/admin/LiveFloor.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { ChartLegend } from '@/components/app/ChartLegend';
import { EmptyState } from '@/components/app/EmptyState';
import { LineChart } from '@/components/app/LineChart';
import { PageHeader } from '@/components/app/PageHeader';
import { StatTile } from '@/components/app/StatTile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useLiveInterval } from '@/hooks/use-live-interval';
import { waitEstimate } from '@/lib/booking';
import { useDataMode, useFigures } from '@/lib/data-mode';
import { DEMAND_BY_HOUR, FLOOR } from '@/lib/fixtures';
import { formatEta, tickQueue } from '@/lib/live';

export function LiveFloor() {
  const { seeded } = useDataMode();
  const { shown } = useFigures();

  // The floor is the screen someone leaves open during an evening peak, so the
  // queue has to move. It runs the same tickQueue the patient's own wait runs,
  // and loops back to the fixture when it empties — a prototype floor that
  // drains to nothing and stops reads as a dead platform, not a quiet one.
  const [queue, setQueue] = useState(() => waitEstimate(FLOOR));
  useLiveInterval(() => {
    setQueue((q) => (q.etaSeconds <= 1 ? waitEstimate(FLOOR) : tickQueue(q)));
  }, 1000, seeded);

  const covered = Math.min(1, FLOOR.gpsOnline / Math.max(FLOOR.gpsNeeded, 1));
  const short = FLOOR.gpsNeeded - FLOOR.gpsOnline;
  const coverNote = !seeded
    ? 'No GPs online and no queue yet.'
    : short <= 0
      ? 'Cover is met for the current queue.'
      : `${short} more GP online would clear the queue at the current rate.`;

  return (
    <section data-screen="floor" className="grid gap-8">
      <PageHeader title="Live operations" />

      <div className="grid gap-4 max-cols:grid-cols-1 grid-cols-3">
        <Card className="col-span-2 max-cols:col-span-1">
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>Right now</CardTitle>
            <span className="text-fine text-ink-2">England</span>
          </CardHeader>
          <CardContent className="grid grid-cols-4 gap-4 max-phone:grid-cols-2">
            <StatTile label="Patients waiting" value={shown(queue.position)} />
            <StatTile label="GPs online vs needed" value={shown(`${FLOOR.gpsOnline} of ${FLOOR.gpsNeeded}`)} />
            <StatTile label="Consults in progress" value={shown(FLOOR.inProgress)} />
            <StatTile label="Queue wait" value={shown(formatEta(queue.etaSeconds))} />
          </CardContent>
        </Card>

        {/* The one band on this screen, and only when cover is actually short:
            a dark fill on a met queue would dramatise a number that is fine. */}
        <Card variant={seeded && short > 0 ? 'band' : 'default'}>
          <CardHeader><CardTitle role="heading" aria-level={2}>Cover gap</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-fine">{coverNote}</p>
            <Progress value={seeded ? Math.round(covered * 100) : 0} aria-label="Cover against the current queue" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle role="heading" aria-level={2}>Where supply thins first</CardTitle></CardHeader>
        {/* Equal weight with the headline tiles, by design: these four are where
            the model breaks before anyone notices the queue. */}
        <CardContent className="grid grid-cols-4 gap-4 max-cols:grid-cols-2">
          <StatTile label="Offers declined" value={shown(FLOOR.offersDeclined)} />
          <StatTile label="Offers timed out" value={shown(FLOOR.offersTimedOut)} />
          <StatTile label="Failed matches" value={shown(FLOOR.failedMatches)} />
          <StatTile label="No-shows" value={shown(FLOOR.noShows)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle role="heading" aria-level={2}>Demand against cover, by hour</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          {seeded ? (
            <>
              <LineChart
                sets={[
                  { key: 'waiting', values: DEMAND_BY_HOUR.map((h) => h.waiting) },
                  { key: 'gps', values: DEMAND_BY_HOUR.map((h) => h.gps) },
                ]}
                labels={DEMAND_BY_HOUR.map((h) => h.hour)}
                height={150}
                ariaLabel="Patients waiting against GPs online, by hour"
              />
              <ChartLegend items={[{ label: 'Patients waiting', swatch: 'primary' }, { label: 'GPs online', swatch: 'ink-2' }]} />
            </>
          ) : (
            <EmptyState>No demand recorded yet.</EmptyState>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
```

`app/(app)/admin/page.tsx` replaces its placeholder with `export default function Page() { return <LiveFloor />; }` and keeps `export const dynamic = 'force-static'`.

> Two additions to the preview, both listed in the report: the "Queue wait" tile (the spec's fourth "right now" figure) and the ticking itself (`admin.html` was static after boot). `FLOOR.noShows` is `0`, so it renders as a dash — the zero-as-dash rule applies to a seeded zero exactly as it does to a blank one.

- [ ] **Step 2: `tests/admin-floor.test.tsx`**

```tsx
// @vitest-environment jsdom
import { test, expect, beforeEach, vi } from 'vitest';
import { cleanup, screen, within, act as rtlAct } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
vi.mock('next/navigation', () => import('./helpers/next-navigation'));
import { renderAdmin } from './helpers/render-doctor';
import { LiveFloor } from '@/components/admin/LiveFloor';

const tick = (ms: number) => rtlAct(() => { vi.advanceTimersByTime(ms); });
beforeEach(() => { cleanup(); vi.useRealTimers(); });

test('blank mode claims nothing: every figure a dash, no chart, no band', () => {
  const { container } = renderAdmin(<LiveFloor />, {});
  expect([...container.querySelectorAll('[data-slot="stat-value"]')].every((e) => e.textContent === '—')).toBe(true);
  expect(screen.getByText('No demand recorded yet.')).toBeInTheDocument();
  expect(screen.getByText('No GPs online and no queue yet.')).toBeInTheDocument();
  expect(container.querySelectorAll('[data-slot="card"][data-variant="band"]')).toHaveLength(0);
  expect(container.querySelector('svg[role="img"]')).toBeNull();
});

test('seeded, the floor reads the fixtures and the cover gap takes the band', () => {
  const { container } = renderAdmin(<LiveFloor />, { query: 'data=seeded' });
  expect(screen.getByText('3')).toBeInTheDocument();               // queue position from waitEstimate(4, 2)
  expect(screen.getByText('2 of 3')).toBeInTheDocument();
  expect(screen.getByText('about 3 minutes')).toBeInTheDocument(); // 135s
  expect(screen.getByText('1 more GP online would clear the queue at the current rate.')).toBeInTheDocument();
  expect(container.querySelectorAll('[data-slot="card"][data-variant="band"]')).toHaveLength(1);
  expect(container.querySelector('svg[role="img"]')).toBeInTheDocument();
});

test('the four failure counters carry the headline weight, and a seeded zero is still a dash', () => {
  const { container } = renderAdmin(<LiveFloor />, { query: 'data=seeded' });
  const tiles = [...container.querySelectorAll('[data-slot="stat-tile"]')];
  const byLabel = (label: string) => tiles.find((t) => t.textContent?.includes(label))!;
  for (const label of ['Offers declined', 'Offers timed out', 'Failed matches', 'No-shows']) {
    expect(byLabel(label).getAttribute('data-size')).toBe(byLabel('Patients waiting').getAttribute('data-size'));
  }
  expect(within(byLabel('No-shows') as HTMLElement).getByText('—')).toBeInTheDocument();
});

test('the queue ticks while seeded, never while blank, and stops on unmount', () => {
  vi.useFakeTimers();
  const seeded = renderAdmin(<LiveFloor />, { query: 'data=seeded' });
  expect(screen.getByText('about 3 minutes')).toBeInTheDocument();
  tick(96_000);
  expect(screen.getByText('about 1 minute')).toBeInTheDocument();
  expect(screen.getByText('1')).toBeInTheDocument();               // position advanced at the 45s boundaries
  seeded.unmount(); cleanup();
  const blank = renderAdmin(<LiveFloor />, {});
  tick(120_000);
  expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  blank.unmount();
  expect(() => tick(60_000)).not.toThrow();
});
```

- [ ] **Step 3: Run, then commit**

Run: `npx vitest run tests/admin-floor.test.tsx` → green; `npm test`, `npm run typecheck` → green.

```bash
git add components/admin/LiveFloor.tsx 'app/(app)/admin/page.tsx' tests/admin-floor.test.tsx
git commit -m "feat(admin): live operations

The floor opens on what is happening now and gives the four failure
counters the same weight as the headline numbers, because supply thins
there first. The cover gap takes the screen's one dark fill, and only
while cover is actually short.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 23: Clinical governance and safety

**Files:**
- Create: `components/admin/Governance.tsx`
- Modify: `app/(app)/admin/governance/page.tsx`
- Test: `tests/admin-governance.test.tsx`
- Read: `preview/admin.html:83-142` (the markup) and `244-273` (the register, the outlier table and the counts), `lib/fixtures.ts` `GOVERNANCE`, `PRESCRIBING`, `BREAK_GLASS_LOG`, `AUDIT_LOG`

**Interfaces:**
- Consumes: `useFigures`, `useDataMode`; `GOVERNANCE`, `PRESCRIBING`, `BREAK_GLASS_LOG`, `AUDIT_LOG` from `@/lib/fixtures`; `StatTile`, `PageHeader` from `@/components/app/*`; `Table…`, `Badge`, `Card…` from `@/components/ui/*`.
- Produces: `Governance`.

- [ ] **Step 1: `components/admin/Governance.tsx`**

```tsx
'use client';

import { PageHeader } from '@/components/app/PageHeader';
import { StatTile } from '@/components/app/StatTile';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useFigures } from '@/lib/data-mode';
import { AUDIT_LOG, BREAK_GLASS_LOG, GOVERNANCE, PRESCRIBING } from '@/lib/fixtures';

export function Governance() {
  const { shown, seedList } = useFigures();
  const prescribing = seedList(PRESCRIBING);
  const breakGlass = seedList(BREAK_GLASS_LOG);
  const audit = seedList(AUDIT_LOG);

  // A breach count is only meaningful per prescriber: an aggregate hides the
  // one outlier, which is exactly how the failure this register exists to
  // prevent went unnoticed elsewhere. Flagged prescribers lead the table.
  const rows = [...prescribing].sort((a, b) => Number(b.restrictedFlagged > 0) - Number(a.restrictedFlagged > 0));

  return (
    <section data-screen="governance" className="grid gap-8">
      <PageHeader title="Clinical governance and safety" />

      <div className="grid grid-cols-3 gap-4 max-cols:grid-cols-2 max-phone:grid-cols-1">
        <StatTile size="sm" label="Incidents" value={shown(GOVERNANCE.incidents)} />
        <StatTile size="sm" label="Safeguarding referrals" value={shown(GOVERNANCE.safeguarding)} />
        <StatTile size="sm" label="Red-flag escalations" value={shown(GOVERNANCE.redFlagEscalations)}
          note={`${shown(GOVERNANCE.reachedEmergencyScreen)} reached the 999 screen`} />
        <StatTile size="sm" label="Complaints" value={shown(GOVERNANCE.complaints)}
          note={`median ${shown(GOVERNANCE.complaintResolutionDays)} days to resolve`} />
        <StatTile size="sm" label="Break-glass access events" value={shown(GOVERNANCE.breakGlass)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>Restricted items register</CardTitle>
          {/* Policy, not activity: the categories are true before a single
              consultation happens, so they render in both data modes. */}
          <p className="text-body text-ink-2">
            Schedule 2 and Schedule 3 controlled drugs are prohibited platform-wide. Every breach
            against this register is counted.
          </p>
        </CardHeader>
        <CardContent>
          <Table stack="phone">
            <TableCaption className="sr-only">Restricted items register</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Category</TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col">Breaches</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {GOVERNANCE.restrictedRegister.map((entry) => (
                <TableRow key={entry.category}>
                  <TableHead scope="row" className="font-semibold text-ink normal-case tracking-normal">{entry.category}</TableHead>
                  <TableCell label="Status">{entry.status}</TableCell>
                  <TableCell label="Breaches">{shown(entry.breaches, (n) => `${n} breaches`)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle role="heading" aria-level={2}>Prescribing against the register, per prescriber</CardTitle></CardHeader>
        <CardContent>
          <Table stack="phone">
            <TableCaption className="sr-only">Prescribing against the restricted items register, by prescriber</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">GP</TableHead>
                <TableHead scope="col">Consults</TableHead>
                <TableHead scope="col">Flagged against register</TableHead>
                <TableHead scope="col">Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-ink-2">No prescribing recorded yet.</TableCell></TableRow>
              ) : rows.map((gp) => (
                <TableRow key={gp.ref} className={gp.restrictedFlagged > 0 ? 'font-semibold' : undefined}>
                  <TableHead scope="row" className="font-semibold text-ink normal-case tracking-normal">{gp.ref}</TableHead>
                  <TableCell label="Consults" className="tabular-nums">{gp.consults}</TableCell>
                  <TableCell label="Flagged">
                    {gp.restrictedFlagged > 0
                      ? <Badge variant="destructive">{gp.restrictedFlagged} flagged</Badge>
                      : `${gp.restrictedFlagged} flagged`}
                  </TableCell>
                  <TableCell label="Rate" className="tabular-nums">
                    {gp.consults === 0 ? '—' : `${((gp.restrictedFlagged / gp.consults) * 100).toFixed(1)}%`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle role="heading" aria-level={2}>Break-glass access log</CardTitle></CardHeader>
        <CardContent>
          <Table stack="phone">
            <TableCaption className="sr-only">Break-glass record access, with the reason for each</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">When</TableHead>
                <TableHead scope="col">Actor</TableHead>
                <TableHead scope="col">Record</TableHead>
                <TableHead scope="col">Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breakGlass.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-ink-2">No break-glass access recorded.</TableCell></TableRow>
              ) : breakGlass.map((row) => (
                <TableRow key={`${row.when}-${row.record}`}>
                  <TableHead scope="row" className="font-semibold text-ink normal-case tracking-normal">{row.when}</TableHead>
                  <TableCell label="Actor">{row.actor}</TableCell>
                  <TableCell label="Record">{row.record}</TableCell>
                  <TableCell label="Reason" className="whitespace-normal">{row.reason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle role="heading" aria-level={2}>Audit log</CardTitle></CardHeader>
        <CardContent>
          <Table stack="phone">
            <TableCaption className="sr-only">Audit log</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">When</TableHead>
                <TableHead scope="col">Actor</TableHead>
                <TableHead scope="col">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audit.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-ink-2">Nothing audited yet.</TableCell></TableRow>
              ) : audit.map((row) => (
                <TableRow key={`${row.when}-${row.action}`}>
                  <TableHead scope="row" className="font-semibold text-ink normal-case tracking-normal">{row.when}</TableHead>
                  <TableCell label="Actor">{row.actor}</TableCell>
                  <TableCell label="Action" className="whitespace-normal">{row.action}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
```

- [ ] **Step 2: `tests/admin-governance.test.tsx`**

```tsx
// @vitest-environment jsdom
import { test, expect, beforeEach, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
vi.mock('next/navigation', () => import('./helpers/next-navigation'));
import { renderAdmin } from './helpers/render-doctor';
import { Governance } from '@/components/admin/Governance';

beforeEach(() => cleanup());

test('the register is policy and renders in blank mode; the counts do not', () => {
  const { container } = renderAdmin(<Governance />, {});
  expect(screen.getByText('Schedule 2 controlled drugs')).toBeInTheDocument();
  expect(screen.getByText('Schedule 3 controlled drugs')).toBeInTheDocument();
  expect(screen.getByText('Items needing monitoring')).toBeInTheDocument();
  expect(screen.getByText(/Schedule 2 and Schedule 3 controlled drugs are prohibited platform-wide/)).toBeInTheDocument();
  expect([...container.querySelectorAll('[data-slot="stat-value"]')].every((e) => e.textContent === '—')).toBe(true);
  expect(screen.getByText('No prescribing recorded yet.')).toBeInTheDocument();
  expect(screen.getByText('No break-glass access recorded.')).toBeInTheDocument();
  expect(screen.getByText('Nothing audited yet.')).toBeInTheDocument();
});

test('seeded, the outlier leads the table and carries the only flag', () => {
  const { container } = renderAdmin(<Governance />, { query: 'data=seeded' });
  const tables = [...container.querySelectorAll('table')];
  const prescribing = tables.find((t) => t.textContent?.includes('Flagged against register'))!;
  const refs = [...prescribing.querySelectorAll('th[scope="row"]')].map((th) => th.textContent);
  expect(refs[0]).toBe('GP-002');
  expect(within(prescribing).getAllByText(/flagged/)).toHaveLength(4);
  expect(within(prescribing).getAllByText('1 flagged')[0].closest('[data-slot="badge"]')).not.toBeNull();
  expect(within(prescribing).getByText('2.5%')).toBeInTheDocument();
  expect(within(prescribing).getAllByText('0.0%')).toHaveLength(2);
  expect(within(prescribing).getByText('—')).toBeInTheDocument();   // GP-004: no consults, no rate
});

test('seeded counts, including the 999 and resolution notes', () => {
  renderAdmin(<Governance />, { query: 'data=seeded' });
  expect(screen.getByText('2 reached the 999 screen')).toBeInTheDocument();
  expect(screen.getByText('median 5 days to resolve')).toBeInTheDocument();
  expect(screen.getByText('Safeguarding referrals')).toBeInTheDocument();
});

test('the break-glass log gives every access a reason, and the audit log lists three', () => {
  const { container } = renderAdmin(<Governance />, { query: 'data=seeded' });
  expect(screen.getByText('Safeguarding concern raised by GP-002')).toBeInTheDocument();
  const audit = [...container.querySelectorAll('table')].find((t) => t.textContent?.includes('Action'))!;
  expect(audit.querySelectorAll('tbody tr')).toHaveLength(3);
});

test('every table is captioned and scoped, and no medicine is named', () => {
  const { container } = renderAdmin(<Governance />, { query: 'data=seeded' });
  for (const table of container.querySelectorAll('table')) {
    expect(table.querySelector('caption')).not.toBeNull();
    for (const th of table.querySelectorAll('th')) expect(th).toHaveAttribute('scope');
  }
  expect(container.textContent).not.toMatch(/amoxicillin|ibuprofen|codeine|diazepam|semaglutide/i);
});
```

- [ ] **Step 3: Run, then commit**

Run: `npx vitest run tests/admin-governance.test.tsx` → green; `npm test` → green (the constraints test scans this file for medicine names and finds none: every entry is a category).

```bash
git add components/admin/Governance.tsx 'app/(app)/admin/governance/page.tsx' tests/admin-governance.test.tsx
git commit -m "feat(admin): clinical governance and safety

The register renders in both data modes because it is policy, not
traction, and prescribing is shown per prescriber with the flagged GP
leading — an aggregate breach count hides the one outlier, which is the
whole reason this view exists. Break-glass access carries a reason on
every row.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 24: GP supply operations

**Files:**
- Create: `components/admin/Supply.tsx`
- Modify: `app/(app)/admin/supply/page.tsx`
- Test: `tests/admin-supply.test.tsx`
- Read: `preview/admin.html:144-167` and `225-240` (the matrix and its expired-first sort), `lib/fixtures.ts` (`GPS`, `applicationsInVerification`, `PAYOUT_RUNS`), `components/app/StatusBadge.tsx`, `components/ui/table.tsx`

**Interfaces:**
- Consumes: `useFigures`, `useDataMode`; `GPS`, `applicationsInVerification`, `PAYOUT_RUNS`, `DEMAND_BY_HOUR`, `type CredentialKey` from `@/lib/fixtures`; `CREDENTIAL_KEYS`, `CREDENTIAL_LABELS` from `@/lib/alerts`; `money`, `daysLabel` from `@/lib/format`; `StatusBadge`, `LineChart`, `ChartLegend`, `PageHeader` from `@/components/app/*`; `Switch`, `Label`, `Badge`, `Table…`, `Card…` from `@/components/ui/*`.
- Produces: `Supply`, and the exported helper `soonest(record)` (the minimum days-to-expiry across a record, `0` for anything expired) used by the sort and by its test.

- [ ] **Step 1: `components/admin/Supply.tsx`**

```tsx
'use client';

import { useId, useState } from 'react';
import { ChartLegend } from '@/components/app/ChartLegend';
import { LineChart } from '@/components/app/LineChart';
import { PageHeader } from '@/components/app/PageHeader';
import { StatusBadge } from '@/components/app/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { CREDENTIAL_KEYS, CREDENTIAL_LABELS } from '@/lib/alerts';
import { useDataMode, useFigures } from '@/lib/data-mode';
import { applicationsInVerification, DEMAND_BY_HOUR, GPS, PAYOUT_RUNS, type CredentialRecord } from '@/lib/fixtures';
import { daysLabel, money } from '@/lib/format';

// How soon this GP's first credential bites. Expired is zero: it has already
// bitten, and the point of the screen is the fortnight of warning before it does.
export function soonest(record: CredentialRecord): number {
  return Math.min(...CREDENTIAL_KEYS.map((key) => {
    const c = record[key];
    if (c.status === 'expired' || c.status === 'rejected') return 0;
    return typeof c.daysRemaining === 'number' ? c.daysRemaining : Infinity;
  }));
}

export function Supply() {
  const { seeded } = useDataMode();
  const { seedList } = useFigures();
  const filterId = useId();
  // Fourteen days is the notice this screen exists to give, so it is the
  // default view; the toggle is there to prove the rest of the roster exists.
  const [within14, setWithin14] = useState(true);

  const gps = seedList(GPS);
  const sorted = [...gps].sort((a, b) => soonest(a.credentials) - soonest(b.credentials));
  const rows = within14 ? sorted.filter((gp) => soonest(gp.credentials) <= 14) : sorted;
  const applications = seedList(applicationsInVerification());
  const online = gps.filter((gp) => gp.online);
  const payouts = seedList(PAYOUT_RUNS);

  return (
    <section data-screen="supply" className="grid gap-8">
      <PageHeader title="GP supply operations" />

      <Card>
        <CardHeader><CardTitle role="heading" aria-level={2}>Applications in verification</CardTitle></CardHeader>
        <CardContent>
          <Table stack="phone">
            <TableCaption className="sr-only">GP applications in verification, with the stage each is at</TableCaption>
            <TableHeader>
              <TableRow><TableHead scope="col">GP</TableHead><TableHead scope="col">Stage</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {applications.length === 0 ? (
                <TableRow><TableCell colSpan={2} className="text-ink-2">No applications in verification.</TableCell></TableRow>
              ) : applications.map((a) => (
                <TableRow key={a.ref}>
                  <TableHead scope="row" className="font-semibold text-ink normal-case tracking-normal">{a.ref}</TableHead>
                  <TableCell label="Stage"><Badge variant="secondary">{a.stage}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>Credentials</CardTitle>
          <div className="flex items-center gap-3">
            <Switch id={filterId} checked={within14} onCheckedChange={setWithin14} />
            <Label htmlFor={filterId}>Within 14 days only</Label>
          </div>
        </CardHeader>
        <CardContent>
          <Table stack="phone">
            <TableCaption className="sr-only">Every GP&apos;s credentials, soonest to expire first</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">GP</TableHead>
                {CREDENTIAL_KEYS.map((key) => <TableHead key={key} scope="col">{CREDENTIAL_LABELS[key]}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-ink-2">No GPs verified yet.</TableCell></TableRow>
              ) : rows.map((gp) => {
                // Severity is the row, not a colour: an expired credential fills
                // the whole line so it cannot be scrolled past.
                const expired = CREDENTIAL_KEYS.some((k) => gp.credentials[k].status === 'expired');
                return (
                  <TableRow key={gp.ref} className={expired ? 'bg-band text-white hover:bg-band' : undefined}>
                    <TableHead scope="row" className={`font-semibold normal-case tracking-normal ${expired ? 'text-white' : 'text-ink'}`}>{gp.ref}</TableHead>
                    {CREDENTIAL_KEYS.map((key) => {
                      const c = gp.credentials[key];
                      return (
                        <TableCell key={key} label={CREDENTIAL_LABELS[key]}>
                          <span className="flex items-center gap-2">
                            <StatusBadge status={c.status} onBand={expired} />
                            <span className="text-fine tabular-nums">
                              {c.daysRemaining === null ? 'No expiry' : daysLabel(c.daysRemaining)}
                            </span>
                          </span>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 max-cols:grid-cols-1">
        <Card>
          <CardHeader><CardTitle role="heading" aria-level={2}>Online now</CardTitle></CardHeader>
          <CardContent>
            <Table stack="phone">
              <TableCaption className="sr-only">GPs online now</TableCaption>
              <TableHeader>
                <TableRow><TableHead scope="col">GP</TableHead><TableHead scope="col">Status</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {online.length === 0 ? (
                  <TableRow><TableCell colSpan={2} className="text-ink-2">No GPs online.</TableCell></TableRow>
                ) : online.map((gp) => (
                  <TableRow key={gp.ref}>
                    <TableHead scope="row" className="font-semibold text-ink normal-case tracking-normal">{gp.ref}</TableHead>
                    <TableCell label="Status"><Badge variant="success">Online</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle role="heading" aria-level={2}>Coverage against demand, by hour</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {seeded ? (
              <>
                <LineChart
                  sets={[
                    { key: 'waiting', values: DEMAND_BY_HOUR.map((h) => h.waiting) },
                    { key: 'gps', values: DEMAND_BY_HOUR.map((h) => h.gps) },
                  ]}
                  labels={DEMAND_BY_HOUR.map((h) => h.hour)}
                  height={150}
                  ariaLabel="Cover against demand, by hour"
                />
                <ChartLegend items={[{ label: 'Patients waiting', swatch: 'primary' }, { label: 'GPs online', swatch: 'ink-2' }]} />
              </>
            ) : (
              <p data-slot="empty" className="rounded-xl border border-dashed border-rule py-8 text-center text-body text-ink-2">No cover recorded yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle role="heading" aria-level={2}>Payout runs</CardTitle></CardHeader>
        <CardContent>
          <Table stack="phone">
            <TableCaption className="sr-only">Payout runs</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Period</TableHead><TableHead scope="col">Paid on</TableHead>
                <TableHead scope="col">GPs</TableHead><TableHead scope="col">Consultations</TableHead>
                <TableHead scope="col">Amount</TableHead><TableHead scope="col">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payouts.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-ink-2">No payout runs yet.</TableCell></TableRow>
              ) : payouts.map((run) => (
                <TableRow key={run.period}>
                  <TableHead scope="row" className="font-semibold text-ink normal-case tracking-normal">{run.period}</TableHead>
                  <TableCell label="Paid on">{run.date}</TableCell>
                  <TableCell label="GPs" className="tabular-nums">{run.gps}</TableCell>
                  <TableCell label="Consultations" className="tabular-nums">{run.consults}</TableCell>
                  <TableCell label="Amount" className="tabular-nums">{money(run.amount)}</TableCell>
                  <TableCell label="Status"><Badge variant="secondary">{run.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
```

- [ ] **Step 2: `tests/admin-supply.test.tsx`**

```tsx
// @vitest-environment jsdom
import { test, expect, beforeEach, vi } from 'vitest';
import { cleanup, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
vi.mock('next/navigation', () => import('./helpers/next-navigation'));
import { renderAdmin } from './helpers/render-doctor';
import { Supply, soonest } from '@/components/admin/Supply';
import { GPS } from '@/lib/fixtures';

beforeEach(() => cleanup());

const matrix = (c: HTMLElement) => [...c.querySelectorAll('table')].find((t) => t.textContent?.includes('Indemnity cover'))!;

test('blank mode has no roster, no applications, no payouts and no chart', () => {
  const { container } = renderAdmin(<Supply />, {});
  expect(screen.getByText('No GPs verified yet.')).toBeInTheDocument();
  expect(screen.getByText('No applications in verification.')).toBeInTheDocument();
  expect(screen.getByText('No GPs online.')).toBeInTheDocument();
  expect(screen.getByText('No payout runs yet.')).toBeInTheDocument();
  expect(screen.getByText('No cover recorded yet.')).toBeInTheDocument();
  expect(container.querySelector('svg[role="img"]')).toBeNull();
});

test('the fortnight filter is on by default and shows only what bites soon', () => {
  const { container } = renderAdmin(<Supply />, { query: 'data=seeded' });
  const filter = screen.getByRole('switch', { name: 'Within 14 days only' });
  expect(filter).toBeChecked();
  const refs = () => [...matrix(container).querySelectorAll('tbody th[scope="row"]')].map((th) => th.textContent);
  expect(refs()).toEqual(['GP-003', 'GP-002']);          // expired first, then 9 days
  fireEvent.click(filter);
  expect(refs()).toEqual(['GP-003', 'GP-002', 'GP-004', 'GP-001']);
});

test('the expired row is filled, not coloured, and its badges sit on the fill', () => {
  const { container } = renderAdmin(<Supply />, { query: 'data=seeded' });
  const row = matrix(container).querySelector('tbody tr')!;
  expect(row.className).toContain('bg-band');
  expect(within(row as HTMLElement).getByText('Expired')).toBeInTheDocument();
  expect(row.querySelector('[data-status="expired"]')!.className).toContain('bg-white/15');
});

test('every cell says how long is left, and a credential with no expiry says so', () => {
  const { container } = renderAdmin(<Supply />, { query: 'data=seeded' });
  const gp002 = [...matrix(container).querySelectorAll('tbody tr')].find((r) => r.textContent?.startsWith('GP-002'))!;
  expect(within(gp002 as HTMLElement).getByText('9 days')).toBeInTheDocument();
  expect(within(gp002 as HTMLElement).getByText('12 days')).toBeInTheDocument();
  expect(within(gp002 as HTMLElement).getAllByText('No expiry').length).toBeGreaterThan(0);
});

test('soonest() puts an expired or rejected record at zero', () => {
  const gp003 = GPS.find((g) => g.ref === 'GP-003')!;
  expect(soonest(gp003.credentials)).toBe(0);
  expect(soonest(GPS.find((g) => g.ref === 'GP-002')!.credentials)).toBe(9);
});

test('applications, who is online, and the payout run', () => {
  const { container } = renderAdmin(<Supply />, { query: 'data=seeded' });
  expect(screen.getByText('GP-004')).toBeInTheDocument();
  expect(screen.getByText('GMC registration')).toBeInTheDocument();
  const onlineTable = [...container.querySelectorAll('table')].find((t) => t.textContent?.includes('Online'))!;
  expect([...onlineTable.querySelectorAll('tbody th')].map((th) => th.textContent)).toEqual(['GP-001', 'GP-002']);
  expect(screen.getByText('£4,680')).toBeInTheDocument();
  expect(screen.getByText('Due')).toBeInTheDocument();
});
```

- [ ] **Step 3: Run, then commit**

Run: `npx vitest run tests/admin-supply.test.tsx` → green; `npm test`, `npm run typecheck` → green.

```bash
git add components/admin/Supply.tsx 'app/(app)/admin/supply/page.tsx' tests/admin-supply.test.tsx
git commit -m "feat(admin): GP supply operations

The credential matrix sorted by what bites soonest, filtered to the next
fortnight by default because that notice is the point of the screen. The
indemnity that blocks a GP on the doctor surface appears here first, from
the same fixture and the same alerts.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 25: Business

**Files:**
- Create: `components/admin/Business.tsx`
- Modify: `app/(app)/admin/business/page.tsx`
- Test: `tests/admin-business.test.tsx`
- Read: `preview/admin.html:169-191` and `275-296`, `lib/fixtures.ts` `BUSINESS`, `app/api/waitlist-export/route.ts` (the endpoint the waitlist figure could one day read)

**Interfaces:**
- Consumes: `useFigures`; `BUSINESS` from `@/lib/fixtures`; `money` from `@/lib/format`; `StatTile`, `PageHeader` from `@/components/app/*`.
- Produces: `Business`.

- [ ] **Step 1: `components/admin/Business.tsx`**

```tsx
'use client';

import { PageHeader } from '@/components/app/PageHeader';
import { StatTile } from '@/components/app/StatTile';
import { useFigures } from '@/lib/data-mode';
import { BUSINESS } from '@/lib/fixtures';
import { money } from '@/lib/format';

// Neither of these two numbers means anything alone: every comparable UK
// telehealth business that died, died on the gap between them and the plan.
// So the assumption is printed whether or not there is an actual to print.
const gap = (actual: number, assumption: number, format: (n: number) => string) => {
  const delta = actual - assumption;
  if (delta === 0) return 'on plan';
  return `${format(Math.abs(delta))} ${delta > 0 ? 'above' : 'below'} plan`;
};

export function Business() {
  const { shown, seeded } = useFigures();
  const oneDp = (v: number) => v.toFixed(1);

  return (
    <section data-screen="business" className="grid gap-8">
      <PageHeader title="Business" />

      <div className="grid grid-cols-2 gap-4 max-cols:grid-cols-1">
        <StatTile
          label="Real CAC"
          value={shown(BUSINESS.cac.actual, money)}
          against={`plan assumed ${money(BUSINESS.cac.assumption)}${seeded ? ` · ${gap(BUSINESS.cac.actual, BUSINESS.cac.assumption, money)}` : ''}`}
        />
        <StatTile
          label="Repeat consults per patient per year"
          value={shown(BUSINESS.repeatRate.actual, oneDp)}
          against={`plan assumed ${oneDp(BUSINESS.repeatRate.assumption)}${seeded ? ` · ${gap(BUSINESS.repeatRate.actual, BUSINESS.repeatRate.assumption, oneDp)}` : ''}`}
        />
      </div>

      <div className="grid grid-cols-4 gap-4 max-cols:grid-cols-2 max-phone:grid-cols-1">
        <StatTile size="sm" label="Consults" value={shown(BUSINESS.consults)} />
        <StatTile size="sm" label="Revenue" value={shown(BUSINESS.revenue, money)} />
        <StatTile size="sm" label="Refunds" value={shown(BUSINESS.refunds)} />
        {/* The one figure with a real upgrade path: GET /api/waitlist-export
            already returns these counts against a live store. Deliberately not
            wired — this surface is fixtures only, and a real number here would
            make every synthetic one beside it read as real too. */}
        <StatTile size="sm" label="Waitlist — patients / GPs"
          value={shown(BUSINESS.waitlist, (w) => `${w.patients} / ${w.gps}`)} />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: `tests/admin-business.test.tsx`**

```tsx
// @vitest-environment jsdom
import { test, expect, beforeEach, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
vi.mock('next/navigation', () => import('./helpers/next-navigation'));
import { renderAdmin } from './helpers/render-doctor';
import { Business } from '@/components/admin/Business';

beforeEach(() => cleanup());

test('the two numbers that decide everything are shown against their assumptions', () => {
  const { container } = renderAdmin(<Business />, { query: 'data=seeded' });
  expect(screen.getByText('£42')).toBeInTheDocument();
  expect(screen.getByText('plan assumed £16 · £26 above plan')).toBeInTheDocument();
  expect(screen.getByText('1.1')).toBeInTheDocument();
  expect(screen.getByText('plan assumed 1.8 · 0.7 below plan')).toBeInTheDocument();
  expect(container.querySelectorAll('[data-slot="stat-against"]')).toHaveLength(2);
});

test('blank mode keeps the assumptions and states no actual', () => {
  const { container } = renderAdmin(<Business />, {});
  expect(screen.getByText('plan assumed £16')).toBeInTheDocument();
  expect(screen.getByText('plan assumed 1.8')).toBeInTheDocument();
  expect(container.textContent).not.toMatch(/above plan|below plan/);
  expect([...container.querySelectorAll('[data-slot="stat-value"]')].every((e) => e.textContent === '—')).toBe(true);
});

test('the volume figures, and the waitlist that is not wired', () => {
  renderAdmin(<Business />, { query: 'data=seeded' });
  expect(screen.getByText('120')).toBeInTheDocument();
  expect(screen.getByText('£4,680')).toBeInTheDocument();
  expect(screen.getByText('3')).toBeInTheDocument();
  expect(screen.getByText('210 / 34')).toBeInTheDocument();
});
```

- [ ] **Step 3: Run, then commit**

Run: `npx vitest run tests/admin-business.test.tsx` → green; `npm test`, `npm run typecheck` → green.

```bash
git add components/admin/Business.tsx 'app/(app)/admin/business/page.tsx' tests/admin-business.test.tsx
git commit -m "feat(admin): business

Exactly two numbers at the top, each against the assumption it has to beat
and never alone, because the gap is the finding. The waitlist figure is
marked as the one with a real upgrade path and left unwired.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 26: Carry the preview structure assertions into Vitest

**Files:**
- Create: `tests/doctor.test.tsx`, `tests/admin.test.tsx`
- Modify: `tests/constraints.test.ts`
- Read: `preview/tests/structure.test.mjs` (every doctor and admin test), every `tests/*.test.tsx` written by Tasks 4–25 (so nothing is asserted twice), `tests/constraints.test.ts`

**Interfaces:**
- Consumes: `renderDoctor`, `renderAdmin`, `nav` from `tests/helpers/render-doctor.tsx`; the page modules and both layouts; `SESSION_SCREENS`, `ONBOARDING_STEPS`, `sessionHref`, `onboardingHref`; `DOCTOR_JUMPS`, `ADMIN_JUMPS`, `DOCTOR_NAV`, `ADMIN_NAV` from `@/components/app/*`.
- Produces: `DOCTOR_ROUTES` and `ADMIN_ROUTES` exported from `tests/doctor.test.tsx` / `tests/admin.test.tsx` are **not** exported — each file keeps its own const. Nothing imports these files.

Tasks 14–25 already carry the per-screen assertions. This task adds only what no single screen owns: the sweeps across every route, and the four preview tests whose subject is the surface rather than a screen.

- [ ] **Step 1: `tests/doctor.test.tsx` — the sweeps**

```tsx
// @vitest-environment jsdom
import { test, expect, beforeEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import '@testing-library/jest-dom/vitest';
vi.mock('next/navigation', () => import('./helpers/next-navigation'));
import { renderDoctor, nav } from './helpers/render-doctor';
import { installDomStubs } from './helpers/dom-stubs';
import SessionPage from '@/app/(app)/doctor/session/[[...state]]/page';
import OnboardingPage from '@/app/(app)/doctor/onboarding/[[...step]]/page';
import DoctorPage from '@/app/(app)/doctor/page';
import EarningsPage from '@/app/(app)/doctor/earnings/page';
import ProfilePage from '@/app/(app)/doctor/profile/page';
import DoctorLayout from '@/app/(app)/doctor/layout';
import { SESSION_SCREENS, sessionHref } from '@/lib/session';
import { ONBOARDING_STEPS, onboardingHref } from '@/lib/onboarding';
import { DOCTOR_JUMPS } from '@/components/app/jumps';
import { DOCTOR_NAV } from '@/components/app/nav';

beforeEach(() => { cleanup(); vi.useRealTimers(); });

const GATES = ['verification-pending', 'verification-rejected', 'indemnity-expired', 'revalidation-due'] as const;

// Every URL this surface answers, and the element to render at it.
const ROUTES: Array<{ path: string; query?: string; el: () => Promise<React.ReactElement> | React.ReactElement }> = [
  { path: '/doctor', el: () => <DoctorPage /> },
  ...GATES.map((g) => ({ path: '/doctor', query: `gate=${g}`, el: () => <DoctorPage /> })),
  { path: '/doctor/earnings', el: () => <EarningsPage /> },
  { path: '/doctor/profile', el: () => <ProfilePage /> },
  ...ONBOARDING_STEPS.map((s) => ({ path: onboardingHref(s), el: () => OnboardingPage({ params: Promise.resolve({ step: [s] }) }) })),
  ...SESSION_SCREENS.map((s) => ({ path: sessionHref(s), el: () => SessionPage({ params: Promise.resolve({ state: [s] }) }) })),
];
const PATHS = new Set([...ROUTES.map((r) => r.path), '/doctor/session', '/doctor/onboarding', '/']);

test('the doctor surface answers twenty-three URLs, and each renders its own screen', async () => {
  expect(ROUTES).toHaveLength(23);
  for (const route of ROUTES) {
    const { container, unmount } = renderDoctor(await route.el(), { pathname: route.path, query: route.query });
    expect(container.querySelector('[data-screen]'), `${route.path}?${route.query ?? ''}`).not.toBeNull();
    expect(screen.getAllByRole('heading', { level: 1 }).length).toBeGreaterThan(0);
    unmount();
  }
});

test('every link on every doctor screen resolves to a route this surface answers', async () => {
  for (const route of ROUTES) {
    const { container, unmount } = renderDoctor(await route.el(), { pathname: route.path, query: route.query ?? 'data=seeded' });
    for (const a of container.querySelectorAll<HTMLAnchorElement>('a[href^="/"]')) {
      expect(PATHS.has(a.getAttribute('href')!.split('?')[0]), `${route.path} → ${a.getAttribute('href')}`).toBe(true);
    }
    unmount();
  }
  for (const group of DOCTOR_JUMPS) {
    for (const item of group.items) expect(PATHS.has(item.href.split('?')[0]), item.href).toBe(true);
  }
  for (const item of DOCTOR_NAV) expect(PATHS.has(item.href)).toBe(true);
});

test('the ribbon is on every route, exactly once, in its own words', async () => {
  for (const route of ROUTES) {
    installDomStubs();
    const { container, unmount } = render(<DoctorLayout>{await route.el()}</DoctorLayout>);
    const ribbons = container.querySelectorAll('[data-slot="ribbon"]');
    expect(ribbons, route.path).toHaveLength(1);
    expect(ribbons[0]).toHaveAttribute('role', 'note');
    expect(ribbons[0]).toHaveTextContent('Prototype. Not a live service — no real patients, GPs, or data.');
    unmount();
  }
});

test('without JavaScript the shell, the heading, the ribbon and a way around still render', async () => {
  const html = renderToStaticMarkup(<DoctorLayout>{await SessionPage({ params: Promise.resolve({ state: ['offline'] }) })}</DoctorLayout>);
  expect(html).toContain('data-slot="ribbon"');
  expect(html).toContain('<h1');
  expect(html).toContain('<noscript>');
  expect(html).toContain('aria-label="Sections"');
  for (const item of DOCTOR_NAV) expect(html).toContain(`href="${item.href}"`);
});

// The highest-severity rule in the plan: blank mode may not put a platform
// figure on screen anywhere, on any route.
test('blank mode states no figure the platform has not produced', async () => {
  for (const route of ROUTES) {
    const { container, unmount } = renderDoctor(await route.el(), { pathname: route.path, query: route.query });
    for (const value of container.querySelectorAll('[data-slot="stat-value"]')) {
      expect(/\d/.test(value.textContent ?? '') ? value.textContent : '—', `${route.path} ${value.textContent}`).toBe('—');
    }
    for (const cell of container.querySelectorAll('td')) {
      const text = cell.textContent?.trim() ?? '';
      if (/\d/.test(text)) expect(['£39', '7 digits'].includes(text) || /days|Schedule|of 7/.test(text), `${route.path}: ${text}`).toBe(true);
    }
    unmount();
  }
});

test('every table is captioned and scoped, and no card doubles the band', async () => {
  for (const route of ROUTES) {
    const { container, unmount } = renderDoctor(await route.el(), { pathname: route.path, query: route.query ?? 'data=seeded' });
    for (const table of container.querySelectorAll('table')) {
      expect(table.querySelector('caption'), route.path).not.toBeNull();
      for (const th of table.querySelectorAll('th')) expect(th, route.path).toHaveAttribute('scope');
    }
    expect(container.querySelectorAll('[data-slot="card"][data-variant="band"]').length, route.path).toBeLessThanOrEqual(1);
    unmount();
  }
});

// The prototype README's own sentence, as a test: a GP does not book shifts.
test('the doctor surface offers availability, not a schedule', async () => {
  const { container } = renderDoctor(<DoctorPage />, { pathname: '/doctor', query: 'data=seeded' });
  const switches = container.querySelectorAll('[role="switch"]');
  expect(switches).toHaveLength(1);
  expect(switches[0]).toHaveAttribute('aria-checked', 'false');
  expect(container.textContent).not.toMatch(/\b(schedule|rota|calendar)\b/i);
  for (const a of container.querySelectorAll('a[href]')) {
    expect(a.getAttribute('href')).not.toMatch(/\b(schedule|rota|calendar)\b/i);
  }
});

test('an alert is never an alarm: the credential list uses accent and default only', () => {
  const { container } = renderDoctor(<DoctorPage />, { pathname: '/doctor', query: 'data=seeded' });
  const alerts = [...container.querySelectorAll('[data-slot="alert"]')];
  expect(alerts.length).toBeGreaterThan(0);
  for (const alert of alerts) expect(['accent', 'default']).toContain(alert.getAttribute('data-variant'));
});
```

- [ ] **Step 2: `tests/admin.test.tsx` — the same four sweeps**

```tsx
// @vitest-environment jsdom
import { test, expect, beforeEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import '@testing-library/jest-dom/vitest';
vi.mock('next/navigation', () => import('./helpers/next-navigation'));
import { renderAdmin } from './helpers/render-doctor';
import { installDomStubs } from './helpers/dom-stubs';
import AdminLayout from '@/app/(app)/admin/layout';
import FloorPage from '@/app/(app)/admin/page';
import GovernancePage from '@/app/(app)/admin/governance/page';
import SupplyPage from '@/app/(app)/admin/supply/page';
import BusinessPage from '@/app/(app)/admin/business/page';
import { ADMIN_JUMPS } from '@/components/app/jumps';
import { ADMIN_NAV } from '@/components/app/nav';

beforeEach(() => cleanup());

const ROUTES = [
  { path: '/admin', screen: 'floor', title: 'Live operations', el: <FloorPage /> },
  { path: '/admin/governance', screen: 'governance', title: 'Clinical governance and safety', el: <GovernancePage /> },
  { path: '/admin/supply', screen: 'supply', title: 'GP supply operations', el: <SupplyPage /> },
  { path: '/admin/business', screen: 'business', title: 'Business', el: <BusinessPage /> },
];
const PATHS = new Set([...ROUTES.map((r) => r.path), '/']);

test('all four sections exist, name themselves, and the surface opens on the floor', () => {
  for (const route of ROUTES) {
    const { container, unmount } = renderAdmin(route.el, { pathname: route.path, query: 'data=seeded' });
    expect(container.querySelector(`[data-screen="${route.screen}"]`)).not.toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(route.title);
    unmount();
  }
  expect(ADMIN_NAV[0].href).toBe('/admin');
});

test('every admin link resolves, including the jumper', () => {
  for (const route of ROUTES) {
    const { container, unmount } = renderAdmin(route.el, { pathname: route.path, query: 'data=seeded' });
    for (const a of container.querySelectorAll<HTMLAnchorElement>('a[href^="/"]')) {
      expect(PATHS.has(a.getAttribute('href')!.split('?')[0]), a.getAttribute('href')!).toBe(true);
    }
    unmount();
  }
  for (const group of ADMIN_JUMPS) for (const item of group.items) expect(PATHS.has(item.href.split('?')[0])).toBe(true);
});

test('the ribbon is on every admin route, and the shell renders without JavaScript', () => {
  for (const route of ROUTES) {
    installDomStubs();
    const { container, unmount } = render(<AdminLayout>{route.el}</AdminLayout>);
    expect(container.querySelectorAll('[data-slot="ribbon"]'), route.path).toHaveLength(1);
    unmount();
  }
  const html = renderToStaticMarkup(<AdminLayout><FloorPage /></AdminLayout>);
  expect(html).toContain('data-slot="ribbon"');
  expect(html).toContain('<h1');
  expect(html).toContain('<noscript>');
});

test('blank mode states no figure, and every table is captioned and scoped', () => {
  for (const route of ROUTES) {
    const { container, unmount } = renderAdmin(route.el, { pathname: route.path });
    for (const value of container.querySelectorAll('[data-slot="stat-value"]')) {
      expect(value.textContent, route.path).toBe('—');
    }
    for (const table of container.querySelectorAll('table')) {
      expect(table.querySelector('caption'), route.path).not.toBeNull();
      for (const th of table.querySelectorAll('th')) expect(th).toHaveAttribute('scope');
    }
    expect(container.querySelectorAll('[data-slot="card"][data-variant="band"]').length, route.path).toBeLessThanOrEqual(1);
    unmount();
  }
});
```

- [ ] **Step 3: The constraints additions**

Append to `tests/constraints.test.ts`, reusing its existing `ROOT`, `walk` and `EXTS`:

```ts
import { basename } from 'node:path';

const DOCTOR_APP = join(ROOT, 'app', '(app)', 'doctor');
const DOCTOR_DIRS = [DOCTOR_APP, join(ROOT, 'components', 'doctor')];
// Word-bounded on purpose: 'rotate-180' is a utility and 'Schedule 2' is
// compliance copy that lives on the admin surface, where it belongs.
const ROTA = /\b(schedule|rota|calendar)\b/i;

function walkDirs(dir: string): string[] {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return []; }
  return entries.flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? [full, ...walkDirs(full)] : [];
  });
}

test('the doctor surface has no schedule, rota or calendar route', () => {
  for (const dir of walkDirs(DOCTOR_APP)) expect(basename(dir), dir).not.toMatch(ROTA);
});

test('nothing on the doctor surface says schedule, rota or calendar', () => {
  const files = DOCTOR_DIRS.flatMap(walk).filter((f) => EXTS.has(extname(f)));
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    expect(text.match(new RegExp(ROTA.source, 'gi')) ?? [], file).toEqual([]);
    expect(/import\s*\{[^}]*Calendar[^}]*\}\s*from\s*['"]lucide-react['"]/.test(text), `${file} imports a Calendar icon`).toBe(false);
  }
});

// What a GP sees before accepting is a compliance boundary, not a layout
// choice, so it is guarded at the source as well as in the DOM.
const OFFER_SOURCE = join(ROOT, 'components', 'doctor', 'session', 'Offer.tsx');
const POST_ACCEPTANCE = /\b(full record|clinical history|past consultations|nhs number|date of birth|postcode|medications?|allergies|notes|prescri\w*|summary care record)\b/i;

test('the offer screen knows only the three pre-acceptance facts', () => {
  const text = readFileSync(OFFER_SOURCE, 'utf8');
  const stripped = text.replace(/className=(["'`])[^"'`]*\1/g, '');
  expect(stripped.match(new RegExp(POST_ACCEPTANCE.source, 'gi')) ?? []).toEqual([]);
  const imported = text.match(/import\s*\{([^}]*)\}\s*from\s*['"]@\/lib\/fixtures['"]/)?.[1] ?? '';
  const names = imported.split(',').map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
  expect(names.every((n) => ['OFFER', 'OFFER_CONSENT_REFUSED'].includes(n)), `Offer.tsx imports ${names}`).toBe(true);
});

// The spec says "including fixtures, placeholders and test strings", so the
// medicine and banned-wording sweeps reach tests/ too — minus this file, whose
// job is to name the words it forbids.
test('no medicine is named and no banned wording appears in the tests either', () => {
  const files = walk(join(ROOT, 'tests')).filter((f) => EXTS.has(extname(f)) && basename(f) !== 'constraints.test.ts');
  for (const file of files) {
    const text = readFileSync(file, 'utf8').toLowerCase();
    for (const medicine of MEDICINES) expect(text.includes(medicine), `${file}: ${medicine}`).toBe(false);
    for (const pattern of BANNED_PATTERNS) expect(pattern.test(text), `${file}: ${pattern}`).toBe(false);
  }
});
```

- [ ] **Step 4: Run the whole suite**

Run: `npm test` → green, and the count is the ported 48 + the new suites. `npm run typecheck` → green.

Then confirm nothing is asserted twice: `grep -rho "^test('.*'" tests | sort | uniq -d` must print nothing (duplicate test names across files are allowed by Vitest but hide a copy-paste, so the plan treats a duplicate as a defect).

- [ ] **Step 5: Commit**

```bash
git add tests/doctor.test.tsx tests/admin.test.tsx tests/constraints.test.ts
git commit -m "test: carry the preview structure assertions into Vitest

The sweeps no single screen owns: every URL renders its own screen, every
link resolves, the ribbon is on all twenty-seven routes, blank mode states
no figure the platform has not produced, every table is captioned and
scoped, and a GP is offered availability rather than a rota. The
constraints test gains the route guard, the doctor-tree wording guard and
the pre-acceptance scan.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 27: Docs — dashboards section, design exceptions, migration addendum, preview note

**Files:**
- Modify: `CLAUDE.md`, `DESIGN.md`, `docs/superpowers/specs/2026-08-28-react-migration-design.md`, `preview/README.md`
- Read: each file's existing voice before writing into it

- [ ] **Step 1: `CLAUDE.md` — a `## Dashboards` section directly after `## Component layer`**

```markdown
## Dashboards

The doctor and admin surfaces are a fixture-driven prototype of a service that has not launched, and every rule below exists to keep them reading that way.

- **Routes.** `app/(app)/doctor/**` and `app/(app)/admin/**`, each route group mounting its own providers and the shared `AppShell`. Destinations are routes; states are reducers with a URL — `/doctor/session/[[...state]]` (ten states) and `/doctor/onboarding/[[...step]]` (six steps), both `generateStaticParams` + `dynamicParams = false`. The four credential gates render at `/doctor` itself, selected with `?gate=` and derived from the record by `gateFor()`. Nothing here may appear in the `/` bundle: `SidebarProvider`, `sonner`, the reducers and the fixtures stay behind the route groups, and `tests/bundle.test.ts` says so.
- **Providers.** `DataModeProvider` (the data mode), `DoctorProvider` (the credential record and the gate), `SessionProvider` (the shift), `OnboardingProvider` (registration). They mount in the surface's layout, never the root layout, and the admin surface cannot read the doctor's session. State is seeded from `usePathname()` so the server HTML and the first client render agree; the reducer carries a `nav` counter, and the URL follows `nav` while the state follows the pathname, so the two effects can never drive each other.
- **Blank by default.** `shown(v)` is a figure only a running platform could produce and is an em dash until `?data=seeded`; `live(v)` is a figure this session genuinely produced and appears immediately. Zero is a dash in both, because "0 consultations" claims the service ran and nobody came. The £39 fee, the restricted-items register and the credential labels are product and policy facts and render in both modes. A blank-mode screen showing a fixture figure is the highest-severity bug on these surfaces.
- **Fixtures are the only data, and they are round on purpose.** `lib/fixtures.ts` is the single file; a figure that appears twice is derived once (earnings are always consults × `FEE`; the shift comes from `FLOOR`; consults to date come from `PRESCRIBING`). No medicine, no CQC number, no rating, no named GP — refs only — and no figure tuned to look like traction.
- **The state jumper** (`components/app/StateJumper.tsx`) replaces the prototype's rail: a bottom-pinned monospace bar listing every route and state, rendered only outside production or with `?jumper=1`. It must never be mistaken for product chrome.
- **Severity without a fourth colour.** Fill, weight, border and position carry urgency: an expired credential fills its row with the band, an expiring one takes a 2px ink border, urgent rows sort to the top. Success and error appear only on status badges and on the offer countdown's final five seconds. Never red/amber/green, never hue alone.
- **No rota.** A GP does not book shifts. They go online, take offers as they come and go offline; a decline passes the offer straight to the next GP. The words `schedule`, `rota` and `calendar` may not appear under `app/(app)/doctor` or `components/doctor` — including a lucide `Calendar` icon — and `tests/constraints.test.ts` enforces it.
- **Semble holds the clinical record.** No notes editor, no prescribing UI, no EHR features anywhere on the doctor surface. The consultation screen states the handoff and explains it in a dialog; "Finish consultation" never doubles as "open Semble", because fusing them would make a real context switch look frictionless.
- **The arrival grammar is scoped.** `components/app/Arrival.tsx` stamps the stagger and releases `[data-reveal]` on a surface's first paint, then marks the shell `data-arrived` so anything mounting later renders visible and still. `LandingBehavior` is the landing page's and is never mounted here.
```

- [ ] **Step 2: `DESIGN.md` — three appended sections, in the file's voice**

Append after the shadcn token mapping section, verbatim:

```markdown
## Data tables (2026-09-02)

The Data Lists rule removes horizontal dividers and lets the hover state carry the row. A data table on the dashboards is scanned, not browsed: the eye runs down a column of figures and needs the row to hold together across eight cells. Tables built from `components/ui/table.tsx` therefore keep a 1px `rule` hairline under every row, with the `surface-mid` hover laid over it, 12px cell padding and no vertical rules. Lists that are not tables — credential rows, facts, alerts — still follow the Data Lists rule.

## Numerals

`numeric-data` is the face for any figure that will be compared with another: stat tiles, table cells that hold a number, the payout meter's label, the countdown. It is Geist at 600 or 700, tracked no tighter than -0.03em and always `tabular-nums`, so a column of figures and a ticking timer keep their width as the digits change. Stat tiles scale it — 36px for the headline figure, 24px for a secondary one — but never change the face or the figure spacing. A placeholder em dash sits in the same face and size as the figure it stands in for.

## Motion

**The One Arrival Rule.** Content arrives with one grammar and no other: a 16px rise fading in over 600–700ms on the exponential ease-out, the headline by masked line. It fires once, on a surface's first paint, and never again — not on a route change inside the app, a tab, a filter or a value that ticks. Live figures change in place without moving. Overlays are the only other things that move, on the retimed enter and leave in `components/ui`; the offer countdown and the consultation timer are information rather than motion, and keep ticking as static numerals under `prefers-reduced-motion`.

**The Capped Stagger Rule.** Siblings in a `[data-stagger]` group arrive 70ms apart, and the delay stops growing at 300ms, so a row of eight tiles finishes arriving when a row of five does. The hero's few load-time elements pace at 90ms and need no cap. Nothing is sequenced by hand: the delay is the element's index and nothing else.

**The Never-Hidden Rule.** A reveal's start state — opacity 0, the 16px offset — is written under the `.js` class an inline script sets before first paint, so a blocked, failed or disabled script leaves every element visible and in place. Reduced motion forces the end state. Once a surface has arrived it is marked `data-arrived`, and every later reveal renders visible and still, so nothing that mounts after first paint can be blank.

The one motion outside this grammar is the app sidebar's 200ms collapse when a route is a flow rather than a destination: the rail is chrome moving out of the way, not content arriving.
```

- [ ] **Step 3: `docs/superpowers/specs/2026-08-28-react-migration-design.md` — a dated addendum at the end**

```markdown
## Addendum — 2026-09-02: milestones 3 and 4

The doctor and admin surfaces are built. `preview/` and `index.html` are **not** deleted: the patient surface (milestone 2) still lives there, and the deletion moves to that milestone. Ten decisions taken during implementation that this document did not settle:

1. **`alerts.js` ports unchanged rather than being rewritten.** The Rewritten list above was wrong about it: the module is pure, has no DOM dependency and was already unit-tested. It gains a `rejected` branch (no fixture produced one) and `gateFor()`.
2. **`revalidation-due` is a banner, not a block.** `BLOCKING` in `alerts.js` contains only `indemnity`, and the credential it names does not stop a GP working. The "four blocking gates" phrasing above should read "four gates, one of which blocks".
3. **The gates are selected by `?gate=` and rendered from the record.** The query chooses whose credential record is on screen — exactly what the rail did — and `gateFor()` derives the gate. `GP-002`'s own record raises no gate, so without the query `/doctor` is the dashboard.
4. **`StateJumper` replaces `rail.js`**, dev-only or `?jumper=1`, with every state addressable by URL.
5. **Success and error are permitted on status badges and the countdown's final five seconds.** The prototype's twelve-hex palette had no semantic colours at all; the app's sixteen do. Severity elsewhere stays fill, weight, border and position.
6. **The preview's palette does not survive.** `#1447E6`, true black and the ten preview tints are violations under `tests/constraints.test.ts`; no colour was lifted from `preview/css`.
7. **Figures that appeared twice are now derived once**, which visibly changes numbers: consults to date 32 → 40 and earnings to date £1,248 → £1,560 (both from `PRESCRIBING`), credentials 5 of 5 → 7 of 7, revalidation 312 → 120 days.
8. **The rating is deleted.** `DOCTOR_DASHBOARD.ratingAverage` and `ratingCount` are gone: `PRODUCT.md` lists ratings among the absences that must not be fabricated.
9. **`FEE` is the GP's unit as the prompt requires** (earnings = consults × £39). `PRODUCT.md` records GP pay as £24–33 per consultation, so the earnings figures on the doctor surface are the patient price, not a modelled margin. Flagged rather than silently reconciled.
10. **Two wordings changed**: "shifts booked through Dr Quick" → "every consultation you take through Dr Quick" (a GP does not book shifts), and the onboarding promise that "most GPs hear back within two working days" is gone (a service-level claim for a service that has not run).
```

- [ ] **Step 4: `preview/README.md` — a note at the top, under the title**

```markdown
> **The doctor and admin surfaces now live in the app.** They are `/doctor` and
> `/admin` in the Next.js application at the repository root, with `?data=seeded`
> for the fixture data and `?jumper=1` for the state jumper that replaced the rail.
> `preview/doctor.html` and `preview/admin.html` are reference only — the copy and
> the behaviour they encode were ported from them, and they are kept until the
> patient surface follows. `preview/patient.html` is still the live prototype of
> the patient flow.
```

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md DESIGN.md docs/superpowers/specs/2026-08-28-react-migration-design.md preview/README.md
git commit -m "docs: dashboards section, design exceptions, migration addendum

CLAUDE.md gains the rules a future session needs before touching these
surfaces; DESIGN.md records the table-divider exception, the numeral face
and the three motion rules it was already being cited for; the migration
spec gets a dated addendum listing every decision taken during the port,
including the ones that contradict it.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 28: Verification — build, bundle, the screenshot matrix, the walks, the report

**Files:**
- Create: `scripts/screenshot-dashboards.mjs`
- Read: the Task 1 baselines recorded in this plan; `CLAUDE.md` "Verifying changes"

- [ ] **Step 1: The suite, the types and the build**

```bash
npm test
npm run typecheck
NEXT_PUBLIC_SITE_URL=http://localhost:3000 npm run build
```
All three green. The build's route list must contain 23 doctor paths and 4 admin paths, every one static.

- [ ] **Step 2: The bundle check — the landing page must not have grown**

Next 16 with Turbopack writes `.next/diagnostics/route-bundle-stats.json` rather than printing a first-load table.

```bash
S=/private/tmp/claude-501/-Users-liam-development-DrQuick-website/4de69205-47c5-4cc2-8bcd-f59b3b85453d/scratchpad
node - "$S/before.json" <<'EOF'
const fs = require('fs');
const before = require(process.argv[2]);
const after = require('./.next/diagnostics/route-bundle-stats.json');
const home = (s) => s.find((r) => r.route === '/');
const delta = home(after).firstLoadUncompressedJsBytes - home(before).firstLoadUncompressedJsBytes;
console.log('/ first-load bytes', home(before).firstLoadUncompressedJsBytes, '->', home(after).firstLoadUncompressedJsBytes, 'delta', delta);
const NEEDLES = ['sidebar-wrapper', 'toaster', 'GP-002', 'Schedule 2 controlled drugs', 'offer-consent-refused', 'Not a live service', 'verification-rejected'];
for (const p of home(after).firstLoadChunkPaths) {
  const t = fs.readFileSync(p, 'utf8');
  for (const n of NEEDLES) if (t.includes(n)) console.log('LEAK', JSON.stringify(n), 'in', p);
}
for (const r of after) console.log(r.route.padEnd(40), r.firstLoadUncompressedJsBytes);
EOF
```
Expected: the delta on `/` is zero or a few hundred bytes (the shared chunk only), and no `LEAK` line. A leak means an import path pulled the shell or the fixtures into the landing page — fix the import, never the check.

- [ ] **Step 3: `scripts/screenshot-dashboards.mjs`**

```js
// Every dashboard route, in both data modes, at both widths. Playwright is not
// installed; this drives the cached chrome-headless-shell through puppeteer-core
// from the npx cache, which is what CLAUDE.md's Verifying changes section means.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const puppeteer = require(join(homedir(), '.npm/_npx/7d92d9a2d2ccc630/node_modules/puppeteer-core'));
const executablePath = join(homedir(), '.cache/puppeteer/chrome-headless-shell/mac_arm-152.0.7977.54/chrome-headless-shell-mac-arm64/chrome-headless-shell');
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT = process.env.OUT_DIR ?? '/private/tmp/claude-501/-Users-liam-development-DrQuick-website/4de69205-47c5-4cc2-8bcd-f59b3b85453d/scratchpad/dashboards';

const GATES = ['verification-pending', 'verification-rejected', 'indemnity-expired', 'revalidation-due'];
const STEPS = ['register', 'identity', 'credentials', 'indemnity', 'skills', 'done'];
const SESSION = ['offline', 'online-idle', 'no-patients-waiting', 'offer', 'offer-consent-refused',
  'consultation', 'complete', 'offer-declined', 'offer-timed-out', 'patient-no-show'];
export const URLS = [
  '/doctor', ...GATES.map((g) => `/doctor?gate=${g}`), '/doctor/earnings', '/doctor/profile',
  ...STEPS.map((s) => `/doctor/onboarding/${s}`), ...SESSION.map((s) => `/doctor/session/${s}`),
  '/admin', '/admin/governance', '/admin/supply', '/admin/business',
];
const MODES = ['', 'seeded'];
const WIDTHS = [1440, 390];
const withMode = (url, mode) => (mode ? `${url}${url.includes('?') ? '&' : '?'}data=${mode}` : url);
const slug = (url) => url.replace(/^\//, '').replace(/[/?=&]+/g, '_');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function settle(page, mode) {
  // Both attributes are set after hydration and neither exists in the server
  // HTML, so waiting on them is waiting for the page to be itself.
  await page.waitForSelector(`html[data-figures="${mode || 'placeholder'}"]`, { timeout: 15_000 });
  await page.waitForSelector('[data-arrived="true"]', { timeout: 15_000 });
  await page.evaluate(() => document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('in')));
  await sleep(400);
}

async function capture(page, url, mode, width) {
  const target = withMode(url, mode);
  await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
  await page.goto(BASE + target, { waitUntil: 'load' });
  await settle(page, mode);
  // online-idle hands on after 8s and an offer expires after 45s: a shot taken
  // late is a picture of a different screen, so refuse it rather than file it.
  const expected = new URL(BASE + target).pathname;
  const actual = new URL(page.url()).pathname;
  if (actual !== expected) throw new Error(`${target} moved to ${actual} before capture — retake`);
  const file = join(OUT, `${slug(url)}--${mode || 'blank'}--${width}.png`);
  await page.screenshot({ path: file, fullPage: true });
  if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) {
    console.warn('HORIZONTAL OVERFLOW', target, width);
  }
  return file;
}

export async function matrix(browser) {
  const page = await browser.newPage();
  const files = [];
  for (const url of URLS) for (const mode of MODES) for (const width of WIDTHS) files.push(await capture(page, url, mode, width));
  return files;
}

export async function noScript(browser) {
  const page = await browser.newPage();
  await page.setJavaScriptEnabled(false);
  await page.setViewport({ width: 1440, height: 900 });
  for (const url of ['/doctor', '/admin']) {
    await page.goto(BASE + url, { waitUntil: 'load' });
    const facts = await page.evaluate(() => ({
      ribbon: !!document.querySelector('[data-slot="ribbon"]'),
      h1: document.querySelector('h1')?.textContent?.trim() ?? null,
      noscriptNav: !!document.querySelector('noscript'),
      figuresInStats: [...document.querySelectorAll('[data-slot="stat-value"]')].map((e) => e.textContent).filter((t) => /\d/.test(t)),
    }));
    await page.screenshot({ path: join(OUT, `${slug(url)}--nojs--1440.png`), fullPage: true });
    console.log('no-JS', url, facts);
  }
}

async function tabTo(page, label, max = 80) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const text = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
    if (text === label) return i + 1;
  }
  throw new Error(`Tab never reached "${label}"`);
}

export async function keyboardWalk(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${BASE}/doctor/session/offer?data=seeded`, { waitUntil: 'load' });
  await settle(page, 'seeded');
  const t1 = await tabTo(page, 'Accept'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => location.pathname === '/doctor/session/consultation', { timeout: 5_000 });
  const t2 = await tabTo(page, 'Finish consultation'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => location.pathname === '/doctor/session/complete', { timeout: 5_000 });
  const fee = await page.evaluate(() => document.body.textContent.includes('£39'));
  console.log(`keyboard offer→complete: ${t1} tabs to Accept, ${t2} to Finish; fee ${fee ? 'shown' : 'MISSING'}`);

  // The whole of onboarding without a mouse.
  await page.goto(`${BASE}/doctor/onboarding/register?data=seeded`, { waitUntil: 'load' });
  await settle(page, 'seeded');
  for (const [label, next] of [['Continue', 'identity'], ['Verify identity', 'credentials'],
    ['Continue', 'indemnity'], ['Use Dr Quick cover', 'skills'], ['Continue', 'done']]) {
    await tabTo(page, label);
    await page.keyboard.press('Enter');
    await page.waitForFunction((s) => location.pathname.endsWith(s), { timeout: 5_000 }, next);
  }
  console.log('keyboard onboarding: register → done, no mouse');
}

const what = process.argv[2] ?? 'all';
mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true });
try {
  if (what === 'matrix' || what === 'all') console.log((await matrix(browser)).length, 'captures');
  if (what === 'nojs' || what === 'all') await noScript(browser);
  if (what === 'keys' || what === 'all') await keyboardWalk(browser);
} finally { await browser.close(); }
```

- [ ] **Step 4: Run the matrix and look at all 108**

```bash
npm run dev &            # or reuse a server already on :3000
node scripts/screenshot-dashboards.mjs all
```
27 URLs × 2 modes × 2 widths = **108** PNGs, plus 2 no-JS captures. Open every one. For each, confirm:

1. the ribbon is present and legible;
2. in blank mode, no figure that should be a dash is a number — the only digits allowed are `£39`, a credential's "N days", "7 of 7", "Schedule 2/3" and the GMC field's "7 digits" placeholder;
3. nothing is red, amber or green except a status badge or the countdown's last five seconds;
4. no card has a border, and no screen has two band cards;
5. at 390 nothing overflows horizontally, tables have stacked, and the state jumper does not cover Accept or Decline;
6. the charts' axis type is the same size at both widths.

Record every issue found and whether it was fixed here or sent back to its task.

- [ ] **Step 5: The mouse walk and the £39 delta**

Seeded, by mouse: `/doctor` → note "Earned today" (£117) and `/doctor/earnings` "Next payout" (£468) → go online from the dashboard tile → accept the offer → finish the consultation → back to `/doctor`. "Earned today" must read £156 and "Next payout" £507 — a difference of exactly one fee in each. Repeat blank: `—` becomes `£39`.

- [ ] **Step 6: The greps and the gallery**

```bash
grep -rinwE 'schedule|rota|calendar' 'app/(app)/doctor' components/doctor ; echo "exit $?"   # expect no lines, exit 1
grep -rnE 'dark:|oklch\(|hsl\(' app components lib                                          # expect nothing
```
Then open `/dev/ui` at 1440 and 390 and confirm every component this plan added or changed appears there: Checkbox, the stacked Table, StatTile, StatusBadge, CredentialMatrix, Stepper, Countdown, both charts, ChartLegend, Ribbon, EmptyState, Facts, PageHeader and the StateJumper.

- [ ] **Step 7: Landing-page parity**

Re-shoot `/` and `/?role=gp` at 1440 and 390 and diff against the Task 1 baselines. They must be identical: this plan touched `app/globals.css` (two type tokens and one arrival rule) and `components/ui/table.tsx`, none of which the landing page uses. Any difference is a regression to fix, not to explain.

- [ ] **Step 8: Commit the script and any fixes**

```bash
git add scripts/screenshot-dashboards.mjs
git commit -m "chore(verify): dashboard screenshot matrix and fixes

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 9: Write the report**

Under these headings, and no others:

1. **Routes built** — the 23 doctor URLs and 4 admin URLs, and which are gates rather than routes.
2. **Components added** — to `components/ui/` (Checkbox, and the `stack` prop on Table) and to `components/app/`, `components/doctor/`, `components/admin/`.
3. **What ported unchanged** — the seven modules, and the 48 unit tests that moved with an import-path change.
4. **Every content or behaviour change, and why** — Decisions 5, 6, 7, 8, 17, 18, 22, 29, 30 and the two new sentences (the demand note on `no-patients-waiting`, the "Queue wait" tile on the floor). Include the figures that visibly changed: 32 → 40 consults, £1,248 → £1,560, 5 of 5 → 7 of 7, 312 → 120 days.
5. **Screenshots** — the count, and every visual issue found and how it was resolved.
6. **Conflicts and their resolution** — `alerts.js` port-versus-rewrite, `revalidation-due` block-versus-banner, ratings, the five-versus-seven credential rows, the DESIGN.md divider rule, `numeric-data` tabular, the three-colour law against success and error, the preview palette, and the `FEE`-versus-£24–33 question, which is **not** resolved and is for a human.
7. **The five prototype decisions** — decisions 1 (Semble), 2 (indemnity), 4 (pre-acceptance information) and 5 (one admin tool) can each still be settled from the screens as built; decision 3 (what a patient sees when no GP is available) is patient-side and out of this plan's scope, and the admin floor's "failed matches" counter is the only supply-side view of it here.

Do not report "professional". Report what was checked.

---

## Baselines

Filled in by Task 1 before any code is written:

- `/` first-load JS from `.next/diagnostics/route-bundle-stats.json`, measured against commit `062a8af` (`feat(ui): shadcn component layer, gallery route and surface textures`): **494,295 bytes** (`firstLoadUncompressedJsBytes`) across **7 chunks** (`firstLoadChunkPaths`). The full JSON is archived at `/private/tmp/claude-501/-Users-liam-development-DrQuick-website/4de69205-47c5-4cc2-8bcd-f59b3b85453d/scratchpad/before.json` for the later diff task.
- Four full-page screenshots at 1440×900 and 390×844, patient (`/`) and GP (`/?role=gp`) modes, `[data-reveal]` elements forced to `.in` before capture: `landing-before-patient-desktop.png`, `landing-before-patient-mobile.png`, `landing-before-gp-desktop.png`, `landing-before-gp-mobile.png`, all in the session scratchpad (`/private/tmp/claude-501/-Users-liam-development-DrQuick-website/4de69205-47c5-4cc2-8bcd-f59b3b85453d/scratchpad/`).


---

## Addendum — 2026-09-04: the flat £39 is gone, and what that costs tasks 16 and 21

Recorded mid-execution (after task 9), because it invalidates figures this plan
asserts. A concurrent session acted on a direct user instruction — verbatim: "We
want to remove any pricing, we will use ubers surge pricing model, due to supply,
demand etc." — and the flat consultation fee was removed from both the patient and
the GP side of the landing page, from `PRODUCT.md`, and from `CLAUDE.md`'s pricing
constraint. `Docs/Dr_Quick_Research_Report.md` was deliberately left as written:
the reversal overrides its recommendation rather than rewriting its findings.

What this plan must now read differently:

- **`FEE` no longer exists.** It is deleted from `lib/fixtures.ts`, and
  `tests/lib/fixtures.test.ts` asserts `!('FEE' in F)`. Do not reintroduce it.
- **`OFFER.fee` is what a consultation pays** — the figure shown to the GP before
  they accept. `lib/session.ts`'s `complete` banks it onto the `SessionRecord`.
- **Money is no longer derivable from a consultation count.** `RecentConsult`
  gained a required `fee: number` and `DailyConsults` an `earnings: number`;
  `lib/earnings.ts` sums amounts rather than multiplying. Per-day rates differ on
  purpose, so a test that assumes a constant rate per consult will fail.
- **Seeded figures for tasks 16 and 22–25 to assert against:** fortnight 677,
  payoutAmount 373, today 102, toDate 1186. `DOCTOR_DASHBOARD.recent` rows sum to
  their day (today's three = 102, yesterday's two = 57).
- **Task 21's assertion changes** from "earnings update by exactly £39" to
  "earnings update by exactly `OFFER.fee`". Import the constant; never type the
  number, or the assertion drifts the next time the offer rate moves. The shape of
  the test survives — a completed consultation still moves every figure by exactly
  one fee.
- **Still undecided, and not ours to decide:** the relationship between the patient
  price and GP pay. `PAYOUT_RUNS[0].amount` is still `BUSINESS.revenue` — the same
  conflation Decision 30 recorded. If the `/admin` business screen needs those two
  separated, that is a user decision.

The wording bans are unaffected and still enforced by `tests/constraints.test.ts`:
`/\bsurge\b/i`, `priority queue` and `busier than usual` all remain banned. The
reversal was to the pricing *model*, not to how it may be presented.
