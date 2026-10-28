import { getIngredient } from "./ingredients";
import { applyAction, createInitialState } from "./simulator";
import {
  buildDishRecap,
  guidedDishProfile,
} from "./guided-cook";
import type {
  AIReactionEvent,
  CutStage,
  DishRecap,
  HeatBand,
  HoldInteractionKind,
  HoldInteractionState,
  IngredientState,
  KitchenAction,
  ThreeDTrainingSession,
  ThreeDGuideDefinition,
  ThreeDGuideId,
  TrainingGrade,
  TrainingRun,
} from "./types";

export const WASH_HOLD_MS = 2800;
export const CHOP_HOLD_MS = 4600;
export const CHOP_PAUSE_WARNING_MS = 3000;
export const DANGER_BURN_MS = 6000;

export const trainingGradeLabels: Record<TrainingGrade, string> = {
  perfect: "完美出锅",
  good: "良好出锅",
  ordinary: "普通出锅",
  burnt: "糊锅",
};

export const trainingGradeDescriptions: Record<TrainingGrade, string> = {
  perfect: "在最佳熟度窗口关火，食材与火候协调。",
  good: "已完成安全受热，但出锅窗口略有偏差。",
  ordinary: "料理已经熟制完成，仍有继续调整火候的空间。",
  burnt: "危险火候持续过久，本次食材报废。",
};

export const threeDGuides: ThreeDGuideDefinition[] = [
  {
    id: "orange",
    name: "夏小弥",
    role: "步骤与原理导师",
    tagline: "看状态、讲原因、帮你判断下一步",
    portrait: "/images/partners/orange-guide-concept.png",
    accent: "#a85d2d",
  },
  {
    id: "yellow",
    name: "奶龙",
    role: "体验与安全导师",
    tagline: "轻松试错，盯住火候和安全边界",
    portrait: "/images/partners/yellow-guide.jpg",
    accent: "#d8ad2f",
  },
];

export interface TrainingEvaluation {
  grade: TrainingGrade;
  title: string;
  reason: string;
  canServe: boolean;
}

export interface GuideReactionInput {
  phase: ThreeDTrainingSession["phase"];
  cleaned: boolean;
  chopProgress: number;
  chopPausedMs: number;
  heatBand: HeatBand;
  dangerMs: number;
  grade?: TrainingGrade | null;
  wrongStation?: "board" | "stove" | null;
}

export function createHoldInteraction(
  kind: HoldInteractionKind,
): HoldInteractionState {
  return {
    kind,
    progress: 0,
    active: false,
    completed: false,
    pausedMs: 0,
    lastDeltaMs: 0,
  };
}

export function advanceHoldInteraction(
  current: HoldInteractionState,
  held: boolean,
  deltaMs: number,
): HoldInteractionState {
  if (current.completed) {
    return { ...current, active: false, lastDeltaMs: deltaMs };
  }
  const duration = current.kind === "wash" ? WASH_HOLD_MS : CHOP_HOLD_MS;
  const safeDelta = Math.max(0, Math.min(deltaMs, 100));
  const nextProgress = held
    ? Math.min(100, current.progress + (safeDelta / duration) * 100)
    : current.progress;
  const pausedMs =
    !held && current.progress > 0 && current.progress < 100
      ? current.pausedMs + safeDelta
      : held
        ? 0
        : current.pausedMs;
  return {
    ...current,
    progress: nextProgress,
    active: held,
    completed: nextProgress >= 100,
    pausedMs,
    lastDeltaMs: safeDelta,
  };
}

export function cutStageFor(progress: number): CutStage {
  if (progress >= 100) return "cut";
  if (progress >= 60) return "strips";
  if (progress >= 30) return "scored";
  return "whole";
}

export function heatBandFor(
  cookedness: number,
  safetyCookedness: number,
  dangerMs = 0,
): HeatBand {
  if (dangerMs >= DANGER_BURN_MS) return "burnt";
  const safe = safetyCookedness;
  if (cookedness >= safe + 8) return "danger";
  if (cookedness >= safe) return "perfect";
  if (cookedness >= Math.max(0, safe - 12)) return "yellow";
  return cookedness > 0 ? "green" : "idle";
}

