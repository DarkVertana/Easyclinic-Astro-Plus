import { requireUser } from '../../../../lib/admin/auth.ts';
import { assertSameOrigin, formText, guarded, readForm, redirectFlash, wantsJson } from '../../../../lib/admin/http.ts';
import { emptyTrash, lifecycle } from '../../../../lib/admin/workflow.ts';

export const prerender = false;

export const POST = guarded(() => '/admin/posts/', async (context) => {
  assertSameOrigin(context.request, context.url);
  const user = await requireUser(context);
  const form = await readForm(context.request);
  const op = formText(form, 'op');
  if (op === 'empty-trash') {
    const results = await emptyTrash(user, formText(form, 'confirm'));
    const done = results.filter((r) => r.ok).length;
    const message = `${done} of ${results.length} deleted.`;
    if (wantsJson(context.request)) return Response.json({ ok: true, message, results });
    return redirectFlash('/admin/posts/?tab=trash', message, done === results.length ? 'success' : 'error');
  }
  const { message, submission } = await lifecycle(
    { slug: formText(form, 'slug').trim(), op, mode: formText(form, 'mode') || undefined, target: formText(form, 'target'), confirm: formText(form, 'confirm'), newSlug: formText(form, 'newSlug') },
    user,
  );
  if (wantsJson(context.request)) return Response.json({ ok: true, message, id: submission?.id ?? null, slug: submission?.slug ?? null });
  return redirectFlash(submission ? `/admin/posts/${submission.id}/` : '/admin/posts/', message, 'success');
});
