import { test, expect, describe } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import {
  MEDICINES, BANNED_PATTERNS, PATIENT_PRESSURE_PATTERNS, PATIENT_CLAIM_PATTERNS,
  NAMED_DOCTOR as PATIENT_NAMED_DOCTOR, LITERAL_MONEY as PATIENT_LITERAL_MONEY,
} from '@/lib/compliance';

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

// lib/compliance.ts must name the medicines and phrases it bans, so it is the
// one file the source scans skip. The test below pins that exclusion to it.
const COMPLIANCE_MODULE = join(ROOT, 'lib', 'compliance.ts');
const FILES = SCAN_DIRS.flatMap(walk).filter((f) => EXTS.has(extname(f)) && f !== COMPLIANCE_MODULE);

test('only lib/compliance.ts is excluded from the source scan', () => {
  const all = SCAN_DIRS.flatMap(walk).filter((f) => EXTS.has(extname(f)));
  expect(all.filter((f) => !FILES.includes(f))).toEqual([COMPLIANCE_MODULE]);
});

// The @theme colours in app/globals.css (DESIGN.md front matter, Lime & Forest,
// 2026-09-25) plus the prefers-contrast substitution #dfe6d8, which is already in
// the set. #fff appears as the stroke colour inside the status-icon SVGs. Every
// retired system (TechMed's #0047FF, true-black / #1447E6) is deliberately absent
// so it cannot creep back in, and NHS Blue #005EB8 and NHS Green #009639 can never
// be added: a private provider must never read as NHS-branded.
const ALLOWED_HEX = new Set([
  '#ffffff', '#fff', '#f5f7f2', '#edf1e8', '#e8ede3', '#dfe6d8',
  '#163300', '#4d5b45', '#6b7a63', '#dce4d4', '#b5c9a5',
  '#9fe870', '#8bdb57', '#2f6b0f', '#e2f6d5', '#c9ddb8', '#e8e5db', '#c8322a',
]);
const NHS_HEX = ['#005eb8', '#009639'];
test('the palette never admits an NHS colour', () => {
  for (const hex of NHS_HEX) expect(ALLOWED_HEX.has(hex)).toBe(false);
});

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
    expect(offPaletteHexes('color: #9FE870;')).toEqual([]);
    expect(offPaletteHexes('color: #009639;')).toEqual(['#009639']);
    // The retired palettes are off-palette now, not grandfathered.
    expect(offPaletteHexes('color: #0047FF; background: #1447E6; x: #000000;')).toEqual(['#0047ff', '#1447e6', '#000000']);
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

