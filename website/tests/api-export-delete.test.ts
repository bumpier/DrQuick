import { test, expect, beforeEach, describe, vi } from 'vitest';
import { GET, csvCell } from '@/app/api/waitlist-export/route';
import { POST as DELETE_POST } from '@/app/api/waitlist-delete/route';

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.stubEnv('KV_REST_API_URL', 'https://kv.example');
  vi.stubEnv('KV_REST_API_TOKEN', 'tok');
  vi.stubEnv('WAITLIST_EXPORT_TOKEN', 'secret-token');
});

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

function stubPipeline(results: unknown[]) {
  const fetchMock = vi.fn<typeof fetch>(async () => ({
    ok: true,
    json: async () => results.map((result) => ({ result })),
  }) as Response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

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

test('export renders sorted CSV with escaped cells', async () => {
  const entries = [
    'patient:b@example.com', JSON.stringify({ email: 'b@example.com', role: 'patient', source: 'hero', joinedAt: '2026-08-02T00:00:00.000Z' }),
    'gp:=evil@example.com', JSON.stringify({ email: '=evil@example.com', role: 'gp', source: 'recap-gp', joinedAt: '2026-08-01T00:00:00.000Z' }),
    'patient:broken@example.com', 'not-json',
  ];
  stubPipeline([entries]);
  const res = await GET(exportReq('Bearer secret-token'));
  expect(res.status).toBe(200);
  expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
  expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="dr-quick-waitlist.csv"');
  const lines = (await res.text()).split('\n');
  expect(lines[0]).toBe('email,role,name,mobile,gmc,source,joined_at');
  expect(lines[1]).toContain('"broken@example.com"'); // corrupt row falls back to field key, sorts first (empty joinedAt)
  expect(lines[2]).toContain(`"'=evil@example.com"`); // escaped, 08-01 before 08-02
  expect(lines[3]).toContain('"b@example.com"');
});

// One CSV covers both roles: a GP row fills the sign-up columns, a patient row
// leaves them empty rather than the export splitting into two files.
test('a GP row carries the sign-up columns and a patient row leaves them blank', async () => {
  const entries = [
    'gp:jane@example.com', JSON.stringify({
      email: 'jane@example.com', role: 'gp', name: 'Dr Jane Okafor',
      mobile: '07700900123', gmc: '1234567', source: 'hero-gp', joinedAt: '2026-08-01T00:00:00.000Z',
    }),
    'patient:b@example.com', JSON.stringify({
      email: 'b@example.com', role: 'patient', source: 'hero', joinedAt: '2026-08-02T00:00:00.000Z',
    }),
  ];
  stubPipeline([entries]);
  const lines = (await (await GET(exportReq('Bearer secret-token'))).text()).split('\n');
  expect(lines[1]).toBe('"jane@example.com","gp","Dr Jane Okafor","07700900123","1234567","hero-gp","2026-08-01T00:00:00.000Z"');
  expect(lines[2]).toBe('"b@example.com","patient","","","","hero","2026-08-02T00:00:00.000Z"');
});

test('export without store config is 503; store failure is 502', async () => {
  vi.stubEnv('KV_REST_API_URL', '');
  vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
  expect((await GET(exportReq('Bearer secret-token'))).status).toBe(503);
  vi.stubEnv('KV_REST_API_URL', 'https://kv.example');
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })));
  expect((await GET(exportReq('Bearer secret-token'))).status).toBe(502);
});

test('delete removes the address from both role sets and the hash', async () => {
  const fetchMock = stubPipeline([1, 0, 1]); // SREM patient=1, SREM gp=0, HDEL=1
  const res = await DELETE_POST(deleteReq({ email: ' A@B.CO ' }, 'Bearer secret-token'));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, removed: 2 });
  const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
  expect(body).toEqual([
    ['SREM', 'waitlist:patient', 'a@b.co'],
    ['SREM', 'waitlist:gp', 'a@b.co'],
    ['HDEL', 'waitlist:entries', 'patient:a@b.co', 'gp:a@b.co'],
  ]);
});

test('delete validates the email', async () => {
  stubPipeline([]);
  expect((await DELETE_POST(deleteReq({ email: 'not-an-email' }, 'Bearer secret-token'))).status).toBe(400);
});
