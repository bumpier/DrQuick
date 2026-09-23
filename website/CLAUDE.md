# Dr Quick — Website

> **React migration in progress** (milestone 1 done — see
> `docs/superpowers/specs/2026-08-28-react-migration-design.md`). The site now
> builds from the Next.js app here: `npm run dev` / `npm test` /
> `npm run typecheck` / `NEXT_PUBLIC_SITE_URL=… npm run build`. The landing
> page is `app/page.tsx` + `app/landing-content.tsx`; the API lives in
> `app/api/`; headers live in `next.config.ts`. The old `index.html` and
> `preview/` remain as reference until milestone 4 and are no longer served.

Pre-launch landing page for Dr Quick: on-demand private GP video consultations (England). Its only job is waitlist capture — patient and GP emails. No accounts, no health data, no tracking.

## Files

- `index.html` — the whole page. Single file, inline CSS/JS, no build step, no npm dependencies. The `api/` functions are the only other runtime code.
- `PRODUCT.md` — durable product truth: users, positioning, compliance constraints, evidence, open decisions. Read before changing copy.
- `DESIGN.md` — the visual system (tokens, components, rules), supplied by the user on 2026-09-02 and authoritative. `.impeccable/design.json` is impeccable's generated sidecar and still describes the retired palette; refresh it with `/impeccable doctor` and never read it as authority over `DESIGN.md`.
- `.impeccable/surfaces/index-html.md` — strategy that belongs only to this page.
- `assets/doctors-bro.svg` — Storyset "Doctors bro" illustration, recoloured to the brand palette. **The page now inlines this SVG** so the idle loop can be paused off-screen; this file is the source of truth, so re-inline it after editing. Master download lives in `../Illustrations/`.
- `assets/phone-illustration.svg` — Storyset illustration on the **GP** hero, recoloured with the same mapping (`#263238`→`#0F172A`, its `#92E3A9` accent→`#0047FF`). Referenced as an external `<img>`, not inlined: only the patient illustration carries the idle loop, and that loop is the sole reason the other one is inlined. Master in `../Illustrations/`.
- `assets/favicon.svg`, `assets/og.png` — tab icon and 1200×630 share image.
- `assets/doctor-online.svg` — currently unused.
- `app/api/waitlist/route.ts` — POST endpoint backing all four forms. `app/api/waitlist-export/route.ts` — token-protected CSV export. `app/api/waitlist-delete/route.ts` — token-protected erasure. `lib/waitlist-store.ts` — dependency-free Redis REST client. (The flat `api/` functions were retired in the migration.)
- `next.config.ts` — security headers, the CSP and the noindex rules (replaced `vercel.json`). `.env.example` — the environment variables the API and the build need.

## Design rules — non-negotiable

- **Keep it simple, stupid.** No unneeded text, no eyebrow labels, no section labels, no fine-print paragraphs. Every element must earn its place. When in doubt, delete.
- **Palette:** the `DESIGN.md` front matter ("TechMed Modern", adopted 2026-09-02) is the source of truth. The page uses this reduced set and nothing else; `app/globals.css` declares it and `tests/constraints.test.ts` enforces it:
  - Ground `#F7F9FB` (surface). Cards and focused fields are true white `#FFFFFF`.
  - Ink is slate-900 `#0F172A`, the same dark as the fills: DESIGN.md's prose names slate-900 for primary text, and its `on-surface` `#191C1E` is deliberately unused so the page has one dark. Secondary text `#434657` (on-surface-variant). Hairlines `#E2E8F0` (slate-200).
  - Fields `#E6E8EA`, hover `#E0E3E5`; hover on the ground `#ECEEF0`; the disabled control `#747688`.
  - Dark fills are slate-900 `#0F172A` with secondary text `#94A3B8`. Never true black.
  - Primary `#0047FF` (Electric Indigo) for every action and the one accent; `#0035C5` on hover; `#B9C3FF` for the accent on a dark fill.
  - Semantic: success `#10B981`, error `#EF4444` — the status icons, the invalid field and the 999 icon only. Never decoration.
  - Never use NHS Blue `#005EB8` or anything near it. Dr Quick is a private provider and must never read as NHS-branded. The retired true-black / `#1447E6` system is not to be reintroduced.
