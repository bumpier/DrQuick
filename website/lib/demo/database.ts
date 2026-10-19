// The demo deployment's database rule (docs/superpowers/plans/2026-10-19-live-
// demo-deployment.md): a database on this machine whose name, in the URL's
// path, contains "demo", with no name in the query. postgres.js sends unknown
// query parameters in its startup message, where a `database` would override
// the path and connect to the real database under a demo name.
//
// Pure, so both the proxy (through lib/demo/session.ts demoConfigured: a wrong
// database answers 503 everywhere) and assertLocal (lib/dev/seed-doctor.ts,
// before any demo write) use it; the proxy must never load the seed.
// scripts/demo-preflight.mjs repeats it for the deploy script, which runs
// before any of this is built; tests/demo-preflight.test.ts holds the two together.

export type DemoDatabaseProblem = 'missing' | 'not_local' | 'not_demo' | 'named_in_query';

export const LOOPBACK_HOSTS: readonly string[] = ['localhost', '127.0.0.1', '::1', '[::1]'];
const NAME_PARAMS = ['database', 'db', 'dbname'];

/** The URL's host, or '' if it is not a URL. */
export function databaseHost(url: string): string {
  try { return new URL(url).hostname; } catch { return ''; }
}

/** Null if `url` is a database the demo may write to; otherwise what is wrong with it. */
export function demoDatabaseProblem(url: string | undefined): DemoDatabaseProblem | null {
  if (!url) return 'missing';
  let parsed: URL;
  try { parsed = new URL(url); } catch { return 'not_local'; }
  if (!LOOPBACK_HOSTS.includes(parsed.hostname)) return 'not_local';
  let name = '';
  try { name = decodeURIComponent(parsed.pathname.replace(/^\//, '')); } catch { return 'not_demo'; }
  if (!name.includes('demo')) return 'not_demo';
  if ([...parsed.searchParams.keys()].some((key) => NAME_PARAMS.includes(key.toLowerCase()))) return 'named_in_query';
  return null;
}
