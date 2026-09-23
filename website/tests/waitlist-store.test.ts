import { test, expect, beforeEach, vi } from 'vitest';
import { configured, pipeline } from '@/lib/waitlist-store';

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.stubEnv('KV_REST_API_URL', '');
  vi.stubEnv('KV_REST_API_TOKEN', '');
  vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
});

test('configured() is false with no env and true with either pair', () => {
  expect(configured()).toBe(false);
  vi.stubEnv('KV_REST_API_URL', 'https://kv.example');
  vi.stubEnv('KV_REST_API_TOKEN', 'tok');
  expect(configured()).toBe(true);
  vi.stubEnv('KV_REST_API_URL', '');
  vi.stubEnv('KV_REST_API_TOKEN', '');
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://up.example');
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'tok2');
  expect(configured()).toBe(true);
});

test('pipeline() throws unconfigured without env', async () => {
  await expect(pipeline([['PING']])).rejects.toThrow('WAITLIST_STORE_NOT_CONFIGURED');
});

test('pipeline() posts commands to <url>/pipeline with the bearer token', async () => {
  vi.stubEnv('KV_REST_API_URL', 'https://kv.example/');
  vi.stubEnv('KV_REST_API_TOKEN', 'tok');
  const fetchMock = vi.fn<typeof fetch>(async () => ({
    ok: true,
    json: async () => [{ result: 1 }, { result: 'OK' }],
  }) as Response);
  vi.stubGlobal('fetch', fetchMock);
  const results = await pipeline([['INCR', 'k'], ['EXPIRE', 'k', '600', 'NX']]);
  expect(results).toEqual([1, 'OK']);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('https://kv.example/pipeline'); // trailing slash stripped
  expect(init!.method).toBe('POST');
  expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  expect(JSON.parse(init!.body as string)).toEqual([['INCR', 'k'], ['EXPIRE', 'k', '600', 'NX']]);
  expect(init!.signal).toBeInstanceOf(AbortSignal);
});

test('pipeline() surfaces HTTP and per-command errors', async () => {
  vi.stubEnv('KV_REST_API_URL', 'https://kv.example');
  vi.stubEnv('KV_REST_API_TOKEN', 'tok');
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })));
  await expect(pipeline([['PING']])).rejects.toThrow('REDIS_HTTP_500');
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => [{ result: 1 }, { error: 'WRONGTYPE' }],
  })));
  await expect(pipeline([['A'], ['B']])).rejects.toThrow('REDIS_WRONGTYPE');
});
