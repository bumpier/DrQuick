// POST /api/webhooks/livekit — the media server's notices about our calls:
// who joined and left, rooms finishing, tracks published
// (lib/video/calls.ts applyWebhook).
//
// Nothing is believed or written before the signature is checked: the body is
// capped, then verified as signed by the webhook key over these exact bytes and
// fresh (lib/video/livekit.ts readWebhook). Only then does a sender reach the
// database, where it is rate limited and each event id is applied once. So a
// flood of unsigned requests costs a signature check, never a database write.
// Every answer is a fixed code. In production the site also accepts this path
// from the media servers' addresses only (docs/superpowers/specs/2026-10-13-
// encrypted-video-calls-design.md, Production infrastructure).
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { hashKey, hit } from '@/lib/rate-limit';
import { applyWebhook } from '@/lib/video/calls';
import { readWebhook, videoConfig } from '@/lib/video/livekit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 64 * 1024;
const RATE_MAX = 600;
const RATE_WINDOW_S = 60;

const reply = (body: unknown, status: number) => NextResponse.json(body, { status });

function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for') ?? '';
  return fwd.split(',')[0].trim() || (request.headers.get('x-real-ip') ?? '').trim();
}

export async function POST(request: Request) {
  const config = videoConfig();
  if (!config) return reply({ error: 'not_configured' }, 501);
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BYTES) return reply({ error: 'too_large' }, 413);
  const body = await request.text();
  if (Buffer.byteLength(body, 'utf8') > MAX_BYTES) return reply({ error: 'too_large' }, 413);

  const event = await readWebhook(config, body, request.headers.get('authorization'));
  if (!event) return reply({ error: 'unauthorized' }, 401);

  const db = await getDb();
  if (!db) return reply({ error: 'store_unavailable' }, 503);
  if ((await hit(db, hashKey('rl:livekit-webhook', clientIp(request) || 'no-address'), RATE_WINDOW_S)) > RATE_MAX) {
    return reply({ error: 'rate_limited' }, 429);
  }
  try {
    return reply({ outcome: await applyWebhook(db, event) }, 200);
  } catch {
    // The sender retries; the event id has not been recorded unless applied.
    return reply({ error: 'failed' }, 500);
  }
}
