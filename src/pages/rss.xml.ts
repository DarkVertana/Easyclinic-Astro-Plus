import type { APIRoute } from 'astro';
import { getEntry } from 'astro:content';
import { getRegistry } from '../lib/content/registry';
import { indexTopic, newestFirst, type Listable } from '../lib/content/posts';
import { POST_TOPIC_LABELS } from '../schemas/constants';

/**
 * RSS 2.0 feed of the blog (spec 5.19): the newest 50 published, indexable posts and guides (every guide,
 * including those /blog/ does not list, such as the EMR-versus-paper guide under /compare/), with absolute
 * www URLs. Each item's category is its /blog/ topic, or "Guides" for a guide /blog/ does not list. Only
 * published entries appear, in every stage, so a preview deploy never exposes a draft to a feed reader.
 * /feed/ (the WordPress feed) 301s here.
 */
const LIMIT = 50;
const FEED_FAMILIES = new Set(['post', 'guide']);

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const rfc822 = (d: Date) => d.toUTCString();

export const GET: APIRoute = async () => {
  const registry = await getRegistry();
  const site = (await getEntry('site', 'site'))!.data;
  const abs = (path: string) => new URL(path, site.url).href;

  const entries = await Promise.all(
    registry.pages
      .filter((r) => FEED_FAMILIES.has(r.family) && r.status === 'published' && !r.data.noindex)
      .map((r) => {
        const page = r as unknown as Listable;
        const topic = indexTopic(page);
        return { record: r, page, category: topic ? POST_TOPIC_LABELS[topic] : 'Guides', title: r.data.h1, date: r.data.lastUpdated };
      })
      .sort(newestFirst)
      .slice(0, LIMIT)
      .map(async (e) => ({ ...e, author: e.record.data.author ? (await getEntry(e.record.data.author))?.data.name : undefined })),
  );

  const items = entries.map(({ page, category, title, date, author }) => {
    const url = abs(page.path);
    return [
      '    <item>',
      `      <title>${esc(title)}</title>`,
      `      <link>${esc(url)}</link>`,
      `      <guid isPermaLink="true">${esc(url)}</guid>`,
      `      <description>${esc(page.data.summary ?? page.data.metaDescription)}</description>`,
      date ? `      <pubDate>${rfc822(date)}</pubDate>` : '',
      author ? `      <dc:creator>${esc(author)}</dc:creator>` : '',
      `      <category>${esc(category)}</category>`,
      '    </item>',
    ]
      .filter(Boolean)
      .join('\n');
  });

  // lastBuildDate is the newest entry's date, not the build time, so an unchanged feed stays byte-identical.
  const newest = entries.find((e) => e.date)?.date;
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>EasyClinic blog</title>
    <link>${esc(abs('/blog/'))}</link>
    <atom:link href="${esc(abs('/rss.xml'))}" rel="self" type="application/rss+xml" />
    <description>EasyClinic’s guides and posts for clinic owners, newest first.</description>
    <language>en-gb</language>
${newest ? `    <lastBuildDate>${rfc822(newest)}</lastBuildDate>\n` : ''}${items.join('\n')}
  </channel>
</rss>
`;
  return new Response(body, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } });
};
