import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname) } },
  test: {
    environment: 'node', // component tests opt into jsdom with a // @vitest-environment jsdom pragma
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
