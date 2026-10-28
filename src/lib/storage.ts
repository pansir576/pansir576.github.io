import { createInitialState } from "./simulator";
import type {
  CausalEvent,
  ExperimentSnapshot,
  GuidePartnerId,
  LegacyExperimentSnapshot,
  OutcomeGoal,
  SimulationEvent,
} from "./types";

export const EXPERIMENTS_KEY = "cooking-lab:experiments:v2";
export const LEGACY_EXPERIMENTS_KEY = "cooking-lab:experiments:v1";
export const COMPARISON_KEY = "cooking-lab:comparison:v1";
export const MAX_EXPERIMENTS = 20;
export const MAX_COMPARISON = 3;

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function hasSnapshotBase(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.ingredientId === "string" &&
    Array.isArray(value.actions) &&
    isRecord(value.state) &&
    typeof value.createdAt === "string"
  );
}

function isValidSnapshot(value: unknown): value is ExperimentSnapshot {
  return hasSnapshotBase(value) && value.version === 2;
}

function migrateEvent(event: SimulationEvent): CausalEvent {
  return {
    ...event,
    principleTags: [],
    before: {
      moisture: "",
      surface: "",
      texture: "",
      flavor: "",
      color: "",
    },
    after: {
      moisture: "",
      surface: "",
      texture: "",
      flavor: "",
      color: "",
    },
    transfer: "此步骤来自旧版实验，因果信息从下一次操作开始记录。",
  };
}

function migrateLegacySnapshot(
  snapshot: LegacyExperimentSnapshot,
): ExperimentSnapshot {
  const fresh = createInitialState(snapshot.ingredientId);
  return {
    version: 2,
    id: snapshot.id,
    name: snapshot.name,
    ingredientId: snapshot.ingredientId,
    actions: snapshot.actions,
    state: {
      ...fresh,
      ...snapshot.state,
      properties: {
        ...fresh.properties,
        ...snapshot.state.properties,
      },
      events: (snapshot.state.events ?? [fresh.events[0]]).map(migrateEvent),
    },
    createdAt: snapshot.createdAt,
    branchLabel: "旧版单线实验",
  };
}

export function loadExperiments(): ExperimentSnapshot[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const rawV2 = storage.getItem(EXPERIMENTS_KEY);
    const rawLegacy = rawV2 ? null : storage.getItem(LEGACY_EXPERIMENTS_KEY);
    const raw = rawV2 ?? rawLegacy;
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];

    let migrated = false;
    const experiments = data
      .map((item) => {
        if (isValidSnapshot(item)) return item;
        if (hasSnapshotBase(item) && item.version === 1) {
          migrated = true;
          return migrateLegacySnapshot(
            item as unknown as LegacyExperimentSnapshot,
          );
        }
        return null;
      })
      .filter((item): item is ExperimentSnapshot => Boolean(item))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, MAX_EXPERIMENTS);

    if (migrated && experiments.length > 0) {
      storage.setItem(EXPERIMENTS_KEY, JSON.stringify(experiments));
    }
    return experiments;
  } catch {
    return [];
  }
}

export function storeExperiments(
  experiments: ExperimentSnapshot[],
): ExperimentSnapshot[] {
  const clean = experiments
    .filter(isValidSnapshot)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, MAX_EXPERIMENTS);
  try {
    getStorage()?.setItem(EXPERIMENTS_KEY, JSON.stringify(clean));
  } catch {
    // A full or disabled localStorage should not break the simulator.
  }
  return clean;
}

export function addExperiment(
  experiment: ExperimentSnapshot,
): ExperimentSnapshot[] {
  const current = loadExperiments().filter((item) => item.id !== experiment.id);
  return storeExperiments([experiment, ...current]);
}

export function removeExperiment(id: string): ExperimentSnapshot[] {
  const experiments = loadExperiments().filter((item) => item.id !== id);
  const stored = storeExperiments(experiments);
  storeComparisonIds(loadComparisonIds().filter((item) => item !== id));
  return stored;
}

export function loadComparisonIds(): string[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(COMPARISON_KEY);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter((item): item is string => typeof item === "string")
      .slice(0, MAX_COMPARISON);
  } catch {
    return [];
  }
}

export function storeComparisonIds(ids: string[]): string[] {
  const clean = Array.from(new Set(ids)).slice(0, MAX_COMPARISON);
  try {
    getStorage()?.setItem(COMPARISON_KEY, JSON.stringify(clean));
  } catch {
    // Keep comparison controls usable even when persistence is unavailable.
  }
  return clean;
}

export function createSnapshot(
  ingredientId: string,
  name: string,
  actions: ExperimentSnapshot["actions"],
  state: ExperimentSnapshot["state"],
  branchGroupId?: string,
  branchLabel?: string,
  metadata?: {
    dishName?: string;
    goal?: OutcomeGoal;
    partnerId?: GuidePartnerId;
  },
): ExperimentSnapshot {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `experiment-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    version: 2,
    id,
    name: name.trim() || "未命名实验",
    ingredientId,
    actions: structuredClone(actions),
    state: structuredClone(state),
    createdAt: new Date().toISOString(),
    branchGroupId,
    branchLabel,
    ...metadata,
  };
}
