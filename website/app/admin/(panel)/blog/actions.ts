'use server';
// The editor's server actions. Each is an untrusted POST (Next checks only that
// it is same-origin), so each starts with requireAdmin() and validates its
// input from scratch. Publishing re-runs the compliance check here, so a post
// that names a medicine or claims CQC registration cannot go live even if the
// browser's check is bypassed.
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin-auth';
import { publicText, validatePost, type BlogPost, type FieldError, type PostInput } from '@/lib/blog';
import { deletePost, getPost, savePost, setStatus, type StoreError } from '@/lib/blog-store';
import { checkCopy, type Hit } from '@/lib/compliance';

export type EditorResult = {
  ok: boolean;
  post?: BlogPost;
  error?: string;
  fieldErrors?: FieldError[];
  hits?: Hit[];
};

const STORE_MESSAGES: Record<StoreError, string> = {
  store_unavailable: 'The blog store is not configured on this server, so nothing can be saved.',
  slug_taken: 'Another post already uses this web address.',
  not_found: 'This post no longer exists. It may have been deleted by another admin.',
};

function storeFailure(error: StoreError): EditorResult {
  return error === 'slug_taken'
    ? { ok: false, error: STORE_MESSAGES.slug_taken, fieldErrors: [{ field: 'slug', message: STORE_MESSAGES.slug_taken }] }
    : { ok: false, error: STORE_MESSAGES[error] };
}

// The public pages a change can affect: the index, the post (at its old and new
// addresses) and the sitemap.
function refreshPublic(...slugs: Array<string | undefined>) {
  revalidatePath('/blog');
  for (const slug of new Set(slugs.filter(Boolean))) revalidatePath(`/blog/${slug}`);
  revalidatePath('/sitemap.xml');
}

async function write(id: string | null, raw: Partial<PostInput>): Promise<EditorResult & { previousSlug?: string }> {
  const admin = await requireAdmin();
  const { input, errors } = validatePost(raw);
  if (!input) return { ok: false, error: 'Check the highlighted fields.', fieldErrors: errors };
  let previousSlug: string | undefined;
  if (id) {
    const existing = await getPost(id);
    if (!existing.ok) return storeFailure(existing.error);
    previousSlug = existing.value.slug;
  }
  try {
    const saved = await savePost(input, admin, id ?? undefined);
    return saved.ok ? { ok: true, post: saved.value, previousSlug } : storeFailure(saved.error);
  } catch {
    return { ok: false, error: 'The blog store did not respond. Your changes are still in the editor; try again.' };
  }
}

// Save the content. A published post stays published, and its public page updates.
export async function savePostAction(id: string | null, raw: Partial<PostInput>): Promise<EditorResult> {
  const result = await write(id, raw);
  if (result.ok && result.post?.status === 'published') refreshPublic(result.previousSlug, result.post.slug);
  return { ok: result.ok, post: result.post, error: result.error, fieldErrors: result.fieldErrors };
}

export async function publishPostAction(id: string | null, raw: Partial<PostInput>): Promise<EditorResult> {
  await requireAdmin();
  const { input, errors } = validatePost(raw);
  if (!input) return { ok: false, error: 'Check the highlighted fields.', fieldErrors: errors };
  const hits = checkCopy(publicText(input));
  if (hits.length > 0) {
    return { ok: false, hits, error: 'This post breaks the copy rules, so it can’t be published. Fix the highlighted phrases, or save it as a draft.' };
  }
  const saved = await write(id, input);
  if (!saved.ok || !saved.post) return saved;
  const published = await setStatus(saved.post.id, 'published');
  if (!published.ok) return storeFailure(published.error);
  refreshPublic(saved.previousSlug, published.value.slug);
  return { ok: true, post: published.value };
}

export async function unpublishPostAction(id: string): Promise<EditorResult> {
  await requireAdmin();
  const result = await setStatus(id, 'draft');
  if (!result.ok) return storeFailure(result.error);
  refreshPublic(result.value.slug);
  return { ok: true, post: result.value };
}

export async function deletePostAction(id: string): Promise<EditorResult> {
  await requireAdmin();
  const result = await deletePost(id);
  if (!result.ok) return storeFailure(result.error);
  if (result.value.status === 'published') refreshPublic(result.value.slug);
  return { ok: true };
}
