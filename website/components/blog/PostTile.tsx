// A post on the blog index: the whole tile is the link. The lead post spans
// wider and sets its title larger; tone is the author's choice per post.
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { formatDate, readingMinutes, type BlogPost } from '@/lib/blog';
import { cn } from '@/lib/utils';

export function PostTile({ post, lead = false, className }: { post: BlogPost; lead?: boolean; className?: string }) {
  const band = post.tone === 'band';
  return (
    <Card variant={post.tone} data-reveal className={cn('tile group/post relative justify-between gap-10 p-7', lead && 'p-tile-lead-pad', band && 'band-grid', className)}>
      <p className={cn('text-fine font-semibold', band ? 'text-band-muted' : 'text-ink-2')}>
        {post.publishedAt ? formatDate(post.publishedAt) : 'Draft'} · {readingMinutes(post.body)} min read
      </p>
      <div>
        <h2 className={cn(
          'font-display font-extrabold tracking-[-.03em]',
          lead ? 'text-title-lead leading-[1.15] max-w-[22ch]' : 'text-xl leading-[1.25]',
        )}>
          {/* The link covers the tile through ::after, so the tile is one target
              and the accessible name is just the title. */}
          <Link href={`/blog/${post.slug}`} className="no-underline after:absolute after:inset-0 after:rounded-2xl group-hover/post:underline underline-offset-4 decoration-2">
            {post.title}
          </Link>
        </h2>
        <p className={cn('text-body mt-3', band ? 'text-band-muted' : 'text-ink-2', lead && 'max-w-[56ch]')}>{post.summary}</p>
      </div>
    </Card>
  );
}
