import { describe, expect, it } from "vitest";
import { ingredients } from "@/lib/ingredients";
import { createInitialState } from "@/lib/simulator";
import type {
  CookingSession,
  KitchenAction,
  KitchenWorkspace,
  OutcomeGoal,
} from "@/lib/types";
import { analyzeKitchenWorkflow } from "@/lib/workflow";

function workspace(overrides: Partial<KitchenWorkspace> = {}): KitchenWorkspace {
  return {
    station: "sink",
    sampleStation: "sink",
    inPan: false,
    ...overrides,
  };
}

function analysis(
  ingredientId = "greens",
  actions: KitchenAction[] = [],
  state = createInitialState(ingredientId),
  workspaceInput = workspace(),
  goal: OutcomeGoal | null = null,
  isHeating = false,
  hasSavedResult = false,
) {
  return analyzeKitchenWorkflow({
    ingredientId,
    actions,
    workspace: workspaceInput,
    state,
    goal,
    isHeating,
    hasSavedResult,
  });
}

describe("complete experiment workflow", () => {
  it("creates five valid phases for all 55 ingredients", () => {
    for (const ingredient of ingredients) {
      const result = analysis(ingredient.id);
      expect(result.steps).toHaveLength(5);
      expect(result.steps.filter((step) => step.status === "active")).toHaveLength(1);
      expect(result.recommendation.title.length).toBeGreaterThan(3);
    }
  });

  it("advances from preparation to pan and cooking", () => {
    const actions: KitchenAction[] = [
      { type: "operation", operationId: "wash" },
      { type: "operation", operationId: "greens-tear" },
      { type: "operation", operationId: "greens-dry-well" },
    ];
    const result = analysis(
      "greens",
      actions,
      createInitialState("greens"),
      workspace({ station: "pan", sampleStation: "pan", inPan: true }),
    );
    expect(result.steps[1].status).toBe("completed");
    expect(result.steps[2].status).toBe("completed");
    expect(result.steps[3].status).toBe("active");
    expect(result.recommendation.id).toBe("recommend-heat");
  });

  it("prioritizes drying when surface water is high", () => {
    const actions: KitchenAction[] = [
      { type: "operation", operationId: "wash" },
      { type: "operation", operationId: "greens-tear" },
    ];
    const state = createInitialState("greens");
    state.properties.surfaceMoisture = 78;
    const result = analysis(
      "greens",
      actions,
      state,
      workspace({ station: "board", sampleStation: "board" }),
      "crisper",
    );
    expect(result.recommendation.id).toBe("recommend-dry");
    expect(result.recommendation.tone).toBe("warning");
  });

  it("blocks the conceptual empty-pan path by recommending movement", () => {
    const result = analysis();
    expect(result.recommendation.id).toBe("recommend-wash");
    const moved = analysis(
      "greens",
      [
        { type: "operation", operationId: "wash" },
        { type: "operation", operationId: "greens-tear" },
        { type: "operation", operationId: "greens-dry-well" },
      ],
      createInitialState("greens"),
      workspace(),
    );
    expect(moved.recommendation.id).toBe("recommend-pan");
  });

  it("recommends stopping heat near the target temperature", () => {
    const state = createInitialState("beef");
    state.properties.temperature = 186;
    state.properties.cookedness = 40;
    const session: CookingSession = {
      isHeating: true,
      targetTemperature: 190,
      currentTemperature: 186,
      elapsedSimSeconds: 80,
      heatLevel: "high",
      method: "pan-fry",
      lidCovered: false,
      stirIntensity: "none",
    };
    const result = analysis(
      "beef",
      [{ type: "heat", method: "pan-fry", heatLevel: "high", targetTemperature: 190, durationMin: 1 }],
      state,
      workspace({ station: "pan", sampleStation: "pan", inPan: true, session }),
      "more-aromatic",
      true,
    );
    expect(result.recommendation.id).toBe("recommend-watch-heat");
    expect(result.recommendation.tone).toBe("good");
  });

  it("moves from seasoning advice to saving a result", () => {
    const heatAction: KitchenAction = {
      type: "heat",
      method: "stir-fry",
      heatLevel: "medium",
      targetTemperature: 170,
      durationMin: 1,
    };
    const beforeSeason = analysis(
      "greens",
      [heatAction],
      createInitialState("greens"),
      workspace({ station: "pan", sampleStation: "pan", inPan: true }),
    );
    expect(beforeSeason.recommendation.id).toBe("recommend-season");
    const afterSeason = analysis(
      "greens",
      [
        heatAction,
        {
          type: "season",
          seasoningId: "salt",
          amount: { level: "little", precise: false },
        },
      ],
      createInitialState("greens"),
      workspace({ station: "pan", sampleStation: "pan", inPan: true }),
    );
    expect(afterSeason.recommendation.id).toBe("recommend-review");
  });
});
