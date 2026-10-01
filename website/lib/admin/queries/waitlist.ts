// The waitlist tables and detail pages. Server-only. Search, filters, sort and
// the page all come from the URL, so every list state is a link.
import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import type { DB } from '@/lib/db';
import { emailLog, GP_STATUSES, PATIENT_STATUSES, waitlistSignups, type WaitlistRole } from '@/lib/db/schema';
import { param, type Params } from '@/lib/admin/range';
import { UUID, type Signup } from '@/lib/waitlist';

export const SORTS = ['joined', 'email', 'status', 'source', 'name'] as const;
export type Sort = (typeof SORTS)[number];
export const PAGE_SIZE = 25;

export type ListQuery = {
  role: WaitlistRole;
  q: string;
  status: string | null;
  source: string | null;
  sort: Sort;
  dir: 'asc' | 'desc';
  page: number;
  pageSize: number;
};

export const statusesFor = (role: WaitlistRole): readonly string[] => (role === 'gp' ? GP_STATUSES : PATIENT_STATUSES);

// Anything the URL says that is not a known value falls back to the default,
// so a hand-edited link can never reach the SQL as anything but a parameter.
export function parseListQuery(role: WaitlistRole, params: Params): ListQuery {
  const status = param(params, 'status') ?? null;
  const sort = param(params, 'sort') as Sort | undefined;
  const page = Number.parseInt(param(params, 'page') ?? '1', 10);
  return {
    role,
    q: (param(params, 'q') ?? '').trim().slice(0, 100),
    status: status && statusesFor(role).includes(status) ? status : null,
    source: (param(params, 'source') ?? '').trim().slice(0, 40) || null,
    sort: sort && SORTS.includes(sort) ? sort : 'joined',
    dir: param(params, 'dir') === 'asc' ? 'asc' : 'desc',
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 10_000) : 1,
    pageSize: PAGE_SIZE,
  };
}

// LIKE treats % and _ as wildcards; a search for "a_b" means the characters.
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

const SORT_COLUMNS = {
  joined: waitlistSignups.createdAt,
  email: waitlistSignups.email,
  status: waitlistSignups.status,
  source: waitlistSignups.source,
  name: waitlistSignups.name,
} as const;

export async function listSignups(db: DB, query: ListQuery) {
  const where: SQL[] = [eq(waitlistSignups.role, query.role)];
  if (query.q) {
    const like = `%${likeEscape(query.q)}%`;
    where.push(or(
      ilike(waitlistSignups.email, like),
      ilike(waitlistSignups.name, like),
      ilike(waitlistSignups.gmc, like),
    )!);
  }
  if (query.status) where.push(eq(waitlistSignups.status, query.status));
  if (query.source) where.push(eq(waitlistSignups.source, query.source));
  const filter = and(...where);

  const [{ total }] = await db.select({ total: count() }).from(waitlistSignups).where(filter);
  const pages = Math.max(1, Math.ceil(Number(total) / query.pageSize));
  const page = Math.min(query.page, pages);
  const order = query.dir === 'asc' ? asc : desc;
  const rows = await db.select().from(waitlistSignups).where(filter)
    .orderBy(order(SORT_COLUMNS[query.sort]), desc(waitlistSignups.createdAt), asc(waitlistSignups.id))
    .limit(query.pageSize).offset((page - 1) * query.pageSize);
  return { rows, total: Number(total), page, pages };
}

// Every row matching the filters, unpaged, for the CSV download.
export async function exportSignups(db: DB, query: ListQuery): Promise<Signup[]> {
  const all = await listSignups(db, { ...query, page: 1, pageSize: 100_000 });
  return all.rows;
}

export async function sourcesFor(db: DB, role: WaitlistRole): Promise<string[]> {
  const rows = await db.selectDistinct({ source: waitlistSignups.source }).from(waitlistSignups)
    .where(eq(waitlistSignups.role, role)).orderBy(asc(waitlistSignups.source));
  return rows.map((r) => r.source);
}

export async function getSignup(db: DB, id: string, role?: WaitlistRole): Promise<Signup | null> {
  if (!UUID.test(id)) return null;
  const [row] = await db.select().from(waitlistSignups).where(eq(waitlistSignups.id, id));
  if (!row || (role && row.role !== role)) return null;
  return row;
}

export async function emailHistory(db: DB, signupId: string) {
  return db.select().from(emailLog).where(eq(emailLog.signupId, signupId)).orderBy(desc(emailLog.createdAt)).limit(50);
}

// The GP pipeline: every application, grouped by status in pipeline order,
// newest first inside each column.
export async function gpBoard(db: DB) {
  const rows = await db.select({
    id: waitlistSignups.id, name: waitlistSignups.name, email: waitlistSignups.email,
    gmc: waitlistSignups.gmc, status: waitlistSignups.status, createdAt: waitlistSignups.createdAt,
    feeStatus: waitlistSignups.feeStatus,
  }).from(waitlistSignups).where(eq(waitlistSignups.role, 'gp')).orderBy(desc(waitlistSignups.createdAt));
  return GP_STATUSES.map((status) => ({ status, cards: rows.filter((r) => r.status === status) }));
}

// The sign-up fee across every GP application: what has been collected, who
// started paying and stopped, and what went back.
export type FeeSummary = { paid: number; collectedPence: number; unpaid: number; refunded: number };

export async function feeSummary(db: DB): Promise<FeeSummary> {
  const rows = await db.select({
    feeStatus: waitlistSignups.feeStatus,
    n: count(),
    pence: sql<number>`coalesce(sum(${waitlistSignups.feePence}), 0)`,
  }).from(waitlistSignups).where(eq(waitlistSignups.role, 'gp')).groupBy(waitlistSignups.feeStatus);
  const of = (status: string) => rows.find((r) => r.feeStatus === status);
  return {
    paid: Number(of('paid')?.n ?? 0),
    collectedPence: Number(of('paid')?.pence ?? 0),
    unpaid: Number(of('unpaid')?.n ?? 0),
    refunded: Number(of('refunded')?.n ?? 0),
  };
}
