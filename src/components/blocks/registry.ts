import type { BlockName } from '../../schemas/sections';
import AddOns from './AddOns/AddOns.astro';
import ClinicTypes from './ClinicTypes/ClinicTypes.astro';
import ContactCard from './ContactCard/ContactCard.astro';
import ContentCards from './ContentCards/ContentCards.astro';
import CostExamples from './CostExamples/CostExamples.astro';
import CountryMoney from './CountryMoney/CountryMoney.astro';
import DataTable from './DataTable/DataTable.astro';
import GlossaryList from './GlossaryList/GlossaryList.astro';
import PostIndex from './PostIndex/PostIndex.astro';
import ComparisonTable from './ComparisonTable/ComparisonTable.astro';
import DayTimeline from './DayTimeline/DayTimeline.astro';
import DecisionMatrix from './DecisionMatrix/DecisionMatrix.astro';
import SourceList from './SourceList/SourceList.astro';
import TestimonialGrid from './TestimonialGrid/TestimonialGrid.astro';
import IntegrationDirectory from './IntegrationDirectory/IntegrationDirectory.astro';
import VendorList from './VendorList/VendorList.astro';
import DemoForm from './DemoForm/DemoForm.astro';
import FlowDiagram from './FlowDiagram/FlowDiagram.astro';
import HubGrid from './HubGrid/HubGrid.astro';
import InlineCTA from './InlineCTA/InlineCTA.astro';
import RolesMatrix from './RolesMatrix/RolesMatrix.astro';
import SplitTable from './SplitTable/SplitTable.astro';
import StudyCard from './StudyCard/StudyCard.astro';
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
import LogoStrip from './LogoStrip/LogoStrip.astro';
import PeopleGrid from './PeopleGrid/PeopleGrid.astro';

/** One component per section discriminant; the `satisfies` keeps it in step with src/schemas/sections.ts. */
export const BLOCKS = {
  addOns: AddOns,
  glossaryList: GlossaryList,
  postIndex: PostIndex,
  comparisonTable: ComparisonTable,
  decisionMatrix: DecisionMatrix,
  sourceList: SourceList,
  testimonialGrid: TestimonialGrid,
  integrationDirectory: IntegrationDirectory,
  vendorList: VendorList,
  clinicTypes: ClinicTypes,
  contactCard: ContactCard,
  contentCards: ContentCards,
  costExamples: CostExamples,
  countryMoney: CountryMoney,
  dataTable: DataTable,
  dayTimeline: DayTimeline,
  flowDiagram: FlowDiagram,
  hubGrid: HubGrid,
  inlineCta: InlineCTA,
  rolesMatrix: RolesMatrix,
  splitTable: SplitTable,
  studyCard: StudyCard,
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
  logoStrip: LogoStrip,
  peopleGrid: PeopleGrid,
} satisfies Record<BlockName, unknown>;
