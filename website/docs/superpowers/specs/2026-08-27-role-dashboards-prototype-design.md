# Role dashboards — clickable prototype

**Date:** 2026-08-27
**Status:** Design approved, not yet implemented
**Scope:** A non-functional, clickable prototype of three role surfaces — patient, doctor, admin.

---

## Why this exists

Dr Quick is pre-launch. The repository holds a 715-line static landing page and four
dependency-free serverless functions that write waitlist emails to Redis. There is no
framework, no auth, no database, and no user model.

Three role dashboards are therefore not a change to an existing flow. They are three
applications on a platform that does not exist yet, and the realistic build behind them is
the £80–150k / 4–6 month programme described in `Docs/Dr_Quick_Research_Report.md` §5.

The prototype's job is to settle **what each role actually sees and does** before that
money is committed. Breadth over polish. It depicts data; it never collects any.

## Goal

A person can open three pages, walk each role's flow end to end, and jump directly to any
awkward state, in order to agree — or disagree — about what each role's product is.

## Non-goals

- No authentication, no backend, no database, no real data.
- No changes to `index.html` or anything in `api/`.
- No npm dependencies and no build step.
- No framework decision. `PRODUCT.md` records that the framework must be chosen once, on
  the product's requirements, and not as a side effect. Building this in Next.js would
  make that decision by accident, so it stays static.

## Decisions taken

| Decision | Chosen |
|---|---|
| What we are building | A design prototype of all three roles |
| What it is for | Settling what each role does, before the build |
| Form | Clickable static pages in this repo |
| Admin scope | All four areas: governance, GP supply, live operations, business |
| Severity signalling | Hold the three-colour law; encode severity by fill, weight, position |

---

## Constraints the prototype inherits

A mockup that depicts a forbidden feature quietly becomes the specification for one. These
bind the artefact, not just the eventual product.

1. **No surge, dynamic, or time-pressure pricing.** One queue, one price, £39, shown in
   full. The superseded landing-page concept's "£82 Priority · busier than usual" is
   permanently out. The word *priority* is avoided in queue copy for the same reason.
2. **No medicine is named anywhere**, including placeholder and fixture text. Advertising a
   prescription-only medicine to the public is a criminal offence, and a screenshot of a
   mockup travels exactly like an advert. Prescriptions render as "your prescription".
3. **No algorithmic urgency shown to the patient.** The safety check is a red-flag
   questionnaire with a binary outcome, drawn to read as a checklist. Displaying a triage
   score would put the real product inside MHRA software-as-a-medical-device scope.
4. **£39 never implies the medicine is included.** The price screen states that the fee
   covers the consultation and writing any prescription, and that the pharmacy charges
   separately. Silence here is a DMCC drip-pricing exposure.
5. **Nothing absent is fabricated.** No CQC registration number, no ratings, no GP
   headcount, no named GPs, no testimonials, no press. Admin figures stay visibly
   synthetic and round rather than tuned to look like a plausible business case.
6. **Controlled-drug wording stays scoped to Schedule 2 and 3.**
7. **The 999 route is real.** `tel:` links, keyboard-reachable, on every screen that
   carries the emergency path.

---

## Architecture

### Files

```
preview/index.html     role picker — three doors
preview/patient.html   patient flow
preview/doctor.html    doctor flow
preview/admin.html     admin, four sections
preview/css/base.css        tokens, reset, typography, ribbon, rail — the chrome
preview/css/components.css  product UI vocabulary — the product
preview/js/router.js        screen resolution and DOM wiring
preview/js/rail.js          rail model and rendering
preview/js/live.js          eta, countdown and timer helpers
preview/js/fixtures.js      all fake data, in one place
preview/tests/              constraint, unit and structure suites
```

The landing page keeps its single-file, inline-CSS form. The prototype uses shared
external files instead, because three surfaces sharing one component vocabulary is the
point — duplicated tokens would drift.

### Screen routing

Each page holds every screen as a `<section data-screen>`. A small router shows one at a
time and swaps on `data-goto` clicks. Fixture data renders into templates on load.

State that must feel live is a small number of intervals, not a state library:

- the patient's queue position and ETA ticking down,
- the doctor's 45-second offer window,
- the consultation timer,
- the admin floor's counters.

### The prototype rail

A bar pinned to the bottom of every page, deliberately styled as **not the product** —
monospace, dark, obviously chrome. It lists every screen and every state, each one click
away.

This is what serves the goal. A prototype you can only walk forwards through demonstrates
the happy path, and the happy path is the one nobody disagrees about. The decisions worth
settling live in the states that would otherwise take nine clicks to reach.

### Safety of the artefact

