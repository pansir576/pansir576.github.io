import { beforeEach, describe, expect, it } from "vitest";
import {
  buildDishRecap,
  createGuidedSession,
  dishCompletion,
  guidedDishProfile,
  guidedOperations,
  guidedPhases,
  guidedStepStatus,
  preparationChecks,
  preparationComplete,
  recommendedIngredientIds,
  startGuidedIngredient,
} from "@/lib/guided-cook";
import { buildGuideRequest, answerGuideLocally } from "@/lib/guide-assistant";
import {
  GUIDED_SESSION_KEY,
  clearGuidedSession,
  loadGuidedSession,
  saveGuidedSession,
  storeGuidedShareDraft,
  takeGuidedShareDraft,
} from "@/lib/guided-storage";
import { ingredients } from "@/lib/ingredients";
import { applyAction, createInitialState } from "@/lib/simulator";
import type { KitchenAction, KitchenWorkspace } from "@/lib/types";

const workspace: KitchenWorkspace = {
  station: "board",
  sampleStation: "board",
  inPan: false,
};

describe("guided cooking workflow", () => {
  it("creates a valid recommendation and dish profile for all ingredients", () => {
    for (const ingredient of ingredients) {
      const recommendations = recommendedIngredientIds(
        ingredient.archetype === "egg" ? "tenderer" : "crisper",
      );
      expect(recommendations.length).toBe(3);
      expect(recommendations.every((id) => ingredients.some((item) => item.id === id))).toBe(true);

      const profile = guidedDishProfile(ingredient.id, "crisper");
      expect(profile.dishName).toContain(ingredient.name);
      expect(profile.requiredPreparationIds.length).toBeGreaterThanOrEqual(2);
      expect(profile.safetyCookedness).toBe(ingredient.safeCookedness);

      const operations = guidedOperations(
        ingredient.id,
        [],
        workspace,
        "crisper",
      );
      const availableIds = operations.common
        .concat(operations.more)
        .map((item) => item.id);
      for (const operationId of profile.requiredPreparationIds) {
        expect(availableIds).toContain(operationId);
      }
    }
  });

  it("lets every ingredient complete preparation and reach plating rules", () => {
    for (const ingredient of ingredients) {
      const profile = guidedDishProfile(
        ingredient.id,
        "more-aromatic",
      );
      let state = createInitialState(ingredient.id);
      const actions: KitchenAction[] = [];
      for (const operationId of Array.from(
        new Set(profile.requiredPreparationIds),
      )) {
        const action: KitchenAction = {
          type: "operation",
          operationId,
        };
        actions.push(action);
        state = applyAction(state, action);
      }
      expect(
        preparationComplete(
          ingredient.id,
          actions,
          workspace,
          "more-aromatic",
        ),
        ingredient.name,
      ).toBe(true);

      const heatAction: KitchenAction = {
        type: "heat",
        method: "braise",
        heatLevel: "medium",
        targetTemperature: 95,
        durationMin: 60,
        lidCovered: true,
        stirIntensity: "none",
      };
      actions.push(heatAction);
      state = applyAction(state, heatAction);
      const completion = dishCompletion(
        ingredient.id,
        state,
        actions,
        { station: "pan", sampleStation: "pan", inPan: true },
        "more-aromatic",
      );
      expect(
        completion.canPlate,
        `${ingredient.name} (${state.properties.cookedness}/${ingredient.safeCookedness}): ${completion.missing.join(", ")}`,
      ).toBe(true);
    }
  });

  it("gates preparation and tracks required drying by goal", () => {
    const session = {
      ...startGuidedIngredient(createGuidedSession(), "potato", "crisper"),
    };
    expect(session.phase).toBe("prepare");
    const initialChecks = preparationChecks(
      "potato",
      [],
      session.workspace,
      "crisper",
    );
    expect(initialChecks.find((check) => check.id === "dry")?.required).toBe(
      true,
    );
    expect(preparationComplete("potato", [], session.workspace, "crisper")).toBe(
      false,
    );

    let state = createInitialState("potato");
    const actions: KitchenAction[] = [
      { type: "operation", operationId: "wash" },
      { type: "operation", operationId: "cut-small" },
      { type: "operation", operationId: "archetype-root-dry" },
    ];
    for (const action of actions) state = applyAction(state, action);
    expect(preparationComplete("potato", actions, session.workspace, "crisper")).toBe(
      true,
    );
  });

  it("requires safe heat and a stopped pan before plating", () => {
    let state = createInitialState("beef");
    const prepActions: KitchenAction[] = [
      { type: "operation", operationId: "wash" },
      { type: "operation", operationId: "archetype-meat-slice" },
      { type: "operation", operationId: "surface-dry" },
    ];
    for (const action of prepActions) state = applyAction(state, action);

    const beforeHeat = dishCompletion(
      "beef",
      state,
      prepActions,
      { station: "pan", sampleStation: "pan", inPan: true },
      "tenderer",
    );
    expect(beforeHeat.canPlate).toBe(false);

    const heatAction: KitchenAction = {
      type: "heat",
      method: "pan-fry",
      heatLevel: "medium",
      targetTemperature: 180,
      durationMin: 8,
      lidCovered: false,
      stirIntensity: "gentle",
    };
    state = applyAction(state, heatAction);
    const completion = dishCompletion(
      "beef",
      state,
      [...prepActions, heatAction],
      { station: "pan", sampleStation: "pan", inPan: true },
      "tenderer",
    );
    expect(completion.canPlate).toBe(true);
    expect(completion.checks.find((check) => check.id === "stopped")?.passed).toBe(
      true,
    );
  });

  it("builds recap content from actual causal events", () => {
    let state = createInitialState("potato");
    const actions: KitchenAction[] = [
      { type: "operation", operationId: "wash" },
      { type: "operation", operationId: "cut-small" },
      {
        type: "heat",
        method: "stir-fry",
        heatLevel: "high",
        targetTemperature: 190,
        durationMin: 3,
      },
    ];
    for (const action of actions) state = applyAction(state, action);
    const recap = buildDishRecap("potato", state, actions, "crisper");
    expect(recap.dishName).toBe("快炒土豆");
    expect(recap.mechanisms.length).toBeGreaterThan(0);
    expect(recap.flavorSummary.length).toBeGreaterThan(0);
  });

  it("marks the seven guided phases consistently", () => {
    expect(guidedPhases).toHaveLength(7);
    expect(guidedStepStatus("partner", "prepare")).toBe("completed");
    expect(guidedStepStatus("prepare", "prepare")).toBe("active");
    expect(guidedStepStatus("cook", "prepare")).toBe("upcoming");
  });

  it("answers from the local knowledge base when AI is unavailable", () => {
    const session = startGuidedIngredient(
      {
        ...createGuidedSession(),
        partnerId: "zhiwei",
      },
      "greens",
      "crisper",
    );
    const request = buildGuideRequest(session, "盐为什么会让青菜出水？");
    const response = answerGuideLocally(request);
    expect(response.provider).toBe("local");
    expect(response.answer).toContain("浓度差");
    expect(response.citations.some((item) => item.id === "greens")).toBe(true);
  });
});

