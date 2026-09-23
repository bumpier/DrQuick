# React Migration — Milestone 1: Foundation and Landing Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Next.js application and rebuild the marketing landing page and the three waitlist API functions at full parity with today's `index.html` + `api/`, so that the old flat page is no longer the serving artifact.

**Architecture:** Next.js 16 App Router, statically generating one landing page that carries both role modes in its HTML (the pre-paint role script and CSS attribute hiding survive unchanged). All landing markup is server components; exactly two kinds of client island exist — `WaitlistForm` (4 instances) and a null-rendering `LandingBehavior` that ports the flat page's behavior script (reveal grammar, mode switch, nav floating, idle-art observer, CTA focus) as direct DOM operations. The API functions port to route handlers on the Node runtime with zero npm dependencies.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS v4 (`@theme` CSS-first config) plus an authored CSS layer, Vitest + React Testing Library + jsdom, deployed on Vercel.

**Spec:** `docs/superpowers/specs/2026-08-28-react-migration-design.md` — read it first. This plan implements its milestone 1 only. `CLAUDE.md`, `DESIGN.md` and `PRODUCT.md` in the repo root are binding context.

## Global Constraints

Copied from the spec and CLAUDE.md; every task's requirements implicitly include these.

> **Superseded 2026-09-02:** the palette, typography and shadow bullets below describe the retired three-colour / Archivo system. `DESIGN.md` (TechMed Modern) and the Design rules in `CLAUDE.md` are now binding; `app/globals.css`, `app/layout.tsx` and `tests/constraints.test.ts` already carry the new tokens, fonts and allowed set. Read those, not the bullets, when porting colour.

- **Exactly three colours** — white `#FFFFFF`, black `#000000`, blue `#1447E6` (`#6E9BFF` on black) — plus the closed set of neutral tints listed in Task 1. Never NHS Blue `#005EB8` or anything near it. The constraints test (Task 2) is the enforcement mechanism; it must stay green from Task 2 onward.
- **Typography:** Archivo 500/700/800, system-ui fallback. Display tracking never tighter than `-0.04em`.
- **Three breakpoints, not interchangeable:** `1080px` (collapses only the two form-bearing grids), `900px` (general two-column-to-one), `560px` (phone). No other breakpoint may be introduced.
- **No shadows, no gradients, no glass, no gradient text, no emoji or unicode icons.** Icons are authored SVG.
- **Compliance copy is ported verbatim, never rewritten:** one fixed £39; conditional prescription wording; "CQC-registered clinical service at launch"; England only with Scotland, Wales and Northern Ireland all named; controlled drugs scoped to Schedule 2 and 3; two `tel:999` links (patient band + footer); the `DEPLOY / LEGAL` marker; the Storyset attribution link.
- **API routes:** Node runtime (`export const runtime = 'nodejs'`), never `edge`. Zero npm runtime dependencies. No IP retention. `csvCell` formula-injection guard kept.
- **The landing page must render both modes without JavaScript** (no hiding rule matches without the `.js` class) and must remain statically generated (`page.tsx` reads no request data).
- **Node 26 / npm 11** are installed locally. The repo's git root is `~` (home monorepo); `node_modules` is already globally ignored via `~/.gitignore`.
- Work on the current branch (`drquick-role-prototype`). Commit after every task with the message given in the task.
- Commit messages end with:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

### Recorded deviations from the flat page (approved by the spec; do not "fix" them back)

1. **405 handling** moves to the framework: an App Router route exports only the methods it serves and Next answers other verbs with 405 + `Allow` itself. The hand-written 405 branches are not ported.
2. **Store env vars are read per call**, not at module load, so tests can stub them and server start order doesn't matter. Per-request behavior is identical.
3. **Body-size cap** counts UTF-16 chars of the decoded text (old code counted bytes). Same 4096 figure; only multi-byte-heavy payloads land differently, and both sides of that line are a 400.
4. **Breakpoints** compile to `width < 1080px` (Tailwind `max-*`) where the old CSS said `max-width: 1080px` (≤). A one-device-pixel difference at exactly the boundary; accepted.
5. **Fonts are self-hosted** by `next/font`, so `fonts.googleapis.com` / `fonts.gstatic.com` leave the CSP. The CSP gets tighter, not looser.
6. **`metadataBase`**: a production build with `NEXT_PUBLIC_SITE_URL` unset **fails loudly at build time** (the old page shipped a loud placeholder URL instead). Dev falls back to `http://localhost:3000`.
7. **`/preview/*` is not served** by the Next app; the prototype dashboards return in milestones 2–4 as `/patient`, `/doctor`, `/admin`. The noindex headers for those three prefixes are configured now.
8. `plans/001-003` (animation fixes) are already applied to `index.html` (status DONE) — parity porting the current file includes them; nothing extra to do.

## File Structure

```
website/                          (repo subdir; git root is ~)
├── package.json                  NEW  scripts + pinned deps
├── tsconfig.json                 NEW  strict, @/* → ./*
├── next.config.ts                NEW  security headers (Task 6)
├── postcss.config.mjs            NEW  @tailwindcss/postcss
├── vitest.config.ts              NEW  react plugin, @ alias, node default env
├── .gitignore                    NEW  .next/, next-env.d.ts, .env*.local, coverage/
├── .env.example                  MOD  += NEXT_PUBLIC_SITE_URL (Task 14)
├── app/
│   ├── globals.css               NEW  @theme tokens + base layer (T1), landing layer (T7)
│   ├── layout.tsx                NEW  font, pre-paint script (T1), full metadata (T14)
│   ├── page.tsx                  NEW  landing assembly (T12–T13)
│   ├── landing-content.tsx       NEW  typed copy arrays: steps/covers/FAQ ×2 (T11–T13)
│   └── api/
│       ├── waitlist/route.ts         NEW  (T4)
│       ├── waitlist-export/route.ts  NEW  (T5)
│       └── waitlist-delete/route.ts  NEW  (T5)
├── lib/
│   ├── waitlist-store.ts         NEW  Redis REST client port (T3)
│   └── reveal.ts                 NEW  stagger-delay constants + math (T8)
├── components/
│   ├── LandingBehavior.tsx       NEW  client, null-render; ports the page script (T8)
│   ├── WaitlistForm.tsx          NEW  client (T9)
│   ├── IconDefs.tsx              NEW  #i-yes/#i-no sprite (T9)
│   ├── Nav.tsx                   NEW  server markup (T10)
│   ├── Hero.tsx                  NEW  shared hero skeleton, both modes (T10)
│   ├── HeroArt.tsx               NEW  server; inlines doctors-bro.svg (T10)
│   ├── UrgentBand.tsx            NEW  999 band (T10)
│   ├── Steps.tsx                 NEW  bento (T11)
│   ├── Covers.tsx                NEW  does/doesn't subgrid (T11)
│   ├── PriceBand.tsx             NEW  £39 band + GP £24–33 field variant (T11)
│   ├── Faq.tsx                   NEW  disclosure list (T12)
│   ├── Recap.tsx                 NEW  closing capture (T12)
│   └── Footer.tsx                NEW  shared footer (T13)
├── public/assets/                NEW  doctors-bro.svg (extracted), phone-illustration.svg,
│                                      favicon.svg, og.png — copied in T10; assets/ stays
│                                      until milestone 4 as the still-renderable old page's refs
├── tests/
│   ├── constraints.test.ts       NEW  (T2)
│   ├── waitlist-store.test.ts    NEW  (T3)
│   ├── api-waitlist.test.ts      NEW  (T4)
│   ├── api-export-delete.test.ts NEW  (T5)
│   ├── headers.test.ts           NEW  (T6)
│   ├── reveal.test.ts            NEW  (T8)
│   ├── landing-behavior.test.tsx NEW  (T8)
│   ├── waitlist-form.test.tsx    NEW  (T9)
│   ├── hero.test.tsx             NEW  (T10)
│   ├── sections.test.tsx         NEW  (T11)
│   ├── page-structure.test.tsx   NEW  (T12–T13, grows)
│   ├── metadata.test.ts          NEW  (T14)
│   └── helpers/io-stub.ts        NEW  IntersectionObserver stub (T8)
├── index.html                    KEPT untouched (deleted in milestone 4)
├── api/                          DELETED in T5 (replaced by app/api/)
└── vercel.json                   DELETED in T6 (replaced by next.config.ts headers)
```

**JSX conversion rules** (used by every markup task; apply mechanically when porting from `index.html`):
`class`→`className` · `for`→`htmlFor` · `tabindex="-1"`→`tabIndex={-1}` · `autocomplete`→`autoComplete` · `novalidate`→`noValidate` · `stroke-width`→`strokeWidth` · `stroke-linecap`→`strokeLinecap` · `stroke-linejoin`→`strokeLinejoin` · `fill-rule`→`fillRule` · void elements self-close (`<input … />`) · HTML comments→`{/* … */}` · entities (`&rsquo;` `&mdash;` `&ndash;` `&amp;`) may stay as-is in JSX text · `style="position:absolute"`→`style={{position:'absolute'}}` · `aria-*` and `data-*` unchanged · `<use href>` unchanged.

---

### Task 1: Scaffold, tokens, root layout, pre-paint role script

**Files:**
- Create: `.gitignore`, `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `app/globals.css`, `app/layout.tsx`, `app/page.tsx`

**Interfaces:**
- Consumes: `DESIGN.md` front-matter tokens (lines 1–80); `index.html:32-46` (pre-paint script, ported byte-identical inside).
- Produces: `@theme` tokens every later task's utilities reference (`text-ink-2`, `border-rule`, `py-section`, `rounded-control`, `max-cols:` etc.); `app/layout.tsx` rendering `<html lang="en-GB" className={archivo.variable} suppressHydrationWarning>` with the role script as the first child of `<body>`; placeholder `app/page.tsx` exporting default `Page` and `export const dynamic = 'force-static'`.

- [ ] **Step 1: Write `.gitignore`**

```gitignore
.next/
out/
next-env.d.ts
.env*.local
coverage/
*.tsbuildinfo
```

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "drquick-website",
  "private": true,
  "engines": { "node": ">=20.9" },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^16.1.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.1.0",
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.0",
    "@types/node": "^24.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.7.0",
    "jsdom": "^26.0.0",
    "tailwindcss": "^4.1.0",
    "typescript": "^5.9.0",
    "vitest": "^3.2.0"
  }
}
```

Then run: `npm install`. If npm reports a listed version as unpublished, take the latest release within the same major and note it in the commit body.

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "preview", "api"]
}
```

(`preview/` and the old `api/` are excluded so their untyped JS never enters the compile.)

- [ ] **Step 4: Write `postcss.config.mjs`, minimal `next.config.ts`, `vitest.config.ts`**

```js
// postcss.config.mjs
export default { plugins: { '@tailwindcss/postcss': {} } };
```

```ts
// next.config.ts  (Task 6 replaces this with the headers port)
import type { NextConfig } from 'next';
const nextConfig: NextConfig = {};
export default nextConfig;
```

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname) } },
  test: {
    environment: 'node', // component tests opt into jsdom with a // @vitest-environment jsdom pragma
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
```

- [ ] **Step 5: Write `app/globals.css` — tokens and base layer**

The `@theme` block is transcribed from the `DESIGN.md` front matter. Resetting the `--color-*` and `--breakpoint-*` namespaces first is deliberate: it deletes Tailwind's default palette and default breakpoints, so `bg-red-500` or `md:` is a build error — the three-colour rule and the three-breakpoint rule become compiler-enforced, not review-enforced.

```css
@import "tailwindcss";

@theme {
  /* Colours — the closed palette (DESIGN.md front matter + the three
     prefers-contrast variants from index.html:113). Nothing else exists. */
  --color-*: initial;
  --color-white: #FFFFFF;
  --color-black: #000000;
  --color-blue: #1447E6;
  --color-blue-lift: #6E9BFF;
  --color-ink-2: #767676;        /* 4.54:1 on white */
  --color-ink-2-dark: #A3A3A3;   /* 8.33:1 on black */
  --color-fill: #F1F1F1;
  --color-fill-2: #E4E4E4;
  --color-tile-edge: #D2D2D2;
  --color-placeholder: #666666;
  --color-field-fill: #1A1A1A;   /* on-black input, DESIGN.md component (unused on this page) */
  --color-field-fill-2: #242424;
  --color-rule: rgba(0, 0, 0, .13);
  --color-rule-dark: rgba(255, 255, 255, .22);

  /* Breakpoints — exactly three, per CLAUDE.md. Defaults removed so an
     sm:/md:/lg: habit cannot smuggle in a fourth. Used as max-* variants
     because the page is desktop-first: max-forms:, max-cols:, max-phone:. */
  --breakpoint-*: initial;
  --breakpoint-forms: 1080px;
  --breakpoint-cols: 900px;
  --breakpoint-phone: 560px;

  /* Radii */
  --radius-*: initial;
  --radius-focus: 2px;
  --radius-mark: 4.5px;
  --radius-control: 8px;
  --radius-tile: 16px;

  /* Named rhythms (DESIGN.md spacing) + this page's one-off clamps, named so
     no clamp() ever appears inline in JSX. The default 4px numeric scale is
     kept — it IS the DESIGN.md 4-unit scale. */
  --spacing-section: clamp(56px, 7vw, 96px);
  --spacing-section-open: clamp(72px, 9vw, 128px);
  --spacing-section-tight: clamp(40px, 4.5vw, 56px);
  --spacing-field-section: clamp(64px, 8vw, 112px);
  --spacing-hero-t: clamp(48px, 7vw, 96px);
  --spacing-hero-b: clamp(56px, 8vw, 96px);
  --spacing-hero-gap: clamp(40px, 6vw, 88px);
  --spacing-heading: clamp(28px, 3.5vw, 40px);
  --spacing-heading-tight: clamp(20px, 3vw, 32px);
  --spacing-covers-gap: clamp(32px, 5vw, 72px);
  --spacing-covers-gap-col: clamp(48px, 9vw, 64px);
  --spacing-recap-gap: clamp(32px, 5vw, 64px);
  --spacing-tile-lead-pad: clamp(28px, 3.4vw, 44px);

  /* Named type sizes used as utilities; the h1–h3 element scale lives in base. */
  --text-lead: clamp(1.0625rem, 1.6vw, 1.3125rem);
  --text-title-lead: clamp(1.625rem, 2.6vw, 2.25rem);
  --text-label: .9375rem;
  --text-fine: .8125rem;
}

@theme inline {
  --font-sans: var(--font-archivo), system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
}

/* One semantic utility: the page container. */
@utility wrap {
  max-width: 1200px;
  margin-inline: auto;
  padding-inline: 24px;
}

@layer base {
  :root {
    --ease: cubic-bezier(.22, .61, .36, 1);
    --ease-out: cubic-bezier(.16, 1, .3, 1); /* exponential ease-out for arrivals */
    interpolate-size: allow-keywords;
  }
  html { scroll-behavior: smooth; -webkit-text-size-adjust: 100%; }
  @media (prefers-reduced-motion: reduce) {
    html { scroll-behavior: auto; }
    *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
  }
  body {
    font-family: var(--font-sans);
    background: var(--color-white);
    color: var(--color-black);
    line-height: 1.5;
    font-weight: 500;
    font-synthesis-weight: none;
    -webkit-font-smoothing: antialiased;
  }
  h1, h2, h3 { font-weight: 800; letter-spacing: -.035em; line-height: 1.05; text-wrap: balance; }
  h1 { font-size: clamp(2.75rem, 6.2vw, 5rem); }
  h2 { font-size: clamp(2rem, 4.4vw, 3.25rem); }
  h3 { font-size: 1.375rem; letter-spacing: -.025em; line-height: 1.2; }
  a { color: inherit; }
  ::selection { background: var(--color-blue); color: var(--color-white); }
  input::selection { background: var(--color-blue); color: var(--color-white); }
  input[type="email"] { caret-color: var(--color-blue); }
  /* Kills orphans and ragged last lines across every paragraph on the page. */
  p, li, summary, dd { text-wrap: pretty; }
  :focus-visible { outline: 3px solid var(--color-blue); outline-offset: 3px; border-radius: var(--radius-focus); }
  @media (prefers-contrast: more) {
    :root {
      --color-rule: rgba(0, 0, 0, .34);
      --color-tile-edge: #8A8A8A;
      --color-ink-2: #595959;
      --color-ink-2-dark: #C9C9C9;
    }
  }
  #join, #gps, #gp-join { scroll-margin-top: 92px; }
}
```

