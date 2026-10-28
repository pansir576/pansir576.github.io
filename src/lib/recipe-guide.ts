import {
  ensureAnonymousUser,
  getCommunityClient,
} from "./community/supabase";
import {
  currentRecipeStep,
  evaluateRecipeResult,
  evaluateRecipeStep,
  selectedOption,
} from "./recipe-engine";
import type {
  RecipeDefinition,
  RecipeGuideRequest,
  RecipeGuideResponse,
  RecipeSession,
} from "./recipe-types";

export const RECIPE_GUIDE_QUESTION_LIMIT = 300;

export function buildRecipeGuideRequest(
  recipe: RecipeDefinition,
  session: RecipeSession,
  question: string,
): RecipeGuideRequest {
  const step = currentRecipeStep(session, recipe);
  const evaluation = evaluateRecipeStep(session, recipe);
  const result = evaluateRecipeResult(recipe, session);
  const selectedVariables = step
    ? step.variableGroups.map((group) => {
        const option = selectedOption(session, group);
        return {
          groupId: group.id,
          groupLabel: group.label,
          optionLabel: option.label,
          risk: option.risk,
          warning: option.warning,
        };
      })
    : recipe.steps.flatMap((item) =>
        item.variableGroups.flatMap((group) => {
          const option = selectedOption(session, group);
          return option.risk === "none"
            ? []
            : [
                {
                  groupId: group.id,
                  groupLabel: group.label,
                  optionLabel: option.label,
                  risk: option.risk,
                  warning: option.warning,
                },
              ];
        }),
      );
  return {
    mode: "recipe",
    question: question.trim().slice(0, RECIPE_GUIDE_QUESTION_LIMIT),
    context: {
      recipeId: recipe.id,
      recipeName: recipe.name,
      stepIndex: session.stepIndex,
      stepTitle: step?.title ?? "实训复盘",
      description: step?.description ?? recipe.summary,
      knowledge: step?.knowledge ?? "",
      aiWarning: evaluation.warnings[0] ?? step?.aiWarning ?? "",
      selectedVariables,
      metrics: result.metrics,
      safetyNotes: recipe.safetyNotes.map((note) => note.detail),
      completedSteps: session.completedSteps.length,
      deviations: result.deviations,
      corrections: result.corrections,
    },
  };
}

export function answerRecipeGuideLocally(
  request: RecipeGuideRequest,
  reason = "在线 AI 未配置，本次由本地菜谱规则回答",
): RecipeGuideResponse {
  const { context } = request;
  const safetyVariable = context.selectedVariables.find(
    (item) => item.risk === "safety",
  );
  const qualityVariable = context.selectedVariables.find(
    (item) => item.risk === "quality",
  );
  const isReview = context.stepTitle === "实训复盘";
  const opening = isReview
    ? `本次已完成 ${context.completedSteps} 步，共记录 ${context.corrections} 次安全纠错和 ${context.deviations.length} 项质量偏差。`
    : safetyVariable
      ? `先不要继续：${safetyVariable.groupLabel}“${safetyVariable.optionLabel}”存在食品安全风险。`
      : qualityVariable
        ? `可以继续试做，但“${qualityVariable.groupLabel}”当前是“${qualityVariable.optionLabel}”，成品会有可感知偏差。`
        : "当前选择符合标准操作，可以继续完成本步骤。";
  const reasonLine =
    (isReview ? context.deviations[0] : safetyVariable?.warning) ??
    qualityVariable?.warning ??
    context.knowledge ??
    context.aiWarning;
  const correction = isReview
    ? "复盘建议：保留已经掌握的标准操作，下次只改变一个口味或火候变量，观察味觉、口感和安全分的变化。"
    : safetyVariable
      ? "改为该组的标准操作后再提交；评分和步骤状态只会由本地确定性规则更新。"
      : "如果你希望更接近标准成品，先回到默认操作，再观察火候、水分和调味的变化。";
  const metricLine = `当前预估：味觉 ${context.metrics.flavor}、口感 ${context.metrics.texture}、香气 ${context.metrics.aroma}、安全 ${context.metrics.safety}。`;

  return {
    answer: [
      opening,
      reasonLine,
      metricLine,
      correction,
      `说明：${reason}。实际烹饪仍需结合食材厚度、锅具和中心温度判断。`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    citations: [
      {
        id: `recipe-${context.recipeId}`,
        title: `${context.recipeName}菜谱`,
      },
      {
        id: `recipe-${context.recipeId}-step-${context.stepIndex + 1}`,
        title: `${context.stepTitle}操作规则`,
      },
    ],
    provider: "local",
  };
}

export async function askRecipeGuide(
  recipe: RecipeDefinition,
  session: RecipeSession,
  question: string,
): Promise<RecipeGuideResponse> {
  const request = buildRecipeGuideRequest(recipe, session, question);
  if (!request.question) {
    return answerRecipeGuideLocally(request, "问题为空，已使用本地操作提示");
  }

  const supabase = getCommunityClient();
  if (!supabase) {
    return answerRecipeGuideLocally(
      request,
      "在线 AI 未配置，本次由本地菜谱规则回答",
    );
  }

  try {
    const remote = (async () => {
      await ensureAnonymousUser();
      return supabase.functions.invoke("cooking-guide", {
        body: request,
      });
    })();
    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(
        () => reject(new Error("RECIPE_GUIDE_TIMEOUT")),
        10_000,
      );
    });
    const { data, error } = await Promise.race([remote, timeout]);
    if (error) throw error;
    if (
      data &&
      typeof data.answer === "string" &&
      Array.isArray(data.citations)
    ) {
      return {
        answer: data.answer,
        citations: data.citations.filter(
          (item: unknown): item is { id: string; title: string } =>
            Boolean(
              item &&
                typeof item === "object" &&
                "id" in item &&
                "title" in item &&
                typeof item.id === "string" &&
                typeof item.title === "string",
            ),
        ),
        provider: "llm",
      };
    }
    throw new Error("RECIPE_GUIDE_RESPONSE_INVALID");
  } catch {
    return answerRecipeGuideLocally(
      request,
      "在线 AI 超时、限频或暂不可用，已切换为本地菜谱规则",
    );
  }
}
