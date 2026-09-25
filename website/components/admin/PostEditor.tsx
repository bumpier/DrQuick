'use client';
// The blog editor: fields and Markdown on the left, the post exactly as it will
// publish on the right (the same Prose renderer the blog uses), and the
// compliance panel running checkCopy() as you type. Below 900px the write and
// preview panes share the screen through a toggle.
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Prose } from '@/components/blog/Prose';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  deletePostAction, publishPostAction, savePostAction, unpublishPostAction, type EditorResult,
} from '@/app/admin/(panel)/blog/actions';
import { BLOG_TONES, LIMITS, publicText, readingMinutes, slugify, type BlogPost, type BlogTone, type FieldError, type PostInput } from '@/lib/blog';
import { checkCopy, type Hit } from '@/lib/compliance';
import { cn } from '@/lib/utils';

const TONE_LABEL: Record<BlogTone, string> = { wash: 'Lime', sage: 'Sage', stone: 'Stone', band: 'Forest' };
const TONE_SWATCH: Record<BlogTone, string> = { wash: 'bg-lime-wash', sage: 'bg-sage', stone: 'bg-stone', band: 'bg-band' };

type Field = 'title' | 'summary' | 'body';

const EMPTY: PostInput = { title: '', slug: '', summary: '', body: '', tone: 'wash' };

