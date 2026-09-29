import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { resetDb, useTestDb } from './helpers/db';
import { setDb, type DB } from '@/lib/db';
import { adminAuditLog, appErrors, emailLog, events, waitlistSignups } from '@/lib/db/schema';

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

import { eraseByEmailAction, resendEmailAction } from '@/app/admin/(panel)/system/actions';
import { SESSION_COOKIE, hashPassword, signSession } from '@/lib/admin-auth';
import { humanEmailError } from '@/lib/admin/email-errors';
import {
  analyticsHealth, databaseHealth, emailHealth, envChecklist, listAudit, listEmails, migrationFiles,
  parseAuditQuery, parseEmailQuery, parseEnvExample, summariseMeta,
} from '@/lib/admin/queries/system';
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
afterEach(() => { vi.unstubAllGlobals(); });

describe('the environment checklist', () => {
  test('reads names and their first comment line from .env.example', () => {
    const vars = parseEnvExample('# Postgres, everything. More\n# detail.\nDATABASE_URL=\n\nPLAIN=x\n# Mail through\n# Resend.\nKEY=\nFROM=\n# Who hears.\nALERTS=\nALERTS=\n');
    expect(vars).toEqual([
      { name: 'DATABASE_URL', about: 'Postgres, everything.' },
      { name: 'PLAIN', about: '' },
      { name: 'KEY', about: 'Mail through Resend.' },
      { name: 'FROM', about: 'Mail through Resend.' },
      { name: 'ALERTS', about: 'Who hears.' },
    ]);
  });

  test('says set or not set and never carries a value', () => {
    const secret = 'sk_live_supersecret_value_123';
    const list = envChecklist({ STRIPE_SECRET_KEY: secret, ADMIN_SESSION_SECRET: '   ', DATABASE_URL: 'postgres://u:pw@h/db' });
    const byName = Object.fromEntries(list.map((v) => [v.name, v]));
    expect(byName.STRIPE_SECRET_KEY.set).toBe(true);
    expect(byName.DATABASE_URL.set).toBe(true);
    expect(byName.ADMIN_SESSION_SECRET.set).toBe(false);
    expect(byName.RESEND_API_KEY.set).toBe(false);
    const text = JSON.stringify(list);
    expect(text).not.toContain(secret);
    expect(text).not.toContain('pw@h');
    for (const v of list) expect(Object.keys(v).sort()).toEqual(['about', 'name', 'set']);
  });

  test('falls back to the known list when the example file is missing', () => {
    const list = envChecklist({}, '/nonexistent/.env.example');
    expect(list.map((v) => v.name)).toContain('STRIPE_WEBHOOK_SECRET');
  });
});

describe('health', () => {
  test('the database: answers, reports every migration applied, and counts rows', async () => {
    vi.stubEnv('DATABASE_URL', '');
    await joinWaitlist(db, { role: 'patient', email: 'a@example.com', source: 'hero' });
    const h = await databaseHealth(db);
    expect(h.ok).toBe(true);
    expect(h.driver).toBe('pglite');
    expect(h.latencyMs).toBeGreaterThanOrEqual(0);
    expect(migrationFiles()).toBeGreaterThanOrEqual(2);
    expect(h.migrations).toMatchObject({ applied: migrationFiles(), files: migrationFiles() });
    expect(h.tables.find((t) => t.name === 'waitlist_signups')).toEqual({ name: 'waitlist_signups', rows: 1, approx: false });
    expect(h.tables.map((t) => t.name)).toContain('stripe_events');
  });

  test('email and analytics', async () => {
    const now = new Date();
    await db.insert(emailLog).values([
      { to: 'a@example.com', template: 'patient_welcome', subject: 's', status: 'skipped', error: 'RESEND_API_KEY or EMAIL_FROM not set' },
      { to: 'b@example.com', template: 'patient_welcome', subject: 's', status: 'failed', error: '401: bad key' },
    ]);
    await db.insert(events).values({ type: 'pageview', path: '/', ts: now });
    await db.insert(appErrors).values({ route: '/api/collect', message: 'boom' });
    const mail = await emailHealth(db, now);
    expect(mail.configured).toBe(false);
    expect(mail.week).toEqual({ sent: 0, failed: 1, skipped: 1 });
    expect(await analyticsHealth(db, now)).toMatchObject({ events24h: 1, collectErrors24h: 1 });
  });

  test('email errors read as plain English', () => {
    expect(humanEmailError('RESEND_API_KEY or EMAIL_FROM not set')).toContain('isn’t set up yet (RESEND_API_KEY');
    expect(humanEmailError('401: API key is invalid')).toContain('refused the API key');
    expect(humanEmailError('422: domain not verified')).toContain('rejected the message');
    expect(humanEmailError('The operation was aborted due to timeout')).toContain('within 5 seconds');
    expect(humanEmailError('fetch failed')).toContain('network');
    expect(humanEmailError(null)).toBeNull();
  });
});

