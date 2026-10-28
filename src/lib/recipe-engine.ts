import type {
  RecipeChoiceEffect,
  RecipeDefinition,
  RecipeEvaluation,
  RecipeMetrics,
  RecipeSession,
  RecipeStep,
  RecipeStepEvaluation,
  RecipeStepRecord,
  RecipeStepSubmission,
  RecipeTrainingEvent,
  RecipeVariableGroup,
} from "./recipe-types";

export const RECIPE_SESSION_KEY = "simulating-cook:recipe-session:v1";

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function now() {
  return new Date().toISOString();
}

function choiceSignature(
  step: RecipeStep,
  session: RecipeSession,
): string {
  return step.variableGroups
    .map(
      (group) =>
        `${group.id}=${session.selectedChoices[group.id] ?? group.defaultOptionId}`,
    )
    .join("|");
}

function choicesForStep(
  step: RecipeStep,
  session: RecipeSession,
): Record<string, string> {
  return Object.fromEntries(
    step.variableGroups.map((group) => [
      group.id,
      session.selectedChoices[group.id] ?? group.defaultOptionId,
    ]),
  );
}

export function selectedOption(
  session: RecipeSession,
  group: RecipeVariableGroup,
) {
  const id = session.selectedChoices[group.id] ?? group.defaultOptionId;
  return group.options.find((option) => option.id === id) ?? group.options[0];
}

export function createRecipeSession(recipe: RecipeDefinition): RecipeSession {
  const selectedChoices: Record<string, string> = {};
  for (const step of recipe.steps) {
    for (const group of step.variableGroups) {
      selectedChoices[group.id] = group.defaultOptionId;
    }
  }
  return {
    version: 2,
    recipeId: recipe.id,
    stepIndex: 0,
    selectedChoices,
    completedSteps: [],
    stepRecords: [],
    trainingEvents: [],
    startedAt: now(),
    updatedAt: now(),
  };
}

export function applyRecipeChoice(
  session: RecipeSession,
  group: RecipeVariableGroup,
  optionId: string,
): RecipeSession {
  if (!group.options.some((option) => option.id === optionId)) {
    return session;
  }
  if (session.stepRecords.some((record) => record.stepId === session.stepIndex + 1)) {
    return session;
  }
  return {
    ...session,
    selectedChoices: {
      ...session.selectedChoices,
      [group.id]: optionId,
    },
    updatedAt: now(),
  };
}

export function evaluateRecipeStep(
  session: RecipeSession,
  recipe: RecipeDefinition,
  stepIndex = session.stepIndex,
): RecipeStepEvaluation {
  const step = recipe.steps[stepIndex];
  if (!step) {
    return {
      stepIndex,
      status: "standard",
      canAdvance: true,
      warnings: [],
      knowledge: [],
      suggestions: [],
      affectedGroups: [],
    };
  }

  const warnings: string[] = [];
  const knowledge: string[] = [];
  const suggestions: string[] = [];
  const affectedGroups: string[] = [];
  let status: RecipeStepEvaluation["status"] = "standard";

  for (const group of step.variableGroups) {
    const option = selectedOption(session, group);
    if (option.knowledge) knowledge.push(option.knowledge);
    if (option.risk === "none") continue;

    const defaultOption =
      group.options.find((item) => item.id === group.defaultOptionId) ??
      group.options[0];
    affectedGroups.push(group.label);
    if (option.warning) warnings.push(option.warning);
    suggestions.push(`${group.label}建议改为“${defaultOption.label}”`);
    if (option.risk === "safety") status = "safety";
    else if (status === "standard") status = "quality";
  }

  return {
    stepIndex,
    status,
    canAdvance: status !== "safety",
    warnings: [...new Set(warnings)],
    knowledge: [...new Set(knowledge)],
    suggestions: [...new Set(suggestions)],
    affectedGroups: [...new Set(affectedGroups)],
  };
}

