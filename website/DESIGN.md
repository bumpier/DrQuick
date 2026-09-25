---
name: Lime & Forest
adopted: 2026-09-25
replaces: TechMed Modern (2026-09-02)
colors:
  surface: '#F5F7F2'
  surface-mid: '#EDF1E8'
  fill: '#E8EDE3'
  fill-hover: '#DFE6D8'
  white: '#FFFFFF'
  ink: '#163300'
  ink-2: '#4D5B45'
  outline: '#6B7A63'
  rule: '#DCE4D4'
  band: '#163300'
  band-ink-2: '#B5C9A5'
  primary: '#9FE870'
  primary-strong: '#8BDB57'
  primary-lift: '#9FE870'
  primary-ink: '#2F6B0F'
  lime-wash: '#E2F6D5'
  sun: '#FFEB69'
  peach: '#FFD7B5'
  success: '#2F6B0F'
  error: '#C8322A'
typography:
  display:
    fontFamily: Plus Jakarta Sans
    fontWeight: '800'
    letterSpacing: -0.035em
  h1:
    fontFamily: Plus Jakarta Sans
    fontSize: clamp(42px, 5.8vw, 76px)
    fontWeight: '800'
    lineHeight: '1.04'
    letterSpacing: -0.035em
  h2:
    fontFamily: Plus Jakarta Sans
    fontSize: clamp(32px, 4.2vw, 52px)
    fontWeight: '800'
    lineHeight: '1.08'
    letterSpacing: -0.03em
  h3:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '700'
    lineHeight: '1.3'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '800'
    lineHeight: '1.2'
    letterSpacing: -0.035em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: clamp(17px, 1.6vw, 21px)
    fontWeight: '400'
    lineHeight: '1.55'
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.5'
rounded:
  sm: 6px
  control: 12px
  lg: 16px
  card: 24px
  tile: 32px
  pill: 9999px
spacing:
  unit: 4px
  gutter: 24px
  tile-gap: 16px
  margin-mobile: 16px
---

## Brand & style

Dr Quick is a private GP service. It should feel **modern, warm and trustworthy, and never clinical or NHS**. The references are Wise and HelloFresh: bold flat colour blocks, friendly rounded type and bento tiles. A patient who feels unwell should meet something calm and confident, not a hospital form.

The system has three moves:

1. **Lime is the action.** Every primary button, every selected state and every "you are here" mark is a lime fill carrying forest text.
2. **Forest is the payoff.** The one dark colour fills the tiles that land the point: step three of how-it-works, the GP pay tile, the footer, the start card and the 999 screen.
3. **Bento tiles carry the page.** Sections are rounded tiles on a plain, faintly green ground. Colour separates things, not hairlines or shadows.

## Colour

- **Lime is a fill, never a line.** `primary` `#9FE870` has 1.4:1 contrast on white, so it never appears as text, a stroke, a ring or a chart mark on a light surface. Anything that must be read or seen as a line on light is **`primary-ink`** `#2F6B0F` (6.5:1 on white). On the forest band, lime (`primary-lift`) is the accent and is fine as text (9.5:1).
- **Forest is the one dark.** `ink` and `band` are the same `#163300`: text on light surfaces, and the dark fill. Never true black.
- **Tile tones.** `lime-wash`, `peach` and `sun` are bento tones with forest text; `ink-2` stays at 4.9:1 or better on every one. `sun` is loud, so use at most one sun tile per section. `surface-mid` is the quiet tile, for the lesser of a pair (for example, "what it doesn't cover").
- **Semantic.** `success` is `primary-ink`. `error` `#C8322A` (5.3:1 on white) is for status icons, the invalid field and the 999 icon only, never decoration.
- **Never NHS.** NHS Blue `#005EB8` and NHS Green `#009639`, and anything near either, are banned. `tests/constraints.test.ts` refuses both.
- No gradients, glass or gradient text. The only textures are the 1px lime line grid on forest fills (`.band-grid`), drawn with `linear-gradient` as a hard-edged line.

## Typography

One face: **Plus Jakarta Sans** (400, 500, 600, 700, 800), self-hosted with `next/font`. Headlines are 800 with tracking at -0.035em, h3 and titles are 700, and body text is 16px at 400. The wordmark is 800. `font-display` and `font-sans` both resolve to Jakarta; `font-display` remains a separate name so headings can be found and restyled together.

## Layout: the bento

- The page is the 1200px `.wrap` on the `surface` ground. Each section is a heading on the ground followed by tiles, or a single wide tile that holds its own heading. Tiles sit 16px apart.
- **Tiles vary.** A row of identical cards is a failure. Vary span, tone and internal layout: a wide lime-wash tile with a large numeral, a narrow white tile, a full-width forest payoff.
- **Heroes** are two cells: a white tile with the headline, sub and capture, beside a `HeroTiles` photo cluster (one tall tile and two short). Both modes use the same shape, which is what makes the equal billing between patients and GPs visible.
- **Photography** is the imagery. Until it arrives, `PhotoTile` holds each slot with a tone, a hard-edged disc and a line glyph. `docs/photo-brief.md` lists the shots and the rules they must keep: no one who could pass for a real Dr Quick GP, no medicine, and no NHS or CQC branding.
- Breakpoints: 560 / 900 / 1080 (see below).

## Elevation

Flat. A white tile on the ground carries `shadow-card`, a 1px forest ring at 6%. Tinted tiles carry nothing, because their colour is their edge. Only floating layers lift: `shadow-pop` on popovers, dialogs, sheets, dropdowns, tooltips and toasts. Fields focus with a forest border and the 4px lime `shadow-glow-primary`.

