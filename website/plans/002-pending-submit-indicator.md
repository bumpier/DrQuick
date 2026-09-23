# 002 — Give the submitting waitlist button a sign of life

- **Status**: DONE (applied 2026-08-28; rendered and measured at 1440px and 390px, light and dark sections, plus `prefers-reduced-motion: reduce` — live throttled-submit feel-check still outstanding, see note at end)
- **Commit**: 3bb260761
- **Severity**: MEDIUM
- **Category**: Missed opportunity / Feedback
- **Estimated scope**: 1 file (`index.html`), ~12 lines of CSS in the `<style>` block. No JS changes.

## Problem

All three waitlist forms disable their submit button and swap its label while the POST to
`/api/waitlist` is in flight. Current code, verbatim:

```js
/* index.html:620-622 — current */
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        button.textContent = busy;
```

`busy` is `'Registering…'` for the GP form and `'Joining…'` for the two patient forms
(`index.html:599`).

The only visual response is a background colour change from the `:disabled` rule:

```css
/* index.html:172 — current */
    .btn:disabled { background: var(--ink-2); cursor: wait; }
```

```css
/* index.html:175 — current */
    .field .btn:disabled { background: var(--ink-2-dark); color: var(--black); }
```

After that transition finishes at 160ms, the button is **completely static** for however long the
network takes. On a slow or flaky connection the page gives no indication the request is still
alive — the same frozen grey button means "working" and "hung", and the user's only recourse is to
guess. This is the single conversion moment on a page whose entire job is conversion.

Nothing here is broken; it is a gap. The fix is additive.

## Target

An indeterminate 2px bar that sweeps across the bottom edge of the button, **delayed by 350ms** so a
fast response never flashes it.

```css
/* target — new rules, placed after index.html:175 */
    .btn[aria-busy="true"] { position: relative; overflow: hidden; }
    .btn[aria-busy="true"]::after {
      content: ""; position: absolute; inset-inline: 0; bottom: 0; height: 2px;
      background: var(--white); transform: translateX(-100%);
      animation: pending 1.1s var(--ease) .35s infinite;
    }
    .field .btn[aria-busy="true"]::after { background: var(--black); }
    @keyframes pending { to { transform: translateX(100%); } }
```

Plus an explicit reduced-motion branch, described below.

Why each piece:

- **Keyed to `[aria-busy="true"]`, not `:disabled`.** The JS already sets and removes `aria-busy`
  in exactly the right places (`index.html:621`, `633`, `649`), so no JavaScript change is needed.
  It also means the indicator is bound to the semantic "busy" state rather than to disabledness.
- **The 350ms `animation-delay`** is the most important value in this plan. A local or cached
  response returns in well under 100ms; an indicator that appears and vanishes inside 150ms reads as
  a glitch and is worse than no indicator. The bar only becomes visible once the wait is long enough
  to be worth acknowledging. Because `transform: translateX(-100%)` is set in the base rule and the
  animation has no `both`/`backwards` fill, the bar sits off-screen to the left for the whole delay
  and is genuinely invisible until it starts.
- **`transform` only**, so the animation runs on the compositor and cannot cause layout.
- **1.1s per sweep** is deliberately slower than any UI budget in this repo, because this is a
  looping progress indicator, not a UI transition. UI duration budgets govern one-shot state
  changes; a loop's job is to read as steady and calm. A fast sweep would read as frantic.
