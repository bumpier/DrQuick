import { defineConfig } from 'drizzle-kit';

// `npm run db:generate` diffs lib/db/schema.ts against drizzle/ and writes the
// next migration; commit it. `npm run db:migrate` applies pending ones.
export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