Note: Tailwind v4 compiles `text-ink-2` to `color: var(--color-ink-2)`, so the `prefers-contrast` override propagates through utilities exactly as it did through the old custom properties.

- [ ] **Step 6: Write `app/layout.tsx`**

The role script is byte-identical to `index.html:36-45` inside the IIFE. It is the first child of `<body>`: a classic inline script there is parser-blocking, so it runs before anything below it can paint — same guarantee the `<head>` position gave the flat page. `suppressHydrationWarning` is required because the script adds `class="js"` and `data-role` to `<html>` before React hydrates it.

```tsx
import type { Metadata, Viewport } from 'next';
import { Archivo } from 'next/font/google';
import './globals.css';

const archivo = Archivo({
  subsets: ['latin'],
  weight: ['500', '700', '800'],
  display: 'swap',
  variable: '--font-archivo',
});

// Task 14 completes this object (og/twitter/icons/metadataBase).
export const metadata: Metadata = {
  title: 'Dr Quick — See a GP in minutes',
  description:
    'See a GMC-registered GP by secure video, in minutes. £39 per consultation, shown in full before you book. Join the waitlist.',
};

export const viewport: Viewport = { themeColor: '#FFFFFF' };

// Both role modes ship in the DOM. Resolving the role here, before paint, means
// the switch never flashes the wrong page; without this script neither hiding
// rule matches and both modes render, so a blocked script cannot blank the page.
const ROLE_SCRIPT = `(function () {
  var d = document.documentElement;
  d.classList.add('js');
  var role = 'patient';
  try {
    var q = new URLSearchParams(location.search).get('role');
    if (q === 'gp' || location.hash === '#gps' || location.hash === '#gp-join') role = 'gp';
  } catch (e) {}
  d.setAttribute('data-role', role);
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={archivo.variable} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: ROLE_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Write placeholder `app/page.tsx`**

```tsx
export const dynamic = 'force-static';

export default function Page() {
  return <main id="main" />;
}
```

- [ ] **Step 8: Verify the scaffold builds and serves**

Run:
```bash
npm run build && npm run typecheck
(npm run start &) && sleep 3
curl -s http://localhost:3000/ | grep -c "data-role" # expect ≥1 (the inline script)
curl -s http://localhost:3000/ | grep -o '<main id="main">' # expect the tag
kill %1
```
Expected: build succeeds; both greps hit.

- [ ] **Step 9: Commit**

```bash
git add .gitignore package.json package-lock.json tsconfig.json next.config.ts postcss.config.mjs vitest.config.ts app/
git commit -m "feat(react): scaffold Next.js app with design tokens and pre-paint role script"
```

---

### Task 2: Constraints guard test

The palette/wording police from `preview/tests/constraints.test.mjs`, extended per the spec: it scans the new app's source (`.ts`, `.tsx`, `.css`, `.js` under `app/`, `components/`, `lib/`), normalizes every hex literal, and rejects anything outside the closed set — which also catches Tailwind arbitrary values like `bg-[#005EB8]`, because the hex inside the bracket is still a hex literal in source. It additionally bans arbitrary color *functions* in utilities (`bg-[rgb(…)]` etc.), which the hex scan would miss.

**Files:**
- Create: `tests/constraints.test.ts`
- Reference: `preview/tests/constraints.test.mjs:18-66` (lists ported verbatim)

**Interfaces:**
- Consumes: the file tree from Task 1.
- Produces: a standing guard; later tasks add scanned files simply by existing. No exports.

- [ ] **Step 1: Write the test file**

```ts
import { test, expect, describe } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = join(__dirname, '..');
const SCAN_DIRS = ['app', 'components', 'lib'].map((d) => join(ROOT, d));
const EXTS = new Set(['.ts', '.tsx', '.css', '.js']);

function walk(dir: string): string[] {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return []; }
  return entries.flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const FILES = SCAN_DIRS.flatMap(walk).filter((f) => EXTS.has(extname(f)));

const MEDICINES = [
  'amoxicillin', 'azithromycin', 'clarithromycin', 'doxycycline', 'penicillin',
  'trimethoprim', 'nitrofurantoin', 'prednisolone', 'salbutamol', 'omeprazole',
  'metformin', 'atorvastatin', 'levothyroxine', 'sertraline', 'fluoxetine',
  'citalopram', 'amitriptyline', 'naproxen', 'ibuprofen', 'paracetamol',
  'codeine', 'tramadol', 'morphine', 'oxycodone', 'diazepam', 'zopiclone',
  'pregabalin', 'gabapentin', 'semaglutide', 'tirzepatide', 'wegovy',
  'ozempic', 'mounjaro',
];

// Word-boundary patterns: a bare substring match on "surge" also fires on
// "surgery", which is ordinary UK general-practice vocabulary.
const BANNED_PATTERNS = [
  /\bsurge\b/i,
  /\bpriority queue\b/i,
  /\bbusier than usual\b/i,
  /\bcqc-registered clinical partner\b/i,
  /\bcqc (registration )?number\b/i,
];

// DESIGN.md front matter + the three prefers-contrast variants (index.html:113).
// #fff appears as the stroke colour inside the status-icon SVGs.
const ALLOWED_HEX = new Set([
  '#ffffff', '#fff', '#000000', '#000', '#1447e6', '#6e9bff',
  '#767676', '#a3a3a3', '#f1f1f1', '#e4e4e4', '#d2d2d2', '#666666',
  '#1a1a1a', '#242424', '#8a8a8a', '#595959', '#c9c9c9',
]);

export function offPaletteHexes(text: string): string[] {
  return (text.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [])
    .map((h) => h.toLowerCase())
    .filter((h) => !ALLOWED_HEX.has(h));
}

// A Tailwind arbitrary value carrying a colour function dodges the hex scan.
export function arbitraryColorFunctions(text: string): string[] {
  return text.match(/[a-z-]+-\[(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\(/g) ?? [];
}

describe('the checkers themselves bite', () => {
  test('an off-palette hex is flagged', () => {
    expect(offPaletteHexes('color: #005EB8;')).toEqual(['#005eb8']);
    expect(offPaletteHexes('bg-[#005EB8]')).toEqual(['#005eb8']);
    expect(offPaletteHexes('color: #1447E6;')).toEqual([]);
  });
  test('an arbitrary colour function is flagged', () => {
    expect(arbitraryColorFunctions('className="bg-[rgb(0,94,184)]"')).toHaveLength(1);
    expect(arbitraryColorFunctions('className="bg-fill"')).toHaveLength(0);
  });
});

test('there is source to scan', () => {
  expect(FILES.length).toBeGreaterThan(0);
});

test('app source names no medicine', () => {
  for (const file of FILES) {
    const text = readFileSync(file, 'utf8').toLowerCase();
    for (const drug of MEDICINES) {
      expect(text.includes(drug), `${file} names a medicine: ${drug}`).toBe(false);
    }
  }
});

test('app source uses no banned pricing or claim wording', () => {
  for (const file of FILES) {
    const text = readFileSync(file, 'utf8');
    for (const pattern of BANNED_PATTERNS) {
      expect(pattern.test(text), `${file} contains banned wording: ${pattern}`).toBe(false);
    }
  }
});

test('app source invents no CQC provider id', () => {
  for (const file of FILES) {
    const text = readFileSync(file, 'utf8');
    expect(/\b1-\d{6,}\b/.test(text), `${file} contains a CQC-shaped provider id`).toBe(false);
  }
});

test('app source uses only the permitted palette', () => {
  for (const file of FILES) {
    const bad = offPaletteHexes(readFileSync(file, 'utf8'));
    expect(bad, `${file} uses off-palette colour(s): ${bad.join(', ')}`).toEqual([]);
  }
});

test('app source smuggles no colour through an arbitrary value function', () => {
  for (const file of FILES) {
    const bad = arbitraryColorFunctions(readFileSync(file, 'utf8'));
    expect(bad, `${file} uses arbitrary colour function(s): ${bad.join(', ')}`).toEqual([]);
  }
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run tests/constraints.test.ts`
Expected: PASS (the self-check tests prove the checkers flag bad input; the tree scan passes because Task 1's files are clean).

- [ ] **Step 3: Commit**

```bash
git add tests/constraints.test.ts
git commit -m "test(react): port and extend the palette and wording constraints guard"
```

---

### Task 3: Waitlist store library

Direct port of `api/_store.js` with env read at call time (recorded deviation 2).

**Files:**
- Create: `lib/waitlist-store.ts`, `tests/waitlist-store.test.ts`
- Reference: `api/_store.js` (whole file)

**Interfaces:**
- Produces: `configured(): boolean`; `pipeline(commands: (string | number)[][]): Promise<unknown[]>` throwing `Error('WAITLIST_STORE_NOT_CONFIGURED')`, `Error('REDIS_HTTP_<status>')` or `Error('REDIS_<error>')`. Tasks 4–5 import both.

- [ ] **Step 1: Write the failing tests**

```ts
import { test, expect, beforeEach, vi } from 'vitest';
import { configured, pipeline } from '@/lib/waitlist-store';

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.stubEnv('KV_REST_API_URL', '');
  vi.stubEnv('KV_REST_API_TOKEN', '');
  vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
});

test('configured() is false with no env and true with either pair', () => {
  expect(configured()).toBe(false);
  vi.stubEnv('KV_REST_API_URL', 'https://kv.example');
  vi.stubEnv('KV_REST_API_TOKEN', 'tok');
  expect(configured()).toBe(true);
  vi.stubEnv('KV_REST_API_URL', '');
  vi.stubEnv('KV_REST_API_TOKEN', '');
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://up.example');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'tok2');
  expect(configured()).toBe(true);
});

test('pipeline() throws unconfigured without env', async () => {
  await expect(pipeline([['PING']])).rejects.toThrow('WAITLIST_STORE_NOT_CONFIGURED');
});

test('pipeline() posts commands to <url>/pipeline with the bearer token', async () => {
  vi.stubEnv('KV_REST_API_URL', 'https://kv.example/');
  vi.stubEnv('KV_REST_API_TOKEN', 'tok');
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => [{ result: 1 }, { result: 'OK' }],
  }));
  vi.stubGlobal('fetch', fetchMock);
  const results = await pipeline([['INCR', 'k'], ['EXPIRE', 'k', '600', 'NX']]);
  expect(results).toEqual([1, 'OK']);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('https://kv.example/pipeline'); // trailing slash stripped
  expect(init.method).toBe('POST');
  expect(init.headers.Authorization).toBe('Bearer tok');
  expect(JSON.parse(init.body)).toEqual([['INCR', 'k'], ['EXPIRE', 'k', '600', 'NX']]);
  expect(init.signal).toBeInstanceOf(AbortSignal);
});

test('pipeline() surfaces HTTP and per-command errors', async () => {
  vi.stubEnv('KV_REST_API_URL', 'https://kv.example');
  vi.stubEnv('KV_REST_API_TOKEN', 'tok');
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })));
  await expect(pipeline([['PING']])).rejects.toThrow('REDIS_HTTP_500');
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => [{ result: 1 }, { error: 'WRONGTYPE' }],
  })));
  await expect(pipeline([['A'], ['B']])).rejects.toThrow('REDIS_WRONGTYPE');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/waitlist-store.test.ts`
Expected: FAIL — cannot resolve `@/lib/waitlist-store`.

- [ ] **Step 3: Write `lib/waitlist-store.ts`**

```ts
// Minimal Redis REST client. No npm dependencies, on purpose — ported from
// api/_store.js. Works with Vercel KV and with Upstash Redis directly; both
// expose the same REST surface under different env var names. Env is read per
// call (not at module load) so tests can stub it and boot order cannot matter.
export type Command = (string | number)[];

function url(): string {
  return process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
}
function token(): string {
  return process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
}

export function configured(): boolean {
  return Boolean(url() && token());
}

// Upstash's /pipeline endpoint takes an array of command arrays and returns an
// array of { result } | { error } in the same order.
export async function pipeline(commands: Command[]): Promise<unknown[]> {
  if (!configured()) throw new Error('WAITLIST_STORE_NOT_CONFIGURED');
  const res = await fetch(`${url().replace(/\/$/, '')}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) throw new Error(`REDIS_HTTP_${res.status}`);
  const body: Array<{ result?: unknown; error?: string }> = await res.json();
  const failed = body.find((entry) => entry && entry.error);
  if (failed) throw new Error(`REDIS_${failed.error}`);
  return body.map((entry) => entry.result);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/waitlist-store.test.ts` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/waitlist-store.ts tests/waitlist-store.test.ts
git commit -m "feat(api): port the dependency-free Redis REST client to TypeScript"
```

---

### Task 4: `POST /api/waitlist` route handler

Port of `api/waitlist.js` to a Web-API route handler. Behavior identical except the framework-owned 405 (recorded deviation 1) and the char-counted body cap (deviation 3).

**Files:**
- Create: `app/api/waitlist/route.ts`, `tests/api-waitlist.test.ts`
- Reference: `api/waitlist.js` (whole file)

**Interfaces:**
- Consumes: `configured`, `pipeline` from `@/lib/waitlist-store`.
- Produces: `POST(request: Request): Promise<Response>`. JSON contract unchanged: `200 {ok, alreadyJoined}`, `400 {ok:false,error:'bad_request'|'invalid_email'|'invalid_role'}`, `429 {ok:false,error:'rate_limited'}`, `502 {ok:false,error:'store_write_failed'}`, `503 {ok:false,error:'store_unavailable'}`; every response carries `Cache-Control: no-store`.

- [ ] **Step 1: Write the failing tests**

```ts
import { test, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/waitlist/route';

function req(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/waitlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

// Each fetch call answers one pipeline() invocation, in order.
function stubPipelines(...responses: unknown[][]) {
  const fetchMock = vi.fn();
  for (const results of responses) {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => results.map((result) => ({ result })),
    });
  }
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.stubEnv('KV_REST_API_URL', 'https://kv.example');
  vi.stubEnv('KV_REST_API_TOKEN', 'tok');
});

test('503 when the store is not configured', async () => {
  vi.stubEnv('KV_REST_API_URL', '');
  vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
  const res = await POST(req({ email: 'a@b.co', role: 'patient' }));
  expect(res.status).toBe(503);
  expect(res.headers.get('Cache-Control')).toBe('no-store');
  expect(await res.json()).toEqual({ ok: false, error: 'store_unavailable' });
});

test('honeypot value returns a fake success without touching the store', async () => {
  const fetchMock = stubPipelines();
  const res = await POST(req({ email: 'a@b.co', role: 'patient', company: 'bot inc' }));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, alreadyJoined: false });
  expect(fetchMock).not.toHaveBeenCalled();
});

test('invalid email and invalid role are 400s', async () => {
  stubPipelines();
  expect((await POST(req({ email: 'nope', role: 'patient' }))).status).toBe(400);
  expect((await POST(req({ email: 'a@b.co', role: 'admin' }))).status).toBe(400);
  const long = `${'a'.repeat(250)}@example.com`;
  expect((await POST(req({ email: long, role: 'patient' }))).status).toBe(400);
});

test('unparseable and oversize bodies are 400 bad_request', async () => {
  stubPipelines();
  expect((await POST(req('not json'))).status).toBe(400);
  const big = JSON.stringify({ email: 'a@b.co', role: 'patient', pad: 'x'.repeat(5000) });
  expect((await POST(req(big))).status).toBe(400);
});

test('sixth submission in the window is rate limited', async () => {
  stubPipelines([6, 1]); // INCR → 6, EXPIRE → 1
  const res = await POST(req({ email: 'a@b.co', role: 'patient' }, { 'x-forwarded-for': '203.0.113.9' }));
  expect(res.status).toBe(429);
  expect(await res.json()).toEqual({ ok: false, error: 'rate_limited' });
});

test('the rate-limit key is a salted hash — the raw IP never reaches the store', async () => {
  vi.stubEnv('RATE_LIMIT_SALT', 'pepper');
  const fetchMock = stubPipelines([1, 1], [1, 1]);
  await POST(req({ email: 'a@b.co', role: 'patient' }, { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }));
  const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(JSON.stringify(firstBody)).not.toContain('203.0.113.9');
  expect(firstBody[0][0]).toBe('INCR');
  expect(firstBody[0][1]).toMatch(/^rl:[0-9a-f]{24}$/);
  expect(firstBody[1]).toEqual(['EXPIRE', firstBody[0][1], '600', 'NX']);
});

test('a new address stores and reports alreadyJoined false; a repeat reports true', async () => {
  let fetchMock = stubPipelines([1, 1], [1, 1]); // rate, then SADD=1
  let res = await POST(req({ email: 'New@B.co ', role: 'gp', source: 'hero-gp' }, { 'x-forwarded-for': '1.2.3.4' }));
  expect(await res.json()).toEqual({ ok: true, alreadyJoined: false });
  const writeBody = JSON.parse(fetchMock.mock.calls[1][1].body);
  expect(writeBody[0]).toEqual(['SADD', 'waitlist:gp', 'new@b.co']); // trimmed + lowercased
  expect(writeBody[1][0]).toBe('HSET');
  expect(writeBody[1][2]).toBe('gp:new@b.co');
  const record = JSON.parse(writeBody[1][3]);
  expect(record).toMatchObject({ email: 'new@b.co', role: 'gp', source: 'hero-gp' });
  expect(new Date(record.joinedAt).toString()).not.toBe('Invalid Date');

  fetchMock = stubPipelines([1, 1], [0, 0]); // SADD=0 → repeat
  res = await POST(req({ email: 'new@b.co', role: 'gp' }, { 'x-forwarded-for': '1.2.3.4' }));
  expect(await res.json()).toEqual({ ok: true, alreadyJoined: true });
});

test('a store failure during the write is a 502', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => [{ result: 1 }, { result: 1 }] })
    .mockResolvedValueOnce({ ok: false, status: 500 });
  vi.stubGlobal('fetch', fetchMock);
  const res = await POST(req({ email: 'a@b.co', role: 'patient' }, { 'x-forwarded-for': '1.2.3.4' }));
  expect(res.status).toBe(502);
  expect(await res.json()).toEqual({ ok: false, error: 'store_write_failed' });
});

test('with no client IP the rate limit is skipped and the write still happens', async () => {
  const fetchMock = stubPipelines([1, 1]); // only the write pipeline
  const res = await POST(req({ email: 'a@b.co', role: 'patient' }));
  expect(res.status).toBe(200);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)[0][0]).toBe('SADD');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/api-waitlist.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 3: Write `app/api/waitlist/route.ts`**

```ts
// POST /api/waitlist  { email, role: "patient"|"gp", source }
//
// Stores nothing but the email, the role, the source and a timestamp. No IP is
// retained: the rate-limit key is a salted hash with a short TTL and is never
// written into the waitlist record. See PRODUCT.md — "Collect nothing beyond email".
// Other verbs get the framework's own 405 — only POST is exported.
import { createHash } from 'node:crypto';
import { configured, pipeline } from '@/lib/waitlist-store';

export const runtime = 'nodejs';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = new Set(['patient', 'gp']);

const RATE_MAX = 5;      // submissions per window, per client
const RATE_WINDOW = 600; // seconds
const MAX_BODY = 4096;

function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for') ?? '';
  const first = fwd.split(',')[0].trim();
  return first || (request.headers.get('x-real-ip') ?? '').trim();
}

function clientKey(ip: string): string {
  const salt = process.env.RATE_LIMIT_SALT || 'dr-quick-waitlist';
  return createHash('sha256').update(salt + '|' + ip).digest('hex').slice(0, 24);
}

const json = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request) {
  if (!configured()) {
    console.error('Waitlist store is not configured: set KV_REST_API_URL and KV_REST_API_TOKEN.');
    return json(503, { ok: false, error: 'store_unavailable' });
  }

  let payload: Record<string, unknown>;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) throw new Error('PAYLOAD_TOO_LARGE');
    payload = text ? JSON.parse(text) : {};
  } catch {
    return json(400, { ok: false, error: 'bad_request' });
  }

  const email = String(payload.email || '').trim().toLowerCase();
  const role = String(payload.role || '').trim();
  const source = String(payload.source || 'landing').trim().slice(0, 40);

  // Honeypot: any value here means a bot filled a field a human cannot see.
  if (payload.company) return json(200, { ok: true, alreadyJoined: false });

  if (!EMAIL.test(email) || email.length > 254) {
    return json(400, { ok: false, error: 'invalid_email' });
  }
  if (!ROLES.has(role)) {
    return json(400, { ok: false, error: 'invalid_role' });
  }

  try {
    const ip = clientIp(request);
    if (ip) {
      const key = `rl:${clientKey(ip)}`;
      const [hits] = await pipeline([['INCR', key], ['EXPIRE', key, String(RATE_WINDOW), 'NX']]);
      if (Number(hits) > RATE_MAX) {
        return json(429, { ok: false, error: 'rate_limited' });
      }
    }

    const record = JSON.stringify({ email, role, source, joinedAt: new Date().toISOString() });
    // SADD reports 1 on a genuinely new address and 0 on a repeat. The hash is keyed
    // by role AND email so someone who signs up as both a patient and a GP keeps two
    // records instead of the second silently overwriting the first.
    const [added] = await pipeline([
      ['SADD', `waitlist:${role}`, email],
      ['HSET', 'waitlist:entries', `${role}:${email}`, record],
    ]);

    return json(200, { ok: true, alreadyJoined: Number(added) === 0 });
  } catch (err) {
    console.error('Waitlist write failed:', (err as Error).message);
    return json(502, { ok: false, error: 'store_write_failed' });
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/api-waitlist.test.ts` — Expected: PASS. Also run `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add app/api/waitlist/route.ts tests/api-waitlist.test.ts
git commit -m "feat(api): port POST /api/waitlist to an App Router route handler"
```

---

### Task 5: Export and delete routes; retire the old `api/` directory

Ports of `api/waitlist-export.js` and `api/waitlist-delete.js`. `csvCell` is exported for direct testing — it is the formula-injection guard CLAUDE.md names as load-bearing. When both routes are green, the old `api/` directory is deleted so two implementations can never both answer on a deploy.

**Files:**
- Create: `app/api/waitlist-export/route.ts`, `app/api/waitlist-delete/route.ts`, `tests/api-export-delete.test.ts`
- Delete: `api/_store.js`, `api/waitlist.js`, `api/waitlist-export.js`, `api/waitlist-delete.js`
- Reference: the two old files (whole)

**Interfaces:**
- Consumes: `configured`, `pipeline` from `@/lib/waitlist-store`.
- Produces: `GET(request)` on export (CSV body, columns `email,role,source,joined_at`), `POST(request)` on delete (`{ok, removed}`), and `csvCell(value: unknown): string` exported from the export route module. Both refuse everything with 401 unless `WAITLIST_EXPORT_TOKEN` is set and matches.

- [ ] **Step 1: Write the failing tests**

```ts
import { test, expect, beforeEach, describe, vi } from 'vitest';
import { GET, csvCell } from '@/app/api/waitlist-export/route';
import { POST as DELETE_POST } from '@/app/api/waitlist-delete/route';

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.stubEnv('KV_REST_API_URL', 'https://kv.example');
  vi.stubEnv('KV_REST_API_TOKEN', 'tok');
  vi.stubEnv('WAITLIST_EXPORT_TOKEN', 'secret-token');
});

