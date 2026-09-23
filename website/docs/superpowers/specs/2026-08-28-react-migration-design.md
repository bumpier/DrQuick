# Dr Quick — flat HTML to React

**Date:** 2026-08-28
**Status:** Approved design, awaiting implementation plan

## What this is

The Dr Quick site is two hand-written surfaces with no build step: a single
943-line `index.html` marketing page, and a `preview/` prototype of the
patient, doctor and admin apps built from twelve vanilla JS modules and three
stylesheets. Three dependency-free Vercel functions and a shared Redis REST
client back the waitlist.

This document specifies rebuilding both surfaces as one Next.js application.

## Scope

**In scope.** A faithful port. Every behaviour that exists today exists after,
and nothing that does not exist today is invented.

**Out of scope, explicitly.** Authentication. A database behind the
dashboards. Real GP offer routing, video consultation, payments or
prescribing integration. The dashboards remain a fixture-driven prototype
that says so on every screen. Building the actual product is a separate
programme with regulatory work on its critical path, and it is not this.

The waitlist API keeps working against real Redis exactly as it does now.

## Stack

| | |
|---|---|
| Framework | Next.js 16, App Router |
| Language | TypeScript, `strict` |
| Styling | Tailwind CSS v4 (`@theme`), plus a small authored-CSS layer |
| Tests | Vitest + React Testing Library |
| Runtime | Node (never `edge`) |
| Deploy | Vercel, as today |

Node 26 / npm 11 are present locally.

### Why Next rather than a Vite SPA

The landing page is the one page where server rendering is load-bearing, and
it was hand-tuned for it. `CLAUDE.md` requires that without JavaScript both
role modes render stacked, so a blocked script can never hide the GP content;
it also requires real `og:`/`twitter:` metadata for the share card. A
client-rendered SPA gives crawlers an empty shell and loses the no-JS render.
Next provides both without splitting the codebase, which is what a separate
Astro landing page would have cost.

## Architecture

### Two kinds of screen

`preview/` declares 49 `data-screen` values — 22 patient, 23 doctor, 4 admin.
They are not 49 pages. They are
destinations and state-machine states, and the hash router had to flatten the
distinction because vanilla JS offered nothing better.

**Destinations** become routes:

```
/                                    landing (patient; ?role=gp for GP)

/patient                             home dashboard
/patient/consultations               history, with the working filter
/patient/consultations/[id]          consultation detail
/patient/prescriptions
/patient/account

/doctor                              dashboard
/doctor/earnings
/doctor/profile

/admin                               live floor
/admin/governance
/admin/supply
/admin/business
```

**States** become reducers, rendered under one route each with the state in a
catch-all segment:

```
/patient/book/[[...step]]            the booking flow
/doctor/onboarding/[[...step]]       registration through to onboarding-done
/doctor/session/[[...state]]         offline / online / offer / consultation
```

The four doctor blocking gates — `verification-pending`,
`verification-rejected`, `indemnity-expired`, `revalidation-due` — are not
states of the session. They replace the dashboard, and are rendered by
`/doctor` itself from the GP's credential record.

#### Why states still carry a URL

`preview/js/rail.js` gives a reviewer a rail that jumps directly to any
screen, including terminal states like `payment-failed` and `no-gp-available`
that are otherwise several minutes of clicking away. That affordance is worth
keeping, so each state is addressable.

Navigation always goes through the reducer and the URL follows it — never the
reverse. Landing directly on a step seeds the booking with the worked-example
defaults, exactly as `preview/js/flow.js:31-40` does now, so no screen is ever
blank before the flow has run.

### State

| Concern | Today | After |
|---|---|---|
| Booking | closure variable in `flow.js` | `useReducer` in `BookingProvider` |
| GP session | screen id | `useReducer` in `SessionProvider` |
| Data mode | module-level `let mode` | `DataModeProvider`, reads `?data=seeded` |
| Active nav / area | `shell.js` on `screenchange` | derived from the route |

No global store. Each surface's provider is mounted by that surface's layout,
so the patient app cannot read the doctor's state.

### What ports unchanged

Roughly a third of the preview's JavaScript is already pure functions with the DOM
kept out. It moves with type annotations added and nothing else:

- `booking.js` — `createBooking`, `waitEstimate`, `matchGp`, `outcomeFor`,
  `endedEarly`, `consultationRecord`, `formatClock`, `COMPLAINTS`
- `charts.js` — bar and line geometry, already separated from markup
- `placeholder.js` — `DASH`, `shown`, `live`, `seed`, `listOr`
- `live.js` — `formatEta`, `tickQueue`, `startInterval`
- `shell.js` — `activeNav`, `areaOf`
- `fixtures.js` — data unchanged, shapes typed

Rewritten: `flow.js`, `patient.js`, `doctor.js`, `router.js`, `rail.js`,
`alerts.js`, `icons.js`, and all markup.

### The placeholder rules are not negotiable

