// Minimal Redis REST client. No npm dependencies, on purpose — ported from
// api/_store.js. Works with Vercel KV and with Upstash Redis directly; both
// expose the same REST surface under different env var names. Env is read per
// call (not at module load) so tests can stub it and boot order cannot matter.
export type Command = (string | number)[];

function url(): string {
  return process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
}
function token(): string {
  return process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
}

export function configured(): boolean {
  return Boolean(url() && token());
}

// Upstash's /pipeline endpoint takes an array of command arrays and returns an
// array of { result } | { error } in the same order.
export async function pipeline(commands: Command[]): Promise<unknown[]> {
  if (!configured()) throw new Error('WAITLIST_STORE_NOT_CONFIGURED');
  const res = await fetch(`${url().replace(/\/$/, '')}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) throw new Error(`REDIS_HTTP_${res.status}`);
  const body: Array<{ result?: unknown; error?: string }> = await res.json();
  const failed = body.find((entry) => entry && entry.error);
  if (failed) throw new Error(`REDIS_${failed.error}`);
  return body.map((entry) => entry.result);
}