const exportReq = (auth?: string) =>
  new Request('http://localhost/api/waitlist-export', {
    headers: auth ? { authorization: auth } : {},
  });
const deleteReq = (body: unknown, auth?: string) =>
  new Request('http://localhost/api/waitlist-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { authorization: auth } : {}) },
    body: JSON.stringify(body),
  });

function stubPipeline(results: unknown[]) {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => results.map((result) => ({ result })),
  })));
}

describe('csvCell', () => {
  test('escapes the formula-leading characters', () => {
    for (const evil of ['=1+1', '+441234', '-2', '@SUM(A1)', '\tx', '\rx']) {
      expect(csvCell(evil).startsWith(`"'`)).toBe(true);
    }
  });
  test('doubles quotes and passes ordinary values through', () => {
    expect(csvCell('a"b')).toBe('"a""b"');
    expect(csvCell('name@example.com')).toBe('"name@example.com"');
    expect(csvCell(null)).toBe('""');
  });
});

describe('authorisation', () => {
  test('with no WAITLIST_EXPORT_TOKEN set, every request is refused', async () => {
    vi.stubEnv('WAITLIST_EXPORT_TOKEN', '');
    expect((await GET(exportReq('Bearer anything'))).status).toBe(401);
    expect((await DELETE_POST(deleteReq({ email: 'a@b.co' }, 'Bearer anything'))).status).toBe(401);
  });
  test('a wrong or missing token is 401', async () => {
    expect((await GET(exportReq())).status).toBe(401);
    expect((await GET(exportReq('Bearer wrong'))).status).toBe(401);
    expect((await GET(exportReq('Bearer secret-token!'))).status).toBe(401); // length mismatch path
  });
});

test('export renders sorted CSV with escaped cells', async () => {
  const entries = [
    'patient:b@example.com', JSON.stringify({ email: 'b@example.com', role: 'patient', source: 'hero', joinedAt: '2026-08-02T00:00:00.000Z' }),
    'gp:=evil@example.com', JSON.stringify({ email: '=evil@example.com', role: 'gp', source: 'recap-gp', joinedAt: '2026-08-01T00:00:00.000Z' }),
    'patient:broken@example.com', 'not-json',
  ];
  stubPipeline([entries]);
  const res = await GET(exportReq('Bearer secret-token'));
  expect(res.status).toBe(200);
  expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
  expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="dr-quick-waitlist.csv"');
  const lines = (await res.text()).split('\n');
  expect(lines[0]).toBe('email,role,source,joined_at');
  expect(lines[1]).toContain('"broken@example.com"'); // corrupt row falls back to field key, sorts first (empty joinedAt)
  expect(lines[2]).toContain(`"'=evil@example.com"`); // escaped, 08-01 before 08-02
  expect(lines[3]).toContain('"b@example.com"');
});

test('export without store config is 503; store failure is 502', async () => {
  vi.stubEnv('KV_REST_API_URL', '');
  vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
  expect((await GET(exportReq('Bearer secret-token'))).status).toBe(503);
  vi.stubEnv('KV_REST_API_URL', 'https://kv.example');
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })));
  expect((await GET(exportReq('Bearer secret-token'))).status).toBe(502);
});

test('delete removes the address from both role sets and the hash', async () => {
  stubPipeline([1, 0, 1]); // SREM patient=1, SREM gp=0, HDEL=1
  const res = await DELETE_POST(deleteReq({ email: ' A@B.CO ' }, 'Bearer secret-token'));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, removed: 2 });
  const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
  expect(body).toEqual([
    ['SREM', 'waitlist:patient', 'a@b.co'],
    ['SREM', 'waitlist:gp', 'a@b.co'],
    ['HDEL', 'waitlist:entries', 'patient:a@b.co', 'gp:a@b.co'],
  ]);
});