describe('the logs', () => {
  test('emails filter by result and template', async () => {
    await db.insert(emailLog).values([
      { to: 'a@example.com', template: 'patient_welcome', subject: 's', status: 'sent' },
      { to: 'b@example.com', template: 'gp_received', subject: 's', status: 'failed', error: 'x' },
    ]);
    expect((await listEmails(db, parseEmailQuery({}))).total).toBe(2);
    expect((await listEmails(db, parseEmailQuery({ status: 'failed' }))).rows.map((r) => r.to)).toEqual(['b@example.com']);
    expect((await listEmails(db, parseEmailQuery({ template: 'patient_welcome' }))).total).toBe(1);
    expect(parseEmailQuery({ status: 'bogus', template: "x'; drop" })).toMatchObject({ status: undefined, template: undefined });
  });

  test('the audit log filters and summarises without listing ids', async () => {
    await db.insert(adminAuditLog).values([
      { adminEmail: 'ops@example.com', action: 'bulk_unsubscribe', meta: { ids: ['a', 'b'], count: 2 } },
      { adminEmail: 'self-service', action: 'self_erasure', target: 'x', meta: { role: 'patient' } },
    ]);
    const all = await listAudit(db, parseAuditQuery({}));
    expect(all.total).toBe(2);
    const bulk = await listAudit(db, parseAuditQuery({ action: 'bulk_unsubscribe' }));
    expect(bulk.rows).toHaveLength(1);
    expect(summariseMeta('bulk_unsubscribe', bulk.rows[0].meta)).toBe('2 patients');
    expect(summariseMeta('mystery', { ids: [1, 2, 3], note: 'hi' })).toBe('ids: 3 items, note: hi');
    expect((await listAudit(db, parseAuditQuery({ admin: 'self-service' }))).rows[0].action).toBe('self_erasure');
  });
});

describe('actions', () => {
  test('both refuse without a session and change nothing', async () => {
    jar.clear();
    await expect(resendEmailAction(1)).rejects.toThrow('NEXT_REDIRECT /admin/login');
    await expect(eraseByEmailAction('a@example.com')).rejects.toThrow('NEXT_REDIRECT /admin/login');
    expect(await db.select().from(adminAuditLog)).toEqual([]);
  });

  test('resend rebuilds the email from the sign-up, sends it and audits', async () => {
    const { signup } = await joinWaitlist(db, { role: 'patient', email: 'amy@example.com', source: 'hero' });
    const [row] = await db.insert(emailLog).values({
      to: 'amy@example.com', template: 'patient_welcome', subject: 's', status: 'skipped', error: 'not set', signupId: signup.id,
    }).returning();
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubEnv('EMAIL_FROM', 'Dr Quick <hello@example.com>');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'msg_1' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await resendEmailAction(row.id)).toEqual({ ok: true, message: 'Email sent.' });
    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.to).toEqual(['amy@example.com']);
    const logs = await db.select().from(emailLog);
    expect(logs.map((l) => l.status).sort()).toEqual(['sent', 'skipped']);
    const [a] = await db.select().from(adminAuditLog);
    expect(a).toMatchObject({ adminEmail: 'ops@example.com', action: 'resend_email', target: signup.id });
    expect(JSON.stringify(a.meta)).not.toContain('amy@');

    // A sent email is not sent twice; an unknown id is refused.
    const sent = logs.find((l) => l.status === 'sent')!;
    expect(await resendEmailAction(sent.id)).toMatchObject({ ok: false });
    expect(await resendEmailAction(99999)).toMatchObject({ ok: false });
  });

  test('resend refuses a row whose sign-up is gone', async () => {
    const [row] = await db.insert(emailLog).values({
      to: 'x@example.com', template: 'patient_welcome', subject: 's', status: 'failed', signupId: '11111111-1111-4111-8111-111111111111',
    }).returning();
    expect(await resendEmailAction(row.id)).toMatchObject({ ok: false, error: expect.stringContaining('no longer exists') });
    expect(await db.select().from(adminAuditLog)).toEqual([]);
  });

  test('erase by email removes both roles and audits a count, never the address', async () => {
    await joinWaitlist(db, { role: 'patient', email: 'cat@example.com', source: 'hero' });
    await joinWaitlist(db, { role: 'gp', email: 'cat@example.com', source: 'hero-gp', name: 'Cat', gmc: '7000001', mobile: '07700900000' });
    await joinWaitlist(db, { role: 'patient', email: 'keep@example.com', source: 'hero' });

    expect(await eraseByEmailAction('not an email')).toMatchObject({ ok: false });
    const result = await eraseByEmailAction('  CAT@example.com ');
    expect(result).toMatchObject({ ok: true, message: expect.stringContaining('2 sign-ups') });
    expect(await db.select().from(waitlistSignups).where(eq(waitlistSignups.email, 'cat@example.com'))).toEqual([]);
    expect(await db.select().from(waitlistSignups)).toHaveLength(1);
    const audits = await db.select().from(adminAuditLog);
    expect(audits.at(-1)).toMatchObject({ action: 'erase_person', target: null, meta: { signupsRemoved: 2, via: 'settings' } });
    expect(JSON.stringify(audits)).not.toContain('cat@');
  });
});
