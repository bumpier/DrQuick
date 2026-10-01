import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname) } },
  test: {
    environment: 'node', // component tests opt into jsdom with a // @vitest-environment jsdom pragma
    include: ['tests/**/*.test.{ts,tsx}'],
    // A database test file's beforeAll starts an in-process Postgres and runs
    // every migration (tests/helpers/db.ts): two seconds alone, but well past
    // the default ten when every worker does it at once on a busy machine.
    hookTimeout: 30_000,
  },
});
