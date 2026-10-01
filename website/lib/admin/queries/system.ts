// The System pages' data: health checks, the environment checklist, the
// email log and the audit log. Server-only.
//
// The environment checklist reports only whether each variable is set. It
// never reads a value into anything it returns, so no secret can reach a page.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { sql, type SQL } from 'drizzle-orm';
import type { DB } from '@/lib/db';
import { MIGRATIONS } from '@/lib/db';
import { rowsOf } from '@/lib/rate-limit';
import { emailConfigured } from '@/lib/email';
import { stripeConfigured } from '@/lib/finance/stripe-webhook';
import { param, type Params } from '@/lib/admin/range';

const n = (v: unknown) => Number(v ?? 0);
const dateOrNull = (v: unknown) => (v ? new Date(v as string | Date) : null);
const DAY = 86_400_000;

/* ---------------------------------------------------------- database */

export type TableCount = { name: string; rows: number; approx: boolean };

export type DatabaseHealth = {
  ok: boolean;
  error: string | null;
  latencyMs: number | null;
  version: string | null;
  driver: 'postgres' | 'pglite';
  migrations: { applied: number | null; files: number; lastAppliedAt: Date | null };
  sizeBytes: number | null;
  tables: TableCount[];
};

// The migrations drizzle-kit has written, from its journal.
export function migrationFiles(dir = MIGRATIONS): number {
  try {
    const journal = JSON.parse(readFileSync(path.join(dir, 'meta', '_journal.json'), 'utf8')) as { entries?: unknown[] };
    return journal.entries?.length ?? 0;
  } catch {
    return 0;
  }
}

// Above this many rows (by the planner's estimate) a table is not counted
// exactly; the page labels the figure "approx".
const EXACT_LIMIT = 200_000;

export async function databaseHealth(db: DB): Promise<DatabaseHealth> {
  const driver = process.env.DATABASE_URL ? 'postgres' : 'pglite';
  const files = migrationFiles();
  const base: DatabaseHealth = {
    ok: false, error: null, latencyMs: null, version: null, driver,
    migrations: { applied: null, files, lastAppliedAt: null }, sizeBytes: null, tables: [],
  };
  try {
    const t0 = performance.now();
    await db.execute(sql`select 1`);
    base.latencyMs = Math.round((performance.now() - t0) * 10) / 10;
    base.ok = true;
  } catch (err) {
    return { ...base, error: String((err as Error)?.message ?? err).slice(0, 200) };
  }

  const [v] = rowsOf<{ server_version: string }>(await db.execute(sql`show server_version`).catch(() => []));
  base.version = v?.server_version ?? null;

  try {
    const [m] = rowsOf<{ c: number; last: string | number | null }>(await db.execute(sql`
      select count(*)::int as c, max(created_at)::text as last from drizzle.__drizzle_migrations`));
    base.migrations.applied = n(m?.c);
    base.migrations.lastAppliedAt = m?.last ? new Date(Number(m.last)) : null;
  } catch {
    base.migrations.applied = null; // no migrations table: never migrated
  }

  const [s] = rowsOf<{ size: number }>(await db.execute(sql`select pg_database_size(current_database())::bigint as size`).catch(() => []));
  base.sizeBytes = s ? n(s.size) : null;

  const tables = rowsOf<{ name: string; estimate: number }>(await db.execute(sql`
    select c.relname as name, greatest(c.reltuples, 0)::bigint as estimate
    from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public' and c.relkind = 'r' order by c.relname`));
  for (const t of tables) {
    if (n(t.estimate) > EXACT_LIMIT) {
      base.tables.push({ name: t.name, rows: n(t.estimate), approx: true });
      continue;
    }
    // Names come from pg_class, not from a request; quoted all the same.
    const [c] = rowsOf<{ c: number }>(await db.execute(sql.raw(`select count(*)::bigint as c from "${t.name.replace(/"/g, '""')}"`)));
    base.tables.push({ name: t.name, rows: n(c?.c), approx: false });
  }
  return base;
}

/* ------------------------------------------------ the other services */

