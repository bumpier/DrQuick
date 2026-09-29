// Blog posts, in the blog_posts table (lib/db/schema.ts). The slug column is
// unique, so two posts can never share an address; a clash surfaces as
// 'slug_taken' rather than an exception.
//
// With no database — only a production server missing DATABASE_URL — there is
// no blog: public reads return nothing and admin writes report
// 'store_unavailable'. Development gets PGlite and tests an in-memory one
// (lib/db/index.ts), so there is no separate in-memory backend any more.
import { randomUUID } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { getDb, type DB } from '@/lib/db';
import { blogPosts } from '@/lib/db/schema';
import { BLOG_TONES, type BlogPost, type BlogTone, type PostInput } from '@/lib/blog';

export type StoreError = 'store_unavailable' | 'slug_taken' | 'not_found';
export type Result<T> = { ok: true; value: T } | { ok: false; error: StoreError };

type Row = typeof blogPosts.$inferSelect;

function toPost(r: Row): BlogPost {
  return {
    id: r.id, slug: r.slug, title: r.title, summary: r.summary, body: r.body,
    tone: (BLOG_TONES as readonly string[]).includes(r.tone) ? (r.tone as BlogTone) : 'wash',
    status: r.status, authorEmail: r.authorEmail, authorName: r.authorName,
    createdAt: r.createdAt.getTime(), updatedAt: r.updatedAt.getTime(),
    publishedAt: r.publishedAt ? r.publishedAt.getTime() : null,
  };
}

function toRow(p: BlogPost): Row {
  return {
    ...p,
    createdAt: new Date(p.createdAt), updatedAt: new Date(p.updatedAt),
    publishedAt: p.publishedAt === null ? null : new Date(p.publishedAt),
  };
}

// A unique-index violation, from postgres.js or PGlite alike.
const isUniqueViolation = (err: unknown) => {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === '23505' || e?.cause?.code === '23505';
};

async function db(): Promise<DB | null> {
  try { return await getDb(); } catch { return null; }
}

async function find(d: DB, id: string): Promise<BlogPost | null> {
  const [row] = await d.select().from(blogPosts).where(eq(blogPosts.id, id));
  return row ? toPost(row) : null;
}

/* ----------------------------------------------------------------- API */

// Public reads never throw: a store that is down shows an empty blog, not an error page.
async function quietly<T>(fallback: T, read: (d: DB) => Promise<T>): Promise<T> {
  const d = await db();
  if (!d) return fallback;
  try { return await read(d); } catch { return fallback; }
}

export function listPublished(limit = 100): Promise<BlogPost[]> {
  return quietly([], async (d) => (await d.select().from(blogPosts)
    .where(eq(blogPosts.status, 'published'))
    .orderBy(desc(blogPosts.publishedAt)).limit(limit)).map(toPost));
}

export function getPublishedBySlug(slug: string): Promise<BlogPost | null> {
  return quietly(null, async (d) => {
    const [row] = await d.select().from(blogPosts).where(eq(blogPosts.slug, slug));
    return row?.status === 'published' ? toPost(row) : null;
  });
}

// Admin reads and writes do throw on a store failure, so the editor can say so.
export async function listAll(limit = 200): Promise<Result<BlogPost[]>> {
  const d = await db();
  if (!d) return { ok: false, error: 'store_unavailable' };
  const rows = await d.select().from(blogPosts).orderBy(desc(blogPosts.updatedAt)).limit(limit);
  return { ok: true, value: rows.map(toPost) };
}

export async function getPost(id: string): Promise<Result<BlogPost>> {
  const d = await db();
  if (!d) return { ok: false, error: 'store_unavailable' };
  const post = await find(d, id);
  return post ? { ok: true, value: post } : { ok: false, error: 'not_found' };
}

// Create (no id) or update a post's content. Status and dates are the store's.
export async function savePost(
  input: PostInput,
  author: { email: string; name: string },
  id?: string,
  now = Date.now(),
): Promise<Result<BlogPost>> {
  const d = await db();
  if (!d) return { ok: false, error: 'store_unavailable' };

  try {
    if (!id) {
      const post: BlogPost = {
        id: randomUUID(), ...input, status: 'draft',
        authorEmail: author.email, authorName: author.name,
        createdAt: now, updatedAt: now, publishedAt: null,
      };
      await d.insert(blogPosts).values(toRow(post));
      return { ok: true, value: post };
    }

    const existing = await find(d, id);
    if (!existing) return { ok: false, error: 'not_found' };
    const post: BlogPost = { ...existing, ...input, updatedAt: now };
    await d.update(blogPosts).set(toRow(post)).where(eq(blogPosts.id, id));
    return { ok: true, value: post };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: 'slug_taken' };
    throw err;
  }
}

export async function setStatus(id: string, status: 'draft' | 'published', now = Date.now()): Promise<Result<BlogPost>> {
  const d = await db();
  if (!d) return { ok: false, error: 'store_unavailable' };
  const existing = await find(d, id);
  if (!existing) return { ok: false, error: 'not_found' };
  const post: BlogPost = {
    ...existing,
    status,
    updatedAt: now,
    // The first publication date stands: republishing a corrected post does not
    // move it to the top of the blog as if it were new.
    publishedAt: status === 'published' ? existing.publishedAt ?? now : existing.publishedAt,
  };
  await d.update(blogPosts).set(toRow(post)).where(eq(blogPosts.id, id));
  return { ok: true, value: post };
}

export async function deletePost(id: string): Promise<Result<BlogPost>> {
  const d = await db();
  if (!d) return { ok: false, error: 'store_unavailable' };
  const existing = await find(d, id);
  if (!existing) return { ok: false, error: 'not_found' };
  await d.delete(blogPosts).where(eq(blogPosts.id, id));
  return { ok: true, value: existing };
}
