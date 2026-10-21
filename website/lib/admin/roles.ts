// The admin team's roles and the areas of the admin panel each one reaches.
// This is the one place access is defined: the panel's navigation, every
// server action and the team pages read `can()`, so a change here is a change
// to what every role may do. This module imports nothing on purpose:
// lib/db/schema.ts imports it by relative path (drizzle-kit reads the schema
// outside the bundler) and client components import it too, so anything it
// pulled in would be pulled into both.

export const ROLES = ['admin', 'operations', 'finance', 'marketing'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  operations: 'Operations',
  finance: 'Finance',
  marketing: 'Marketing',
};

export const ROLE_SUMMARIES: Record<Role, string> = {
  admin: 'Everything, including the team',
  operations: 'The waitlist and emails',
  finance: 'Finance',
  marketing: 'Analytics and the blog',
};

export const AREAS = [
  'overview',
  'waitlist',
  'waitlist_export',
  'erase',
  'emails',
  'analytics',
  'finance',
  'blog',
  'team',
  'settings',
  'technical',
  'audit',
] as const;
export type Area = (typeof AREAS)[number];

const ACCESS: Record<Role, readonly Area[]> = {
  admin: AREAS,
  operations: ['overview', 'waitlist', 'emails'],
  finance: ['overview', 'finance'],
  marketing: ['overview', 'analytics', 'blog'],
};

export function can(role: Role, area: Area): boolean {
  return ACCESS[role].includes(area);
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

// Which blocks of the Overview a role gets. The sign-up counts are counts
// only, so Marketing sees them with Analytics; the list of GP applications
// names people, so it follows the waitlist.
export function overviewTilesFor(role: Role): { analytics: boolean; signups: boolean; latestGps: boolean; finance: boolean } {
  return {
    analytics: can(role, 'analytics'),
    signups: can(role, 'waitlist') || can(role, 'analytics'),
    latestGps: can(role, 'waitlist'),
    finance: can(role, 'finance'),
  };
}

// An admin as the panel knows them. `id` is null for an ADMIN_USERS backstop
// entry, which is not a row in admin_users and so has no id to audit against.
export type Admin = { id: string | null; email: string; name: string; role: Role };
