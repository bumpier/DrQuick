import { expect, test } from 'vitest';
import { navFor } from '@/components/admin/nav';
import { overviewTilesFor } from '@/lib/admin/roles';
import { visitorQueryFor } from '@/lib/admin/queries/visitors';

const shape = (role: Parameters<typeof navFor>[0]) => navFor(role).map((g) => [g.label, g.items.map((i) => i.label)]);

test('each role’s sidebar holds its own sections and no empty groups', () => {
  expect(shape('operations')).toEqual([['Home', ['Overview']], ['Waitlist', ['Patients', 'GPs']], ['System', ['Emails']]]);
  expect(shape('finance')).toEqual([['Home', ['Overview']], ['Finance', ['Revenue', 'Consultations', 'Payouts']]]);
  expect(shape('marketing')).toEqual([['Home', ['Overview']], ['Analytics', ['Traffic', 'Engagement', 'Funnels', 'Heatmaps', 'Visitors', 'Live']], ['Content', ['Blog']]]);
  expect(shape('admin').find(([label]) => label === 'System')).toEqual(['System', ['Team', 'Technical', 'Emails', 'Audit log', 'Settings']]);
});

test('each role’s overview tiles', () => {
  expect(overviewTilesFor('admin')).toEqual({ analytics: true, signups: true, latestGps: true, finance: true });
  expect(overviewTilesFor('operations')).toEqual({ analytics: false, signups: true, latestGps: true, finance: false });
  expect(overviewTilesFor('finance')).toEqual({ analytics: false, signups: false, latestGps: false, finance: true });
  expect(overviewTilesFor('marketing')).toEqual({ analytics: true, signups: true, latestGps: false, finance: false });
});

test('a visitor search by email is ignored for a role that cannot see emails', () => {
  const params = { q: 'someone@example.com', signed: 'yes' };
  expect(visitorQueryFor(params, true).q).toBe('someone@example.com');
  expect(visitorQueryFor(params, false)).toMatchObject({ q: undefined, signed: 'yes' });
});
