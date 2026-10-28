import { beforeEach, describe, expect, it } from "vitest";
import { createInitialState } from "@/lib/simulator";
import {
  addExperiment,
  COMPARISON_KEY,
  EXPERIMENTS_KEY,
  LEGACY_EXPERIMENTS_KEY,
  loadComparisonIds,
  loadExperiments,
  MAX_EXPERIMENTS,
  storeComparisonIds,
} from "@/lib/storage";
import type { ExperimentSnapshot } from "@/lib/types";

function snapshot(index: number): ExperimentSnapshot {
  return {
    version: 2,
    id: `experiment-${index}`,
    name: `实验 ${index}`,
    ingredientId: "potato",
    actions: [
      {
        type: "season",
        seasoningId: "salt",
        amount: { level: "little", precise: false },
      },
    ],
    state: createInitialState("potato"),
    createdAt: new Date(2026, 0, index + 1).toISOString(),
    branchLabel: "A 分支",
  };
}

describe("local experiment storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns an empty list for corrupt JSON", () => {
    window.localStorage.setItem(EXPERIMENTS_KEY, "{not-json");
    expect(loadExperiments()).toEqual([]);
  });

  it("ignores malformed snapshots while retaining valid ones", () => {
    window.localStorage.setItem(
      EXPERIMENTS_KEY,
      JSON.stringify([snapshot(1), { version: 2, id: "broken" }]),
    );
    expect(loadExperiments()).toHaveLength(1);
    expect(loadExperiments()[0].id).toBe("experiment-1");
  });

  it("limits saved experiments to 20", () => {
    let stored: ExperimentSnapshot[] = [];
    for (let index = 0; index < MAX_EXPERIMENTS + 4; index += 1) {
      stored = addExperiment(snapshot(index));
    }
    expect(stored).toHaveLength(MAX_EXPERIMENTS);
  });

  it("deduplicates and limits comparison selection to three", () => {
    storeComparisonIds(["a", "a", "b", "c", "d"]);
    expect(loadComparisonIds()).toEqual(["a", "b", "c"]);
  });

  it("persists versioned experiment data", () => {
    addExperiment(snapshot(5));
    const raw = window.localStorage.getItem(EXPERIMENTS_KEY);
    expect(raw).toContain('"version":2');
    expect(loadExperiments()[0].name).toBe("实验 5");
  });

  it("migrates legacy version 1 snapshots without losing the experiment", () => {
    const current = snapshot(7);
    const legacyState = structuredClone(current.state) as unknown as Record<
      string,
      unknown
    >;
    const properties = {
      ...current.state.properties,
    } as Record<string, unknown>;
    delete properties.surfaceMoisture;
    delete properties.saltLoad;
    delete properties.ph;
    delete properties.proteinCoagulation;
    delete properties.starchHydration;
    delete properties.oxidation;
    delete properties.shapeIntegrity;
    delete properties.heatPenetration;
    legacyState.properties = properties;

    window.localStorage.setItem(
      LEGACY_EXPERIMENTS_KEY,
      JSON.stringify([
        {
          ...current,
          version: 1,
          state: legacyState,
        },
      ]),
    );

    const migrated = loadExperiments();
    expect(migrated).toHaveLength(1);
    expect(migrated[0].version).toBe(2);
    expect(migrated[0].id).toBe("experiment-7");
    expect(typeof migrated[0].state.properties.surfaceMoisture).toBe("number");
    expect(window.localStorage.getItem(EXPERIMENTS_KEY)).toContain('"version":2');
  });

  it("survives denied localStorage access", () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("denied");
      },
    });
    expect(loadExperiments()).toEqual([]);
    expect(loadComparisonIds()).toEqual([]);
    if (original) Object.defineProperty(window, "localStorage", original);
    expect(window.localStorage.getItem(COMPARISON_KEY)).toBeNull();
  });
});
