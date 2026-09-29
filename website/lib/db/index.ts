// The database handle, server-only. Three backends, one Drizzle API:
//
//   DATABASE_URL set      Postgres over postgres.js (production, and any dev
//                         machine running a local Postgres)
//   unset, not production PGlite — Postgres compiled to WASM, in-process — in
//                         .data/pglite, migrated on first use, so `npm run dev`
//                         works with nothing installed
//   unset, production     no database: callers answer 'store_unavailable'
//
// Tests install their own in-memory PGlite with setDb() (tests/helpers/db.ts).
// Env is read per call, not at module load, so tests can stub it.
import path from 'node:path';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from '@/lib/db/schema';

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;
export { schema };

type Holder = { override?: DB | null; pg?: DB; pgUrl?: string; dev?: Promise<DB> };
// On globalThis so a dev server's hot reload keeps one connection pool.
const g = globalThis as typeof globalThis & { __drQuickDb?: Holder };
const holder = (): Holder => (g.__drQuickDb ??= {});

export const MIGRATIONS = path.join(process.cwd(), 'drizzle');

export function setDb(db: DB | null | undefined) {
  holder().override = db;
}

export function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL) || process.env.NODE_ENV !== 'production';
}

export async function getDb(): Promise<DB | null> {
  const h = holder();
  if (h.override !== undefined) return h.override;

  const url = process.env.DATABASE_URL;
  if (url) {
    if (!h.pg || h.pgUrl !== url) {
      const [{ default: postgres }, { drizzle }] = await Promise.all([
        import('postgres'),
        import('drizzle-orm/postgres-js'),
      ]);
      const client = postgres(url, { max: 10, idle_timeout: 30, connect_timeout: 5 });
      h.pg = drizzle(client, { schema }) as unknown as DB;
      h.pgUrl = url;
    }
    return h.pg;
  }

  if (process.env.NODE_ENV === 'production') return null;
  return (h.dev ??= devDatabase());
}

async function devDatabase(): Promise<DB> {
  const [{ PGlite }, { drizzle }, { migrate }] = await Promise.all([
    import('@electric-sql/pglite'),
    import('drizzle-orm/pglite'),
    import('drizzle-orm/pglite/migrator'),
  ]);
  const client = new PGlite(path.join(process.cwd(), '.data', 'pglite'));
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as DB;
}
