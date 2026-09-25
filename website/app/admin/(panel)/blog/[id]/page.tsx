import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PostEditor } from '@/components/admin/PostEditor';
import { requireAdmin } from '@/lib/admin-auth';
import { getPost } from '@/lib/blog-store';

export const metadata: Metadata = { title: 'Edit post' };

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const result = await getPost((await params).id);
  if (!result.ok) notFound();
  return <PostEditor key={result.value.id} post={result.value} />;
}
