import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { resetDb, useTestDb } from './helpers/db';
import { setDb, type DB } from '@/lib/db';
import { adminAuditLog, emailLog, events, sessions, visitors, waitlistSignups } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

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
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import {
  bulkUnsubscribeAction, erasePersonAction, resendConfirmationAction, saveNotesAction, setStatusAction,
} from '@/app/admin/(panel)/waitlist/actions';
import { GET as exportCsv } from '@/app/admin/(panel)/waitlist/export/route';
import { SESSION_COOKIE, hashPassword, signSession } from '@/lib/admin-auth';
import { gpBoard, listSignups, parseListQuery } from '@/lib/admin/queries/waitlist';
import { visitorJourney } from '@/lib/admin/queries/journey';
import { joinWaitlist } from '@/lib/waitlist';

const HASH = hashPassword('correct horse battery');

beforeEach(async () => {
  setDb(db);
  vi.unstubAllEnvs();
  vi.stubEnv('ADMIN_SESSION_SECRET', 'y'.repeat(40));
  vi.stubEnv('ADMIN_USERS', `ops@example.com|Olu Ops|${HASH}`);
  vi.stubEnv('RESEND_API_KEY', '');
  vi.stubEnv('EMAIL_FROM', '');
  jar.clear();
  jar.set(SESSION_COOKIE, signSession('ops@example.com')!);
  await resetDb(db);
});

const auditRows = () => db.select().from(adminAuditLog);
const row = async (id: string) => (await db.select().from(waitlistSignups).where(eq(waitlistSignups.id, id)))[0];

async function seed() {
  const a = await joinWaitlist(db, { role: 'patient', email: 'amy@example.com', source: 'hero' });
  const b = await joinWaitlist(db, { role: 'patient', email: 'ben@example.com', source: 'recap', utmSource: 'newsletter' });
  const c = await joinWaitlist(db, { role: 'patient', email: 'cat_1@example.com', source: 'hero' });
  const g = await joinWaitlist(db, { role: 'gp', email: 'gp@example.com', source: 'hero-gp', name: 'Dr Gee', gmc: '7123456', mobile: '07700 900123' });
  // Distinct, ordered join times.
  const times = ['2026-09-01T10:00:00Z', '2026-09-02T10:00:00Z', '2026-09-03T10:00:00Z', '2026-09-04T10:00:00Z'];
  for (const [i, s] of [a, b, c, g].entries()) {
    await db.update(waitlistSignups).set({ createdAt: new Date(times[i]) }).where(eq(waitlistSignups.id, s.signup.id));
  }
  return { a: a.signup, b: b.signup, c: c.signup, g: g.signup };
}

describe('every action and the export refuse a visitor with no session', () => {
  test('server actions redirect to sign-in and change nothing', async () => {
    const { a } = await seed();
    jar.clear();
    await expect(setStatusAction(a.id, 'unsubscribed')).rejects.toThrow('NEXT_REDIRECT /admin/login');
    await expect(saveNotesAction(a.id, 'x')).rejects.toThrow('NEXT_REDIRECT /admin/login');
    await expect(bulkUnsubscribeAction([a.id])).rejects.toThrow('NEXT_REDIRECT /admin/login');
    await expect(resendConfirmationAction(a.id)).rejects.toThrow('NEXT_REDIRECT /admin/login');
    await expect(erasePersonAction(a.id)).rejects.toThrow('NEXT_REDIRECT /admin/login');
    expect((await row(a.id)).status).toBe('subscribed');
    expect(await auditRows()).toEqual([]);
  });

  test('a forged session is refused too', async () => {
    const { a } = await seed();
    jar.set(SESSION_COOKIE, 'eyJlbWFpbCI6ImEifQ.forged');
    await expect(erasePersonAction(a.id)).rejects.toThrow('NEXT_REDIRECT /admin/login');
    expect(await row(a.id)).toBeDefined();
  });

  test('the CSV export answers 401 without a session', async () => {
    await seed();
    jar.clear();
    const res = await exportCsv(new Request('http://localhost/admin/waitlist/export?role=patient'));
    expect(res.status).toBe(401);
    expect(await auditRows()).toEqual([]);
  });
});

