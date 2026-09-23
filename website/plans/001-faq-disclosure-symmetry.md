# 001 — Make the FAQ disclosure open and close with one symmetric transition

- **Status**: DONE (applied 2026-08-28; mechanical checks pass, animation feel-check still outstanding — see note at end)
- **Commit**: 3bb260761
- **Severity**: MEDIUM
- **Category**: Physicality & origin / Cohesion
- **Estimated scope**: 1 file (`index.html`), ~10 lines of CSS in the `<style>` block

## Problem

The FAQ `<details>` elements in `index.html` fade their paragraph in when opened, but the
element's *box* still snaps to full height instantly, so every FAQ row below it jumps. Closing
has no transition at all — the panel vanishes in a single frame.

Current code, verbatim:

```css
/* index.html:298-299 — current */
    .faq details[open] p { animation: disclose .28s cubic-bezier(.16,1,.3,1) both; }
    @keyframes disclose { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: none; } }
```

Two problems:

1. The animation is on the `<p>`, not on the disclosure box. The `<p>` fades and slides, but the
   height change that pushes the rest of the list down is instant and unanimated. The fade was
   presumably meant to soften that jump; it does not, because they are different elements.
2. It is one-directional. `animation` on `[open]` runs on open and cannot run on close, because
   native `<details>` removes the content from the box the moment `open` is unset. Content arrives
   with a considered 280ms curve and leaves with none.

This matters because the FAQ is the one place on this page where the reader repeatedly changes
state. Eight rows, opened and closed while comparing answers. The asymmetry is felt every time.

Note: the keyframe hardcodes `cubic-bezier(.16,1,.3,1)`, which is already defined as the
`--ease-out` token at `index.html:52`. The replacement should use the token.

## Target

Move the transition onto the `::details-content` pseudo-element so the actual disclosure box
animates, in both directions, with one declaration.

```css
/* target — replaces index.html:298-299 */
    .faq details::details-content {
      block-size: 0;
      overflow: hidden;
      opacity: 0;
      transition:
        block-size .28s var(--ease-out),
        opacity .2s var(--ease-out),
        content-visibility .28s allow-discrete;
    }
    .faq details[open]::details-content { block-size: auto; opacity: 1; }
```

And, so `block-size: auto` is animatable at all, add `interpolate-size: allow-keywords` to the
existing `:root` block:

```css
/* target — added to the :root block that ends at index.html:53 */
      interpolate-size: allow-keywords;
```

Why each piece:

- `block-size` (not `height`) matches the logical-property direction the transition runs in.
- `interpolate-size: allow-keywords` is what makes `0 → auto` interpolate. Without it the
  transition silently does nothing and you get today's snap.
- `content-visibility ... allow-discrete` keeps the content painted while the box collapses. Without
  it the content is hidden on frame one of the close and you only animate an empty box.
- `overflow: hidden` stops the text spilling out of the shrinking box mid-close.
- Opacity is shorter (200ms) than the size change (280ms) so the text is gone before the box
  finishes closing, rather than fading in lockstep. This is the same relationship the page already
  uses at `index.html:225`, where the capture collapse runs `.26s` on rows and `.16s` on opacity.

`@keyframes disclose` must be **deleted**. If both remain, the keyframe fires on open at the same
time as the transition and the paragraph double-animates.

### Browser support and degradation

`::details-content` is supported in current Chrome, Safari and Firefox. In any browser that does not
support it, the entire `::details-content` rule block is dropped as an unknown selector and the
element behaves exactly as it does today — an instant snap. There is no broken intermediate state,
and no fallback code is needed. `interpolate-size` is likewise ignored where unsupported.

### Reduced motion

No new code needed. The existing blanket rule at `index.html:57-60` crushes
`transition-duration` to `.01ms !important`, which for a disclosure is the correct reduced-motion
behaviour — the panel snaps open, which is what a user who asked for no motion wants. Do not add a
separate reduced-motion block for this plan.

## Repo conventions to follow

- This project is a **single file with no build step**. All CSS lives in the `<style>` block in the
  `<head>` of `index.html`. Do not create a stylesheet, do not add a bundler, do not add npm
  packages. Edit `index.html` in place.
- Easing tokens are defined in the `:root` block at `index.html:51-52`:
  `--ease: cubic-bezier(.22,.61,.36,1)` and `--ease-out: cubic-bezier(.16,1,.3,1)`. Always reference
  them as `var(--ease-out)`. Never paste a raw cubic-bezier into a rule.
- Durations are written in the short form (`.28s`, `.16s`), not `280ms`. Match that.
- **Exemplar to imitate** — `index.html:225`, the capture collapse, which is the same category of
  problem (a box that must change size without the page jolting) solved the same way:

  ```css
  .capture { display: grid; grid-template-rows: 1fr; transition: grid-template-rows .26s cubic-bezier(.4,0,1,1), opacity .16s linear; }
  .capture > div { overflow: hidden; min-height: 0; }
  .done .capture { grid-template-rows: 0fr; opacity: 0; }
  ```

  Note the shape: a size property and an opacity property with different durations, plus
  `overflow: hidden` on the inner box. Your rule follows the same shape.
