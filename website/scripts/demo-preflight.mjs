// The demo copy's pre-flight (docs/demo-deploy.md): run by scripts/deploy.sh
// with BIND_LOCAL=1, from the checkout's website folder, before it installs,
// migrates or builds anything. A demo copy deployed with a wrong
// .env.production would migrate the wrong database, or build pages that bake
// in the wrong switch, so the deploy stops here instead.
//
//   node scripts/demo-preflight.mjs [the website folder]
//
// Exits 0 when the settings are complete and sound; otherwise 1, naming each
// setting at fault. It never prints a value. The database rule repeats
// lib/demo/database.ts (this runs before anything is built);
// tests/demo-preflight.test.ts holds the two together.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const dir = path.resolve(process.argv[2] ?? process.cwd());

// Each name docs/demo-deploy.md (step 4) asks for.
const REQUIRED = [
  'NEXT_PUBLIC_DEMO', 'DEMO_DEPLOYMENT', 'NEXT_PUBLIC_SITE_URL', 'DATABASE_URL', 'DEMO_PASSCODE', 'DEMO_SESSION_SECRET',
  'DOCTOR_SESSION_SECRET', 'CALL_KEY_SECRET', 'LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'LIVEKIT_CLOUD_TEST_ONLY',
];
const FLAGS = ['NEXT_PUBLIC_DEMO', 'DEMO_DEPLOYMENT', 'LIVEKIT_CLOUD_TEST_ONLY'];
const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];
const NAME_PARAMS = ['database', 'db', 'dbname'];

// The values a .env file gives each name, every one of them, read the way
// scripts/migrate.mjs reads them: NAME=value, trimmed, one pair of quotes off.
function readEnv(file) {
  const values = new Map();
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    values.set(m[1], [...(values.get(m[1]) ?? []), m[2].replace(/^(["'])(.*)\1$/, '$2')]);
  }
  return values;
}

// The rule of lib/demo/database.ts.
function databaseProblem(url) {
  let parsed;
  try { parsed = new URL(url); } catch { return 'is not a database URL on this machine'; }
  if (!LOOPBACK_HOSTS.includes(parsed.hostname)) return 'must point at this machine (127.0.0.1)';
  let name = '';
  try { name = decodeURIComponent(parsed.pathname.replace(/^\//, '')); } catch { /* reported below */ }
  if (!name.includes('demo')) return 'must name a database containing "demo" in its path';
  if ([...parsed.searchParams.keys()].some((key) => NAME_PARAMS.includes(key.toLowerCase()))) {
    return 'must not carry a database, db or dbname parameter';
  }
  return null;
}

const problems = [];
const file = path.join(dir, '.env.production');

if (!existsSync(file)) {
  problems.push(`No .env.production in ${dir}: create it from docs/demo-deploy.md step 4.`);
} else {
  const env = readEnv(file);
  const value = (name) => env.get(name)?.[0] ?? '';
  for (const name of REQUIRED) {
    const given = env.get(name) ?? [];
    if (given.length > 1) problems.push(`${name} is set ${given.length} times: set it once (Next reads the last, the migration the first).`);
    else if (!value(name)) problems.push(`${name} is missing or empty.`);
    else if (value(name).includes('$')) problems.push(`${name} contains a $, which Next expands: generate another value.`);
  }
  for (const name of FLAGS) {
    if (value(name) && value(name) !== '1') problems.push(`${name} must be 1.`);
  }
  if (value('DEMO_PASSCODE') && value('DEMO_PASSCODE').trim().length < 16) {
    problems.push('DEMO_PASSCODE must be at least 16 characters, not counting spaces around it.');
  }
  if (value('DEMO_SESSION_SECRET') && value('DEMO_SESSION_SECRET').trim().length < 32) {
    problems.push('DEMO_SESSION_SECRET must be at least 32 characters, not counting spaces around it.');
  }
  if (value('NEXT_PUBLIC_SITE_URL') && !value('NEXT_PUBLIC_SITE_URL').startsWith('https://')) {
    problems.push('NEXT_PUBLIC_SITE_URL must be the demo\'s https:// address.');
  }
  const database = env.get('DATABASE_URL')?.length === 1 ? value('DATABASE_URL') : '';
  const wrong = database && databaseProblem(database);
  if (wrong) problems.push(`DATABASE_URL ${wrong}.`);
}

// What would quietly win over .env.production.
if (process.env.DATABASE_URL) {
  problems.push('DATABASE_URL is set in this shell, and the migration reads it before .env.production: unset DATABASE_URL, then rerun.');
}
for (const other of ['.env.local', '.env.production.local']) {
  if (existsSync(path.join(dir, other))) problems.push(`${other} exists, and Next reads it over .env.production: remove it, then rerun.`);
}

if (problems.length) {
  for (const problem of problems) console.error(`xx ${problem}`);
  process.exit(1);
}
console.log('Demo pre-flight: the settings are complete; the copy is ready to deploy.');
