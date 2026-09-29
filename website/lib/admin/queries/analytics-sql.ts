// SQL fragments shared by the analytics queries (traffic, engagement, funnels,
// heatmaps, visitors, live). Server-only. Every range is [from, to).
import { sql, type SQL } from 'drizzle-orm';
import type { Span } from '@/lib/admin/range';

export const iso = (d: Date) => d.toISOString();
export const n = (v: unknown) => Number(v ?? 0);

// A column in the range, as a WHERE fragment.
export const inSpan = (column: string, s: Span): SQL =>
  sql`${sql.raw(column)} >= ${iso(s.from)} and ${sql.raw(column)} < ${iso(s.to)}`;

// A page view that counts towards traffic: not the re-count sent when consent
// arrives mid-view (that page was already counted as a cookieless view).
export const COUNTED_VIEW = sql.raw(`coalesce(props->>'after_consent', '') <> 'true'`);

// Cookieless rows carry neither id.
export const COOKIELESS = sql.raw('visitor_id is null and session_id is null');

// The host of a URL or host string, lower case, without www.; null for none.
export const hostText = (column: string): string =>
  `nullif(lower(regexp_replace(substring(${column} from '^(?:[a-zA-Z]+://)?([^/:?#]+)'), '^www\\.', '')), '')`;
export const hostExpr = (column: string): SQL => sql.raw(hostText(column));

// A numeric prop as float, 0 when missing or not a number (props are written
// by lib/analytics/ingest.ts, which keeps numbers numbers, but never trust a
// cast on JSON).
export const numProp = (key: string, alias = ''): SQL => {
  const p = `${alias ? `${alias}.` : ''}props`;
  return sql.raw(`(case when jsonb_typeof(${p}->'${key}') = 'number' then (${p}->>'${key}')::float else 0 end)`);
};

// Events belonging to pageviews that started in a span can arrive a little
// after it ends (a tab left open past midnight): the event side of a join
// looks one day further.
export const DAY_MS = 86_400_000;
export const spanPlusDay = (s: Span): Span => ({ ...s, to: new Date(s.to.getTime() + DAY_MS) });
