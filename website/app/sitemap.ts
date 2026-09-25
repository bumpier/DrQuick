import type { MetadataRoute } from 'next';
import { listPublished } from '@/lib/blog-store';
import { siteUrl } from '@/lib/site-url';

// The public pages and every published post. The drafts (privacy, terms), the
// patient prototype, the admin and the gallery are noindex and left out.
export const revalidate = 300;

const PAGES = ['/', '/how-it-works', '/pricing', '/about', '/blog', '/contact'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const posts = await listPublished();
  return [
    ...PAGES.map((path) => ({ url: new URL(path, base).toString() })),
    ...posts.map((p) => ({ url: new URL(`/blog/${p.slug}`, base).toString(), lastModified: new Date(p.updatedAt) })),
  ];
}
