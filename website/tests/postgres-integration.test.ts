// Against a real Postgres over postgres.js — the production driver, whose
// execute() result is shaped differently from PGlite's. Opt-in: runs only
// with TEST_DATABASE_URL pointing at a migrated, disposable database, e.g.
//   TEST_DATABASE_URL=postgres://drquick:drquick@127.0.0.1:55432/drquick npx vitest run tests/postgres-integration.test.ts
import { afterAll, beforeAll, expect, test } from 'vitest';
import { getDb, setDb } from '@/lib/db';
import { hashKey, hit } from '@/lib/rate-limit';
import { erasePerson, joinWaitlist } from '@/lib/waitlist';

const url = process.env.TEST_DATABASE_URL;

beforeAll(() => {
  if (!url) return;
  setDb(undefined);
  process.env.DATABASE_URL = url;
});
afterAll(() => { delete process.env.DATABASE_URL; });

test.runIf(Boolean(url))('rate limit, join and erase work over postgres.js', async () => {
  const db = (await getDb())!;
  const key = hashKey('rl:test', String(Date.now()));
  expect(await hit(db, key, 60)).toBe(1);
  expect(await hit(db, key, 60)).toBe(2);

  const email = `it-${Date.now()}@example.com`;
  const first = await joinWaitlist(db, { role: 'patient', email, source: 'test' });
  const again = await joinWaitlist(db, { role: 'patient', email, source: 'test' });
  expect([first.alreadyJoined, again.alreadyJoined]).toEqual([false, true]);
  expect(await erasePerson(db, email)).toBe(1);
});
