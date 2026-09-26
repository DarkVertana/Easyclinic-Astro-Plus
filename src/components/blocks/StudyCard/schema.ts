import { z } from 'astro/zod';
import { block } from '../../../schemas/block-base';
import { md } from '../../../schemas/fields';

/** Spec 5.3: method, sample, sites, publication link and date for one publication in study.yaml. */
export const schema = () =>
  block('studyCard', {
    publication: z.string(),
    figures: z.array(z.string()).default([]),
    method: md,
    sites: md,
    limits: md.optional(),
  });
