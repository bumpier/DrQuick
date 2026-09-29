// A fresh in-memory Postgres (PGlite) per test file, migrated from drizzle/,
// installed as the app's database with setDb(). resetDb() empties every table
// between tests without paying for a new instance.
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { sql } from 'drizzle-orm';
import path from 'node:path';
import { setDb, schema, type DB } from '@/lib/db';
import { rowsOf } from '@/lib/rate-limit';

export async function useTestDb(): Promise<DB> {
  // PGlite unpacks its data directory through Blob.arrayBuffer(), which jsdom's
  // Blob lacks; component tests (// @vitest-environment jsdom) need it filled in.
  if (typeof Blob !== 'undefined' && !Blob.prototype.arrayBuffer) {
    Blob.prototype.arrayBuffer = function arrayBuffer(this: Blob) {
      return new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    };
  }
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
  setDb(db as unknown as DB);
  return db as unknown as DB;
}

export async function resetDb(db: DB) {
  const tables = rowsOf<{ tablename: string }>(await db.execute(sql`select tablename from pg_tables where schemaname = 'public'`));
  const names = tables.map((t) => `"${t.tablename}"`).join(', ');
  if (names) await db.execute(sql.raw(`truncate ${names} restart identity`));
}
