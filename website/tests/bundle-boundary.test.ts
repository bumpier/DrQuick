import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

// What may reach the browser, read from the import graph itself. The call's
// server half (sealing, passes, the media server's API) must never be bundled
// for a browser; and the landing page, which anyone loads, carries no part of
// the video call.

const ROOT = resolve(__dirname, '..');
const EXTENSIONS = ['.ts', '.tsx', '/index.ts', '/index.tsx'];
// Value imports and re-exports, and dynamic imports; type-only ones vanish at build.
const IMPORTS = /(?:^|\n)\s*(?:import|export)\s+(?!type\b)(?:[\s\S]*?\sfrom\s+)?['"]([^'"\n]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function resolveImport(from: string, spec: string): string {
  if (!spec.startsWith('.') && !spec.startsWith('@/')) return `pkg:${spec}`;
  const base = spec.startsWith('@/') ? join(ROOT, spec.slice(2)) : resolve(dirname(from), spec);
  for (const ext of ['', ...EXTENSIONS]) {
    const file = base + ext;
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return `missing:${relative(ROOT, base)}`;
}

function reachable(entries: string[]): Set<string> {
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (file.startsWith('pkg:') || file.startsWith('missing:') || !/\.(ts|tsx)$/.test(file)) continue;
    const text = readFileSync(file, 'utf8');
    // A server action's module reaches the browser only as a reference to call
    // the server: Next bundles none of what it imports.
    if (/^\s*['"]use server['"]/.test(text)) continue;
    for (const match of text.matchAll(IMPORTS)) queue.push(resolveImport(file, match[1] ?? match[2]));
  }
  return seen;
}

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sources(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

const SERVER_ONLY = ['lib/crypto/sealed.ts', 'lib/video/livekit.ts', 'lib/video/calls.ts'].map((f) => join(ROOT, f));

describe('the browser bundle', () => {
  test('no client component reaches the call’s server half', () => {
    const clientFiles = [...sources(join(ROOT, 'components')), ...sources(join(ROOT, 'app'))]
      .filter((file) => /^\s*['"]use client['"]/.test(readFileSync(file, 'utf8')));
    expect(clientFiles.length).toBeGreaterThan(20);
    const graph = reachable(clientFiles);
    for (const file of SERVER_ONLY) expect(graph.has(file), relative(ROOT, file)).toBe(false);
    expect(graph.has('pkg:livekit-server-sdk')).toBe(false);
    // The walk itself works: the call screen is reached, with its library.
    expect(graph.has(join(ROOT, 'components/call/useEncryptedCall.ts'))).toBe(true);
    expect(graph.has('pkg:livekit-client')).toBe(true);
  });

  test('the landing page carries no part of the video call', () => {
    const graph = reachable([join(ROOT, 'app/page.tsx'), join(ROOT, 'app/layout.tsx')]);
    expect(graph.size).toBeGreaterThan(20);
    expect(graph.has('pkg:livekit-client')).toBe(false);
    expect([...graph].filter((f) => f.includes('/components/call/'))).toEqual([]);
  });
});
