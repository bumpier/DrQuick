// POST /api/webhooks/stripe — Stripe's events onto the finance tables.
//
// Switched off until both STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are set:
// until then every request gets 501 and nothing is read. Switched on, the
// signature is the only authentication (there is no admin session here), so a
// request is refused before its body is parsed unless the Stripe-Signature
// header verifies against the raw bytes (lib/finance/stripe-webhook.ts).
//
// Answers: 200 for a verified event (applied, a duplicate, or a type we do not
// use — Stripe stops retrying); 400 for a bad signature or body; 503 with no
// database and 500 when the write fails, so Stripe retries later.
import { getDb } from '@/lib/db';
import { appErrors } from '@/lib/db/schema';
import { handleStripeEvent, parseEvent, stripeConfigured, verifyStripeSignature } from '@/lib/finance/stripe-webhook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY = 512 * 1024;
const json = (body: unknown, status: number) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request) {
  if (!stripeConfigured()) return json({ error: 'stripe_not_configured' }, 501);

  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY) return json({ error: 'too_large' }, 413);
  let raw: string;
  try { raw = await request.text(); } catch { return json({ error: 'unreadable' }, 400); }
  if (raw.length > MAX_BODY) return json({ error: 'too_large' }, 413);

  const verified = verifyStripeSignature(raw, request.headers.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET!);
  if (!verified.ok) return json({ error: 'invalid_signature' }, 400);

  const event = parseEvent(raw);
  if (!event) return json({ error: 'invalid_event' }, 400);

  const db = await getDb().catch(() => null);
  if (!db) return json({ error: 'store_unavailable' }, 503);

  try {
    const outcome = await handleStripeEvent(db, event);
    return json({ received: true, outcome }, 200);
  } catch (err) {
    const message = `${event.type} ${event.id}: ${String((err as Error)?.message ?? err)}`.slice(0, 300);
    console.error('Stripe webhook failed:', message);
    await db.insert(appErrors).values({ route: '/api/webhooks/stripe', message }).catch(() => {});
    return json({ error: 'processing_failed' }, 500);
  }
}
