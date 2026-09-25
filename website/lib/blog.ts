// The blog post: its shape, its limits and the small pure helpers every layer
// shares (the store, the server actions, the editor and the public pages).

export const BLOG_TONES = ['wash', 'sage', 'stone', 'band'] as const;
export type BlogTone = (typeof BLOG_TONES)[number];
export type BlogStatus = 'draft' | 'published';

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;           // Markdown
  tone: BlogTone;         // the tile colour on the index
  status: BlogStatus;
  authorEmail: string;
  authorName: string;
  createdAt: number;      // epoch ms
  updatedAt: number;
  publishedAt: number | null; // first publication; kept through unpublish / republish
};

// What an admin edits. Everything else is set by the store.
export type PostInput = Pick<BlogPost, 'slug' | 'title' | 'summary' | 'body' | 'tone'>;

export const LIMITS = { title: 120, summary: 240, body: 50_000, slug: 80 } as const;
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(text: string): string {
  return text
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LIMITS.slug)
    .replace(/-+$/g, '');
}

// About 220 words a minute, never less than one.
export function readingMinutes(markdown: string): number {
  const words = markdown.replace(/[#>*_`~\[\]()!-]/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export function formatDate(ms: number): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' }).format(ms);
}

export type FieldError = { field: keyof PostInput; message: string };

// Trim and check an admin's input. Returns the clean input or the first problem
// per field, worded for the editor.
export function validatePost(raw: Partial<Record<keyof PostInput, unknown>>): { input?: PostInput; errors: FieldError[] } {
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const title = str(raw.title).trim();
  const summary = str(raw.summary).trim();
  const body = str(raw.body).replace(/\r\n/g, '\n');
  const slug = str(raw.slug).trim();
  const tone = str(raw.tone) as BlogTone;
  const errors: FieldError[] = [];
  if (!title) errors.push({ field: 'title', message: 'Give the post a title.' });
  else if (title.length > LIMITS.title) errors.push({ field: 'title', message: `Keep the title under ${LIMITS.title} characters.` });
  if (!summary) errors.push({ field: 'summary', message: 'Add a one-line summary. It shows on the blog and in search results.' });
  else if (summary.length > LIMITS.summary) errors.push({ field: 'summary', message: `Keep the summary under ${LIMITS.summary} characters.` });
  if (!body.trim()) errors.push({ field: 'body', message: 'The post has no text yet.' });
  else if (body.length > LIMITS.body) errors.push({ field: 'body', message: 'The post is too long to save in one piece.' });
  if (!slug) errors.push({ field: 'slug', message: 'Add a web address for the post.' });
  else if (slug.length > LIMITS.slug || !SLUG.test(slug)) errors.push({ field: 'slug', message: 'Use lowercase letters, numbers and single hyphens only.' });
  if (!BLOG_TONES.includes(tone)) errors.push({ field: 'tone', message: 'Pick a tile colour.' });
  return errors.length ? { errors } : { input: { title, summary, body, slug, tone }, errors };
}

// Every word a reader sees, for the compliance check.
export const publicText = (p: Pick<PostInput, 'title' | 'summary' | 'body'>) => `${p.title}\n\n${p.summary}\n\n${p.body}`;
