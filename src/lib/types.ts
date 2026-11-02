export type ScienceKind = "physical" | "chemical" | "biological";

export type KitchenStation = "sink" | "board" | "pan";

export type WorkflowPhaseId = "select" | "prepare" | "pan" | "cook" | "review";
export type WorkflowStepStatus = "completed" | "active" | "upcoming";
export type WorkflowTargetTab = "ingredient" | "treat" | "pan" | "heat" | "season" | "save";

export type FoodForm =
  | "whole"
  | "washed"
  | "cut"
  | "small-pieces"
  | "cooking"
  | "done";

export interface KitchenTask {
  id: string;
  title: string;
  description: string;
  station: KitchenStation;
  operationId?: string;
  completed: boolean;
  active: boolean;
  optional?: boolean;
}

export interface WorkflowStep {
  id: WorkflowPhaseId;
  title: string;
  summary: string;
  status: WorkflowStepStatus;
  targetTab: WorkflowTargetTab;
  station?: KitchenStation;
}

export interface ContextRecommendation {
  id: string;
  title: string;
  reason: string;
  actionLabel?: string;
  operationId?: string;
  station?: KitchenStation;
  targetTab: WorkflowTargetTab;
  alternatives: string[];
  caution?: string;
  tone: "neutral" | "good" | "warning";
}

export interface KitchenWorkflow {
  steps: WorkflowStep[];
  currentPhase: WorkflowPhaseId;
  recommendation: ContextRecommendation;
}

export interface KitchenWorkspace {
  station: KitchenStation;
  sampleStation: KitchenStation;
  inPan: boolean;
  activeTaskId?: string;
  session?: CookingSession;
  heatStartState?: IngredientState;
}

export interface CookingSession {
  isHeating: boolean;
  targetTemperature: number;
  currentTemperature: number;
  elapsedSimSeconds: number;
  heatLevel: HeatLevel;
  method: HeatMethod;
  lidCovered: boolean;
  stirIntensity: StirIntensity;
}

export interface FeedbackMessage {
  id: string;
  tone: "neutral" | "warning" | "good";
  text: string;
}

export interface ParticleEffect {
  id: number;
  type: "water" | "cut" | "steam" | "sizzle";
}

export type PrincipleTag =
  | "surface-area"
  | "surface-moisture"
  | "osmosis"
  | "salt-load"
  | "ph"
  | "temperature"
  | "time"
  | "protein-network"
  | "starch-hydration"
  | "oxidation"
  | "enzyme-activity"
  | "aroma-volatility"
  | "mechanical-structure"
  | "heat-transfer"
  | "browning";

export type TreatmentCategory =
  | "universal"
  | "mechanical"
  | "water-salt"
  | "biological";

export type OutcomeGoal =
  | "crisper"
  | "tenderer"
  | "more-seasoned"
  | "less-water"
  | "more-umami"
  | "more-aromatic"
  | "less-fishy"
  | "greener"
  | "thicker-sauce"
  | "lighter";

export type PredictionKind =
  | "crisper"
  | "tenderer"
  | "drier"
  | "browner"
  | "more-seasoned"
  | "more-aromatic"
  | "less-off-aroma"
  | "more-coating"
  | "color-change";

export type FlavorKey =
  | "sour"
  | "sweet"
  | "salty"
  | "umami"
  | "spicy"
  | "bitter"
  | "intensity";

export type FlavorProfile = Record<FlavorKey, number>;

export type PrepId =
  | "wash"
  | "soak"
  | "dry"
  | "cut-small"
  | "cut-large"
  | "blanch"
  | "marinate"
  | "starch-coat";

export type HeatMethod =
  | "stir-fry"
  | "pan-fry"
  | "shallow-fry"
  | "boil"
  | "blanch"
  | "steam"
  | "braise"
  | "reduce"
  | "rest";

export type HeatLevel = "low" | "medium" | "high";
export type StirIntensity = "none" | "gentle" | "frequent";

