import {
  ensureAnonymousUser,
  getCommunityClient,
} from "./community/supabase";
import type {
  ProgressSummary,
  ThreeDTrainingSession,
  TrainingGrade,
  TrainingRun,
} from "./types";

export const THREE_D_PROGRESS_KEY = "simulating-cook:3d-progress:v1";
export const THREE_D_PENDING_RUNS_KEY = "simulating-cook:3d-pending-runs:v1";
export const THREE_D_SESSION_KEY = "simulating-cook:3d-session:v1";

export const emptyProgress = (): ProgressSummary => ({
  completedRuns: 0,
  perfectCount: 0,
  goodCount: 0,
  ordinaryCount: 0,
  burntCount: 0,
  totalTrainingSeconds: 0,
});

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isProgress(value: unknown): value is ProgressSummary {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ProgressSummary>;
  return (
    typeof item.completedRuns === "number" &&
    typeof item.perfectCount === "number" &&
    typeof item.goodCount === "number" &&
    typeof item.ordinaryCount === "number" &&
    typeof item.burntCount === "number" &&
    typeof item.totalTrainingSeconds === "number"
  );
}

export function loadLocalProgress(): ProgressSummary {
  const store = storage();
  if (!store) return emptyProgress();
  try {
    const raw = store.getItem(THREE_D_PROGRESS_KEY);
    if (!raw) return emptyProgress();
    const parsed: unknown = JSON.parse(raw);
    if (!isProgress(parsed)) {
      store.removeItem(THREE_D_PROGRESS_KEY);
      return emptyProgress();
    }
    return parsed;
  } catch {
    store.removeItem(THREE_D_PROGRESS_KEY);
    return emptyProgress();
  }
}

export function saveLocalProgress(progress: ProgressSummary): void {
  try {
    storage()?.setItem(THREE_D_PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Progress remains usable for the current page session.
  }
}

export function applyRunToProgress(
  progress: ProgressSummary,
  run: TrainingRun,
): ProgressSummary {
  const key: `${TrainingGrade}Count` =
    `${run.grade}Count` as `${TrainingGrade}Count`;
  return {
    ...progress,
    completedRuns: progress.completedRuns + 1,
    [key]: progress[key] + 1,
    totalTrainingSeconds:
      progress.totalTrainingSeconds + run.durationSeconds,
    lastIngredientId: run.ingredientId,
    lastDishName: run.dishName,
    lastGrade: run.grade,
    updatedAt: run.createdAt,
  };
}

export function loadPendingRuns(): TrainingRun[] {
  const store = storage();
  if (!store) return [];
  try {
    const parsed: unknown = JSON.parse(
      store.getItem(THREE_D_PENDING_RUNS_KEY) ?? "[]",
    );
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (run): run is TrainingRun =>
        Boolean(
          run &&
            typeof run === "object" &&
            typeof run.runKey === "string" &&
            typeof run.ingredientId === "string",
        ),
    );
  } catch {
    return [];
  }
}

function savePendingRuns(runs: TrainingRun[]): void {
  try {
    storage()?.setItem(
      THREE_D_PENDING_RUNS_KEY,
      JSON.stringify(runs.slice(-100)),
    );
  } catch {
    // Cloud sync retries naturally on a later page visit.
  }
}

export function queueTrainingRun(run: TrainingRun): TrainingRun[] {
  const pending = loadPendingRuns();
  if (pending.some((item) => item.runKey === run.runKey)) return pending;
  const next = [...pending, run];
  savePendingRuns(next);
  return next;
}

