# Prompt: shadcn/ui as the shared component layer for landing page and dashboards

Copy everything below the line into a fresh session in `website/`. Run it **before** the migration's milestone 2 (patient surface) starts, so the dashboards are built on this layer rather than retrofitted to it. Run `plans/004-visual-interest-prompt.md` either before or after; the two do not overlap.

---

Introduce shadcn/ui as the single component layer for the Dr Quick web app (`website/`, Next.js 16 App Router, Tailwind 4 with a reduced `@theme`, TypeScript strict, Vitest). The goal is one design language across the marketing landing page (`app/page.tsx`, live today) and the three role dashboards (patient, doctor, admin — currently a vanilla-JS prototype in `preview/`, to be ported in milestones 2–4 of `docs/superpowers/specs/2026-08-28-react-migration-design.md`). After this task, every button, field, card, tab, table, dialog and badge on either surface is the same component reading the same tokens.

Read first, in this order: `CLAUDE.md` (design rules are non-negotiable), `DESIGN.md` (token source of truth), `app/globals.css` (the current `@theme` and authored layer), `tests/constraints.test.ts` (what the suite refuses), the migration spec above, and `preview/css/components.css` + `preview/css/dashboard.css` (what the dashboards will need).

## Scope

**In:** install and configure shadcn/ui; map its semantic tokens onto the existing palette; install the component set below; restyle each component to `DESIGN.md`; migrate the landing page's existing primitives onto the new components at pixel parity; add a development-only component gallery route; update the docs and the constraints test.

**Out:** building the dashboards. Do not port anything from `preview/`. Do not add authentication, data, or new pages beyond the gallery. Do not change copy, section order, compliance wording, the API routes, or the forms' behaviour.

## Decisions already made — do not relitigate

1. **The palette is the sixteen `@theme` colours in `app/globals.css`, full stop.** `tests/constraints.test.ts` scans `app/`, `components/` and `lib/` (`.ts .tsx .css .js`) for any hex outside that set. shadcn's `init` writes an `oklch()` palette and a `.dark` block into `globals.css`; delete both entirely. Every shadcn semantic variable is an alias of an existing token, declared in `@theme inline` so the utilities (`bg-background`, `text-muted-foreground`, `border-input`, `ring-ring` …) resolve. Use this mapping and record it in `DESIGN.md`:

   | shadcn token | Dr Quick token | Note |
   |---|---|---|
   | `background` | `surface` `#F7F9FB` | page ground |
   | `foreground` | `ink` `#0F172A` | |
   | `card` / `popover` | `white` | |
   | `card-foreground` / `popover-foreground` | `ink` | |
   | `primary` / `primary-foreground` | `primary` `#0047FF` / `white` | |
   | `secondary` / `secondary-foreground` | `fill` `#E6E8EA` / `ink` | DESIGN.md: secondary buttons are a light slate fill, never an outline |
   | `muted` / `muted-foreground` | `surface-mid` `#ECEEF0` / `ink-2` `#434657` | |
   | `accent` / `accent-foreground` | `surface-mid` / `ink` | hover on the ground |
   | `destructive` | `error` `#EF4444` | status only — never decoration, never a button fill on the landing page |
   | `border` | `rule` `#E2E8F0` | hairlines |
   | `input` | `fill` `#E6E8EA` | fields are a filled well, no border |
   | `ring` | `primary` | focus ring, paired with the existing 4px glow |
   | `success` (add) | `success` `#10B981` | shadcn has no success token; add one for status chips |
   | `band` / `band-foreground` / `band-muted` (add) | `band` `#0F172A` / `white` / `band-ink-2` `#94A3B8` | the dark-fill surface. This is a surface, not a theme: **no `.dark` class, no `dark:` variants anywhere** |

   Then extend the constraints test so it also fails on `oklch(`, `hsl(`, `lab(` or `lch(` anywhere in scanned CSS, and on any `dark:` variant in a className. That closes the door shadcn's generator opens.

2. **Radii.** `globals.css` resets `--radius-*` and defines `sm 4 / control 8 / md 12 / tile 16 / xl 24 / pill`. shadcn components use `rounded-md / lg / xl / 2xl`. Add aliases so those names resolve to DESIGN.md's scale — `md → 8px` (controls), `lg → 12px`, `xl → 16px` (cards), `2xl → 24px` — and audit the two existing uses of `rounded-md` on the landing page, which currently mean 12px, before the alias silently changes them. Do not set shadcn's `--radius` calc chain; map the names directly.

3. **Breakpoints.** `globals.css` deletes Tailwind's defaults and keeps exactly three lines (560 / 900 / 1080) as `max-phone: / max-cols: / max-forms:`. shadcn components ship with `sm:` and `md:` variants that would silently do nothing. Register `sm: 560px`, `md: 900px`, `lg: 1080px` as min-width names for the same three lines. Still three breakpoints, two spellings; `CLAUDE.md` gets one sentence saying so. Do not restore `xl` / `2xl`.

