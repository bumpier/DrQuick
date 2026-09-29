// POST /api/collect — the first-party analytics beacon (lib/analytics/track.ts
// sends it; lib/analytics/ingest.ts validates and stores it).
//
// Answers 204 for anything it accepts or quietly drops — a bot, a rate-limited
// client, a batch with nothing valid in it, a missing database — so the answer
// never tells a client what happened. Only a body that is not JSON at all gets
// 400, and an oversized one 413. The IP is used for one thing, a salted hash
// for the rate limit, and is never stored; nor is the user-agent string, only
// the three coarse buckets lib/analytics/ua.ts derives from it.
import { getDb } from '@/lib/db';
import { appErrors } from '@/lib/db/schema';
import { hashKey, hit } from '@/lib/rate-limit';
import { MAX_BODY, ingest, validateBatch } from '@/lib/analytics/ingest';
import { isBot, parseUa } from '@/lib/analytics/ua';

export const runtime = 'nodejs';

const RATE_MAX = 120;    // beacons per window, per client
const RATE_WINDOW = 600; // seconds

const HEADERS = { 'Cache-Control': 'no-store' };
const done = (status = 204) => new Response(null, { status, headers: HEADERS });

function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for') ?? '';
  return fwd.split(',')[0].trim() || (request.headers.get('x-real-ip') ?? '').trim();
}

export async function POST(request: Request) {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY) return done(413);

  let text: string;
  try { text = await request.text(); } catch { return done(400); }
  if (text.length > MAX_BODY) return done(413);

  let body: unknown;
  try { body = JSON.parse(text); } catch { return done(400); }

  const ua = request.headers.get('user-agent');
  if (isBot(ua)) return done();

  const batch = validateBatch(body);
  if (!batch || !batch.events.length) return done();

  const db = await getDb().catch(() => null);
  if (!db) return done();

  try {
    const ip = clientIp(request);
    if (ip && (await hit(db, hashKey('rl:collect', ip), RATE_WINDOW)) > RATE_MAX) return done();
    await ingest(db, batch, parseUa(ua));
  } catch (err) {
    const message = String((err as Error)?.message ?? err).slice(0, 200);
    console.error('Analytics write failed:', message);
    await db.insert(appErrors).values({ route: '/api/collect', message }).catch(() => {});
  }
  return done();
}