test('delete validates the email', async () => {
  stubPipeline([]);
  expect((await DELETE_POST(deleteReq({ email: 'not-an-email' }, 'Bearer secret-token'))).status).toBe(400);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/api-export-delete.test.ts` — Expected: FAIL (modules not found).

- [ ] **Step 3: Write `app/api/waitlist-export/route.ts`**

```ts
// GET /api/waitlist-export  ->  CSV of everyone on the list.
// Protected by a bearer token so the list is not public. Without
// WAITLIST_EXPORT_TOKEN set, the route refuses to serve anything at all.
import { timingSafeEqual } from 'node:crypto';
import { configured, pipeline } from '@/lib/waitlist-store';

export const runtime = 'nodejs';

export function authorised(request: Request): boolean {
  const expected = process.env.WAITLIST_EXPORT_TOKEN;
  if (!expected) return false;
  const given = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Quoting escapes the delimiter but does not stop a spreadsheet EVALUATING a cell
// that opens with =, +, - or @. The email pattern permits all of them, so prefix any
// such cell with an apostrophe before quoting.
export const csvCell = (value: unknown): string => {
  let cell = String(value == null ? '' : value);
  if (/^[=+\-@\t\r]/.test(cell)) cell = `'${cell}`;
  return `"${cell.replace(/"/g, '""')}"`;
};

type Row = { email: string; role: string; source: string; joinedAt: string };

export async function GET(request: Request) {
  const noStore = { 'Cache-Control': 'no-store' };
  if (!authorised(request)) {
    return Response.json({ ok: false, error: 'unauthorised' }, { status: 401, headers: noStore });
  }
  if (!configured()) {
    return Response.json({ ok: false, error: 'store_unavailable' }, { status: 503, headers: noStore });
  }

  try {
    const [entries] = (await pipeline([['HGETALL', 'waitlist:entries']])) as [string[]];

    // Upstash returns HGETALL as a flat [field, value, field, value, ...] array.
    const rows: Row[] = [];
    for (let i = 0; i < entries.length; i += 2) {
      try {
        rows.push(JSON.parse(entries[i + 1]));
      } catch {
        // Field keys are `role:email`; fall back to splitting on the first colon.
        const field = String(entries[i]);
        const cut = field.indexOf(':');
        rows.push({
          email: cut === -1 ? field : field.slice(cut + 1),
          role: cut === -1 ? '' : field.slice(0, cut),
          source: '',
          joinedAt: '',
        });
      }
    }
    rows.sort((a, b) => String(a.joinedAt).localeCompare(String(b.joinedAt)));

    const csv = [
      'email,role,source,joined_at',
      ...rows.map((r) => [r.email, r.role, r.source, r.joinedAt].map(csvCell).join(',')),
    ].join('\n');

    return new Response(csv, {
      status: 200,
      headers: {
        ...noStore,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="dr-quick-waitlist.csv"',
      },
    });
  } catch (err) {
    console.error('Waitlist export failed:', (err as Error).message);
    return Response.json({ ok: false, error: 'store_read_failed' }, { status: 502, headers: noStore });
  }
}
```

- [ ] **Step 4: Write `app/api/waitlist-delete/route.ts`**

```ts
// POST /api/waitlist-delete  { email }
// Executes an erasure request. The page promises "you can ask us to delete it sooner
// at any time"; without this route that promise could only be honoured by hand-editing
// the store. Protected by the same bearer token as the export, because self-serve
// deletion by email alone would let anyone remove anyone else's entry.
import { configured, pipeline } from '@/lib/waitlist-store';
import { authorised } from '@/app/api/waitlist-export/route';

export const runtime = 'nodejs';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ['patient', 'gp'];

const json = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request) {
  if (!authorised(request)) return json(401, { ok: false, error: 'unauthorised' });
  if (!configured()) return json(503, { ok: false, error: 'store_unavailable' });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const email = String(body.email || '').trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) {
    return json(400, { ok: false, error: 'invalid_email' });
  }

  try {
    const results = await pipeline([
      ...ROLES.map((role) => ['SREM', `waitlist:${role}`, email]),
      ['HDEL', 'waitlist:entries', ...ROLES.map((role) => `${role}:${email}`)],
    ]);
    const removed = results.reduce<number>((total, value) => total + Number(value || 0), 0);
    return json(200, { ok: true, removed });
  } catch (err) {
    console.error('Waitlist delete failed:', (err as Error).message);
    return json(502, { ok: false, error: 'store_write_failed' });
  }
}
```

Note: `authorised` is shared by importing it from the export route module — Next only treats HTTP-verb exports as handlers, so the extra named exports are inert.

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run tests/api-export-delete.test.ts` and `npm run typecheck` — Expected: PASS.

- [ ] **Step 6: Delete the old functions**

```bash
git rm api/_store.js api/waitlist.js api/waitlist-export.js api/waitlist-delete.js
```

- [ ] **Step 7: Commit**

```bash
git add app/api tests/api-export-delete.test.ts
git commit -m "feat(api): port export and erasure routes; retire the flat api/ functions"
```

---

### Task 6: Security headers to `next.config.ts`; retire `vercel.json`

The `vercel.json` headers move into `next.config.ts`. Three changes, all from the spec: the Google Fonts hosts leave the CSP (fonts are self-hosted by `next/font`); `X-Robots-Tag: noindex` re-points from `/preview/*` to `/patient`, `/doctor`, `/admin` (configured ahead of those routes existing); the assets cache rule survives because `public/` files are not immutable-cached by default. Dev mode appends `'unsafe-eval'` (HMR) and `ws:` (HMR socket) — production strings stay exact.

**Files:**
- Create: `tests/headers.test.ts`
- Modify: `next.config.ts` (replace the Task 1 stub)
- Delete: `vercel.json`
- Reference: `vercel.json` (whole file)

**Interfaces:**
- Produces: `next.config.ts` default export with an async `headers()`; the exported constant `PROD_CSP` for the test.

- [ ] **Step 1: Write the failing test**

```ts
import { test, expect } from 'vitest';
import nextConfig, { PROD_CSP } from '@/next.config';

test('the CSP is the vercel.json policy minus the Google Fonts hosts', () => {
  expect(PROD_CSP).toBe(
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
    "font-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'none'; " +
    "frame-ancestors 'none'; base-uri 'none'"
  );
  expect(PROD_CSP).not.toContain('googleapis');
  expect(PROD_CSP).not.toContain('gstatic');
});

test('every route carries the security header set', async () => {
  const rules = await nextConfig.headers!();
  const global = rules.find((r) => r.source === '/(.*)')!;
  const get = (key: string) => global.headers.find((h) => h.key === key)?.value;
  expect(get('X-Content-Type-Options')).toBe('nosniff');
  expect(get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  expect(get('X-Frame-Options')).toBe('DENY');
  expect(get('Permissions-Policy')).toBe('geolocation=(), microphone=(), camera=(), interest-cohort=()');
  expect(get('Strict-Transport-Security')).toBe('max-age=63072000; includeSubDomains; preload');
  expect(get('Content-Security-Policy')).toBe(PROD_CSP); // test env takes the prod branch
});

test('assets are immutable-cached and the dashboard prefixes are noindex', async () => {
  const rules = await nextConfig.headers!();
  const assets = rules.find((r) => r.source === '/assets/(.*)')!;
  expect(assets.headers).toContainEqual({ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' });
  for (const prefix of ['patient', 'doctor', 'admin']) {
    const rule = rules.find((r) => r.source === `/${prefix}/:path*`)!;
    expect(rule.headers).toContainEqual({ key: 'X-Robots-Tag', value: 'noindex, nofollow' });
  }
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/headers.test.ts` — Expected: FAIL (`PROD_CSP` not exported).

- [ ] **Step 3: Replace `next.config.ts`**

```ts
import type { NextConfig } from 'next';

const DEV = process.env.NODE_ENV === 'development';

// The vercel.json policy with the Google Fonts hosts removed: next/font
// self-hosts Archivo under /_next/static, so 'self' now covers fonts and the
// CSP gets tighter, not looser. 'unsafe-inline' in script-src stays — the
// pre-paint role script and Next's own bootstrap are inline scripts.
export const PROD_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
  "font-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'none'; " +
  "frame-ancestors 'none'; base-uri 'none'";

// Dev needs eval (HMR compilation) and a websocket (HMR transport). Neither
// ever ships: this branch is dead in a production build.
const DEV_CSP = PROD_CSP
  .replace("script-src 'self' 'unsafe-inline'", "script-src 'self' 'unsafe-inline' 'unsafe-eval'")
  .replace("connect-src 'self'", "connect-src 'self' ws:");

const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=(), interest-cohort=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Content-Security-Policy', value: DEV ? DEV_CSP : PROD_CSP },
];

// The dashboards (milestones 2–4) are a prototype and must never be indexed.
// Configured ahead of the routes existing so it cannot be forgotten.
const NOINDEX = { key: 'X-Robots-Tag', value: 'noindex, nofollow' };

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: '/(.*)', headers: SECURITY_HEADERS },
      {
        source: '/assets/(.*)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      { source: '/patient/:path*', headers: [NOINDEX] },
      { source: '/doctor/:path*', headers: [NOINDEX] },
      { source: '/admin/:path*', headers: [NOINDEX] },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 4: Run to verify pass, then delete `vercel.json`**

Run: `npx vitest run tests/headers.test.ts && npm run build` — Expected: PASS, build clean.

```bash
git rm vercel.json
```

- [ ] **Step 5: Commit**

```bash
git add next.config.ts tests/headers.test.ts
git commit -m "feat(deploy): move security headers into next.config.ts and tighten the CSP"
```

---

### Task 7: Landing authored CSS layer

The stateful half of the flat page's stylesheet — everything driven by pseudo-elements, JS-toggled classes, element states or media features, which utilities cannot express honestly. Ported from `index.html` with only the variable renames (`--white`→`--color-white`, `--r-control`→`--radius-control`, hex placeholder→`--color-placeholder`). Layout, spacing and type live as utilities in the component tasks; this file is behavior and state.

**Files:**
- Modify: `app/globals.css` (append one `@layer components` block)
- Reference: `index.html:128-235` and `236-380` (the source rules, in order)

**Interfaces:**
- Produces: the class contracts every markup task depends on: `.skip`, `.js [data-reveal]`/`.in`, `.ln`, `.art*`, `nav`/`.is-floating`, `.seg`, `.cta-*`, `.btn` (hover/active/disabled/`[aria-busy]`), `input[type="email"]` (hover/focus/`[aria-invalid]`), `.hp`, `.note`, `.status` (`.ok`/`.err` choreography), `.capture`/`.done`, `.urgent`, `.faq`, `.tel`, `.hero-img`/`.art` sizing, mode hiding, and the keyframes `settle, markIn, drawTick, drawBar, pending, artBreathe, artFloat, artBg`.

- [ ] **Step 1: Append the layer to `app/globals.css`**

Port the following blocks from `index.html` into one `@layer components { … }`, in this order, applying the variable renames and nothing else. Line references are to `index.html`:

| Source lines | Block | Notes |
|---|---|---|
| 117–123 | `.skip` (`.skip` + `.skip:focus`) | |
| 125–143 | reveal grammar: `.js [data-reveal]`, `.in`, `.ln`, reduced-motion override | comment ported too |
| 145–162 | illustration idle: `.art`/`.hero-img img` width rules, transform origins, `.art-live` animations, 3 keyframes | keep `.hero-img img { width:100% }` — CLAUDE.md documents why |
| 164–171 | `nav` sticky/transition, `nav.is-floating`, `#nav-sentinel`, `.cta-short { display:none }` | the flex layout of `.nav-inner`/`.logo` moves to utilities in Task 10 — do NOT port those two selectors |
| 173–202 | `.btn` full: base, hover, active, disabled, `[aria-busy]` bar + `pending` keyframes + reduced-motion drop | comments ported |
| 208–210 | `.hero-img` sizing block (`align-self`, `max-width: 460px`, `margin-left: auto`, explicit `width: 100%`) + its comment | kept authored, not utilities: the width pitfall is documented behavior |
| 212–216 | `.urgent` band | |
| 218–235 | forms: `form { max-width }`, `.row`, `input[type="email"]` + placeholder/hover/focus | placeholder colour becomes `var(--color-placeholder)` |
| 236 | `input[type="email"][aria-invalid="true"]` | |
| 238–239 | `.note`, `.hp` | |
| 241–252 | `.status` + icons + `.capture`/`.done` collapse | comments ported |
| 254–266 | status choreography: `settle`, `markIn`, `drawTick`, `drawBar` + per-mark rules | |
| 275–276 | `.tile p` colour only if kept semantic — SKIP; tiles are utilities (Task 11) | |
| 298–335 | `.faq` full block: details borders, summary styling incl. `::before`/`::after` plus-minus, hover states, `::details-content` open/close transition | the section padding/h2 margin move to utilities; everything selector-driven stays |
| 106–110 | `.tel` underline rules (all four, incl. `footer .tel`) | |
| 350–355 | mode hiding: `.js[data-role="patient"] [data-mode="gp"], .js[data-role="gp"] [data-mode="patient"] { display:none }` + comment | |
| 357–364 | `.seg` + `.seg a` states | |
| 366–368 | `.cta-g`/`.cta-p` swap rules — note these are keyed off bare `[data-role]`, without `.js`; port exactly | |
| 396–412 | responsive tweaks of authored components only, inside `@media (max-width: 560px)`: `.cta-long`/`.cta-short` swap, `.seg` padding, `.row { flex-direction: column }`, `.row .btn` padding, `.btn` padding | grid collapses are utility variants in the component tasks |
| 103 | `.status` tabular-nums is already inside the ported `.status` rule; `.price h2`/`.pay h2` get the `tabular-nums` utility in Task 11 | |

Also port, at the end of the layer:

```css
  /* Responsive adjustments of authored components (the grid collapses live as
     max-* variants on the components themselves). */
  @media (max-width: 900px) {
    .hero-img { max-width: 340px; margin-inline: auto; }
  }
  @media (max-width: 560px) {
    .hero-img { max-width: 220px; }
  }
```

- [ ] **Step 2: Verify against the source**

Run:
```bash
grep -c "@keyframes" app/globals.css        # expect 8
grep -n "details-content\|interpolate-size" app/globals.css   # both present
grep -n "translateY(108%)" app/globals.css  # the ln mask
grep -n 'data-role="gp"\] \.cta-p' app/globals.css  # cta swap without .js
npx vitest run tests/constraints.test.ts && npm run build
```
Expected: all greps hit; constraints and build green.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat(landing): port the stateful stylesheet as the authored CSS layer"
```

---

### Task 8: Reveal math and the `LandingBehavior` island

The flat page's whole behavior script (`index.html:764-943`, minus the form handler which becomes `WaitlistForm`) ports into one null-rendering client component doing the same DOM operations. This is deliberate and spec-blessed: the role switch and reveal grammar must work on server-rendered static markup before/without wider hydration, so they stay DOM-level rather than becoming React state.

**Files:**
- Create: `lib/reveal.ts`, `components/LandingBehavior.tsx`, `tests/reveal.test.ts`, `tests/landing-behavior.test.tsx`, `tests/helpers/io-stub.ts`
- Reference: `index.html:828-943`

**Interfaces:**
- Consumes: the DOM contract the markup tasks render: `[data-stagger]`, `[data-reveal]`, `[data-line]`, `[data-mode="patient"|"gp"]`, `[data-mode-link]`, `#nav-cta[data-focus]`, `#nav-sentinel`, `nav`, `.hero-img`, `h1[tabindex=-1]`.
- Produces: `staggerDelay(i: number): number`; `heroDelay(i: number): number`; `<LandingBehavior />` (client, renders `null`; mount once at the end of the page).

- [ ] **Step 1: Write the failing math tests**

```ts
import { test, expect } from 'vitest';
import { staggerDelay, heroDelay, REVEAL_STEP, REVEAL_CAP, HERO_STEP } from '@/lib/reveal';

test('the stagger steps 70ms and caps at 300ms', () => {
  expect(REVEAL_STEP).toBe(70);
  expect(REVEAL_CAP).toBe(300);
  expect(staggerDelay(0)).toBe(0);
  expect(staggerDelay(4)).toBe(280);
  expect(staggerDelay(5)).toBe(300);
  expect(staggerDelay(50)).toBe(300);
});

test('the hero arrives at 90ms per element, uncapped', () => {
  expect(HERO_STEP).toBe(90);
  expect(heroDelay(0)).toBe(0);
  expect(heroDelay(3)).toBe(270);
});
```

Run: `npx vitest run tests/reveal.test.ts` — Expected: FAIL. Then write `lib/reveal.ts`:

```ts
// The Capped Stagger Rule (DESIGN.md): siblings arrive 70ms apart, but the
// total delay is capped so a long list never turns into a queue. The hero's
// load-time elements pace at 90ms and are few enough to need no cap.
export const REVEAL_STEP = 70;
export const REVEAL_CAP = 300;
export const HERO_STEP = 90;

export const staggerDelay = (i: number): number => Math.min(i * REVEAL_STEP, REVEAL_CAP);
export const heroDelay = (i: number): number => i * HERO_STEP;
```

Run again — Expected: PASS.

- [ ] **Step 2: Write `tests/helpers/io-stub.ts`**

```ts
import { vi } from 'vitest';

// jsdom has no IntersectionObserver. This stub records instances and lets a
// test fire entries by hand.
export class IOStub {
  static instances: IOStub[] = [];
  observed: Element[] = [];
  constructor(
    public cb: IntersectionObserverCallback,
    public opts?: IntersectionObserverInit,
  ) {
    IOStub.instances.push(this);
  }
  observe(el: Element) { this.observed.push(el); }
  unobserve(el: Element) { this.observed = this.observed.filter((e) => e !== el); }
  disconnect() { this.observed = []; }
  trigger(entries: Array<{ target: Element; isIntersecting: boolean }>) {
    this.cb(entries as IntersectionObserverEntry[], this as unknown as IntersectionObserver);
  }
}

export function installIOStub() {
  IOStub.instances = [];
  vi.stubGlobal('IntersectionObserver', IOStub);
}
```

- [ ] **Step 3: Write the failing behavior test**

```tsx
// @vitest-environment jsdom
import { test, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { LandingBehavior } from '@/components/LandingBehavior';
import { IOStub, installIOStub } from './helpers/io-stub';

function fixture() {
  return (
    <>
      <span id="nav-sentinel" aria-hidden="true" />
      <nav>
        <a href="?role=patient" data-mode-link="patient">Patients</a>
        <a href="?role=gp" data-mode-link="gp">GPs</a>
        <a id="nav-cta" href="#join" data-focus="join">Join</a>
      </nav>
      <div className="mode" data-mode="patient">
        <h1 tabIndex={-1}>See a GP</h1>
        <div data-stagger>
          <div data-reveal />
          <div data-reveal />
          <div data-reveal />
          <div data-reveal />
          <div data-reveal />
          <div data-reveal />
        </div>
        <div className="hero-img" data-reveal="load" />
        <input id="join" />
      </div>
      <div className="mode" data-mode="gp">
        <h1 tabIndex={-1}>Consult</h1>
        <input id="gp-join" />
      </div>
      <LandingBehavior />
    </>
  );
}

beforeEach(() => {
  cleanup();
  vi.useRealTimers();
  installIOStub();
  vi.stubGlobal('scrollTo', vi.fn());
  document.documentElement.className = 'js';
  document.documentElement.setAttribute('data-role', 'patient');
  window.history.replaceState(null, '', '/');
});

test('mount reveals only the active mode and stamps the capped stagger', async () => {
  vi.useFakeTimers();
  const { container } = render(fixture());
  const patient = container.querySelector('[data-mode="patient"]') as HTMLElement;
  const gp = container.querySelector('[data-mode="gp"]') as HTMLElement;
  expect(patient.dataset.revealed).toBe('true');
  expect(gp.dataset.revealed).toBeUndefined();
  const staggered = [...patient.querySelectorAll('[data-stagger] [data-reveal]')] as HTMLElement[];
  expect(staggered[0].style.getPropertyValue('--d')).toBe('0ms');
  expect(staggered[4].style.getPropertyValue('--d')).toBe('280ms');
  expect(staggered[5].style.getPropertyValue('--d')).toBe('300ms');
  vi.advanceTimersByTime(80); // the 60ms release timer
  expect((patient.querySelector('[data-reveal="load"]') as HTMLElement).classList.contains('in')).toBe(true);
  expect(patient.querySelector('[data-mode-link]')).toBeNull(); // sanity: links live in nav
  expect(document.querySelector('[data-mode-link="patient"]')!.getAttribute('aria-current')).toBe('page');
});

test('switching to GP swaps role, CTA, URL and focus', () => {
  const { container } = render(fixture());
  const gpLink = document.querySelector('[data-mode-link="gp"]') as HTMLElement;
  fireEvent.click(gpLink);
  expect(document.documentElement.getAttribute('data-role')).toBe('gp');
  expect(gpLink.getAttribute('aria-current')).toBe('page');
  expect(document.querySelector('[data-mode-link="patient"]')!.hasAttribute('aria-current')).toBe(false);
  const cta = document.getElementById('nav-cta') as HTMLAnchorElement;
  expect(cta.getAttribute('href')).toBe('#gp-join');
  expect(cta.dataset.focus).toBe('gp-join');
  expect(window.location.search).toBe('?role=gp');
  expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  const gp = container.querySelector('[data-mode="gp"]') as HTMLElement;
  expect(gp.dataset.revealed).toBe('true');
  expect(document.activeElement).toBe(gp.querySelector('h1'));
  // Switching back to patient strips the query again.
  fireEvent.click(document.querySelector('[data-mode-link="patient"]') as HTMLElement);
  expect(window.location.search).toBe('');
});

test('the nav floats only once the sentinel has scrolled away', () => {
  render(fixture());
  const nav = document.querySelector('nav') as HTMLElement;
  const sentinel = document.getElementById('nav-sentinel') as HTMLElement;
  const navIo = IOStub.instances.find((io) => io.observed.includes(sentinel))!;
  navIo.trigger([{ target: sentinel, isIntersecting: false }]);
  expect(nav.classList.contains('is-floating')).toBe(true);
  navIo.trigger([{ target: sentinel, isIntersecting: true }]);
  expect(nav.classList.contains('is-floating')).toBe(false);
});

test('the idle loop runs only while the illustration is on screen', () => {
  render(fixture());
  const art = document.querySelector('.hero-img') as HTMLElement;
  const artIo = IOStub.instances.find((io) => io.observed.includes(art))!;
  artIo.trigger([{ target: art, isIntersecting: true }]);
  expect(art.classList.contains('art-live')).toBe(true);
  artIo.trigger([{ target: art, isIntersecting: false }]);
  expect(art.classList.contains('art-live')).toBe(false);
});

test('the nav CTA moves the caret to the active form', () => {
  vi.useFakeTimers();
  render(fixture());
  const cta = document.getElementById('nav-cta') as HTMLElement;
  fireEvent.click(cta);
  vi.advanceTimersByTime(330);
  expect(document.activeElement).toBe(document.getElementById('join'));
});
```

Run: `npx vitest run tests/landing-behavior.test.tsx` — Expected: FAIL (component missing).

- [ ] **Step 4: Write `components/LandingBehavior.tsx`**

A one-effect port of `index.html:828-943`. Every listener, observer and timer registers a cleanup so React StrictMode's dev double-mount cannot double-bind (the `data-revealed` guard already makes re-runs idempotent).

```tsx
'use client';

import { useEffect } from 'react';
import { staggerDelay, heroDelay } from '@/lib/reveal';

export function LandingBehavior() {
  useEffect(() => {
    const cleanups: Array<() => void> = [];
    const on = (target: EventTarget, type: string, fn: EventListener) => {
      target.addEventListener(type, fn);
      cleanups.push(() => target.removeEventListener(type, fn));
    };
    const timer = (fn: () => void, ms: number) => {
      const id = window.setTimeout(fn, ms);
      cleanups.push(() => window.clearTimeout(id));
    };

    // ---- Reveal grammar -------------------------------------------------
    // Siblings inside a [data-stagger] group arrive in sequence, with the total
    // delay capped so a long list never turns into a queue. A mode is revealed
    // the first time it is shown, which is page load for one of them and the
    // first switch for the other.
    document.querySelectorAll('[data-stagger]').forEach((group) => {
      group.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el, i) => {
        el.style.setProperty('--d', `${staggerDelay(i)}ms`);
      });
    });

    const show = (el: Element) => el.classList.add('in');

    const io = 'IntersectionObserver' in window
      ? new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            show(entry.target);
            io!.unobserve(entry.target); // reveal once; never replay on scroll-back
          });
        }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' })
      : null;
    if (io) cleanups.push(() => io.disconnect());

    const revealMode = (scope: HTMLElement | null) => {
      if (!scope || scope.dataset.revealed) return;
      scope.dataset.revealed = 'true';

      // This mode's hero arrives on load rather than on scroll: it is already in view.
      const hero = scope.querySelectorAll<HTMLElement>('[data-reveal="load"], [data-line]');
      hero.forEach((el, i) => el.style.setProperty('--d', `${heroDelay(i)}ms`));
      // One painted frame at the start state, then release. A timer rather than
      // nested rAF so the reveal cannot stall in a background or throttled tab.
      timer(() => hero.forEach(show), 60);

      const rest = scope.querySelectorAll('[data-reveal]:not([data-reveal="load"])');
      if (!io) { rest.forEach(show); return; }
      rest.forEach((el) => io.observe(el));
    };

    // ---- Patient / GP modes ---------------------------------------------
    // Both modes are real URLs, so a link mailed to a GP opens the GP page and a
    // blocked script still renders both. The click is intercepted only to swap in
    // place, which keeps the reveal grammar and the reader's place in the tab.
    const root = document.documentElement;
    const panel: Record<'patient' | 'gp', HTMLElement | null> = {
      patient: document.querySelector('[data-mode="patient"]'),
      gp: document.querySelector('[data-mode="gp"]'),
    };
    const links = document.querySelectorAll<HTMLAnchorElement>('[data-mode-link]');
    const cta = document.getElementById('nav-cta');
    const ACTION = { patient: '#join', gp: '#gp-join' } as const;

    const setMode = (role: 'patient' | 'gp', switched: boolean) => {
      root.setAttribute('data-role', role);
      links.forEach((a) => {
        if (a.dataset.modeLink === role) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
      if (cta) { cta.setAttribute('href', ACTION[role]); cta.dataset.focus = ACTION[role].slice(1); }
      revealMode(panel[role]);
      if (!switched) return;
      // The whole page changed underneath the reader, so start them at its top
      // and put focus on the new headline rather than leaving it on the switch.
      try { history.replaceState(null, '', role === 'gp' ? '?role=gp' : location.pathname); } catch {}
      window.scrollTo(0, 0);
      const h1 = panel[role]?.querySelector<HTMLElement>('h1');
      if (h1) h1.focus({ preventScroll: true });
    };

    links.forEach((a) => on(a, 'click', (e) => {
      e.preventDefault();
      setMode(a.dataset.modeLink as 'patient' | 'gp', true);
    }));

    setMode(root.getAttribute('data-role') === 'gp' ? 'gp' : 'patient', false);

    // The illustration idles only while it is on screen; a decorative loop must not
    // burn battery behind the fold, least of all for someone reading this while ill.
    const art = document.querySelector('.hero-img');
    if (art) {
      if (!('IntersectionObserver' in window)) {
        art.classList.add('art-live');
      } else {
        const artIo = new IntersectionObserver(
          ([e]) => art.classList.toggle('art-live', e.isIntersecting),
          { threshold: 0 },
        );
        artIo.observe(art);
        cleanups.push(() => artIo.disconnect());
      }
    }

    // The bar only earns a hard edge once it is actually floating over content.
    const sentinel = document.getElementById('nav-sentinel');
    const nav = document.querySelector('nav');
    if (sentinel && nav && 'IntersectionObserver' in window) {
      const navIo = new IntersectionObserver(
        ([entry]) => nav.classList.toggle('is-floating', !entry.isIntersecting),
      );
      navIo.observe(sentinel);
      cleanups.push(() => navIo.disconnect());
    }

    // The nav CTA jumps to the active mode's form; put the caret where the action is.
    if (cta) on(cta, 'click', () => {
      const el = document.getElementById(cta.dataset.focus ?? '');
      if (el) timer(() => el.focus({ preventScroll: true }), 320);
    });

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return null;
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run tests/reveal.test.ts tests/landing-behavior.test.tsx` and `npm run typecheck` — Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/reveal.ts components/LandingBehavior.tsx tests/reveal.test.ts tests/landing-behavior.test.tsx tests/helpers/io-stub.ts
git commit -m "feat(landing): port the page behavior script as a null-rendering client island"
```

---

### Task 9: Icon sprite and `WaitlistForm`

One component renders all four forms. The fetch contract, honeypot, validation copy, distinct ok/err states, focus management and the `.done` collapse are ports; the one React-specific piece is the animation replay, which keeps the flat page's reflow trick so the status element never loses its live-region identity.

**Files:**
- Create: `components/IconDefs.tsx`, `components/WaitlistForm.tsx`, `tests/waitlist-form.test.tsx`
- Reference: `index.html:430-433` (sprite), `459-472` (form markup), `765-827` (handler)

**Interfaces:**
- Consumes: `.btn`, `.row`, `.capture`, `.status`, `.hp`, `.note` from Task 7's layer.
- Produces: `<IconDefs />` (the `#i-yes`/`#i-no` symbol sprite; mounted once per page); `<WaitlistForm role source cta inputId reveal? />` with `role: 'patient' | 'gp'`, `source: 'hero' | 'recap' | 'hero-gp' | 'recap-gp'`, `cta: string`, `inputId: string`, `reveal?: 'load' | ''`. The status element id is always `` `${inputId}-status` ``.

- [ ] **Step 1: Write `components/IconDefs.tsx`**

```tsx
export function IconDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <symbol id="i-yes" viewBox="0 0 20 20">
        <path d="M4 10.6l4 4L16 5.6" stroke="currentColor" strokeWidth="2.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </symbol>
      <symbol id="i-no" viewBox="0 0 20 20">
        <path d="M4.6 10h10.8" stroke="currentColor" strokeWidth="2.3" fill="none" strokeLinecap="round" />
      </symbol>
    </svg>
  );
}
```

- [ ] **Step 2: Write the failing form tests**

```tsx
// @vitest-environment jsdom
import { test, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { WaitlistForm } from '@/components/WaitlistForm';

beforeEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const jsonRes = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

function renderPatient() {
  return render(<WaitlistForm role="patient" source="hero" cta="Join the waitlist" inputId="join" reveal="load" />);
}

test('an invalid email is stopped client-side with the exact copy', async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  renderPatient();
  const input = screen.getByLabelText('Email address');
  await userEvent.type(input, 'not-an-email');
  fireEvent.submit(input.closest('form')!);
  expect(await screen.findByText('Enter a valid email address, like name@example.com.')).toBeInTheDocument();
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input).toHaveFocus();
  expect(fetchMock).not.toHaveBeenCalled();
});

test('success posts the contract, thanks the patient, collapses the capture and moves focus', async () => {
  const fetchMock = vi.fn(async () => jsonRes(200, { ok: true, alreadyJoined: false }));
  vi.stubGlobal('fetch', fetchMock);
  const { container } = renderPatient();
  const form = container.querySelector('form')!;
  const hp = container.querySelector('.hp') as HTMLInputElement;
  fireEvent.change(hp, { target: { value: '' } });
  await userEvent.type(screen.getByLabelText('Email address'), 'name@example.com');
  fireEvent.submit(form);
  expect(await screen.findByText("You're on the list. We'll email you the day Dr Quick opens.")).toBeInTheDocument();
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/waitlist');
  expect(JSON.parse(init!.body as string)).toEqual({
    email: 'name@example.com', role: 'patient', source: 'hero', company: '',
  });
  expect(form).toHaveClass('done');
  const status = container.querySelector('.status')!;
  await waitFor(() => expect(status).toHaveFocus());
  expect(status).toHaveClass('ok');
});

test('the honeypot value travels with the payload', async () => {
  const fetchMock = vi.fn(async () => jsonRes(200, { ok: true, alreadyJoined: false }));
  vi.stubGlobal('fetch', fetchMock);
  const { container } = renderPatient();
  fireEvent.change(container.querySelector('.hp')!, { target: { value: 'bot text' } });
  await userEvent.type(screen.getByLabelText('Email address'), 'name@example.com');
  fireEvent.submit(container.querySelector('form')!);
  await screen.findByText(/on the list/);
  expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string).company).toBe('bot text');
});

test('alreadyJoined and the GP variants use their own copy, and busy label differs by role', async () => {
  let release!: (r: Response) => void;
  const gate = new Promise<Response>((res) => { release = res; });
  vi.stubGlobal('fetch', vi.fn(() => gate));
  render(<WaitlistForm role="gp" source="hero-gp" cta="Register interest" inputId="gp-join" />);
  await userEvent.type(screen.getByLabelText('Email address'), 'gp@example.com');
  fireEvent.submit(screen.getByLabelText('Email address').closest('form')!);
  const button = screen.getByRole('button');
  expect(button).toBeDisabled();
  expect(button).toHaveAttribute('aria-busy', 'true');
  expect(button).toHaveTextContent('Registering…');
  release(jsonRes(200, { ok: true, alreadyJoined: true }));
  expect(await screen.findByText("You're already on the list. We'll be in touch.")).toBeInTheDocument();
});

test('429 and network failure re-enable the form with their exact copy', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => jsonRes(429, { ok: false })));
  const { container } = renderPatient();
  const input = screen.getByLabelText('Email address');
  await userEvent.type(input, 'name@example.com');
  fireEvent.submit(container.querySelector('form')!);
  expect(await screen.findByText('That is a few too many tries. Give it a couple of minutes.')).toBeInTheDocument();
  expect(screen.getByRole('button')).toBeEnabled();
  expect(input).toHaveAttribute('aria-invalid', 'true');

  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down'); }));
  fireEvent.submit(container.querySelector('form')!);
  expect(await screen.findByText("Couldn't reach the server — try again in a moment.")).toBeInTheDocument();
  expect(container.querySelector('.status')).toHaveClass('err');
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run tests/waitlist-form.test.tsx` — Expected: FAIL (component missing).

- [ ] **Step 4: Write `components/WaitlistForm.tsx`**

```tsx
'use client';

import { useRef, useState } from 'react';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Status = { kind: 'ok' | 'err'; message: string } | null;

export function WaitlistForm({ role, source, cta, inputId, reveal }: {
  role: 'patient' | 'gp';
  source: 'hero' | 'recap' | 'hero-gp' | 'recap-gp';
  cta: string;
  inputId: string;
  reveal?: 'load' | '';
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hpRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [invalid, setInvalid] = useState(false);

  const busyLabel = role === 'gp' ? 'Registering…' : 'Joining…';

  // The status element keeps one identity across messages so the live region
  // announces text changes. The entry animation replays the way the flat page
  // did it: drop the state class, force a reflow, put it back. React never
  // writes these two classes — className stays the constant "status" — so the
  // imperative toggles and the declarative render cannot fight.
  const say = (next: Status) => {
    const el = statusRef.current;
    if (el) {
      el.classList.remove('ok', 'err');
      if (next) {
        void el.offsetWidth;
        el.classList.add(next.kind);
      }
    }
    setStatus(next);
  };

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = inputRef.current;
    if (!input) return;
    const email = input.value.trim();
    say(null);
    setInvalid(false);
    const trap = hpRef.current?.value ?? '';
    if (!EMAIL.test(email)) {
      say({ kind: 'err', message: 'Enter a valid email address, like name@example.com.' });
      setInvalid(true);
      input.focus();
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role, source, company: trap }),
      });
      if (res.status === 429) {
        say({ kind: 'err', message: 'That is a few too many tries. Give it a couple of minutes.' });
        setInvalid(true);
        setBusy(false);
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json().catch(() => ({}))) as { alreadyJoined?: boolean };
      const joined = role === 'gp'
        ? "You're on the list. We'll be in touch before we open."
        : "You're on the list. We'll email you the day Dr Quick opens.";
      say({ kind: 'ok', message: data.alreadyJoined ? "You're already on the list. We'll be in touch." : joined });
      statusRef.current?.focus();
      setDone(true); // the button stays disabled inside the collapsing capture, as on the flat page
    } catch {
      say({ kind: 'err', message: "Couldn't reach the server — try again in a moment." });
      setInvalid(true);
      setBusy(false);
    }
  }

  return (
    <form
      data-role={role}
      data-source={source}
      data-reveal={reveal}
      noValidate
      className={done ? 'done' : undefined}
      onSubmit={onSubmit}
    >
      <div className="capture"><div><div className="row">
        <input
          ref={inputRef}
          id={inputId}
          type="email"
          name="email"
          placeholder="Enter your email"
          aria-label="Email address"
          aria-describedby={`${inputId}-status`}
          autoComplete="email"
          required
          aria-invalid={invalid || undefined}
        />
        <input ref={hpRef} className="hp" type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <button className="btn" type="submit" disabled={busy} aria-busy={busy || undefined}>
          {busy ? busyLabel : cta}
        </button>
      </div></div></div>
      <p ref={statusRef} className="status" id={`${inputId}-status`} role="status" aria-live="polite" tabIndex={-1}>
        <svg className="i-ok" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <rect width="16" height="16" rx="4.5" fill="currentColor" />
          <path d="M4.2 8.4l2.6 2.6L11.8 5.8" stroke="#FFF" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
        <svg className="i-err" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <rect width="16" height="16" rx="4.5" fill="currentColor" />
          <path d="M8 4.2v4.4" stroke="#FFF" strokeWidth="2.1" strokeLinecap="round" />
          <circle cx="8" cy="11.6" r="1.15" fill="#FFF" />
        </svg>
        <span className="status-text">{status?.message ?? ''}</span>
      </p>
      <div className="capture"><div><p className="note">Launch updates only. Unsubscribe anytime.</p></div></div>
    </form>
  );
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run tests/waitlist-form.test.tsx tests/constraints.test.ts` — Expected: PASS (`#FFF` is in the allowed set).

- [ ] **Step 6: Commit**

```bash
git add components/IconDefs.tsx components/WaitlistForm.tsx tests/waitlist-form.test.tsx
git commit -m "feat(landing): waitlist form component with the flat page's exact contract"
```

---

### Task 10: Assets, hero skeleton, inlined illustration, nav, 999 band

**Files:**
- Create: `public/assets/` (4 files), `components/HeroArt.tsx`, `components/Hero.tsx`, `components/Nav.tsx`, `components/UrgentBand.tsx`, `tests/hero.test.tsx`
- Reference: `index.html:438-450` (nav), `454-477` (patient hero), `479-485` (urgent band), `611-634` (GP hero)

**Interfaces:**
- Consumes: `WaitlistForm`, Task 7 classes.
- Produces: `<Nav />` (server markup; behavior comes from `LandingBehavior`); `<Hero headerId? h1Id? lines={[string,string]} sub form={{role,source,cta,inputId}} art={ReactNode} />`; `<HeroArt />` (patient art, inlined SVG); `<UrgentBand />`. `public/assets/{doctors-bro.svg,phone-illustration.svg,favicon.svg,og.png}` served at `/assets/*`.

- [ ] **Step 1: Populate `public/assets/`**

The inline hero SVG in `index.html` is today's truth (CLAUDE.md: the asset file is re-inlined after edits), so extract it rather than trusting the asset file to be current:

```bash
mkdir -p public/assets
python3 - <<'PY'
import re
html = open('index.html', encoding='utf-8').read()
m = re.search(r'<svg class="art".*?</svg>', html, re.S)
assert m, 'inline hero SVG not found'
open('public/assets/doctors-bro.svg', 'w', encoding='utf-8').write(m.group(0))
PY
cp assets/phone-illustration.svg assets/favicon.svg assets/og.png public/assets/
grep -c 'art-c1\|art-c2\|art-c3\|art-bg\|art-icons' public/assets/doctors-bro.svg  # expect ≥5
grep -o '#[0-9A-Fa-f]\{3,6\}' public/assets/doctors-bro.svg | sort -u              # eyeball: brand palette only
```

`assets/` stays in place untouched — the old `index.html` must remain renderable for the milestone-end comparison; both are deleted in milestone 4.

- [ ] **Step 2: Write `components/HeroArt.tsx`**

The SVG is 30KB of generated paths; hand-converting its attributes to JSX would be pure transcription risk. It is inlined at build time from the asset file — same result as the flat page's inline art, still pausable off-screen, and the asset file stays the single source of truth.

```tsx
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Read once at module scope: this is a server component, evaluated at build.
const ART = readFileSync(join(process.cwd(), 'public/assets/doctors-bro.svg'), 'utf8');

export function HeroArt() {
  return <div className="hero-img" data-reveal="load" dangerouslySetInnerHTML={{ __html: ART }} />;
}
```

- [ ] **Step 3: Write `components/Nav.tsx`, `components/Hero.tsx`, `components/UrgentBand.tsx`**

```tsx
// components/Nav.tsx — server markup; LandingBehavior wires the floating edge,
// the mode links and the CTA focus at runtime.
export function Nav() {
  return (
    <nav className="sticky top-0 z-10 border-b border-rule bg-white">
      <div className="wrap flex items-center gap-8 h-19 max-phone:gap-3.5 max-phone:h-16">
        <a className="logo text-2xl max-phone:text-[1.375rem] font-extrabold tracking-[-.04em] no-underline mr-auto" href="#">
          Dr<span className="text-blue">Quick</span>
        </a>
        <div className="seg" role="group" aria-label="Choose what you are here for">
          <a href="?role=patient" data-mode-link="patient" aria-current="page">Patients</a>
          <a href="?role=gp" data-mode-link="gp">GPs</a>
        </div>
        <a className="btn" id="nav-cta" href="#join" data-focus="join">
          <span className="cta-p"><span className="cta-long">Join the waitlist</span><span className="cta-short">Join</span></span>
          <span className="cta-g"><span className="cta-long">Register interest</span><span className="cta-short">Register</span></span>
        </a>
      </div>
    </nav>
  );
}
```

(The `nav` element's border-color transition and `.is-floating` state are in the authored layer; `.logo`'s letter-spacing sits exactly at the `-0.04em` display floor.)

```tsx
// components/Hero.tsx — one skeleton for both modes. The symmetry is what makes
// the equal-billing decision read visually (CLAUDE.md); do not fork the shape.
import { WaitlistForm } from '@/components/WaitlistForm';

export function Hero({ headerId, lines, sub, form, art }: {
  headerId?: string;
  lines: [string, string];
  sub: string;
  form: { role: 'patient' | 'gp'; source: 'hero' | 'hero-gp'; cta: string; inputId: string };
  art: React.ReactNode;
}) {
  return (
    <header className="hero pt-hero-t pb-hero-b" id={headerId}>
      <div className="wrap grid grid-cols-[1.15fr_.85fr] gap-hero-gap items-start max-cols:grid-cols-1 max-cols:gap-10">
        <div>
          <h1 tabIndex={-1}>
            <span className="ln" data-line><span>{lines[0]}</span></span>
            <span className="ln" data-line><span>{lines[1]}</span></span>
          </h1>
          <p className="sub text-lead text-ink-2 max-w-[40ch] mt-5 mb-9" data-reveal="load">{sub}</p>
          <WaitlistForm role={form.role} source={form.source} cta={form.cta} inputId={form.inputId} reveal="load" />
        </div>
        {art}
      </div>
    </header>
  );
}
```

```tsx
// components/UrgentBand.tsx — patient-flow content, patient mode only. The copy
// and the live tel: link are compliance requirements; port verbatim.
export function UrgentBand() {
  return (
    <aside className="urgent" data-reveal>
      <div className="wrap">
        <p>
          <span>
            Dr Quick is for urgent but non-emergency care. If something is serious or life-threatening,{' '}
            <b><a className="tel" href="tel:999">call 999</a> or go to A&amp;E.</b>
          </span>
        </p>
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Write the failing structure tests**

```tsx
// @vitest-environment jsdom
import { test, expect } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Hero } from '@/components/Hero';
import { HeroArt } from '@/components/HeroArt';
import { Nav } from '@/components/Nav';
import { UrgentBand } from '@/components/UrgentBand';

