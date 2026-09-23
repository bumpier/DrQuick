import { test, expect, describe } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

/* The landing page ships to every visitor, and the patient surface is a
   prototype with fixtures, a booking reducer, timers and a toaster. The
   providers mount only in the patient layout, so nothing reachable from the
   landing page's own modules may pull any of that in. This walks the static
   import graph from the landing entry points and names every file it reaches;
   a build is not needed, so the check runs with the rest of the suite. */

const ROOT = join(__dirname, '..');
const ENTRIES = ['app/page.tsx', 'app/layout.tsx', 'app/landing-content.tsx'];

// What the landing bundle must never reach (path prefixes from the site root).
const FORBIDDEN = [
  'components/patient/',
  'components/app/',
  'lib/booking-flow',
  'lib/pricing',
  'lib/patient',
  'lib/fixtures',
  'lib/data-mode',
  'hooks/use-live-interval',
  'hooks/use-delayed',
  'components/ui/sonner',
  'components/ui/sidebar',
];

// Source the walker reads for further imports; anything else reached (a .css
// side-effect import) is recorded but not parsed.
const PARSED = /\.(?:tsx?|jsx?|mjs|cjs)$/;

// `import … from '…'` (default, named across lines, namespace, `import type`),
// `export … from '…'`, a bare side-effect `import '…'`, and `import('…')`.
// The clause is limited to identifiers, braces, commas, `*` and whitespace, so
// a match can never run across ordinary code to a later string.
const SPECIFIER_PATTERNS = [
  /\b(?:import|export)\s+[\w$*{},\s]*?\s*\bfrom\s*['"]([^'"\n]+)['"]/g,
  /\bimport\s*['"]([^'"\n]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g,
];

export function specifiersIn(source: string): string[] {
  return SPECIFIER_PATTERNS.flatMap((pattern) => [...source.matchAll(pattern)].map((m) => m[1]));
}

const rel = (file: string) => relative(ROOT, file).split(sep).join('/');

// '@/x' is the site root; './x' and '../x' are relative to the importer. A bare
// specifier ('react', 'next/font/google', 'node:fs') is a package: null.
// undefined means a local specifier that matched no file, which the walk
// reports rather than skipping, so a resolution gap cannot hide a violation.
function resolveSpecifier(from: string, specifier: string): string | null | undefined {
  let base: string;
  if (specifier.startsWith('@/')) base = join(ROOT, specifier.slice(2));
  else if (specifier.startsWith('./') || specifier.startsWith('../')) base = resolve(dirname(from), specifier);
  else return null;
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

export function walkImports(entries: readonly string[]): { files: string[]; unresolved: string[] } {
  const seen = new Set<string>();
  const unresolved: string[] = [];
  const queue = entries.map((entry) => join(ROOT, entry));
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (!PARSED.test(file)) continue;
    for (const specifier of specifiersIn(readFileSync(file, 'utf8'))) {
      const target = resolveSpecifier(file, specifier);
      if (target === null) continue;
      if (target === undefined) unresolved.push(`${rel(file)} imports ${specifier}`);
      else queue.push(target);
    }
  }
  return { files: [...seen].map(rel).sort(), unresolved };
}

const forbiddenIn = (files: readonly string[]) =>
  files.filter((file) => FORBIDDEN.some((prefix) => file.startsWith(prefix)));

describe('the walker itself works', () => {
  test('the specifier parser reads every import form and nothing that only looks like one', () => {
    const source = [
      `import React from 'react';`,
      `import { a,`,
      `  b as c,`,
      `  type D,`,
      `} from "@/lib/multi-line";`,
      `import type { E } from '@/lib/type-only';`,
      `import * as ns from './namespace';`,
      `import Default, { f } from '../default-and-named';`,
      `import './side-effect.css';`,
      `export { g } from '@/lib/re-export';`,
      `export * from '@/lib/star';`,
      `const lazy = () => import('@/components/lazy');`,
      `const x = Array.from('abc');`,
      `export const from = 'not-a-specifier';`,
      `// "Choose from 'A' or 'B'" is prose, not an import`,
    ].join('\n');
    expect(specifiersIn(source).sort()).toEqual([
      '../default-and-named', './namespace', './side-effect.css',
      '@/components/lazy', '@/lib/multi-line', '@/lib/re-export', '@/lib/star', '@/lib/type-only',
      'react',
    ]);
  });

  test('from app/page.tsx it reaches the landing components, through @/ and multi-line imports', () => {
    const { files, unresolved } = walkImports(['app/page.tsx']);
    expect(unresolved).toEqual([]);
    for (const file of [
      'app/page.tsx', 'components/Hero.tsx', 'components/Nav.tsx', 'components/ui/button.tsx',
      'components/GpSignupForm.tsx', 'lib/gp-signup.ts', 'app/landing-content.tsx', 'lib/utils.ts',
    ]) {
      expect(files).toContain(file);
    }
  });

  test('from app/layout.tsx it records the stylesheet side-effect import without parsing it', () => {
    const { files, unresolved } = walkImports(['app/layout.tsx']);
    expect(unresolved).toEqual([]);
    expect(files).toContain('app/globals.css');
    expect(files).toContain('lib/site-url.ts');
  });

  // The patient surface itself never uses the doctor/admin sidebar, so that one
  // prefix is proven by the landing assertions alone.
  test('the forbidden check bites: the patient layout and booking route reach everything the landing page must not', () => {
    const { files, unresolved } = walkImports(['app/(app)/patient/layout.tsx', 'app/(app)/patient/book/[[...step]]/page.tsx']);
    expect(unresolved).toEqual([]);
    const reached = forbiddenIn(files);
    for (const prefix of FORBIDDEN.filter((p) => p !== 'components/ui/sidebar')) {
      expect(reached.some((file) => file.startsWith(prefix)), `the patient routes should reach ${prefix}`).toBe(true);
    }
    expect(files).not.toContain('components/ui/sidebar.tsx');
  });
});

describe('the landing bundle never reaches the patient surface', () => {
  test.each(ENTRIES)('%s reaches nothing under the patient surface, the app shell pieces or their runtime', (entry) => {
    const { files, unresolved } = walkImports([entry]);
    expect(unresolved).toEqual([]);
    expect(forbiddenIn(files)).toEqual([]);
  });

  test('the three entry points together reach none of it either', () => {
    const { files } = walkImports(ENTRIES);
    expect(files.length).toBeGreaterThan(ENTRIES.length);
    expect(forbiddenIn(files)).toEqual([]);
  });
});