- **Two colours.** On the light sections the disabled button is `--ink-2` (#767676) with white text,
  so a white bar. In the GP field the disabled button is `--ink-2-dark` (#A3A3A3) with black text
  (`index.html:175`), so a black bar. This mirrors how every other component on this page inverts.
- **`overflow: hidden` scoped to the busy state only** so the bar is clipped to the button's 8px
  `--r-control` radius, and the resting button is left untouched.

### Reduced motion — required, do not skip

The page has a blanket rule that crushes every animation:

```css
/* index.html:57-60 — current */
    @media (prefers-reduced-motion: reduce) {
      html { scroll-behavior: auto; }
      *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
    }
```

For a one-shot transition that is correct. For an **infinite** animation it is not: the sweep
completes in .01ms and loops, leaving what looks like a static 2px bar frozen at one edge of the
button forever. That is a visual artefact with no meaning — strictly worse than showing nothing.

So this plan must add its own override:

```css
/* target — new rule */
    @media (prefers-reduced-motion: reduce) {
      .btn[aria-busy="true"]::after { display: none; }
    }
```

`display` is not touched by the blanket rule, so this wins. A reduced-motion user still gets the
"Joining…" label, the colour change, `cursor: wait` and the `aria-busy` announcement — the
information is intact, only the movement is dropped.

### What is deliberately NOT changed

The label swap itself (`Join the waitlist` → `Joining…`) is left as a hard cut. Both labels fit
inside `.row .btn { min-width: 172px }` (`index.html:192`), so the button does not resize and there
is no jolt to bridge. Crossfading the text would add a second grammar for the same event.

## Repo conventions to follow

- **Single file, no build step.** All CSS lives in the `<style>` block in the `<head>` of
  `index.html`. Do not create a stylesheet or add dependencies.
- Easing tokens are at `index.html:51-52`. Use `var(--ease)` for this animation — it is the token
  this page uses for interactive state changes (buttons, inputs, nav), whereas `--ease-out` is
  reserved for content arrivals. See `index.html:168` for the button's own use of `var(--ease)`.
- Durations use the short form (`.35s`, `1.1s`), not milliseconds.
- Colour rule, non-negotiable and stated in `CLAUDE.md`: **only** `--black` `#000000`, `--white`
  `#FFFFFF`, `--blue` `#1447E6` (`--blue-lift` `#6E9BFF` on black grounds) and neutral greys. The bar
  must use `var(--white)` / `var(--black)`. Do not introduce a new colour for it.
- **Exemplar to imitate** — `index.html:141-149`, the illustration idle, which is the file's other
  infinite animation and shows the house style for one: a `@keyframes` block defined immediately
  after the rules that use it, transform-only, and explicitly guarded for motion preference.
- CSS comments in this file are prose sentences explaining *why*. See `index.html:233-234`. Add one
  in that register above the new rules.

## Steps

1. In `index.html`, locate line 175, the last rule in the button group:

   ```css
       .field .btn:disabled { background: var(--ink-2-dark); color: var(--black); }
   ```

2. Immediately after that line, insert:

   ```css
       /* A disabled grey button is the same picture whether the request is in flight or
          the connection has died. The bar is the difference. It waits .35s before showing,
          so a fast reply never flashes it — an indicator that comes and goes inside a
          blink reads as a glitch, not as progress. */
       .btn[aria-busy="true"] { position: relative; overflow: hidden; }
       .btn[aria-busy="true"]::after {
         content: ""; position: absolute; inset-inline: 0; bottom: 0; height: 2px;
         background: var(--white); transform: translateX(-100%);
         animation: pending 1.1s var(--ease) .35s infinite;
       }
       .field .btn[aria-busy="true"]::after { background: var(--black); }
       @keyframes pending { to { transform: translateX(100%); } }

       /* The blanket reduced-motion rule sets animation-duration to .01ms, which would
          leave this loop as a static bar parked at one edge. Drop the element instead:
          the label, the colour and aria-busy already carry the state. */
       @media (prefers-reduced-motion: reduce) {
         .btn[aria-busy="true"]::after { display: none; }
       }
   ```

   Match the surrounding indentation (4 spaces for a selector at this level).

3. Make **no changes to any JavaScript**. The `aria-busy` attribute is already set and cleared
   correctly at `index.html:621`, `index.html:633` and `index.html:649`.

## Boundaries

- Do NOT modify the `<script>` block. This plan is CSS-only. If you believe a JS change is needed,
  STOP and report — it is not.
- Do NOT change the button labels, the `busy` strings at `index.html:599`, or the `.btn:disabled`
  background colours at `index.html:172` and `index.html:175`.
- Do NOT add a spinner, a skeleton, or any SVG. The page rule in `CLAUDE.md` is that icons are
  authored SVG and every element must earn its place; a 2px edge bar is the minimum that does the
  job.
- Do NOT apply the indicator to `.btn` generally. The nav CTA at `index.html:391` is an `<a
  class="btn">` and never receives `aria-busy`; the attribute selector already scopes this
  correctly, so do not broaden it to `:disabled` or to `.btn`.
- Do NOT add dependencies, build steps, or new files.
- If the code at line 175 does not match the excerpt above, STOP and report the difference.

## Verification

- **Mechanical**: no build or lint exists in this project. Serve with `python3 -m http.server 8000`
  and confirm zero CSS errors in the browser console.

- **Feel check**: this needs a throttled network, because the whole point is behaviour under
  latency. In DevTools → Network, set throttling to "Slow 4G", then:
  - Submit the hero form with a valid address. Confirm a thin bar sweeps left-to-right along the
    bottom edge of the button, repeatedly, until the response lands.
  - Confirm the bar is clipped to the button's rounded corners and never escapes its box.
  - Set throttling back to "No throttling" and submit again on a fast/local response. Confirm the
    bar **never appears at all** — this verifies the .35s delay. If you see a flash, the delay was
    dropped or `both`/`backwards` was added to the animation shorthand.
  - Submit the **GP form** in the black "Are you a GP?" section. Confirm the bar is black against
    the light grey disabled button and is clearly visible. If it is white there, the
    `.field .btn[aria-busy="true"]::after` override was missed.
  - Trigger the error path (throttle to "Offline" and submit). Confirm that when the button is
    re-enabled the bar disappears completely — `aria-busy` is removed at `index.html:649`, so this
    should be automatic. A bar left running on an enabled button is a failure.
  - In DevTools → Animations, set playback to 10% and confirm the bar travels fully off the left
    edge before reappearing, with no visible jump at the loop boundary.
  - In DevTools → Rendering → "Emulate CSS prefers-reduced-motion: reduce", submit again on a
    throttled connection. Confirm **no bar is visible at all** — not a frozen one. A static 2px
    stripe sitting on the button is the specific failure this branch exists to prevent.
  - In DevTools → Performance, record a submit on a throttled connection and confirm the sweep
    produces no layout or paint entries, only compositing.

- **Done when**: the bar appears only on waits longer than ~350ms, sweeps smoothly in both colour
  contexts, vanishes when the request settles either way, is absent under reduced motion, and no
  JavaScript was modified.

---

## Applied — 2026-08-28

Inserted verbatim after `.field .btn:disabled`. No JavaScript was modified.

**Verified by rendering** (headless Chrome, page served over HTTP, all three forms forced into
`aria-busy="true"`, the sweep frozen at chosen phases with a negative `animation-delay` so position
could be measured rather than guessed):

- The bar is exactly 2px tall and sits on the button's last two pixel rows, in all three forms.
- It travels left→right: at successive phases the painted width inside the hero button fell
  monotonically as the bar exited to the right, and nothing was ever painted above the bottom 2px.
- Clipped to the 8px radius — the rounded corners cut the bar in both the desktop and the 390px
  full-width stacked layout.
- Colour inverts correctly: white on the light sections (hero and closing capture, 44–45px painted
  at the sampled phase), black in the GP field (45px painted at the same phase).
- Under `prefers-reduced-motion: reduce` the painted count on every button drops to the 6–8px
  corner-antialiasing baseline — the bar is **absent**, not frozen. This is the specific failure the
  `display: none` branch exists to prevent, and it is confirmed gone.
- No CSS parse errors or console output on the real page.
- The resting page is untouched by construction: every new selector requires `[aria-busy="true"]`,
  which the nav CTA (`<a class="btn">`) never receives.

**Still outstanding** — two checks that need a running backend rather than a static server:

1. A real submit on a throttled connection, to confirm the .35s delay means a fast response never
   flashes the bar. The delay is correct by construction (the base rule parks the bar at
   `translateX(-100%)` and the shorthand has no `both`/`backwards` fill, so it is genuinely
   invisible for the whole delay), but this was not exercised against a live response.
2. A DevTools Performance trace confirming compositing only. The animation is transform-only, so
   this holds by construction, but no trace was captured.
