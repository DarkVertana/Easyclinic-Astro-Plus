import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { md, optionalCta } from '../../../schemas/fields';

/** A publication card with its key figures beside a few labelled points and a caveat (/about-us/ research). */
export const schema = () =>
  block('spotlight', {
    paper: z.object({
      badge: z.string().optional(),
      title: z.string().min(5),
      href: z.url(),
      meta: z.string().optional(),
      linkLabel: z.string().default('Read the paper'),
    }),
    /** Figures from the paper; {fig:...} tokens keep them in step with src/data/study.yaml. */
    stats: z.array(z.object({ value: z.string().min(1), label: z.string().min(2) })).max(4).default([]),
    points: z
      .array(z.object({ icon: z.string().default('circle-check'), title: z.string().min(2), body: md }))
      .min(1)
      .max(4),
    caveat: md.optional(),
    link: optionalCta,
  });
