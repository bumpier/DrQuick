# Animation plans — Dr Quick website

Plans produced by `improve-animations` against `index.html` at commit `3bb260761`.

Each plan is self-contained: it names the exact file, the current code, the target values and the
feel checks. An executor needs no context beyond the plan itself.

## Plans

| # | Title | Severity | Category | Scope | Status |
|---|---|---|---|---|---|
| [001](001-faq-disclosure-symmetry.md) | Make the FAQ disclosure open and close with one symmetric transition | MEDIUM | Physicality / Cohesion | `index.html`, ~10 lines CSS | **DONE** (feel-check outstanding) |
| [002](002-pending-submit-indicator.md) | Give the submitting waitlist button a sign of life | MEDIUM | Missed opportunity / Feedback | `index.html`, ~12 lines CSS | **DONE** (live throttled-submit check outstanding) |
| [003](003-invalid-field-no-reflow.md) | Stop the email field jumping 1px when it goes invalid | LOW | Physicality / Cohesion | `index.html`, 4 declarations | **DONE** |

## Recommended execution order

Run **001 → 002 → 003**, in that order, by descending leverage.

- **001 first.** It is the only place the page contradicts its own motion grammar: content that
  arrives with a considered 280ms curve and leaves with none, plus an unanimated layout snap
  underneath the fade that the fade was apparently meant to hide. Highest leverage of the three.
- **002 second.** Lower reach than 001 (a visitor submits once), but it protects the single
  conversion moment on a page whose whole job is conversion, and it is the only one of the three
  that adds information rather than smoothing something.
- **003 last.** Genuinely small — a 1px shift — and honest to rank there.

## Dependencies

**None.** All three touch `index.html` but different, non-overlapping regions:

| Plan | Region of `index.html` |
|---|---|
| 001 | `:root` block (~line 53) and the FAQ rules (~lines 298–299) |
| 002 | Button rules, inserted after ~line 175 |
| 003 | Input rules (~lines 195, 202, 207) |

They can be executed in any order or in parallel. If run in parallel, be aware that plan 001 inserts
a line into the `:root` block, which will shift every line number cited by 002 and 003 by one. Each
plan quotes the code it expects verbatim and instructs the executor to STOP on mismatch, so a shift
will be caught rather than silently mis-applied — but running them sequentially and re-reading the
file between plans avoids the issue entirely.

## Project constraints every executor must respect

These come from `CLAUDE.md` and apply to all three plans:

- `index.html` is a **single file with no build step and no npm dependencies**. All CSS lives in the
  `<style>` block in the `<head>`. Do not add a stylesheet, a bundler, or a package.
- **Exactly three colours** plus neutral greys: `--black` `#000000`, `--white` `#FFFFFF`, `--blue`
  `#1447E6` — and `--blue-lift` `#6E9BFF` wherever blue sits on a black ground. Never NHS Blue
  `#005EB8` or anything near it.
- **No shadows, no gradients, no glass, no emoji or unicode icons.** Icons are authored SVG.
- Easing tokens live at `index.html:51-52` — `--ease: cubic-bezier(.22,.61,.36,1)` for interactive
  state changes, `--ease-out: cubic-bezier(.16,1,.3,1)` for content arrivals. Reference them as
  `var(...)`; never paste a raw cubic-bezier.
- Durations are written short (`.28s`), not in milliseconds.
- CSS comments are prose sentences explaining *why*, not section labels. See `index.html:223-224`.
- **Render before delivering.** Screenshot at 1440px and 390px and check both, footer included.
  Playwright is not installed; the cached headless Chrome at
  `~/.cache/puppeteer/chrome-headless-shell/*/chrome-headless-shell-mac-arm64/chrome-headless-shell`
  works with `--headless --window-size=W,H --screenshot=out.png <url>`. Serve locally first
  (`python3 -m http.server`) — `file://` loads fonts unreliably.

## Not in scope

Deliberately rejected during the sweep, recorded so they are not re-proposed:

- Motion on the `tel:999` links (`index.html:94`, `96`) — someone may be tapping these while
  shaking. Never animate.
- Press feedback on `.faq summary` — the disclosure is the feedback.
- Per-row stagger on the "what it covers" lists — information the reader is scanning to decide.
- Counting the `£39` up on reveal — the one number the reader is there to read, and one the
  compliance rules require to read as fixed.
- A height collapse or shadow on the sticky nav — scroll-frequency, and shadows are banned.
- A shared-element move from the nav CTA to `#join` — `scroll-behavior: smooth` already tells that
  spatial story.

One item noted during the sweep is **not** covered by any plan: `.btn:hover`,
`.faq summary:hover` and `input:hover` are not gated by
`@media (hover: hover) and (pointer: fine)`, so hover styles can stick after a tap on touch devices.
That is hygiene rather than an animation finding, and was left out rather than padded into a plan.
