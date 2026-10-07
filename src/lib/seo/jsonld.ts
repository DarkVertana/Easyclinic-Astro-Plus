/**
 * JSON-LD from content (spec 2.10, 7.7), as one @graph per page with stable @ids.
 * Deliberate differences from the spec, per the plan:
 * - No WebSite SearchAction until a site search exists.
 * - No Review or AggregateRating built from Capterra or Google scores (Google does not allow
 *   marking up ratings collected on other sites).
 * - No Product markup for competitors.
 */
import type {
  BreadcrumbList,
  FAQPage,
  Offer,
  Organization,
  SoftwareApplication,
  Thing,
  WebPage,
  WebSite,
} from 'schema-dts';
import { stripSentinels } from '../content/sentinel.ts';
import type { Crumb } from './breadcrumbs.ts';

export interface SiteData {
  url: string;
  name: string;
  legalName: string;
  email: string;
  phone: string;
  foundingYear: number;
  social: Record<string, string>;
  address: { street: string; city: string; region: string; postalCode: string; countryCode: string };
}

export interface PriceData {
  currency: string;
  plans: Record<string, { annual: number | null; quarterly: number | null }>;
}

type Node = Exclude<Thing, string>;
type Obj<T> = Exclude<T, string>;

const id = (site: SiteData, fragment: string) => `${site.url}/#${fragment}`;

/** Markdown and placeholders to plain text for JSON-LD strings. */
export function plain(text: string): string {
  return stripSentinels(text)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function postalAddress(site: SiteData) {
  return {
    '@type': 'PostalAddress' as const,
    streetAddress: site.address.street,
    addressLocality: site.address.city,
    addressRegion: site.address.region,
    postalCode: site.address.postalCode,
    addressCountry: site.address.countryCode,
  };
}

/** `founders`: names whose published role says founder (spec 5.19 adds them on /about-us/ only). */
export function organization(site: SiteData, founders: string[] = []): Obj<Organization> {
  return {
    '@type': 'Organization',
    '@id': id(site, 'organization'),
    name: site.name,
    legalName: site.legalName,
    url: `${site.url}/`,
    logo: `${site.url}/apple-touch-icon.png`,
    email: site.email,
    telephone: site.phone.replace(/\s/g, ''),
    foundingDate: String(site.foundingYear),
    sameAs: Object.values(site.social),
    address: postalAddress(site),
    ...(founders.length ? { founder: founders.map((name) => ({ '@type': 'Person' as const, name })) } : {}),
  };
}

export function website(site: SiteData): Obj<WebSite> {
  return {
    '@type': 'WebSite',
    '@id': id(site, 'website'),
    name: site.name,
    url: `${site.url}/`,
    publisher: { '@id': id(site, 'organization') },
    inLanguage: 'en',
  };
}

const PLAN_NAMES: Record<string, string> = { professional: 'Professional', premium: 'Premium' };

/** One Offer per plan per currency, for prices that are known (spec 2.10, 5.12). */
export function offers(prices: PriceData[], pageUrl: string): Offer[] {
  const out: Offer[] = [];
  for (const price of prices) {
    for (const [plan, values] of Object.entries(price.plans)) {
      if (values.annual == null) continue;
      out.push({
        '@type': 'Offer',
        name: `${PLAN_NAMES[plan] ?? plan} plan, billed annually`,
        url: pageUrl,
        priceCurrency: price.currency,
        price: values.annual,
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: values.annual,
          priceCurrency: price.currency,
          unitText: 'per doctor per month',
          referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' },
        },
      });
    }
  }
  return out;
}

export function softwareApplication(site: SiteData, offerList: Offer[]): Obj<SoftwareApplication> {
  return {
    '@type': 'SoftwareApplication',
    '@id': id(site, 'software'),
    name: 'Easy Clinic',
    applicationCategory: 'BusinessApplication',
    applicationSubCategory: 'Clinic management software',
    operatingSystem: 'Web browser',
    url: `${site.url}/`,
    publisher: { '@id': id(site, 'organization') },
    ...(offerList.length ? { offers: offerList } : {}),
  };
}