export function PostEditor({ post }: { post?: BlogPost }) {
  const router = useRouter();
  const [id, setId] = useState<string | null>(post?.id ?? null);
  const [status, setStatus] = useState(post?.status ?? 'draft');
  const [fields, setFields] = useState<PostInput>(post
    ? { title: post.title, slug: post.slug, summary: post.summary, body: post.body, tone: post.tone }
    : EMPTY);
  const [saved, setSaved] = useState<PostInput>(fields);
  const [slugTouched, setSlugTouched] = useState(Boolean(post));
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [pane, setPane] = useState<'write' | 'preview'>('write');
  const [pending, start] = useTransition();
  const refs = {
    title: useRef<HTMLInputElement>(null),
    summary: useRef<HTMLTextAreaElement>(null),
    body: useRef<HTMLTextAreaElement>(null),
  };

  const dirty = JSON.stringify(fields) !== JSON.stringify(saved);
  const hits = useMemo(() => checkCopy(publicText(fields)), [fields]);
  const errorFor = (f: FieldError['field']) => errors.find((e) => e.field === f)?.message;

  // Leaving with unsaved work asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const set = <K extends keyof PostInput>(key: K, value: PostInput[K]) =>
    setFields((prev) => ({
      ...prev,
      [key]: value,
      ...(key === 'title' && !slugTouched ? { slug: slugify(String(value)) } : {}),
    }));

  function settle(result: EditorResult, success: string) {
    setErrors(result.fieldErrors ?? []);
    if (!result.ok || !result.post) {
      toast.error(result.error ?? 'Something went wrong.');
      return;
    }
    const p = result.post;
    const clean = { title: p.title, slug: p.slug, summary: p.summary, body: p.body, tone: p.tone };
    setFields(clean);
    setSaved(clean);
    setSlugTouched(true);
    setStatus(p.status);
    toast.success(success);
    if (!id) {
      setId(p.id);
      router.replace(`/admin/blog/${p.id}`);
    }
  }

  const save = () => start(async () =>
    settle(await savePostAction(id, fields), status === 'published' ? 'Saved. The live post is updated.' : 'Draft saved.'));
  const publish = () => start(async () => settle(await publishPostAction(id, fields), 'Published. It’s live on the blog.'));
  const unpublish = () => id && start(async () => settle(await unpublishPostAction(id), 'Unpublished. It’s back to a draft.'));
  const remove = () => id && start(async () => {
    const result = await deletePostAction(id);
    if (!result.ok) { toast.error(result.error ?? 'Could not delete.'); return; }
    setSaved(fields); // nothing left to lose
    toast.success('Post deleted.');
    router.push('/admin/blog');
  });

  // Jump from a compliance hit to the phrase in its field.
  function jumpTo(hit: Hit) {
    const titleEnd = fields.title.length + 2;
    const summaryEnd = titleEnd + fields.summary.length + 2;
    const [field, offset]: [Field, number] = hit.index < titleEnd ? ['title', hit.index]
      : hit.index < summaryEnd ? ['summary', hit.index - titleEnd]
      : ['body', hit.index - summaryEnd];
    setPane('write');
    const el = refs[field].current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(offset, offset + hit.phrase.length);
  }

  // Markdown toolbar: wrap the selection, or prefix the selected lines.
  function wrap(before: string, after: string, placeholder: string) {
    const el = refs.body.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const chosen = value.slice(s, e) || placeholder;
    const next = value.slice(0, s) + before + chosen + after + value.slice(e);
    set('body', next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + before.length, s + before.length + chosen.length); });
  }
  function prefix(mark: string) {
    const el = refs.body.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    const block = value.slice(lineStart, e) || 'Text';
    const marked = block.split('\n').map((line) => `${mark}${line}`).join('\n');
    set('body', value.slice(0, lineStart) + marked + value.slice(Math.max(e, lineStart)));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(lineStart, lineStart + marked.length); });
  }
  const TOOLS: Array<[string, string, () => void]> = [
    ['H2', 'Heading', () => prefix('## ')],
    ['H3', 'Subheading', () => prefix('### ')],
    ['B', 'Bold', () => wrap('**', '**', 'bold text')],
    ['I', 'Italic', () => wrap('_', '_', 'italic text')],
    ['Link', 'Link', () => wrap('[', '](https://)', 'link text')],
    ['• List', 'Bulleted list', () => prefix('- ')],
    ['1. List', 'Numbered list', () => prefix('1. ')],
    ['Quote', 'Quote', () => prefix('> ')],
  ];

  const hitsByField = (f: Field) => {
    const titleEnd = fields.title.length + 2;
    const summaryEnd = titleEnd + fields.summary.length + 2;
    return hits.filter((h) => (f === 'title' ? h.index < titleEnd : f === 'summary' ? h.index >= titleEnd && h.index < summaryEnd : h.index >= summaryEnd)).length;
  };

  return (
    <div className="grid gap-6">
      {/* Title row: status and the actions. */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-headline max-phone:text-headline-sm">{id ? 'Edit post' : 'New post'}</h1>
          {status === 'published' ? <Badge variant="success">Live</Badge> : <Badge variant="secondary">Draft</Badge>}
          {dirty && <span className="text-fine text-ink-2" aria-live="polite">Unsaved changes</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {status === 'published' && id && (
            <Button asChild variant="ghost"><a href={`/blog/${saved.slug}`} target="_blank" rel="noopener">View live</a></Button>
          )}
          {status === 'published' && <Button variant="secondary" onClick={unpublish} disabled={pending}>Unpublish</Button>}
          <Button variant="secondary" onClick={save} disabled={pending}>{status === 'published' ? 'Save changes' : 'Save draft'}</Button>
          {status !== 'published' && (
            <Button onClick={publish} disabled={pending || hits.length > 0} aria-describedby="compliance-title">Publish</Button>
          )}
        </div>
      </div>

      {/* Phone: one pane at a time. */}
      <div className="flex gap-1 rounded-pill bg-fill p-[3px] self-start md:hidden" role="group" aria-label="View">
        {(['write', 'preview'] as const).map((p) => (
          <button key={p} type="button" aria-pressed={pane === p} onClick={() => setPane(p)}
            className="h-10 rounded-pill px-4 text-label font-semibold text-ink-2 aria-pressed:bg-primary aria-pressed:text-ink">
            {p === 'write' ? 'Write' : 'Preview'}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-6 md:grid-cols-2">
        {/* Write */}
        <div className={cn('grid gap-6', pane !== 'write' && 'max-md:hidden')}>
          <Card className="grid gap-5 px-6 py-6">
            <FieldBlock id="post-title" label="Title" count={`${fields.title.length}/${LIMITS.title}`} error={errorFor('title')} flagged={hitsByField('title')}>
              <Input id="post-title" ref={refs.title} value={fields.title} maxLength={LIMITS.title}
                onChange={(e) => set('title', e.target.value)} aria-invalid={errorFor('title') ? true : undefined} />
            </FieldBlock>
            <FieldBlock id="post-slug" label="Web address" hint={`/blog/${fields.slug || '…'}`} error={errorFor('slug')}>
              <Input id="post-slug" value={fields.slug} maxLength={LIMITS.slug}
                onChange={(e) => { setSlugTouched(true); set('slug', slugify(e.target.value) + (e.target.value.endsWith('-') ? '-' : '')); }}
                onBlur={() => set('slug', slugify(fields.slug))} aria-invalid={errorFor('slug') ? true : undefined} />
            </FieldBlock>
            <FieldBlock id="post-summary" label="Summary" hint="One or two sentences. Shows on the blog and in search results."
              count={`${fields.summary.length}/${LIMITS.summary}`} error={errorFor('summary')} flagged={hitsByField('summary')}>
              <Textarea id="post-summary" ref={refs.summary} value={fields.summary} maxLength={LIMITS.summary}
                className="min-h-20" onChange={(e) => set('summary', e.target.value)} aria-invalid={errorFor('summary') ? true : undefined} />
            </FieldBlock>
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-label font-semibold">Tile colour</legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tile colour">
                {BLOG_TONES.map((tone) => (
                  <button key={tone} type="button" role="radio" aria-checked={fields.tone === tone} onClick={() => set('tone', tone)}
                    className="inline-flex h-10 items-center gap-2 rounded-pill bg-white px-3 text-fine font-semibold ring-2 ring-rule ring-inset aria-checked:ring-ink">
                    <span aria-hidden="true" className={cn('size-5 rounded-full ring-1 ring-ink/10', TONE_SWATCH[tone])} />
                    {TONE_LABEL[tone]}
                  </button>
                ))}
              </div>
            </fieldset>
          </Card>

          <Card className="grid gap-3 px-6 py-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="post-body">Post (Markdown)</Label>
              <span className="text-fine text-ink-2">{readingMinutes(fields.body)} min read</span>
            </div>
            <div className="flex flex-wrap gap-1" role="toolbar" aria-label="Formatting">
              {TOOLS.map(([label, name, run]) => (
                <Button key={name} type="button" size="xs" variant="secondary" aria-label={name} onClick={run}>{label}</Button>
              ))}
            </div>
            <Textarea id="post-body" ref={refs.body} value={fields.body} onChange={(e) => set('body', e.target.value)}
              className="min-h-[420px] font-mono text-[.9375rem] leading-[1.6]" spellCheck
              placeholder={'## A heading\n\nWrite in plain English. **Bold**, _italic_, [links](https://…) and lists all work.'}
              aria-invalid={errorFor('body') ? true : undefined} aria-describedby={errorFor('body') ? 'post-body-error' : undefined} />
            {errorFor('body') && <p id="post-body-error" className="text-fine font-semibold text-error">{errorFor('body')}</p>}
            {hitsByField('body') > 0 && <p className="text-fine font-semibold text-ink">{hitsByField('body')} flagged in the post</p>}
          </Card>

          {id && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="destructive" className="justify-self-start">Delete post</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete this post?</DialogTitle>
                  <DialogDescription>
                    {status === 'published' ? 'It comes off the blog straight away. ' : ''}This can’t be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild><Button variant="secondary">Keep it</Button></DialogClose>
                  <Button variant="destructive" onClick={remove} disabled={pending}>Delete post</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Preview and compliance */}
        <div className={cn('grid gap-6 md:sticky md:top-24', pane !== 'preview' && 'max-md:hidden')}>
          <Compliance hits={hits} onJump={jumpTo} />
          <Card className="block px-7 py-8 max-phone:px-5" aria-label="Preview">
            <p className="text-fine font-semibold text-ink-2">Preview</p>
            <h2 className="mt-4 text-[clamp(1.75rem,3vw,2.5rem)] leading-[1.1]">{fields.title || 'Your title'}</h2>
            <p className="mt-3 text-lead leading-[1.55] text-ink-2">{fields.summary || 'Your summary.'}</p>
            <hr className="my-6 border-rule" />
            <div className="max-h-[70svh] overflow-y-auto pr-2">
              <Prose markdown={fields.body || '_Start writing to see the post here._'} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function FieldBlock({ id, label, hint, count, error, flagged = 0, children }: {
  id: string; label: string; hint?: string; count?: string; error?: string; flagged?: number; children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {count && <span className="text-fine text-ink-2 tabular-nums">{count}</span>}
      </div>
      {children}
      {hint && !error && <p className="text-fine text-ink-2">{hint}</p>}
      {error && <p className="text-fine font-semibold text-error">{error}</p>}
      {flagged > 0 && <p className="text-fine font-semibold text-ink">{flagged} flagged</p>}
    </div>
  );
}

function Compliance({ hits, onJump }: { hits: Hit[]; onJump: (hit: Hit) => void }) {
  const clear = hits.length === 0;
  return (
    <Card variant={clear ? 'wash' : 'default'} className={cn('block px-6 py-5', !clear && 'ring-2 ring-error ring-inset')} data-slot="compliance">
      <h2 id="compliance-title" className="text-label font-bold" aria-live="polite">
        {clear ? 'Copy check: ready to publish' : `Copy check: ${hits.length} to fix before publishing`}
      </h2>
      {clear ? (
        <p className="mt-1 text-fine text-ink-2">No medicine names, price figures, CQC claims, time pressure, UK-wide claims or named doctors.</p>
      ) : (
        <ul className="mt-3 grid list-none gap-2">
          {hits.map((hit, i) => (
            <li key={`${hit.index}-${i}`}>
              <button type="button" onClick={() => onJump(hit)}
                className="grid w-full gap-0.5 rounded-lg bg-surface-mid px-3 py-2 text-left hover:bg-fill-hover">
                <span className="text-body font-semibold">“{hit.phrase}”</span>
                <span className="text-fine text-ink-2">{hit.why}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
