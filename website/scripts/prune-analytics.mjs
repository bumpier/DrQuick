// Enforces the 13-month analytics retention the privacy notice promises. Run
// from a nightly VPS cron: `npm run analytics:prune`.
//
//   events    older than 13 months are removed
//   sessions  not seen for 13 months are removed
//   visitors  not seen for 13 months are removed — except one still linked from
//             a waitlist sign-up, which stays until the sign-up itself is erased
//             (lib/waitlist.ts erasePerson removes it then)
//
// Like scripts/migrate.mjs, DATABASE_URL is read from the environment first,
// then .env.production, .env.local and .env, in that order.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';

const root = path.resolve(import.meta.dirname, '..');

function fromEnvFiles(name) {
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

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  const counts = await sql.begin(async (tx) => {
    const ev = await tx`delete from events where ts < now() - interval '13 months'`;
    const se = await tx`delete from sessions where last_seen < now() - interval '13 months'`;
    const vi = await tx`
      delete from visitors v
      where v.last_seen < now() - interval '13 months'
        and not exists (select 1 from waitlist_signups w where w.visitor_id = v.id)`;
    return { events: ev.count, sessions: se.count, visitors: vi.count };
  });
  console.log(`Pruned analytics older than 13 months: ${counts.events} events, ${counts.sessions} sessions, ${counts.visitors} visitors.`);
} catch (err) {
  console.error('Prune failed:', err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
