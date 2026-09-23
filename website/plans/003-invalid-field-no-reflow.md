# 003 — Stop the email field jumping 1px when it goes invalid

- **Status**: DONE
- **Commit**: 3bb260761
- **Severity**: LOW
- **Category**: Physicality / Cohesion
- **Estimated scope**: 1 file (`index.html`), 4 CSS declarations changed

## Problem

When a submitted email fails validation, the JS sets `aria-invalid="true"` on the input
(`index.html:615`). Current styles, verbatim:

```css
/* index.html:193-207 — current */
    input[type="email"] {
      flex: 1; min-width: 0; font: inherit; font-size: 1rem; font-weight: 500;
      padding: 16px 20px; border: 1px solid transparent; border-radius: var(--r-control);
      background: var(--fill); color: var(--black); outline: none;
      transition: background .16s var(--ease), border-color .16s var(--ease);
    }
    input[type="email"]::placeholder { color: #666666; }
    input[type="email"]:hover { background: var(--fill-2); }
    input[type="email"]:focus { background: var(--white); border-color: var(--black); }
    input[type="email"][aria-invalid="true"] { border-width: 2px; border-color: var(--black); background: var(--white); }
    .field input[type="email"] { background: #1A1A1A; color: var(--white); }
    .field input[type="email"]::placeholder { color: var(--ink-2-dark); }
    .field input[type="email"]:hover { background: #242424; }
    .field input[type="email"]:focus { background: #1A1A1A; border-color: var(--white); }
    .field input[type="email"][aria-invalid="true"] { border-width: 2px; border-color: var(--white); }
```

The invalid state changes `border-width` from `1px` to `2px`. `border-width` is **not** in the
`transition` list, and could not usefully be — transitioning it would animate a reflow. So:

1. The border thickens in a single frame while the error message below it arrives over 420ms with
   the `settle` animation (`index.html:231`). One event, two grammars.
2. Because `box-sizing: border-box` applies globally (`index.html:55`), the extra 1px of border eats
   into the content box. The typed text and the caret shift 1px left and 1px down at the exact
   moment the user is looking at the field to find out what they got wrong.

A second, quieter problem: invalid and focus both resolve to a black border on the light sections
(`border-color: var(--black)` in both rules), differing only in width. Since
`input[type="email"] { outline: none }` beats the generic `:focus-visible` rule at `index.html:101`
on specificity, that border **is** the field's only focus indicator — so the two states are
distinguished by one pixel of border width and nothing else.

## Target

Do not transition the width — remove the width change. Hold the border at a constant `2px`, keep it
transparent at rest, and let only `border-color` change. Compensate the padding so the resting
appearance is pixel-identical to today, and distinguish invalid from focus by **colour** instead of
by weight.

```css
/* target — index.html:195 (the base rule's second line) */
      padding: 15px 19px; border: 2px solid transparent; border-radius: var(--r-control);
```

```css
/* target — replaces index.html:202 */
    input[type="email"][aria-invalid="true"] { border-color: var(--blue); background: var(--white); }
```

```css
/* target — replaces index.html:207 */
    .field input[type="email"][aria-invalid="true"] { border-color: var(--blue-lift); }
```

The `:focus` rules at lines 201 and 206 are **not edited** — they keep `border-color: var(--black)`
and `var(--white)` respectively.

Why each piece:

- **`padding: 15px 19px` with `border: 2px`** gives a 17px vertical and 21px horizontal inset,
  exactly matching today's resting `1px + 16px` and `1px + 20px`. The field's outer size, inner text
  position and total height are all unchanged at rest. Verify this by eye against a before
  screenshot; it should be indistinguishable.
- **The existing `transition: border-color .16s var(--ease)` now actually does something.** It is
  already in the file and needs no edit — today it never fires on the invalid state because the
  visible change is the width, not the colour. After this change the border fades from transparent
  to blue over 160ms and nothing reflows.
- **Blue for invalid** is not a new colour: the error icon beside the message is already
  `var(--blue)` (`index.html:230`) and `var(--blue-lift)` in the GP field (`index.html:219`). The
  field border now matches the icon that explains it. Focus stays black/white, so the two states
  are no longer told apart by a single pixel.

This is the least purely-additive of the three plans: it changes the resting border box and the
invalid colour, not just timing. That is intentional — the reflow cannot be fixed by adding motion,
only by removing the cause.

### A deliberate side effect

Focus rings on these inputs become 2px instead of 1px, on both light and dark grounds. This is
intended. The border is the only focus indicator these inputs have, and 1px is thin for that job;
2px is a small accessibility improvement. Do not try to preserve the 1px focus ring — doing so
reintroduces the width change this plan exists to remove.

### Reduced motion

No new code. The 160ms colour fade is covered by the blanket rule at `index.html:57-60`, and a
snap-to-blue is the correct reduced-motion behaviour.

## Repo conventions to follow

- **Single file, no build step.** All CSS lives in the `<style>` block in `index.html`. No
  stylesheet, no dependencies.
