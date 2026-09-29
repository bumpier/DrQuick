// Building list URLs from the current query. Pure. A value of null or '' drops
// the key, so "clear this filter" is { status: null }.
export type Query = Record<string, string | undefined>;

export function withQuery(basePath: string, current: Query, changes: Record<string, string | null | undefined> = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) if (v) q.set(k, v);
  for (const [k, v] of Object.entries(changes)) {
    if (v === null || v === undefined || v === '') q.delete(k);
    else q.set(k, v);
  }
  const s = q.toString();
  return s ? `${basePath}?${s}` : basePath;
}

// The flat, string-only form of a page's searchParams.
export function flatParams(params: Record<string, string | string[] | undefined>): Query {
  const out: Query = {};
  for (const [k, v] of Object.entries(params)) {
    const one = Array.isArray(v) ? v[0] : v;
    if (typeof one === 'string' && one !== '') out[k] = one;
  }
  return out;
}
