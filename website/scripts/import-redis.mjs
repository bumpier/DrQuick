// One-off: copies the old Redis (Upstash / Vercel KV) waitlist and blog into
// Postgres. Safe to rerun — rows that already exist are skipped.
//
//   DATABASE_URL=... KV_REST_API_URL=... KV_REST_API_TOKEN=... node scripts/import-redis.mjs
import { randomBytes } from 'node:crypto';
import postgres from 'postgres';

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
if (!url || !token || !process.env.DATABASE_URL) {
  console.error('Set DATABASE_URL and KV_REST_API_URL / KV_REST_API_TOKEN.');
  process.exit(1);
}

async function redis(...commands) {
  const res = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`Redis HTTP ${res.status}`);
  return (await res.json()).map((r) => r.result);
}

const pairs = (flat) => Array.from({ length: (flat?.length ?? 0) / 2 }, (_, i) => [flat[i * 2], flat[i * 2 + 1]]);
const sql = postgres(process.env.DATABASE_URL, { max: 1 });

let signups = 0;
const [entries] = await redis(['HGETALL', 'waitlist:entries']);
for (const [field, json] of pairs(entries)) {
  let r;
  try { r = JSON.parse(json); } catch { const cut = field.indexOf(':'); r = { role: field.slice(0, cut), email: field.slice(cut + 1) }; }
  if (r.role !== 'patient' && r.role !== 'gp') continue;
  const res = await sql`
    insert into waitlist_signups (role, email, name, mobile, gmc, source, status, unsubscribe_token, created_at, updated_at)
    values (${r.role}, ${r.email}, ${r.name ?? null}, ${r.mobile ?? null}, ${r.gmc ?? null}, ${r.source ?? 'landing'},
            ${r.role === 'gp' ? 'new' : 'subscribed'}, ${randomBytes(24).toString('base64url')},
            ${r.joinedAt ?? new Date().toISOString()}, now())
    on conflict do nothing`;
  signups += res.count;
}

let posts = 0;
const [ids] = await redis(['ZRANGE', 'blog:all', 0, -1]);
for (const id of ids ?? []) {
  const [flat] = await redis(['HGETALL', `blog:post:${id}`]);
  const h = Object.fromEntries(pairs(flat));
  if (!h.id) continue;
  const ts = (v) => (v ? new Date(Number(v)).toISOString() : null);
  const res = await sql`
    insert into blog_posts (id, slug, title, summary, body, tone, status, author_email, author_name, created_at, updated_at, published_at)
    values (${h.id}, ${h.slug}, ${h.title}, ${h.summary}, ${h.body}, ${h.tone || 'wash'}, ${h.status === 'published' ? 'published' : 'draft'},
            ${h.authorEmail}, ${h.authorName}, ${ts(h.createdAt)}, ${ts(h.updatedAt)}, ${ts(h.publishedAt)})
    on conflict do nothing`;
  posts += res.count;
}

console.log(`Imported ${signups} sign-ups and ${posts} blog posts.`);
await sql.end();
