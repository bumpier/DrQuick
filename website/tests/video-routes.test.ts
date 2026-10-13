import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { AccessToken } from 'livekit-server-sdk';

const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined) }),
  headers: async () => new Headers(),
}));
vi.mock('@/lib/video/livekit', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/video/livekit')>();
  return { ...real, ensureRoom: vi.fn(async () => undefined), closeRoom: vi.fn(async () => true), removeParticipant: vi.fn(async () => true) };
});

import { NextRequest } from 'next/server';
import { setDb, type DB } from '@/lib/db';
import { consultationCalls, consultations, gps, rateLimits } from '@/lib/db/schema';
import { DOCTOR_COOKIE, signDoctorSession } from '@/lib/doctor-auth';
import { splitPrice } from '@/lib/finance/commission';
import { hashKey } from '@/lib/rate-limit';
import { ensureRoom } from '@/lib/video/livekit';
import { POST as callRoute } from '@/app/doctor/call/route';
import { POST as devCallRoute } from '@/app/dev/call/route';
import { POST as webhookRoute } from '@/app/api/webhooks/livekit/route';
import { proxy } from '@/proxy';
import { resetDb, useTestDb } from './helpers/db';

// The three ways into a call from outside: the GP's pass, the development
// patient pass, and the media server's webhooks.

let db: DB;
beforeAll(async () => { db = await useTestDb(); });

const SECRET = 's'.repeat(43);
beforeEach(async () => {
  setDb(db);
  await resetDb(db);
  jar.clear();
  vi.stubEnv('DOCTOR_SESSION_SECRET', 'd'.repeat(40));
  vi.stubEnv('LIVEKIT_URL', 'wss://media.drquick.example');
  vi.stubEnv('LIVEKIT_API_KEY', 'APIkey123');
  vi.stubEnv('LIVEKIT_API_SECRET', SECRET);
  vi.stubEnv('CALL_KEY_SECRET', randomBytes(32).toString('base64'));
  vi.mocked(ensureRoom).mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

let n = 0;
async function signedInDoctor({ inConsultation = true } = {}) {
  n += 1;
  const [d] = await db.insert(gps).values({ name: `GP ${n}`, email: `gp${n}@example.com`, gmc: String(7200000 + n), status: 'active' }).returning();
  let consultationId: string | null = null;
  if (inConsultation) {
    const [c] = await db.insert(consultations).values({
      patientId: randomUUID(), gpId: d.id, status: 'in_progress', requestedAt: new Date(), startedAt: new Date(),
      pricePence: 4000, ...splitPrice(4000, 0),
    }).returning();
    consultationId = c.id;
  }
  jar.set(DOCTOR_COOKIE, signDoctorSession(d)!);
  return { d, consultationId };
}

const post = (url: string, init: { headers?: Record<string, string>; body?: string } = {}) =>
  new Request(url, { method: 'POST', headers: init.headers, body: init.body });

describe('POST /doctor/call', () => {
  const call = (init?: Parameters<typeof post>[1]) => callRoute(post('http://localhost/doctor/call', init));

  test('gives the signed-in doctor their pass, uncached, and nothing more', async () => {
    const { consultationId } = await signedInDoctor();
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(['identity', 'ownKey', 'peerIdentity', 'peerKey', 'token', 'url']);
    const [row] = await db.select().from(consultationCalls);
    expect(row.consultationId).toBe(consultationId);
    expect(body.identity).toBe(row.gpIdentity);
  });

  // A doctor acts for themselves: an id in the request is never read.
  test('ignores any consultation named in the request', async () => {
    const other = await signedInDoctor();
    const { consultationId } = await signedInDoctor();
    const response = await call({ body: JSON.stringify({ consultationId: other.consultationId }), headers: { 'content-type': 'application/json' } });
    expect(response.status).toBe(200);
    expect((await db.select().from(consultationCalls)).map((r) => r.consultationId)).toEqual([consultationId]);
  });

  test('refuses another site, a signed-out request, and says why otherwise', async () => {
    await signedInDoctor();
    expect((await call({ headers: { 'sec-fetch-site': 'cross-site' } })).status).toBe(403);
    jar.clear();
    expect((await call()).status).toBe(401);
    await signedInDoctor({ inConsultation: false });
    const none = await call();
    expect([none.status, (await none.json()).error]).toEqual([409, 'no_consultation']);
    await signedInDoctor();
    vi.stubEnv('CALL_KEY_SECRET', '');
    const off = await call();
    expect([off.status, (await off.json()).error]).toEqual([501, 'video_off']);
  });

  test('says the media server is unavailable, without saying more', async () => {
    await signedInDoctor();
    vi.mocked(ensureRoom).mockRejectedValue(new Error(`secret ${SECRET} at wss://internal`));
    const response = await call();
    expect(response.status).toBe(503);
    expect(await response.text()).toBe(JSON.stringify({ error: 'unavailable' }));
  });

  test('limits how often a doctor can ask', async () => {
    await signedInDoctor();
    for (let i = 0; i < 6; i += 1) expect((await call()).status).toBe(200);
    const limited = await call();
    expect([limited.status, (await limited.json()).error]).toEqual([429, 'rate_limited']);
  });

  // A redirected fetch would hand the call screen the sign-in page with a 200.
  test('is left by the proxy to answer for itself', () => {
    expect(proxy(new NextRequest('http://localhost/doctor/call')).headers.get('location')).toBeNull();
  });
});

describe('POST /dev/call', () => {
  const devCall = (host = 'localhost:3100') => devCallRoute(post(`http://${host}/dev/call`, { headers: { host } }));

  test('gives the patient’s half of the live call on a developer’s machine', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    await signedInDoctor();
    const response = await devCall();
    expect(response.status).toBe(200);
    const [row] = await db.select().from(consultationCalls);
    expect((await response.json()).identity).toBe(row.patientIdentity);
  });

  test('does not exist in production, refuses another host, and a remote database', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect((await devCall()).status).toBe(404);
    vi.stubEnv('NODE_ENV', 'development');
    await signedInDoctor();
    expect((await devCall('192.168.1.37:3100')).status).toBe(403);
    vi.stubEnv('DATABASE_URL', 'postgres://user:pass@db.example.com:5432/drquick');
    const remote = await devCall();
    expect([remote.status, await remote.text()]).toEqual([403, JSON.stringify({ error: 'not_local' })]);
  });
});

