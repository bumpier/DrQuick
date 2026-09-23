import { test, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/waitlist/route';

// A GP sign-up carries four fields, not one. This is the shape the route now
// requires for role "gp"; a patient still posts an email and nothing else.
const GP = {
  name: 'Dr Jane Okafor',
  email: 'jane@example.com',
  mobile: '07700 900123',
  gmc: '1234567',
  role: 'gp',
  source: 'hero-gp',
};

function req(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/waitlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

// Each fetch call answers one pipeline() invocation, in order.
function stubPipelines(...responses: unknown[][]) {
  const fetchMock = vi.fn<typeof fetch>();
  for (const results of responses) {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => results.map((result) => ({ result })),
    } as Response);
  }
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const bodyOf = (fetchMock: ReturnType<typeof stubPipelines>, call: number) =>
  JSON.parse(fetchMock.mock.calls[call][1]!.body as string);

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.stubEnv('KV_REST_API_URL', 'https://kv.example');
  vi.stubEnv('KV_REST_API_TOKEN', 'tok');
});

test('503 when the store is not configured', async () => {
  vi.stubEnv('KV_REST_API_URL', '');
  vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
  const res = await POST(req({ email: 'a@b.co', role: 'patient' }));
  expect(res.status).toBe(503);
  expect(res.headers.get('Cache-Control')).toBe('no-store');
  expect(await res.json()).toEqual({ ok: false, error: 'store_unavailable' });
});

test('honeypot value returns a fake success without touching the store', async () => {
  const fetchMock = stubPipelines();
  const res = await POST(req({ email: 'a@b.co', role: 'patient', company: 'bot inc' }));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, alreadyJoined: false });
  expect(fetchMock).not.toHaveBeenCalled();
});

test('invalid email and invalid role are 400s', async () => {
  stubPipelines();
  expect((await POST(req({ email: 'nope', role: 'patient' }))).status).toBe(400);
  expect((await POST(req({ email: 'a@b.co', role: 'admin' }))).status).toBe(400);
  const long = `${'a'.repeat(250)}@example.com`;
  expect((await POST(req({ email: long, role: 'patient' }))).status).toBe(400);
});

test('unparseable and oversize bodies are 400 bad_request', async () => {
  stubPipelines();
  expect((await POST(req('not json'))).status).toBe(400);
  const big = JSON.stringify({ email: 'a@b.co', role: 'patient', pad: 'x'.repeat(5000) });
  expect((await POST(req(big))).status).toBe(400);
});

test('sixth submission in the window is rate limited', async () => {
  stubPipelines([6, 1]); // INCR → 6, EXPIRE → 1
  const res = await POST(req({ email: 'a@b.co', role: 'patient' }, { 'x-forwarded-for': '203.0.113.9' }));
  expect(res.status).toBe(429);
  expect(await res.json()).toEqual({ ok: false, error: 'rate_limited' });
});

test('the rate-limit key is a salted hash — the raw IP never reaches the store', async () => {
  vi.stubEnv('RATE_LIMIT_SALT', 'pepper');
  const fetchMock = stubPipelines([1, 1], [1, 1]);
  await POST(req({ email: 'a@b.co', role: 'patient' }, { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }));
  const firstBody = bodyOf(fetchMock, 0);
  expect(JSON.stringify(firstBody)).not.toContain('203.0.113.9');
  expect(firstBody[0][0]).toBe('INCR');
  expect(firstBody[0][1]).toMatch(/^rl:[0-9a-f]{24}$/);
  expect(firstBody[1]).toEqual(['EXPIRE', firstBody[0][1], '600', 'NX']);
});