test('the hero skeleton is identical for both modes: masked lines, sub, form, art slot', () => {
  const { container } = render(
    <Hero lines={['See a GP', 'in minutes.']} sub="sub copy"
      form={{ role: 'patient', source: 'hero', cta: 'Join the waitlist', inputId: 'join' }}
      art={<div className="hero-img" data-reveal="load" />} />,
  );
  const h1 = container.querySelector('h1')!;
  expect(h1).toHaveAttribute('tabindex', '-1');
  expect(h1.querySelectorAll('.ln[data-line] > span')).toHaveLength(2);
  expect(container.querySelector('form[data-source="hero"] input[type="email"]')).toBeInTheDocument();
  expect(container.querySelector('.hero-img')).toBeInTheDocument();
});

test('the inlined art carries the idle-loop groups and the brand palette only', () => {
  const { container } = render(<HeroArt />);
  const art = container.querySelector('.hero-img')!;
  expect(art.querySelector('svg')).toBeInTheDocument();
  for (const cls of ['art-bg', 'art-icons', 'art-c1', 'art-c2', 'art-c3']) {
    expect(art.querySelector(`.${cls}`), `missing .${cls}`).toBeTruthy();
  }
});

test('the nav carries the switch, both CTA labels and the sentinel contract', () => {
  const { container } = render(<Nav />);
  expect(container.querySelector('[data-mode-link="patient"]')).toHaveAttribute('aria-current', 'page');
  expect(container.querySelector('#nav-cta')).toHaveAttribute('href', '#join');
  expect(container.querySelector('.cta-p .cta-long')).toHaveTextContent('Join the waitlist');
  expect(container.querySelector('.cta-g .cta-long')).toHaveTextContent('Register interest');
});

