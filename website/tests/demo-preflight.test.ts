// scripts/demo-preflight.mjs: what scripts/deploy.sh checks, with BIND_LOCAL=1
// (the demo copy, docs/demo-deploy.md), before it installs, migrates or builds
// anything. Run as the deploy script runs it: a separate node process in the
// checkout's website folder. Every value here is fake.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { demoDatabaseProblem } from '@/lib/demo/database';

const SCRIPT = join(__dirname, '../scripts/demo-preflight.mjs');
const DEMO_DB = 'postgres://drquick_demo:fake-password@127.0.0.1:5432/drquick_demo';

const GOOD: Record<string, string> = {
  NEXT_PUBLIC_DEMO: '1',
  DEMO_DEPLOYMENT: '1',
  NEXT_PUBLIC_SITE_URL: 'https://demo.drquick.co.uk',
  DATABASE_URL: DEMO_DB,
  DEMO_PASSCODE: 'fake-passcode-of-enough-length',
  DEMO_SESSION_SECRET: 'f'.repeat(64),
  DOCTOR_SESSION_SECRET: 'd'.repeat(64),
  CALL_KEY_SECRET: 'Y2FsbC1rZXktZmFrZS1jYWxsLWtleS1mYWtlLWNhbGw=',
  LIVEKIT_URL: 'wss://fake-project.livekit.cloud',
  LIVEKIT_API_KEY: 'APIfake',
  LIVEKIT_API_SECRET: 's'.repeat(40),
  LIVEKIT_CLOUD_TEST_ONLY: '1',
};

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'dq-preflight-')); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const envFile = (values: Record<string, string>, extra = '') =>
  writeFileSync(join(dir, '.env.production'), `# the demo copy\n${Object.entries(values).map(([k, v]) => `${k}=${v}`).join('\n')}\n${extra}`);

// Only PATH and HOME from the test's own environment, so a DATABASE_URL set
// where the tests run cannot leak in.
function run(env: Record<string, string> = {}) {
  const result = spawnSync(process.execPath, [SCRIPT, dir], {
    env: { NODE_ENV: 'production', PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', ...env }, encoding: 'utf8',
  });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
}

describe('the demo copy’s pre-flight', () => {
  test('passes a complete, sound .env.production', () => {
    envFile(GOOD);
    expect(run()).toEqual({ code: 0, out: expect.stringContaining('ready') });
  });

  test('accepts quoted values, as Next and the migration read them', () => {
    envFile({ ...GOOD, DEMO_PASSCODE: `"${GOOD.DEMO_PASSCODE}"`, DATABASE_URL: `'${DEMO_DB}'` });
    expect(run().code).toBe(0);
  });

  test('refuses a checkout with no .env.production', () => {
    const { code, out } = run();
    expect(code).toBe(1);
    expect(out).toContain('.env.production');
  });

  test('names every missing or empty setting, and never prints a value', () => {
    const { DEMO_PASSCODE: _p, LIVEKIT_URL: _l, ...rest } = GOOD;
    envFile({ ...rest, CALL_KEY_SECRET: '' });
    const { code, out } = run();
    expect(code).toBe(1);
    for (const name of ['DEMO_PASSCODE', 'LIVEKIT_URL', 'CALL_KEY_SECRET']) expect(out).toContain(name);
    for (const value of Object.values(GOOD).filter((v) => v.length > 2)) expect(out).not.toContain(value);
  });

  test('refuses flags that are not 1', () => {
    for (const name of ['NEXT_PUBLIC_DEMO', 'DEMO_DEPLOYMENT', 'LIVEKIT_CLOUD_TEST_ONLY']) {
      envFile({ ...GOOD, [name]: 'true' });
      const { code, out } = run();
      expect(code, name).toBe(1);
      expect(out, name).toContain(name);
    }
  });

  test('refuses a short passcode or secret, counted without the spaces around them', () => {
    envFile({ ...GOOD, DEMO_PASSCODE: `"  ${'p'.repeat(15)}  "` });
    expect(run().out).toContain('DEMO_PASSCODE');
    envFile({ ...GOOD, DEMO_SESSION_SECRET: `"${' '.repeat(40)}"` });
    expect(run().out).toContain('DEMO_SESSION_SECRET');
  });

  test('refuses a $ in any value, which Next would expand', () => {
    envFile({ ...GOOD, DEMO_PASSCODE: 'fake-passcode-$HOME-long' });
    const { code, out } = run();
    expect(code).toBe(1);
    expect(out).toContain('DEMO_PASSCODE');
    expect(out).not.toContain('fake-passcode');
  });

  test('refuses a setting given twice: Next would read the last, the migration the first', () => {
    envFile(GOOD, 'DATABASE_URL=postgres://u:p@127.0.0.1:5432/drquick\n');
    const { code, out } = run();
    expect(code).toBe(1);
    expect(out).toContain('DATABASE_URL');
  });

  // The same rule as lib/demo/database.ts, which the app enforces at run time.
  test.each([
    ['the real database', 'postgres://u:p@127.0.0.1:5432/drquick', false],
    ['a remote database', 'postgres://u:p@db.example.com:5432/drquick_demo', false],
    ['the demo name, overridden in the query', `${DEMO_DB}?database=drquick`, false],
    ['the same, in capitals', `${DEMO_DB}?DBNAME=drquick`, false],
    ['a bare db parameter', `${DEMO_DB}?db`, false],
    ['the demo database, with harmless parameters', `${DEMO_DB}?sslmode=disable`, true],
    ['the demo database on localhost', 'postgres://u:p@localhost/drquick_demo', true],
  ])('DATABASE_URL: %s', (_name, url, ok) => {
    expect(demoDatabaseProblem(url) === null).toBe(ok);
    envFile({ ...GOOD, DATABASE_URL: url });
    const { code, out } = run();
    expect(code).toBe(ok ? 0 : 1);
    if (!ok) expect(out).toContain('DATABASE_URL');
    expect(out).not.toContain('fake-password');
  });

  test('refuses a DATABASE_URL exported in the shell: the migration would read it before the file', () => {
    envFile(GOOD);
    const { code, out } = run({ DATABASE_URL: DEMO_DB });
    expect(code).toBe(1);
    expect(out).toContain('DATABASE_URL');
  });

  test('refuses a .env.local or .env.production.local, which Next reads over .env.production', () => {
    for (const file of ['.env.local', '.env.production.local']) {
      envFile(GOOD);
      writeFileSync(join(dir, file), 'DATABASE_URL=postgres://u:p@127.0.0.1:5432/drquick\n');
      const { code, out } = run();
      expect(code, file).toBe(1);
      expect(out, file).toContain(file);
      rmSync(join(dir, file));
    }
  });
});