describe('POST /api/webhooks/livekit', () => {
  const NOW_S = () => String(Math.floor(Date.now() / 1000));
  const sign = async (text: string) => {
    const token = new AccessToken('APIkey123', SECRET);
    token.sha256 = createHash('sha256').update(text).digest('base64');
    return token.toJwt();
  };
  const deliver = async (event: Record<string, unknown>, headers: Record<string, string> = {}) => {
    const text = JSON.stringify({ id: `EV_${randomUUID()}`, createdAt: NOW_S(), ...event });
    return webhookRoute(post('http://localhost/api/webhooks/livekit', {
      body: text, headers: { 'content-type': 'application/webhook+json', authorization: await sign(text), 'x-forwarded-for': '203.0.113.9', ...headers },
    }));
  };
  async function liveRoom() {
    await signedInDoctor();
    await callRoute(post('http://localhost/doctor/call'));
    return (await db.select().from(consultationCalls))[0];
  }

  test('records a signed notice once', async () => {
    const row = await liveRoom();
    const event = { id: 'EV_once', event: 'participant_joined', room: { name: row.room }, participant: { identity: row.gpIdentity } };
    const first = await deliver(event);
    expect([first.status, (await first.json()).outcome]).toEqual([200, 'recorded']);
    const again = await deliver(event);
    expect([again.status, (await again.json()).outcome]).toEqual([200, 'duplicate']);
  });

  test('refuses an unsigned or altered notice, and one too large to read', async () => {
    const text = JSON.stringify({ id: 'EV_x', createdAt: NOW_S(), event: 'participant_joined', room: { name: 'ROOM' } });
    const unsigned = await webhookRoute(post('http://localhost/api/webhooks/livekit', { body: text }));
    expect(unsigned.status).toBe(401);
    const altered = await webhookRoute(post('http://localhost/api/webhooks/livekit', {
      body: text.replace('ROOM', 'MOOR'), headers: { authorization: await sign(text) },
    }));
    expect(altered.status).toBe(401);
    const big = await webhookRoute(post('http://localhost/api/webhooks/livekit', {
      body: 'x'.repeat(70 * 1024), headers: { authorization: 'x' },
    }));
    expect(big.status).toBe(413);
  });

  test('answers 501 while video is not set up', async () => {
    vi.stubEnv('LIVEKIT_API_SECRET', '');
    expect((await deliver({ event: 'participant_joined' })).status).toBe(501);
  });

  test('limits how often one address can send', async () => {
    await db.insert(rateLimits).values({ key: hashKey('rl:livekit-webhook', '203.0.113.9'), count: 600, windowEndsAt: new Date(Date.now() + 60_000) });
    expect((await deliver({ event: 'participant_joined' })).status).toBe(429);
  });
});
