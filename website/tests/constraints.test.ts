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

// Pricing became dynamic on 2026-09-04, but these stayed banned: the reversal
// was to the pricing *model*, not to its presentation. Time-pressure framing and
// paid-for clinical priority are the ASA/DMCC exposures, and they are exposures
// whatever sets the number. See the pricing bullet in CLAUDE.md.
//
// Word-boundary patterns: a bare substring match on "surge" also fires on
// "surgery", which is ordinary UK general-practice vocabulary.
const BANNED_PATTERNS = [
  /\bsurge\b/i,
  /\bpriority queue\b/i,
  /\bbusier than usual\b/i,
  /\bcqc-registered clinical partner\b/i,
  /\bcqc (registration )?number\b/i,
];

// The @theme colours in app/globals.css (DESIGN.md front matter, TechMed Modern,
// reduced to the roles the site uses) plus its one prefers-contrast substitution,
// #747688, which is already in the set. #fff appears as the stroke colour inside
// the status-icon SVGs. The retired true-black / #1447E6 system is deliberately
// absent so it cannot creep back in.
const ALLOWED_HEX = new Set([
  '#ffffff', '#fff', '#f7f9fb', '#eceef0', '#e6e8ea', '#e0e3e5',
  '#434657', '#747688', '#e2e8f0', '#0f172a', '#94a3b8',
  '#0047ff', '#0035c5', '#b9c3ff', '#10b981', '#ef4444',
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

// shadcn's generator writes an oklch() palette into globals.css. A colour function
// in authored CSS is a colour outside the sixteen, whatever its syntax; the only
// permitted mixing is color-mix() over the tokens, which this does not match.
export function cssColorFunctions(text: string): string[] {
  return text.match(/\b(?:oklch|oklab|lch|lab|hsl|hsla)\(/g) ?? [];
}

// The band is a surface, not a theme. There is no .dark class and no dark: variant;
// shadcn's `@custom-variant dark` and `.dark { … }` block must not land either.
export function darkVariants(text: string): string[] {
  return text.match(/(?<![\w-])dark:[\w[(-]/g) ?? [];
}
export function darkThemeCss(text: string): string[] {
  return text.match(/@custom-variant\s+dark\b|(?<![\w-])\.dark\b/g) ?? [];
}

describe('the checkers themselves bite', () => {
  test('an off-palette hex is flagged', () => {
    expect(offPaletteHexes('color: #005EB8;')).toEqual(['#005eb8']);
    expect(offPaletteHexes('bg-[#005EB8]')).toEqual(['#005eb8']);
    expect(offPaletteHexes('color: #0047FF;')).toEqual([]);
    // The retired palette is off-palette now, not grandfathered.
    expect(offPaletteHexes('color: #1447E6; background: #000000;')).toEqual(['#1447e6', '#000000']);
  });
  test('an arbitrary colour function is flagged', () => {
    expect(arbitraryColorFunctions('className="bg-[rgb(0,94,184)]"')).toHaveLength(1);
    expect(arbitraryColorFunctions('className="bg-fill"')).toHaveLength(0);
  });
  test('a colour function in CSS is flagged, color-mix over tokens is not', () => {
    expect(cssColorFunctions('--primary: oklch(0.205 0 0);')).toEqual(['oklch(']);
    expect(cssColorFunctions('color: hsl(220 90% 50%); x: lab(50% 0 0); y: lch(50% 0 0)')).toHaveLength(3);
    expect(cssColorFunctions('color-mix(in srgb, var(--color-ink) 8%, transparent)')).toEqual([]);
    expect(cssColorFunctions('clamp(28px, 3.4vw, 44px)')).toEqual([]);
  });
  test('a dark: variant and a .dark block are flagged', () => {
    expect(darkVariants('className="bg-white dark:bg-black"')).toEqual(['dark:b']);
    expect(darkVariants('"dark:aria-invalid:ring-destructive/40"')).toHaveLength(1);
    expect(darkVariants('data-dark:x')).toEqual([]);
    expect(darkThemeCss('@custom-variant dark (&:is(.dark *));')).toHaveLength(2);
    expect(darkThemeCss('.dark { --background: oklch(0.145 0 0); }')).toEqual(['.dark']);
    expect(darkThemeCss('.darker-thing {}')).toEqual([]);
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

test('app CSS declares no colour through oklch, lab, lch or hsl', () => {
  for (const file of FILES.filter((f) => extname(f) === '.css')) {
    const bad = cssColorFunctions(readFileSync(file, 'utf8'));
    expect(bad, `${file} uses colour function(s): ${bad.join(', ')}`).toEqual([]);
  }
});

test('app source has no dark: variant and no .dark theme block', () => {
  for (const file of FILES) {
    const text = readFileSync(file, 'utf8');
    const variants = darkVariants(text);
    expect(variants, `${file} uses a dark: variant: ${variants.join(', ')}`).toEqual([]);
    if (extname(file) === '.css') {
      const blocks = darkThemeCss(text);
      expect(blocks, `${file} declares a dark theme: ${blocks.join(', ')}`).toEqual([]);
    }
  }
});