4. **Fonts.** `--font-sans` (Inter) and `--font-display` (Geist) exist. shadcn only knows `font-sans`. `CardTitle`, `DialogTitle`, `SheetTitle`, `AlertTitle` and `TabsTrigger` take `font-display`; everything read stays Inter. Weights per `CLAUDE.md`: Geist 600/700, Inter 400/600/700.

5. **Elevation.** Cards are borderless and carry `shadow-card` (tier 2). Popovers, dialogs, sheets, dropdowns, tooltips, toasts carry `shadow-pop` (tier 3). Nothing else casts a shadow. Strip the default `border` from `Card`; strip the default ring/outline styling from `Button` and `Input` and apply the existing focus grammar (`:focus-visible` 3px outline for buttons and links; the 2px transparent border → primary border + `shadow-glow-primary` for fields, `aria-invalid` → error border + `shadow-glow-error`). No `backdrop-blur`, no coloured shadows.

6. **Motion.** shadcn pulls in `tw-animate-css` for overlay enter/exit. Keep it for functional overlays only (dialog, sheet, popover, dropdown, tooltip, toast), retimed to the existing tokens (`--ease`, `--ease-out`, 160–280ms). The blanket `prefers-reduced-motion` rule in `globals.css` already zeroes durations; confirm it reaches the new classes. No animation on cards, buttons, badges or tabs beyond the colour transitions the landing page already has. The landing page's reveal grammar (`data-reveal`, `[data-stagger]`, masked headline lines) and the illustration idle are untouched.

