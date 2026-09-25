import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Prose } from '@/components/blog/Prose';
import { Card } from '@/components/ui/card';
import { JoinTile } from '@/components/site/PageParts';
import { formatDate, readingMinutes } from '@/lib/blog';
import { getPublishedBySlug } from '@/lib/blog-store';

// Posts are built on first request and cached; publishing, editing,
// unpublishing and deleting all revalidate this route (app/admin/blog/actions.ts).
export const revalidate = 300;
export const dynamicParams = true;
export function generateStaticParams() { return []; }

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPublishedBySlug((await params).slug);
  if (!post) return { title: 'Post not found' };
  return {
    title: post.title,
    description: post.summary,
    openGraph: { type: 'article', title: post.title, description: post.summary, publishedTime: post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const post = await getPublishedBySlug((await params).slug);
  if (!post) notFound();

  return (
    <>
      <article>
        <header className="pt-4">
          <div className="wrap">
            <div data-reveal="load" className="rounded-2xl bg-white shadow-card px-tile-lead-pad py-hero-t max-phone:px-6 max-phone:py-10">
              <Link href="/blog" className="text-fine font-semibold text-primary-ink no-underline hover:underline">← All posts</Link>
              <h1 tabIndex={-1} className="mt-6 max-w-[20ch] text-[clamp(2.25rem,4.8vw,3.75rem)]">{post.title}</h1>
              <p className="text-lead leading-[1.55] text-ink-2 max-w-[56ch] mt-5">{post.summary}</p>
              <p className="text-fine font-semibold text-ink-2 mt-8">
                {post.authorName} · {post.publishedAt ? formatDate(post.publishedAt) : ''} · {readingMinutes(post.body)} min read
              </p>
            </div>
          </div>
        </header>
        <div className="wrap pt-4">
          <div data-reveal className="rounded-2xl bg-white shadow-card px-tile-lead-pad py-tile-lead-pad max-phone:px-6">
            <Prose markdown={post.body} className="mx-auto" />
          </div>
        </div>
      </article>

      {/* Standing on every post: the blog is information, never advice, and the
          way to urgent help is one tap away. */}
      <aside className="wrap pt-4" aria-label="Not medical advice">
        <Card variant="band" data-reveal className="band-grid block px-tile-lead-pad py-8 max-phone:px-6">
          <p className="text-body text-band-muted max-w-[72ch]">
            <b className="text-white">This is general information, not medical advice.</b>{' '}
            If you’re unwell, speak to a GP or pharmacist. In an emergency,{' '}
            <a className="tel font-semibold text-white" href="tel:999">call 999</a> or go to A&amp;E. If you’re not sure what to do,{' '}
            <a className="tel font-semibold text-white" href="tel:111">call 111</a>.
          </p>
        </Card>
      </aside>
      <JoinTile />
    </>
  );
}