## Shape

Everything is round. Buttons, switches, tabs and badges are full pills. Fields are 12px. Cards are 24px (`xl`) and bento tiles 32px (`2xl`).

## Components

- **Button:** a flat pill. `default` is lime with forest text. `secondary` is white inside a 2px forest ring. `dark` is the forest pill for lime and sun tiles, where a lime button would vanish. `ghost` and `link` are forest / `primary-ink`. Heights are 48px (default) and 56px (lg), because targets must be large for patients who are unwell.
- **Card:** the tile. Variants: `default` (white), `band` (forest), `lime`, `wash`, `sun`, `peach`, `quiet`.
- **Fields:** white inside a 2px `rule` border, which darkens to `outline` on hover and turns forest with the lime glow on focus. Invalid is the error border.
- **Selected state:** the lime pill, with forest text, in the segmented switch, tabs and `PatientNav`. Checkboxes, radios and switches fill `primary-ink` with a white mark, because a control boundary needs 3:1.
- **Wordmark** (`components/Wordmark.tsx`): "Dr" in the surface's text colour, then "Quick" on a lime pill in forest. It is defined once and reads the same on every surface.
- **Charts:** marks in `primary-ink`, comparison in `outline`, 2px strokes.

## shadcn token mapping

`components/ui/` is shadcn/ui restyled to this system. Every shadcn semantic variable is an alias of a token in `@theme` in `app/globals.css`, declared in `@theme inline`; nothing new is declared and no colour is written as a value.

| shadcn token | Dr Quick token | Note |
|---|---|---|
| `background` | `surface` `#F5F7F2` | page ground |
| `foreground` | `ink` `#163300` | |
| `card` / `popover` | `white` | |
| `card-foreground` / `popover-foreground` | `ink` | |
| `primary` / `primary-foreground` | `primary` `#9FE870` / `ink` | lime fill, forest text |
| `secondary` / `secondary-foreground` | `fill` `#E8EDE3` / `ink` | |
| `muted` / `muted-foreground` | `surface-mid` `#EDF1E8` / `ink-2` `#4D5B45` | |
| `accent` / `accent-foreground` | `surface-mid` / `ink` | hover on the ground |
| `destructive` | `error` `#C8322A` | status only |
| `border` | `rule` `#DCE4D4` | hairlines and field borders |
| `input` | `fill` | |
| `ring` | `ink` | the focus outline is forest on light and lime on forest |
| `band` / `band-foreground` / `band-muted` (added) | `band` `#163300` / `white` / `band-ink-2` `#B5C9A5` | a surface, not a theme: no `.dark` class and no `dark:` variants anywhere |
| `sidebar*` | `white` / `ink` / `primary` / `surface-mid` / `rule` | the app shell reads its own names; they are the same surfaces |

Also added and outside shadcn: `primary-ink`, `lime-wash`, `sun`, `peach` and `success`. Not declared: `chart-1…5` (charts are authored inline SVG), the `.dark` block, and `--radius` with its calc chain.

### Radius aliases

| name | value | used for |
|---|---|---|
| `sm` | 6px | the focus outline's corners |
| `md` / `control` | 12px | fields, select triggers, menu items |
| `lg` | 16px | popovers, dropdowns, alerts |
| `xl` / `tile` | 24px | cards, dialogs, toasts, the 999 bar |
| `2xl` | 32px | bento tiles, photo tiles, the landing sections |
| `pill` | 9999px | buttons, the segmented switch, tabs, badges, the switch track |

### Breakpoints

`560 / 900 / 1080` as `max-phone: / max-cols: / max-forms:` (desktop-first, on the landing page) and as `sm: / md: / lg:` (min-width, inside `components/ui/`). Three lines with two spellings; there is no `xl` or `2xl`.

## Patient surface patterns (2026-09-23, restyled 2026-09-25)

The find-a-GP flow at `/patient/book/*` adds composed patterns in `components/patient/`, all built from `components/ui/` and shown in `/dev/ui`:

- **`FlowStep`**: one booking screen, in three layouts.
  - `split` puts a 30rem white step panel beside a lime-wash canvas carrying the live status of the request. Below the md line the canvas sits between the heading and the body.
  - `column` is for terminal screens.
  - `band` is the full-bleed forest fill, reserved for 999.
  - The canvas is DOM-last and never focusable.
- **`ActionDock`**: one sticky action area at the bottom edge, primary first, with 52px targets. There is no draggable sheet.
- **`ChoiceRow`**: a whole row is the target of a radio or checkbox. The chosen row is shown by a white fill and a 2px inset `primary-ink` ring, as well as by the control itself.
- **`SearchPulse`**: the one looping motion on the patient surface, and it is functional. Two `primary-ink` rings scale out from a white core, only under `prefers-reduced-motion: no-preference`.
- **`GpCard`**: the matched GP on the band, with a reference, the registration and why this GP was matched. It shows no name, face or rating.
- **`PatientNav`**: a row in the top bar from 560px, and a fixed four-item tab bar below that. The active item is the lime pill (a lime-wash cell in the tab bar). It is hidden for the whole booking flow.
- **Home**: a bento. The forest start card (or a lime resume tile while a consultation is live) and the 999 bar sit on the left; what needs you and recent consultations sit on the right, 16px apart.
- **`FieldError`**: ink words with a red icon, and the invalid field's red border.
- **Band census**: one forest band per screen, never two.
- **Margins**: every patient page uses the 16px phone margin (`components/patient/page.ts`) and 24px above it.
