import { requireUser } from '../../../../lib/admin/auth.ts';
import { assertSameOrigin, formText, guarded, readForm, redirectFlash, wantsJson } from '../../../../lib/admin/http.ts';
import { bulk } from '../../../../lib/admin/workflow.ts';

export const prerender = false;

export const POST = guarded(() => '/admin/posts/', async (context) => {
  assertSameOrigin(context.request, context.url);
  const user = await requireUser(context);
  const form = await readForm(context.request);
  const slugs = form.getAll('slugs[]').filter((value): value is string => typeof value === 'string');
  const results = await bulk(formText(form, 'op'), slugs, { author: formText(form, 'author'), topic: formText(form, 'topic') }, user);
  const done = results.filter((r) => r.ok).length;
  const failed = results.find((r) => !r.ok);
  const message = `${done} of ${results.length} done.${failed ? ` /${failed.slug}/: ${failed.message}` : ''}`;
  if (wantsJson(context.request)) return Response.json({ ok: true, message, results });
  return redirectFlash('/admin/posts/', message, failed ? 'error' : 'success');
});
