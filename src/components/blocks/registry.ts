import type { BlockName } from '../../schemas/sections';
import AddOns from './AddOns/AddOns.astro';
import ClinicTypes from './ClinicTypes/ClinicTypes.astro';
import ContactCard from './ContactCard/ContactCard.astro';
import ContentCards from './ContentCards/ContentCards.astro';
import CostExamples from './CostExamples/CostExamples.astro';
import CountryMoney from './CountryMoney/CountryMoney.astro';
import DataTable from './DataTable/DataTable.astro';
import DemoForm from './DemoForm/DemoForm.astro';
import FeatureRows from './FeatureRows/FeatureRows.astro';
import JourneyDiagram from './JourneyDiagram/JourneyDiagram.astro';
import ModuleGrid from './ModuleGrid/ModuleGrid.astro';
import OldWayNewWay from './OldWayNewWay/OldWayNewWay.astro';
import PainBlocks from './PainBlocks/PainBlocks.astro';
import PersonaRouter from './PersonaRouter/PersonaRouter.astro';
import PlanMatrix from './PlanMatrix/PlanMatrix.astro';
import PricingCards from './PricingCards/PricingCards.astro';
import ProofBlock from './ProofBlock/ProofBlock.astro';
import Prose from './Prose/Prose.astro';
import RegulatorStrip from './RegulatorStrip/RegulatorStrip.astro';
import RegulatorTable from './RegulatorTable/RegulatorTable.astro';
import ScopeBox from './ScopeBox/ScopeBox.astro';
import StepList from './StepList/StepList.astro';
import TestimonialRow from './TestimonialRow/TestimonialRow.astro';

/** One component per section discriminant; the `satisfies` keeps it in step with src/schemas/sections.ts. */
export const BLOCKS = {
  addOns: AddOns,
  clinicTypes: ClinicTypes,
  contactCard: ContactCard,
  contentCards: ContentCards,
  costExamples: CostExamples,
  countryMoney: CountryMoney,
  dataTable: DataTable,
  demoForm: DemoForm,
  featureRows: FeatureRows,
  journeyDiagram: JourneyDiagram,
  moduleGrid: ModuleGrid,
  oldWayNewWay: OldWayNewWay,
  painBlocks: PainBlocks,
  personaRouter: PersonaRouter,
  planMatrix: PlanMatrix,
  pricingCards: PricingCards,
  proofBlock: ProofBlock,
  prose: Prose,
  regulatorStrip: RegulatorStrip,
  regulatorTable: RegulatorTable,
  scopeBox: ScopeBox,
  stepList: StepList,
  testimonialRow: TestimonialRow,
} satisfies Record<BlockName, unknown>;