describe('the list query', () => {
  test('searches, filters, sorts and pages on the server', async () => {
    await seed();
    const q = (params: Record<string, string>) => listSignups(db, parseListQuery('patient', params));

    const all = await q({});
    expect(all.total).toBe(3);
    expect(all.rows.map((r) => r.email)).toEqual(['cat_1@example.com', 'ben@example.com', 'amy@example.com']); // newest first

    expect((await q({ sort: 'email', dir: 'asc' })).rows.map((r) => r.email)).toEqual(['amy@example.com', 'ben@example.com', 'cat_1@example.com']);
    expect((await q({ q: 'BEN' })).rows.map((r) => r.email)).toEqual(['ben@example.com']);
    expect((await q({ q: '_' })).rows.map((r) => r.email)).toEqual(['cat_1@example.com']); // underscore is literal
    expect((await q({ source: 'hero' })).total).toBe(2);
    expect((await q({ status: 'unsubscribed' })).total).toBe(0);
    expect((await q({ status: 'active' })).total).toBe(3); // not a patient status: ignored

    const paged = await listSignups(db, { ...parseListQuery('patient', { sort: 'email', dir: 'asc', page: '2' }), pageSize: 2 });
    expect(paged).toMatchObject({ total: 3, page: 2, pages: 2 });
    expect(paged.rows.map((r) => r.email)).toEqual(['cat_1@example.com']);
    // A page past the end shows the last page rather than nothing.
    expect((await listSignups(db, { ...parseListQuery('patient', { page: '99' }), pageSize: 2 })).page).toBe(2);
  });

  test('the GP board groups applications by pipeline status', async () => {
    const { g } = await seed();
    const board = await gpBoard(db);
    expect(board.map((c) => c.status)).toEqual(['new', 'contacted', 'gmc_verified', 'onboarding', 'active', 'rejected']);
    expect(board[0].cards.map((c) => c.id)).toEqual([g.id]);
  });
});

describe('changing a sign-up', () => {
  test('a GP moves along the pipeline, and the change is audited without the address', async () => {
    const { g } = await seed();
    expect(await setStatusAction(g.id, 'gmc_verified')).toMatchObject({ ok: true });
    expect((await row(g.id)).status).toBe('gmc_verified');
    const [entry] = await auditRows();
    expect(entry).toMatchObject({ adminEmail: 'ops@example.com', action: 'status_change', target: g.id, meta: { role: 'gp', from: 'new', to: 'gmc_verified' } });
    expect(JSON.stringify(entry)).not.toContain('gp@example.com');
  });

  test('a status the role cannot have is refused', async () => {
    const { a, g } = await seed();
    expect(await setStatusAction(a.id, 'active')).toMatchObject({ ok: false });
    expect(await setStatusAction(g.id, 'unsubscribed')).toMatchObject({ ok: false });
    expect(await setStatusAction('not-a-uuid', 'new')).toMatchObject({ ok: false });
    expect(await auditRows()).toEqual([]);
  });

  test('unsubscribing a patient stamps the time; resubscribing clears it', async () => {
    const { a } = await seed();
    await setStatusAction(a.id, 'unsubscribed');
    expect((await row(a.id)).unsubscribedAt).toBeInstanceOf(Date);
    await setStatusAction(a.id, 'subscribed');
    expect((await row(a.id)).unsubscribedAt).toBeNull();
  });

  test('notes are saved and audited by length only', async () => {
    const { g } = await seed();
    expect(await saveNotesAction(g.id, 'Called Tuesday, keen.')).toMatchObject({ ok: true });
    expect((await row(g.id)).notes).toBe('Called Tuesday, keen.');
    expect((await auditRows())[0]).toMatchObject({ action: 'notes_update', meta: { length: 21 } });
    expect(await saveNotesAction(g.id, 'x'.repeat(5001))).toMatchObject({ ok: false });
  });

  test('bulk unsubscribe touches subscribed patients only', async () => {
    const { a, b, g } = await seed();
    const result = await bulkUnsubscribeAction([a.id, b.id, g.id, 'junk']);
    expect(result).toMatchObject({ ok: true, message: '2 patients unsubscribed.' });
    expect((await row(a.id)).status).toBe('unsubscribed');
    expect((await row(g.id)).status).toBe('new');
    expect((await auditRows())[0]).toMatchObject({ action: 'bulk_unsubscribe', meta: { count: 2 } });
    expect(await bulkUnsubscribeAction([])).toMatchObject({ ok: false });
  });

  test('resending with no email provider logs a skipped send and says so', async () => {
    const { g } = await seed();
    const result = await resendConfirmationAction(g.id);
    expect(result.ok).toBe(false);
    const log = await db.select().from(emailLog).where(eq(emailLog.signupId, g.id));
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ template: 'gp_received', status: 'skipped', to: 'gp@example.com' });
    expect((await auditRows())[0]).toMatchObject({ action: 'resend_confirmation', target: g.id, meta: { status: 'skipped' } });
  });
});

