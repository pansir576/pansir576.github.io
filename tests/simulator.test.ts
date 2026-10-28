import { describe, expect, it } from "vitest";
import { ingredients } from "@/lib/ingredients";
import {
  applyAction,
  createInitialState,
  replayActions,
} from "@/lib/simulator";
import type { KitchenAction } from "@/lib/types";

describe("simulation engine", () => {
  it("creates a valid initial state for every ingredient", () => {
    for (const ingredient of ingredients) {
      const state = createInitialState(ingredient.id);
      expect(state.ingredientId).toBe(ingredient.id);
      expect(state.actionCount).toBe(0);
      expect(state.events).toHaveLength(1);
      expect(state.flavor.intensity).toBe(ingredient.baseFlavor.intensity);
    }
  });

  it("is deterministic across replay", () => {
    const actions: KitchenAction[] = [
      { type: "prep", prepId: "cut-small" },
      { type: "prep", prepId: "dry" },
      {
        type: "heat",
        method: "pan-fry",
        heatLevel: "high",
        targetTemperature: 190,
        durationMin: 3,
      },
      {
        type: "season",
        seasoningId: "salt",
        amount: { level: "little", precise: false },
      },
    ];
    expect(replayActions("potato", actions)).toEqual(
      replayActions("potato", actions),
    );
  });

  it("shows early salt drawing water from leafy greens", () => {
    const initial = createInitialState("greens");
    const early = applyAction(initial, {
      type: "season",
      seasoningId: "salt",
      amount: { level: "moderate", precise: false },
    });
    const late = applyAction(
      applyAction(initial, {
        type: "heat",
        method: "stir-fry",
        heatLevel: "high",
        targetTemperature: 180,
        durationMin: 1,
      }),
      {
        type: "season",
        seasoningId: "salt",
        amount: { level: "moderate", precise: false },
      },
    );

    expect(early.properties.moisture).toBeLessThan(initial.properties.moisture);
    expect(early.properties.crispness).toBeLessThan(initial.properties.crispness);
    expect(early.flags).toContain("salt-before-heat");
    expect(late.flags).not.toContain("salt-before-heat");
  });

  it("reduces potato enzyme activity when acid is added before heat", () => {
    const initial = createInitialState("potato");
    const acidified = applyAction(initial, {
      type: "season",
      seasoningId: "vinegar",
      amount: { level: "moderate", precise: false },
    });
    expect(acidified.properties.enzymeActivity).toBeLessThan(
      initial.properties.enzymeActivity,
    );
    expect(acidified.flavor.sour).toBeGreaterThan(initial.flavor.sour);
    expect(acidified.events.at(-1)?.title).toContain("酶反应");
  });

  it("changes green color when acid combines with heat", () => {
    const acidified = applyAction(createInitialState("greens"), {
      type: "season",
      seasoningId: "vinegar",
      amount: { level: "little", precise: false },
    });
    const heated = applyAction(acidified, {
      type: "heat",
      method: "stir-fry",
      heatLevel: "high",
      targetTemperature: 180,
      durationMin: 2,
    });
    expect(heated.appearance.color).not.toBe(acidified.appearance.color);
    expect(heated.appearance.label).toContain("橄榄");
  });

  it("creates Maillard potential only when sugar meets a hot dry surface", () => {
    const initial = createInitialState("beef");
    const coolSugar = applyAction(initial, {
      type: "season",
      seasoningId: "sugar",
      amount: { level: "moderate", precise: false },
    });
    const heated = applyAction(
      applyAction(initial, { type: "prep", prepId: "dry" }),
      {
        type: "heat",
        method: "pan-fry",
        heatLevel: "high",
        targetTemperature: 200,
        durationMin: 3,
      },
    );
    const hotSugar = applyAction(heated, {
      type: "season",
      seasoningId: "sugar",
      amount: { level: "moderate", precise: false },
    });

    expect(coolSugar.properties.browning).toBe(initial.properties.browning);
    expect(hotSugar.properties.browning).toBeGreaterThan(
      heated.properties.browning,
    );
    expect(hotSugar.events.at(-1)?.category).toBe("chemical");
  });

  it("lets heated cooking wine reduce fishy aroma more than cold wine", () => {
    const initial = createInitialState("fish");
    const coldWine = applyAction(initial, {
      type: "season",
      seasoningId: "wine",
      amount: { level: "moderate", precise: false },
    });
    const heated = applyAction(initial, {
      type: "heat",
      method: "pan-fry",
      heatLevel: "medium",
      targetTemperature: 140,
      durationMin: 2,
    });
    const hotWine = applyAction(heated, {
      type: "season",
      seasoningId: "wine",
      amount: { level: "moderate", precise: false },
    });

    expect(initial.properties.offAroma - hotWine.properties.offAroma).toBeGreaterThan(
      initial.properties.offAroma - coldWine.properties.offAroma,
    );
  });

  it("gelatinizes starch when water and heat are present", () => {
    const state = replayActions("potato", [
      { type: "season", seasoningId: "water", amount: { level: "moderate", precise: false } },
      { type: "season", seasoningId: "starch", amount: { level: "moderate", precise: false } },
      {
        type: "heat",
        method: "boil",
        heatLevel: "medium",
        targetTemperature: 100,
        durationMin: 4,
      },
    ]);
    expect(state.properties.starchGelatinization).toBeGreaterThan(0);
    expect(
      state.events.some((item) => item.description.includes("糊化")),
    ).toBe(true);
  });

  it("combines salty, sour, sweet and umami instead of replacing one with another", () => {
    const state = replayActions("tomato", [
      {
        type: "season",
        seasoningId: "salt",
        amount: { level: "moderate", precise: false },
      },
      {
        type: "season",
        seasoningId: "vinegar",
        amount: { level: "little", precise: false },
      },
      {
        type: "season",
        seasoningId: "sugar",
        amount: { level: "moderate", precise: false },
      },
      {
        type: "season",
        seasoningId: "light-soy",
        amount: { level: "moderate", precise: false },
      },
    ]);

    expect(state.flavor.salty).toBeGreaterThan(0);
    expect(state.flavor.sour).toBeGreaterThan(0);
    expect(state.flavor.sweet).toBeGreaterThan(0);
    expect(state.flavor.umami).toBeGreaterThan(0);
    expect(state.flavor.intensity).toBeGreaterThan(30);
    expect(state.events).toHaveLength(5);
  });

  it("handles precise amounts without NaN values", () => {
    const state = applyAction(createInitialState("egg"), {
      type: "season",
      seasoningId: "salt",
      amount: { level: "moderate", precise: true, value: 2.5, unit: "g" },
    });
    expect(Number.isNaN(state.flavor.salty)).toBe(false);
    expect(state.flavor.salty).toBeGreaterThan(0);
  });

  it("updates heat, doneness and appearance for egg", () => {
    const state = applyAction(createInitialState("egg"), {
      type: "heat",
      method: "stir-fry",
      heatLevel: "high",
      targetTemperature: 220,
      durationMin: 6,
    });
    expect(state.properties.cookedness).toBeGreaterThan(40);
    expect(state.properties.temperature).toBe(220);
    expect(state.appearance.label).not.toBe("流动蛋液");
  });
});
