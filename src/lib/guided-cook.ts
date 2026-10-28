import { foodFormFromState } from "./feedback";
import { getIngredient, ingredients } from "./ingredients";
import { planKitchenTasks } from "./kitchen-tasks";
import { createInitialState } from "./simulator";
import {
  outcomeGoals,
  principleTagLabels,
  treatmentsForIngredient,
} from "./treatments";
import type {
  DishCompletionCheck,
  DishCompletionResult,
  DishProfile,
  DishRecap,
  GuideMode,
  GuidePartnerDefinition,
  GuidePartnerId,
  GuidedCookSession,
  GuidedPhase,
  HeatMethod,
  IngredientState,
  KitchenAction,
  KitchenWorkspace,
  OutcomeGoal,
  PrincipleTag,
  TreatmentDefinition,
} from "./types";

export const guidedPhases: {
  id: GuidedPhase;
  label: string;
  shortLabel: string;
  description: string;
}[] = [
  {
    id: "partner",
    label: "选择伙伴",
    shortLabel: "伙伴",
    description: "选择这次陪你完成烹饪的指导伙伴。",
  },
  {
    id: "ingredient",
    label: "食材与目标",
    shortLabel: "食材",
    description: "由伙伴推荐食材，也可以打开完整食材库自由选择。",
  },
  {
    id: "prepare",
    label: "预处理",
    shortLabel: "处理",
    description: "完成清洗、切配和控水，再进入正式烹饪。",
  },
  {
    id: "pan",
    label: "下锅",
    shortLabel: "下锅",
    description: "先把食材送到炒锅；空锅不能点火。",
  },
  {
    id: "cook",
    label: "火候与调味",
    shortLabel: "烹饪",
    description: "选择加热方式、温度和调料，观察食材实时变化。",
  },
  {
    id: "plate",
    label: "装盘检查",
    shortLabel: "装盘",
    description: "确认安全和目标条件，再把成品送到岛台。",
  },
  {
    id: "recap",
    label: "原理复盘",
    shortLabel: "复盘",
    description: "回看这次烹饪真正改变了什么。",
  },
];

export const guidePartners: GuidePartnerDefinition[] = [
  {
    id: "xiaoyan",
    name: "小焰",
    role: "流程教练",
    tagline: "先处理，再开火",
    greeting:
      "我会盯着火候和操作顺序。别急着背步骤，先看锅里正在发生什么。",
    focus: "时机、顺序与火候判断",
    accent: "#c95438",
    tone: "明快、果断，提示当前最值得观察的变化。",
  },
  {
    id: "zhiwei",
    name: "知味",
    role: "原理讲师",
    tagline: "把现象说透",
    greeting:
      "每次操作都至少改变一个底层变量。你想知道哪一步为什么发生，尽管问我。",
    focus: "物理、化学与跨食材迁移",
    accent: "#386b57",
    tone: "耐心、清楚，优先解释因果链和迁移规律。",
  },
  {
    id: "axian",
    name: "阿鲜",
    role: "食材管家",
    tagline: "先看食材再下手",
    greeting:
      "同样的动作，不同食材结果完全不同。我会提醒你水分、纹理和食品安全边界。",
    focus: "食材性质、预处理与安全",
    accent: "#a87428",
    tone: "细致、稳妥，优先提醒食材差异和安全边界。",
  },
];

export const guidePartnerMap = new Map(
  guidePartners.map((partner) => [partner.id, partner]),
);

const recommendationsByGoal: Record<OutcomeGoal, string[]> = {
  crisper: ["greens", "potato", "fish"],
  tenderer: ["egg", "fish", "beef"],
  "more-seasoned": ["tofu", "potato", "beef"],
  "less-water": ["greens", "tofu", "fish"],
  "more-umami": ["tomato", "tofu", "beef"],
  "more-aromatic": ["potato", "pork", "fish"],
  "less-fishy": ["fish", "pork", "beef"],
  greener: ["greens", "potato", "egg"],
  "thicker-sauce": ["tomato", "potato", "tofu"],
  lighter: ["greens", "tofu", "fish"],
};