export function submitRecipeStep(
  session: RecipeSession,
  recipe: RecipeDefinition,
): RecipeStepSubmission {
  if (session.stepIndex >= recipe.steps.length) {
    return {
      session,
      evaluation: evaluateRecipeStep(session, recipe),
      advanced: false,
    };
  }

  const step = recipe.steps[session.stepIndex];
  const evaluation = evaluateRecipeStep(session, recipe, session.stepIndex);
  const timestamp = now();

  if (!evaluation.canAdvance) {
    const signature = choiceSignature(step, session);
    const alreadyRecorded = session.trainingEvents.some(
      (event) =>
        event.type === "safety-blocked" &&
        event.stepIndex === session.stepIndex &&
        event.choiceSignature === signature,
    );
    if (alreadyRecorded) return { session, evaluation, advanced: false };

    const event: RecipeTrainingEvent = {
      id: `safety-${session.stepIndex}-${session.trainingEvents.length + 1}`,
      type: "safety-blocked",
      stepIndex: session.stepIndex,
      message:
        evaluation.warnings[0] ??
        "当前操作存在食品安全风险，请改为标准操作后继续。",
      choiceSignature: signature,
      createdAt: timestamp,
    };
    return {
      session: {
        ...session,
        trainingEvents: [...session.trainingEvents, event],
        updatedAt: timestamp,
      },
      evaluation,
      advanced: false,
    };
  }

  if (session.completedSteps.includes(session.stepIndex)) {
    return { session, evaluation, advanced: false };
  }

  const safetyCorrections = session.trainingEvents.filter(
    (event) =>
      event.type === "safety-blocked" &&
      event.stepIndex === session.stepIndex,
  ).length;
  const attempts = safetyCorrections + 1;
  const record: RecipeStepRecord = {
    stepId: step.stepId,
    status: evaluation.status === "standard" ? "passed" : "adjusted",
    attempts,
    safetyCorrections,
    choices: choicesForStep(step, session),
    warnings: evaluation.warnings,
    completedAt: timestamp,
  };
  const completed = new Set(session.completedSteps);
  completed.add(session.stepIndex);
  const event: RecipeTrainingEvent = {
    id: `complete-${session.stepIndex}-${session.trainingEvents.length + 1}`,
    type: "step-completed",
    stepIndex: session.stepIndex,
    message: `${step.title}已完成`,
    choiceSignature: choiceSignature(step, session),
    createdAt: timestamp,
  };

  return {
    session: {
      ...session,
      stepIndex: Math.min(recipe.steps.length, session.stepIndex + 1),
      completedSteps: [...completed].sort((left, right) => left - right),
      stepRecords: [
        ...session.stepRecords.filter((item) => item.stepId !== step.stepId),
        record,
      ],
      trainingEvents: [...session.trainingEvents, event],
      updatedAt: timestamp,
    },
    evaluation,
    advanced: true,
  };
}

export function advanceRecipeStep(
  session: RecipeSession,
  recipe: RecipeDefinition,
): RecipeSession {
  return submitRecipeStep(session, recipe).session;
}

export function previousRecipeStep(session: RecipeSession): RecipeSession {
  return {
    ...session,
    stepIndex: Math.max(0, session.stepIndex - 1),
    updatedAt: now(),
  };
}

export function goToRecipeStep(
  session: RecipeSession,
  stepIndex: number,
  recipe: RecipeDefinition,
): RecipeSession {
  return {
    ...session,
    stepIndex: Math.max(0, Math.min(stepIndex, recipe.steps.length)),
    updatedAt: now(),
  };
}

export function returnToRecipeProgress(
  session: RecipeSession,
  recipe: RecipeDefinition,
): RecipeSession {
  const nextPending = recipe.steps.findIndex(
    (_, index) => !session.completedSteps.includes(index),
  );
  return {
    ...session,
    stepIndex:
      nextPending === -1 ? recipe.steps.length : nextPending,
    updatedAt: now(),
  };
}

export function isRecipeComplete(
  session: RecipeSession,
  recipe: RecipeDefinition,
) {
  return session.completedSteps.length >= recipe.steps.length;
}

export function currentRecipeStep(
  session: RecipeSession,
  recipe: RecipeDefinition,
): RecipeStep | null {
  return recipe.steps[session.stepIndex] ?? null;
}

function aggregateEffects(
  recipe: RecipeDefinition,
  session: RecipeSession,
): RecipeChoiceEffect {
  const aggregate: RecipeChoiceEffect = {};
  for (const step of recipe.steps) {
    for (const group of step.variableGroups) {
      const option = selectedOption(session, group);
      for (const [key, value] of Object.entries(option.effect)) {
        if (typeof value !== "number") continue;
        const effectKey = key as keyof RecipeChoiceEffect;
        aggregate[effectKey] = (aggregate[effectKey] ?? 0) + value;
      }
    }
  }
  return aggregate;
}

