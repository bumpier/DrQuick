import type { Metadata } from 'next';
import { PostEditor } from '@/components/admin/PostEditor';
import { requireAdmin } from '@/lib/admin-auth';

export const metadata: Metadata = { title: 'New post' };

export default async function NewPostPage() {
  await requireAdmin();
  return <PostEditor />;
}
