/**
 * Every section type as a Keystatic block, keyed by its discriminant. `satisfies Record<BlockName, KsBlock>` makes a
 * missing or misspelt block a type error; BlockName comes from src/schemas/family-blocks.ts, which sections.ts checks
 * against the Zod registry. Each page collection offers the subset in FAMILY_BLOCKS (keystatic/page-base.ts).
 *
 * One file per block. Files that still export `todoBlock(...)` keep their stored values untouched and show no form.
 */
import type { BlockName } from '../../src/schemas/family-blocks.ts';
import type { KsBlock } from '../fields.ts';
import { addOns } from './addOns.ts';
import { glossaryList } from './glossaryList.ts';
import { postIndex } from './postIndex.ts';
import { comparisonTable } from './comparisonTable.ts';
import { decisionMatrix } from './decisionMatrix.ts';
import { sourceList } from './sourceList.ts';
import { testimonialGrid } from './testimonialGrid.ts';
import { integrationDirectory } from './integrationDirectory.ts';
import { vendorList } from './vendorList.ts';
import { dayTimeline } from './dayTimeline.ts';
import { flowDiagram } from './flowDiagram.ts';
import { hubGrid } from './hubGrid.ts';
import { inlineCta } from './inlineCta.ts';
import { rolesMatrix } from './rolesMatrix.ts';
import { splitTable } from './splitTable.ts';
import { studyCard } from './studyCard.ts';
import { clinicTypes } from './clinicTypes.ts';
import { contactCard } from './contactCard.ts';
import { contentCards } from './contentCards.ts';
import { costExamples } from './costExamples.ts';
import { countryMoney } from './countryMoney.ts';
import { dataTable } from './dataTable.ts';
import { demoForm } from './demoForm.ts';
import { featureRows } from './featureRows.ts';
import { journeyDiagram } from './journeyDiagram.ts';
import { moduleGrid } from './moduleGrid.ts';
import { oldWayNewWay } from './oldWayNewWay.ts';
import { painBlocks } from './painBlocks.ts';
import { personaRouter } from './personaRouter.ts';
import { planMatrix } from './planMatrix.ts';
import { pricingCards } from './pricingCards.ts';
import { proofBlock } from './proofBlock.ts';
import { prose } from './prose.ts';
import { regulatorStrip } from './regulatorStrip.ts';
import { regulatorTable } from './regulatorTable.ts';
import { scopeBox } from './scopeBox.ts';
import { stepList } from './stepList.ts';
import { testimonialRow } from './testimonialRow.ts';

export const KS_BLOCKS = {
  addOns,
  glossaryList,
  postIndex,
  comparisonTable,
  decisionMatrix,
  sourceList,
  testimonialGrid,
  integrationDirectory,
  vendorList,
  dayTimeline,
  flowDiagram,
  hubGrid,
  inlineCta,
  rolesMatrix,
  splitTable,
  studyCard,
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
} satisfies Record<BlockName, KsBlock>;
