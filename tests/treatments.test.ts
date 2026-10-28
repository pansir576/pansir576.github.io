import { describe, expect, it } from "vitest";
import { ingredients } from "@/lib/ingredients";
import {
  compareBranchActions,
  comparePrediction,
  detectPredictedChanges,
} from "@/lib/learning";
import { applyAction, createInitialState } from "@/lib/simulator";
import { seasonings } from "@/lib/principles";
import {
  treatments,
  treatmentsForIngredient,
} from "@/lib/treatments";
import type { ExperimentBranch, KitchenAction } from "@/lib/types";

function branch(
  id: "A" | "B",
  actions: KitchenAction[],
): ExperimentBranch {
  let state = createInitialState("beef");
  for (const action of actions) state = applyAction(state, action);
  return {
    id,
    label: `${id} 分支`,
    ingredientId: "beef",
    state,
    history: [],
    actions,
    branchGroupId: "test-group",
  };
}

describe("ingredient-specific treatment catalog", () => {
  it("contains the complete 55-ingredient catalog", () => {
    expect(ingredients).toHaveLength(55);
    expect(new Set(ingredients.map((item) => item.id)).size).toBe(55);
  });

  it("offers multiple purpose-built actions for every ingredient", () => {
    for (const ingredient of ingredients) {
      const specific = treatmentsForIngredient(ingredient.id).filter(
        (item) =>
          item.category !== "universal" &&
          (item.ingredientIds?.includes(ingredient.id) ||
            item.archetypes?.includes(ingredient.archetype)),
      );
      expect(specific.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("contains unique treatment IDs and principle metadata", () => {
    expect(new Set(treatments.map((item) => item.id)).size).toBe(
      treatments.length,
    );
    for (const treatment of treatments) {
      expect(treatment.principleTags.length).toBeGreaterThan(0);
      expect(treatment.purpose.length).toBeGreaterThan(4);
    }
  });

  it("moves salt-loaded water out of leafy greens through osmosis", () => {
    const initial = createInitialState("greens");
    const treated = applyAction(initial, {
      type: "operation",
      operationId: "greens-salt-wilt",
    });
    expect(treated.properties.moisture).toBeLessThan(initial.properties.moisture);
    expect(treated.properties.saltLoad).toBeGreaterThan(0);
    expect(treated.events.at(-1)?.principleTags).toContain("osmosis");
  });

  it("uses acid to lower potato surface pH and enzyme activity", () => {
    const initial = createInitialState("potato");
    const treated = applyAction(initial, {
      type: "operation",
      operationId: "potato-acid-soak",
    });
    expect(treated.properties.ph).toBeLessThan(initial.properties.ph);
    expect(treated.properties.enzymeActivity).toBeLessThan(
      initial.properties.enzymeActivity,
    );
  });

  it("records before, after and transferable mechanism for every operation", () => {
    const state = applyAction(createInitialState("beef"), {
      type: "operation",
      operationId: "beef-slice-cross",
    });
    const event = state.events.at(-1)!;
    expect(event.before.texture).not.toBe("");
    expect(event.after.texture).not.toBe(event.before.texture);
    expect(event.principleTags).toContain("mechanical-structure");
    expect(event.transfer.length).toBeGreaterThan(10);
  });
});

describe("expanded seasoning catalog", () => {
  it("contains more than 30 grouped seasonings", () => {
    expect(seasonings.length).toBeGreaterThan(30);
    expect(new Set(seasonings.map((item) => item.id)).size).toBe(
      seasonings.length,
    );
  });

  it("applies acid, paste and umami behaviors to new condiments", () => {
    const initial = createInitialState("beef");
    const lemon = applyAction(initial, {
      type: "season",
      seasoningId: "lemon-juice",
      amount: { level: "moderate", precise: false },
    });
    const paste = applyAction(initial, {
      type: "season",
      seasoningId: "doubanjiang",
      amount: { level: "moderate", precise: false },
    });
    const fishSauce = applyAction(initial, {
      type: "season",
      seasoningId: "fish-sauce",
      amount: { level: "moderate", precise: false },
    });
    expect(lemon.properties.ph).toBeLessThan(initial.properties.ph);
    expect(paste.properties.saltLoad).toBeGreaterThan(0);
    expect(paste.flavor.umami).toBeGreaterThan(initial.flavor.umami);
    expect(fishSauce.flavor.umami).toBeGreaterThan(initial.flavor.umami);
  });
});

describe("heat variables and predictions", () => {
  it("reduces moisture loss and browning when the lid is closed", () => {
    const initial = applyAction(createInitialState("beef"), {
      type: "operation",
      operationId: "surface-dry",
    });
    const open = applyAction(initial, {
      type: "heat",
      method: "pan-fry",
      heatLevel: "high",
      targetTemperature: 200,
      durationMin: 4,
      lidCovered: false,
      stirIntensity: "none",
    });
    const covered = applyAction(initial, {
      type: "heat",
      method: "pan-fry",
      heatLevel: "high",
      targetTemperature: 200,
      durationMin: 4,
      lidCovered: true,
      stirIntensity: "none",
    });
    expect(covered.properties.moisture).toBeGreaterThan(
      open.properties.moisture,
    );
    expect(covered.properties.browning).toBeLessThan(open.properties.browning);
  });

  it("frequent stirring reduces shape integrity in a stir-fry", () => {
    const initial = createInitialState("tofu");
    const still = applyAction(initial, {
      type: "heat",
      method: "stir-fry",
      heatLevel: "medium",
      targetTemperature: 170,
      durationMin: 3,
      stirIntensity: "none",
    });
    const stirred = applyAction(initial, {
      type: "heat",
      method: "stir-fry",
      heatLevel: "medium",
      targetTemperature: 170,
      durationMin: 3,
      stirIntensity: "frequent",
    });
    expect(stirred.properties.shapeIntegrity).toBeLessThan(
      still.properties.shapeIntegrity,
    );
  });

  it("compares selected predictions with observed state changes", () => {
    const before = applyAction(
      applyAction(
        applyAction(createInitialState("potato"), {
          type: "operation",
          operationId: "surface-dry",
        }),
        {
          type: "season",
          seasoningId: "oil",
          amount: { level: "moderate", precise: false },
        },
      ),
      {
        type: "operation",
        operationId: "potato-rinse-starch",
      },
    );
    const after = applyAction(before, {
      type: "heat",
      method: "pan-fry",
      heatLevel: "high",
      targetTemperature: 200,
      durationMin: 4,
      stirIntensity: "none",
    });
    const observed = detectPredictedChanges(before, after);
    const review = comparePrediction(["browner", "more-coating"], observed);
    expect(review.matched).toContain("browner");
    expect(review.missed.length + review.matched.length).toBe(2);
  });
});

describe("A/B branch comparison", () => {
  it("recognizes a true single-variable branch", () => {
    const common: KitchenAction = { type: "operation", operationId: "beef-slice-cross" };
    const a = branch("A", [common]);
    const b = branch("B", [
      common,
      { type: "operation", operationId: "beef-dry-brine" },
    ]);
    const result = compareBranchActions(a, b);
    expect(result.isSingleVariable).toBe(false);
    expect(result.description).toContain("多个");
  });

  it("recognizes one changed heat parameter when timelines have equal length", () => {
    const a = branch("A", [
      {
        type: "heat",
        method: "pan-fry",
        heatLevel: "high",
        targetTemperature: 180,
        durationMin: 2,
        stirIntensity: "none",
      },
    ]);
    const b = branch("B", [
      {
        type: "heat",
        method: "pan-fry",
        heatLevel: "high",
        targetTemperature: 220,
        durationMin: 2,
        stirIntensity: "none",
      },
    ]);
    const result = compareBranchActions(a, b);
    expect(result.isSingleVariable).toBe(true);
    expect(result.description).toContain("只改变了一个变量");
  });
});