const methodPrefixes: Record<HeatMethod, string> = {
  "stir-fry": "快炒",
  "pan-fry": "香煎",
  "shallow-fry": "浅炸",
  boil: "水煮",
  blanch: "焯拌",
  steam: "清蒸",
  braise: "慢炖",
  reduce: "收汁",
  rest: "余温",
};

const methodTemperatures: Record<HeatMethod, number> = {
  "stir-fry": 190,
  "pan-fry": 180,
  "shallow-fry": 170,
  boil: 100,
  blanch: 100,
  steam: 100,
  braise: 95,
  reduce: 120,
  rest: 70,
};

const foodSafetyIngredients = new Set(["beef", "pork", "fish"]);

function emptyWorkspace(): KitchenWorkspace {
  return {
    station: "sink",
    sampleStation: "sink",
    inPan: false,
  };
}

export function createGuidedSession(): GuidedCookSession {
  const now = new Date().toISOString();
  return {
    version: 1,
    partnerId: null,
    ingredientId: null,
    goal: null,
    phase: "partner",
    state: null,
    history: [],
    actions: [],
    workspace: emptyWorkspace(),
    createdAt: now,
    updatedAt: now,
  };
}

export function selectGuidedPartner(
  session: GuidedCookSession,
  partnerId: GuidePartnerId,
): GuidedCookSession {
  return {
    ...session,
    partnerId,
    phase: "ingredient",
    updatedAt: new Date().toISOString(),
  };
}

export function startGuidedIngredient(
  session: GuidedCookSession,
  ingredientId: string,
  goal: OutcomeGoal | null,
): GuidedCookSession {
  if (!ingredients.some((ingredient) => ingredient.id === ingredientId)) {
    throw new Error(`Unknown ingredient: ${ingredientId}`);
  }
  return {
    ...session,
    ingredientId,
    goal,
    phase: "prepare",
    state: createInitialState(ingredientId),
    history: [],
    actions: [],
    workspace: {
      station: "sink",
      sampleStation: "sink",
      inPan: false,
      session: undefined,
      heatStartState: undefined,
    },
    updatedAt: new Date().toISOString(),
  };
}

export function recommendedIngredientIds(
  goal: OutcomeGoal | null,
): string[] {
  return goal ? recommendationsByGoal[goal] : ["potato", "greens", "egg"];
}

export function currentMethod(
  actions: KitchenAction[],
): HeatMethod | null {
  return [...actions]
    .reverse()
    .find((action) => action.type === "heat")?.method ?? null;
}

