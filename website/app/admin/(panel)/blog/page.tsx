import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { requireAdmin } from '@/lib/admin-auth';
import { formatDate } from '@/lib/blog';
import { listAll } from '@/lib/blog-store';

export const metadata: Metadata = { title: 'Blog' };

export default async function AdminBlogPage() {
  await requireAdmin();
  const result = await listAll();

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-headline max-phone:text-headline-sm">Blog</h1>
          <p className="mt-1 text-body text-ink-2">Write in Markdown. A post goes live on /blog when you publish it.</p>
        </div>
        <Button asChild size="lg"><Link href="/admin/blog/new">New post</Link></Button>
      </div>

      {!result.ok ? (
        <Alert variant="destructive">
          <AlertTitle>Store not configured</AlertTitle>
          <AlertDescription>
            Posts are kept in the site’s Redis store. Set KV_REST_API_URL and KV_REST_API_TOKEN (or the UPSTASH_REDIS_REST pair) to use the blog.
          </AlertDescription>
        </Alert>
      ) : result.value.length === 0 ? (
        <Card variant="quiet" className="block px-8 py-16 text-center">
          <h2 className="text-2xl">No posts yet.</h2>
          <p className="mt-2 text-body text-ink-2">Start with a guide patients would search for.</p>
        </Card>
      ) : (
        <Card className="block px-2 py-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="max-cols:hidden">Updated</TableHead>
                <TableHead className="max-cols:hidden">Author</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.value.map((post) => (
                <TableRow key={post.id}>
                  <TableCell className="whitespace-normal">
                    <Link href={`/admin/blog/${post.id}`} className="font-semibold text-ink underline-offset-4 hover:underline">{post.title}</Link>
                    <span className="block text-fine text-ink-2">/blog/{post.slug}</span>
                  </TableCell>
                  <TableCell>
                    {post.status === 'published' ? <Badge variant="success">Live</Badge> : <Badge variant="secondary">Draft</Badge>}
                  </TableCell>
                  <TableCell className="max-cols:hidden text-ink-2">{formatDate(post.updatedAt)}</TableCell>
                  <TableCell className="max-cols:hidden text-ink-2">{post.authorName}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
