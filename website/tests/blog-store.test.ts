import { beforeAll, test, expect, beforeEach, vi, describe } from 'vitest';
import { resetDb, useTestDb } from './helpers/db';
import { setDb, type DB } from '@/lib/db';
let testDb: DB;
beforeAll(async () => { testDb = await useTestDb(); });
import {
  deletePost, getPost, getPublishedBySlug, listAll, listPublished, savePost, setStatus,
} from '@/lib/blog-store';
import { readingMinutes, slugify, validatePost, type PostInput } from '@/lib/blog';

const AUTHOR = { email: 'editor@example.com', name: 'Sam Editor' };
const input = (over: Partial<PostInput> = {}): PostInput => ({
  slug: 'what-a-fit-note-is', title: 'What a fit note is', summary: 'A short guide.', body: 'Some **text**.', tone: 'wash', ...over,
});

beforeEach(async () => {
  setDb(testDb);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await resetDb(testDb);
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

describe('the store', () => {
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

describe('the Postgres store', () => {
  test('a post round-trips every field, dates as epoch ms', async () => {
    const saved = await savePost(input({ tone: 'sage' }), AUTHOR, undefined, 1000);
    const id = saved.ok ? saved.value.id : '';
    await setStatus(id, 'published', 3000);
    const got = await getPost(id);
    expect(got.ok && got.value).toMatchObject({
      id, tone: 'sage', status: 'published', authorName: 'Sam Editor', createdAt: 1000, updatedAt: 3000, publishedAt: 3000,
    });
  });

  test('a database that fails shows the public an empty blog, never an error', async () => {
    setDb({ select: () => { throw new Error('down'); } } as unknown as DB);
    expect(await listPublished()).toEqual([]);
    expect(await getPublishedBySlug('x')).toBeNull();
  });
});

test('a production server with no database has no blog to write to', async () => {
  setDb(null);
  expect(await listAll()).toEqual({ ok: false, error: 'store_unavailable' });
  expect(await listPublished()).toEqual([]);
});