export type SeasoningId =
  | "oil"
  | "salt"
  | "light-soy"
  | "dark-soy"
  | "vinegar"
  | "sugar"
  | "wine"
  | "water"
  | "starch"
  | "chili"
  | "oyster-sauce"
  | "fish-sauce"
  | "rice-vinegar"
  | "aged-vinegar"
  | "lemon-juice"
  | "rock-sugar"
  | "honey"
  | "star-anise"
  | "cinnamon"
  | "bay-leaf"
  | "sichuan-pepper"
  | "dried-chili"
  | "white-pepper"
  | "black-pepper"
  | "fennel"
  | "cumin"
  | "soybean-oil"
  | "rapeseed-oil"
  | "peanut-oil"
  | "sesame-oil"
  | "lard"
  | "doubanjiang"
  | "sweet-bean-sauce"
  | "douchi"
  | "chicken-bouillon"
  | "msg";

export type SeasoningEffectType =
  | "salt"
  | "soy"
  | "oil"
  | "acid"
  | "sugar"
  | "wine"
  | "aroma"
  | "heat"
  | "starch"
  | "water"
  | "paste"
  | "umami";

export type IngredientArchetype =
  | "leafy"
  | "melon"
  | "root"
  | "mushroom"
  | "soy-product"
  | "red-meat"
  | "poultry"
  | "seafood"
  | "egg"
  | "staple";

export type AmountLevel = "little" | "moderate" | "lot";

export interface AmountInput {
  level: AmountLevel;
  precise: boolean;
  value?: number;
  unit?: "g" | "ml";
}

export interface PrepAction {
  type: "prep";
  prepId: PrepId;
}

export interface HeatAction {
  type: "heat";
  method: HeatMethod;
  heatLevel: HeatLevel;
  targetTemperature: number;
  durationMin: number;
  lidCovered?: boolean;
  stirIntensity?: StirIntensity;
}

export interface SeasonAction {
  type: "season";
  seasoningId: SeasoningId;
  amount: AmountInput;
}

export interface OperationAction {
  type: "operation";
  operationId: string;
}

export type KitchenAction =
  | PrepAction
  | HeatAction
  | SeasonAction
  | OperationAction;

export type LabAction = HeatAction | SeasonAction | OperationAction;

export interface FoodProperties {
  moisture: number;
  surfaceArea: number;
  tenderness: number;
  crispness: number;
  oiliness: number;
  sauceCoating: number;
  browning: number;
  cookedness: number;
  temperature: number;
  acidity: number;
  saltiness: number;
  sweetness: number;
  umami: number;
  spiciness: number;
  bitterness: number;
  aroma: number;
  offAroma: number;
  starchGelatinization: number;
  enzymeActivity: number;
  surfaceMoisture: number;
  saltLoad: number;
  ph: number;
  proteinCoagulation: number;
  starchHydration: number;
  oxidation: number;
  shapeIntegrity: number;
  heatPenetration: number;
}

export interface Appearance {
  color: string;
  label: string;
  gloss: number;
}

export interface SimulationEvent {
  id: string;
  action: string;
  category: ScienceKind;
  title: string;
  description: string;
  effects: string[];
}

export interface StateDigest {
  moisture: string;
  surface: string;
  texture: string;
  flavor: string;
  color: string;
}

export interface CausalEvent extends SimulationEvent {
  principleTags: PrincipleTag[];
  before: StateDigest;
  after: StateDigest;
  transfer: string;
}

export interface IngredientState {
  ingredientId: string;
  properties: FoodProperties;
  flavor: FlavorProfile;
  appearance: Appearance;
  flags: string[];
  events: CausalEvent[];
  warnings: string[];
  actionCount: number;
}

export interface GuideItem {
  title: string;
  detail: string;
}

export interface IngredientSensitivities {
  osmosis: number;
  acid: number;
  oxidation: number;
  mechanical: number;
  surfaceDrying: number;
  protein: number;
  starch: number;
}

export interface IngredientDefinition {
  id: string;
  name: string;
  englishName: string;
  category: string;
  archetype: IngredientArchetype;
  tagline: string;
  description: string;
  art: "greens" | "potato" | "egg" | "tomato" | "tofu" | "beef" | "pork" | "fish";
  palette: {
    main: string;
    soft: string;
    accent: string;
  };
  initialProperties: FoodProperties;
  baseFlavor: FlavorProfile;
  appearance: Appearance;
  keyProperties: string[];
  prepGuide: GuideItem[];
  heatBehavior: string;
  seasoningStrategy: string;
  commonMistakes: string[];
  safety: string;
  safeCookedness: number;
  heatSensitivity: number;
  browningTendency: number;
  starchiness: number;
  protein: number;
  fat: number;
  sensitivities: IngredientSensitivities;
}