- Colour rule from `CLAUDE.md`, non-negotiable: exactly three colours — `--black` `#000000`,
  `--white` `#FFFFFF`, `--blue` `#1447E6` — plus neutral greys. **On black grounds, blue is
  `--blue-lift` `#6E9BFF`.** That is why the `.field` variant uses a different token; it is not an
  inconsistency. Never introduce a red for the error state, however conventional that would be
  elsewhere.
- Tokens are at `index.html:36-46`. Reference them as `var(--blue)` / `var(--blue-lift)`; never
  paste a hex value into a rule.
- **Exemplar to imitate** — `index.html:219` and `index.html:230`, which is where the error icon
  already picks its colour per ground:

  ```css
  .status.err .i-err { color: var(--blue); }
  .field .status.err .i-err { color: var(--blue-lift); }
  ```

  Your two invalid rules follow exactly that pairing.
- CSS comments in this file are prose sentences explaining *why*. See `index.html:223-224`.

## Steps

1. In `index.html`, in the `input[type="email"]` base rule, change line 195 from:

   ```css
         padding: 16px 20px; border: 1px solid transparent; border-radius: var(--r-control);
   ```

   to:

   ```css
         padding: 15px 19px; border: 2px solid transparent; border-radius: var(--r-control);
   ```

2. Replace line 202:

   ```css
       input[type="email"][aria-invalid="true"] { border-width: 2px; border-color: var(--black); background: var(--white); }
   ```

   with:

   ```css
       /* The border is held at 2px transparent at rest so going invalid changes only a
          colour. Changing the width instead would shift the caret and the typed text by a
          pixel, at the one moment the reader is staring at the field. Blue, not a heavier
          black, so this reads as the same error the icon below is already reporting — and
          so focus and invalid stay tellable apart. */
       input[type="email"][aria-invalid="true"] { border-color: var(--blue); background: var(--white); }
   ```

3. Replace line 207:

   ```css
       .field input[type="email"][aria-invalid="true"] { border-width: 2px; border-color: var(--white); }
   ```

   with:

   ```css
       .field input[type="email"][aria-invalid="true"] { border-color: var(--blue-lift); }
   ```

4. Confirm no `border-width` declaration remains anywhere in the `input[type="email"]` rules. Search
   the file for `border-width` — there should be zero matches.

## Boundaries

- Do NOT edit the `:focus` rules at `index.html:201` and `index.html:206`. They stay black and white
  respectively; that is what keeps focus distinguishable from invalid.
- Do NOT edit the `:hover` rules at `index.html:200` and `index.html:205`.
- Do NOT add `border-width` to the `transition` property list. Transitioning it animates a reflow,
  which is the failure mode this plan removes.
- Do NOT introduce red, or any colour outside the three-colour palette, for the error state.
- Do NOT modify the `<script>` block. The `aria-invalid` attribute is already set and removed
  correctly at `index.html:610`, `615`, `630` and `647`.
- Do NOT add a shake, pulse, or attention keyframe to the invalid field. The 160ms colour fade plus
  the existing `settle` animation on the message is the complete intended response.
- Do NOT add dependencies, build steps, or new files.
- If the code at lines 195, 202 or 207 does not match the excerpts above, STOP and report.

## Verification

- **Mechanical**: no build or lint exists. Serve with `python3 -m http.server 8000` and confirm zero
  CSS errors in the console. Confirm `border-width` appears zero times in the file.

- **Feel check**: the critical check is a *before/after comparison of the resting state*, because
  this plan claims to change nothing at rest.
  - Before editing, screenshot the hero form at 1440px wide. After editing, screenshot it again and
    compare. The field's height, width, corner radius, and the position of the placeholder text must
    be **identical**. If the field grew, shrank, or the placeholder moved, the padding compensation
    in step 1 is wrong.
  - Type `not-an-email` into the hero form and press Join. Confirm the border fades to blue over
    ~160ms and the placeholder/typed text does **not** shift. Watch the first character of the text
    specifically — that is where a 1px jump is visible.
  - Click into the field. Confirm focus is a **black** 2px border, clearly different from the blue
    invalid border. Then submit invalid again while still focused and confirm the border goes blue.
  - Do the same in the black "Are you a GP?" section: focus should be a white border, invalid should
    be light blue (`#6E9BFF`), and both must be legible against `#1A1A1A`.
  - Confirm the blue invalid border matches the blue of the error icon that appears below it.
  - In DevTools → Animations at 10% playback, trigger the invalid state and confirm the border fades
    rather than snapping.
  - Screenshot at 390px wide as well and confirm the stacked mobile layout is unchanged — per
    `CLAUDE.md` this project requires both a 1440px and a 390px render check before delivery, footer
    included.

- **Done when**: the resting field is pixel-identical to before, the invalid state fades in blue
  with no text shift, focus and invalid are visually distinct on both light and dark grounds, and no
  `border-width` declaration remains.
