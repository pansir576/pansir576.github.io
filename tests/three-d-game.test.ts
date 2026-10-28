import { beforeEach, describe, expect, it } from "vitest";
import { ingredients } from "@/lib/ingredients";
import { createInitialState } from "@/lib/simulator";
import {
  advanceHoldInteraction,
  CHOP_HOLD_MS,
  createHoldInteraction,
  createThreeDSession,
  createTrainingRun,
  cutStageFor,
  DANGER_BURN_MS,
  evaluateTrainingResult,
  heatBandFor,
  nextGuideReaction,
  startThreeDIngredient,
} from "@/lib/three-d-game";
import {
  THREE_D_PENDING_RUNS_KEY,
  loadPendingRuns,
  loadThreeDSession,
  queueTrainingRun,
  saveThreeDSession,
} from "@/lib/three-d-storage";

describe("3D hold interactions", () => {
  it("advances while held, freezes on release and resumes", () => {
    let first = createHoldInteraction("chop");
    for (let index = 0; index < 10; index += 1) {
      first = advanceHoldInteraction(first, true, 100);
    }
    expect(first.progress).toBeCloseTo((1000 / CHOP_HOLD_MS) * 100, 1);
    expect(first.active).toBe(true);

    let paused = first;
    for (let index = 0; index < 4; index += 1) {
      paused = advanceHoldInteraction(paused, false, 100);
    }
    expect(paused.progress).toBe(first.progress);
    expect(paused.active).toBe(false);
    expect(paused.pausedMs).toBe(400);

    const resumed = advanceHoldInteraction(paused, true, 400);
    expect(resumed.progress).toBeGreaterThan(paused.progress);
    expect(resumed.pausedMs).toBe(0);
  });

  it("reports the four cutting shape phases", () => {
    expect(cutStageFor(0)).toBe("whole");
    expect(cutStageFor(30)).toBe("scored");
    expect(cutStageFor(60)).toBe("strips");
    expect(cutStageFor(100)).toBe("cut");
  });
});

describe("3D heat and result evaluation", () => {
  it("maps safe cookedness to the three heat bands plus danger", () => {
    expect(heatBandFor(20, 60)).toBe("green");
    expect(heatBandFor(50, 60)).toBe("yellow");
    expect(heatBandFor(60, 60)).toBe("perfect");
    expect(heatBandFor(67, 60)).toBe("perfect");
    expect(heatBandFor(68, 60)).toBe("danger");
    expect(heatBandFor(69, 60, DANGER_BURN_MS)).toBe("burnt");
  });

  it("returns perfect, ordinary and burnt outcomes from live state", () => {
    const state = createInitialState("potato");
    state.properties.cookedness = 60;
    expect(
      evaluateTrainingResult(state, 55, "perfect", 0).grade,
    ).toBe("perfect");

    state.properties.cookedness = 70;
    expect(
      evaluateTrainingResult(state, 55, "danger", 1000).grade,
    ).toBe("ordinary");
    expect(
      evaluateTrainingResult(
        state,
        55,
        "burnt",
        DANGER_BURN_MS,
      ).grade,
    ).toBe("burnt");
  });

  it("prioritizes urgent AI reactions over ordinary hints", () => {
    expect(
      nextGuideReaction({
        phase: "cook",
        cleaned: false,
        chopProgress: 20,
        chopPausedMs: 4000,
        heatBand: "danger",
        dangerMs: 5200,
      })?.trigger,
    ).toBe("heat-danger");
    expect(
      nextGuideReaction({
        phase: "result",
        cleaned: false,
        chopProgress: 0,
        chopPausedMs: 0,
        heatBand: "burnt",
        dangerMs: DANGER_BURN_MS,
        grade: "burnt",
      })?.trigger,
    ).toBe("burnt");
  });
});

describe("3D ingredient and local storage", () => {
  it("starts every one of the 55 ingredients without throwing", () => {
    for (const ingredient of ingredients) {
      const session = startThreeDIngredient(
        createThreeDSession(),
        ingredient.id,
      );
      expect(session.phase).toBe("wash");
      expect(session.state?.ingredientId).toBe(ingredient.id);
      expect(session.stationState.cleaned).toBe(false);
    }
  });

  it("creates a run with the selected 3D result", () => {
    const session = startThreeDIngredient(createThreeDSession(), "potato");
    session.stationState.cleaned = true;
    session.stationState.chopped = true;
    session.state!.properties.cookedness = 60;
    const run = createTrainingRun(session, "perfect", 31);
    expect(run.ingredientId).toBe("potato");
    expect(run.grade).toBe("perfect");
    expect(run.durationSeconds).toBe(31);
  });

  it("deduplicates the offline queue and restores paused sessions", () => {
    window.localStorage.clear();
    const session = startThreeDIngredient(createThreeDSession(), "tofu");
    session.stationState.heating = true;
    saveThreeDSession(session);
    expect(loadThreeDSession()?.stationState.heating).toBe(false);

    const run = createTrainingRun(
      {
        ...startThreeDIngredient(createThreeDSession(), "tofu"),
        stationState: {
          ...startThreeDIngredient(createThreeDSession(), "tofu")
            .stationState,
          cleaned: true,
          chopped: true,
        },
      },
      "good",
      12,
    );
    queueTrainingRun(run);
    queueTrainingRun(run);
    expect(loadPendingRuns()).toHaveLength(1);
    expect(
      JSON.parse(
        window.localStorage.getItem(THREE_D_PENDING_RUNS_KEY) ?? "[]",
      ),
    ).toHaveLength(1);
  });

  beforeEach(() => {
    window.localStorage.clear();
  });
});
