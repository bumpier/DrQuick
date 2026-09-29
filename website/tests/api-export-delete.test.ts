import { test, expect, beforeAll, beforeEach, describe, vi } from 'vitest';
import { resetDb, useTestDb } from './helpers/db';
import { setDb, type DB } from '@/lib/db';
import { events, sessions, visitors, waitlistSignups } from '@/lib/db/schema';
import { joinWaitlist } from '@/lib/waitlist';
import { eq } from 'drizzle-orm';
import { GET, csvCell } from '@/app/api/waitlist-export/route';
import { POST as DELETE_POST } from '@/app/api/waitlist-delete/route';

let db: DB;
beforeAll(async () => { db = await useTestDb(); });

beforeEach(async () => {
  vi.unstubAllEnvs();
  vi.stubEnv('WAITLIST_EXPORT_TOKEN', 'secret-token');
  setDb(db);
  await resetDb(db);
});

const at = (iso: string) => new Date(iso);

const exportReq = (auth?: string) =>
  new Request('http://localhost/api/waitlist-export', {
    headers: auth ? { authorization: auth } : {},
  });
const deleteReq = (body: unknown, auth?: string) =>
  new Request('http://localhost/api/waitlist-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { authorization: auth } : {}) },
    body: JSON.stringify(body),
  });

describe('csvCell', () => {
  test('escapes the formula-leading characters', () => {
    for (const evil of ['=1+1', '+441234', '-2', '@SUM(A1)', '\tx', '\rx']) {
      expect(csvCell(evil).startsWith(`"'`)).toBe(true);
    }
  });
  test('doubles quotes and passes ordinary values through', () => {
    expect(csvCell('a"b')).toBe('"a""b"');
    expect(csvCell('name@example.com')).toBe('"name@example.com"');
    expect(csvCell(null)).toBe('""');
  });
});

describe('authorisation', () => {
  test('with no WAITLIST_EXPORT_TOKEN set, every request is refused', async () => {
    vi.stubEnv('WAITLIST_EXPORT_TOKEN', '');
    expect((await GET(exportReq('Bearer anything'))).status).toBe(401);
    expect((await DELETE_POST(deleteReq({ email: 'a@b.co' }, 'Bearer anything'))).status).toBe(401);
  });
  test('a wrong or missing token is 401', async () => {
    expect((await GET(exportReq())).status).toBe(401);
    expect((await GET(exportReq('Bearer wrong'))).status).toBe(401);
    expect((await GET(exportReq('Bearer secret-token!'))).status).toBe(401); // length mismatch path
  });
});

test('export renders CSV oldest first, with escaped cells', async () => {
  await joinWaitlist(db, { role: 'patient', email: 'b@example.com', source: 'hero' });
  await joinWaitlist(db, { role: 'gp', email: '=evil@example.com', source: 'recap-gp', name: 'N', mobile: '07700900123', gmc: '1234567' });
  await db.update(waitlistSignups).set({ createdAt: at('2026-08-02T00:00:00Z') }).where(eq(waitlistSignups.email, 'b@example.com'));
  await db.update(waitlistSignups).set({ createdAt: at('2026-08-01T00:00:00Z') }).where(eq(waitlistSignups.email, '=evil@example.com'));
  const res = await GET(exportReq('Bearer secret-token'));
  expect(res.status).toBe(200);
  expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
  expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="dr-quick-waitlist.csv"');
  const lines = (await res.text()).split('\n');
  expect(lines[0]).toBe('email,role,name,mobile,gmc,source,status,utm_source,joined_at');
  expect(lines[1]).toBe(`"'=evil@example.com","gp","N","07700900123","1234567","recap-gp","new","","2026-08-01T00:00:00.000Z"`);
  expect(lines[2]).toBe('"b@example.com","patient","","","","hero","subscribed","","2026-08-02T00:00:00.000Z"');
});

test('export with no database is 503; a read failure is 502', async () => {
  setDb(null);
  expect((await GET(exportReq('Bearer secret-token'))).status).toBe(503);
  setDb({ select: () => { throw new Error('down'); } } as unknown as DB);
  expect((await GET(exportReq('Bearer secret-token'))).status).toBe(502);
});

test('delete erases every sign-up for the address and the analytics linked to it', async () => {
  const visitor = '0f8e2a8c-3b1d-4c55-9d0e-1a2b3c4d5e6f';
  const now = new Date();
  await db.insert(visitors).values({ id: visitor, firstSeen: now, lastSeen: now });
  await db.insert(sessions).values({
    id: '1f8e2a8c-3b1d-4c55-9d0e-1a2b3c4d5e6f', visitorId: visitor, startedAt: now, lastSeen: now,
    entryPath: '/', exitPath: '/', currentPath: '/', device: 'desktop', browser: 'Chrome', os: 'macOS',
  });
  await db.insert(events).values({ visitorId: visitor, type: 'pageview', path: '/', ts: now });
  await joinWaitlist(db, { role: 'patient', email: 'a@b.co', source: 'hero', visitorId: visitor });
  await joinWaitlist(db, { role: 'gp', email: 'a@b.co', source: 'hero-gp', name: 'N', mobile: '07700900123', gmc: '1234567' });
  await joinWaitlist(db, { role: 'patient', email: 'keep@b.co', source: 'hero' });

  const res = await DELETE_POST(deleteReq({ email: ' A@B.CO ' }, 'Bearer secret-token'));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, removed: 2 });
  expect((await db.select().from(waitlistSignups)).map((r) => r.email)).toEqual(['keep@b.co']);
  expect(await db.select().from(visitors)).toEqual([]);
  expect(await db.select().from(sessions)).toEqual([]);
  expect(await db.select().from(events)).toEqual([]);
});

test('delete validates the email', async () => {
  expect((await DELETE_POST(deleteReq({ email: 'not-an-email' }, 'Bearer secret-token'))).status).toBe(400);
});
