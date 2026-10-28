import { getIngredient } from "./ingredients";
import type { ExperimentSummary, PostCategory } from "./community/types";
import type { GuidedCookSession } from "./types";

export const GUIDED_SESSION_KEY = "simulating-cook:guided-session:v1";
export const GUIDED_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const GUIDED_SHARE_DRAFT_KEY = "simulating-cook:community-share:v1";

export interface GuidedShareDraft {
  category: PostCategory;
  title: string;
  body: string;
  tags: string[];
  experimentSummary: ExperimentSummary;
}

const phases = new Set([
  "partner",
  "ingredient",
  "prepare",
  "pan",
  "cook",
  "plate",
  "recap",
]);

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isSession(value: unknown): value is GuidedCookSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<GuidedCookSession>;
  if (
    session.version !== 1 ||
    !phases.has(session.phase ?? "") ||
    !Array.isArray(session.actions) ||
    !Array.isArray(session.history) ||
    !session.workspace ||
    typeof session.createdAt !== "string" ||
    typeof session.updatedAt !== "string"
  ) {
    return false;
  }
  if (
    session.partnerId !== null &&
    !["xiaoyan", "zhiwei", "axian"].includes(session.partnerId ?? "")
  ) {
    return false;
  }
  if (session.ingredientId) {
    try {
      getIngredient(session.ingredientId);
    } catch {
      return false;
    }
  }
  if (session.phase !== "partner" && session.phase !== "ingredient") {
    return Boolean(session.ingredientId && session.state);
  }
  return true;
}

export function loadGuidedSession(now = Date.now()): GuidedCookSession | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(GUIDED_SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isSession(parsed)) {
      store.removeItem(GUIDED_SESSION_KEY);
      return null;
    }
    const updated = new Date(parsed.updatedAt).getTime();
    if (!Number.isFinite(updated) || now - updated > GUIDED_SESSION_TTL_MS) {
      store.removeItem(GUIDED_SESSION_KEY);
      return null;
    }
    return {
      ...parsed,
      workspace: {
        ...parsed.workspace,
        session: parsed.workspace.session
          ? { ...parsed.workspace.session, isHeating: false }
          : undefined,
      },
    };
  } catch {
    try {
      store.removeItem(GUIDED_SESSION_KEY);
    } catch {
      // Corrupt data must never prevent the kitchen from opening.
    }
    return null;
  }
}

export function saveGuidedSession(session: GuidedCookSession): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(
      GUIDED_SESSION_KEY,
      JSON.stringify({
        ...session,
        updatedAt: new Date().toISOString(),
        workspace: {
          ...session.workspace,
          session: session.workspace.session
            ? { ...session.workspace.session, isHeating: false }
            : undefined,
        },
      }),
    );
  } catch {
    // The guided flow remains usable when storage is full or disabled.
  }
}

export function clearGuidedSession(): void {
  const store = storage();
  try {
    store?.removeItem(GUIDED_SESSION_KEY);
  } catch {
    // Clearing an optional local session should always be non-blocking.
  }
}

export function storeGuidedShareDraft(draft: GuidedShareDraft): void {
  const store = storage();
  try {
    store?.setItem(GUIDED_SHARE_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Community handoff is optional when local storage is unavailable.
  }
}

export function takeGuidedShareDraft(): GuidedShareDraft | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(GUIDED_SHARE_DRAFT_KEY);
    store.removeItem(GUIDED_SHARE_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuidedShareDraft;
    if (
      !parsed ||
      typeof parsed.title !== "string" ||
      typeof parsed.body !== "string" ||
      !Array.isArray(parsed.tags) ||
      !parsed.experimentSummary
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
