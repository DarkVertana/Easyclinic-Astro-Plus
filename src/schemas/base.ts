import { reference, type SchemaContext } from 'astro:content';
import { z } from 'astro/zod';
import { auditEntry, errorsOf } from '../lib/rules/audit.ts';
import { STATUSES, type Family } from './constants';
import { cta, faqItem, internalPath, isoDate, md, media } from './fields';
import { sectionsFor, type BlockName, type Section } from './sections';

/**
 * Shared page schema (spec 7.2). Every page family extends it and adds the section types it allows.
 * The rules engine runs on every entry; its errors fail the build only for published entries,
 * and appear in the preview toolbar and facts report for drafts.
 */
export const pageBase = (ctx: SchemaContext) =>
  z.object({
    status: z.enum(STATUSES),
    /** Only for pages whose URL is not derived from the file name (home, hubs, main pricing). */
    path: internalPath.optional(),
    headKeyword: z.string().min(2),
    secondaryKeywords: z.array(z.string()).default([]),
    title: z.string().min(10),
    metaDescription: z.string().min(40),
    h1: z.string().min(5),
    /** Anchor text used when other pages link here (nav, related links, breadcrumbs). */
    linkLabel: z.string().min(2).max(48),
    eyebrow: z.string().optional(),
    /** Two sentences that answer the page's owning query, with a number where one exists (spec 2.2). */
    openingAnswer: md,
    /** Card and related-link description. */
    summary: z.string().max(220).optional(),
    author: reference('authors').nullable(),
    reviewedBy: reference('authors').optional(),
    lastUpdated: isoDate.nullable(),
    heroMedia: media(ctx).optional(),
    /** Compliance and rating strip under the hero CTAs (section 11). */
    heroStrip: z
      .object({
        regulators: z.array(reference('regulators')).default([]),
        ratings: z.boolean().default(false),
        study: z.boolean().default(false),
      })
      .optional(),
    ctas: z.object({
      primary: cta,
      secondary: cta.optional(),
      /** Prefilled WhatsApp message naming this page (spec 7.9). */
      whatsapp: z.string().optional(),
    }),
    faqHeading: z.string().default('Questions clinic owners ask'),
    faq: z.array(faqItem).default([]),
    links: z.object({
      /** Parent hub; drives breadcrumbs and BreadcrumbList. */
      hub: internalPath.optional(),
      related: z
        .array(z.object({ href: internalPath, label: z.string().optional(), description: z.string().optional() }))
        .max(8)
        .default([]),
      relatedHeading: z.string().default('Where to go next'),
    }),
    /** Closing CTA band. Copy is per page; there is no shared closing block (spec 2.11). */
    closing: z
      .object({
        heading: z.string(),
        body: md.optional(),
        primary: cta,
        secondary: cta.optional(),
      })
      .optional(),
    country: reference('countries').optional(),
    noindex: z.boolean().default(false),
    canonical: z.url().optional(),
    /** Old URLs this page replaces; each becomes a 301 to this page. */
    redirectFrom: z.array(internalPath).default([]),
    /** Spec 6.5: the editor's two written answers. Required to publish. */
    editorialPass: z
      .object({
        by: z.string(),
        on: isoDate,
        onlyUsCouldWrite: z.string().min(10),
        readsMachineWritten: z.string().min(2),
      })
      .optional(),
    /** Sign-off for research or outcome claims written as text rather than study.yaml tokens. */
    claimsReview: z.object({ by: z.string(), on: isoDate }).optional(),
    schemaExtras: z.record(z.string(), z.unknown()).optional(),
    /** Editor notes; never rendered. */
    notes: z.array(z.string()).default([]),
  });

/**
 * Builds a page family schema: the base, the family's own fields, the allowed section types, and
 * the publish rules as a refinement.
 */
export function definePage(family: Family, blocks: readonly BlockName[], extension?: (ctx: SchemaContext) => z.ZodRawShape) {
  return (ctx: SchemaContext) =>
    pageBase(ctx)
      .extend({
        family: z.literal(family).default(family),
        sections: sectionsFor(ctx, blocks).default([]),
        ...(extension ? extension(ctx) : {}),
      })
      .superRefine((data: { status: string }, zctx) => {
        if (data.status !== 'published') return;
        for (const issue of errorsOf(auditEntry(data as never, family))) {
          zctx.addIssue({
            code: 'custom',
            path: issue.path.split(/\.|\[|\]/).filter(Boolean),
            message: `[${issue.rule}] ${issue.message}${issue.excerpt ? ` ("${issue.excerpt}")` : ''}`,
          });
        }
      });
}

/** Page data as templates and the registry use it (every family shares these fields). */
export type PageFields = Omit<z.infer<ReturnType<typeof pageBase>>, 'country'> & {
  family: Family;
  sections: Section[];
  country?: { collection: 'countries'; id: string };
};