test('the urgent band keeps 999 as a real tel: link at body size', () => {
  const { container } = render(<UrgentBand />);
  const tel = container.querySelector('a.tel')!;
  expect(tel).toHaveAttribute('href', 'tel:999');
  expect(tel).toHaveTextContent('call 999');
});
```

Note on `HeroArt` classes: if `art-c1/c2/c3` are absent it means the inline SVG groups them differently — re-check the extraction in Step 1 against `index.html` (the groups exist; the idle CSS targets them), don't weaken the test.

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run tests/hero.test.tsx tests/constraints.test.ts && npm run typecheck` — Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add public/assets components/HeroArt.tsx components/Hero.tsx components/Nav.tsx components/UrgentBand.tsx tests/hero.test.tsx
git commit -m "feat(landing): shared hero skeleton, inlined idle art, nav and 999 band"
```

---

### Task 11: Steps bento, covers columns, price bands

**Files:**
- Create: `components/Steps.tsx`, `components/Covers.tsx`, `components/PriceBand.tsx`, `app/landing-content.tsx` (started: steps + covers arrays), `tests/sections.test.tsx`
- Reference: `index.html:488-506` (patient steps), `508-534` (patient covers), `536-541` (price), `636-654` (GP steps), `656-682` (GP covers), `684-689` (GP pay)

**Interfaces:**
- Consumes: `#i-yes`/`#i-no` from `IconDefs`; theme utilities.
- Produces: `<Steps headingId title tiles={[Tile,Tile,Tile]} />` with `Tile = { title: string; body: string }`; `<Covers headingId title cols={[CoversCol, CoversCol]} />` with `CoversCol = { title: string; tone: 'yes' | 'no'; items: string[] }`; `<PriceBand variant={'price'|'pay'} headingId headline={ReactNode} fine={string} />`; content arrays `PATIENT_STEPS`, `GP_STEPS`, `PATIENT_COVERS`, `GP_COVERS` in `app/landing-content.tsx`.

- [ ] **Step 1: Start `app/landing-content.tsx`**

Transcribe the copy **verbatim** from the referenced lines (use the real characters — `’ — –` — where the HTML uses entities). Example shape, with the first entries shown exactly; complete all four arrays from the source lines:

```tsx
export type Tile = { title: string; body: string };
export type CoversCol = { title: string; tone: 'yes' | 'no'; items: string[] };

export const PATIENT_STEPS: [Tile, Tile, Tile] = [
  { title: 'Tell us what’s wrong.', body: 'A two-minute form in plain English, so the GP already knows why you’re calling.' },
  { title: 'Get matched.', body: 'You’re handed to the next available GP instead of picking a time slot.' },
  { title: 'Talk by video.', body: 'A secure video consultation, with a prescription, fit note or referral afterwards if you need one.' },
];

export const PATIENT_COVERS: [CoversCol, CoversCol] = [
  { title: 'It covers', tone: 'yes', items: [
    'A GMC-registered GP assessing new or worsening symptoms.',
    // …the remaining four, from index.html:512-520
  ] },
  { title: 'It doesn’t', tone: 'no', items: [
    'Emergencies — call 999 or go to A&E.',
    // …the remaining four, from index.html:522-530
  ] },
];

// GP_STEPS from index.html:639-652, GP_COVERS from index.html:659-681.
```

- [ ] **Step 2: Write the three components**

```tsx
// components/Steps.tsx — the bento. Tiles must vary in span, fill and layout;
// three identical cards is a failure (CLAUDE.md). The black fill belongs to
// step three, the payoff, which stays third in the sequence.
import type { Tile } from '@/app/landing-content';

export function Steps({ headingId, title, tiles }: {
  headingId: string; title: string; tiles: [Tile, Tile, Tile];
}) {
  const [a, b, c] = tiles;
  return (
    <section className="steps py-section" aria-labelledby={headingId}>
      <div className="wrap">
        <h2 id={headingId} data-reveal className="mb-heading max-w-[18ch]">{title}</h2>
        <div className="bento grid grid-cols-6 gap-4 max-cols:grid-cols-2" data-stagger>
          {[a, b].map((tile) => (
            <div key={tile.title} data-reveal
              className="tile border border-tile-edge rounded-tile p-7 col-span-3 max-cols:col-span-1 max-phone:col-span-2">
              <h3>{tile.title}</h3>
              <p className="text-base text-ink-2 mt-2.5">{tile.body}</p>
            </div>
          ))}
          <div data-reveal
            className="tile border border-black rounded-tile bg-black text-white col-span-6 max-cols:col-span-2 p-tile-lead-pad grid grid-cols-[1fr_1.35fr] gap-x-12 gap-y-3 max-cols:grid-cols-1 max-cols:gap-3 items-start">
            <h3 className="text-title-lead tracking-[-.03em]">{c.title}</h3>
            <p className="text-[1.0625rem] text-ink-2-dark mt-0">{c.body}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
```