test('a new address stores and reports alreadyJoined false; a repeat reports true', async () => {
  let fetchMock = stubPipelines([1, 1], [1, 1]); // rate, then SADD=1
  let res = await POST(req({ ...GP, email: 'New@B.co ' }, { 'x-forwarded-for': '1.2.3.4' }));
  expect(await res.json()).toEqual({ ok: true, alreadyJoined: false });
  const writeBody = bodyOf(fetchMock, 1);
  expect(writeBody[0]).toEqual(['SADD', 'waitlist:gp', 'new@b.co']); // trimmed + lowercased
  expect(writeBody[1][0]).toBe('HSET');
  expect(writeBody[1][2]).toBe('gp:new@b.co');
  const record = JSON.parse(writeBody[1][3]);
  expect(record).toMatchObject({ email: 'new@b.co', role: 'gp', source: 'hero-gp' });
  expect(new Date(record.joinedAt).toString()).not.toBe('Invalid Date');

  fetchMock = stubPipelines([1, 1], [0, 0]); // SADD=0 → repeat
  res = await POST(req({ ...GP, email: 'new@b.co' }, { 'x-forwarded-for': '1.2.3.4' }));
  expect(await res.json()).toEqual({ ok: true, alreadyJoined: true });
});

test('the GP record stores the sign-up fields, normalised', async () => {
  const fetchMock = stubPipelines([1, 1], [1, 1]);
  await POST(req(
    { ...GP, name: '  Dr   Jane  Okafor ', mobile: '+44 7700 900123', gmc: ' 1234567 ' },
    { 'x-forwarded-for': '1.2.3.4' },
  ));
  const record = JSON.parse(bodyOf(fetchMock, 1)[1][3]);
  // Whitespace collapsed, +44 folded to the 07 national form, GMC stripped.
  expect(record).toMatchObject({
    name: 'Dr Jane Okafor', mobile: '07700900123', gmc: '1234567', role: 'gp',
  });
});

test('a GP sign-up missing a field is a 400 naming that field', async () => {
  stubPipelines([1, 1], [1, 1], [1, 1], [1, 1]);
  const cases: Array<[Record<string, unknown>, string]> = [
    [{ name: '' }, 'invalid_name'],
    [{ email: 'nope' }, 'invalid_email'],
    [{ mobile: '0161 496 0000' }, 'invalid_mobile'],   // a landline is not a mobile
    [{ gmc: '12345' }, 'invalid_gmc'],                 // seven digits, not five
  ];
  for (const [override, error] of cases) {
    const res = await POST(req({ ...GP, ...override }));
    expect(res.status, `${error} should be a 400`).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error });
  }
});

test('a patient still needs nothing but an email — the GP fields are not asked of them', async () => {
  const fetchMock = stubPipelines([1, 1], [1, 1]);
  const res = await POST(req({ email: 'a@b.co', role: 'patient', source: 'hero' }, { 'x-forwarded-for': '1.2.3.4' }));
  expect(res.status).toBe(200);
  const record = JSON.parse(bodyOf(fetchMock, 1)[1][3]);
  expect(record).toEqual({ email: 'a@b.co', role: 'patient', source: 'hero', joinedAt: record.joinedAt });
});

test('a store failure during the write is a 502', async () => {
  const fetchMock = vi.fn<typeof fetch>()
    .mockResolvedValueOnce({ ok: true, json: async () => [{ result: 1 }, { result: 1 }] } as Response)
    .mockResolvedValueOnce({ ok: false, status: 500 } as Response);
  vi.stubGlobal('fetch', fetchMock);
  const res = await POST(req({ email: 'a@b.co', role: 'patient' }, { 'x-forwarded-for': '1.2.3.4' }));
  expect(res.status).toBe(502);
  expect(await res.json()).toEqual({ ok: false, error: 'store_write_failed' });
});

test('with no client IP the rate limit is skipped and the write still happens', async () => {
  const fetchMock = stubPipelines([1, 1]); // only the write pipeline
  const res = await POST(req({ email: 'a@b.co', role: 'patient' }));
  expect(res.status).toBe(200);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(bodyOf(fetchMock, 0)[0][0]).toBe('SADD');
});
