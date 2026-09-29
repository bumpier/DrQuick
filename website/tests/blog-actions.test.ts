import { beforeAll, test, expect, beforeEach, vi } from 'vitest';
import { resetDb, useTestDb } from './helpers/db';
import { setDb, type DB } from '@/lib/db';
let testDb: DB;
beforeAll(async () => { testDb = await useTestDb(); });

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
const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

import { deletePostAction, publishPostAction, savePostAction, unpublishPostAction } from '@/app/admin/(panel)/blog/actions';
import { SESSION_COOKIE, hashPassword, signSession } from '@/lib/admin-auth';
import { getPublishedBySlug, listAll } from '@/lib/blog-store';
import type { PostInput } from '@/lib/blog';

const HASH = hashPassword('correct horse battery');
const clean: PostInput = {
  title: 'What a fit note is', slug: 'what-a-fit-note-is', tone: 'wash',
  summary: 'When you need one, and how a GP decides.',
  body: '## When you need one\n\nIf you are off work for more than seven days, your employer can ask for a fit note.',
};

beforeEach(async () => {
  setDb(testDb);
  vi.unstubAllEnvs();
  vi.stubEnv('ADMIN_SESSION_SECRET', 'y'.repeat(40));
  vi.stubEnv('ADMIN_USERS', `editor@example.com|Sam Editor|${HASH}`);
  jar.clear();
  jar.set(SESSION_COOKIE, signSession('editor@example.com')!);
  revalidatePath.mockClear();
  await resetDb(testDb);
});

test('every action refuses a visitor with no session', async () => {
  jar.clear();
  await expect(savePostAction(null, clean)).rejects.toThrow('NEXT_REDIRECT /admin/login');
  await expect(publishPostAction(null, clean)).rejects.toThrow('NEXT_REDIRECT /admin/login');
  await expect(unpublishPostAction('x')).rejects.toThrow('NEXT_REDIRECT /admin/login');
  await expect(deletePostAction('x')).rejects.toThrow('NEXT_REDIRECT /admin/login');
  const all = await listAll();
  expect(all.ok && all.value).toEqual([]);
});

test('a forged session is refused too', async () => {
  jar.set(SESSION_COOKIE, 'eyJlbWFpbCI6ImEifQ.forged');
  await expect(savePostAction(null, clean)).rejects.toThrow('NEXT_REDIRECT /admin/login');
});

test('saving a draft stores it under the signed-in admin and touches no public page', async () => {
  const result = await savePostAction(null, clean);
  expect(result).toMatchObject({ ok: true, post: { status: 'draft', authorName: 'Sam Editor', authorEmail: 'editor@example.com' } });
  expect(revalidatePath).not.toHaveBeenCalled();
});

test('bad fields come back named, and nothing is saved', async () => {
  const result = await savePostAction(null, { ...clean, title: '', slug: 'Not A Slug' });
  expect(result.ok).toBe(false);
  expect(result.fieldErrors?.map((e) => e.field)).toEqual(['title', 'slug']);
  const all = await listAll();
  expect(all.ok && all.value).toEqual([]);
});

test('a post that names a medicine or claims CQC registration cannot publish, but can be saved', async () => {
  const risky = { ...clean, body: `${clean.body}\n\nWe are CQC registered and can prescribe amoxicillin.` };
  const refused = await publishPostAction(null, risky);
  expect(refused.ok).toBe(false);
  expect(refused.hits?.map((h) => h.rule)).toEqual(['cqc', 'medicine']);
  expect(await getPublishedBySlug(clean.slug)).toBeNull();
  expect((await savePostAction(null, risky)).ok).toBe(true);
});

test('a banned phrase in the title or summary blocks publishing too', async () => {
  expect((await publishPostAction(null, { ...clean, title: 'Consultations from £30' })).hits?.[0].rule).toBe('price-range');
  expect((await publishPostAction(null, { ...clean, summary: 'Dr Patel explains fit notes.' })).hits?.[0].rule).toBe('named-doctor');
});

test('a clean post publishes, goes live, and refreshes the blog, the post and the sitemap', async () => {
  const result = await publishPostAction(null, clean);
  expect(result).toMatchObject({ ok: true, post: { status: 'published' } });
  expect((await getPublishedBySlug(clean.slug))?.title).toBe(clean.title);
  expect(revalidatePath.mock.calls.map((c) => c[0])).toEqual(['/blog', `/blog/${clean.slug}`, '/sitemap.xml']);
});

test('moving a live post to a new address refreshes both addresses', async () => {
  const published = await publishPostAction(null, clean);
  revalidatePath.mockClear();
  await savePostAction(published.post!.id, { ...clean, slug: 'fit-notes' });
  expect(revalidatePath.mock.calls.map((c) => c[0])).toEqual(['/blog', `/blog/${clean.slug}`, '/blog/fit-notes', '/sitemap.xml']);
  expect(await getPublishedBySlug('fit-notes')).not.toBeNull();
});

test('unpublishing takes a post off the blog; deleting removes it', async () => {
  const { post } = await publishPostAction(null, clean);
  expect((await unpublishPostAction(post!.id)).post?.status).toBe('draft');
  expect(await getPublishedBySlug(clean.slug)).toBeNull();
  expect((await deletePostAction(post!.id)).ok).toBe(true);
  expect((await deletePostAction(post!.id)).error).toMatch(/no longer exists/);
});

test('an address already in use is reported against the address field', async () => {
  await savePostAction(null, clean);
  const clash = await savePostAction(null, { ...clean, title: 'Another' });
  expect(clash.fieldErrors).toEqual([{ field: 'slug', message: 'Another post already uses this web address.' }]);
});
