import { requireUser } from '../../../../lib/admin/auth.ts';
import { assertSameOrigin, formText, guarded, readForm } from '../../../../lib/admin/http.ts';

export const prerender = false;

/** Old forms still post here. Opening never writes: this only sends them to the read-only view. */
export const POST = guarded(() => '/admin/', async (context) => {
  assertSameOrigin(context.request, context.url);
  await requireUser(context);
  const form = await readForm(context.request);
  return new Response(null, { status: 303, headers: { location: `/admin/posts/view/?slug=${encodeURIComponent(formText(form, 'slug').trim())}` } });
});
