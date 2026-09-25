// @vitest-environment jsdom
import { test, expect, vi, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('next/navigation', () => import('./helpers/next-navigation'));
vi.mock('next/link', () => import('./helpers/next-link'));

import BlogIndexPage from '@/app/(site)/blog/page';
import BlogPostPage, { generateMetadata } from '@/app/(site)/blog/[slug]/page';
import { Prose } from '@/components/blog/Prose';
import { resetMemoryStore, savePost, setStatus } from '@/lib/blog-store';
import type { PostInput } from '@/lib/blog';

const AUTHOR = { email: 'editor@example.com', name: 'Sam Editor' };
const post = (slug: string, title: string, over: Partial<PostInput> = {}): PostInput =>
  ({ slug, title, summary: `About ${title}`, body: `## ${title}\n\nText.`, tone: 'wash', ...over });

async function publish(p: PostInput, at: number) {
  const saved = await savePost(p, AUTHOR, undefined, at);
  if (!saved.ok) throw new Error(saved.error);
  await setStatus(saved.value.id, 'published', at);
  return saved.value;
}

beforeEach(() => {
  cleanup();
  resetMemoryStore();
});

test('the index says so when there is nothing published', async () => {
  const { container } = render(await BlogIndexPage());
  expect(container).toHaveTextContent('No posts yet.');
});

test('the index lists published posts newest first, each tile one link, drafts left out', async () => {
  await publish(post('older', 'Older post'), 1);
  await publish(post('newer', 'Newer post', { tone: 'band' }), 2);
  await savePost(post('draft', 'A draft'), AUTHOR);
  const { container } = render(await BlogIndexPage());
  const links = [...container.querySelectorAll('h2 a')].map((a) => [a.textContent, a.getAttribute('href')]);
  expect(links).toEqual([['Newer post', '/blog/newer'], ['Older post', '/blog/older']]);
  expect(container).not.toHaveTextContent('A draft');
});

test('a post renders its title once as the h1, its Markdown, and the standing not-advice notice', async () => {
  await publish(post('fit-notes', 'Fit notes, explained', { body: '# Heading one\n\nA paragraph with **bold**.' }), 1);
  const { container } = render(await BlogPostPage({ params: Promise.resolve({ slug: 'fit-notes' }) }));
  expect(container.querySelectorAll('h1')).toHaveLength(1);
  expect(container.querySelector('h1')).toHaveTextContent('Fit notes, explained');
  // A Markdown heading 1 is demoted, so the page keeps one h1.
  expect(container.querySelector('.prose h2')).toHaveTextContent('Heading one');
  expect(container.querySelector('.prose strong')).toHaveTextContent('bold');
  expect(container).toHaveTextContent('This is general information, not medical advice.');
  expect(container.querySelector('aside a[href="tel:999"]')).toBeInTheDocument();
  expect(container.querySelector('aside a[href="tel:111"]')).toBeInTheDocument();
  expect(container).toHaveTextContent('Sam Editor');
});

test('a draft or unknown address is a 404', async () => {
  await savePost(post('draft', 'A draft'), AUTHOR);
  await expect(BlogPostPage({ params: Promise.resolve({ slug: 'draft' }) })).rejects.toThrow();
  await expect(BlogPostPage({ params: Promise.resolve({ slug: 'nope' }) })).rejects.toThrow();
  expect(await generateMetadata({ params: Promise.resolve({ slug: 'nope' }) })).toEqual({ title: 'Post not found' });
});

test('metadata carries the title and summary', async () => {
  await publish(post('fit-notes', 'Fit notes, explained'), 1);
  const meta = await generateMetadata({ params: Promise.resolve({ slug: 'fit-notes' }) });
  expect(meta).toMatchObject({ title: 'Fit notes, explained', description: 'About Fit notes, explained' });
});

test('Prose renders no raw HTML, keeps images to our own assets, and opens external links safely', () => {
  const md = [
    '<script>alert(1)</script>',
    '<b onclick="x()">raw</b>',
    '![Ours](/assets/og.png)',
    '![Theirs](https://evil.example/pixel.png)',
    '[NHS 111](https://111.nhs.uk) and [pricing](/pricing)',
  ].join('\n\n');
  const { container } = render(<Prose markdown={md} />);
  expect(container.querySelector('script, [onclick]')).toBeNull();
  const imgs = [...container.querySelectorAll('img')].map((i) => i.getAttribute('src'));
  expect(imgs).toEqual(['/assets/og.png']);
  const theirs = [...container.querySelectorAll('a')].find((a) => a.textContent === 'Theirs')!;
  expect(theirs).toHaveAttribute('href', 'https://evil.example/pixel.png');
  const nhs = [...container.querySelectorAll('a')].find((a) => a.textContent === 'NHS 111')!;
  expect(nhs).toHaveAttribute('rel', 'noopener noreferrer');
  const internal = [...container.querySelectorAll('a')].find((a) => a.textContent === 'pricing')!;
  expect(internal).not.toHaveAttribute('target');
});
