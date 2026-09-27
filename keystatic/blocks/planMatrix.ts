import { defineBlock, flag } from '../fields.ts';

/**
 * `planMatrix` section (Zod: src/components/blocks/PlanMatrix/schema.ts): the feature-by-plan comparison. Its rows
 * are the matrix in src/data/plans.yaml.
 */
export const planMatrix = defineBlock('planMatrix', 'Plan comparison table', {
  open: flag('Open by default', { zodDefault: false, description: 'Show the table expanded. Otherwise it is collapsed behind its summary.' }),
});