// The favicon and anything else drawn in public/assets ships to every visitor,
// so it keeps to the same palette as the source.
test('served SVG assets use only the permitted palette', () => {
  const svgs = walk(join(ROOT, 'public', 'assets')).filter((f) => extname(f) === '.svg');
  expect(svgs.length).toBeGreaterThan(0);
  for (const file of svgs) {
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

/* ---------------------------------------------------------------------------
   The patient surface. Scoped to its own source, comments included, because
   the booking flow is where pricing, urgency and recording claims would do
   the most harm: a nudge beside a live price is the ASA's time-pressure
   finding, a "priority" is paid-for clinical priority, a count of GPs online
   is a claim about a floor that does not exist, and a literal amount is a
   price that did not come from the frozen quote. Money reaches a patient
   screen only through money() over the booking's quote or a record's cost.
--------------------------------------------------------------------------- */
// Import declarations are hoisted, so these sit with the block that uses them.
import { existsSync } from 'node:fs';
import { BOOKING_SCREENS } from '@/lib/booking-flow';
import { CONSULTATIONS } from '@/lib/fixtures';
import { PATIENT_JUMPS } from '@/components/app/jumps';

const PATIENT_SOURCES = [
  ...walk(join(ROOT, 'app', '(app)', 'patient')),
  ...walk(join(ROOT, 'components', 'patient')),
  ...['booking-flow.ts', 'pricing.ts', 'patient.ts'].map((file) => join(ROOT, 'lib', file)),
].filter((file) => EXTS.has(extname(file)));

// The pattern lists live in lib/compliance.ts, each with a sample it must catch.
const PATIENT_PATTERNS = [
  ...PATIENT_PRESSURE_PATTERNS, ...PATIENT_CLAIM_PATTERNS, PATIENT_NAMED_DOCTOR, PATIENT_LITERAL_MONEY,
];

function patientHits(patterns: ReadonlyArray<readonly [RegExp, string]>): string[] {
  return PATIENT_SOURCES.flatMap((file) => {
    const text = readFileSync(file, 'utf8');
    return patterns.flatMap(([pattern]) => {
      const hit = text.match(pattern);
      return hit ? [`${file}: ${pattern} matched "${hit[0]}"`] : [];
    });
  });
}

describe('the patient checkers bite', () => {
  test.each(PATIENT_PATTERNS.map(([pattern, sample]) => [String(pattern), pattern, sample] as const))(
    '%s catches its sample',
    (_name, pattern, sample) => {
      expect(pattern.test(sample)).toBe(true);
    },
  );

  test('none of them fires on aria-busy, surgery or Dr Quick', () => {
    const innocents = ['aria-busy', 'aria-busy={check.pending || undefined}', 'surgery', 'GP surgery', 'Dr Quick', 'Dr. Quick', 'DrQuick'];
    for (const [pattern] of PATIENT_PATTERNS) {
      for (const innocent of innocents) {
        expect(pattern.test(innocent), `${pattern} fired on "${innocent}"`).toBe(false);
      }
    }
  });

  test('the honest sentences pass: not recorded, never recorded, GPs online now, skip the wait, money()', () => {
    const honest = [
      'This call is not recorded.', 'Calls are never recorded', 'The call was not recorded',
      'GPs online now', 'Prototype: skip the wait', 'Request a GP for ${money(state.quote ?? 0)}',
      'a base off-peak price of 32 pounds', 'Your GP is ready', 'GP-002 has accepted your consultation.',
    ];
    for (const [pattern] of PATIENT_PATTERNS) {
      for (const sentence of honest) {
        expect(pattern.test(sentence), `${pattern} fired on "${sentence}"`).toBe(false);
      }
    }
  });
});

test('there is patient source to scan: the routes, the components and the three libraries', () => {
  const scanned = PATIENT_SOURCES.map((file) => file.split(/[\\/]/).slice(-2).join('/'));
  expect(scanned).toEqual(expect.arrayContaining([
    'patient/layout.tsx', 'patient/PatientHome.tsx', 'steps/Quote.tsx', 'states/RedFlag.tsx',
    'lib/booking-flow.ts', 'lib/pricing.ts', 'lib/patient.ts',
  ]));
});

test('the patient scan reads comments as well as code', () => {
  // Block and line comments reach the patterns: nothing is stripped first.
  const commented = patientHits([[/\/\*[\s\S]*?\*\/|\/\/ \S/, '']]);
  expect(commented.length).toBeGreaterThan(PATIENT_SOURCES.length / 2);
  expect(commented.some((hit) => /pricing\.ts/.test(hit))).toBe(true);
});

test('the patient surface uses no time-pressure, priority, price-range, score or GP-count wording', () => {
  expect(patientHits(PATIENT_PRESSURE_PATTERNS)).toEqual([]);
});

test('the patient surface makes no guarantee, UK-wide, recording or CQC claim', () => {
  expect(patientHits(PATIENT_CLAIM_PATTERNS)).toEqual([]);
});

test('the patient surface names no doctor', () => {
  expect(patientHits([PATIENT_NAMED_DOCTOR])).toEqual([]);
});

test('the patient surface types no amount: money comes only through money() and the frozen quote', () => {
  expect(patientHits([PATIENT_LITERAL_MONEY])).toEqual([]);
});

describe('the patient state jumper', () => {
  const PATIENT_APP = join(ROOT, 'app', '(app)', 'patient');
  const jumpPaths = PATIENT_JUMPS
    .flatMap((group) => group.items.map((item) => item.href))
    .filter((href) => !href.startsWith('?'))
    .map((href) => href.split('?')[0]);

  test('every PATIENT_JUMPS href resolves to a real route', () => {
    expect(jumpPaths.length).toBeGreaterThan(0);
    for (const path of jumpPaths) {
      if (path.startsWith('/patient/book/')) {
        expect(BOOKING_SCREENS as readonly string[], path).toContain(path.slice('/patient/book/'.length));
        expect(existsSync(join(PATIENT_APP, 'book', '[[...step]]', 'page.tsx')), path).toBe(true);
      } else if (path.startsWith('/patient/consultations/')) {
        expect(CONSULTATIONS.map((c) => c.id), path).toContain(path.slice('/patient/consultations/'.length));
        expect(existsSync(join(PATIENT_APP, 'consultations', '[id]', 'page.tsx')), path).toBe(true);
      } else {
        expect(path === '/patient' || path.startsWith('/patient/'), path).toBe(true);
        const segments = path.split('/').filter(Boolean).slice(1);
        expect(existsSync(join(PATIENT_APP, ...segments, 'page.tsx')), `${path} has no page file`).toBe(true);
      }
    }
  });

  test('the only jumps without a path are the data modes', () => {
    const queryOnly = PATIENT_JUMPS.flatMap((group) =>
      group.items.filter((item) => item.href.startsWith('?')).map((item) => item.href));
    expect(queryOnly).toEqual(['?data=', '?data=seeded']);
  });

  test('every BOOKING_SCREENS entry has a jump', () => {
    for (const screen of BOOKING_SCREENS) {
      expect(jumpPaths, screen).toContain(`/patient/book/${screen}`);
    }
  });
});
