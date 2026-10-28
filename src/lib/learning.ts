import type {
  ExperimentBranch,
  IngredientState,
  KitchenAction,
  PredictionKind,
} from "./types";

const differs = (before: number, after: number, threshold = 2) =>
  Math.abs(after - before) >= threshold;

export function detectPredictedChanges(
  before: IngredientState,
  after: IngredientState,
): PredictionKind[] {
  const observed: PredictionKind[] = [];
  const a = before.properties;
  const b = after.properties;

  if (differs(a.crispness, b.crispness)) observed.push("crisper");
  if (differs(a.tenderness, b.tenderness)) observed.push("tenderer");
  if (differs(a.moisture, b.moisture) && b.moisture < a.moisture) {
    observed.push("drier");
  }
  if (differs(a.browning, b.browning, 3)) observed.push("browner");
  if (
    differs(before.flavor.salty, after.flavor.salty, 1) ||
    differs(before.flavor.umami, after.flavor.umami, 2)
  ) {
    observed.push("more-seasoned");
  }
  if (differs(a.aroma, b.aroma, 2)) observed.push("more-aromatic");
  if (differs(a.offAroma, b.offAroma) && b.offAroma < a.offAroma) {
    observed.push("less-off-aroma");
  }
  if (differs(a.sauceCoating, b.sauceCoating, 2)) {
    observed.push("more-coating");
  }
  if (before.appearance.color !== after.appearance.color) {
    observed.push("color-change");
  }
  return observed;
}

export function comparePrediction(
  predictions: PredictionKind[],
  observed: PredictionKind[],
) {
  return {
    matched: predictions.filter((item) => observed.includes(item)),
    missed: predictions.filter((item) => !observed.includes(item)),
    unexpected: observed.filter((item) => !predictions.includes(item)),
  };
}

function changedVariableCount(a: KitchenAction, b: KitchenAction): number {
  if (a.type !== b.type) return 99;
  if (a.type === "operation" && b.type === "operation") {
    return a.operationId === b.operationId ? 0 : 1;
  }
  if (a.type === "prep" && b.type === "prep") {
    return a.prepId === b.prepId ? 0 : 1;
  }
  if (a.type === "season" && b.type === "season") {
    if (a.seasoningId !== b.seasoningId) return 1;
    return a.amount.level === b.amount.level &&
      a.amount.value === b.amount.value
      ? 0
      : 1;
  }
  if (a.type === "heat" && b.type === "heat") {
    return [
      a.method !== b.method,
      a.heatLevel !== b.heatLevel,
      a.targetTemperature !== b.targetTemperature,
      Math.abs(a.durationMin - b.durationMin) > 0.25,
      (a.lidCovered ?? false) !== (b.lidCovered ?? false),
      (a.stirIntensity ?? "none") !== (b.stirIntensity ?? "none"),
    ].filter(Boolean).length;
  }
  return 99;
}

export function compareBranchActions(
  branchA: ExperimentBranch,
  branchB: ExperimentBranch,
) {
  const max = Math.max(branchA.actions.length, branchB.actions.length);
  const differentSteps: number[] = [];
  let changedVariables = 0;
  for (let index = 0; index < max; index += 1) {
    const left = branchA.actions[index];
    const right = branchB.actions[index];
    if (!left || !right) {
      differentSteps.push(index + 1);
      changedVariables += 99;
    } else {
      const count = changedVariableCount(left, right);
      if (count > 0) differentSteps.push(index + 1);
      changedVariables += count;
    }
  }

  const firstDifferent =
    differentSteps.length > 0
      ? {
          step: differentSteps[0],
          a: branchA.actions[differentSteps[0] - 1],
          b: branchB.actions[differentSteps[0] - 1],
        }
      : null;
  return {
    differentSteps,
    firstDifferent,
    differenceCount: differentSteps.length,
    isSingleVariable:
      differentSteps.length === 1 &&
      branchA.actions.length === branchB.actions.length &&
      changedVariables === 1,
    description:
      branchA.actions.length === 0 && branchB.actions.length === 0
        ? "两个分支还没有操作。"
        : differentSteps.length === 0
          ? "两条分支目前操作相同。"
          : differentSteps.length === 1 && changedVariables === 1
            ? `第 ${differentSteps[0]} 步只改变了一个变量。`
            : "两条分支存在多个或后续连续差异，暂时不能只归因于一个变量。",
  };
}

export function stateDelta(a: IngredientState, b: IngredientState) {
  return {
    moisture: Math.round(b.properties.moisture - a.properties.moisture),
    surfaceMoisture: Math.round(
      b.properties.surfaceMoisture - a.properties.surfaceMoisture,
    ),
    crispness: Math.round(b.properties.crispness - a.properties.crispness),
    tenderness: Math.round(b.properties.tenderness - a.properties.tenderness),
    browning: Math.round(b.properties.browning - a.properties.browning),
    sauceCoating: Math.round(
      b.properties.sauceCoating - a.properties.sauceCoating,
    ),
    intensity: Math.round(b.flavor.intensity - a.flavor.intensity),
  };
}