```tsx
// components/Covers.tsx — the does/doesn't columns. Subgrid keeps the row
// hairlines level across both columns, exactly as the flat page's CSS did.
import type { CoversCol } from '@/app/landing-content';

export function Covers({ headingId, title, cols }: {
  headingId: string; title: string; cols: [CoversCol, CoversCol];
}) {
  return (
    <section className="covers border-t border-rule py-section" aria-labelledby={headingId}>
      <div className="wrap">
        <h2 id={headingId} data-reveal className="mb-heading max-w-[20ch]">{title}</h2>
        <div data-stagger
          className="grid grid-cols-2 grid-rows-[repeat(6,auto)] gap-x-covers-gap gap-y-0 max-cols:grid-cols-1 max-cols:grid-rows-none max-cols:gap-covers-gap-col">
          {cols.map((col) => (
            <div key={col.title} data-reveal className="grid grid-rows-subgrid row-span-6 max-cols:block">
              <h3 className="pb-4 border-b border-black">{col.title}</h3>
              <ul className="list-none grid grid-rows-subgrid row-span-5 max-cols:block">
                {col.items.map((item) => (
                  <li key={item}
                    className={`grid grid-cols-[20px_1fr] gap-3.5 py-4 border-b border-rule text-base${col.tone === 'no' ? ' text-ink-2' : ''}`}>
                    <svg className="mt-0.75 text-black" width="20" height="20" aria-hidden="true">
                      <use href={col.tone === 'yes' ? '#i-yes' : '#i-no'} />
                    </svg>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

```tsx
// components/PriceBand.tsx — the money, read against a known scope. The white
// variant is the patient £39 band; the black 'field' variant is the GP pay
// band — the black fill sits on the payoff, which for a GP is the rate.
export function PriceBand({ variant, headingId, headline, fine }: {
  variant: 'price' | 'pay';
  headingId: string;
  headline: React.ReactNode;
  fine: string;
}) {
  const section = variant === 'price'
    ? 'price border-t border-rule pt-section-open pb-section'
    : 'field pay bg-black text-white py-field-section';
  return (
    <section className={section} aria-labelledby={headingId}>
      <div className="wrap grid grid-cols-[1.55fr_1fr] gap-x-16 gap-y-8 items-end max-cols:grid-cols-1 max-cols:items-start">
        <h2 id={headingId} data-reveal className={`tabular-nums ${variant === 'price' ? 'max-w-[20ch]' : 'max-w-[22ch]'}`}>
          {headline}
        </h2>
        <p data-reveal className={`fine text-base max-w-[34ch] ${variant === 'price' ? 'text-ink-2' : 'text-ink-2-dark max-w-[36ch]'}`}>
          {fine}
        </p>
      </div>
    </section>
  );
}
```

(Call sites pass the headline with its accent: patient `<b className="text-blue">£39</b> per consultation. Shown in full before you book, never changed after.` — GP `<b className="text-blue-lift">£24–33</b> per fifteen-minute consultation.`)

- [ ] **Step 3: Write the failing tests**

```tsx
// @vitest-environment jsdom
import { test, expect } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Steps } from '@/components/Steps';
import { Covers } from '@/components/Covers';
import { PriceBand } from '@/components/PriceBand';
import { PATIENT_STEPS, PATIENT_COVERS, GP_COVERS } from '@/app/landing-content';

test('the bento varies: two setup tiles, one full-width black payoff, third in sequence', () => {
  const { container } = render(<Steps headingId="t" title="As simple as it sounds." tiles={PATIENT_STEPS} />);
  const tiles = [...container.querySelectorAll('.bento > div')];
  expect(tiles).toHaveLength(3);
  expect(tiles[0].className).toContain('col-span-3');
  expect(tiles[2].className).toContain('bg-black');
  expect(tiles[2].className).toContain('col-span-6');
  expect(tiles[2]).toHaveTextContent('Talk by video.');
});

test('covers renders five items per column with the right marks and tone', () => {
  const { container } = render(<Covers headingId="c" title="t" cols={PATIENT_COVERS} />);
  const cols = [...container.querySelectorAll('[data-stagger] > div')];
  expect(cols).toHaveLength(2);
  expect(cols[0].querySelectorAll('use[href="#i-yes"]')).toHaveLength(5);
  expect(cols[1].querySelectorAll('use[href="#i-no"]')).toHaveLength(5);
  expect(cols[1].querySelector('li')!.className).toContain('text-ink-2');
});

test('the compliance sentences survive in the covers copy', () => {
  const patientNo = PATIENT_COVERS[1].items.join(' ');
  expect(patientNo).toContain('Schedule 2 and 3');
  expect(patientNo).toContain('call 999');
  const gpNo = GP_COVERS[1].items.join(' ');
  expect(gpNo).toContain('Schedule 2 or 3');
  expect(gpNo).toContain('Scotland, Wales and Northern Ireland');
});

test('the price band puts the number in the accent and stays tabular', () => {
  const { container } = render(
    <PriceBand variant="price" headingId="p" fine="fine"
      headline={<><b className="text-blue">£39</b> per consultation. Shown in full before you book, never changed after.</>} />,
  );
  expect(container.querySelector('h2 b')!.className).toContain('text-blue');
  expect(container.querySelector('h2')!.className).toContain('tabular-nums');
  const { container: pay } = render(
    <PriceBand variant="pay" headingId="g" fine="fine"
      headline={<><b className="text-blue-lift">£24–33</b> per fifteen-minute consultation.</>} />,
  );
  expect(pay.querySelector('section')!.className).toContain('bg-black');
  expect(pay.querySelector('h2 b')!.className).toContain('text-blue-lift');
});
```

- [ ] **Step 4: Run to verify, then pass**

Run: `npx vitest run tests/sections.test.tsx` — FAIL first (missing modules), then after writing Steps/Covers/PriceBand/content: PASS. Also `npx vitest run tests/constraints.test.ts` (the content file is now scanned) and `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add components/Steps.tsx components/Covers.tsx components/PriceBand.tsx app/landing-content.tsx tests/sections.test.tsx
git commit -m "feat(landing): bento, covers columns and price bands with verbatim copy"
```

---

### Task 12: FAQ, recap, patient-mode assembly

**Files:**
- Create: `components/Faq.tsx`, `components/Recap.tsx`, `tests/page-structure.test.tsx`
- Modify: `app/landing-content.tsx` (add `PATIENT_FAQ`, `GP_FAQ`), `app/page.tsx` (assemble patient mode)
- Reference: `index.html:543-586` (patient FAQ; the details run 546-585), `588-609` (patient recap), `691-730` (GP FAQ, transcribed now while in the file), `732-751` (GP recap)

**Interfaces:**
- Consumes: everything produced so far.
- Produces: `<Faq headingId title items={FaqItem[]} />` with `FaqItem = { q: string; a: React.ReactNode }`; `<Recap headingId title sub form={{role,source,cta,inputId}} />`; `PATIENT_FAQ`/`GP_FAQ` (8 items each); `app/page.tsx` rendering the full patient mode inside `<div className="mode" data-mode="patient">` and an empty `<div className="mode" data-mode="gp" />` placeholder (Task 13 fills it).

- [ ] **Step 1: Write `components/Faq.tsx` and `components/Recap.tsx`**

```tsx
// components/Faq.tsx — native disclosure; all styling and the open/close
// transition live in the authored layer.
export type FaqItem = { q: string; a: React.ReactNode };

