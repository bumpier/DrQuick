// The client's address, for the sign-in rate limits of server actions (the
// admin, the doctor portal, the demo's passcode page). Caddy, in front of the
// app, replaces any X-Forwarded-For the client sent with the address it sees,
// so the first entry is the client's. Only ever hashed (lib/rate-limit.ts
// hashKey), never stored. Requests with no address share one bucket.
import { headers } from 'next/headers';

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown';
}