7. **Icons.** Landing page icons stay the authored sprite in `components/IconDefs.tsx`. `lucide-react` is permitted **for the dashboards only** (they need dozens of icons; hand-authoring them is not a good use of anyone's time), at `strokeWidth={2}` and 20px to match the existing `#i-yes` / `#i-no` marks. No emoji, no icon fonts. Record this exception in `CLAUDE.md`.

8. **What is not ported to Radix.** Two landing-page components stay as they are because their no-JS behaviour is a rule, not an accident:
   - The FAQ uses native `<details>` with a `::details-content` transition so answers exist in the DOM for crawlers and render open-able without JavaScript. Radix `Accordion` unmounts or hides collapsed content. Do not swap it. If the dashboards need an accordion, install shadcn's `Accordion` for them and leave `Faq.tsx` alone.
   - The Patients / GPs segmented control is two real `<a href>` links with `aria-current`, resolved before paint by the inline head script. Do not turn it into `Tabs` or `ToggleGroup`. Build `components/ui/segmented-link.tsx` in the shadcn idiom (cva variants, `cn()`, forwardRef) that renders anchors, and use it for the nav switch and for any link-based role switch in the dashboards.

9. **Dependencies are kept to what shadcn actually needs.** `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`, the Radix packages for installed components, `lucide-react`, and `sonner` for toasts. No `react-hook-form` / `zod` (the only form on the site is one email field, and the dashboards are fixture-driven — do not install the `Form` component). No Recharts / shadcn `Chart`: `preview/js/charts.js` already has bar and line geometry that the migration spec says ports unchanged; the dashboards will render it as inline SVG with `stroke-primary` and `stroke-secondary`-class tokens at 2px, per `DESIGN.md`.

## Component set

Install via `npx shadcn@latest add …` into `components/ui/`, then restyle each. Do not install anything not listed; add later when a dashboard screen needs it.

**Used by the landing page today:** `button`, `input`, `card`.

**Needed by the dashboards (from `preview/css`):** `badge` (`.tag`, `.pill`, status chips: 15% semantic-colour fill + 700-weight text in the same colour, per `DESIGN.md`), `tabs` (`.tabs`), `table` (`.table`, with the `.table-scroll` wrapper for overflow), `dialog` and `sheet` (`.gate`, the blocking gates; sheet is the mobile drawer nav `DESIGN.md` specifies), `alert` (`.alert`), `sonner` (`.toast`), `progress` (`.meter`), `switch` (`.toggle`), `select`, `separator`, `avatar` (`.avatar`), `tooltip`, `skeleton` (the blank-by-default data mode renders an em dash, not a skeleton — use skeleton only for genuine loading), `sidebar` (`.shell`, `.rail`, `.topnav` — the app shell; keep `SidebarProvider` inside each surface's layout, not the root layout, so the landing page never loads it), `breadcrumb`, `dropdown-menu`, `radio-group` (`.choice`, the safety-check questionnaire, which must read as a checklist and never show a score), `textarea`, `label`.

For each component: remove default borders/rings that contradict `DESIGN.md`, apply the token mapping, check that every colour reference is a semantic class (never a hex, never `bg-[rgb(…)]`), and leave shadcn's structure, a11y wiring and `data-slot` attributes intact so future `shadcn diff` upgrades stay tractable.

## Landing page migration (parity, not redesign)

- `.btn` → `Button` (`variant="default"`, `size="lg"`: 16px×24px padding, 8px radius, `shadow-btn-glow` inner highlight, `primary-strong` on hover, `translateY(1px)` on active, `outline` disabled grey with `cursor: wait`). The `aria-busy` pending bar — the 2px sweep that waits 350ms before showing, hidden under reduced motion — is behaviour the `WaitlistForm` tests depend on. Port it into the Button as an `aria-busy` style, not as a separate class, and keep the `.btn` class on the element so existing tests and the `.row .btn` sizing rule still match until they are migrated. Add `variant="secondary"` (light slate fill, `ink` text) for the dashboards; there is no outline variant.
- `input[type="email"]` → `Input` with the filled-well grammar: `fill` background, 2px transparent border, `fill-hover` on hover, white + primary border + glow on focus, error border + error glow when `aria-invalid`. The border stays 2px at rest so going invalid never reflows the caret (see the comment in `globals.css`; `plans/003-invalid-field-no-reflow.md` records why).
- Bento tiles in `Steps.tsx` → `Card` (`rounded-xl`, `shadow-card`, white). The third tile gets a `variant="band"` (dark fill, `band-foreground`, `band-muted` secondary text). Tiles must still vary in span, fill and layout — three identical cards is a failure by `CLAUDE.md`.
- Nav CTA → `Button`; nav switch → `SegmentedLink`.
- Do not touch `Faq.tsx`, `Covers.tsx`, `PriceBand.tsx`, `UrgentBand.tsx`, `Footer.tsx`, `Hero.tsx` skeleton, the reveal hook, or the illustrations.
- After migration, delete only the authored CSS the components now own (`.btn`, the email input rules, `.seg`). Everything else in `@layer components` stays — it is the stateful half the utilities cannot express.

## Gallery route

Add `app/dev/ui/page.tsx`: every installed component in every variant and state (rest, hover, focus-visible, disabled, `aria-busy`, `aria-invalid`, on white, on ground, on band), on one scrollable page, `export const dynamic = 'force-static'`, `notFound()` when `process.env.NODE_ENV === 'production'`, and `noindex` via the existing header rules in `next.config.ts` (check `tests/headers.test.ts`). This is the screenshot target for parity checks and for future dashboard work; it never ships.

## Docs to update (do this — the docs are read by every later session)

- `CLAUDE.md` → new section **Component layer**: `components/ui/` is shadcn, restyled; the token mapping lives in `DESIGN.md`; the three-breakpoint rule with both spellings; the lucide exception; the two components that must never be ported to Radix; "add components via the CLI, then restyle — never hand-write a primitive that shadcn already provides, and never install one no screen needs yet."
- `DESIGN.md` → append a **shadcn token mapping** section containing the table above and the radius aliases. The front matter stays untouched (it is user-supplied and authoritative).
- `docs/superpowers/specs/2026-08-28-react-migration-design.md` → a dated addendum stating that milestones 2–4 build every screen from `components/ui/` and the gallery route is the visual reference.
- `tests/constraints.test.ts` → the colour-function and `dark:` guards from decision 1.

## Verify before you report

1. `npm test`, `npm run typecheck`, `NEXT_PUBLIC_SITE_URL=http://localhost:3000 npm run build` all pass. A failing palette test means a colour leaked — fix the colour, never the test's allow-list.
2. Screenshot `/` and `/?role=gp` at 1440px and 390px, full page, and diff them against screenshots taken **before** you started (take those first). The landing page should be visually indistinguishable; list every pixel-level difference you can find and justify each or fix it.
3. Screenshot `/dev/ui` at 1440px and 390px and look at it: every component on ground, on white and on band; no borders on cards; no outline buttons; fields with no border at rest; focus ring visible on every interactive element by keyboard.
4. Disable JavaScript and load `/`: both modes render stacked, the FAQ opens, the role switch links navigate, the forms submit. This is the no-JS rule from `CLAUDE.md` and Radix must not have broken it.
5. `grep -rn "dark:" app components` and `grep -rn "oklch\|hsl(" app components lib` both return nothing.
6. Report: dependency list added with versions, the components installed, what was deleted from the authored CSS layer, every parity difference found in step 2, the exact wording added to `CLAUDE.md`, and any place where a `DESIGN.md` rule and a shadcn default conflicted that is **not** resolved by the decisions above — do not resolve those silently; list them for a human.