export async function emailHealth(db: DB, now = new Date()) {
  const since = new Date(now.getTime() - 7 * DAY).toISOString();
  const [last] = rowsOf<{ status: string; template: string; created_at: string | Date; error: string | null }>(await db.execute(sql`
    select status, template, created_at, error from email_log order by created_at desc, id desc limit 1`));
  const counts = rowsOf<{ status: string; c: number }>(await db.execute(sql`
    select status, count(*)::int as c from email_log where created_at >= ${since} group by status`));
  const by = Object.fromEntries(counts.map((r) => [r.status, n(r.c)]));
  return {
    configured: emailConfigured(),
    last: last ? { status: last.status, template: last.template, at: new Date(last.created_at), error: last.error } : null,
    week: { sent: by.sent ?? 0, failed: by.failed ?? 0, skipped: by.skipped ?? 0 },
  };
}

export async function stripeHealth(db: DB) {
  const [last] = rowsOf<{ type: string; received_at: string | Date }>(await db.execute(sql`
    select type, received_at from stripe_events order by received_at desc limit 1`).catch(() => []));
  return {
    configured: stripeConfigured(),
    secretKey: Boolean(process.env.STRIPE_SECRET_KEY),
    webhookSecret: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    lastEvent: last ? { type: last.type, at: new Date(last.received_at) } : null,
  };
}

export async function analyticsHealth(db: DB, now = new Date()) {
  const since = new Date(now.getTime() - DAY).toISOString();
  const [row] = rowsOf<{ events: number; last: string | Date | null; errors: number }>(await db.execute(sql`
    select
      (select count(*) from events where ts >= ${since})::int as events,
      (select max(ts) from events) as last,
      (select count(*) from app_errors where route = '/api/collect' and created_at >= ${since})::int as errors`));
  return { events24h: n(row?.events), lastEventAt: dateOrNull(row?.last), collectErrors24h: n(row?.errors) };
}

export async function recentErrors(db: DB, limit = 20) {
  const rows = rowsOf<{ id: number; route: string; message: string; created_at: string | Date }>(await db.execute(sql`
    select id, route, message, created_at from app_errors order by created_at desc, id desc limit ${limit}`));
  return rows.map((r) => ({ id: n(r.id), route: r.route, message: r.message, createdAt: new Date(r.created_at) }));
}

/* ------------------------------------------------- the environment */

export type EnvVar = { name: string; set: boolean; about: string };

// Used when .env.example is not beside the server (it is, on the VPS).
const FALLBACK_ENV = [
  'DATABASE_URL', 'WAITLIST_EXPORT_TOKEN', 'RATE_LIMIT_SALT', 'NEXT_PUBLIC_SITE_URL', 'ADMIN_USERS', 'ADMIN_SESSION_SECRET',
  'DOCTOR_SESSION_SECRET', 'NEXT_SERVER_ACTIONS_ENCRYPTION_KEY', 'NEXT_PUBLIC_CONTACT_EMAIL', 'RESEND_API_KEY', 'EMAIL_FROM', 'ADMIN_ALERT_EMAILS',
  'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET',
];

