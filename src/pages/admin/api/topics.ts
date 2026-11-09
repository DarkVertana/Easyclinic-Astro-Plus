import { requireUser } from '../../../lib/admin/auth.ts';
import { existingPostSlugs, suggestTopics, toPublicError } from '../../../lib/admin/engine.ts';
import { assertSameOrigin, formText, guarded, readForm } from '../../../lib/admin/http.ts';

export const prerender = false;

export const POST = guarded(() => '/admin/generate/', async (context) => {
  assertSameOrigin(context.request, context.url);
  const user = await requireUser(context);
  const form = await readForm(context.request).catch(() => new FormData());
  try {
    const topics = await suggestTopics({ audience: formText(form, 'audience').trim() || 'clinic owners and administrators', country: formText(form, 'country').trim().toLowerCase() }, existingPostSlugs(), {}, user.email);
    return Response.json({ ok: true, topics });
  } catch (error) {
    throw toPublicError(error);
  }
});
