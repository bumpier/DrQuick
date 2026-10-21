// @vitest-environment jsdom
import { randomBytes } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/navigation', async () => ({
  ...(await import('./helpers/next-navigation')),
  notFound: () => { throw new Error('NEXT_NOT_FOUND'); },
}));
vi.mock('@/lib/video/livekit', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/video/livekit')>();
  return { ...real, ensureRoom: vi.fn(async () => undefined), closeRoom: vi.fn(async () => true), removeParticipant: vi.fn(async () => true) };
});

import { setDb, type DB } from '@/lib/db';
import { consultationCalls, consultations, gps, patients } from '@/lib/db/schema';
import { DEMO_DOCTOR, assertLocal, seedDoctorDemo } from '@/lib/dev/seed-doctor';
import { DEMO_COOKIE, signDemoSession } from '@/lib/demo/session';
import { doctorLoginAllowed } from '@/lib/doctor-auth';
import { hit, rowsOf } from '@/lib/rate-limit';
import { goOnline } from '@/lib/doctor/shift';
import { openCall } from '@/lib/video/calls';
import { demoGuard } from '@/lib/demo/guard';
import { demoStatus, resetDemo } from '@/lib/demo/reset';
import { resetDb, useTestDb } from './helpers/db';
import DemoPage from '@/app/dev/demo/page';