export function webPage(
  site: SiteData,
  page: { url: string; title: string; description: string; dateModified?: Date | null; hasBreadcrumb: boolean; type?: 'WebPage' | 'ContactPage' | 'AboutPage' | 'CollectionPage' },
): WebPage {
  return {
    '@type': page.type ?? 'WebPage',
    '@id': `${page.url}#webpage`,
    url: page.url,
    name: plain(page.title),
    description: plain(page.description),
    isPartOf: { '@id': id(site, 'website') },
    inLanguage: 'en',
    ...(page.dateModified ? { dateModified: page.dateModified.toISOString().slice(0, 10) } : {}),
    ...(page.hasBreadcrumb ? { breadcrumb: { '@id': `${page.url}#breadcrumb` } } : {}),
  } as WebPage;
}

export function breadcrumbList(site: SiteData, pageUrl: string, trail: Crumb[]): Obj<BreadcrumbList> {
  return {
    '@type': 'BreadcrumbList',
    '@id': `${pageUrl}#breadcrumb`,
    itemListElement: trail.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: plain(crumb.label),
      item: new URL(crumb.path, site.url).href,
    })),
  };
}

/** Generated from the same array that renders the visible FAQ, so the two cannot disagree. */
export function faqPage(pageUrl: string, faq: Array<{ question: string; answer: string }>): Obj<FAQPage> {
  return {
    '@type': 'FAQPage',
    '@id': `${pageUrl}#faq`,
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: plain(item.question),
      acceptedAnswer: { '@type': 'Answer', text: plain(item.answer) },
    })),
  };
}

/** Article for guides, posts, listicles and comparisons (spec 2.10), with a named author and dateModified. */
export function article(
  site: SiteData,
  page: { url: string; headline: string; description: string; dateModified?: Date | null; author?: { name: string; role: string; linkedin?: string | null } | null },
): Node {
  return {
    '@type': 'Article',
    '@id': `${page.url}#article`,
    headline: plain(page.headline).slice(0, 110),
    description: plain(page.description),
    mainEntityOfPage: { '@id': `${page.url}#webpage` },
    publisher: { '@id': id(site, 'organization') },
    ...(page.dateModified ? { dateModified: page.dateModified.toISOString().slice(0, 10) } : {}),
    ...(page.author ? { author: { '@type': 'Person', name: page.author.name, jobTitle: page.author.role, ...(page.author.linkedin ? { sameAs: [page.author.linkedin] } : {}) } } : {}),
  } as Node;
}

/** A citation for a study page (spec 2.10); preprints are marked as such in the name. */
export function scholarlyArticle(p: { title: string; authors: string; venue: string; url: string; published: Date; identifier: string; peerReviewed: boolean }): Node {
  return {
    '@type': 'ScholarlyArticle',
    headline: p.title,
    name: p.title,
    author: p.authors,
    datePublished: p.published.toISOString().slice(0, 10),
    url: p.url,
    identifier: p.identifier,
    publisher: p.venue,
    ...(p.peerReviewed ? {} : { creativeWorkStatus: 'Preprint' }),
  } as Node;
}

export function localBusiness(site: SiteData): Node {
  return {
    '@type': 'LocalBusiness',
    '@id': id(site, 'office'),
    name: `${site.name} (${site.legalName})`,
    url: `${site.url}/contact-us/`,
    telephone: site.phone.replace(/\s/g, ''),
    email: site.email,
    parentOrganization: { '@id': id(site, 'organization') },
    address: postalAddress(site),
  } as Node;
}

export function graph(nodes: Array<object | null | undefined | false>): Record<string, unknown> {
  return { '@context': 'https://schema.org', '@graph': nodes.filter(Boolean) };
}
