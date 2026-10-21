// Every file in the admin panel names the area it belongs to, so a new page,
// action or route that forgets is caught here and not by a colleague who opens it.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { AREAS } from '@/lib/admin/roles';

const ROOT = join(__dirname, '..');
const PANEL = 'app/admin/(panel)';
const walk = (dir: string): string[] => readdirSync(join(ROOT, dir), { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : /\.tsx?$/.test(e.name) ? [`${dir}/${e.name}`] : []));
const files = walk(PANEL);
const read = (f: string) => readFileSync(join(ROOT, f), 'utf8');
const areasIn = (src: string, guard: string) => [...src.matchAll(new RegExp(`await ${guard}\\('([a-z_]+)'\\)`, 'g'))].map((m) => m[1]);
const valid = (areas: string[]) => areas.length > 0 && areas.every((a) => (AREAS as readonly string[]).includes(a));

test('every page and layout calls requireAdmin with a real area', () => {
  const pages = files.filter((f) => /\/(page|layout)\.tsx$/.test(f));
  expect(pages.length).toBeGreaterThan(25);
  expect(pages.filter((f) => !valid(areasIn(read(f), 'requireAdmin')))).toEqual([]);
});

test('every exported server action calls actionAdmin with a real area', () => {
  for (const f of files.filter((f) => f.endsWith('/actions.ts'))) {
    const src = read(f);
    const exported = src.match(/^export async function /gm)?.length ?? 0;
    const areas = areasIn(src, 'actionAdmin');
    expect({ f, guarded: areas.length, valid: valid(areas) }).toEqual({ f, guarded: exported, valid: true });
  }
});

test('every route handler calls routeAdmin with a real area', () => {
  expect(files.filter((f) => f.endsWith('/route.ts') && !valid(areasIn(read(f), 'routeAdmin')))).toEqual([]);
});

test('nothing in the panel uses a guard without an area', () => {
  expect(files.filter((f) => /\brequireAdmin\(\)|\bcurrentAdmin\(/.test(read(f)))).toEqual([]);
});