export function guidedDishProfile(
  ingredientId: string,
  goal: OutcomeGoal | null,
  actions: KitchenAction[] = [],
): DishProfile {
  const ingredient = getIngredient(ingredientId);
  const method = currentMethod(actions) ?? "stir-fry";
  const tasks = planKitchenTasks(ingredientId, actions, emptyWorkspace());
  const availableOperations = treatmentsForIngredient(ingredientId);
  const availableIds = new Set(
    availableOperations.map((operation) => operation.id),
  );
  const taskOperationIds = tasks
    .slice(0, 3)
    .map((task) => task.operationId)
    .filter((id): id is string => Boolean(id));
  const dryRequired =
    foodSafetyIngredients.has(ingredient.id) ||
    goal === "crisper" ||
    goal === "less-water" ||
    goal === "more-aromatic";
  const washOperation =
    tasks[0].operationId && availableIds.has(tasks[0].operationId)
      ? tasks[0].operationId
      : availableOperations.find((operation) =>
          ["wash", "soak"].includes(operation.id),
        )?.id;
  const cutOperation =
    tasks[1].operationId && availableIds.has(tasks[1].operationId)
      ? tasks[1].operationId
      : availableOperations.find(
          (operation) =>
            operation.principleTags.includes("surface-area") ||
            operation.principleTags.includes("mechanical-structure"),
        )?.id;
  const dryOperation =
    tasks[2].operationId && availableIds.has(tasks[2].operationId)
      ? tasks[2].operationId
      : availableOperations.find(
          (operation) =>
            operation.category === "water-salt" &&
            operation.principleTags.includes("surface-moisture") &&
            (operation.id.includes("dry") ||
              operation.name.includes("控水") ||
              operation.name.includes("擦干") ||
              operation.name.includes("甩干")),
        )?.id;

  return {
    ingredientId,
    dishName: `${methodPrefixes[method]}${ingredient.name}`,
    requiredPreparationIds: [
      washOperation ?? "wash",
      cutOperation ?? "cut-large",
      ...(dryRequired ? [dryOperation ?? "surface-dry"] : []),
    ].filter((id): id is string => Boolean(id)),
    optionalPreparationIds: [
      ...(dryRequired ? [] : [dryOperation ?? "surface-dry"]),
      ...taskOperationIds.filter(
        (id) =>
          id !== tasks[0].operationId &&
          id !== tasks[1].operationId &&
          id !== tasks[2].operationId,
      ),
    ],
    safetyCookedness: ingredient.safeCookedness,
    preferredMethods:
      ingredient.archetype === "egg"
        ? ["pan-fry", "stir-fry", "steam"]
        : foodSafetyIngredients.has(ingredient.id)
          ? ["pan-fry", "stir-fry", "steam", "braise"]
          : ["stir-fry", "pan-fry", "boil", "steam"],
    targetTemperature:
      ingredient.archetype === "egg" ? 150 : methodTemperatures[method],
    notes: [
      ingredient.heatBehavior,
      ingredient.seasoningStrategy,
    ],
  };
}

function taskCheck(
  id: string,
  label: string,
  detail: string,
  passed: boolean,
  required: boolean,
): DishCompletionCheck {
  return { id, label, detail, passed, required };
}

export function preparationChecks(
  ingredientId: string,
  actions: KitchenAction[],
  workspace: KitchenWorkspace,
  goal: OutcomeGoal | null,
): DishCompletionCheck[] {
  const ingredient = getIngredient(ingredientId);
  const tasks = planKitchenTasks(ingredientId, actions, workspace);
  const washRequired = !["egg", "soy-product", "staple"].includes(
    ingredient.archetype,
  );
  const dryRequired =
    foodSafetyIngredients.has(ingredientId) ||
    goal === "crisper" ||
    goal === "less-water" ||
    goal === "more-aromatic";
  return [
    taskCheck(
      "wash",
      "清洗",
      washRequired ? "去除表面泥沙和杂质。" : "该食材可以不冲洗，按实际包装处理。",
      !washRequired || tasks[0].completed,
      washRequired,
    ),
    taskCheck(
      "prepare",
      "切配或整理",
      tasks[1].description,
      tasks[1].completed,
      true,
    ),
    taskCheck(
      "dry",
      "控制表面水分",
      dryRequired
        ? "肉类、水产或煎香目标需要先降低表面水。"
        : "可选；若希望更香、更脆或少出水，再进行控水。",
      tasks[2].completed,
      dryRequired,
    ),
  ];
}

export function preparationComplete(
  ingredientId: string,
  actions: KitchenAction[],
  workspace: KitchenWorkspace,
  goal: OutcomeGoal | null,
): boolean {
  return preparationChecks(
    ingredientId,
    actions,
    workspace,
    goal,
  ).every((check) => !check.required || check.passed);
}

