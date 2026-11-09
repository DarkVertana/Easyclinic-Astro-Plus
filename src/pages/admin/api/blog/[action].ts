import type { APIContext } from 'astro';
import { requireUser } from '../../../../lib/admin/auth.ts';
import {
  createPost, deletePost, discardChanges, MAX_IMAGE_BYTES, openPost, publishChecks, publishPost, removeCover, saveDraft, schedulePost,
  unpublishPost, unschedulePost, uploadImage,
} from '../../../../lib/admin/blog.ts';
import { assertSameOrigin, formText, guarded, PublicError } from '../../../../lib/admin/http.ts';
import { renderPreview } from '../../../../lib/admin/preview.ts';
import type { PostContent } from '../../../../lib/admin/types.ts';

export const prerender = false;

function contentFrom(form: FormData): PostContent {
  try {
    const value = JSON.parse(formText(form, 'content')) as PostContent;
    const ok = value && typeof value === 'object' && typeof value.body === 'string' && typeof value.frontmatter === 'object' && value.frontmatter !== null && !Array.isArray(value.frontmatter);
    if (!ok) throw new Error('bad');
    return value;
  } catch {
    throw new PublicError('The post could not be read. Reload and try again.', 400);
  }
}

/** One JSON endpoint for everything the editor and the post list do. */
export const POST = guarded(() => '/admin/posts/', async (context: APIContext) => {
  assertSameOrigin(context.request, context.url);
  const user = await requireUser(context);
  const action = context.params.action;
  const length = Number(context.request.headers.get('content-length') ?? 0);
  if (length > (action === 'upload' ? MAX_IMAGE_BYTES + 200_000 : 2_000_000)) throw new PublicError('That is too large.', 413);
  const form = await context.request.formData();
  const slug = formText(form, 'slug');
  switch (action) {
    case 'create': {
      const created = await createPost({ title: formText(form, 'title'), slug }, user);
      return Response.json({ ok: true, message: 'Draft created.', slug: created });
    }
    case 'save': {
      const saved = await saveDraft(slug, contentFrom(form), user, { newSlug: formText(form, 'newSlug') || undefined });
      return Response.json({ ok: true, message: 'Saved.', ...saved });
    }
    case 'checks': {
      const post = await openPost(slug);
      const checks = await publishChecks(slug, contentFrom(form), post?.isNew ?? true);
      return Response.json({ ok: true, message: '', checks });
    }
    case 'preview':
      return Response.json({ ok: true, message: '', html: renderPreview(formText(form, 'body'), slug) });
    case 'publish':
      return Response.json({ ok: true, ...(await publishPost(slug, user)) });
    case 'schedule':
      return Response.json({ ok: true, ...(await schedulePost(slug, formText(form, 'at'), user)) });
    case 'unschedule':
      await unschedulePost(slug);
      return Response.json({ ok: true, message: 'Schedule cancelled. The post is a draft again.' });
    case 'unpublish':
      return Response.json({ ok: true, ...(await unpublishPost(slug, user)) });
    case 'discard':
      await discardChanges(slug);
      return Response.json({ ok: true, message: 'Changes discarded.' });
    case 'delete':
      return Response.json({ ok: true, ...(await deletePost(slug, user)) });
    case 'upload': {
      const file = form.get('file');
      if (!(file instanceof File)) throw new PublicError('Choose an image to upload.', 400);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await uploadImage(slug, { name: file.name, type: file.type, bytes }, formText(form, 'cover') === '1');
      return Response.json({ ok: true, message: 'Image added.', ...result });
    }
    case 'remove-cover':
      await removeCover(slug);
      return Response.json({ ok: true, message: 'Featured image removed.' });
    default:
      throw new PublicError('Unknown action.', 404);
  }
});