`preview/js/placeholder.js` encodes the reason the dashboards ship blank:
nothing has launched, and a dashboard reading "£1,248 earned, 32
consultations" makes a claim about a service that has not seen a patient.

Both rules survive with their current semantics:

- `shown(v)` — a figure only a running platform could produce. An em dash
  until `?data=seeded`.
- `live(v)` — a figure this session can genuinely produce. A patient who walks
  the booking flow really does hold a consultation afterwards, and it appears.
  Zero renders as a dash, because "0 consultations" claims the service ran and
  nobody came.

The £39 fee, the 999 band and the restricted-items register are product and
policy facts, not traction, and render in both modes.

## Landing page

Statically generated. Both role modes are in the HTML.

**Role resolution before paint.** The inline script from `index.html:32-46`
stays an inline script in the root layout, setting `.js` and `data-role` on
`<html>` before first paint. Mode hiding stays in CSS keyed off
`[data-role]` — it must not become React state, because React state means
waiting for hydration, which means a visible flash of the wrong mode. Without
the script neither hiding rule matches and both modes render, which is the
required no-JS behaviour.

**Role switch** is a client component: sets `data-role`, updates
`aria-current`, repoints the nav CTA, calls `history.replaceState` with
`?role=gp`, scrolls to top, moves focus to the new `h1`.

**Reveal grammar** becomes a hook holding today's constants — 16px rise, 70ms
step, 300ms cap, hero on load at 90ms, reveal-once via IntersectionObserver
with `unobserve` on entry, `setTimeout` rather than nested `rAF` so a
throttled tab cannot stall it. A mode is revealed the first time it is shown,
not up front. Start states stay under `.js`.

**Illustration idle.** `doctors-bro.svg` becomes an inlined component so the
loop can be paused off-screen; `assets/doctors-bro.svg` stays the source of
truth. Both guards kept: IntersectionObserver toggling `art-live`, and
`prefers-reduced-motion: no-preference`. `phone-illustration.svg` stays an
external `<img>` — only the patient illustration carries the loop.

**Forms.** One `<WaitlistForm role source />` renders all four instances.
Identical POST body, identical handling of 200/400/429/502/503, the `.hp`
honeypot, client-side email validation, distinct `.ok` and `.err` states,
`aria-invalid` on the input, and focus moved to the status region on success.
Email stays the only field.

**Metadata.** `og:image` and `twitter:image` move to the Next `metadata`
export with `metadataBase` from `NEXT_PUBLIC_SITE_URL`. Unset, the build fails
loudly rather than emitting a silently relative path.

## Styling

Tailwind v4, configured through `@theme`.

The `DESIGN.md` front matter is already a machine-readable token set — colours,
the full typography scale, `rounded`, and a 4-unit spacing scale through to the
`clamp()` section rhythms. It is the source; the `@theme` block is generated
from it, and `DESIGN.md` gains a short section recording that mapping.

Tailwind carries layout, spacing, and type. What it cannot express honestly
stays in an authored CSS layer:

- the arrival grammar — `[data-reveal]` start states and the `--d` stagger var
- the SVG idle keyframes
- `[data-role]` mode hiding
- hairline rules between sections

The three breakpoints stay distinct and keep their reasons: `1080px` collapses
only the two form-bearing grids, `900px` is the general two-column-to-one,
`560px` is the phone pass.

### The palette guard

Utilities open one hole the current CSS does not have: an arbitrary value like
`bg-[#005EB8]` puts NHS Blue on the page with nothing to catch it.

`preview/tests/constraints.test.mjs` already carries an `ALLOWED_HEX` set. It
is extended to:

1. scan `.tsx` and `.ts` as well as `.html`, `.css`, `.js`
2. reject any Tailwind arbitrary colour value outside the allowed set
3. read the `@theme` block as the only place a new token may be declared

**The two palettes must be reconciled first.** `DESIGN.md` declares
`#666666`, `#1A1A1A`, `#242424`; the preview's `ALLOWED_HEX` declares
`#8a8a8a`, `#595959`, `#c9c9c9`. Neither list contains the other. The union is
audited once, reduced where two tints are doing one job, and the result becomes
the single allowed set.

## API

`api/*.js` become route handlers under `app/api/`, one per route, on the Node
runtime. The logic is unchanged and the zero-dependency constraint holds — the
Redis REST client in `_store.js` is already plain `fetch`.

Carried over without alteration:

- IP is never retained; the rate-limit key is a salted SHA-256 hash with a 600s
  TTL and is never written into the waitlist record
- `csvCell` escapes leading `= + - @` so a crafted address cannot execute as a
  spreadsheet formula
- without `WAITLIST_EXPORT_TOKEN`, both the export and delete routes refuse
  every request

`vercel.json` headers move to `next.config.ts`. Two changes:

- the `/preview/(.*)` noindex rule is re-pointed at `/patient`, `/doctor` and
  `/admin`, which are a prototype and must not be indexed