describe("guided session storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("round-trips a valid session and restores it paused", () => {
    const session = startGuidedIngredient(
      {
        ...createGuidedSession(),
        partnerId: "axian",
      },
      "tofu",
      "more-seasoned",
    );
    saveGuidedSession({
      ...session,
      workspace: {
        ...session.workspace,
        session: {
          isHeating: true,
          targetTemperature: 180,
          currentTemperature: 160,
          elapsedSimSeconds: 30,
          heatLevel: "medium",
          method: "pan-fry",
          lidCovered: false,
          stirIntensity: "gentle",
        },
      },
    });
    const loaded = loadGuidedSession(Date.now());
    expect(loaded?.ingredientId).toBe("tofu");
    expect(loaded?.workspace.session?.isHeating).toBe(false);
  });

  it("drops expired or corrupt sessions without throwing", () => {
    const session = startGuidedIngredient(
      {
        ...createGuidedSession(),
        partnerId: "xiaoyan",
      },
      "potato",
      null,
    );
    saveGuidedSession(session);
    expect(loadGuidedSession(Date.now() + 25 * 60 * 60 * 1000)).toBeNull();

    window.localStorage.setItem(GUIDED_SESSION_KEY, "{bad json");
    expect(() => loadGuidedSession()).not.toThrow();
    expect(loadGuidedSession()).toBeNull();
    clearGuidedSession();
    expect(window.localStorage.getItem(GUIDED_SESSION_KEY)).toBeNull();
  });

  it("hands a sanitized experiment draft to the community composer once", () => {
    storeGuidedShareDraft({
      category: "experiment",
      title: "我做了快炒土豆，想分享这次变化",
      body: "这次只改变了一个处理变量，想和大家讨论口感变化。",
      tags: ["土豆", "更脆"],
      experimentSummary: {
        experimentId: "guided-1",
        name: "快炒土豆",
        ingredientId: "potato",
        goal: "crisper",
        actionCount: 4,
        appearance: "切丝受热",
        flavorSummary: "整体清淡",
        textureSummary: "嫩度 30，脆度 68",
      },
    });
    const draft = takeGuidedShareDraft();
    expect(draft?.title).toContain("快炒土豆");
    expect(draft?.experimentSummary.ingredientId).toBe("potato");
    expect(takeGuidedShareDraft()).toBeNull();
  });
});
