# Prompt: add visual interest to the Dr Quick landing page

Copy everything below the line into a fresh session in `website/`.

---

Add visual interest to the Dr Quick landing page (`website/`, Next.js 16 + Tailwind 4, `app/page.tsx` + `components/*` + `app/globals.css`) using static surface texture — background grids, dot fields, hairline structure — and nothing that moves, glows or casts a shadow beyond what already exists. Read `CLAUDE.md`, `DESIGN.md` and `tests/constraints.test.ts` before touching anything; the rules below are derived from them and take precedence over your instincts.

## What "visual interest" means here

The page is deliberately quiet: one accent colour, one dark, hairline section breaks, borderless white cards. That is the craft bar (Uber) and it stays. The problem is that the ground is a single flat `#F7F9FB` from top to bottom, so the eye has nothing to hold between sections. The fix is texture on the ground, not decoration on the content.

Add, in this order of priority, and stop when the page has enough — three placements is the expected total, five is the ceiling:

1. **Hero ground: a dot field.** A dot grid on the patient and GP hero backgrounds (both heroes share `components/Hero.tsx`; the symmetry is a rule, so both get the identical treatment). Dots at a 24px or 32px pitch, 1px–1.5px diameter, drawn in ink (`--color-ink`) at 6–9% opacity. The field should read as paper grain from arm's length, not as a pattern you notice first. Fade it out towards the bottom of the hero so it does not hard-stop at the 999 band.
2. **Dark bands: a fine line grid.** The slate-900 bento payoff tile (`Steps.tsx`, third tile) and the GP pay band (`PriceBand.tsx`, `variant="pay"`) get a 1px line grid at a 48px or 64px pitch, in white at 4–6% opacity. This is the "technical / precision" note DESIGN.md's TechMed brief asks for, and dark fills are where a grid reads as intentional rather than as a spreadsheet.
3. **Structural hairlines that already exist, made to work harder.** The `border-rule` hairlines between sections currently sit only on the section edge. Consider letting the hero's dot field and the `.wrap` container align to the same 24px module, so the texture and the layout share a rhythm. Do not add new rules between sections that do not have one.
4. *(Optional, only if 1–3 leave the middle of the page flat)* **Covers section: the does/doesn't ledger.** The row hairlines in `Covers.tsx` could extend into a faint ruled-paper texture behind the two columns. Test it; if it competes with the list rows, remove it.
5. *(Optional)* A single crosshair or corner-tick mark in the primary colour at the top-left of the `.wrap` in the hero — one authored SVG, 12–16px, `--color-primary`. This is the only place the accent may appear as decoration, and only one instance per hero.

## Hard constraints (the test suite and CLAUDE.md enforce most of these)

- **Palette.** `tests/constraints.test.ts` scans app source for any hex outside the sixteen `@theme` colours and for any Tailwind arbitrary value carrying a colour function (`bg-[rgb(...)]` etc). So: no new hexes anywhere, and no colour functions in `className`. Every pattern colour is derived from a token with `color-mix(in srgb, var(--color-ink) 7%, transparent)` or an `rgba()` of an existing palette value, and it lives in `app/globals.css` under `@layer components`, never inline in JSX.
- **"No gradients" is amended, narrowly.** `CLAUDE.md` bans gradients. Interpret that as: no visible colour transitions on any surface, no gradient fills, no gradient text, no glass. `radial-gradient` / `linear-gradient` / `repeating-linear-gradient` are permitted **only** as the drawing primitive for hard-edged dots and 1px lines, and `mask-image` with a linear fade is permitted **only** to feather a pattern's edge (item 1). If a screenshot shows a soft colour wash anywhere, that is a violation. Record this amendment in `CLAUDE.md` under Design rules when you are done, in one sentence, so the next session does not undo it.
- **No new shadows, glows or blur.** The existing tiers (`--shadow-card`, `--shadow-pop`, focus glows, the button inner highlight) are the complete set. Do not add `filter`, `backdrop-filter`, `box-shadow` or `text-shadow` anywhere.
- **No new motion.** Patterns are static. Do not animate, parallax, or scroll-drive them. Do not use `background-attachment: fixed` (it janks on iOS and paints the pattern over the fold). The existing reveal grammar (`data-reveal`, `[data-stagger]`, the hero illustration idle) is untouched.
- **Pure CSS, no assets.** Pseudo-elements (`::before`) on the section, `position: absolute; inset: 0; pointer-events: none; z-index: 0`, with the section `position: relative` and its content `z-index: 1` or `isolation: isolate`. No image files, no extra requests. An inline `data:` SVG in `globals.css` is acceptable if a gradient cannot draw the shape cleanly, but it must use only palette hexes (the test scans CSS too).
- **Sections are separated by hairlines, not background colours.** A pattern may not become a section-tinting device. The ground stays `--color-surface` everywhere; texture sits on it at single-digit opacity.
- **Content never sits on a busy patch.** Body copy, form fields and the email input must stay on plain ground or on a region where the pattern has faded out. If a pattern lands under reading text, lower the opacity or feather it away — do not put a white box behind the text.
- **`prefers-contrast: more`** already swaps hairlines to `#747688`. Under that media query, remove the patterns entirely (`background: none`) — a faint grid becomes a legibility hazard once the user has asked for contrast.
- **Print / reduced data.** Add `@media print { … background: none }` for every pattern.
- **Do not touch** copy, section order, breakpoints (three only: 1080 / 900 / 560), the role switch, forms, or compliance wording. This is a CSS task with at most a `className` or wrapper added in `Hero.tsx`, `Steps.tsx`, `PriceBand.tsx`.
- **KISS.** If you find yourself adding a fourth texture, a second accent mark, a "decorative blob", a numbered-step badge, or an eyebrow label, delete it. Every element must earn its place.

## Implementation notes

- Pitch: choose dot/grid spacing so it divides the 24px `.wrap` gutter and the 4px base scale (24, 32, 48, 64). Position the pattern with `background-position` so a dot or line lands on the container's left edge at 1200px — the texture should look registered to the layout, not thrown behind it.
- Check at DPR 1 and DPR 2. A 1px line grid at 48px is fine at 2×; a 0.5px anything is not. If a dot field moirés against the illustration's own texture in the patient hero, mask it out of the illustration column.
- The GP hero uses an external `<img>` and the patient hero inlines its SVG; the pattern goes on the `<header className="hero">` pseudo-element, so both are covered by one rule.
- The bento payoff tile has `rounded-tile` (16px). The grid pseudo-element must inherit the radius (`border-radius: inherit; overflow: hidden` on the tile, or clip the pseudo-element).
- Opacity targets are starting points. Tune by screenshot, not by number: the correct value is the one where the pattern is visible in a full-page screenshot and invisible while reading a paragraph.

## Verify before you report

1. `npm test` and `npm run typecheck` pass. If the palette test fails, you have used a colour outside the token set — fix the colour, do not edit the test.
2. Screenshot both modes at 1440px and 390px (`/` and `/?role=gp`), full page including footer, per the Verifying changes section of `CLAUDE.md`. Look at each screenshot and state, for each placement, whether it is (a) visible, (b) quieter than the text and cards, (c) not creating a soft colour wash anywhere.
3. Emulate `prefers-contrast: more` and confirm the patterns are gone.
4. Toggle the role switch and confirm both heroes are texturally identical.
5. Report as: what was added and where, the opacity/pitch values landed on, anything from the optional items you tried and removed and why, and the one-line `CLAUDE.md` amendment you wrote.
