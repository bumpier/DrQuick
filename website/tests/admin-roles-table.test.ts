import { expect, test } from 'vitest';
import { AREAS, ROLES, ROLE_LABELS, can, isRole, type Area, type Role } from '@/lib/admin/roles';

// In AREAS order.
const ALLOWED: Record<Role, Area[]> = {
  admin: [...AREAS],
  operations: ['overview', 'waitlist', 'emails'],
  finance: ['overview', 'finance'],
  marketing: ['overview', 'analytics', 'blog'],
};

test('each role reaches exactly the areas the design gives it', () => {
  for (const role of ROLES) expect(AREAS.filter((a) => can(role, a))).toEqual(ALLOWED[role]);
});

test('the admin-only areas belong to Admin alone', () => {
  for (const area of ['team', 'settings', 'technical', 'audit', 'waitlist_export', 'erase'] as const) {
    expect(ROLES.filter((r) => can(r, area))).toEqual(['admin']);
  }
});

test('labels', () => {
  expect(ROLE_LABELS).toEqual({ admin: 'Admin', operations: 'Operations', finance: 'Finance', marketing: 'Marketing' });
});

test('isRole accepts the four values and nothing else', () => {
  expect(ROLES.every(isRole)).toBe(true);
  for (const v of ['Finance', 'owner', '', null, undefined, 3]) expect(isRole(v)).toBe(false);
});
