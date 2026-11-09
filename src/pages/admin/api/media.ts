import type { APIRoute } from 'astro';
import { currentUser } from '../../../lib/admin/auth.ts';
import { readImage } from '../../../lib/admin/blog.ts';

export const prerender = false;

/** Images for the editor and preview: a draft's upload, or the published file. Signed-in users only. */
export const GET: APIRoute = async (context) => {
  if (!(await currentUser(context))) return new Response('Sign in', { status: 401 });
  const slug = context.url.searchParams.get('slug') ?? '';
  const name = context.url.searchParams.get('name') ?? '';
  try {
    const image = await readImage(slug, name);
    if (!image) return new Response('Not found', { status: 404 });
    return new Response(image.bytes as unknown as BodyInit, {
      headers: { 'content-type': image.type, 'cache-control': 'private, no-cache', 'x-content-type-options': 'nosniff' },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
};
