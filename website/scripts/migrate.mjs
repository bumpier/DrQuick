// Applies pending migrations from drizzle/ to DATABASE_URL. Run by
// scripts/deploy.sh before every build, and by `npm run db:migrate`.
//
// Outside Next nothing loads .env files, so DATABASE_URL is read from the
// environment first, then .env.production, .env.local and .env, in that order.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const root = path.resolve(import.meta.dirname, '..');

export function fromEnvFiles(name) {
  for (const file of ['.env.production', '.env.local', '.env']) {
    const full = path.join(root, file);
    if (!existsSync(full)) continue;
    for (const line of readFileSync(full, 'utf8').split('\n')) {
      const m = line.match(new RegExp(`^\\s*${name}\\s*=\\s*(.*?)\\s*$`));
      if (m && m[1]) return m[1].replace(/^["']|["']$/g, '');
    }
  }
  return '';
}

const url = process.env.DATABASE_URL || fromEnvFiles('DATABASE_URL');
if (!url) {
  console.error('DATABASE_URL is not set (environment, .env.production, .env.local or .env). See docs/postgres-vps.md.');
  process.exit(1);
}

const client = postgres(url, { max: 1, onnotice: () => {} });
try {
  await migrate(drizzle(client), { migrationsFolder: path.join(root, 'drizzle') });
  console.log('Migrations applied.');
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
