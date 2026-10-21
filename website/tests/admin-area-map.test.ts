// The role-by-action table of the admin-team design, pinned cell by cell: every
// page, layout, server action and route under app/admin/(panel) is listed with
// the area it must be guarded by. Read with tests/admin-roles-table.test.ts
// (which roles reach which areas) this fixes who can do what. A file or
// exported action the map does not list fails, and so does a listed one that
// no longer exists.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import type { Area } from '@/lib/admin/roles';

const ROOT = join(__dirname, '..');
const PANEL = 'app/admin/(panel)';
const walk = (dir: string): string[] => readdirSync(join(ROOT, dir), { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : /\.tsx?$/.test(e.name) ? [`${dir}/${e.name}`] : []));
const files = walk(PANEL).map((f) => f.slice(PANEL.length + 1)).sort();
const read = (f: string) => readFileSync(join(ROOT, PANEL, f), 'utf8');

const PAGES: Record<string, Area> = {
  'layout.tsx': 'overview',
  'page.tsx': 'overview',
  'no-access/page.tsx': 'overview',
  'waitlist/page.tsx': 'waitlist',
  'waitlist/patients/page.tsx': 'waitlist',
  'waitlist/patients/[id]/page.tsx': 'waitlist',
  'waitlist/gps/page.tsx': 'waitlist',
  'waitlist/gps/[id]/page.tsx': 'waitlist',
  'finance/revenue/page.tsx': 'finance',
  'finance/consultations/page.tsx': 'finance',
  'finance/payouts/page.tsx': 'finance',
  'finance/payouts/[id]/page.tsx': 'finance',
  'analytics/page.tsx': 'analytics',
  'analytics/traffic/page.tsx': 'analytics',
  'analytics/engagement/page.tsx': 'analytics',
  'analytics/funnels/page.tsx': 'analytics',
  'analytics/heatmaps/page.tsx': 'analytics',
  'analytics/live/page.tsx': 'analytics',
  'analytics/visitors/page.tsx': 'analytics',
  'analytics/visitors/[id]/page.tsx': 'analytics',
  'blog/page.tsx': 'blog',
  'blog/new/page.tsx': 'blog',
  'blog/[id]/page.tsx': 'blog',
  'system/emails/page.tsx': 'emails',
  'system/settings/page.tsx': 'settings',
  'system/technical/page.tsx': 'technical',
  'system/audit/page.tsx': 'audit',
  'system/team/page.tsx': 'team',
};

const ROUTES: Record<string, Area> = {
  'waitlist/export/route.ts': 'waitlist_export',
  'finance/revenue/export/route.ts': 'finance',
};

const ACTIONS: Record<string, Record<string, Area>> = {
  'waitlist/actions.ts': {
    setStatusAction: 'waitlist',
    setDoctorPausedAction: 'waitlist',
    sendDoctorLinkAction: 'waitlist',
    saveNotesAction: 'waitlist',
    bulkUnsubscribeAction: 'waitlist',
    resendConfirmationAction: 'waitlist',
    erasePersonAction: 'erase',
  },
  'system/actions.ts': { resendEmailAction: 'emails', eraseByEmailAction: 'erase' },
  'blog/actions.ts': {
    savePostAction: 'blog',
    publishPostAction: 'blog',
    unpublishPostAction: 'blog',
    deletePostAction: 'blog',
  },
  'system/team/actions.ts': {
    addMemberAction: 'team',
    sendLinkAction: 'team',
    changeRoleAction: 'team',
    removeMemberAction: 'team',
  },
};

const guards = (src: string, guard: string) => [...src.matchAll(new RegExp(`await ${guard}\\('([a-z_]+)'\\)`, 'g'))].map((m) => m[1]);

// Each exported async function with the guard calls inside its own body.
function actionsOf(src: string): Record<string, string[]> {
  const parts = src.split(/^export async function (\w+)/m);
  const out: Record<string, string[]> = {};
  for (let i = 1; i < parts.length; i += 2) out[parts[i]] = guards(parts[i + 1], 'actionAdmin');
  return out;
}

test('every page and layout is guarded by exactly its area, and the map lists every one', () => {
  const found = files.filter((f) => /(^|\/)(page|layout)\.tsx$/.test(f));
  expect(found).toEqual(Object.keys(PAGES).sort());
  for (const f of found) expect({ f, areas: guards(read(f), 'requireAdmin') }).toEqual({ f, areas: [PAGES[f]] });
});

test('every route is guarded by exactly its area, and the map lists every one', () => {
  const found = files.filter((f) => /(^|\/)route\.ts$/.test(f));
  expect(found).toEqual(Object.keys(ROUTES).sort());
  for (const f of found) expect({ f, areas: guards(read(f), 'routeAdmin') }).toEqual({ f, areas: [ROUTES[f]] });
});

test('every exported server action is guarded by exactly its area, and the map lists every one', () => {
  const found = files.filter((f) => /(^|\/)actions\.ts$/.test(f));
  expect(found).toEqual(Object.keys(ACTIONS).sort());
  for (const f of found) {
    const actual = actionsOf(read(f));
    expect(Object.keys(actual).sort()).toEqual(Object.keys(ACTIONS[f]).sort());
    for (const [name, areas] of Object.entries(actual)) expect({ f, name, areas }).toEqual({ f, name, areas: [ACTIONS[f][name]] });
  }
});

test('no other file under the panel is a page, route or action file', () => {
  const known = new Set([...Object.keys(PAGES), ...Object.keys(ROUTES), ...Object.keys(ACTIONS)]);
  const guarded = files.filter((f) => /await (requireAdmin|routeAdmin|actionAdmin)\(/.test(read(f)));
  expect(guarded.filter((f) => !known.has(f))).toEqual([]);
});