export function Faq({ headingId, title, items }: {
  headingId: string; title: string; items: FaqItem[];
}) {
  return (
    <section className="faq border-t border-rule pt-section-tight pb-section" aria-labelledby={headingId}>
      <div className="wrap">
        <h2 id={headingId} data-reveal className="mb-heading-tight max-w-[16ch]">{title}</h2>
        <div data-stagger>
          {items.map((item) => (
            <details data-reveal key={item.q}>
              <summary>{item.q}</summary>
              {item.a}
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
```

```tsx
// components/Recap.tsx — the closing capture. Same collapse point as the
// hero's sibling (1080px): below it this grid squeezes the email input
// narrower than a phone gets.
import { WaitlistForm } from '@/components/WaitlistForm';

export function Recap({ headingId, title, sub, form }: {
  headingId: string;
  title: string;
  sub: string;
  form: { role: 'patient' | 'gp'; source: 'recap' | 'recap-gp'; cta: string; inputId: string };
}) {
  return (
    <section className="recap border-t border-rule py-section" aria-labelledby={headingId}>
      <div className="wrap grid grid-cols-2 gap-recap-gap items-start max-forms:grid-cols-1 max-forms:gap-0">
        <h2 id={headingId} data-reveal className="max-w-[14ch]">{title}</h2>
        <p className="sub text-lead text-ink-2 max-w-[34ch] mt-5" data-reveal>{sub}</p>
        <WaitlistForm role={form.role} source={form.source} cta={form.cta} inputId={form.inputId} reveal="" />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add both FAQ arrays to `app/landing-content.tsx`**

Transcribe all sixteen items verbatim from the referenced lines. Bodies are `<p>…</p>` nodes. The email-address item **must** carry the legal marker as a JSX comment inside its body, ported word-for-word:

```tsx
import type { FaqItem } from '@/components/Faq'; // at the top of the file

export const PATIENT_FAQ: FaqItem[] = [
  { q: 'Are these real GPs?', a: <p>Every doctor who takes consultations on Dr Quick will hold GMC registration, a licence to practise and a place on the GP Register. Nobody sees a patient until those have been checked.</p> },
  // …items 2–6 from index.html:550-575
  {
    q: 'What happens to my email address?',
    a: (
      <p>
        We use it to tell you when Dr Quick opens, and for nothing else. We do not share it or sell it,
        and your email address is the only thing we ask you for today. We keep it until launch and for no
        more than twelve months after that, then delete it. You can ask us to delete it sooner at any
        time, and if you think we have handled it badly you can complain to the Information
        Commissioner’s Office.
        {/* DEPLOY / LEGAL: UK GDPR Art 13 also requires the data controller's registered
            name and address and a working privacy contact. PRODUCT.md records the legal
            entity as undecided, so they cannot be written yet. Add them here and in the
            footer before this page collects a single real address. */}
      </p>
    ),
  },
  { q: 'Where can I use Dr Quick?', a: <p>England, at launch. Scotland, Wales and Northern Ireland are regulated separately, so they are not covered at launch.</p> },
];

// GP_FAQ: the eight items from index.html:694-729, same shape.
```

- [ ] **Step 3: Assemble the patient mode in `app/page.tsx`**

```tsx
import { IconDefs } from '@/components/IconDefs';
import { Nav } from '@/components/Nav';
import { Hero } from '@/components/Hero';
import { HeroArt } from '@/components/HeroArt';
import { UrgentBand } from '@/components/UrgentBand';
import { Steps } from '@/components/Steps';
import { Covers } from '@/components/Covers';
import { PriceBand } from '@/components/PriceBand';
import { Faq } from '@/components/Faq';
import { Recap } from '@/components/Recap';
import { LandingBehavior } from '@/components/LandingBehavior';
import { PATIENT_STEPS, PATIENT_COVERS, PATIENT_FAQ } from '@/app/landing-content';

export const dynamic = 'force-static';

export default function Page() {
  return (
    <>
      <IconDefs />
      <a className="skip" href="#main">Skip to content</a>
      <span id="nav-sentinel" aria-hidden="true" />
      <Nav />
      <main id="main">
        <div className="mode" data-mode="patient">
          <Hero
            lines={['See a GP', 'in minutes.']}
            sub="Talk to a GMC-registered doctor by secure video, for a flat £39 that covers any prescription you need."
            form={{ role: 'patient', source: 'hero', cta: 'Join the waitlist', inputId: 'join' }}
            art={<HeroArt />}
          />
          <UrgentBand />
          <Steps headingId="steps-title" title="As simple as it sounds." tiles={PATIENT_STEPS} />
          <Covers headingId="covers-title" title="What a consultation does, and doesn’t, cover." cols={PATIENT_COVERS} />
          <PriceBand
            variant="price"
            headingId="price-title"
            headline={<><b className="text-blue">£39</b> per consultation. Shown in full before you book, never changed after.</>}
            fine="The same £39 at two in the afternoon and two in the morning, with no booking fee and nothing else to pay Dr Quick afterwards."
          />
          <Faq headingId="faq-title" title="Questions people ask." items={PATIENT_FAQ} />
          <Recap
            headingId="recap-title"
            title="Be first through the door."
            sub="GMC-registered GPs by secure video, at a flat £39. England at launch."
            form={{ role: 'patient', source: 'recap', cta: 'Join the waitlist', inputId: 'join2' }}
          />
        </div>
        <div className="mode" data-mode="gp" />
      </main>
      <LandingBehavior />
    </>
  );
}
```

- [ ] **Step 4: Write the failing structure test (patient half)**

```tsx
// @vitest-environment jsdom
import { test, expect, beforeEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import '@testing-library/jest-dom/vitest';
import Page from '@/app/page';
import { installIOStub } from './helpers/io-stub';

beforeEach(() => {
  cleanup();
  installIOStub();
  vi.stubGlobal('scrollTo', vi.fn());
  document.documentElement.className = 'js';
  document.documentElement.setAttribute('data-role', 'patient');
});

const PATIENT_ORDER = ['hero', 'urgent', 'steps', 'covers', 'price', 'faq', 'recap'];
const PATIENT_QS = [
  'Are these real GPs?', 'How quickly will I be seen?', 'Can I get a prescription?',
  'Is Dr Quick CQC registered?', 'Will my own GP find out?', 'Can I use it for my children?',
  'What happens to my email address?', 'Where can I use Dr Quick?',
];

test('the patient mode keeps its section order — what the reader knows when', () => {
  const { container } = render(<Page />);
  const kids = [...container.querySelectorAll('[data-mode="patient"] > *')];
  expect(kids.map((el) => PATIENT_ORDER.find((c) => el.classList.contains(c)))).toEqual(PATIENT_ORDER);
});

test('the patient FAQ asks all eight questions, in order', () => {
  const { container } = render(<Page />);
  const summaries = [...container.querySelectorAll('[data-mode="patient"] .faq summary')].map((s) => s.textContent);
  expect(summaries).toEqual(PATIENT_QS);
});

test('the 999 band sits directly under the hero with a live tel: link', () => {
  const { container } = render(<Page />);
  const urgent = container.querySelector('[data-mode="patient"] .urgent')!;
  expect(urgent.previousElementSibling!.classList.contains('hero')).toBe(true);
  expect(urgent.querySelector('a.tel')).toHaveAttribute('href', 'tel:999');
});

test('both patient forms exist with their sources; email is the only field', () => {
  const { container } = render(<Page />);
  const forms = [...container.querySelectorAll('[data-mode="patient"] form')];
  expect(forms.map((f) => f.getAttribute('data-source'))).toEqual(['hero', 'recap']);
  for (const form of forms) {
    const visible = [...form.querySelectorAll('input')].filter((i) => !i.classList.contains('hp'));
    expect(visible).toHaveLength(1);
    expect(visible[0]).toHaveAttribute('type', 'email');
  }
});

test('the DEPLOY / LEGAL marker survives in source', () => {
  const content = readFileSync(join(__dirname, '../app/landing-content.tsx'), 'utf8');
  expect(content).toContain('DEPLOY / LEGAL');
  expect(content).toContain('UK GDPR Art 13');
});
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run tests/page-structure.test.tsx tests/constraints.test.ts && npm run typecheck && npm run build` — Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add components/Faq.tsx components/Recap.tsx app/landing-content.tsx app/page.tsx tests/page-structure.test.tsx
git commit -m "feat(landing): FAQ and recap components; assemble the patient mode"
```

---

### Task 13: GP mode, footer, full page

**Files:**
- Create: `components/Footer.tsx`
- Modify: `app/page.tsx` (fill the GP mode div, append footer), `tests/page-structure.test.tsx` (extend)
- Reference: `index.html:611-634` (GP hero), `636-654`, `656-682`, `684-689`, `691-730`, `732-751`, `754-762` (footer)

**Interfaces:**
- Consumes: everything above; `GP_STEPS`, `GP_COVERS`, `GP_FAQ` from the content file.
- Produces: the complete landing page.

- [ ] **Step 1: Write `components/Footer.tsx`**

```tsx
// components/Footer.tsx — shared by both modes. The second of the two 999
// links lives here, so the page never loses it; the Storyset attribution is a
// licence requirement while any Storyset asset is on the page.
export function Footer() {
  return (
    <footer className="border-t border-rule pt-12 pb-14 text-fine text-ink-2">
      <div className="wrap flex flex-wrap justify-between gap-y-6 gap-x-10">
        <div>
          <p className="warn text-label font-bold text-black tracking-[-.01em]">
            Not for emergencies — <a className="tel" href="tel:999">call 999</a> or go to A&amp;E.
          </p>
          <p className="mt-3">© 2026 Dr Quick · CQC-registered clinical service at launch · Available in England at launch</p>
        </div>
        <div>
          <a className="underline underline-offset-2" href="https://storyset.com/doctors" rel="noopener">
            Doctors illustrations by Storyset
          </a>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Fill the GP mode in `app/page.tsx`**

Replace the placeholder `<div className="mode" data-mode="gp" />` with the GP flow — hero → how a shift works → does/doesn't → pay → FAQ → recap — and append `<Footer />` after `</main>`:

```tsx
        <div className="mode" data-mode="gp">
          <Hero
            headerId="gps"
            lines={['Consult when', 'it suits you.']}
            sub="Paid per consultation, with no minimum hours and no retainer. Secure video, from wherever you are."
            form={{ role: 'gp', source: 'hero-gp', cta: 'Register interest', inputId: 'gp-join' }}
            art={
              <div className="hero-img" data-reveal="load">
                <img src="/assets/phone-illustration.svg" width={500} height={500} alt="" loading="eager" decoding="async" />
              </div>
            }
          />
          <Steps headingId="gp-steps-title" title="How a shift works." tiles={GP_STEPS} />
          <Covers headingId="gp-covers-title" title="What Dr Quick does, and doesn’t, do." cols={GP_COVERS} />
          <PriceBand
            variant="pay"
            headingId="gp-pay-title"
            headline={<><b className="text-blue-lift">£24–33</b> per fifteen-minute consultation.</>}
            fine="Paid per consultation you take, not per hour you are online. No minimum hours and no retainer, and your rate is confirmed in writing before your first consultation."
          />
          <Faq headingId="gp-faq-title" title="Questions GPs ask." items={GP_FAQ} />
          <Recap
            headingId="gp-recap-title"
            title="Be first on the rota."
            sub="Paid per consultation, on the hours you choose. Patients in England at launch."
            form={{ role: 'gp', source: 'recap-gp', cta: 'Register interest', inputId: 'gp-join2' }}
          />
        </div>
```

(A plain `<img>`, not `next/image`: parity with the flat page, no optimizer in the path of an SVG.)

- [ ] **Step 3: Extend `tests/page-structure.test.tsx`**

```tsx
const GP_ORDER = ['hero', 'steps', 'covers', 'pay', 'faq', 'recap'];
const GP_QS = [
  'Am I employed by Dr Quick?', 'What indemnity do I need?', 'What gets checked before I start?',
  'Do I have to prescribe?', 'How long is a consultation?', 'What equipment do I need?',
  'Where are the patients?', 'When does this start?',
];

test('the GP mode keeps its order, has no 999 band, and the black fill sits on the pay band', () => {
  const { container } = render(<Page />);
  const gp = container.querySelector('[data-mode="gp"]')!;
  const kids = [...gp.querySelectorAll(':scope > *')];
  expect(kids.map((el) => GP_ORDER.find((c) => el.classList.contains(c)))).toEqual(GP_ORDER);
  expect(gp.querySelector('.urgent')).toBeNull();
  expect(gp.querySelector('.pay')!.className).toContain('bg-black');
  expect(gp.querySelector('#gps')).not.toBeNull(); // the #gps hash target
});

test('the GP FAQ asks all eight questions, in order', () => {
  const { container } = render(<Page />);
  const summaries = [...container.querySelectorAll('[data-mode="gp"] .faq summary')].map((s) => s.textContent);
  expect(summaries).toEqual(GP_QS);
});

test('all four forms ship with their distinct sources', () => {
  const { container } = render(<Page />);
  const sources = [...container.querySelectorAll('form')].map((f) => f.getAttribute('data-source'));
  expect(sources).toEqual(['hero', 'recap', 'hero-gp', 'recap-gp']);
});

test('without JS both modes are in the document — one page carrying both audiences', () => {
  const { container } = render(<Page />);
  expect(container.querySelectorAll('.mode')).toHaveLength(2);
  expect(container.querySelectorAll('h1')).toHaveLength(2);
});

test('the footer carries the second 999 link and the Storyset attribution', () => {
  const { container } = render(<Page />);
  const footer = container.querySelector('footer')!;
  expect(footer.querySelector('a.tel')).toHaveAttribute('href', 'tel:999');
  expect(footer.querySelector('a[href="https://storyset.com/doctors"]')).toHaveTextContent('Doctors illustrations by Storyset');
  expect(container.querySelectorAll('a[href="tel:999"]')).toHaveLength(2); // band + footer, exactly
});

test('the pay copy names the rate honestly', () => {
  const { container } = render(<Page />);
  expect(container.querySelector('[data-mode="gp"] .pay h2')).toHaveTextContent('£24–33 per fifteen-minute consultation.');
  expect(container.querySelector('[data-mode="gp"] .pay .fine')).toHaveTextContent('your rate is confirmed in writing');
});
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run && npm run typecheck && npm run build` — Expected: the whole suite green.

- [ ] **Step 5: Commit**

```bash
git add components/Footer.tsx app/page.tsx tests/page-structure.test.tsx
git commit -m "feat(landing): GP mode, shared footer — full page assembled"
```

---

### Task 14: Metadata, site URL guard, env docs, CLAUDE.md note

**Files:**
- Create: `lib/site-url.ts`, `tests/metadata.test.ts`
- Modify: `app/layout.tsx` (complete the metadata), `.env.example`, `CLAUDE.md`
- Reference: `index.html:1-31`

**Interfaces:**
- Produces: `siteUrl(): URL` — throws in production when `NEXT_PUBLIC_SITE_URL` is unset, falls back to `http://localhost:3000` otherwise; the completed `metadata` export.

- [ ] **Step 1: Write the failing tests**

```ts
import { test, expect, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

test('siteUrl falls back to localhost outside production', async () => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
  const { siteUrl } = await import('@/lib/site-url');
  expect(siteUrl().origin).toBe('http://localhost:3000');
});

test('siteUrl throws loudly in a production build with no domain set', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
  const { siteUrl } = await import('@/lib/site-url');
  expect(() => siteUrl()).toThrow(/NEXT_PUBLIC_SITE_URL/);
});

test('siteUrl uses the configured origin', async () => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://drquick.example');
  const { siteUrl } = await import('@/lib/site-url');
  expect(siteUrl().href).toBe('https://drquick.example/');
});

test('the metadata ports the flat page head: share card, icons, locale', async () => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://drquick.example');
  vi.doMock('next/font/google', () => ({
    Archivo: () => ({ variable: '--font-archivo', className: '' }),
  }));
  const { metadata, viewport } = await import('@/app/layout');
  expect(metadata.title).toBe('Dr Quick — See a GP in minutes');
  expect(metadata.description).toContain('£39 per consultation, shown in full before you book');
  expect(metadata.metadataBase?.href).toBe('https://drquick.example/');
  const og = metadata.openGraph!;
  expect(og.siteName).toBe('Dr Quick');
  expect(og.title).toBe('See a GP in minutes.');
  expect(og.locale).toBe('en_GB');
  expect(og.images).toEqual([{ url: '/assets/og.png', width: 1200, height: 630 }]);
  expect(metadata.twitter).toMatchObject({ card: 'summary_large_image', images: ['/assets/og.png'] });
  expect(metadata.icons).toMatchObject({ icon: '/assets/favicon.svg', apple: '/assets/favicon.svg' });
  expect(viewport.themeColor).toBe('#FFFFFF');
});
```

- [ ] **Step 2: Write `lib/site-url.ts` and complete `app/layout.tsx`**

```ts
// lib/site-url.ts
// og:image and twitter:image must be absolute URLs on the production domain,
// or no crawler (Facebook, LinkedIn, Slack, WhatsApp, X) renders the share
// card. The flat page carried a loud placeholder; this build fails loudly
// instead — same intent, moved to build time.
export function siteUrl(): URL {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return new URL(configured);
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'NEXT_PUBLIC_SITE_URL is not set. The share-card images must be absolute URLs on the production domain — set it before building for deploy.',
    );
  }
  return new URL('http://localhost:3000');
}
```

In `app/layout.tsx`, replace the Task 1 metadata with:

```tsx
import { siteUrl } from '@/lib/site-url';

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: 'Dr Quick — See a GP in minutes',
  description:
    'See a GMC-registered GP by secure video, in minutes. £39 per consultation, shown in full before you book. Join the waitlist.',
  icons: { icon: '/assets/favicon.svg', apple: '/assets/favicon.svg' },
  openGraph: {
    type: 'website',
    siteName: 'Dr Quick',
    title: 'See a GP in minutes.',
    description:
      'GMC-registered doctors by secure video. £39 per consultation, shown in full before you book. Join the waitlist.',
    locale: 'en_GB',
    images: [{ url: '/assets/og.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'See a GP in minutes.',
    description: 'GMC-registered doctors by secure video. £39 per consultation, shown in full before you book.',
    images: ['/assets/og.png'],
  },
};
```

- [ ] **Step 3: Append to `.env.example`**

```bash
cat >> .env.example <<'EOF'

# Absolute origin of the deployed site, e.g. https://example.co.uk — no path.
# Production builds fail without it: og:image and twitter:image must be
# absolute URLs or no crawler renders the share card. Dev falls back to
# http://localhost:3000.
NEXT_PUBLIC_SITE_URL=
EOF
```

- [ ] **Step 4: Add the migration note to `CLAUDE.md`**

Insert directly under the `# Dr Quick — Website` heading:

```markdown
> **React migration in progress** (milestone 1 done — see
> `docs/superpowers/specs/2026-08-28-react-migration-design.md`). The site now
> builds from the Next.js app here: `npm run dev` / `npm test` /
> `npm run typecheck` / `NEXT_PUBLIC_SITE_URL=… npm run build`. The landing
> page is `app/page.tsx` + `app/landing-content.tsx`; the API lives in
> `app/api/`; headers live in `next.config.ts`. The old `index.html` and
> `preview/` remain as reference until milestone 4 and are no longer served.
```

- [ ] **Step 5: Run to verify pass**

Run:
```bash
npx vitest run tests/metadata.test.ts
npm run build            # dev-fallback path: must FAIL? No — build sets NODE_ENV=production: expect the loud throw
NEXT_PUBLIC_SITE_URL=https://drquick.example npm run build   # expect success
```
Expected: the bare `npm run build` fails with the `NEXT_PUBLIC_SITE_URL` message (this is the guard working — recorded deviation 6); the second build succeeds. Then `npx vitest run` for the whole suite.

- [ ] **Step 6: Commit**

```bash
git add lib/site-url.ts app/layout.tsx tests/metadata.test.ts .env.example CLAUDE.md
git commit -m "feat(landing): complete share-card metadata with a loud build-time domain guard"
```

---

### Task 15: Milestone verification — parity screenshots, headers, no-JS render

No new behavior; this task proves the milestone. Nothing in it may be skipped, and a failure here reopens the task that caused it.

**Files:**
- None created in the repo (screenshots go to the session scratchpad).

- [ ] **Step 1: Full suite and build**

```bash
npx vitest run && npm run typecheck
NEXT_PUBLIC_SITE_URL=http://localhost:3000 npm run build
(NEXT_PUBLIC_SITE_URL=http://localhost:3000 npm run start &) && sleep 3
```
Expected: every test green; build clean.

- [ ] **Step 2: Headers and no-JS document checks**

```bash
curl -sI http://localhost:3000/ | grep -i "content-security-policy"   # the PROD_CSP string, no googleapis
curl -sI http://localhost:3000/ | grep -i "strict-transport\|x-frame\|nosniff"
curl -s http://localhost:3000/ | grep -c 'data-mode="'                # expect 2 — both modes in served HTML
curl -s http://localhost:3000/ | grep -c 'tel:999'                    # expect 2
curl -s http://localhost:3000/ | grep -c 'class="art'                 # the inlined idle art is in the payload
curl -s http://localhost:3000/api/waitlist -X POST -H 'Content-Type: application/json' \
  -d '{"email":"a@b.co","role":"patient"}' # expect 503 store_unavailable (no store env locally)
```

- [ ] **Step 3: Screenshots, new against old**

```bash
SCRATCH=<the session scratchpad directory>
CHROME=$(ls ~/.cache/puppeteer/chrome-headless-shell/*/chrome-headless-shell-mac-arm64/chrome-headless-shell | head -1)
# New page — both modes, both widths, tall enough to include the footer
"$CHROME" --headless --window-size=1440,4600 --screenshot=$SCRATCH/new-patient-1440.png http://localhost:3000/
"$CHROME" --headless --window-size=1440,4600 --screenshot=$SCRATCH/new-gp-1440.png "http://localhost:3000/?role=gp"
"$CHROME" --headless --window-size=390,7800 --screenshot=$SCRATCH/new-patient-390.png http://localhost:3000/
"$CHROME" --headless --window-size=390,7800 --screenshot=$SCRATCH/new-gp-390.png "http://localhost:3000/?role=gp"
# Old page for comparison (served from the repo root so assets/ resolves)
(python3 -m http.server 8010 &) && sleep 1
"$CHROME" --headless --window-size=1440,4600 --screenshot=$SCRATCH/old-patient-1440.png http://localhost:8010/index.html
"$CHROME" --headless --window-size=1440,4600 --screenshot=$SCRATCH/old-gp-1440.png "http://localhost:8010/index.html?role=gp"
"$CHROME" --headless --window-size=390,7800 --screenshot=$SCRATCH/old-patient-390.png http://localhost:8010/index.html
"$CHROME" --headless --window-size=390,7800 --screenshot=$SCRATCH/old-gp-390.png "http://localhost:8010/index.html?role=gp"
```

- [ ] **Step 4: Compare every pair by eye**

Read each new/old pair side by side and check, per CLAUDE.md: headline scale and tracking; hero split with the illustration at the right width; the 999 band at body size under the patient hero; bento spans (black payoff third, full width); covers hairlines level across columns; £39 blue on white, £24–33 blue-lift on black; FAQ plus/minus markers; footer with both links. Differences beyond font-rendering noise reopen the task that owns the divergent section — fix there, re-shoot, re-compare.

- [ ] **Step 5: Stop servers, report, and gate**

Kill both servers. Present the screenshot pairs and the check results to your human partner. **The milestone is not done until they approve the parity.** Record any accepted deviations in the final commit message.

- [ ] **Step 6: Final commit (if fixes were made) and handoff**

Milestones 2–4 (patient, doctor, admin surfaces) each get their own plan against the same spec. Nothing in this milestone deleted `index.html` or `preview/` — that is milestone 4, deliberately.

---

## Self-Review (performed while writing)

- **Spec coverage:** milestone 1 items all mapped — scaffold (T1), reconciled tokens (T1; the "divergent palettes" turned out to be the `prefers-contrast` variants, recorded in the `ALLOWED_HEX` comment), authored layer (T7), landing parity (T8–T13), motion grammar (T7/T8), idle art both guards (T7/T8/T10), four forms (T9, mounted T12–T13), API routes (T3–T5), headers/CSP/noindex (T6), metadata + loud domain guard (T14), constraints test extended to `.tsx` + arbitrary values (T2), screenshots at 1440/390 (T15). Deferred per spec: fixture tests and the prototype ribbon land with the dashboards in milestones 2–4.
- **Placeholders:** the only "…" ellipses are in `landing-content.tsx` transcription steps, each pinned to exact `index.html` line ranges with the full item lists enumerated in tests (16 FAQ questions, 5+5 covers items per mode, compliance phrases). Every other code block is complete.
- **Type consistency:** `pipeline` command tuples, `FaqItem`, `Tile`, `CoversCol`, `WaitlistForm` props and `PriceBand` variants are used with the same names and shapes across tasks; `authorised` is imported by the delete route from the export route module (noted as inert extra export).