describe('erasing a person', () => {
  test('removes both roles for the address, their visit history and emails, audits, and returns to the list', async () => {
    const vid = '44444444-4444-4444-8444-444444444444';
    const p = await joinWaitlist(db, { role: 'patient', email: 'both@example.com', source: 'hero', visitorId: vid });
    await joinWaitlist(db, { role: 'gp', email: 'both@example.com', source: 'hero-gp', name: 'Dr Both', gmc: '7000001' });
    const keep = await joinWaitlist(db, { role: 'patient', email: 'keep@example.com', source: 'hero' });
    await db.insert(visitors).values({ id: vid, firstSeen: new Date(), lastSeen: new Date() });
    await db.insert(sessions).values({
      id: '55555555-5555-4555-8555-555555555555', visitorId: vid, startedAt: new Date(), lastSeen: new Date(),
      entryPath: '/', exitPath: '/', currentPath: '/', device: 'desktop', browser: 'Chrome', os: 'macOS',
    });
    await db.insert(events).values({ sessionId: '55555555-5555-4555-8555-555555555555', visitorId: vid, type: 'pageview', path: '/', ts: new Date() });
    await db.insert(emailLog).values({ to: 'team@example.com', template: 'admin_new_gp', subject: 'New GP', status: 'sent', signupId: p.signup.id });

    expect((await visitorJourney(db, vid))?.sessions[0].events).toHaveLength(1);
    await expect(erasePersonAction(p.signup.id)).rejects.toThrow('NEXT_REDIRECT /admin/waitlist/patients?notice=erased');

    const left = await db.select().from(waitlistSignups);
    expect(left.map((r) => r.id)).toEqual([keep.signup.id]);
    expect(await db.select().from(sessions)).toEqual([]);
    expect(await db.select().from(events)).toEqual([]);
    expect(await db.select().from(emailLog)).toEqual([]);
    const [entry] = await auditRows();
    expect(entry).toMatchObject({ action: 'erase_person', target: p.signup.id, meta: { signupsRemoved: 2 } });
    expect(JSON.stringify(entry)).not.toContain('both@example.com');
  });
});

describe('the CSV export', () => {
  test('downloads the filtered list and audits it', async () => {
    await seed();
    const res = await exportCsv(new Request('http://localhost/admin/waitlist/export?role=patient&source=hero'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toMatch(/drquick-patients-\d{4}-\d{2}-\d{2}\.csv/);
    const lines = (await res.text()).split('\n');
    expect(lines).toHaveLength(3);
    expect(lines.slice(1).every((l) => l.includes('"hero"'))).toBe(true);
    expect((await auditRows())[0]).toMatchObject({ action: 'export_csv', target: 'patient', meta: { rows: 2 } });
  });
});
