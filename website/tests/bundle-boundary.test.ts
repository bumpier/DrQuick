import { test, expect, describe, vi } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
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
  // The video call (docs/superpowers/specs/2026-10-13-encrypted-video-calls-design.md):
  // its screen and media library, and its server half.
  'components/call/',
  'lib/video/',
  'lib/crypto/',
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

// serverActionsAsReferences: a 'use server' module reaches the browser only as
// a reference to call the server, and Next bundles none of what it imports.
export function walkImports(
  entries: readonly string[], { serverActionsAsReferences = false } = {},
): { files: string[]; unresolved: string[] } {
  const seen = new Set<string>();
  const unresolved: string[] = [];
  const queue = entries.map((entry) => join(ROOT, entry));
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (!PARSED.test(file)) continue;
    const source = readFileSync(file, 'utf8');
    if (serverActionsAsReferences && /^\s*['"]use server['"]/.test(source)) continue;
    for (const specifier of specifiersIn(source)) {
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

// The video call's server half (sealing, passes, the media server's API and its
// SDK, all under lib/video and lib/crypto) must never be bundled for a browser.
describe('no browser code reaches the video call’s server half', () => {
  const clientFiles = (dir: string): string[] => readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return clientFiles(path);
    return /\.tsx?$/.test(entry.name) && /^\s*['"]use client['"]/.test(readFileSync(join(ROOT, path), 'utf8')) ? [path] : [];
  });

  test('every client component, and all it imports, stays clear of lib/video and lib/crypto', () => {
    const entries = [...clientFiles('components'), ...clientFiles('app')];
    expect(entries.length).toBeGreaterThan(20);
    const { files, unresolved } = walkImports(entries, { serverActionsAsReferences: true });
    expect(unresolved).toEqual([]);
    expect(files.filter((file) => file.startsWith('lib/video/') || file.startsWith('lib/crypto/'))).toEqual([]);
    // Nor the demo deployment's passcode session and guards (lib/demo.ts, the
    // switch the screens read, is not under lib/demo/).
    expect(files.filter((file) => file.startsWith('lib/demo/') || file === 'lib/signed-token.ts')).toEqual([]);
    expect(files).toContain('lib/demo.ts');
    // The walk reaches the call screen itself, so the check is not vacuous.
    expect(files).toContain('components/call/useEncryptedCall.ts');
  });
});

// The demo patient's camera and its worker are for the investor demo only.
// The hook loads them with a dynamic import behind the build's NEXT_PUBLIC_DEMO
// flag, so the real site's build drops them; a static import anywhere would put
// them back in the doctor portal's bundle.
describe('the demo camera is never imported statically', () => {
  const sourceFiles = (dir: string): string[] => readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });

  test('no file statically imports components/call/demoCamera', () => {
    const files = ['app', 'components', 'lib', 'hooks'].flatMap(sourceFiles);
    expect(files.length).toBeGreaterThan(100);
    const offenders = files.filter((file) => {
      const source = readFileSync(join(ROOT, file), 'utf8');
      const statics = [...source.matchAll(SPECIFIER_PATTERNS[0]), ...source.matchAll(SPECIFIER_PATTERNS[1])]
        .filter((m) => !/^\s*import\s+type\b/.test(m[0]) && !/^\s*export\s+type\b/.test(m[0]));
      return statics.some((m) => /(^|\/)demoCamera$/.test(m[1]));
    });
    expect(offenders).toEqual([]);
  });

  test('the hook loads it on demand', () => {
    expect(readFileSync(join(ROOT, 'components/call/useEncryptedCall.ts'), 'utf8')).toContain("import('./demoCamera')");
  });

  // The demo deployment is a production build made with NEXT_PUBLIC_DEMO=1, so
  // the gate is that flag, which Next inlines at build: a build without it (the
  // real site) drops the branch, the camera and its worker; a NODE_ENV gate
  // would drop them from the demo deployment's build as well.
  // Next inlines a NEXT_PUBLIC_ variable only when it is set: unset, the gate
  // stays a runtime comparison and the bundler keeps the import, the camera and
  // its worker. next.config.ts therefore defines it in every build, as '' when
  // it is not set, so the real site's gate folds to false and the branch goes.
  test('every build defines the demo flag, so the gate is a constant the bundler can fold', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO', undefined as unknown as string);
    delete process.env.NEXT_PUBLIC_DEMO;
    vi.resetModules();
    try {
      const real = (await import('@/next.config')).default;
      expect(real.env).toHaveProperty('NEXT_PUBLIC_DEMO', '');
      vi.stubEnv('NEXT_PUBLIC_DEMO', '1');
      vi.resetModules();
      const demo = (await import('@/next.config')).default;
      expect(demo.env).toHaveProperty('NEXT_PUBLIC_DEMO', '1');
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });

  test('the import sits behind the build’s demo flag, and nothing else decides the build', () => {
    const source = readFileSync(join(ROOT, 'components/call/useEncryptedCall.ts'), 'utf8');
    const gate = source.match(/if \(([^)]*)\) \{\s*const \{ createDemoCamera \} = await import\('\.\/demoCamera'\)/);
    expect(gate?.[1]).toBe("process.env.NEXT_PUBLIC_DEMO === '1' && demoPatient");
    expect(source.match(/import\('\.\/demoCamera'\)/g)).toHaveLength(1);
  });
});