// Each NAME= line in the example file, described by the first sentence of
// the comment block above it (variables listed together share one). Pure.
export function parseEnvExample(text: string): Array<{ name: string; about: string }> {
  const out: Array<{ name: string; about: string }> = [];
  let block: string[] = [];
  let afterVar = false;
  const sentence = (lines: string[]) => {
    const joined = lines.join(' ').replace(/\s+/g, ' ').trim();
    const m = /^.*?[.!?](?=\s+[A-Z(]|$)/.exec(joined);
    return (m ? m[0] : joined).slice(0, 160);
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('#')) {
      if (afterVar) { block = []; afterVar = false; }
      block.push(line.replace(/^#\s?/, ''));
      continue;
    }
    const m = /^([A-Z][A-Z0-9_]*)=/.exec(line);
    if (m) {
      if (!out.some((v) => v.name === m[1])) out.push({ name: m[1], about: sentence(block) });
      afterVar = true;
      continue;
    }
    if (line === '') { block = []; afterVar = false; }
  }
  return out;
}

export function envChecklist(env: Record<string, string | undefined> = process.env, file = path.join(process.cwd(), '.env.example')): EnvVar[] {
  let names: Array<{ name: string; about: string }>;
  try {
    names = parseEnvExample(readFileSync(file, 'utf8'));
  } catch {
    names = [];
  }
  if (names.length === 0) names = FALLBACK_ENV.map((name) => ({ name, about: '' }));
  // Only a boolean leaves this function.
  return names.map(({ name, about }) => ({ name, about, set: typeof env[name] === 'string' && env[name]!.trim() !== '' }));
}

/* ------------------------------------------------------ build info */

export function buildInfo() {
  let nextVersion: string | null = null;
  try {
    nextVersion = (JSON.parse(readFileSync(path.join(process.cwd(), 'node_modules', 'next', 'package.json'), 'utf8')) as { version?: string }).version ?? null;
  } catch { /* not beside the server */ }
  return {
    node: process.version,
    next: nextVersion,
    sha: process.env.NEXT_PUBLIC_BUILD_SHA || null,
    builtAt: process.env.NEXT_PUBLIC_BUILD_TIME ? new Date(process.env.NEXT_PUBLIC_BUILD_TIME) : null,
    env: process.env.NODE_ENV ?? 'development',
  };
}

/* ---------------------------------------------------- the email log */

export const EMAIL_STATUSES = ['sent', 'failed', 'skipped'] as const;
export const LOG_PAGE_SIZE = 50;

const pageOf = (params: Params) => Math.max(1, Math.floor(Number(param(params, 'page')) || 1));
const pages = (total: number, size: number) => Math.max(1, Math.ceil(total / size));

export type EmailQuery = { status?: string; template?: string; page: number; pageSize: number };

export function parseEmailQuery(params: Params): EmailQuery {
  const status = param(params, 'status');
  const template = param(params, 'template');
  return {
    status: (EMAIL_STATUSES as readonly string[]).includes(status ?? '') ? status : undefined,
    template: template && /^[a-z_]{1,40}$/.test(template) ? template : undefined,
    page: pageOf(params),
    pageSize: LOG_PAGE_SIZE,
  };
}

export async function listEmails(db: DB, q: EmailQuery) {
  const conds: SQL[] = [sql`true`];
  if (q.status) conds.push(sql`status = ${q.status}`);
  if (q.template) conds.push(sql`template = ${q.template}`);
  const where = sql.join(conds, sql` and `);
  const [{ total } = { total: 0 }] = rowsOf<{ total: number }>(await db.execute(sql`select count(*)::int as total from email_log where ${where}`));
  const page = Math.min(q.page, pages(n(total), q.pageSize));
  const rows = rowsOf<{
    id: number; to: string; template: string; subject: string; status: string; error: string | null;
    signup_id: string | null; created_at: string | Date;
  }>(await db.execute(sql`
    select id, "to", template, subject, status, error, signup_id, created_at from email_log where ${where}
    order by created_at desc, id desc limit ${q.pageSize} offset ${(page - 1) * q.pageSize}`));
  return {
    rows: rows.map((r) => ({
      id: n(r.id), to: r.to, template: r.template, subject: r.subject, status: r.status, error: r.error,
      signupId: r.signup_id, createdAt: new Date(r.created_at),
    })),
    total: n(total), page, pages: pages(n(total), q.pageSize),
  };
}

export async function emailTemplates(db: DB): Promise<string[]> {
  return rowsOf<{ template: string }>(await db.execute(sql`select distinct template from email_log order by template`)).map((r) => r.template);
}

/* ---------------------------------------------------- the audit log */

export const AUDIT_LABELS: Record<string, string> = {
  status_change: 'Changed a status',
  notes_update: 'Edited notes',
  bulk_unsubscribe: 'Unsubscribed patients',
  resend_confirmation: 'Resent a confirmation',
  resend_email: 'Resent an email',
  erase_person: 'Erased a person',
  self_erasure: 'Erased themselves by unsubscribe link',
  export_csv: 'Downloaded a waitlist CSV',
  export_revenue_csv: 'Downloaded the revenue CSV',
  doctor_pause: 'Paused a doctor',
  doctor_resume: 'Resumed a doctor',
  doctor_link_sent: 'Emailed a doctor a sign-in link',
};
export const auditLabel = (action: string) => AUDIT_LABELS[action] ?? action.replace(/_/g, ' ');

// One line from an audit row's meta, for the table. Never prints an array's
// contents (the ids of a bulk change), only how many.
export function summariseMeta(action: string, meta: Record<string, unknown> | null): string {
  if (!meta) return '';
  const m = meta;
  switch (action) {
    case 'status_change': return `${m.role ?? ''} ${String(m.from ?? '?')} → ${String(m.to ?? '?')}`.trim();
    case 'notes_update': return `${n(m.length)} characters`;
    case 'bulk_unsubscribe': return `${n(m.count)} ${n(m.count) === 1 ? 'patient' : 'patients'}`;
    case 'erase_person': return `${n(m.signupsRemoved)} ${n(m.signupsRemoved) === 1 ? 'sign-up' : 'sign-ups'} removed${m.via === 'settings' ? ', from Settings' : ''}`;
    case 'export_csv': return `${n(m.rows)} rows${m.status ? `, status ${String(m.status)}` : ''}${m.searched ? ', searched' : ''}`;
    case 'export_revenue_csv': return m.demo ? 'Demo data' : 'Real data';
    case 'resend_confirmation':
    case 'resend_email': return [m.template, m.status].filter(Boolean).map(String).join(', ');
  }
  return Object.entries(m)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? `${v.length} items` : typeof v === 'object' ? '…' : String(v)}`)
    .join(', ');
}

export type AuditQuery = { admin?: string; action?: string; page: number; pageSize: number };

export function parseAuditQuery(params: Params): AuditQuery {
  const admin = param(params, 'admin');
  const action = param(params, 'action');
  return {
    admin: admin && admin.length <= 254 ? admin : undefined,
    action: action && /^[a-z_]{1,60}$/.test(action) ? action : undefined,
    page: pageOf(params),
    pageSize: LOG_PAGE_SIZE,
  };
}

export async function listAudit(db: DB, q: AuditQuery) {
  const conds: SQL[] = [sql`true`];
  if (q.admin) conds.push(sql`admin_email = ${q.admin}`);
  if (q.action) conds.push(sql`action = ${q.action}`);
  const where = sql.join(conds, sql` and `);
  const [{ total } = { total: 0 }] = rowsOf<{ total: number }>(await db.execute(sql`select count(*)::int as total from admin_audit_log where ${where}`));
  const page = Math.min(q.page, pages(n(total), q.pageSize));
  const rows = rowsOf<{ id: number; admin_email: string; action: string; target: string | null; meta: Record<string, unknown> | null; created_at: string | Date }>(
    await db.execute(sql`
      select id, admin_email, action, target, meta, created_at from admin_audit_log where ${where}
      order by created_at desc, id desc limit ${q.pageSize} offset ${(page - 1) * q.pageSize}`));
  return {
    rows: rows.map((r) => ({
      id: n(r.id), admin: r.admin_email, action: r.action, target: r.target,
      meta: typeof r.meta === 'string' ? (JSON.parse(r.meta) as Record<string, unknown>) : r.meta,
      createdAt: new Date(r.created_at),
    })),
    total: n(total), page, pages: pages(n(total), q.pageSize),
  };
}

export async function auditFacets(db: DB) {
  const [admins, actions] = await Promise.all([
    db.execute(sql`select distinct admin_email as v from admin_audit_log order by 1`),
    db.execute(sql`select distinct action as v from admin_audit_log order by 1`),
  ]);
  return { admins: rowsOf<{ v: string }>(admins).map((r) => r.v), actions: rowsOf<{ v: string }>(actions).map((r) => r.v) };
}
