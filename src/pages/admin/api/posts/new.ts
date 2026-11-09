import { requireUser } from '../../../../lib/admin/auth.ts';
import { assertSameOrigin, formText, guarded, readForm } from '../../../../lib/admin/http.ts';
import { createSubmission } from '../../../../lib/admin/workflow.ts';

export const prerender = false;

export const POST = guarded(() => '/admin/', async (context) => {
  assertSameOrigin(context.request, context.url);
  const user = await requireUser(context);
  const form = await readForm(context.request);
  const sub = await createSubmission({ slug: formText(form, 'slug').trim(), title: formText(form, 'title').trim(), topic: formText(form, 'topic').trim(), owner: formText(form, 'owner').trim() }, user);
  return new Response(null, { status: 303, headers: { location: `/admin/posts/${sub.id}/` } });
});
