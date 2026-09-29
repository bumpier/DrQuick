// The admin's date range, read from the URL (?from=YYYY-MM-DD&to=YYYY-MM-DD).
// Pure, so it is tested without a server. Days are UTC calendar days: `from`
// is the start of the first day and `to` the start of the day AFTER the last,
// so every query is `ts >= from and ts < to`. The previous period is the same
// number of days immediately before, which is what every delta compares with.

export const PRESETS = ['today', '7d', '30d', '90d', '12m'] as const;
export type Preset = (typeof PRESETS)[number];
export const DEFAULT_PRESET: Preset = '30d';

export const PRESET_LABELS: Record<Preset, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  '12m': 'Last 12 months',
};

export const PRESET_SHORT: Record<Preset, string> = {
  today: 'Today', '7d': '7 days', '30d': '30 days', '90d': '90 days', '12m': '12 months',
};

export type Span = { from: Date; to: Date; fromDay: string; toDay: string };
export type Range = Span & {
  days: number;
  preset: Preset | null;
  label: string;
  prev: Span;
  // Charts group by day up to about a quarter, by month beyond that.
  bucket: 'day' | 'month';
};

const DAY_MS = 86_400_000;
const MAX_DAYS = 366 * 3;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const startOfDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);

export function parseDay(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const m = DAY_RE.exec(value);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  // 2026-02-31 rolls over to March; refuse it rather than guess.
  return dayKey(d) === value ? d : null;
}

function span(first: Date, last: Date): Span {
  return { from: first, to: addDays(last, 1), fromDay: dayKey(first), toDay: dayKey(last) };
}

export function presetSpan(preset: Preset, now = new Date()): Span {
  const today = startOfDay(now);
  switch (preset) {
    case 'today': return span(today, today);
    case '7d': return span(addDays(today, -6), today);
    case '30d': return span(addDays(today, -29), today);
    case '90d': return span(addDays(today, -89), today);
    case '12m': {
      const first = new Date(Date.UTC(today.getUTCFullYear() - 1, today.getUTCMonth(), today.getUTCDate()));
      return span(addDays(first, 1), today);
    }
  }
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export type Params = Record<string, string | string[] | undefined> | URLSearchParams;
export const param = (params: Params, key: string): string | undefined =>
  params instanceof URLSearchParams ? params.get(key) ?? undefined : one(params[key]);

const DATE_FMT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const DAY_MONTH = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function customLabel(first: Date, last: Date): string {
  if (dayKey(first) === dayKey(last)) return DATE_FMT.format(first);
  const sameYear = first.getUTCFullYear() === last.getUTCFullYear();
  return `${(sameYear ? DAY_MONTH : DATE_FMT).format(first)} – ${DATE_FMT.format(last)}`;
}

export function parseRange(params: Params, now = new Date()): Range {
  let first = parseDay(param(params, 'from'));
  let last = parseDay(param(params, 'to'));
  if (!first || !last) {
    const d = presetSpan(DEFAULT_PRESET, now);
    first = d.from;
    last = addDays(d.to, -1);
  }
  if (first > last) [first, last] = [last, first];
  if ((last.getTime() - first.getTime()) / DAY_MS + 1 > MAX_DAYS) first = addDays(last, -(MAX_DAYS - 1));

  const current = span(first, last);
  const days = Math.round((current.to.getTime() - current.from.getTime()) / DAY_MS);
  const prevLast = addDays(first, -1);
  const prev = span(addDays(prevLast, -(days - 1)), prevLast);
  const preset = PRESETS.find((p) => {
    const s = presetSpan(p, now);
    return s.fromDay === current.fromDay && s.toDay === current.toDay;
  }) ?? null;

  return {
    ...current,
    days,
    preset,
    label: preset ? PRESET_LABELS[preset] : customLabel(first, last),
    prev,
    bucket: days > 92 ? 'month' : 'day',
  };
}

// The query string that selects a span, for links that keep the range.
export function rangeQuery(s: Pick<Span, 'fromDay' | 'toDay'>): string {
  return `from=${s.fromDay}&to=${s.toDay}`;
}

// Every bucket the range covers, oldest first, so a chart can show the empty
// days as zero instead of skipping them. Keys match the SQL bucket keys.
export function bucketKeys(range: Range): string[] {
  const keys: string[] = [];
  if (range.bucket === 'day') {
    for (let d = range.from; d < range.to; d = addDays(d, 1)) keys.push(dayKey(d));
    return keys;
  }
  // `to` is exclusive, so the last month is the one holding the day before it.
  const last = addDays(range.to, -1);
  const end = last.getUTCFullYear() * 12 + last.getUTCMonth();
  for (let i = range.from.getUTCFullYear() * 12 + range.from.getUTCMonth(); i <= end; i += 1) {
    keys.push(`${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`);
  }
  return keys;
}

const MONTH_LABEL = new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' });

export function bucketLabel(key: string): string {
  if (key.length === 7) return MONTH_LABEL.format(new Date(`${key}-01T00:00:00Z`));
  return DAY_MONTH.format(new Date(`${key}T00:00:00Z`));
}
