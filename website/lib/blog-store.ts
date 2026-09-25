// Blog posts, stored in the same Redis as the waitlist (lib/waitlist-store.ts),
// over its dependency-free REST pipeline.
//
//   blog:post:<id>     hash — every BlogPost field, numbers as strings
//   blog:slug:<slug>   string — the id owning that slug (taken with SET NX, so
//                      two posts can never share an address)
//   blog:all           sorted set — every post, scored by updatedAt
//   blog:published     sorted set — published posts, scored by publishedAt
//
// With no store configured, development and tests get an in-memory backend so
// the blog and the editor work locally. A production build with no store has no
// blog: reads return nothing and writes report 'store_unavailable'.
import { randomUUID } from 'node:crypto';
import { configured, pipeline, type Command } from '@/lib/waitlist-store';
import { BLOG_TONES, type BlogPost, type BlogTone, type PostInput } from '@/lib/blog';

export type StoreError = 'store_unavailable' | 'slug_taken' | 'not_found';
export type Result<T> = { ok: true; value: T } | { ok: false; error: StoreError };

interface Backend {
  get(id: string): Promise<BlogPost | null>;
  getMany(ids: string[]): Promise<BlogPost[]>;
  idForSlug(slug: string): Promise<string | null>;
  claimSlug(slug: string, id: string): Promise<boolean>;
  releaseSlug(slug: string): Promise<void>;
  write(post: BlogPost): Promise<void>;
  remove(post: BlogPost): Promise<void>;
  ids(set: 'all' | 'published', limit: number): Promise<string[]>;
}

/* ---------------------------------------------------------------- Redis */

const K = {
  post: (id: string) => `blog:post:${id}`,
  slug: (slug: string) => `blog:slug:${slug}`,
  all: 'blog:all',
  published: 'blog:published',
};

function toHash(post: BlogPost): (string | number)[] {
  return Object.entries(post).flatMap(([k, v]) => [k, v === null ? '' : String(v)]);
}

function fromHash(flat: unknown): BlogPost | null {
  if (!Array.isArray(flat) || flat.length === 0) return null;
  const h: Record<string, string> = {};
  for (let i = 0; i < flat.length; i += 2) h[String(flat[i])] = String(flat[i + 1]);
  if (!h.id) return null;
  return {
    id: h.id,
    slug: h.slug,
    title: h.title,
    summary: h.summary,
    body: h.body,
    tone: (BLOG_TONES as readonly string[]).includes(h.tone) ? (h.tone as BlogTone) : 'wash',
    status: h.status === 'published' ? 'published' : 'draft',
    authorEmail: h.authorEmail,
    authorName: h.authorName,
    createdAt: Number(h.createdAt),
    updatedAt: Number(h.updatedAt),
    publishedAt: h.publishedAt ? Number(h.publishedAt) : null,
  };
}

const redis: Backend = {
  async get(id) {
    const [flat] = await pipeline([['HGETALL', K.post(id)]]);
    return fromHash(flat);
  },
  async getMany(ids) {
    if (ids.length === 0) return [];
    const rows = await pipeline(ids.map((id): Command => ['HGETALL', K.post(id)]));
    return rows.map(fromHash).filter((p): p is BlogPost => p !== null);
  },
  async idForSlug(slug) {
    const [id] = await pipeline([['GET', K.slug(slug)]]);
    return typeof id === 'string' && id ? id : null;
  },
  async claimSlug(slug, id) {
    const [res] = await pipeline([['SET', K.slug(slug), id, 'NX']]);
    return res === 'OK';
  },
  async releaseSlug(slug) {
    await pipeline([['DEL', K.slug(slug)]]);
  },
  async write(post) {
    const commands: Command[] = [
      ['HSET', K.post(post.id), ...toHash(post)],
      ['ZADD', K.all, post.updatedAt, post.id],
    ];
    commands.push(post.status === 'published'
      ? ['ZADD', K.published, post.publishedAt ?? post.updatedAt, post.id]
      : ['ZREM', K.published, post.id]);
    await pipeline(commands);
  },
  async remove(post) {
    await pipeline([
      ['DEL', K.post(post.id)],
      ['DEL', K.slug(post.slug)],
      ['ZREM', K.all, post.id],
      ['ZREM', K.published, post.id],
    ]);
  },
  async ids(set, limit) {
    const [ids] = await pipeline([['ZREVRANGE', set === 'all' ? K.all : K.published, 0, limit - 1]]);
    return Array.isArray(ids) ? ids.map(String) : [];
  },
};

/* --------------------------------------------------------------- Memory */

type Mem = { posts: Map<string, BlogPost>; slugs: Map<string, string> };
// On globalThis so a dev server's hot reload keeps the posts written so far.
const g = globalThis as typeof globalThis & { __drQuickBlog?: Mem };
const mem = (): Mem => (g.__drQuickBlog ??= { posts: new Map(), slugs: new Map() });

