// Fixed-window rate limiting in Postgres, replacing Redis INCR + EXPIRE NX.
// One upsert per hit: a key whose window has ended starts again at 1. Keys are
// always salted hashes (hashKey), never a raw IP or email.
import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { DB } from '@/lib/db';

export function hashKey(scope: string, ...parts: string[]): string {
  const salt = process.env.RATE_LIMIT_SALT || 'dr-quick';
  return `${scope}:${createHash('sha256').update([salt, ...parts].join('|')).digest('hex').slice(0, 24)}`;
}

// The hit count within the current window, this hit included.
export async function hit(db: DB, key: string, windowSeconds: number, now = new Date()): Promise<number> {
  const ends = new Date(now.getTime() + windowSeconds * 1000);
  const result = await db.execute(sql`
    insert into rate_limits (key, count, window_ends_at) values (${key}, 1, ${ends.toISOString()})
    on conflict (key) do update set
      count = case when rate_limits.window_ends_at <= ${now.toISOString()} then 1 else rate_limits.count + 1 end,
      window_ends_at = case when rate_limits.window_ends_at <= ${now.toISOString()} then excluded.window_ends_at else rate_limits.window_ends_at end
    returning count`);
  // Stale keys are swept now and then rather than on a schedule.
  if (Math.random() < 0.01) {
    await db.execute(sql`delete from rate_limits where window_ends_at < ${now.toISOString()}`);
  }
  return Number(rowsOf<{ count: number }>(result)[0]?.count ?? 0);
}

// postgres.js returns the rows array itself; PGlite returns { rows }.
export function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  return ((result as { rows?: T[] })?.rows ?? []) as T[];
}
