import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { resetDb, useTestDb } from './helpers/db';
import { addTestMember } from './helpers/admin';
import { setDb, type DB } from '@/lib/db';
import { adminAuditLog, visitors, waitlistSignups } from '@/lib/db/schema';

let db: DB;
beforeAll(async () => { db = await useTestDb(); });

const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: async () => new Headers(),
}));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => { throw new Error(`NEXT_REDIRECT ${to}`); },
  notFound: () => { throw new Error('NEXT_NOT_FOUND'); },
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/admin/analytics/visitors',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { savePostAction } from '@/app/admin/(panel)/blog/actions';
import { GET as revenueCsv } from '@/app/admin/(panel)/finance/revenue/export/route';
import { resendEmailAction, eraseByEmailAction } from '@/app/admin/(panel)/system/actions';
import { erasePersonAction, saveNotesAction, setStatusAction } from '@/app/admin/(panel)/waitlist/actions';
import { GET as exportCsv } from '@/app/admin/(panel)/waitlist/export/route';
import { NOT_YOUR_ROLE, SESSION_COOKIE } from '@/lib/admin-auth';
import type { Role } from '@/lib/admin/roles';
import { joinWaitlist } from '@/lib/waitlist';

beforeEach(async () => {
  setDb(db);
  vi.unstubAllEnvs();
  vi.stubEnv('ADMIN_SESSION_SECRET', 'y'.repeat(40));
  vi.stubEnv('ADMIN_USERS', '');
  vi.stubEnv('RESEND_API_KEY', '');
  vi.stubEnv('EMAIL_FROM', '');
  jar.clear();
  await resetDb(db);
});

async function as(role: Role) {
  const m = await addTestMember(db, role);
  jar.set(SESSION_COOKIE, m.token);
}
const auditRows = () => db.select().from(adminAuditLog);
const row = async (id: string) => (await db.select().from(waitlistSignups).where(eq(waitlistSignups.id, id)))[0];
async function seed() {
  const g = await joinWaitlist(db, { role: 'gp', email: 'gp@example.com', source: 'hero-gp', name: 'Dr Gee', gmc: '7123456', mobile: '07700 900123' });
  return { g: g.signup };
}

test('Operations works the waitlist but can neither erase it nor download it, and refusals write no audit', async () => {
  const { g } = await seed(); await as('operations');
  expect(await setStatusAction(g.id, 'contacted')).toMatchObject({ ok: true });
  expect(await erasePersonAction(g.id)).toEqual(NOT_YOUR_ROLE);
  expect(await eraseByEmailAction('gp@example.com')).toEqual(NOT_YOUR_ROLE);
  expect((await exportCsv(new Request('http://localhost/admin/waitlist/export?role=gp'))).status).toBe(403);
  expect(await resendEmailAction(999)).toEqual({ ok: false, error: 'That email is not in the log.' }); // past the guard
  expect(await row(g.id)).toBeDefined();
  expect((await auditRows()).map((r) => r.action)).toEqual(['status_change']);
});

test('Finance downloads revenue and cannot touch the waitlist or the blog', async () => {
  const { g } = await seed(); await as('finance');
  expect((await revenueCsv(new Request('http://localhost/admin/finance/revenue/export'))).status).toBe(200);
  expect(await setStatusAction(g.id, 'contacted')).toEqual(NOT_YOUR_ROLE);
  expect(await savePostAction(null, {})).toEqual(NOT_YOUR_ROLE);
});

test('Marketing reaches the blog and not the waitlist', async () => {
  const { g } = await seed(); await as('marketing');
  expect(await savePostAction(null, {})).not.toEqual(NOT_YOUR_ROLE);
  expect(await saveNotesAction(g.id, 'x')).toEqual(NOT_YOUR_ROLE);
});

test('a page outside your role sends you to the no-access page', async () => {
  await as('marketing');
  const { default: RevenuePage } = await import('@/app/admin/(panel)/finance/revenue/page');
  await expect(RevenuePage({ searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_REDIRECT /admin/no-access');
});

test('the visitor pages show a sign-up email to an Admin and never to Marketing', async () => {
  const vid = '11111111-2222-4333-8444-555555555555';
  await db.insert(visitors).values({ id: vid, firstSeen: new Date(), lastSeen: new Date() });
  await joinWaitlist(db, { role: 'gp', email: 'dr.who@example.com', source: 'hero-gp', name: 'Dr Who', gmc: '7123457', mobile: '07700 900124', visitorId: vid });
  const { default: List } = await import('@/app/admin/(panel)/analytics/visitors/page');
  const { default: One } = await import('@/app/admin/(panel)/analytics/visitors/[id]/page');
  const html = async () => ({
    list: renderToStaticMarkup(await List({ searchParams: Promise.resolve({}) })),
    one: renderToStaticMarkup(await One({ params: Promise.resolve({ id: vid }) })),
  });

  await as('marketing');
  const marketing = await html();
  expect(marketing.list).toContain(vid.slice(0, 8)); // the page rendered, with the short id
  expect(marketing.one).toContain(vid.slice(0, 8));
  expect(marketing.list + marketing.one).not.toContain('dr.who@example.com');
  expect(marketing.list + marketing.one).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i); // no address of any kind

  await resetDb(db); // the visitor and sign-up go with it
  await db.insert(visitors).values({ id: vid, firstSeen: new Date(), lastSeen: new Date() });
  await joinWaitlist(db, { role: 'gp', email: 'dr.who@example.com', source: 'hero-gp', name: 'Dr Who', gmc: '7123457', mobile: '07700 900124', visitorId: vid });
  await as('admin');
  const ops = await html();
  expect(ops.list).toContain('dr.who@example.com');
  expect(ops.one).toContain('dr.who@example.com');
});
