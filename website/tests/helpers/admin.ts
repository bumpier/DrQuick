// A team member for tests: an active admin_users row and a session token for
// it. The caller must stub ADMIN_SESSION_SECRET first, and mock next/headers
// (this imports lib/admin-auth, which reads cookies).
import { signAccountSession } from '@/lib/admin-auth';
import { ROLE_LABELS, type Role } from '@/lib/admin/roles';
import type { DB } from '@/lib/db';
import { adminUsers } from '@/lib/db/schema';
import { hashPassword } from '@/lib/password';

export async function addTestMember(
  db: DB,
  role: Role,
  over: Partial<typeof adminUsers.$inferInsert> = {},
): Promise<{ id: string; email: string; token: string }> {
  const [row] = await db.insert(adminUsers).values({
    email: `${role}@team.example`,
    name: `Test ${ROLE_LABELS[role]}`,
    role,
    status: 'active',
    passwordHash: hashPassword('correct horse battery'),
    createdBy: 'test',
    ...over,
  }).returning();
  return { id: row.id, email: row.email, token: signAccountSession(row.id, row.sessionEpoch)! };
}