let db: DB;
beforeAll(async () => { db = await useTestDb(); });
beforeEach(async () => {
  setDb(db);
  await resetDb(db);
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('NEXT_PUBLIC_DEMO', '1');
  vi.stubEnv('DATABASE_URL', '');
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

const req = (host: string, headers: Record<string, string> = {}) =>
  new Request(`http://${host}/dev/demo/reset`, { method: 'POST', headers: { host, ...headers } });

describe('demoGuard', () => {
  test('404 with the demo off', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO', '');
    expect(demoGuard(req('localhost:3100'))?.status).toBe(404);
  });
  test('403 not_local from another machine or another site', async () => {
    const lan = demoGuard(req('192.168.1.37:3100'));
    expect(lan?.status).toBe(403);
    expect(await lan!.json()).toEqual({ error: 'not_local' });
    expect(demoGuard(req('localhost:3100', { 'sec-fetch-site': 'cross-site' }))?.status).toBe(403);
  });
  test('403 against a database on another machine', () => {
    vi.stubEnv('DATABASE_URL', 'postgres://u:p@db.example.com/x');
    expect(demoGuard(req('localhost:3100'))?.status).toBe(403);
  });
  test('allows this machine, same origin or no header', () => {
    expect(demoGuard(req('localhost:3100'))).toBeNull();
    expect(demoGuard(req('127.0.0.1:3100', { 'sec-fetch-site': 'same-origin' }))).toBeNull();
    expect(demoGuard(req('[::1]:3100'))).toBeNull();
  });
  test('refusals are not cached', () => {
    expect(demoGuard(req('192.168.1.37:3100'))?.headers.get('cache-control')).toBe('no-store');
  });
});

// The demo deployment at demo.drquick.co.uk (docs/superpowers/plans/2026-10-19-
// live-demo-deployment.md): any Host, but only with the passcode session, from
// this site, against a database named for the demo on the same machine.
const DEMO_DB = 'postgres://u:p@127.0.0.1:5432/drquick_demo';
function demoDeploymentEnv() {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('NEXT_PUBLIC_DEMO', '1');
  vi.stubEnv('DEMO_DEPLOYMENT', '1');
  vi.stubEnv('DEMO_PASSCODE', 'river-otter-harbour-42');
  vi.stubEnv('DEMO_SESSION_SECRET', 'k'.repeat(40));
  vi.stubEnv('DATABASE_URL', DEMO_DB);
}

describe('assertLocal in the demo deployment', () => {
  beforeEach(demoDeploymentEnv);

  test('allows the demo’s own database on this machine', () => {
    expect(() => assertLocal()).not.toThrow();
    vi.stubEnv('DATABASE_URL', 'postgres://u:p@localhost/drquick_demo?sslmode=disable');
    expect(() => assertLocal()).not.toThrow();
  });

  test('refuses the real database, a remote one, and none at all', () => {
    vi.stubEnv('DATABASE_URL', 'postgres://u:p@127.0.0.1:5432/drquick');
    expect(() => assertLocal()).toThrow(/demo/);
    vi.stubEnv('DATABASE_URL', 'postgres://u:p@127.0.0.1:5432/drquick?options=demo');
    expect(() => assertLocal()).toThrow(/demo/);
    vi.stubEnv('DATABASE_URL', 'postgres://u:p@db.example.com:5432/drquick_demo');
    expect(() => assertLocal()).toThrow(/local/);
    vi.stubEnv('DATABASE_URL', '');
    expect(() => assertLocal()).toThrow();
  });

  // postgres.js sends unknown query parameters in its startup message, so a
  // `database` there would connect to the real database under a demo path.
  test('refuses a database named in the query, whatever the path says', () => {
    for (const url of [
      `${DEMO_DB}?database=drquick`, `${DEMO_DB}?DATABASE=drquick`, `${DEMO_DB}?db=drquick`, `${DEMO_DB}?dbname=drquick`,
      `${DEMO_DB}?DbName=drquick_demo`, `${DEMO_DB}?sslmode=disable&database=drquick`, `${DEMO_DB}?database`,
    ]) {
      vi.stubEnv('DATABASE_URL', url);
      expect(() => assertLocal(), url).toThrow(/demo/);
    }
    vi.stubEnv('DATABASE_URL', `${DEMO_DB}?sslmode=disable&application_name=demo`);
    expect(() => assertLocal()).not.toThrow();
  });

  test('a production server that is not the demo deployment refuses, whatever its database', () => {
    vi.stubEnv('DEMO_DEPLOYMENT', '');
    expect(() => assertLocal()).toThrow(/production/);
  });
});

describe('demoGuard in the demo deployment', () => {
  const at = (headers: Record<string, string> = {}) =>
    new Request('https://demo.drquick.co.uk/dev/demo/reset', { method: 'POST', headers: { host: 'demo.drquick.co.uk', ...headers } });
  const session = () => `${DEMO_COOKIE}=${signDemoSession()}`;
  beforeEach(demoDeploymentEnv);

  test('accepts its own Host with the passcode session, from this site', () => {
    expect(demoGuard(at({ cookie: session() }))).toBeNull();
    expect(demoGuard(at({ cookie: session(), 'sec-fetch-site': 'same-origin' }))).toBeNull();
  });

  test('403 demo_locked without the session, with a bad one, or from another site', async () => {
    for (const request of [
      at(), at({ cookie: `${DEMO_COOKIE}=forged` }),
      at({ cookie: session(), 'sec-fetch-site': 'cross-site' }), at({ cookie: session(), 'sec-fetch-site': 'same-site' }),
    ]) {
      const refused = demoGuard(request);
      expect(refused?.status).toBe(403);
      expect(await refused!.json()).toEqual({ error: 'demo_locked' });
      expect(refused!.headers.get('cache-control')).toBe('no-store');
    }
  });

  // A database that is not the demo's leaves the deployment unconfigured
  // (lib/demo/database.ts), which voids every session: refused before the
  // route's own database check (assertLocal, above) is even reached.
  test('403 against a database that is not the demo’s, even with a session signed before', async () => {
    const cookie = session();
    vi.stubEnv('DATABASE_URL', 'postgres://u:p@127.0.0.1:5432/drquick');
    const refused = demoGuard(at({ cookie }));
    expect(refused?.status).toBe(403);
    expect(await refused!.json()).toEqual({ error: 'demo_locked' });
  });

  test('a passcode server that is not set up has no session to give', () => {
    const cookie = session();
    vi.stubEnv('DEMO_SESSION_SECRET', 'short');
    expect(demoGuard(at({ cookie }))?.status).toBe(403);
  });
});

async function seededDoctor() {
  await seedDoctorDemo(db);
  const [doc] = await db.select().from(gps).where(eq(gps.email, DEMO_DOCTOR.email));
  return doc;
}
async function liveConsultation(gpId: string) {
  const [p] = await db.insert(patients).values({ email: 'someone@example.com' }).returning();
  const [c] = await db.insert(consultations).values({
    patientId: p.id, gpId, status: 'in_progress', requestedAt: new Date(), startedAt: new Date(),
    pricePence: 4000, gpFeePence: 3000, platformFeePence: 1000,
  } as never).returning();
  return c;
}

describe('resetDemo', () => {
  test('ends every live consultation, closes its call without keys and takes the doctor offline', async () => {
    vi.stubEnv('CALL_KEY_SECRET', randomBytes(32).toString('base64'));
    const doc = await seededDoctor();
    expect((await goOnline(db, doc.id)).ok).toBe(true);
    const live = await liveConsultation(doc.id);
    await openCall(db, live.id, Buffer.from(process.env.CALL_KEY_SECRET!, 'base64'), new Date());

    await resetDemo(db);

    const all = await db.select().from(consultations);
    expect(all.filter((c) => c.status === 'in_progress' || c.status === 'requested')).toHaveLength(0);
    const calls = await db.select().from(consultationCalls);
    for (const call of calls) {
      expect(call.closedAt).not.toBeNull();
      expect(call.sealedGpKey).toBeNull();
      expect(call.sealedPatientKey).toBeNull();
    }
    const status = await demoStatus(db);
    expect(status.doctor).toBe('offline');
    expect(status.consultation).toBeNull();
  });

  test('refuses against a remote database, before any write', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pw@db.internal.example:5432/drquick');
    await expect(resetDemo(db)).rejects.toThrow(/local/);
    expect(await db.select().from(gps)).toHaveLength(0);
  });

  test('clears the doctor sign-in limit, which the new doctor id signs out', async () => {
    for (let i = 0; i < 6; i++) await doctorLoginAllowed(db, '127.0.0.1', DEMO_DOCTOR.email);
    expect(await doctorLoginAllowed(db, '127.0.0.1', DEMO_DOCTOR.email)).toBe(false);
    await hit(db, 'rl:other:keep', 600);
    await resetDemo(db);
    expect(await doctorLoginAllowed(db, '127.0.0.1', DEMO_DOCTOR.email)).toBe(true);
    const kept = await db.execute(sql`select 1 from rate_limits where key = 'rl:other:keep'`);
    expect(rowsOf(kept)).toHaveLength(1);
  });

  test('works on an empty database and can run twice', async () => {
    await resetDemo(db);
    const result = await resetDemo(db);
    expect(result.doctor.email).toBe(DEMO_DOCTOR.email);
  });
});