- The CSS in this file is commented in prose, in sentences, explaining *why* a decision was made —
  see `index.html:223-224` and `index.html:233-234`. Add a comment in that register above the new
  rule. Do not add a bare `/* FAQ */` label.

## Steps

1. In `index.html`, find the `:root` block that ends at line 53 with the `--ease-out` declaration.
   Add `interpolate-size: allow-keywords;` as a new line inside that block, immediately after the
   `--ease-out` line. This is a real property, not a custom property, so it does not take a `--`
   prefix.

2. Find lines 298-299:

   ```css
       .faq details[open] p { animation: disclose .28s cubic-bezier(.16,1,.3,1) both; }
       @keyframes disclose { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: none; } }
   ```

   Delete both lines entirely.

3. In their place, insert:

   ```css
       /* The panel itself animates, not the paragraph inside it: it is the box changing
          size that shunts every question below, so that is what has to be bridged — and
          bridged both ways, since a panel that opens softly and shuts instantly is two
          different components. */
       .faq details::details-content {
         block-size: 0;
         overflow: hidden;
         opacity: 0;
         transition:
           block-size .28s var(--ease-out),
           opacity .2s var(--ease-out),
           content-visibility .28s allow-discrete;
       }
       .faq details[open]::details-content { block-size: auto; opacity: 1; }
   ```

   Match the surrounding indentation, which is 4 spaces for a selector at this level inside the
   `<style>` block.

4. Confirm no other rule in the file references `disclose`. Search the file for the string
   `disclose` — after step 2 there should be zero matches.

## Boundaries

- Do NOT touch `index.html:293-295` (the `summary` hover rules) or `index.html:286-292` (the
  plus/minus `::before` / `::after` marker). The marker's opacity fade on open is correct and
  deliberate.
- Do NOT change the FAQ markup — no wrapper divs, no swapping `<details>` for a JS accordion. The
  native element is a deliberate choice; it works without JavaScript.
- Do NOT touch the `data-reveal` / `data-stagger` attributes on the `<details>` elements
  (`index.html:493-525`). Those drive the page's scroll-reveal system and are a separate mechanism.
- Do NOT add a `prefers-reduced-motion` block for this change (see "Reduced motion" above).
- Do NOT add dependencies, build steps, or new files.
- If the code at lines 298-299 does not match the excerpt above, STOP and report the difference
  rather than guessing at the intent.

## Verification

- **Mechanical**: there is no build, typecheck or lint in this project. Confirm the file still
  parses by serving it and checking for zero CSS errors in the browser console:
  `python3 -m http.server 8000` then open `http://localhost:8000`. Search the file for `disclose`
  and confirm zero matches.

- **Feel check**: open the page, scroll to "Questions people ask", and confirm:
  - Opening a question pushes the questions below it down **smoothly over ~280ms**, not instantly.
    This is the whole point of the plan — if the rows below still jump, `interpolate-size` did not
    apply and step 1 was missed.
  - Closing a question is the mirror of opening: the panel collapses over the same ~280ms and the
    text stays visible while it does, rather than disappearing on frame one.
  - Open a question near the bottom of the list, then open another above it. The list reflows
    smoothly; nothing teleports.
  - Click the same summary rapidly, five or six times. The panel reverses smoothly from wherever it
    currently is. It must never jump to fully-open or fully-closed before reversing — this is the
    advantage of a transition over the keyframe being replaced, and it is the main regression to
    watch for.
  - In DevTools → Animations, set playback speed to 10% and open a question. Confirm the text
    reaches full opacity slightly *before* the box finishes growing (200ms vs 280ms), rather than
    the two finishing together.
  - In DevTools → Rendering → "Emulate CSS prefers-reduced-motion: reduce", open and close a
    question. It should snap instantly in both directions with no partial movement.

- **Done when**: the FAQ list reflows smoothly on both open and close, rapid clicking reverses
  mid-flight without snapping, `@keyframes disclose` no longer exists in the file, and no raw
  cubic-bezier was introduced (the new rule uses `var(--ease-out)`).

---

## Execution note (2026-08-28)

Applied to `index.html`. Both edits landed as specified: `interpolate-size: allow-keywords` in
`:root` (now line 53), the `::details-content` rules (now lines 302-312), and `@keyframes disclose`
removed (`grep -c disclose` → 0). No raw cubic-bezier was introduced; the rule uses
`var(--ease-out)`.

**Verified:** in an isolated harness under Chrome 152, an open `<details>` resolves
`::details-content` to `opacity: 1` and `block-size: 64px` (from `auto`), and a closed one renders
nothing. This confirms the rules do not hide answer text — the main regression risk. The full page
still renders correctly at 1440px with the FAQ rows collapsed and their `+` markers intact.

**NOT verified — needs a human pass in a real browser:**
- Smooth reflow on open *and* close (the point of the plan).
- Mid-flight reversal on rapid clicking.
- The 200ms opacity / 280ms block-size offset at 10% playback.
- Reduced-motion snap.

These need clicking, which `chrome-headless-shell` cannot do; full Chrome is not installed and the
Bash sandbox blocks binding a local HTTP server, so the chrome-devtools MCP route was unavailable.
Run the plan's Verification section manually before considering this closed.
