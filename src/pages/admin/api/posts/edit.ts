import { requireUser } from '../../../../lib/admin/auth.ts';
import { assertSameOrigin, formText, guarded, readForm, redirectFlash, wantsJson } from '../../../../lib/admin/http.ts';
import { contentFromForm, startEdit, submitForApproval } from '../../../../lib/admin/workflow.ts';

export const prerender = false;

/** First save of a post with no working copy. Fields equal to main create nothing. */
export const POST = guarded(() => '/admin/posts/', async (context) => {
  assertSameOrigin(context.request, context.url);
  const user = await requireUser(context);
  const form = await readForm(context.request);
  const slug = formText(form, 'slug').trim();
  const sub = await startEdit(slug, (current) => contentFromForm(form, current), formText(form, 'baseSha') || null, user);
  const message = sub ? 'Saved.' : 'No changes';
  if (sub && formText(form, 'thenSubmit') === '1') await submitForApproval(sub.id, user);
  if (wantsJson(context.request)) return Response.json({ ok: true, message, changed: Boolean(sub), id: sub?.id ?? null, updatedAt: sub?.updatedAt ?? null, contentHash: sub?.contentHash ?? null });
  return redirectFlash(sub ? `/admin/posts/${sub.id}/` : `/admin/posts/view/?slug=${encodeURIComponent(slug)}`, message, sub ? 'success' : 'info');
});