function cloudProgress(row: Record<string, unknown>): ProgressSummary {
  return {
    completedRuns: Number(row.completed_runs ?? 0),
    perfectCount: Number(row.perfect_count ?? 0),
    goodCount: Number(row.good_count ?? 0),
    ordinaryCount: Number(row.ordinary_count ?? 0),
    burntCount: Number(row.burnt_count ?? 0),
    totalTrainingSeconds: Number(row.total_training_seconds ?? 0),
    lastIngredientId:
      typeof row.last_ingredient_id === "string"
        ? row.last_ingredient_id
        : undefined,
    lastDishName:
      typeof row.last_dish_name === "string" ? row.last_dish_name : undefined,
    lastGrade:
      typeof row.last_grade === "string"
        ? (row.last_grade as TrainingGrade)
        : undefined,
    updatedAt:
      typeof row.updated_at === "string" ? row.updated_at : undefined,
  };
}

export async function syncTrainingRun(
  run: TrainingRun,
): Promise<ProgressSummary | null> {
  const supabase = getCommunityClient();
  if (!supabase) {
    queueTrainingRun(run);
    return null;
  }
  try {
    await ensureAnonymousUser();
    const { data, error } = await supabase.rpc(
      "record_simulating_cook_training",
      {
        p_run: {
          run_key: run.runKey,
          ingredient_id: run.ingredientId,
          dish_name: run.dishName,
          grade: run.grade,
          cookedness: run.cookedness,
          duration_seconds: run.durationSeconds,
          summary: run.summary,
          created_at: run.createdAt,
        },
      },
    );
    if (error || !data?.[0]) throw error ?? new Error("empty progress");
    return cloudProgress(data[0] as Record<string, unknown>);
  } catch {
    queueTrainingRun(run);
    return null;
  }
}

export async function loadCloudProgress(): Promise<ProgressSummary | null> {
  const supabase = getCommunityClient();
  if (!supabase) return null;
  try {
    await ensureAnonymousUser();
    const { data, error } = await supabase.rpc(
      "get_simulating_cook_progress",
    );
    if (error || !data?.[0]) return null;
    return cloudProgress(data[0] as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function flushPendingTrainingRuns(): Promise<ProgressSummary | null> {
  const pending = loadPendingRuns();
  if (!pending.length) return loadCloudProgress();
  let latest: ProgressSummary | null = null;
  const remaining: TrainingRun[] = [];
  for (const run of pending) {
    const progress = await syncTrainingRun(run);
    if (progress) latest = progress;
    else remaining.push(run);
  }
  savePendingRuns(remaining);
  return latest ?? loadCloudProgress();
}

export function saveThreeDSession(session: ThreeDTrainingSession): void {
  try {
    storage()?.setItem(
      THREE_D_SESSION_KEY,
      JSON.stringify({
        ...session,
        updatedAt: new Date().toISOString(),
        stationState: {
          ...session.stationState,
          heating: false,
        },
      }),
    );
  } catch {
    // A disabled storage backend should not stop the training page.
  }
}

export function loadThreeDSession(
  now = Date.now(),
): ThreeDTrainingSession | null {
  const store = storage();
  if (!store) return null;
  try {
    const parsed = JSON.parse(
      store.getItem(THREE_D_SESSION_KEY) ?? "null",
    ) as ThreeDTrainingSession | null;
    if (
      !parsed ||
      parsed.version !== 1 ||
      !parsed.phase ||
      !parsed.stationState ||
      !Array.isArray(parsed.actions)
    ) {
      store.removeItem(THREE_D_SESSION_KEY);
      return null;
    }
    const updated = new Date(parsed.updatedAt).getTime();
    if (!Number.isFinite(updated) || now - updated > 24 * 60 * 60 * 1000) {
      store.removeItem(THREE_D_SESSION_KEY);
      return null;
    }
    return {
      ...parsed,
      guideId: parsed.guideId ?? "orange",
      stationState: {
        ...parsed.stationState,
        heating: false,
      },
    };
  } catch {
    store.removeItem(THREE_D_SESSION_KEY);
    return null;
  }
}

export function clearThreeDSession(): void {
  try {
    storage()?.removeItem(THREE_D_SESSION_KEY);
  } catch {
    // Clearing an optional session is non-blocking.
  }
}