export function createThreeDSession(
  guideId: ThreeDGuideId = "orange",
): ThreeDTrainingSession {
  const now = new Date().toISOString();
  return {
    version: 1,
    guideId,
    phase: "intro",
    ingredientId: null,
    state: null,
    actions: [],
    stationState: {
      cleaned: false,
      chopped: false,
      oilAdded: false,
      heating: false,
      heatBand: "idle",
      dangerMs: 0,
      washProgress: 0,
      chopProgress: 0,
    },
    startedAt: now,
    updatedAt: now,
  };
}

export function startThreeDIngredient(
  session: ThreeDTrainingSession,
  ingredientId: string,
): ThreeDTrainingSession {
  getIngredient(ingredientId);
  return {
    ...session,
    phase: "wash",
    ingredientId,
    state: createInitialState(ingredientId),
    actions: [],
    stationState: {
      cleaned: false,
      chopped: false,
      oilAdded: false,
      heating: false,
      heatBand: "idle",
      dangerMs: 0,
      washProgress: 0,
      chopProgress: 0,
    },
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function completeWash(
  session: ThreeDTrainingSession,
): ThreeDTrainingSession {
  if (!session.state || !session.ingredientId) return session;
  const profile = guidedDishProfile(session.ingredientId, null);
  const washId = profile.requiredPreparationIds[0] ?? "wash";
  const action: KitchenAction = {
    type: "operation",
    operationId: washId,
  };
  return {
    ...session,
    phase: "chop",
    state: applyAction(session.state, action),
    actions: [...session.actions, action],
    stationState: {
      ...session.stationState,
      cleaned: true,
      washProgress: 100,
    },
    updatedAt: new Date().toISOString(),
  };
}

export function completeChop(
  session: ThreeDTrainingSession,
): ThreeDTrainingSession {
  if (!session.state || !session.ingredientId) return session;
  const profile = guidedDishProfile(
    session.ingredientId,
    null,
    session.actions,
  );
  const cutId = profile.requiredPreparationIds[1] ?? "cut-large";
  const action: KitchenAction = {
    type: "operation",
    operationId: cutId,
  };
  return {
    ...session,
    phase: "cook",
    state: applyAction(session.state, action),
    actions: [...session.actions, action],
    stationState: {
      ...session.stationState,
      chopped: true,
      chopProgress: 100,
    },
    updatedAt: new Date().toISOString(),
  };
}

export function addThreeDOil(
  session: ThreeDTrainingSession,
): ThreeDTrainingSession {
  if (!session.state || session.stationState.oilAdded) return session;
  const action: KitchenAction = {
    type: "season",
    seasoningId: "oil",
    amount: { level: "little", precise: false },
  };
  return {
    ...session,
    state: applyAction(session.state, action),
    actions: [...session.actions, action],
    stationState: {
      ...session.stationState,
      oilAdded: true,
    },
    updatedAt: new Date().toISOString(),
  };
}

export function evaluateTrainingResult(
  state: IngredientState,
  safetyCookedness: number,
  band: HeatBand,
  dangerMs: number,
  criticalSafetyIssue = false,
): TrainingEvaluation {
  if (band === "burnt" || dangerMs >= DANGER_BURN_MS) {
    return {
      grade: "burnt",
      title: trainingGradeLabels.burnt,
      reason: "食材在危险火候区停留过久，本次训练需要重新取食材。",
      canServe: false,
    };
  }
  if (
    band === "perfect" &&
    state.properties.cookedness >= safetyCookedness &&
    !criticalSafetyIssue
  ) {
    return {
      grade: "perfect",
      title: trainingGradeLabels.perfect,
      reason: "在最佳熟度窗口关火，安全熟度与目标火候同时满足。",
      canServe: true,
    };
  }
  if (band === "danger") {
    return {
      grade: "ordinary",
      title: trainingGradeLabels.ordinary,
      reason: "已经越过最佳窗口但尚未糊锅，风味和水分开始下降。",
      canServe: !criticalSafetyIssue,
    };
  }
  if (state.properties.cookedness >= Math.max(0, safetyCookedness - 5)) {
    return {
      grade: "good",
      title: trainingGradeLabels.good,
      reason: "已经完成安全受热，但关火点与最佳窗口略有偏差。",
      canServe: true,
    };
  }
  if (state.properties.cookedness >= safetyCookedness * 0.75) {
    return {
      grade: "ordinary",
      title: trainingGradeLabels.ordinary,
      reason: "食材已经明显受热，但仍未达到建议的安全熟度。",
      canServe: !criticalSafetyIssue,
    };
  }
  return {
    grade: "ordinary",
    title: "仍需继续加热",
    reason: "当前熟度不足，需要返回灶台继续受热。",
    canServe: false,
  };
}

export function nextGuideReaction(
  input: GuideReactionInput,
): AIReactionEvent | null {
  const now = new Date().toISOString();
  if (input.grade === "burnt") {
    return {
      id: "reaction-burnt",
      trigger: "burnt",
      message: "已经进入糊锅区，先重新取一份食材。下一次盯住深绿窗口并提前关火。",
      tone: "danger",
      createdAt: now,
    };
  }
  if (input.heatBand === "danger") {
    return {
      id: "reaction-danger",
      trigger: "heat-danger",
      message: `危险火候已持续 ${(input.dangerMs / 1000).toFixed(1)} 秒，立即关火。`,
      tone: "danger",
      createdAt: now,
    };
  }
  if (input.wrongStation === "board" && !input.cleaned) {
    return {
      id: "reaction-wash",
      trigger: "wash-needed",
      message: "食材还没有清洗，先去右侧水槽按住交互键完成清洗。",
      tone: "warning",
      createdAt: now,
    };
  }
  if (
    input.phase === "chop" &&
    input.chopProgress > 0 &&
    input.chopProgress < 100 &&
    input.chopPausedMs >= CHOP_PAUSE_WARNING_MS
  ) {
    return {
      id: "reaction-chop",
      trigger: "chop-paused",
      message: "切配进度会保留。回到砧板继续按住，不要用一次点击直接完成。",
      tone: "warning",
      createdAt: now,
    };
  }
  if (input.heatBand === "yellow") {
    return {
      id: "reaction-yellow",
      trigger: "heat-yellow",
      message: "接近安全熟度，开始观察颜色和水分，准备进入最佳窗口。",
      tone: "neutral",
      createdAt: now,
    };
  }
  if (input.heatBand === "perfect") {
    return {
      id: "reaction-perfect",
      trigger: "heat-perfect",
      message: "现在处于最佳出锅窗口，可以关火并利用余温完成最后变化。",
      tone: "good",
      createdAt: now,
    };
  }
  if (input.grade === "perfect" || input.grade === "good") {
    return {
      id: "reaction-complete",
      trigger: "complete",
      message:
        input.grade === "perfect"
          ? "这次火候判断很准。记住安全熟度线与深绿窗口之间的关系。"
          : "结果可以食用，但下次可以更早进入最佳窗口，减少水分继续流失。",
      tone: "good",
      createdAt: now,
    };
  }
  return null;
}

export function buildThreeDRecap(
  session: ThreeDTrainingSession,
  grade: TrainingGrade,
): DishRecap {
  if (!session.ingredientId || !session.state) {
    throw new Error("Training recap requires an ingredient state");
  }
  const recap = buildDishRecap(
    session.ingredientId,
    session.state,
    session.actions,
    "more-aromatic",
  );
  return {
    ...recap,
    summary: `${trainingGradeLabels[grade]}。${trainingGradeDescriptions[grade]} ${recap.summary}`,
  };
}

export function createTrainingRun(
  session: ThreeDTrainingSession,
  grade: TrainingGrade,
  durationSeconds: number,
): TrainingRun {
  if (!session.ingredientId || !session.state) {
    throw new Error("Training result requires an ingredient");
  }
  const profile = guidedDishProfile(
    session.ingredientId,
    "more-aromatic",
    session.actions,
  );
  const runKey =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `run-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    runKey,
    ingredientId: session.ingredientId,
    dishName: profile.dishName,
    grade,
    cookedness: session.state.properties.cookedness,
    durationSeconds: Math.max(1, Math.round(durationSeconds)),
    summary: {
      washed: session.stationState.cleaned,
      chopped: session.stationState.chopped,
      oilAdded: session.stationState.oilAdded,
      peakTemperature: session.state.properties.temperature,
      dangerMs: session.stationState.dangerMs,
      actionCount: session.actions.length,
    },
    createdAt: new Date().toISOString(),
    synced: false,
  };
}