export interface PrincipleDefinition {
  id: string;
  name: string;
  eyebrow: string;
  accent: string;
  summary: string;
  useWhen: string;
  timing: string;
  excess: string;
  myth: string;
  mechanismKind: ScienceKind;
  mechanismTitle: string;
  mechanism: string;
  source: string;
}

export interface SeasoningDefinition {
  id: SeasoningId;
  name: string;
  shortName: string;
  unit: "g" | "ml";
  family: "基础咸味" | "酸味" | "甜味" | "香辛料" | "油脂类" | "辅助类" | "水";
  description: string;
  effectType: SeasoningEffectType;
}

export interface TreatmentDefinition {
  id: string;
  name: string;
  shortName: string;
  category: TreatmentCategory;
  purpose: string;
  timing: string;
  principleTags: PrincipleTag[];
  ingredientIds?: string[];
  archetypes?: IngredientArchetype[];
  mode: "instant" | "duration" | "controlled";
  controlOptions?: string[];
}

export interface OutcomeGoalDefinition {
  id: OutcomeGoal;
  name: string;
  description: string;
  principleTags: PrincipleTag[];
  variables: string[];
}

export interface ExperimentSnapshot {
  version: 2;
  id: string;
  name: string;
  ingredientId: string;
  actions: KitchenAction[];
  state: IngredientState;
  createdAt: string;
  branchGroupId?: string;
  branchLabel?: string;
  dishName?: string;
  goal?: OutcomeGoal;
  partnerId?: GuidePartnerId;
}

export interface LegacyExperimentSnapshot
  extends Omit<ExperimentSnapshot, "version" | "state"> {
  version: 1;
  state: Omit<IngredientState, "events"> & {
    events: SimulationEvent[];
  };
}

export interface ExperimentBranch {
  id: "A" | "B";
  label: string;
  ingredientId: string;
  state: IngredientState;
  history: IngredientState[];
  actions: KitchenAction[];
  branchGroupId: string;
  workspace?: KitchenWorkspace;
}

export type GuidePartnerId = "xiaoyan" | "zhiwei" | "axian";

export type GuideMode = "flow" | "chat";

export type GuidedPhase =
  | "partner"
  | "ingredient"
  | "prepare"
  | "pan"
  | "cook"
  | "plate"
  | "recap";

export interface GuidePartnerDefinition {
  id: GuidePartnerId;
  name: string;
  role: string;
  tagline: string;
  greeting: string;
  focus: string;
  accent: string;
  tone: string;
}

export interface DishProfile {
  ingredientId: string;
  dishName: string;
  requiredPreparationIds: string[];
  optionalPreparationIds: string[];
  safetyCookedness: number;
  preferredMethods: HeatMethod[];
  targetTemperature: number;
  notes: string[];
}

export interface DishCompletionCheck {
  id: string;
  label: string;
  detail: string;
  passed: boolean;
  required: boolean;
}

export interface DishCompletionResult {
  canPlate: boolean;
  checks: DishCompletionCheck[];
  missing: string[];
}

export interface DishRecap {
  dishName: string;
  summary: string;
  mechanisms: { title: string; detail: string; transfer: string }[];
  flavorSummary: string;
  textureSummary: string;
  safety: string;
}

export interface GuideMessage {
  id: string;
  role: "partner" | "user";
  text: string;
  source?: "flow" | "local" | "llm";
  createdAt: string;
}

export interface GuideRequest {
  partnerId: GuidePartnerId;
  question: string;
  context: {
    ingredientId?: string;
    goal?: OutcomeGoal | null;
    phase: GuidedPhase;
    temperature?: number;
    cookedness?: number;
    surfaceMoisture?: number;
    saltLoad?: number;
    recentEvents: string[];
    allowedOperationIds: string[];
  };
}

export interface GuideResponse {
  answer: string;
  citations: { id: string; title: string }[];
  provider: "llm" | "local";
}

export interface GuidedCookSession {
  version: 1;
  partnerId: GuidePartnerId | null;
  ingredientId: string | null;
  goal: OutcomeGoal | null;
  phase: GuidedPhase;
  state: IngredientState | null;
  history: IngredientState[];
  actions: KitchenAction[];
  workspace: KitchenWorkspace;
  createdAt: string;
  updatedAt: string;
}