- `next/font` self-hosts Archivo, so `fonts.googleapis.com` and
  `fonts.gstatic.com` drop out of `style-src` and `font-src`, tightening the
  CSP rather than loosening it

`'unsafe-inline'` stays in `script-src`: the pre-paint role script needs it.

## Tests

| File | Today | After |
|---|---|---|
| `constraints.test.mjs` | 16 tests, `node:test` | Vitest, extended per above |
| `units.test.mjs` | 59 tests | Vitest; mostly an import-path change |
| `structure.test.mjs` | 56 tests, parses HTML | Rewritten against rendered components |

`structure.test.mjs` is the only genuine rewrite. The assertions it makes are
kept, in particular the one the prototype README calls out: a GP does not book
shifts. There is no rota. A GP goes online, takes offers as they come, and a
decline passes the offer straight to the next GP — and a test says so.

Compliance assertions are extended, not merely preserved:

- both `tel:999` links exist, one in the patient band and one in the footer
- no medicine is named anywhere in source
- no surge or dynamic-pricing vocabulary
- controlled-drug wording stays scoped to Schedule 2 and 3
- Scotland, Wales and Northern Ireland are all three named wherever the page
  lists what is not covered
- the Storyset attribution link is present while a Storyset asset is on the page

## Compliance carried verbatim

These are copied, not rewritten, and the constraints test guards them:

- One fixed price, £39, shown in full before booking. Never surge pricing.
- Never "prescriptions included". Prescription wording stays conditional.
- Never state or imply £39 covers the medicine — it covers writing the
  prescription; the pharmacy charges separately.
- "CQC-registered clinical service at launch". Never a CQC-registered clinical
  partner, never a registration number.
- England only. Never UK-wide.
- Nothing beyond email is collected on the landing page.
- The `DEPLOY / LEGAL` marker for the UK GDPR Art 13 controller details moves
  across intact. The privacy notice is still incomplete and still blocks
  launch; this migration does not change that and must not appear to.

## Sequence

Four milestones. Each ends with the site running and screenshot at 1440px and
390px, footer included, per `CLAUDE.md`.

Each milestone gets its own implementation plan. One plan covering all four
would be too large to hold in context and too coarse to review, and the
foundation milestone settles decisions — the reconciled palette, the shape of
the authored CSS layer, the provider pattern — that the later plans depend on.

**1 — Foundation and landing page.** Scaffold, `@theme` from the reconciled
token set, the authored CSS layer, the landing page at parity including both
modes, all four forms, the motion grammar and the idle illustration, and the
four API routes. Ends with `index.html` deletable.

**2 — Patient surface.** App shell, the five destinations, and the booking
reducer with all seventeen states and their forks. The largest milestone.

**3 — Doctor surface.** Dashboard, earnings, profile, the onboarding reducer,
the session reducer, and the four blocking gates.

**4 — Admin surface and completion.** Floor, governance, supply, business.
Test suite complete. `preview/` and the old `index.html` deleted.

## Risks

**Tailwind and the design record.** Rewriting the system as utilities trades
some traceability to `DESIGN.md` for speed of writing new UI. This was a
deliberate choice. It is mitigated by generating `@theme` from the `DESIGN.md`
front matter rather than by hand, and by the palette guard test — but
`DESIGN.md` will need the mapping section kept current, and that is a standing
cost rather than a one-off.

**Milestone 2 is most of the work.** Seventeen booking states with real forks
on what the patient typed. Milestones 3 and 4 are comparatively mechanical.

**Prototype honesty.** The dashboards get real routes and a real framework,
which makes them look more finished than they are. The prototype chrome, the
blank-by-default data mode and the noindex headers all have to survive the
port, or the migration quietly turns a prototype into something that reads as
a running service.

## Addendum — 2026-09-02: the component layer

Milestones 2–4 build every screen from `components/ui/`: shadcn/ui on the
Radix base, restyled to `DESIGN.md` (see "shadcn token mapping" there and
"Component layer" in `CLAUDE.md`). `preview/css/components.css` and
`preview/css/dashboard.css` are the behavioural reference for what a screen
needs, not a stylesheet to port: `.btn` is `Button`, `.card` is `Card`,
`.tag` / `.pill` are `Badge`, `.tabs` is `Tabs`, `.table` (with
`.table-scroll`) is `Table`, `.gate` is `Dialog` / `Sheet`, `.alert` is
`Alert`, `.toast` is `sonner`, `.meter` is `Progress`, `.toggle` is
`Switch`, `.avatar` is `Avatar`, `.choice` is `RadioGroup`, and `.shell` /
`.rail` / `.topnav` are `Sidebar`, with `SidebarProvider` mounted inside each
surface's layout and never the root layout. The development-only gallery at
`/dev/ui` is the visual reference for every component, variant and state; a
screen that needs a component the gallery does not show adds it via the CLI,
restyles it, and adds it to the gallery first. Charts stay authored inline SVG
from the `charts.js` geometry — no Recharts. The landing page's FAQ and role
switch are not Radix and stay that way.
