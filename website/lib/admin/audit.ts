// The admin audit trail: every export, erasure, status change, note and resend
// an admin makes lands in admin_audit_log. Never put the email address of the
// person acted on in `target` or `meta` — an erasure must not leave the address
// behind in the log that records it. Use the sign-up id.
import type { DB } from '@/lib/db';
import { adminAuditLog } from '@/lib/db/schema';

export type Actor = { email: string } | 'self-service';

export async function audit(
  db: DB,
  actor: Actor,
  action: string,
  target?: string | null,
  meta?: Record<string, unknown> | null,
): Promise<void> {
  await db.insert(adminAuditLog).values({
    adminEmail: actor === 'self-service' ? 'self-service' : actor.email,
    action,
    target: target ?? null,
    meta: meta ?? null,
  });
}
