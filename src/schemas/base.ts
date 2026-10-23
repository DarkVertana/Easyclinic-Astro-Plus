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
    /** An image card beside the hero text, with the reach line under the CTAs (the country listicles). */
    heroPanel: z
      .object({
        src: ctx.image(),
        alt: z.string().min(1),
        /** Ends the reach line after "10+ years". */
        yearsIn: z.string().default('in clinic software'),
      })
      .optional(),
    /** The section straight after the hero: feature chips, reach numbers, client logos and three quotes. */
    trustSection: z
      .object({
        chips: z.array(z.string().min(2)).min(1).max(12),
        heading: z.string().min(10),
        ratingNote: z.string().optional(),
      })
      .optional(),
    /** After the trust section: a claims path as steps, an honest note on what is live, and a standards panel. */
    readinessSection: z
      .object({
        heading: z.string().min(10),
        intro: z.string().optional(),
        steps: z.array(z.object({ title: z.string().min(2), body: z.string().min(10) })).min(2).max(6),
        noteHeading: z.string().min(5),
        note: md,
        /** An image shown beside the note in place of the drawn standards panel. */
        image: z.object({ src: ctx.image(), alt: z.string().min(1) }).optional(),
        panelHeading: z.string().min(5).optional(),
        panelIntro: z.string().optional(),
        items: z.array(z.object({ name: z.string().min(2), status: z.string().min(2), live: z.boolean().default(true) })).max(10).default([]),
        badges: z.array(z.object({ name: z.string().min(2), status: z.string().min(2) })).max(4).default([]),
      })
      .optional(),
    /** After the readiness section: an optional proof card, then a dark card with four features and a CTA. */
    platformSection: z
      .object({
        proof: z
          .object({
            eyebrow: z.string().min(2),
            heading: z.string().min(10),
            body: z.string().min(20),
            link: z.object({ label: z.string().min(2), href: z.string().min(1) }),
          })
          .optional(),
        badge: z.string().optional(),
        heading: z.string().min(10),
        intro: z.string().min(20),
        features: z.array(z.object({ icon: z.string().min(2), title: z.string().min(2), body: z.string().min(10) })).min(2).max(4),
        footnote: z.string().optional(),
        cta: z.object({ label: z.string().min(2), href: z.string().min(1) }),
        /** Below the dark card: a bold lead paragraph, then body paragraphs (one per array item). */
        story: z.object({ lead: z.string().min(20), body: z.array(z.string().min(10)).min(1).max(4) }).optional(),
      })
      .optional(),
    /** A short text section straight after "Where to go next", e.g. links to nearby markets. */
    nearbySection: z.object({ heading: z.string().min(5), body: md }).optional(),
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
    /** After the related links: an illustration beside a short question, a line of help and one button. */
    helpBand: z
      .object({
        heading: z.string().min(5),
        body: md.optional(),
        cta,
        image: ctx.image(),
        imageAlt: z.string().default(''),
      })
      .optional(),
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