export function resetMemoryStore() {
  g.__drQuickBlog = { posts: new Map(), slugs: new Map() };
}

const memory: Backend = {
  async get(id) { return structuredClone(mem().posts.get(id) ?? null); },
  async getMany(ids) { return ids.map((id) => mem().posts.get(id)).filter((p): p is BlogPost => !!p).map((p) => structuredClone(p)); },
  async idForSlug(slug) { return mem().slugs.get(slug) ?? null; },
  async claimSlug(slug, id) {
    if (mem().slugs.has(slug)) return false;
    mem().slugs.set(slug, id);
    return true;
  },
  async releaseSlug(slug) { mem().slugs.delete(slug); },
  async write(post) { mem().posts.set(post.id, structuredClone(post)); },
  async remove(post) { mem().posts.delete(post.id); mem().slugs.delete(post.slug); },
  async ids(set, limit) {
    const posts = [...mem().posts.values()].filter((p) => set === 'all' || p.status === 'published');
    const score = (p: BlogPost) => (set === 'all' ? p.updatedAt : p.publishedAt ?? p.updatedAt);
    return posts.sort((a, b) => score(b) - score(a)).slice(0, limit).map((p) => p.id);
  },
};

/* ----------------------------------------------------------------- API */

function backend(): Backend | null {
  if (configured()) return redis;
  return process.env.NODE_ENV === 'production' ? null : memory;
}

export function storeAvailable(): boolean {
  return backend() !== null;
}

// Public reads never throw: a store that is down shows an empty blog, not an error page.
async function quietly<T>(fallback: T, read: (b: Backend) => Promise<T>): Promise<T> {
  const b = backend();
  if (!b) return fallback;
  try { return await read(b); } catch { return fallback; }
}

export function listPublished(limit = 100): Promise<BlogPost[]> {
  return quietly([], async (b) => (await b.getMany(await b.ids('published', limit))).filter((p) => p.status === 'published'));
}

export function getPublishedBySlug(slug: string): Promise<BlogPost | null> {
  return quietly(null, async (b) => {
    const id = await b.idForSlug(slug);
    const post = id ? await b.get(id) : null;
    return post?.status === 'published' ? post : null;
  });
}

// Admin reads and writes do throw on a store failure, so the editor can say so.
export async function listAll(limit = 200): Promise<Result<BlogPost[]>> {
  const b = backend();
  if (!b) return { ok: false, error: 'store_unavailable' };
  return { ok: true, value: await b.getMany(await b.ids('all', limit)) };
}

export async function getPost(id: string): Promise<Result<BlogPost>> {
  const b = backend();
  if (!b) return { ok: false, error: 'store_unavailable' };
  const post = await b.get(id);
  return post ? { ok: true, value: post } : { ok: false, error: 'not_found' };
}

// Create (no id) or update a post's content. Status and dates are the store's.
export async function savePost(
  input: PostInput,
  author: { email: string; name: string },
  id?: string,
  now = Date.now(),
): Promise<Result<BlogPost>> {
  const b = backend();
  if (!b) return { ok: false, error: 'store_unavailable' };

  if (!id) {
    const post: BlogPost = {
      id: randomUUID(), ...input, status: 'draft',
      authorEmail: author.email, authorName: author.name,
      createdAt: now, updatedAt: now, publishedAt: null,
    };
    if (!(await b.claimSlug(input.slug, post.id))) return { ok: false, error: 'slug_taken' };
    await b.write(post);
    return { ok: true, value: post };
  }

  const existing = await b.get(id);
  if (!existing) return { ok: false, error: 'not_found' };
  if (input.slug !== existing.slug) {
    if (!(await b.claimSlug(input.slug, id))) return { ok: false, error: 'slug_taken' };
    await b.releaseSlug(existing.slug);
  }
  const post: BlogPost = { ...existing, ...input, updatedAt: now };
  await b.write(post);
  return { ok: true, value: post };
}

export async function setStatus(id: string, status: 'draft' | 'published', now = Date.now()): Promise<Result<BlogPost>> {
  const b = backend();
  if (!b) return { ok: false, error: 'store_unavailable' };
  const existing = await b.get(id);
  if (!existing) return { ok: false, error: 'not_found' };
  const post: BlogPost = {
    ...existing,
    status,
    updatedAt: now,
    // The first publication date stands: republishing a corrected post does not
    // move it to the top of the blog as if it were new.
    publishedAt: status === 'published' ? existing.publishedAt ?? now : existing.publishedAt,
  };
  await b.write(post);
  return { ok: true, value: post };
}

export async function deletePost(id: string): Promise<Result<BlogPost>> {
  const b = backend();
  if (!b) return { ok: false, error: 'store_unavailable' };
  const existing = await b.get(id);
  if (!existing) return { ok: false, error: 'not_found' };
  await b.remove(existing);
  return { ok: true, value: existing };
}
