import { requireUser } from '../../../../lib/admin/auth.ts';
import { createJob, toPublicError } from '../../../../lib/admin/engine.ts';
import { assertSameOrigin, formText, guarded, readForm } from '../../../../lib/admin/http.ts';

export const prerender = false;

export const POST = guarded(() => '/admin/generate/', async (context) => {
  assertSameOrigin(context.request, context.url);
  const user = await requireUser(context);
  const form = await readForm(context.request);
  try {
    const job = await createJob(
      {
        topicIdea: formText(form, 'topicIdea'),
        audience: formText(form, 'audience').trim(),
        country: formText(form, 'country').trim().toLowerCase(),
        topic: formText(form, 'topic').trim(),
        owner: formText(form, 'owner').trim(),
      },
      user,
    );
    return new Response(null, { status: 303, headers: { location: `/admin/generate/${job.id}/` } });
  } catch (error) {
    throw toPublicError(error);
  }
});
