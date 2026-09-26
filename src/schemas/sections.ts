import type { SchemaContext } from 'astro:content';
import { z } from 'astro/zod';
import { schema as addOns } from '../components/blocks/AddOns/schema';
import { schema as clinicTypes } from '../components/blocks/ClinicTypes/schema';
import { schema as contactCard } from '../components/blocks/ContactCard/schema';
import { schema as contentCards } from '../components/blocks/ContentCards/schema';
import { schema as costExamples } from '../components/blocks/CostExamples/schema';
import { schema as countryMoney } from '../components/blocks/CountryMoney/schema';
import { schema as dataTable } from '../components/blocks/DataTable/schema';
import { schema as demoForm } from '../components/blocks/DemoForm/schema';
import { schema as featureRows } from '../components/blocks/FeatureRows/schema';
import { schema as journeyDiagram } from '../components/blocks/JourneyDiagram/schema';
import { schema as moduleGrid } from '../components/blocks/ModuleGrid/schema';
import { schema as oldWayNewWay } from '../components/blocks/OldWayNewWay/schema';
import { schema as painBlocks } from '../components/blocks/PainBlocks/schema';
import { schema as personaRouter } from '../components/blocks/PersonaRouter/schema';
import { schema as planMatrix } from '../components/blocks/PlanMatrix/schema';
import { schema as pricingCards } from '../components/blocks/PricingCards/schema';
import { schema as proofBlock } from '../components/blocks/ProofBlock/schema';
import { schema as prose } from '../components/blocks/Prose/schema';
import { schema as regulatorStrip } from '../components/blocks/RegulatorStrip/schema';
import { schema as regulatorTable } from '../components/blocks/RegulatorTable/schema';
import { schema as scopeBox } from '../components/blocks/ScopeBox/schema';
import { schema as stepList } from '../components/blocks/StepList/schema';
import { schema as testimonialRow } from '../components/blocks/TestimonialRow/schema';

/** Every section type, keyed by its discriminant. blocks/registry.ts maps the same keys to components. */
export const BLOCK_SCHEMAS = {
  addOns,
  clinicTypes,
  contactCard,
  contentCards,
  costExamples,
  countryMoney,
  dataTable,
  demoForm,
  featureRows,
  journeyDiagram,
  moduleGrid,
  oldWayNewWay,
  painBlocks,
  personaRouter,
  planMatrix,
  pricingCards,
  proofBlock,
  prose,
  regulatorStrip,
  regulatorTable,
  scopeBox,
  stepList,
  testimonialRow,
} as const;

export type BlockName = keyof typeof BLOCK_SCHEMAS;
export const BLOCK_NAMES = Object.keys(BLOCK_SCHEMAS) as BlockName[];

type BlockSchema<N extends BlockName> = z.infer<ReturnType<(typeof BLOCK_SCHEMAS)[N]>>;
export type Section = { [N in BlockName]: BlockSchema<N> }[BlockName];
export type SectionOf<N extends BlockName> = Extract<Section, { discriminant: N }>;
export type SectionValue<N extends BlockName> = SectionOf<N>['value'];

/** The section list for a page family, limited to the block types that family allows. */
export function sectionsFor(ctx: SchemaContext, allowed: readonly BlockName[]) {
  const options = allowed.map((name) => (BLOCK_SCHEMAS[name] as (c: SchemaContext) => z.ZodType)(ctx));
  if (options.length === 0) return z.array(z.never());
  if (options.length === 1) return z.array(options[0]);
  return z.array(z.discriminatedUnion('discriminant', options as never));
}