export function guidedOperations(
  ingredientId: string,
  actions: KitchenAction[],
  workspace: KitchenWorkspace,
  goal: OutcomeGoal | null,
): { common: TreatmentDefinition[]; more: TreatmentDefinition[] } {
  const tasks = planKitchenTasks(ingredientId, actions, workspace);
  const taskIds = new Set(
    tasks
      .slice(0, 3)
      .map((task) => task.operationId)
      .filter((id): id is string => Boolean(id)),
  );
  const goalTags =
    outcomeGoals.find((item) => item.id === goal)?.principleTags ?? [];
  const available = treatmentsForIngredient(ingredientId).filter(
    (treatment) =>
      treatment.category !== "universal" ||
      ["wash", "soak", "surface-dry", "cut-small", "cut-large"].includes(
        treatment.id,
      ),
  );
  const rank = (treatment: TreatmentDefinition) => {
    let score = 0;
    if (taskIds.has(treatment.id)) score += 100;
    score += treatment.principleTags.filter((tag) =>
      goalTags.includes(tag),
    ).length * 10;
    return score;
  };
  const sorted = [...available].sort((a, b) => rank(b) - rank(a));
  const common = sorted.filter(
    (treatment, index) => taskIds.has(treatment.id) || (goalTags.length > 0 && index < 5),
  );
  const commonIds = new Set(common.map((item) => item.id));
  return {
    common: (common.length > 0 ? common : sorted.slice(0, 3)).slice(0, 5),
    more: sorted.filter((item) => !commonIds.has(item.id)),
  };
}

export function dishCompletion(
  ingredientId: string,
  state: IngredientState,
  actions: KitchenAction[],
  workspace: KitchenWorkspace,
  goal: OutcomeGoal | null,
): DishCompletionResult {
  const ingredient = getIngredient(ingredientId);
  const prepChecks = preparationChecks(
    ingredientId,
    actions,
    workspace,
    goal,
  );
  const hasHeat = actions.some((action) => action.type === "heat");
  const cookedEnough =
    state.properties.cookedness >= ingredient.safeCookedness;
  const stopped = !workspace.session?.isHeating;
  const safetyWarning =
    foodSafetyIngredients.has(ingredientId) && !cookedEnough;
  const checks: DishCompletionCheck[] = [
    ...prepChecks,
    taskCheck(
      "heat",
      "完成受热",
      "至少完成一次加热，让温度和熟度开始累积。",
      hasHeat,
      true,
    ),
    taskCheck(
      "cooked",
      "达到安全熟度",
      `模拟熟度至少达到 ${ingredient.safeCookedness}。`,
      cookedEnough,
      true,
    ),
    taskCheck(
      "stopped",
      "已经关火",
      "装盘前先停止加热并观察余温。",
      stopped,
      true,
    ),
    taskCheck(
      "safety",
      "没有未解决的食品安全提醒",
      ingredient.safety,
      !safetyWarning,
      foodSafetyIngredients.has(ingredientId),
    ),
  ];
  const required = checks.filter((check) => check.required);
  return {
    canPlate: required.every((check) => check.passed),
    checks,
    missing: required
      .filter((check) => !check.passed)
      .map((check) => check.label),
  };
}

function strongestFlavor(state: IngredientState): string {
  const entries = [
    ["酸", state.flavor.sour],
    ["甜", state.flavor.sweet],
    ["咸", state.flavor.salty],
    ["鲜", state.flavor.umami],
    ["辣", state.flavor.spicy],
  ] as const;
  const [name, value] = entries.reduce((a, b) => (a[1] >= b[1] ? a : b));
  return value < 10 ? "整体清淡" : `${name}味较突出`;
}