A convincing mockup of a regulated medical service, publicly reachable, is its own risk;
running an unregistered online doctor service is a criminal matter, and Medicine Direct is
the precedent recorded in the research report. Three guards:

- A persistent ribbon on every screen: *"Prototype. Not a live service — no real patients,
  GPs, or data."*
- `noindex,nofollow` in each page, plus an `X-Robots-Tag: noindex` header for
  `/preview/(.*)` in `vercel.json`.
- Unlinked from the landing page. Reachable only by knowing the path.

---

## Patient surface

Phone-first at 390px, scaling up. `PRODUCT.md` records that patients are unwell, often on a
phone, often impaired by pain or anxiety, and that low cognitive load and large targets are
functional requirements rather than polish. One decision per screen.

### Screens

1. **Entry** — one black button, "See a GP now".
2. **Symptoms** — structured questionnaire, minimal free text.
3. **Safety check** — red-flag questions, binary outcome: continue, or the 999 screen.
4. **Identity** — Stripe Identity handoff. CQC's online-provider programme expects identity
   verification at every consultation and states explicitly that a credit card is not ID.
5. **Your NHS GP** — practice details and consent to share the consultation summary.
6. **Price and wait** — £39 all-inclusive; live estimated wait as queue position × rolling
   average consult length; the two disclosures from constraint 4; and that the £39 is
   authorised now and captured only when a GP accepts.
7. **Queue** — position and ETA, ticking, with a findable cancel.
8. **Doctor ready** — the interrupt.
9. **Consultation** — video, stating on screen that the call is not recorded.
10. **Outcome** — prescription redeemable at any UK pharmacy, referral, fit note, summary
    shared or not per the earlier consent.
11. **Done.**

### States on the rail

Red flag → 999 · consent refused · no GP available · cancelled while queued · payment
authorisation failed · consult ended early.

Three carry real design weight:

- **Red flag → 999** is a full-bleed terminal screen with a real `tel:` link, matching how
  the landing page already treats the emergency disclaimer. Someone reaching it may be
  tapping while shaking.
- **No GP available** states plainly that the £39 hold is released and points somewhere
  useful (111, Pharmacy First) rather than dead-ending. It is the state most likely to be
  met with anger and the one a demo would skip.
- **Consent refused** continues, but surfaces the constraint on the doctor's screen, because
  CQC's stated expectation is that a doctor lacking sufficient information declines to
  prescribe. The fork is shown on both sides rather than hidden.

---

## Doctor surface

Desktop-first. A GP working a shift is at a desk, and this is the one surface where density
is a virtue. Two products sharing a login.

### Onboarding — walked once

Register → identity → GMC number, licence to practise, GP Register (CCT) → enhanced DBS
with barred-list check → right to work → indemnity → clinical skills → done. Each gate
carries its own status, because they clear at very different speeds.

The indemnity step embeds a real product decision and the prototype should force it. CNSGP
covers NHS work only, so private telehealth needs MDO cover at £1,500–4,000/yr per GP,
which the research report says will kill casual supply unless Dr Quick buys block cover out
of its take. The block-cover screen is drawn as primary, with certificate upload and expiry
tracking as the reachable alternative.

### Working surface — every shift

The centre is one control: **online / offline**. Everything arranges around that state.

- **Offline** — earnings to date, consults completed, credential status, next revalidation.
- **Online and idle** — designed as the default state, not an edge case, since it is most of
  a shift: queue depth, patients waiting, time online, earnings today. A GP who goes online
  at 9pm to a screen with no signal that anything is happening goes offline again.
- **Offer** — 45-second window, counting down, accept or decline. What is shown *before*
  acceptance is deliberately limited to presenting complaint, age band, and whether
  summary-sharing is consented: enough to judge competence, no more. The full record opens
  on acceptance — the legitimate-relationship pattern the research report cites from NHS
  RBAC.
- **Consultation** — video with a patient context panel.
- **Complete** — outcome recorded, payment confirmed.

### The Semble handoff

The research report is explicit: buy Semble, do not build an EHR. So this surface contains
no notes editor; the GP writes the clinical record in another system mid-consult. That is a
real friction, and the prototype renders it as an explicit handoff panel rather than drawing
an in-app editor nobody intends to build. If the context switch looks unacceptable when
seen, that is a finding, and finding it now is cheap.

### States on the rail

Verification pending · verification rejected · **indemnity expired, blocking going online**
(a hard legal stop, not a warning) · offer declined · offer timed out · patient no-show ·
revalidation due · no patients waiting.

---

## Admin surface

One shell, left nav, four sections. Desktop-first and deliberately dense. Opens on **Live
operations**, the screen someone leaves open during an evening peak.

### Live operations