export function evaluateRecipeResult(
  recipe: RecipeDefinition,
  session: RecipeSession,
): RecipeEvaluation {
  const effect = aggregateEffects(recipe, session);
  const warnings: string[] = [];
  const highlights: string[] = [];

  for (const step of recipe.steps) {
    for (const group of step.variableGroups) {
      const option = selectedOption(session, group);
      if (option.risk !== "none") {
        if (option.warning) warnings.push(option.warning);
        if (option.knowledge) highlights.push(option.knowledge);
      }
    }
  }

  const recordedWarnings = session.stepRecords.flatMap(
    (record) => record.warnings,
  );
  const safetyBlocks = session.trainingEvents.filter(
    (event) => event.type === "safety-blocked",
  );
  const safetyPenalty =
    Math.min(24, safetyBlocks.length * 6) +
    Math.min(12, new Set(recordedWarnings).size * 2);
  const metrics: RecipeMetrics = {
    flavor: Math.round(
      clamp(
        56 +
          (effect.salt ?? 0) * 0.45 +
          (effect.acid ?? 0) * 0.35 +
          (effect.sugar ?? 0) * 0.25 +
          (effect.umami ?? 0) * 0.4,
      ),
    ),
    texture: Math.round(
      clamp(
        56 +
          (effect.crispness ?? 0) * 0.55 +
          (effect.tenderness ?? 0) * 0.35 -
          Math.max(0, effect.water ?? 0) * 0.25,
      ),
    ),
    color: Math.round(
      clamp(58 + (effect.color ?? 0) * 0.7 - (effect.duration ?? 0) * 0.16),
    ),
    aroma: Math.round(
      clamp(55 + (effect.aroma ?? 0) * 0.6 + (effect.temperature ?? 0) * 0.1),
    ),
    water: Math.round(clamp(52 + (effect.water ?? 0) * 0.55)),
    safety: Math.round(
      clamp(82 + (effect.safety ?? 0) * 0.55 - safetyPenalty),
    ),
  };

  const average =
    (metrics.flavor +
      metrics.texture +
      metrics.color +
      metrics.aroma +
      metrics.safety) /
    5;
  const verdict =
    metrics.safety >= 70 && warnings.length <= 2 && average >= 58
      ? "达标"
      : "需要调整";

  const summary =
    verdict === "达标"
      ? `这道${recipe.name}的主要步骤完整，调味和受热较平衡。复盘时重点观察${highlights[0] ?? "食材受热与调味的关系"}。`
      : `这道${recipe.name}仍有可调整变量。优先处理安全与火候问题，再微调盐、酸或时间。`;

  return {
    verdict,
    summary,
    metrics,
    warnings: [...new Set([...warnings, ...recordedWarnings])].slice(0, 5),
    highlights: [...new Set(highlights)].slice(0, 4),
    safety:
      recipe.safetyNotes.map((note) => note.detail).join(" ") ||
      "模拟结果仅用于理解烹饪趋势，实际烹饪需结合食材厚度、锅具和食品安全要求。",
    deviations: [...new Set(recordedWarnings)].slice(0, 6),
    corrections: safetyBlocks.length,
  };
}

export function saveRecipeSession(session: RecipeSession) {
  try {
    window.localStorage.setItem(RECIPE_SESSION_KEY, JSON.stringify(session));
  } catch {
    // Private browsing can disable storage; the active session still works.
  }
}

function migrateVersionOne(
  parsed: Record<string, unknown>,
  timestamp: string,
): RecipeSession {
  const completedSteps = Array.isArray(parsed.completedSteps)
    ? (parsed.completedSteps.filter((item) => typeof item === "number") as number[])
    : [];
  return {
    version: 2,
    recipeId: parsed.recipeId as number,
    stepIndex: parsed.stepIndex as number,
    selectedChoices: parsed.selectedChoices as Record<string, string>,
    completedSteps,
    stepRecords: completedSteps.map((stepIndex) => ({
      stepId: stepIndex + 1,
      status: "passed",
      attempts: 1,
      safetyCorrections: 0,
      choices: {},
      warnings: [],
      completedAt:
        typeof parsed.updatedAt === "string" ? parsed.updatedAt : timestamp,
    })),
    trainingEvents: [],
    startedAt:
      typeof parsed.startedAt === "string" ? parsed.startedAt : timestamp,
    updatedAt:
      typeof parsed.updatedAt === "string" ? parsed.updatedAt : timestamp,
  };
}

export function loadRecipeSession(): RecipeSession | null {
  try {
    const raw = window.localStorage.getItem(RECIPE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (
      (parsed.version !== 1 && parsed.version !== 2) ||
      typeof parsed.recipeId !== "number" ||
      typeof parsed.stepIndex !== "number" ||
      !Array.isArray(parsed.completedSteps) ||
      !parsed.selectedChoices
    ) {
      return null;
    }
    const timestamp = new Date().toISOString();
    if (parsed.version === 1) {
      return migrateVersionOne(parsed, timestamp);
    }
    return {
      version: 2,
      recipeId: parsed.recipeId,
      stepIndex: parsed.stepIndex,
      selectedChoices: parsed.selectedChoices as Record<string, string>,
      completedSteps: parsed.completedSteps.filter(
        (item): item is number => typeof item === "number",
      ),
      stepRecords: Array.isArray(parsed.stepRecords)
        ? (parsed.stepRecords as RecipeStepRecord[])
        : [],
      trainingEvents: Array.isArray(parsed.trainingEvents)
        ? (parsed.trainingEvents as RecipeTrainingEvent[])
        : [],
      startedAt:
        typeof parsed.startedAt === "string" ? parsed.startedAt : timestamp,
      updatedAt:
        typeof parsed.updatedAt === "string" ? parsed.updatedAt : timestamp,
    };
  } catch {
    return null;
  }
}

export function clearRecipeSession() {
  try {
    window.localStorage.removeItem(RECIPE_SESSION_KEY);
  } catch {
    // Ignore storage failures.
  }
}
