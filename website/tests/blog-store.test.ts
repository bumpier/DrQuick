import { test, expect, beforeEach, vi, describe } from 'vitest';
import {
  deletePost, getPost, getPublishedBySlug, listAll, listPublished, resetMemoryStore, savePost, setStatus,
} from '@/lib/blog-store';
import { readingMinutes, slugify, validatePost, type PostInput } from '@/lib/blog';

const AUTHOR = { email: 'editor@example.com', name: 'Sam Editor' };
const input = (over: Partial<PostInput> = {}): PostInput => ({
  slug: 'what-a-fit-note-is', title: 'What a fit note is', summary: 'A short guide.', body: 'Some **text**.', tone: 'wash', ...over,
});

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetMemoryStore();
});

describe('the post helpers', () => {
  test('slugify makes a clean address from a title', () => {
    expect(slugify('What’s a “fit note”? — A guide')).toBe('whats-a-fit-note-a-guide');
    expect(slugify('  Café visits & GP care ')).toBe('cafe-visits-gp-care');
  });
  test('reading time never drops below a minute', () => {
    expect(readingMinutes('short')).toBe(1);
    expect(readingMinutes('word '.repeat(660))).toBe(3);
  });
  test('validation trims, and names each bad field', () => {
    expect(validatePost({ ...input(), title: '  Hello  ' }).input?.title).toBe('Hello');
    const { errors } = validatePost({ title: '', summary: '', body: ' ', slug: 'Bad Slug', tone: 'pink' });
    expect(errors.map((e) => e.field)).toEqual(['title', 'summary', 'body', 'slug', 'tone']);
  });
});

describe('the in-memory store (development and tests)', () => {
  test('a new post is a draft: listed for admins, invisible to the public', async () => {
    const saved = await savePost(input(), AUTHOR, undefined, 1000);
    expect(saved.ok).toBe(true);
    const all = await listAll();
    expect(all.ok && all.value.map((p) => p.title)).toEqual(['What a fit note is']);
    expect(await listPublished()).toEqual([]);
    expect(await getPublishedBySlug('what-a-fit-note-is')).toBeNull();
  });

  test('two posts can never share an address', async () => {
    await savePost(input(), AUTHOR);
    expect(await savePost(input({ title: 'Another' }), AUTHOR)).toEqual({ ok: false, error: 'slug_taken' });
  });

  test('publishing shows it; unpublishing hides it; republishing keeps the first date', async () => {
    const saved = await savePost(input(), AUTHOR, undefined, 1000);
    const id = saved.ok ? saved.value.id : '';
    await setStatus(id, 'published', 2000);
    expect((await getPublishedBySlug('what-a-fit-note-is'))?.publishedAt).toBe(2000);
    await setStatus(id, 'draft', 3000);
    expect(await listPublished()).toEqual([]);
    await setStatus(id, 'published', 4000);
    expect((await listPublished())[0].publishedAt).toBe(2000);
  });

  test('changing the address frees the old one', async () => {
    const saved = await savePost(input(), AUTHOR);
    const id = saved.ok ? saved.value.id : '';
    await setStatus(id, 'published');
    await savePost(input({ slug: 'fit-notes' }), AUTHOR, id);
    expect(await getPublishedBySlug('what-a-fit-note-is')).toBeNull();
    expect((await getPublishedBySlug('fit-notes'))?.id).toBe(id);
    expect((await savePost(input({ title: 'Reuse' }), AUTHOR)).ok).toBe(true);
  });

  test('published posts list newest first; deleting removes a post everywhere', async () => {
    const a = await savePost(input({ slug: 'a', title: 'A' }), AUTHOR, undefined, 1);
    const b = await savePost(input({ slug: 'b', title: 'B' }), AUTHOR, undefined, 2);
    const [ia, ib] = [a, b].map((r) => (r.ok ? r.value.id : ''));
    await setStatus(ia, 'published', 10);
    await setStatus(ib, 'published', 20);
    expect((await listPublished()).map((p) => p.title)).toEqual(['B', 'A']);
    await deletePost(ib);
    expect((await listPublished()).map((p) => p.title)).toEqual(['A']);
    expect(await getPost(ib)).toEqual({ ok: false, error: 'not_found' });
  });
});

describe('the Redis store', () => {
  function stubRedis(...responses: unknown[][]) {
    vi.stubEnv('KV_REST_API_URL', 'https://kv.example');
    vi.stubEnv('KV_REST_API_TOKEN', 'tok');
    const fetchMock = vi.fn();
    for (const results of responses) {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => results.map((result) => ({ result })) });
    }
    vi.stubGlobal('fetch', fetchMock);
    return (i: number) => JSON.parse(fetchMock.mock.calls[i][1].body);
  }

  test('creating a post claims the slug with SET NX, then writes the hash and the index', async () => {
    const body = stubRedis(['OK'], [12, 1, 0]);
    const saved = await savePost(input(), AUTHOR, undefined, 1000);
    expect(saved.ok).toBe(true);
    const id = saved.ok ? saved.value.id : '';
    expect(body(0)).toEqual([['SET', 'blog:slug:what-a-fit-note-is', id, 'NX']]);
    const write = body(1);
    expect(write[0].slice(0, 2)).toEqual(['HSET', `blog:post:${id}`]);
    expect(write[1]).toEqual(['ZADD', 'blog:all', 1000, id]);
    expect(write[2]).toEqual(['ZREM', 'blog:published', id]);
  });

  test('a taken slug writes nothing', async () => {
    const body = stubRedis([null]);
    expect(await savePost(input(), AUTHOR)).toEqual({ ok: false, error: 'slug_taken' });
    expect(() => body(1)).toThrow();
  });

  test('the public list reads the published index, then each hash', async () => {
    const hash = ['id', 'p1', 'slug', 's', 'title', 'T', 'summary', 'S', 'body', 'B', 'tone', 'sage', 'status', 'published',
      'authorEmail', 'e', 'authorName', 'n', 'createdAt', '1', 'updatedAt', '2', 'publishedAt', '3'];
    const body = stubRedis([['p1']], [hash]);
    const posts = await listPublished();
    expect(body(0)).toEqual([['ZREVRANGE', 'blog:published', 0, 99]]);
    expect(body(1)).toEqual([['HGETALL', 'blog:post:p1']]);
    expect(posts[0]).toMatchObject({ id: 'p1', tone: 'sage', status: 'published', publishedAt: 3 });
  });

  test('a store that fails shows the public an empty blog, never an error', async () => {
    vi.stubEnv('KV_REST_API_URL', 'https://kv.example');
    vi.stubEnv('KV_REST_API_TOKEN', 'tok');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    expect(await listPublished()).toEqual([]);
    expect(await getPublishedBySlug('x')).toBeNull();
  });
});

test('a production build with no store has no blog to write to', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  expect(await listAll()).toEqual({ ok: false, error: 'store_unavailable' });
  expect(await listPublished()).toEqual([]);
});
