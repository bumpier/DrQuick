import type { Metadata } from 'next';
import { PostTile } from '@/components/blog/PostTile';
import { Card } from '@/components/ui/card';
import { JoinTile, PageHero } from '@/components/site/PageParts';
import { listPublished } from '@/lib/blog-store';

// Rebuilt at most every five minutes, and at once whenever an admin publishes,
// unpublishes or deletes a post (revalidatePath in app/admin/blog/actions.ts).
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Plain-English guides to seeing a GP online, and news as Dr Quick gets ready to launch.',
};

export default async function BlogIndexPage() {
  const posts = await listPublished();
  const [first, ...rest] = posts;
  return (
    <>
      <PageHero
        title="The Dr Quick blog."
        lead="Plain-English guides to seeing a GP online, and news as we get ready to launch."
      />
      <section aria-label="Posts" className="pt-4">
        <div className="wrap">
          {first ? (
            <div className="grid grid-cols-3 gap-4 max-cols:grid-cols-2 max-phone:grid-cols-1" data-stagger>
              <PostTile post={first} lead className="col-span-3 max-cols:col-span-2 max-phone:col-span-1 min-h-[300px]" />
              {rest.map((post) => <PostTile key={post.id} post={post} className="min-h-[260px]" />)}
            </div>
          ) : (
            <Card variant="quiet" data-reveal className="block px-tile-lead-pad py-field-section text-center max-phone:px-6">
              <h2 className="text-title-lead leading-[1.15]">No posts yet.</h2>
              <p className="text-body text-ink-2 mt-3">Our first guides are on their way.</p>
            </Card>
          )}
        </div>
      </section>
      <JoinTile />
    </>
  );
}
