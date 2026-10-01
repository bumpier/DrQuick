'use server';
// The unsubscribe confirm. Public, so the token is the only credential: it is
// 192 random bits, single-use (the row it names is deleted), and it can only
// erase the one person it was sent to.
import { getDb } from '@/lib/db';
import { unsubscribeByToken } from '@/lib/waitlist';

export type UnsubscribeResult = { done: true } | { done: false; error: 'invalid' | 'unavailable' };

export async function confirmUnsubscribe(token: string): Promise<UnsubscribeResult> {
  const db = await getDb();
  if (!db) return { done: false, error: 'unavailable' };
  const result = await unsubscribeByToken(db, String(token ?? '').slice(0, 100));
  if (result.ok) return { done: true };
  // A doctor in the middle of a consultation: it can be done once that has ended.
  return { done: false, error: result.busy ? 'unavailable' : 'invalid' };
}