Queue depth and ETA, patients waiting, GPs online against GPs needed, consults in progress.
Then the failure counters, given equal weight rather than tucked away: offers declined,
offers timed out, failed matches, no-shows. Supply thinness appears in those four numbers
before it appears anywhere else, and supply depth is the stated moat.

### Clinical governance and safety

Built as evidence rather than as a report, because this is what CQC inspects. Incidents and
safeguarding referrals; red-flag escalations including how many patients reached the 999
screen; complaints with time-to-resolution; the audit log; break-glass access records with a
reason attached to each.

The load-bearing view is **prescribing outliers per GP against a restricted-items register**.
Push Doctor's failure was 137 prescriptions from their own do-not-prescribe list in twelve
months — a number nobody was watching. The platform-wide prohibition on Schedule 2 and 3
controlled drugs is a policy until something counts breaches of it, so the register is a
first-class object and every GP carries a rate against it.

### GP supply operations

Applications moving through verification; a per-GP credential matrix — GMC, licence, CCT,
DBS, right to work, indemnity, revalidation — each with an expiry date and a countdown; who
is online now; coverage against demand by hour; payout runs.

Expiry is the point, and it is wired to the doctor surface: the expired indemnity that
blocks a GP from going online appears here first, with warning before it bites. A matrix
that reports only the present tense is useless; the value is the fortnight of notice.

### Business and money

Consult volume, revenue, refunds, and the waitlist already collected. The top of the screen
carries two numbers only — **real CAC** and **repeat consults per patient per year** — each
shown against the plan's assumption of £16 and 1.8 rather than alone. The research report is
blunt that every comparable UK telehealth player that died, died on those two numbers, and
that a CAC nearer £50 means pivoting to B2B2C before the marketing budget is gone. A number
you cannot see drifting from its assumption is not a warning.

### Upgrade path, noted not built

This is the only section with no health data in it, and the waitlist data behind it already
exists. If one surface is later made real, it is this one.

---

## Design system extension

`preview.css` adds the product vocabulary the landing page lacks, built on the tokens
already in `index.html` — Archivo, the 4-unit spacing scale, `--r-control`, `--r-tile`, and
the existing neutral tints — so the prototype reads as the same product rather than a
cousin.

Components: app shell (top bar, left nav), data table, status pill, credential row with
expiry countdown, online/offline toggle, countdown timer, stat tile, field set, stepper,
video frame. Nothing else is built until a screen needs it.

### Severity without a fourth colour

The three-colour law holds. Severity is encoded by fill, weight, position and authored
icons: an expired row is black-filled, expiring is outlined, fine is plain, and urgent rows
sort to the top. This is also the more accessible answer — status that never depends on hue
alone works for colour-blind users, which red/amber/green does not.

### Motion

The landing page's arrival grammar (16px rise, 70ms stagger, capped at 300ms) applies to a
screen's **first paint only**. It must not fire on tab switches or data updates: a table
that re-animates whenever a number ticks is a failure, and the admin floor updates
constantly. Live values change without animating.

The offer countdown and the queue tick are functional motion — they carry information, so
under `prefers-reduced-motion` they persist in a static form rather than disappearing.

### Accessibility

Floor is the landing page's current level: `aria-live` status regions, labelled inputs,
visible `:focus-visible`. Three additions this surface requires:

- The 45-second offer countdown is announced, not merely animated, or a screen-reader GP
  loses the window silently.
- Queue position updates politely rather than interrupting.
- The 999 link is keyboard-reachable first on the red-flag screen.
- Tables carry proper headers and scope; no status depends on colour alone.

---

## Fixtures

All fake data lives in `preview/js/fixtures.js`, in one file, so the constraints above can be
checked by reading a single place. It contains no medicine names, no CQC number, no real or
plausible GP names, no ratings, and no figures tuned to resemble traction.

## Verification

Per `CLAUDE.md`: serve locally over `http` (`python3 -m http.server`), then screenshot every
screen and every rail state at 1440px and 390px using the cached headless Chrome at
`~/.cache/puppeteer/chrome-headless-shell/*/chrome-headless-shell-mac-arm64/chrome-headless-shell`,
and check them, including footers.

Additionally, confirm the existing Content-Security-Policy in `vercel.json` permits the
external stylesheets and ES modules under `preview/` — `script-src 'self'` and
`style-src 'self'` should, but this is verified rather than assumed.

---

## Decisions this prototype exists to settle

Recorded so the exercise is judged against them:

1. Is the Semble handoff acceptable friction mid-consult, or does the GP need notes in-app?
2. Does Dr Quick buy block indemnity, or do GPs upload their own certificates?
3. What does a patient see when no GP is available — and is it good enough to keep them?
4. Is the pre-acceptance information enough for a GP to judge competence?
5. Does the admin surface hold as one tool, or is clinical governance a separate product
   from live operations?
