import type {
  AmountLevel,
  HeatLevel,
  HeatMethod,
  SeasoningId,
} from "./types";

export type RecipeCategory =
  | "素菜"
  | "畜肉"
  | "禽肉"
  | "水产"
  | "豆制品"
  | "汤羹"
  | "主食";

export type RecipeIngredientRole = "main" | "supporting" | "seasoning";

export type RecipeVariableKind =
  | "timing"
  | "salt"
  | "acid"
  | "sugar"
  | "heat"
  | "duration"
  | "method";

export interface RecipeChoiceEffect {
  temperature?: number;
  duration?: number;
  salt?: number;
  acid?: number;
  sugar?: number;
  umami?: number;
  water?: number;
  tenderness?: number;
  crispness?: number;
  color?: number;
  aroma?: number;
  safety?: number;
}

export interface RecipeSimulationPatch {
  seasoningId?: SeasoningId;
  amountLevel?: AmountLevel;
  heatLevel?: HeatLevel;
  heatMethod?: HeatMethod;
  timing?: "early" | "during" | "late";
  durationMin?: number;
}

export type RecipeRiskLevel = "none" | "quality" | "safety";

export interface RecipeVariableOption {
  id: string;
  label: string;
  risk: RecipeRiskLevel;
  effect: RecipeChoiceEffect;
  simulation?: RecipeSimulationPatch;
  warning?: string;
  knowledge?: string;
}

export interface RecipeVariableGroup {
  id: string;
  label: string;
  kind: RecipeVariableKind;
  defaultOptionId: string;
  options: RecipeVariableOption[];
}

export interface RecipeIngredientRef {
  name: string;
  role: RecipeIngredientRole;
  ingredientId?: string;
  seasoningId?: SeasoningId;
  modifierId?: "garlic" | "scallion" | "ginger";
}

export interface RecipeStep {
  stepId: number;
  title: string;
  description: string;
  actionLabel: string;
  knowledge: string;
  aiWarning: string;
  variableGroups: RecipeVariableGroup[];
}

export interface RecipeSafetyNote {
  title: string;
  detail: string;
}

export interface RecipeDefinition {
  id: number;
  slug: string;
  name: string;
  category: RecipeCategory;
  summary: string;
  ingredients: RecipeIngredientRef[];
  steps: RecipeStep[];
  safetyNotes: RecipeSafetyNote[];
  source: "provided" | "generated";
}

export type RecipeStepStatus = "passed" | "adjusted";

export interface RecipeStepRecord {
  stepId: number;
  status: RecipeStepStatus;
  attempts: number;
  safetyCorrections: number;
  choices: Record<string, string>;
  warnings: string[];
  completedAt: string;
}

export type RecipeTrainingEventType =
  | "safety-blocked"
  | "step-completed";

export interface RecipeTrainingEvent {
  id: string;
  type: RecipeTrainingEventType;
  stepIndex: number;
  message: string;
  choiceSignature: string;
  createdAt: string;
}

export interface RecipeSession {
  version: 2;
  recipeId: number;
  stepIndex: number;
  selectedChoices: Record<string, string>;
  completedSteps: number[];
  stepRecords: RecipeStepRecord[];
  trainingEvents: RecipeTrainingEvent[];
  startedAt: string;
  updatedAt: string;
}

export interface RecipeStepEvaluation {
  stepIndex: number;
  status: "standard" | "quality" | "safety";
  canAdvance: boolean;
  warnings: string[];
  knowledge: string[];
  suggestions: string[];
  affectedGroups: string[];
}

export interface RecipeStepSubmission {
  session: RecipeSession;
  evaluation: RecipeStepEvaluation;
  advanced: boolean;
}

export interface RecipeMetrics {
  flavor: number;
  texture: number;
  color: number;
  aroma: number;
  water: number;
  safety: number;
}

export interface RecipeEvaluation {
  verdict: "达标" | "需要调整";
  summary: string;
  metrics: RecipeMetrics;
  warnings: string[];
  highlights: string[];
  safety: string;
  deviations: string[];
  corrections: number;
}

export interface RecipeGuideSelectedVariable {
  groupId: string;
  groupLabel: string;
  optionLabel: string;
  risk: RecipeRiskLevel;
  warning?: string;
}

export interface RecipeGuideRequest {
  mode: "recipe";
  question: string;
  context: {
    recipeId: number;
    recipeName: string;
    stepIndex: number;
    stepTitle: string;
    description: string;
    knowledge: string;
    aiWarning: string;
    selectedVariables: RecipeGuideSelectedVariable[];
    metrics: RecipeMetrics;
    safetyNotes: string[];
    completedSteps: number;
    deviations: string[];
    corrections: number;
  };
}

export interface RecipeGuideResponse {
  answer: string;
  citations: { id: string; title: string }[];
  provider: "llm" | "local";
}