- **Typography:** Geist 600/700 for headlines, the wordmark and FAQ questions; Inter 400/600/700 for everything read (Google Fonts on the flat page, `next/font` in the React app; system-ui fallback). Heavy, tight headlines (Uber-like). Display tracking never tighter than `-0.04em`. Reading copy is 15px (`body-md`), leads 18px (`body-lg`), fine print 13px.
- **Layout:** Uber-like. Nav = logo + role switch + one CTA, sticky. Both heroes are the same shape — headline + email form left, illustration right — and that symmetry is what makes the equal-billing decision read visually; do not give one mode a different hero skeleton. `.hero-img` needs its explicit `width: 100%`: `margin-left: auto` sizes a grid item to fit-content, and an `<img>` of a viewBox-only SVG has no intrinsic width to fit to, so it silently collapses to the 300px default without it. A loose bento for the three steps — tiles must vary in span, fill and internal layout; three identical cards is a failure. The dark fill belongs to step three, the payoff, not to step one. Sections separated by 1px hairlines, not background colours.
- **Breakpoints:** three, and they are not interchangeable. `1080px` collapses only the two form-bearing grids (below it their columns squeeze the email input narrower than a phone gets). `900px` is the general two-column-to-one. `560px` is the phone pass. Spacing is a 4-unit base — see the scale in `DESIGN.md`.
- **Two modes, one page.** The nav carries a Patients / GPs segmented control. Both modes ship in the DOM; the inline head script resolves the role before paint from `?role=gp` (or a `#gps` / `#gp-join` hash) and `.js[data-role]` hides the other. Without JS neither hiding rule matches and both modes render stacked — never make the switch the only way to reach GP content. `?role=gp` is the link to send a GP; switching updates it with `replaceState`, scrolls to top and moves focus to the new `h1`.
- **Section order** (changing it changes what the reader knows when). Patient: hero → 999 band → how it works → what it covers and doesn't → price → FAQ → closing capture. GP: hero → how a shift works → what Dr Quick does and doesn't → what you're paid → FAQ → closing capture. The two run in parallel on purpose: expectation-setting sits before the money in both, so the price promise and the pay promise are each read against a known scope. The footer is shared.
- **Motion:** see `DESIGN.md` — The One Arrival Rule, The Capped Stagger Rule, The Never-Hidden Rule. Content arrives with one shared grammar (a 16px rise; the headline by masked line), staggered 70ms and capped at 300ms. Mark new content `data-reveal` and wrap sibling groups in `[data-stagger]` so it inherits that grammar rather than inventing a second one. Reveal start-states live under `.js` so a failed script never blanks the page.
- **Illustration idle:** the inlined hero SVG breathes — three phase-shifted character loops (feet planted, origin `50% 100%`), a slow float on the icons and a slow scale on the background blob. It runs only while on screen (IntersectionObserver toggles `.art-live`) and only under `prefers-reduced-motion: no-preference`. Keep both guards: a decorative loop must never burn battery behind the fold.
- **Craft bar: Uber.** The visual direction is the category canon executed straight, chosen deliberately over four alternative worlds. Do not smuggle in expressive detours; make the convention excellent instead.
- **Both audiences are equal.** Patients and GPs each get a full page, not a section. The GP mode's dark full-bleed band is the pay band — the dark fill sits on the payoff, which for a GP is that busy hours pay more. The 999 band is patient-flow content and appears in patient mode only; the footer instance is shared, so the page never loses it.
- **No gradients, no glass, no gradient text, no emoji or unicode icons.** The one exception (2026-09-02): `radial-gradient` and `linear-gradient` may draw the hard-edged dots and 1px lines of the static surface textures in `app/globals.css` (the hero dot field and the `band-grid` line grid on the two slate-900 fills), and a `mask-image` fade may feather the dot field's lower edge, but never a visible colour transition on any surface and never a wash. Icons are authored SVG. Elevation is `DESIGN.md`'s micro-elevation and nothing more: cards are borderless and carry the tier-2 slate shadow (`0 4px 12px rgba(15,23,42,.04)` behind a 1px 3% ring), the nav lifts with the same shadow only once it floats, fields get a 4px primary glow on focus. No hard, coloured or decorative shadows.
- **Illustrations:** while the page uses illustration, Storyset only (https://storyset.com/doctors), used as downloaded except recolouring to the brand palette (sed-replace the hex values). The footer attribution link is required by their licence — never remove it while a Storyset asset is on the page. Real photography is the recorded upgrade path (see the surface brief); replacing the illustration is a planned change, not a violation.

## Component layer

- **`components/ui/` is shadcn/ui** (Radix base, the unified `radix-ui` package), installed with the CLI (`npx shadcn@latest init -d --base radix` — the default picks Base UI, which is not this layer) and then restyled to `DESIGN.md`. Every button, field, card, tab, table, dialog and badge on the landing page and on the dashboards is one of these components reading the same tokens. Add components via the CLI, then restyle — never hand-write a primitive that shadcn already provides, and never install one no screen needs yet. `components.json` is the CLI's config; `lib/utils.ts` exports `cn()` with this project's named scales registered in tailwind-merge, so a `className` override such as `p-tile-lead-pad` actually displaces the component's own class instead of leaving the cascade to decide.
- **The token mapping lives in `DESIGN.md`** ("shadcn token mapping"). Every shadcn semantic variable (`background`, `card`, `muted-foreground`, `border`, `input`, `ring` …) is an alias of an existing `@theme` colour, declared in `@theme inline` in `app/globals.css`. The band is a surface, not a theme: no `.dark` class, no `dark:` variant, no `oklch()` — `tests/constraints.test.ts` refuses all three. The CLI's `init` and `add` may write an `oklch()` palette, a `.dark` block, `@import "shadcn/tailwind.css"`, a circular `--font-sans: var(--font-sans)` or the `shadcn` / `next-themes` packages into the project; delete them. The state variants the components are written in (`data-open`, `data-checked` …) are copied into `globals.css`, so the `shadcn` package is not a runtime dependency.
- **Restyle checklist** for a freshly added component: strip `border` and `ring-1 ring-foreground/10` from surfaces (cards are borderless with `shadow-card`; popovers, dialogs, sheets, dropdowns, tooltips and toasts carry `shadow-pop`); strip `outline-none` and `focus-visible:ring-*` from controls so the global `:focus-visible` outline shows (fields and select triggers keep `outline-none` and use the border + glow; menu items keep `outline-hidden` because the highlight is the focus); rename `font-heading` to `font-display` on titles and tab triggers; replace `bg-black/*` and `backdrop-blur` on overlays with `bg-ink/40`; retime `animate-in` / `animate-out` to `duration-160`–`280` with `ease-(--ease)` / `ease-(--ease-out)`; keep every colour a semantic class — never a hex, never `bg-[rgb(…)]`. Leave the structure, the a11y wiring and the `data-slot` attributes intact so `shadcn diff` stays tractable.
- **Three breakpoints, two spellings.** `560 / 900 / 1080` are `max-phone: / max-cols: / max-forms:` on the landing page and `sm: / md: / lg:` (min-width) inside `components/ui/`; there is no `xl` or `2xl`, and `hooks/use-mobile.ts` switches at the 900 line, not shadcn's 768.
- **Icons.** Landing page icons stay the authored sprite in `components/IconDefs.tsx`. `lucide-react` is permitted for the dashboards only — and inside the dashboard-only components that ship with it (dialog, sheet, select, dropdown-menu, breadcrumb, sidebar, sonner) — at `strokeWidth={2}` and 20px to match the existing `#i-yes` / `#i-no` marks. No emoji, no icon fonts.
- **Never ported to Radix.** The FAQ stays native `<details>` (the answers exist in the DOM without JavaScript; Radix `Accordion` hides them) and the Patients / GPs switch stays two real `<a href>` links with `aria-current` — `components/ui/segmented-link.tsx`, never `Tabs` or `ToggleGroup`. If a dashboard needs an accordion, install shadcn's for it and leave `Faq.tsx` alone.
- **Gallery.** `/dev/ui` (`app/dev/ui/`) renders every installed component in every variant and state on the ground, on white and on the band. It is the screenshot target for parity checks and for dashboard work; it 404s in a production build and `/dev/*` carries the noindex header. Keep it current when a component is added or restyled.

## Forms

All four forms (patient hero, patient closing band, GP hero, GP closing band) POST JSON to `/api/waitlist`:

```json
{ "email": "...", "role": "patient" | "gp", "source": "hero" | "recap" | "hero-gp" | "recap-gp" }
```

The endpoint is built: `api/waitlist.js`, a Vercel serverless function with no npm dependencies. It stores email, role, source and an ISO timestamp in Redis over the REST API (Vercel KV or Upstash; both env var pairs are supported). It deliberately does **not** retain IP — the rate-limit key is a salted SHA-256 hash with a 600s TTL, never written into the waitlist record. Retrieve the list with `GET /api/waitlist-export` and a `WAITLIST_EXPORT_TOKEN` bearer token; without that variable set, the route refuses every request.

Responses the client handles: `200 {ok,alreadyJoined}`, `400` invalid, `429` rate limited, `503` store unconfigured, `502` write failed. Keep the honeypot field (`.hp`), client-side email validation, the distinct `.ok` / `.err` status states, and the focus move to the status region on success. Zero friction: email is the only field, ever.

## Compliance constraints (from Docs/Dr_Quick_Research_Report.md — read it before big changes)

- **Pricing is dynamic (decided 2026-09-04, by the user, reversing the research report).** Supply and demand set the price, Uber-style. No page may state a fixed price, and the flat `FEE` constant is gone from `lib/fixtures.ts` — money is summed from what each consultation actually paid, never a count multiplied by a rate. What survives the reversal, because it is law rather than pricing strategy:
  - **The price must be shown in full before the patient commits, and must not move after.** Quote, then hold. Since April 2025 the CMA can fine up to 10% of global turnover under the DMCC Act, and drip pricing — a headline figure that grows on the way to checkout — is banned outright. Dynamic *between* bookings is defensible; dynamic *during* one is not.
  - **Never present price as time pressure.** The ASA ruled time-pressure pricing in medical-service ads "socially irresponsible" (Menwell/Juniper, 2026). "Busier than usual", "priority queue", countdowns against a price, and the word "surge" in patient-facing copy stay banned — `tests/constraints.test.ts` enforces the wording. The compliant expression of the model is the patient promise ("Your price in full, before you book") and the GP incentive ("Paid more when demand is high"), never a nudge to book now before it costs more.
  - **Never price clinical priority.** A patient must never pay to be seen sooner than a clinically more urgent one. Demand may move the price; it may not reorder the queue on ability to pay.
  - `Docs/Dr_Quick_Landing_Page_info.pdf` remains an anti-reference. Its "£82 Priority · busier than usual" breaks all three rules above and is still superseded — the pricing *model* was reinstated, its *presentation* was not.
- Never claim CQC registration before it exists — current wording is "CQC-registered clinical service at launch". Never use "operating under a CQC-registered clinical partner".
- Never name medicines or imply a consultation guarantees a prescription (POM advertising is illegal in the UK). Keep prescription wording conditional — "any prescription you need", never "prescriptions included".
- Keep the 999/A&E emergency disclaimer. It appears twice by design: a band directly under the hero, and in the footer. The band must stay at body size inside the patient flow, and "call 999" must stay a real `tel:` link in both places — someone using this page may need to tap it while shaking.
- England only at launch. Never imply UK-wide availability — Scotland (HIS), Wales (HIW) and Northern Ireland (RQIA) are three separate regulatory regimes, and all three must be named when the page lists what is not covered.
- Collect nothing beyond email on this page — no symptoms, no health information.
- Never state or imply that the consultation price covers the cost of the medicine. It covers writing the prescription; the patient pays the pharmacy. Claiming otherwise is a DMCC drip-pricing exposure.
- Controlled-drug wording must stay scoped to **Schedule 2 and 3**. A blanket "controlled drugs" claim is broader than the constraint and would be false at launch.
- The CSV export escapes leading `= + - @` so a crafted address cannot execute as a spreadsheet formula. Keep that guard if you touch `csvCell`.
- The FAQ promises deletion "until launch and for no more than twelve months after that". That retention figure is a default, not a confirmed decision (`PRODUCT.md`, Explicitly undecided) — but the page makes the promise, so the store must honour it.
- **The privacy notice is incomplete and this blocks launch.** UK GDPR Art 13 requires the controller's registered name and address and a working privacy contact at the point of collection. The legal entity is undecided, so they cannot be written yet; a `DEPLOY / LEGAL` comment in `index.html` marks the spot. Do not let this page collect a real address until it is filled in.

## Before deploy

- `og:image` and `twitter:image` point at `https://REPLACE-WITH-PRODUCTION-DOMAIN/assets/og.png`. Substitute the real host or no crawler renders the share card. A relative path does not work — this placeholder is deliberately loud rather than silently broken.
- Set `KV_REST_API_URL` / `KV_REST_API_TOKEN` (or the `UPSTASH_*` pair), `WAITLIST_EXPORT_TOKEN` and `RATE_LIMIT_SALT`. Without the store variables `/api/waitlist` returns 503 and the forms show an error; without the export token both `/api/waitlist-export` and `/api/waitlist-delete` refuse every request.
- Fill in the controller details marked `DEPLOY / LEGAL` in `index.html`.
- No canonical URL is set, because the domain is unknown.

## Verifying changes

Render before delivering: screenshot desktop (1440px) and mobile (390px) and check both, including the footer. Playwright is not installed; the cached headless Chrome at
`~/.cache/puppeteer/chrome-headless-shell/*/chrome-headless-shell-mac-arm64/chrome-headless-shell`
works with `--headless --window-size=W,H --screenshot=out.png <url>`. Serve locally first (`python3 -m http.server`) — `file://` URLs load fonts unreliably.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
