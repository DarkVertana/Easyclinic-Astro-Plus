import { reference, type SchemaContext } from 'astro:content';
import { z } from 'astro/zod';
import { auditEntry, errorsOf } from '../lib/rules/audit.ts';
import { STATUSES, type Family } from './constants';
import { cta, faqItem, internalPath, isoDate, md, optionalCta, optionalGroup, optionalMedia } from './fields';
import { CLAIMS_REVIEW_PRESENT_IF, CLOSING_PRESENT_IF, EDITORIAL_PASS_PRESENT_IF, HERO_STRIP_PRESENT_IF, ORBIT_PRESENT_IF, PROBLEMS_PRESENT_IF, SHOWCASE_PRESENT_IF } from './groups';
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
    heroMedia: optionalMedia(ctx),
    /** Compliance and rating strip under the hero CTAs (section 11). */
    heroStrip: optionalGroup(
      z.object({
        regulators: z.array(reference('regulators')).default([]),
        ratings: z.boolean().default(false),
        study: z.boolean().default(false),
      }),
      HERO_STRIP_PRESENT_IF,
    ),
    ctas: z.object({
      primary: cta,
      secondary: optionalCta,
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
        .max(9)
        .default([]),
      relatedHeading: z.string().default('Where to go next'),
    }),
    /** A numbered list of problems shown under the related links: heading on the left, items on the right. */
    problems: optionalGroup(
      z.object({
        eyebrow: z.string().optional(),
        heading: z.string(),
        /** Words after the heading, set in blue italic. */
        headingAccent: z.string().optional(),
        intro: md.optional(),
        items: z
          .array(
            z.object({
              title: z.string(),
              body: md,
              icon: z.string().optional(),
              /** A sourced figure only, e.g. {fig:diagnostic-errors}; leave empty when none is sourced. */
              stat: z.string().optional(),
              statLabel: z.string().optional(),
            }),
          )
          .max(5)
          .default([]),
      }),
      PROBLEMS_PRESENT_IF,
    ),
    /** A screenshot or video shown under the related links, above the FAQ. */
    showcase: optionalGroup(
      z.object({
        eyebrow: z.string().optional(),
        heading: z.string(),
        /** Words after the heading, set in blue italic (e.g. "& other systems"). */
        headingAccent: z.string().optional(),
        intro: md.optional(),
        body: md.optional(),
        /** Up to three short cards under the intro. */
        points: z.array(z.object({ heading: z.string(), body: md })).max(3).default([]),
        /** Small pills under the cards (systems, standards, channels). */
        tags: z.array(z.string()).default([]),
        media: optionalMedia(ctx),
        /** A hub diagram in place of media: a centre circle with labelled tiles around it. */
        orbit: optionalGroup(
          z.object({ center: z.string(), centerNote: z.string().optional(), nodes: z.array(z.string()).max(10).default([]) }),
          ORBIT_PRESENT_IF,
        ),
      }),
      SHOWCASE_PRESENT_IF,
    ),
    /** Closing CTA band. Copy is per page; there is no shared closing block (spec 2.11). */
    closing: optionalGroup(
      z.object({
        /** Small pill above the heading. */
        eyebrow: z.string().optional(),
        heading: z.string(),
        /** Words on their own line under the heading, in teal italic. */
        headingAccent: z.string().optional(),
        body: md.optional(),
        primary: cta,
        secondary: optionalCta,
        /** A row of stages under a rule, e.g. "Stage 1" / "Understand (weeks 1-3)". */
        stages: z.array(z.object({ title: z.string(), note: z.string().optional() })).max(5).default([]),
      }),
      CLOSING_PRESENT_IF,
    ),
    country: reference('countries').optional(),
    noindex: z.boolean().default(false),
    canonical: z.url().optional(),
    /** Old URLs this page replaces; each becomes a 301 to this page. */
    redirectFrom: z.array(internalPath).default([]),
    /** Spec 6.5: the editor's two written answers. Required to publish. */
    editorialPass: optionalGroup(
      z.object({
        by: z.string(),
        on: isoDate,
        onlyUsCouldWrite: z.string().min(10),
        readsMachineWritten: z.string().min(2),
      }),
      EDITORIAL_PASS_PRESENT_IF,
    ),
    /** Sign-off for research or outcome claims written as text rather than study.yaml tokens. */
    claimsReview: optionalGroup(z.object({ by: z.string(), on: isoDate }), CLAIMS_REVIEW_PRESENT_IF),
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
