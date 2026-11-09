import { requireUser } from '../../../../../lib/admin/auth.ts';
import { PublicError, assertSameOrigin, guarded, readForm } from '../../../../../lib/admin/http.ts';
import { getStore } from '../../../../../lib/admin/store.ts';
import { contentFromForm, gateChecks } from '../../../../../lib/admin/workflow.ts';

export const prerender = false;

export const POST = guarded(() => '/admin/', async (context) => {
  assertSameOrigin(context.request, context.url);
  await requireUser(context);
  const form = await readForm(context.request);
  const id = context.params.id ?? '';
  if (!/^[A-Za-z0-9-]{1,100}$/.test(id)) throw new PublicError('That post is not in the admin.', 404);
  const current = await getStore().getSubmission(id);
  if (!current) throw new PublicError('That post is not in the admin.', 404);
  return Response.json({ checks: await gateChecks(current, contentFromForm(form, current.content)) });
});
