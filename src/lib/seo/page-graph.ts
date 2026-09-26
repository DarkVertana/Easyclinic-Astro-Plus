import { getCollection, getEntry } from 'astro:content';
import type { PageRecord } from '../content/registry.ts';
import type { Crumb } from './breadcrumbs.ts';
import { breadcrumbList, faqPage, graph, localBusiness, offers, organization, softwareApplication, webPage, website, type PriceData } from './jsonld.ts';

/** Picks the JSON-LD nodes for a page by family (spec 2.10, with the plan's corrections). */
export async function pageGraph(record: PageRecord, trail: Crumb[]): Promise<Record<string, unknown>> {
  const site = (await getEntry('site', 'site'))!.data;
  const url = new URL(record.path, site.url).href;
  const d = record.data;
  const hasBreadcrumb = trail.length > 1;
  const nodes: Parameters<typeof graph>[0] = [];

  const allPrices = (await getCollection('prices')).map((p) => p.data as PriceData);
  if (record.family === 'home') {
    nodes.push(organization(site), website(site), softwareApplication(site, offers(allPrices.filter((p) => p.currency === 'USD'), url)));
  }
  if (record.family === 'pricing') {
    // Offers for the currencies this page shows: every currency on the main page, one on country pages.
    const cards = d.sections.filter((s) => s.discriminant === 'pricingCards') as Array<{ value: { currency: { id: string }; switcher: boolean } }>;
    const ids = new Set(cards.flatMap((c) => (c.value.switcher ? allPrices.map((p) => p.currency.toLowerCase()) : [c.value.currency.id])));
    nodes.push(softwareApplication(site, offers(allPrices.filter((p) => ids.has(p.currency.toLowerCase())), url)));
  }

  const type = record.path === '/contact-us/' ? 'ContactPage' : record.path === '/about-us/' ? 'AboutPage' : 'WebPage';
  nodes.push(webPage(site, { url, title: d.title, description: d.metaDescription, dateModified: d.lastUpdated, hasBreadcrumb, type }));
  if (hasBreadcrumb) nodes.push(breadcrumbList(site, url, trail));
  if (d.faq.length) nodes.push(faqPage(url, d.faq));
  if (record.path === '/contact-us/') nodes.push(localBusiness(site));
  if (record.path === '/about-us/') nodes.push(organization(site));
  return graph(nodes);
}