describe('demoStatus', () => {
  test('offline before anything exists', async () => {
    expect(await demoStatus(db)).toEqual({ doctor: 'offline', consultation: null });
  });
  test('online doctor', async () => {
    const doc = await seededDoctor();
    await goOnline(db, doc.id);
    expect(['online', 'offer']).toContain((await demoStatus(db)).doctor);
  });
  test('reflects an accepted consultation', async () => {
    const doc = await seededDoctor();
    const live = await liveConsultation(doc.id);
    expect(await demoStatus(db)).toEqual({ doctor: 'consultation', consultation: { id: live.id, status: 'in_progress' } });
  });
});

describe('the presenter page', () => {
  test('is a 404 unless the demo is on', () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO', '');
    expect(() => DemoPage()).toThrow('NEXT_NOT_FOUND');
  });
  test('shows the heading, Reset and three links that open in new windows', () => {
    render(DemoPage());
    expect(screen.getByRole('heading', { level: 1, name: 'Demo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
    const links: Record<string, string> = { Website: '/', 'Patient app': '/patient?data=seeded', 'Doctor portal': '/doctor' };
    for (const [name, href] of Object.entries(links)) {
      const link = screen.getByRole('link', { name });
      expect(link).toHaveAttribute('href', href);
      expect(link).toHaveAttribute('target', '_blank');
    }
    expect(screen.getAllByRole('listitem')).toHaveLength(9);
  });
});
