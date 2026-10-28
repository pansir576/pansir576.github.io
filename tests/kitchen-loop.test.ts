import { describe, expect, it } from "vitest";
import { buildFeedback } from "@/lib/feedback";
import { ingredients } from "@/lib/ingredients";
import { planKitchenTasks } from "@/lib/kitchen-tasks";
import {
  advanceCookingSession,
  applyAction,
  createInitialState,
  finishCookingSession,
} from "@/lib/simulator";
import type { CookingSession, KitchenWorkspace } from "@/lib/types";

function workspace(overrides: Partial<KitchenWorkspace> = {}): KitchenWorkspace {
  return {
    station: "sink",
    sampleStation: "sink",
    inPan: false,
    ...overrides,
  };
}

describe("dynamic kitchen tasks", () => {
  it("creates a valid four-step flow for all 55 ingredients", () => {
    for (const ingredient of ingredients) {
      const tasks = planKitchenTasks(ingredient.id, [], workspace());
      expect(tasks).toHaveLength(4);
      expect(tasks.filter((task) => task.active)).toHaveLength(1);
      expect(tasks[0].active).toBe(true);
      for (const task of tasks) {
        if (task.operationId) expect(task.operationId.length).toBeGreaterThan(2);
      }
    }
  });

  it("marks completed work and highlights the next task", () => {
    const cleaned = applyAction(createInitialState("greens"), {
      type: "operation",
      operationId: "wash",
    });
    const tasks = planKitchenTasks(
      "greens",
      [{ type: "operation", operationId: "wash" }],
      workspace({ station: "board", sampleStation: "board" }),
    );
    expect(cleaned.flags).toContain("washed");
    expect(tasks[0].completed).toBe(true);
    expect(tasks[1].active).toBe(true);
    expect(tasks[0].completed && !tasks[0].active).toBe(true);
  });

  it("completes the pan task from workspace state", () => {
    const tasks = planKitchenTasks("shrimp", [], workspace({
      station: "pan",
      sampleStation: "pan",
      inPan: true,
    }));
    expect(tasks.at(-1)?.completed).toBe(true);
  });
});

describe("live cooking session", () => {
  it("raises temperature and doneness from fixed ticks", () => {
    const initial = createInitialState("beef");
    const session: CookingSession = {
      isHeating: true,
      targetTemperature: 190,
      currentTemperature: initial.properties.temperature,
      elapsedSimSeconds: 0,
      heatLevel: "high",
      method: "pan-fry",
      lidCovered: false,
      stirIntensity: "none",
    };
    const first = advanceCookingSession(initial, session, 1);
    const second = advanceCookingSession(first.state, first.session, 1);
    expect(second.session.currentTemperature).toBeGreaterThan(
      first.session.currentTemperature,
    );
    expect(second.state.properties.cookedness).toBeGreaterThan(0);
    expect(second.session.elapsedSimSeconds).toBe(20);
  });

  it("adds one consolidated event when the user stops heating", () => {
    const initial = createInitialState("tofu");
    let current = initial;
    let session: CookingSession = {
      isHeating: true,
      targetTemperature: 180,
      currentTemperature: initial.properties.temperature,
      elapsedSimSeconds: 0,
      heatLevel: "medium",
      method: "pan-fry",
      lidCovered: false,
      stirIntensity: "gentle",
    };
    for (let index = 0; index < 4; index += 1) {
      const result = advanceCookingSession(current, session, 1);
      current = result.state;
      session = result.session;
    }
    const finished = finishCookingSession(initial, current, session);
    expect(finished.events).toHaveLength(initial.events.length + 1);
    expect(finished.actionCount).toBe(1);
    expect(finished.events.at(-1)?.title.length).toBeGreaterThan(6);
  });

  it("produces immediate feedback from water and temperature state", () => {
    const wet = createInitialState("greens");
    wet.properties.surfaceMoisture = 72;
    expect(buildFeedback(wet).tone).toBe("warning");
    const hot = createInitialState("beef");
    hot.properties.temperature = 190;
    hot.properties.surfaceMoisture = 20;
    expect(buildFeedback(hot).text).toContain("锅温");
  });
});
