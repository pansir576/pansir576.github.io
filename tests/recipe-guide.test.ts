import { beforeEach, describe, expect, it, vi } from "vitest";
import recipeData from "@/lib/recipe-data.json";
import {
  applyRecipeChoice,
  createRecipeSession,
  goToRecipeStep,
  submitRecipeStep,
} from "@/lib/recipe-engine";
import {
  answerRecipeGuideLocally,
  askRecipeGuide,
  buildRecipeGuideRequest,
  RECIPE_GUIDE_QUESTION_LIMIT,
} from "@/lib/recipe-guide";
import type { RecipeDefinition } from "@/lib/recipe-types";

const mocks = vi.hoisted(() => ({
  getCommunityClient: vi.fn(),
  ensureAnonymousUser: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("@/lib/community/supabase", () => ({
  getCommunityClient: mocks.getCommunityClient,
  ensureAnonymousUser: mocks.ensureAnonymousUser,
}));

const recipes = recipeData as RecipeDefinition[];
const recipe = recipes.find((item) => item.name === "干煸四季豆")!;

function safetySession() {
  const stepIndex = recipe.steps.findIndex((step) =>
    step.variableGroups.some((group) =>
      group.options.some((option) => option.risk === "safety"),
    ),
  );
  const step = recipe.steps[stepIndex];
  const group = step.variableGroups.find((item) =>
    item.options.some((option) => option.risk === "safety"),
  )!;
  const option = group.options.find((item) => item.risk === "safety")!;
  return applyRecipeChoice(
    goToRecipeStep(createRecipeSession(recipe), stepIndex, recipe),
    group,
    option.id,
  );
}

describe("recipe guide", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCommunityClient.mockReturnValue({
      functions: { invoke: mocks.invoke },
    });
    mocks.ensureAnonymousUser.mockResolvedValue({ id: "anonymous" });
  });

  it("builds a bounded recipe-only request for the active step", () => {
    const session = safetySession();
    const request = buildRecipeGuideRequest(
      recipe,
      session,
      "为什么一定要炒熟？".repeat(40),
    );
    expect(request.mode).toBe("recipe");
    expect(request.question.length).toBe(RECIPE_GUIDE_QUESTION_LIMIT);
    expect(request.context.recipeName).toBe("干煸四季豆");
    expect(request.context.selectedVariables.some((item) => item.risk === "safety")).toBe(
      true,
    );
    expect(request.context).not.toHaveProperty("steps");
  });

  it("answers safety corrections from local rules", () => {
    const request = buildRecipeGuideRequest(
      recipe,
      safetySession(),
      "这一步能继续吗？",
    );
    const response = answerRecipeGuideLocally(request);
    expect(response.provider).toBe("local");
    expect(response.answer).toContain("先不要继续");
    expect(response.answer).toContain("食品安全");
    expect(response.citations[0].id).toBe(`recipe-${recipe.id}`);
  });

  it("uses the configured online guide when it responds successfully", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        answer: "请先改为标准加热时长。",
        citations: [{ id: "recipe-8", title: "干煸四季豆菜谱" }],
      },
      error: null,
    });
    const response = await askRecipeGuide(
      recipe,
      safetySession(),
      "为什么会中毒？",
    );
    expect(response.provider).toBe("llm");
    expect(response.answer).toContain("标准加热时长");
    expect(mocks.invoke).toHaveBeenCalledWith(
      "cooking-guide",
      expect.objectContaining({
        body: expect.objectContaining({ mode: "recipe" }),
      }),
    );
  });

  it("builds a local final recap without requiring the online model", () => {
    let session = createRecipeSession(recipe);
    for (let index = 0; index < recipe.steps.length; index += 1) {
      session = submitRecipeStep(session, recipe).session;
    }
    const request = buildRecipeGuideRequest(
      recipe,
      session,
      "总结这次实训",
    );
    const response = answerRecipeGuideLocally(request);
    expect(request.context.stepTitle).toBe("实训复盘");
    expect(request.context.completedSteps).toBe(recipe.steps.length);
    expect(response.answer).toContain("本次已完成");
    expect(response.answer).toContain("复盘建议");
  });

  it("falls back locally when online AI fails or is not configured", async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: { message: "RATE_LIMITED" },
    });
    const failed = await askRecipeGuide(
      recipe,
      safetySession(),
      "还能继续吗？",
    );
    expect(failed.provider).toBe("local");
    expect(failed.answer).toContain("在线 AI 超时、限频或暂不可用");

    mocks.getCommunityClient.mockReturnValue(null);
    const unavailable = await askRecipeGuide(
      recipe,
      safetySession(),
      "为什么？",
    );
    expect(unavailable.provider).toBe("local");
    expect(unavailable.answer).toContain("在线 AI 未配置");
  });
});