export function buildDishRecap(
  ingredientId: string,
  state: IngredientState,
  actions: KitchenAction[],
  goal: OutcomeGoal | null,
): DishRecap {
  const ingredient = getIngredient(ingredientId);
  const profile = guidedDishProfile(ingredientId, goal, actions);
  const tags = Array.from(
    new Set(state.events.flatMap((event) => event.principleTags)),
  ).slice(-5);
  const fallbackTags: PrincipleTag[] = ["temperature", "time", "heat-transfer"];
  const mechanisms = (tags.length ? tags : fallbackTags).map((tag) => {
    const event = [...state.events]
      .reverse()
      .find((item) => item.principleTags.includes(tag));
    return {
      title: principleTagLabels[tag],
      detail:
        event?.description ??
        "这一步改变了热量、水分或组织结构，结果来自多个变量共同累积。",
      transfer:
        event?.transfer ??
        "换一种食材时，先判断它的水分、蛋白质或淀粉结构，再决定是否照搬。",
    };
  });
  return {
    dishName: profile.dishName,
    summary: `${ingredient.name}完成了 ${actions.length} 个操作。最终状态为“${state.appearance.label}”，${strongestFlavor(state)}。`,
    mechanisms,
    flavorSummary: strongestFlavor(state),
    textureSummary: `嫩度 ${Math.round(state.properties.tenderness)} · 脆度 ${Math.round(state.properties.crispness)} · 保形 ${Math.round(state.properties.shapeIntegrity)}`,
    safety: ingredient.safety,
  };
}

export function sceneForm(
  state: IngredientState | null,
  actions: KitchenAction[],
): ReturnType<typeof foodFormFromState> {
  return state
    ? foodFormFromState(state, actions.length)
    : "whole";
}

export function guideModeLabel(mode: GuideMode): string {
  return mode === "flow" ? "流程指导" : "交流对话";
}

export function guidedPhaseIndex(phase: GuidedPhase): number {
  return guidedPhases.findIndex((item) => item.id === phase);
}

export function guidedStepStatus(
  stepId: GuidedPhase,
  current: GuidedPhase,
): "completed" | "active" | "upcoming" {
  const stepIndex = guidedPhaseIndex(stepId);
  const currentIndex = guidedPhaseIndex(current);
  if (stepIndex < currentIndex || current === "recap") return "completed";
  return stepIndex === currentIndex ? "active" : "upcoming";
}

export function guidedFlowRecommendation(
  session: GuidedCookSession,
  prepChecks: DishCompletionCheck[],
  completion: DishCompletionResult,
): { title: string; reason: string; operationId?: string } {
  if (!session.partnerId) {
    return {
      title: "先选择一位指导伙伴",
      reason: "伙伴会在后续流程里陪同你判断食材、处理和火候。",
    };
  }
  if (!session.ingredientId || !session.state) {
    return {
      title: "先选一种食材",
      reason: session.goal
        ? "食材与当前目标会共同决定后续处理和火候。"
        : "可以在伙伴推荐里快速选择，也可以打开完整食材库。",
    };
  }
  if (session.phase === "prepare") {
    const next = prepChecks.find((check) => check.required && !check.passed);
    return {
      title: next ? next.label : "预处理已经完成",
      reason: next
        ? next.detail
        : "可以进入下锅阶段，先把食材送到炒锅区域。",
    };
  }
  if (session.phase === "pan") {
    return {
      title: "把食材放入炒锅",
      reason: "锅为空时不会允许点火；需要油时也可以先加少量食用油。",
    };
  }
  if (session.phase === "cook") {
    if (session.workspace.session?.isHeating) {
      const nearTarget =
        session.workspace.session.currentTemperature >=
        session.workspace.session.targetTemperature - 8;
      return {
        title: nearTarget ? "观察颜色并准备关火" : "继续观察温度与熟度",
        reason:
          "实时加热会持续累积变化。先看状态是否达到目标，再决定是否继续。",
      };
    }
    return {
      title: "选择火候，少量多次调味",
      reason:
        "表面水、温度和盐负荷会共同改变结果；每次只调整一个主要变量更容易看懂。",
    };
  }
  if (session.phase === "plate") {
    return {
      title: completion.canPlate ? "条件满足，可以装盘" : "还差一项完成条件",
      reason: completion.canPlate
        ? "装盘后会生成本轮的操作前后对比与原理复盘。"
        : completion.missing.join("、"),
    };
  }
  return {
    title: "回看这次烹饪",
    reason: "查看关键变化、机制解释和跨食材迁移方法。",
  };
}
