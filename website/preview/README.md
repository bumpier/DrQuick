# Role prototype

Prototype of the patient, doctor and admin surfaces. Fake data throughout.
**Not a live service.**

The patient booking flow is not a slideshow: it reads what you actually type,
routes on it, runs the queue on a real clock, matches a GP from the fixtures
and writes the finished consultation into the account history. The doctor and
admin surfaces are still click-through.

Spec: `docs/superpowers/specs/2026-08-27-role-dashboards-prototype-design.md`

## What each surface is

Every surface is a signed-in app with the same shell — a sticky top bar
(wordmark, product nav, account) over a `.page` — and each opens on its own
dashboard, not on the top of a funnel.

- **Patient** (`patient.html`, opens on `home`) — dashboard, consultation
  history with a working filter, a consultation detail view, prescription
  tracking, and the account screen, plus the booking flow (`entry` → `done`).
  The product nav hides itself for the length of the flow.
- **Doctor** (`doctor.html`, opens on `dashboard`) — availability, credential
  alerts, a 14-day workload chart, a demand-by-hour chart, offers today,
  today's consultations, and performance. Plus earnings and profile.
  **A GP does not book shifts here.** They go online, take offers as they come
  and go offline; an offer is accept or decline, and a decline passes it
  straight to the next GP. Anything that looks like a rota is the wrong model
  and there is a test that says so.
- **Admin** (`admin.html`, opens on `floor`) — live floor with the cover gap,
  governance, GP supply, business.

## Data modes

The dashboards ship **blank**. Nothing has launched, so every figure that only
a running platform could produce — earnings, volumes, ratings, waiting counts —
renders as an em dash, and every list renders its empty state. The £39 fee, the
999 band and the restricted-items register stay, because those are product and
policy facts rather than traction.

Add `?data=seeded` to any preview URL to see the screens against the fixture
data they were designed on:

```
localhost:8000/preview/doctor.html?data=seeded#dashboard
```

`js/placeholder.js` holds the two rules. `shown()` is for a figure only a
running platform could produce — a dash until seeded. `live()` is for a figure
this session can genuinely produce: a patient who walks the booking flow really
does end up holding a consultation, and it appears on their dashboard straight
away.

## Files

- `css/base.css` — tokens, prototype chrome, the arrival grammar.
- `css/components.css` — the pieces the linear flows use.
- `css/dashboard.css` — the app shell and the dashboard vocabulary.
- `js/charts.js` — authored-SVG bar and line charts. Geometry is separated
  from markup so it can be unit-tested, and each chart is drawn at its
  container's real width so the axis type never shrinks with the viewport.
- `js/alerts.js` — credential alerts derived from the credential record, so an
  alert can never drift from the thing it describes.
- `js/shell.js` — which nav item is lit, and whether the page is a dashboard
  or a flow.
- `js/booking.js` — the consultation as data: the wait estimate, GP
  eligibility and matching, the outcome, and the record a consultation leaves
  behind. Pure functions, no DOM, all unit-tested.
- `js/flow.js` — wires `booking.js` to the patient screens: validation,
  routing, the queue clock, the arrival notification and the call timer.
- `js/icons.js` — every mark on these surfaces. No emoji, no icon font.
- `js/placeholder.js` — the blank-by-default rule and the `?data=seeded` switch.
- `js/fixtures.js` — all fake data. Figures that appear twice are derived once
  here; earnings are always consults × `FEE`.

## Run it

```bash
python3 -m http.server 8000
open http://localhost:8000/preview/
```

This works from either the `website/` directory (serve at the repo root and
open `localhost:8000/preview/`) or from inside `preview/` itself (serve there
and open `localhost:8000/`) — every asset path is relative, so both roots
resolve.

Every screen and state is one click away on the rail at the bottom of each
page, or reachable directly by hash — `/preview/patient.html#no-gp-available`.
Because of that, no screen may be blank before the flow has run: `flow.js`
paints a worked example into every one at start-up, and "See a GP now"
replaces it with a real booking.

## Driving the patient flow

Start at the dashboard and press **See a GP now**. Both data modes drive the
same flow, and the difference is worth seeing:

- **Default (placeholder)** — you are the first patient. The dashboard is
  empty, the advertised wait is a dash, and you walk the ID check. Finish a
  consultation and it is the only thing in your account.
- **`?data=seeded`** — you are a returning patient. History is populated, the
  wait is quoted, and the ID check is already on file, so that step is a
  Continue.

The queue you are actually sitting in always reads as a real number, in both
modes: that one this session genuinely produces. The wait quoted *before* you
book is a claim about a floor of GPs that does not exist yet, so it follows
the dashboard into a dash.

From there it behaves:

- The free-text box is required when the complaint is "Something else", and
  the practice postcode is validated.
- Ticking anything on the safety check relabels the one continue button and
  sends you to the 999 screen, which names back what you ticked. There is no
  second, differently-worded control to hunt for.
- The wait estimate is derived once from `FLOOR` — queue length divided by the
  GPs actually online — and the same number appears on the dashboard, the
  entry screen, the price screen and the queue.
- The queue runs on a real clock. When it reaches zero the matcher picks the
  least-loaded GP whose credentials are all in date, a notification arrives
  over whatever you are looking at, and the tab title changes. If no GP is
  eligible you get `no-gp-available` and the hold is released. **Prototype:
  the queue screen has a "skip the wait" link** so you do not have to sit
  through the estimate.
- The call clock counts up for real. End it under two minutes and you get the
  ended-early fork instead of the outcome.
- The outcome is derived from the complaint and the consent answer, so no path
  guarantees a prescription and refusing to share the NHS record actually
  costs one.
- Finishing writes the consultation into the account: it appears on the
  dashboard, in the history list, in the year totals and in the detail view.

The queue is a queue, not a priority tier — "priority queue" is banned wording
in `constraints.test.mjs`, because nothing on this platform sells a place in
the line.

**Opening a page directly as a file (`file://`) shows styled, readable
screens but no rail and no navigation.** Browsers refuse to load ES modules
over `file://`, so the router never runs. Each surface marks its opening
screen active in the markup for exactly this case — you get one readable
screen instead of a blank page — but clicking anything needs a real server.

## Test it

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test 'preview/tests/*.test.mjs'
```

Three suites, no dependencies:

- `constraints.test.mjs` — compliance guards. No medicine named, no surge or
  time-pressure wording, no invented CQC id, no off-palette colour, ribbon and
  noindex on every page.
- `units.test.mjs` — pure functions in `js/`.
- `structure.test.mjs` — every screen and state exists, and every link resolves.

## Screenshot it

```bash
CHROME=$(ls -d ~/.cache/puppeteer/chrome-headless-shell/*/chrome-headless-shell-mac-arm64/chrome-headless-shell | tail -1)
"$CHROME" --headless --window-size=390,844 --screenshot=out.png http://localhost:8000/preview/patient.html#queue
```

Check both 390px and 1440px before calling anything done.

## Rules

`preview/` may not add dependencies or a build step, may not name a medicine,
may not use a colour outside the twelve permitted values, and may not be linked
from the live landing page. The tests enforce all four.
