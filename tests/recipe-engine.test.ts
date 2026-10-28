import { beforeEach, describe, expect, it } from "vitest";
import recipeData from "@/lib/recipe-data.json";
import {
  applyRecipeChoice,
  createRecipeSession,
  evaluateRecipeResult,
  evaluateRecipeStep,
  goToRecipeStep,
  isRecipeComplete,
  loadRecipeSession,
  RECIPE_SESSION_KEY,
  saveRecipeSession,
  submitRecipeStep,
} from "@/lib/recipe-engine";
import type {
  RecipeDefinition,
  RecipeRiskLevel,
} from "@/lib/recipe-types";

const recipes = recipeData as RecipeDefinition[];

function findRiskOption(recipe: RecipeDefinition, risk: RecipeRiskLevel) {
  for (let stepIndex = 0; stepIndex < recipe.steps.length; stepIndex += 1) {
    for (const group of recipe.steps[stepIndex].variableGroups) {
      const option = group.options.find((item) => item.risk === risk);
      if (option) return { stepIndex, group, option };
    }
  }
  return null;
}

describe("recipe dataset", () => {
  it("contains 25 unique complete recipes and 99 guided steps", () => {
    expect(recipes).toHaveLength(25);
    expect(
      recipes.reduce((total, recipe) => total + recipe.steps.length, 0),
    ).toBe(99);
    expect(new Set(recipes.map((recipe) => recipe.id)).size).toBe(25);
    expect(new Set(recipes.map((recipe) => recipe.name)).size).toBe(25);
    for (const recipe of recipes) {
      expect(recipe.steps.length).toBeGreaterThanOrEqual(3);
      expect(recipe.steps.length).toBeLessThanOrEqual(8);
      expect(recipe.summary.length).toBeGreaterThan(3);
      expect(recipe.safetyNotes.length).toBeGreaterThan(0);
    }
  });

  it("maps every ingredient to the catalog, seasoning, or modifier layer", () => {
    for (const recipe of recipes) {
      for (const ingredient of recipe.ingredients) {
        expect(
          Boolean(
            ingredient.ingredientId ||
              ingredient.seasoningId ||
              ingredient.modifierId,
          ),
          `${recipe.name}: ${ingredient.name}`,
        ).toBe(true);
      }
    }
  });

  it("provides valid combinable controls and explicit risk metadata", () => {
    for (const recipe of recipes) {
      for (const step of recipe.steps) {
        for (const group of step.variableGroups) {
          expect(group.options.length).toBeGreaterThanOrEqual(2);
          expect(group.options.length).toBeLessThanOrEqual(4);
          const defaultOption = group.options.find(
            (option) => option.id === group.defaultOptionId,
          );
          expect(defaultOption).toBeTruthy();
          expect(defaultOption?.risk).toBe("none");
          for (const option of group.options) {
            expect(["none", "quality", "safety"]).toContain(option.risk);
            expect(Object.keys(option.simulation ?? {}).length).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it("covers every high-risk protein, egg and green-bean recipe", () => {
    const expected = [
      8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 22, 24, 25,
    ];
    for (const recipeId of expected) {
      const recipe = recipes.find((item) => item.id === recipeId);
      expect(recipe).toBeTruthy();
      expect(findRiskOption(recipe!, "safety")).toBeTruthy();
    }
  });

  it("keeps the green-bean safety boundary", () => {
    const greenBeans = recipes.find((recipe) => recipe.name === "干煸四季豆");
    expect(greenBeans).toBeTruthy();
    expect(
      greenBeans?.safetyNotes.some((note) => note.detail.includes("熟透")),
    ).toBe(true);
    expect(
      greenBeans?.steps.some((step) => step.aiWarning.includes("熟透")),
    ).toBe(true);
    expect(findRiskOption(greenBeans!, "safety")?.option.warning).toMatch(
      /熟透|食物中毒/,
    );
  });
});

describe("recipe session engine", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("supports multiple variable groups at the same step", () => {
    const recipe = recipes.find((item) => item.name === "鱼香肉丝")!;
    const stepIndex = recipe.steps.findIndex(
      (item) => item.variableGroups.length >= 2,
    );
    let session = goToRecipeStep(createRecipeSession(recipe), stepIndex, recipe);
    const [acid, sugar] = recipe.steps[stepIndex].variableGroups;
    session = applyRecipeChoice(session, acid, acid.options.at(-1)!.id);
    session = applyRecipeChoice(session, sugar, sugar.options.at(-1)!.id);
    expect(session.selectedChoices[acid.id]).toBe(acid.options.at(-1)!.id);
    expect(session.selectedChoices[sugar.id]).toBe(sugar.options.at(-1)!.id);
  });

  it("blocks a safety choice until the standard operation is restored", () => {
    const recipe = recipes.find((item) => item.name === "干煸四季豆")!;
    const match = findRiskOption(recipe, "safety")!;
    let session = goToRecipeStep(
      createRecipeSession(recipe),
      match.stepIndex,
      recipe,
    );
    session = applyRecipeChoice(session, match.group, match.option.id);

    const evaluation = evaluateRecipeStep(session, recipe);
    expect(evaluation.status).toBe("safety");
    expect(evaluation.canAdvance).toBe(false);
    expect(evaluation.warnings.length).toBeGreaterThan(0);

    const blocked = submitRecipeStep(session, recipe);
    expect(blocked.advanced).toBe(false);
    expect(blocked.session.stepIndex).toBe(match.stepIndex);
    expect(blocked.session.trainingEvents).toHaveLength(1);

    const repeated = submitRecipeStep(blocked.session, recipe);
    expect(repeated.session.trainingEvents).toHaveLength(1);

    const corrected = applyRecipeChoice(
      blocked.session,
      match.group,
      match.group.defaultOptionId,
    );
    const submitted = submitRecipeStep(corrected, recipe);
    expect(submitted.advanced).toBe(true);
    expect(submitted.session.completedSteps).toContain(match.stepIndex);
    expect(submitted.session.stepRecords[0].safetyCorrections).toBe(1);
    expect(evaluateRecipeResult(recipe, submitted.session).corrections).toBe(1);
  });

  it("allows a quality deviation to continue and records it in the recap", () => {
    const recipe = recipes.find((item) => item.name === "蒜蓉油麦菜")!;
    const match = findRiskOption(recipe, "quality")!;
    let session = goToRecipeStep(
      createRecipeSession(recipe),
      match.stepIndex,
      recipe,
    );
    session = applyRecipeChoice(session, match.group, match.option.id);
    const evaluation = evaluateRecipeStep(session, recipe);
    expect(evaluation.status).toBe("quality");
    expect(evaluation.canAdvance).toBe(true);

    const submitted = submitRecipeStep(session, recipe);
    expect(submitted.advanced).toBe(true);
    expect(submitted.session.stepRecords[0].status).toBe("adjusted");
    expect(submitted.session.stepRecords[0].warnings.length).toBeGreaterThan(0);
    expect(evaluateRecipeResult(recipe, submitted.session).deviations).toEqual(
      expect.arrayContaining(submitted.session.stepRecords[0].warnings),
    );
  });

  it("advances every step with standard controls and produces a recap", () => {
    const recipe = recipes[0];
    let session = createRecipeSession(recipe);
    for (let index = 0; index < recipe.steps.length; index += 1) {
      const submission = submitRecipeStep(session, recipe);
      expect(submission.evaluation.status).toBe("standard");
      expect(submission.advanced).toBe(true);
      session = submission.session;
    }
    expect(isRecipeComplete(session, recipe)).toBe(true);
    const result = evaluateRecipeResult(recipe, session);
    expect(["达标", "需要调整"]).toContain(result.verdict);
    expect(result.metrics.safety).toBeGreaterThanOrEqual(0);
    expect(result.metrics.safety).toBeLessThanOrEqual(100);
  });

  it("persists and restores the active version 2 session", () => {
    const recipe = recipes[2];
    const session = submitRecipeStep(
      createRecipeSession(recipe),
      recipe,
    ).session;
    saveRecipeSession(session);
    expect(window.localStorage.getItem(RECIPE_SESSION_KEY)).toBeTruthy();
    expect(loadRecipeSession()).toEqual(session);
  });

  it("migrates a version 1 session without losing completed progress", () => {
    window.localStorage.setItem(
      RECIPE_SESSION_KEY,
      JSON.stringify({
        version: 1,
        recipeId: 3,
        stepIndex: 2,
        selectedChoices: { "salt-level-3": "medium-3" },
        completedSteps: [0, 1],
        startedAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:10:00.000Z",
      }),
    );
    const migrated = loadRecipeSession();
    expect(migrated?.version).toBe(2);
    expect(migrated?.recipeId).toBe(3);
    expect(migrated?.stepIndex).toBe(2);
    expect(migrated?.completedSteps).toEqual([0, 1]);
    expect(migrated?.stepRecords).toHaveLength(2);
    expect(migrated?.trainingEvents).toEqual([]);
  });

  it("ignores corrupt local recipe data", () => {
    window.localStorage.setItem(RECIPE_SESSION_KEY, "{not-json");
    expect(loadRecipeSession()).toBeNull();
  });
});
