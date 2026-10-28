/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/immutability, react-hooks/preserve-manual-memoization, react-hooks/set-state-in-effect */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChefHat,
  ChevronDown,
  Cloud,
  CloudOff,
  Flame,
  Gauge,
  Hand,
  Info,
  LoaderCircle,
  MessageCircle,
  Move,
  RotateCcw,
  Send,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { IngredientArt } from "@/components/ingredient-art";
import { getIngredient, ingredients } from "@/lib/ingredients";
import { hasIngredientPhoto, ingredientPhoto } from "@/lib/media";
import { seasonings } from "@/lib/principles";
import {
  advanceCookingSession,
  applyAction,
  finishCookingSession,
} from "@/lib/simulator";
import {
  addExperiment,
  createSnapshot,
} from "@/lib/storage";
import {
  advanceHoldInteraction,
  buildThreeDRecap,
  createHoldInteraction,
  createTrainingRun,
  createThreeDSession,
  evaluateTrainingResult,
  heatBandFor,
  nextGuideReaction,
  startThreeDIngredient,
  trainingGradeDescriptions,
  trainingGradeLabels,
  threeDGuides,
} from "@/lib/three-d-game";
import {
  addThreeDOil,
  completeChop,
  completeWash,
} from "@/lib/three-d-game";
import {
  clearThreeDSession,
  flushPendingTrainingRuns,
  loadLocalProgress,
  loadThreeDSession,
  saveLocalProgress,
  saveThreeDSession,
  syncTrainingRun,
} from "@/lib/three-d-storage";
import { askCookingGuide } from "@/lib/guide-assistant";
import { buildExperimentSummary } from "@/lib/community/validation";
import { storeGuidedShareDraft } from "@/lib/guided-storage";
import { playKitchenSound } from "@/lib/kitchen-audio";
import type {
  AIReactionEvent,
  AmountLevel,
  CookingSession,
  DishRecap,
  ExperimentSnapshot,
  GuideMotionState,
  GuideMessage,
  GuidedCookSession,
  HeatAction,
  HeatLevel,
  HeatMethod,
  HoldInteractionKind,
  HoldInteractionState,
  IngredientState,
  InteractionTarget,
  ProgressSummary,
  SeasoningId,
  ThreeDGuideId,
  ThreeDTrainingSession,
  TrainingGrade,
  TrainingRun,
} from "@/lib/types";
import type { TrainingEvaluation } from "@/lib/three-d-game";
import {
  ThreeDKitchenCanvas,
  threeDStations,
  type JoystickInput,
  type TeleportRequest,
} from "./three-d-kitchen-canvas";
import styles from "./three-d-kitchen.module.css";

type GameModal =
  | "fridge"
  | "stove"
  | "seasoning"
  | "guide"
  | "progress"
  | "result"
  | null;

const methodOptions: { id: HeatMethod; label: string }[] = [
  { id: "pan-fry", label: "煎香" },
  { id: "stir-fry", label: "翻炒" },
  { id: "boil", label: "水煮" },
  { id: "steam", label: "蒸制" },
  { id: "braise", label: "炖煮" },
];

const commonSeasoningIds: SeasoningId[] = [
  "oil",
  "salt",
  "light-soy",
  "rice-vinegar",
  "sugar",
  "wine",
  "water",
  "starch",
];

const amountLevels: { id: AmountLevel; label: string }[] = [
  { id: "little", label: "少许" },
  { id: "moderate", label: "适量" },
  { id: "lot", label: "较多" },
];

const gradeClass: Record<TrainingGrade, string> = {
  perfect: styles.gradePerfect,
  good: styles.gradeGood,
  ordinary: styles.gradeOrdinary,
  burnt: styles.gradeBurnt,
};

const heatBandLabels = {
  idle: "待加热",
  green: "正常加热",
  yellow: "接近熟度",
  perfect: "最佳出锅",
  danger: "危险火候",
  burnt: "已经糊锅",
} as const;

function safeStorageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Optional UI preferences can fail silently.
  }
}

function mapGuidePhase(session: ThreeDTrainingSession): GuidedCookSession["phase"] {
  if (session.phase === "wash" || session.phase === "chop") return "prepare";
  if (session.phase === "cook") return "cook";
  if (session.phase === "plate") return "plate";
  if (session.phase === "result") return "recap";
  if (session.phase === "ingredient") return "ingredient";
  return "partner";
}

function interactionForStation(
  station: InteractionTarget | null,
  session: ThreeDTrainingSession,
): string {
  if (!station) return "靠近工位";
  if (station.id === "fridge") return "选择食材";
  if (station.id === "sink") {
    return session.phase === "wash" ? "按住清洗" : "水槽";
  }
  if (station.id === "board") {
    return session.phase === "chop" ? "按住切配" : "砧板";
  }
  if (station.id === "stove") return "查看灶台";
  if (station.id === "seasoning") return "打开调料";
  if (station.id === "plating") return "装盘复盘";
  return station.action;
}

function VirtualJoystick({
  input,
}: {
  input: React.MutableRefObject<JoystickInput>;
}) {
  const baseRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const update = useCallback(
    (clientX: number, clientY: number) => {
      const base = baseRef.current;
      if (!base) return;
      const rect = base.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const radius = rect.width * 0.36;
      let dx = clientX - centerX;
      let dy = clientY - centerY;
      const length = Math.hypot(dx, dy);
      if (length > radius) {
        dx = (dx / length) * radius;
        dy = (dy / length) * radius;
      }
      setKnob({ x: dx, y: dy });
      input.current.x = dx / radius;
      input.current.z = -dy / radius;
    },
    [input],
  );

  return (
    <div
      ref={baseRef}
      className={styles.joystick}
      data-virtual-joystick
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        update(event.clientX, event.clientY);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          update(event.clientX, event.clientY);
        }
      }}
      onPointerUp={(event) => {
        input.current.x = 0;
        input.current.z = 0;
        setKnob({ x: 0, y: 0 });
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => {
        input.current.x = 0;
        input.current.z = 0;
        setKnob({ x: 0, y: 0 });
      }}
      aria-label="移动摇杆"
    >
      <span
        style={{
          transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`,
        }}
      />
    </div>
  );
}

function ProgressCard({ progress }: { progress: ProgressSummary }) {
  return (
    <div className={styles.progressStats}>
      <div>
        <span>完成训练</span>
        <strong>{progress.completedRuns}</strong>
      </div>
      <div>
        <span>完美</span>
        <strong>{progress.perfectCount}</strong>
      </div>
      <div>
        <span>良好</span>
        <strong>{progress.goodCount}</strong>
      </div>
      <div>
        <span>普通</span>
        <strong>{progress.ordinaryCount}</strong>
      </div>
      <div>
        <span>糊锅</span>
        <strong>{progress.burntCount}</strong>
      </div>
      <div>
        <span>训练时长</span>
        <strong>{Math.round(progress.totalTrainingSeconds / 60)} 分钟</strong>
      </div>
    </div>
  );
}

export function ThreeDKitchenExperience() {
  const router = useRouter();
  const [entered, setEntered] = useState(false);
  const [session, setSession] = useState<ThreeDTrainingSession>(() =>
    createThreeDSession(),
  );
  const [selectedGuideId, setSelectedGuideId] =
    useState<ThreeDGuideId>("orange");
  const [savedSession, setSavedSession] =
    useState<ThreeDTrainingSession | null>(null);
  const [progress, setProgress] =
    useState<ProgressSummary>(() => loadLocalProgress());
  const [modal, setModal] = useState<GameModal>(null);
  const [nearby, setNearby] = useState<InteractionTarget | null>(null);
  const [playerPosition, setPlayerPosition] = useState<
    [number, number, number]
  >([1, 1, 3.35]);
  const [guideMotion, setGuideMotion] =
    useState<GuideMotionState>("idle");
  const [guidePosition, setGuidePosition] =
    useState<[number, number]>([1.94, 0.54]);
  const [teleportRequest, setTeleportRequest] =
    useState<TeleportRequest | null>(null);
  const [quality, setQuality] = useState<"high" | "low">("high");
  const [reaction, setReaction] = useState<AIReactionEvent | null>(null);
  const [hold, setHold] = useState<HoldInteractionState>(() =>
    createHoldInteraction("wash"),
  );
  const [holding, setHolding] = useState(false);
  const [heatSession, setHeatSession] = useState<CookingSession | null>(null);
  const [heatMethod, setHeatMethod] = useState<HeatMethod>("pan-fry");
  const [heatLevel, setHeatLevel] = useState<HeatLevel>("medium");
  const [targetTemperature, setTargetTemperature] = useState(180);
  const [selectedSeasoning, setSelectedSeasoning] =
    useState<SeasoningId>("salt");
  const [amountLevel, setAmountLevel] =
    useState<AmountLevel>("moderate");
  const [trainingResult, setTrainingResult] =
    useState<TrainingEvaluation | null>(null);
  const [recap, setRecap] = useState<DishRecap | null>(null);
  const [finalRun, setFinalRun] = useState<TrainingRun | null>(null);
  const [finalSnapshot, setFinalSnapshot] =
    useState<ExperimentSnapshot | null>(null);
  const [guideMessages, setGuideMessages] = useState<GuideMessage[]>([]);
  const [guideQuestion, setGuideQuestion] = useState("");
  const [guideBusy, setGuideBusy] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [cloudState, setCloudState] = useState<
    "local" | "syncing" | "cloud" | "offline"
  >("local");
  const [ingredientFilter, setIngredientFilter] = useState("全部");
  const [showAllSeasonings, setShowAllSeasonings] = useState(false);
  const joystick = useRef<JoystickInput>({ x: 0, z: 0 });
  const sessionRef = useRef(session);
  const heatSessionRef = useRef<CookingSession | null>(null);
  const holdRef = useRef(hold);
  const completeHoldRef = useRef<(kind: HoldInteractionKind) => void>(
    () => undefined,
  );
  const heatStartState = useRef<IngredientState | null>(null);
  const finalizedRef = useRef(false);
  const reactionBandRef = useRef("");
  sessionRef.current = session;
  heatSessionRef.current = heatSession;
  holdRef.current = hold;

  const ingredient = session.ingredientId
    ? getIngredient(session.ingredientId)
    : null;
  const controlsEnabled = entered && modal === null && !holding;
  const guideProfile =
    threeDGuides.find((item) => item.id === session.guideId) ??
    threeDGuides[0];
  const selectedGuideProfile =
    threeDGuides.find((item) => item.id === selectedGuideId) ??
    threeDGuides[0];
  const currentStation = nearby;
  const showHoldMeter =
    (holding || hold.progress > 0) &&
    ((hold.kind === "wash" && session.phase === "wash") ||
      (hold.kind === "chop" && session.phase === "chop"));
  const selectedSeasoningDefinition = seasonings.find(
    (item) => item.id === selectedSeasoning,
  )!;
  const categoryNames = [
    "全部",
    "畜肉",
    "禽肉",
    "水产",
    "叶菜",
    "瓜茄",
    "根茎",
    "菌菇豆制品",
    "主食辅料",
  ];
  const visibleIngredients = ingredients.filter(
    (item) =>
      ingredientFilter === "全部" || item.category === ingredientFilter,
  );

  useEffect(() => {
    const saved = loadThreeDSession();
    if (saved) {
      setSavedSession(saved);
      setSelectedGuideId(saved.guideId);
    }
    const storedVoice = safeStorageGet("simulating-cook:voice:v1");
    if (storedVoice === "on") {
      setVoiceEnabled(true);
    }
    let cancelled = false;
    void flushPendingTrainingRuns().then((cloud) => {
      if (cancelled || !cloud) return;
      setProgress((local) => {
        const next =
          cloud.completedRuns >= local.completedRuns ? cloud : local;
        saveLocalProgress(next);
        return next;
      });
      setCloudState("cloud");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      entered &&
      session.phase !== "plate" &&
      session.phase !== "result"
    ) {
      saveThreeDSession(session);
    }
  }, [entered, session]);

  useEffect(() => {
    if (!modal) return;
    if (document.pointerLockElement) document.exitPointerLock();
  }, [modal]);

  useEffect(() => {
    if (!reaction || !voiceEnabled || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(reaction.message);
    utterance.lang = "zh-CN";
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
    return () => window.speechSynthesis.cancel();
  }, [reaction, voiceEnabled]);

  useEffect(() => {
    if (!session.stationState.heating) return;
    let lastTick = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const realDelta = Math.min(0.5, (now - lastTick) / 1000);
      lastTick = now;
      const current = sessionRef.current;
      const live = heatSessionRef.current;
      if (!current.state || !live?.isHeating) return;
      const safety = getIngredient(current.ingredientId!).safeCookedness;
      const result = advanceCookingSession(current.state, live, realDelta);
      const provisionalBand = heatBandFor(
        result.state.properties.cookedness,
        safety,
      );
      const dangerMs =
        provisionalBand === "danger"
          ? current.stationState.dangerMs + realDelta * 1000
          : 0;
      const band = heatBandFor(
        result.state.properties.cookedness,
        safety,
        dangerMs,
      );
      const sessionUpdate: ThreeDTrainingSession = {
        ...current,
        state: result.state,
        stationState: {
          ...current.stationState,
          heating: band !== "burnt",
          heatBand: band,
          dangerMs,
        },
        updatedAt: new Date().toISOString(),
      };
      const heatUpdate = {
        ...result.session,
        isHeating: band !== "burnt",
      };
      sessionRef.current = sessionUpdate;
      heatSessionRef.current = heatUpdate;
      setSession(sessionUpdate);
      setHeatSession(heatUpdate);
      if (band === "burnt") {
        setHolding(false);
        finalizeCookingRef.current("burnt", result.state);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [session.stationState.heating]);

  useEffect(() => {
    if (!holding) return;
    let lastTick = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = Math.min(100, now - lastTick);
      lastTick = now;
      const next = advanceHoldInteraction(holdRef.current, true, delta);
      holdRef.current = next;
      setHold(next);
      if (next.completed) {
        setHolding(false);
        completeHoldRef.current(next.kind);
      }
    }, 50);
    return () => window.clearInterval(timer);
  }, [holding]);

  useEffect(() => {
    if (
      holding ||
      hold.progress <= 0 ||
      hold.progress >= 100 ||
      session.phase !== "chop"
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      const event = nextGuideReaction({
        phase: session.phase,
        cleaned: session.stationState.cleaned,
        chopProgress: hold.progress,
        chopPausedMs: hold.pausedMs + 3000,
        heatBand: session.stationState.heatBand,
        dangerMs: session.stationState.dangerMs,
      });
      if (event) setReaction(event);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [hold.pausedMs, hold.progress, holding, session.phase, session.stationState.cleaned, session.stationState.dangerMs, session.stationState.heatBand]);

  useEffect(() => {
    const band = session.stationState.heatBand;
    if (band === reactionBandRef.current) return;
    reactionBandRef.current = band;
    if (!["yellow", "perfect", "danger"].includes(band)) return;
    const event = nextGuideReaction({
      phase: session.phase,
      cleaned: session.stationState.cleaned,
      chopProgress: session.stationState.chopProgress,
      chopPausedMs: 0,
      heatBand: band,
      dangerMs: session.stationState.dangerMs,
    });
    if (event) setReaction(event);
  }, [session.phase, session.stationState.chopProgress, session.stationState.cleaned, session.stationState.dangerMs, session.stationState.heatBand]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "e" || event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, button")) return;
      event.preventDefault();
      handleInteract();
    }
    function handleKeyUp(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "e") stopHold();
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  });

  function beginSession(resume = false) {
    const next = resume && savedSession
      ? savedSession
      : createThreeDSession(selectedGuideId);
    setSession({
      ...next,
      phase: next.phase === "intro" ? "ingredient" : next.phase,
      guideId: next.guideId ?? selectedGuideId,
    });
    setSavedSession(null);
    setEntered(true);
    setTrainerGreeting(
      threeDGuides.find((item) => item.id === (next.guideId ?? selectedGuideId))
        ?.name,
    );
    if (next.phase === "wash" || next.phase === "chop") {
      const kind = next.phase === "wash" ? "wash" : "chop";
      const restored = createHoldInteraction(kind);
      restored.progress =
        kind === "wash"
          ? next.stationState.washProgress
          : next.stationState.chopProgress;
      setHold(restored);
      holdRef.current = restored;
    }
  }

  function setTrainerGreeting(guideName = selectedGuideProfile.name) {
    setGuideMessages([
      {
        id: "xiaozhi-welcome",
        role: "partner",
        text: `我是${guideName}。先到冰箱选食材，再去水槽按住 E 清洗；操作中断时进度会保留。`,
        source: "flow",
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  function notify(
    message: string,
    tone: AIReactionEvent["tone"] = "neutral",
    trigger: AIReactionEvent["trigger"] = "hint",
  ) {
    setReaction({
      id: `${trigger}-${Date.now()}`,
      trigger,
      message,
      tone,
      createdAt: new Date().toISOString(),
    });
  }

  function teleport(stationId: ThreeDTrainingSession["phase"] extends never ? never : InteractionTarget["id"]) {
    setTeleportRequest({
      stationId,
      nonce: Date.now(),
    });
  }

  function chooseIngredient(ingredientId: string) {
    const next = startThreeDIngredient(sessionRef.current, ingredientId);
    setSession(next);
    sessionRef.current = next;
    setModal(null);
    setHold(createHoldInteraction("wash"));
    notify(
      `${getIngredient(ingredientId).name}已从冰箱取出。去右侧水槽，按住 E 清洗。`,
      "neutral",
      "hint",
    );
  }

  function startHold(kind: HoldInteractionKind) {
    if (modal) return;
    const next =
      holdRef.current.kind === kind &&
      !holdRef.current.completed &&
      holdRef.current.progress < 100
        ? holdRef.current
        : createHoldInteraction(kind);
    holdRef.current = next;
    setHold(next);
    setHolding(true);
  }

  function stopHold() {
    if (!holding) return;
    setHolding(false);
    const current = sessionRef.current;
    if (
      holdRef.current.kind === "wash" &&
      current.phase === "wash"
    ) {
      const next = {
        ...current,
        stationState: {
          ...current.stationState,
          washProgress: holdRef.current.progress,
        },
      };
      setSession(next);
      sessionRef.current = next;
    } else if (
      holdRef.current.kind === "chop" &&
      current.phase === "chop"
    ) {
      const next = {
        ...current,
        stationState: {
          ...current.stationState,
          chopProgress: holdRef.current.progress,
        },
      };
      setSession(next);
      sessionRef.current = next;
    }
  }

  function completeHold(kind: HoldInteractionKind) {
    const current = sessionRef.current;
    const next =
      kind === "wash" ? completeWash(current) : completeChop(current);
    setSession(next);
    sessionRef.current = next;
    setHold(createHoldInteraction(kind));
    if (kind === "wash") {
      playKitchenSound("water");
      notify(
        "清洗完成。切配前不要先把水甩得到处都是，去中央砧板继续。",
        "good",
        "complete",
      );
    } else {
      playKitchenSound("cut");
      notify(
        "切配完成。现在把食材带到左侧灶台，先加少量油再点火。",
        "good",
        "complete",
      );
    }
  }

  completeHoldRef.current = completeHold;

  function handleInteract() {
    if (modal || !entered) return;
    if (!nearby) {
      notify("先靠近并看向一个工位，再按 E。", "neutral");
      return;
    }
    const current = sessionRef.current;
    if (nearby.id === "fridge") {
      setModal("fridge");
      return;
    }
    if (nearby.id === "sink") {
      if (!current.ingredientId) {
        notify("先去冰箱取一份食材。", "warning", "wash-needed");
        return;
      }
      if (current.phase === "wash") {
        startHold("wash");
      } else if (!current.stationState.cleaned) {
        notify("这份食材还没有完成清洗。", "warning", "wash-needed");
      } else {
        notify("食材已经清洗完成，去砧板继续。", "good", "complete");
      }
      return;
    }
    if (nearby.id === "board") {
      if (!current.ingredientId) {
        notify("先去冰箱取一份食材。", "warning", "wash-needed");
        return;
      }
      if (!current.stationState.cleaned) {
        notify(
          "未清洗的食材不能直接切。先回右侧水槽按住 E 清洗。",
          "warning",
          "wash-needed",
        );
        return;
      }
      if (current.phase === "chop") {
        startHold("chop");
      } else if (current.stationState.chopped) {
        notify("食材已经切配完成，去灶台开始烹饪。", "good", "complete");
      }
      return;
    }
    if (nearby.id === "stove") {
      if (!current.ingredientId || !current.stationState.cleaned) {
        notify("先把食材清洗干净。", "warning", "wash-needed");
      } else if (!current.stationState.chopped) {
        notify("食材还没有切配，先回中央砧板。", "warning", "hint");
      } else {
        setModal("stove");
      }
      return;
    }
    if (nearby.id === "seasoning") {
      if (current.phase !== "cook" && current.phase !== "plate") {
        notify("受热开始后再决定调味顺序。", "neutral", "hint");
      } else {
        setModal("seasoning");
      }
      return;
    }
    if (nearby.id === "plating") {
      if (trainingResult && trainingResult.canServe) {
        setModal("result");
      } else if (trainingResult?.grade === "burnt") {
        setModal("result");
      } else {
        notify("先完成一锅料理，再来岛台装盘。", "neutral", "hint");
      }
    }
  }

  function addOil() {
    const next = addThreeDOil(sessionRef.current);
    setSession(next);
    sessionRef.current = next;
    notify("油已经入锅。点火后先观察表面水分和锅温。", "neutral", "hint");
  }

  function startHeat() {
    const current = sessionRef.current;
    if (!current.state || current.phase !== "cook") {
      notify("先完成清洗与切配。", "warning", "hint");
      return;
    }
    const live: CookingSession = {
      isHeating: true,
      targetTemperature,
      currentTemperature: current.state.properties.temperature,
      elapsedSimSeconds: 0,
      heatLevel,
      method: heatMethod,
      lidCovered: false,
      stirIntensity: "gentle",
    };
    heatStartState.current = structuredClone(current.state);
    heatSessionRef.current = live;
    setHeatSession(live);
    const next = {
      ...current,
      stationState: {
        ...current.stationState,
        heating: true,
        heatBand: "green" as const,
        dangerMs: 0,
      },
    };
    sessionRef.current = next;
    setSession(next);
    playKitchenSound("sizzle-start");
    notify("已经点火，观察火候条。进入深绿窗口时准备关火。", "neutral", "hint");
  }

  function stopHeatAndEvaluate() {
    if (!heatSessionRef.current) return;
    heatSessionRef.current = {
      ...heatSessionRef.current,
      isHeating: false,
    };
    setHeatSession(heatSessionRef.current);
    finalizeCooking();
  }

  function finalizeCooking(
    forcedGrade?: TrainingGrade,
    stateOverride?: IngredientState,
  ) {
    if (finalizedRef.current) return;
    const current = sessionRef.current;
    const live = heatSessionRef.current;
    if (!current.ingredientId || !current.state || !live) return;
    finalizedRef.current = true;
    const definition = getIngredient(current.ingredientId);
    const startState = heatStartState.current ?? current.state;
    const liveState = stateOverride ?? current.state;
    const finished = stateOverride
      ? liveState
      : finishCookingSession(startState, liveState, live);
    const action: HeatAction = {
      type: "heat",
      method: live.method,
      heatLevel: live.heatLevel,
      targetTemperature: live.targetTemperature,
      durationMin: Math.max(0.1, live.elapsedSimSeconds / 60),
      lidCovered: live.lidCovered,
      stirIntensity: live.stirIntensity,
    };
    const actions = [...current.actions, action];
    const band =
      forcedGrade === "burnt"
        ? "burnt"
        : heatBandFor(
            finished.properties.cookedness,
            definition.safeCookedness,
            current.stationState.dangerMs,
          );
    const criticalSafetyIssue =
      ["beef", "pork", "fish"].includes(definition.id) &&
      finished.properties.cookedness < definition.safeCookedness;
    const evaluation =
      forcedGrade === "burnt"
        ? {
            grade: "burnt" as const,
            title: trainingGradeLabels.burnt,
            reason: trainingGradeDescriptions.burnt,
            canServe: false,
          }
        : evaluateTrainingResult(
            finished,
            definition.safeCookedness,
            band,
            current.stationState.dangerMs,
            criticalSafetyIssue,
          );
    const baseSession: ThreeDTrainingSession = {
      ...current,
      state: finished,
      actions,
      phase:
        evaluation.canServe || evaluation.grade === "burnt"
          ? "plate"
          : "cook",
      stationState: {
        ...current.stationState,
        heating: false,
        heatBand: band,
      },
      updatedAt: new Date().toISOString(),
    };
    sessionRef.current = baseSession;
    setSession(baseSession);
    heatSessionRef.current = null;
    setHeatSession(null);
    playKitchenSound("sizzle-stop");

    if (!evaluation.canServe && evaluation.grade !== "burnt") {
      finalizedRef.current = false;
      notify(
        `${evaluation.reason} 可以继续加热，或关火后重新查看。`,
        "warning",
        "hint",
      );
      return;
    }

    const trainingRecap = buildThreeDRecap(baseSession, evaluation.grade);
    clearThreeDSession();
    const run = createTrainingRun(
      baseSession,
      evaluation.grade,
      (Date.now() - new Date(current.startedAt).getTime()) / 1000,
    );
    const nextProgress = {
      ...progress,
      completedRuns: progress.completedRuns + 1,
      perfectCount:
        progress.perfectCount + (evaluation.grade === "perfect" ? 1 : 0),
      goodCount: progress.goodCount + (evaluation.grade === "good" ? 1 : 0),
      ordinaryCount:
        progress.ordinaryCount + (evaluation.grade === "ordinary" ? 1 : 0),
      burntCount:
        progress.burntCount + (evaluation.grade === "burnt" ? 1 : 0),
      totalTrainingSeconds:
        progress.totalTrainingSeconds + run.durationSeconds,
      lastIngredientId: run.ingredientId,
      lastDishName: run.dishName,
      lastGrade: run.grade,
      updatedAt: run.createdAt,
    };
    setProgress(nextProgress);
    saveLocalProgress(nextProgress);
    setCloudState("syncing");
    void syncTrainingRun(run).then((cloud) => {
      if (cloud) {
        setProgress((local) => {
          const next =
            cloud.completedRuns >= local.completedRuns ? cloud : local;
          saveLocalProgress(next);
          return next;
        });
        setCloudState("cloud");
      } else {
        setCloudState("offline");
      }
    });
    const snapshot = createSnapshot(
      baseSession.ingredientId!,
      trainingRecap.dishName,
      baseSession.actions,
      finished,
      undefined,
      "3D实训",
      {
        dishName: trainingRecap.dishName,
        goal: "more-aromatic",
      },
    );
    addExperiment(snapshot);
    setFinalSnapshot(snapshot);
    setTrainingResult(evaluation);
    setRecap(trainingRecap);
    setFinalRun(run);
    if (evaluation.grade === "burnt") {
      setModal("result");
      playKitchenSound("sizzle-stop");
    } else {
      setModal(null);
      notify(
        "料理可以出锅了。前往成品岛台按 E 装盘并查看原理复盘。",
        evaluation.grade === "perfect" ? "good" : "neutral",
        "complete",
      );
    }
    const event = nextGuideReaction({
      phase: "result",
      cleaned: baseSession.stationState.cleaned,
      chopProgress: 100,
      chopPausedMs: 0,
      heatBand: band,
      dangerMs: current.stationState.dangerMs,
      grade: evaluation.grade,
    });
    if (event) setReaction(event);
  }

  const finalizeCookingRef = useRef(finalizeCooking);
  finalizeCookingRef.current = finalizeCooking;

  function addSeasoning() {
    const current = sessionRef.current;
    if (!current.state) return;
    const action = {
      type: "season" as const,
      seasoningId: selectedSeasoning,
      amount: { level: amountLevel, precise: false },
    };
    const next = {
      ...current,
      state: applyAction(current.state, action),
      actions: [...current.actions, action],
      updatedAt: new Date().toISOString(),
    };
    sessionRef.current = next;
    setSession(next);
    notify(
      `${selectedSeasoningDefinition.name}已加入。继续观察水分、咸鲜和香气。`,
      "neutral",
      "hint",
    );
  }

  async function askXiaozhi() {
    const question = guideQuestion.trim();
    if (!question || guideBusy) return;
    const synthetic: GuidedCookSession = {
      version: 1,
      partnerId: "zhiwei",
      ingredientId: session.ingredientId,
      goal: "more-aromatic",
      phase: mapGuidePhase(session),
      state: session.state,
      history: [],
      actions: session.actions,
      workspace: {
        station: "pan",
        sampleStation: "pan",
        inPan: session.phase === "cook",
      },
      createdAt: session.startedAt,
      updatedAt: session.updatedAt,
    };
    setGuideMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        role: "user" as const,
        text: question,
        createdAt: new Date().toISOString(),
      },
    ]);
    setGuideQuestion("");
    setGuideBusy(true);
    try {
      const response = await askCookingGuide(synthetic, question);
      setGuideMessages((current) => [
        ...current,
        {
          id: `xiaozhi-${Date.now()}`,
          role: "partner" as const,
          text: response.answer,
          source: response.provider,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setGuideBusy(false);
    }
  }

  function toggleVoice() {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    safeStorageSet("simulating-cook:voice:v1", next ? "on" : "off");
    if (!next && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    notify(next ? "语音提示已开启。" : "语音提示已关闭。");
  }

  function resetTraining() {
    clearThreeDSession();
    const fresh = {
      ...createThreeDSession(session.guideId),
      phase: "ingredient" as const,
    };
    setSession(fresh);
    sessionRef.current = fresh;
    setTrainingResult(null);
    setRecap(null);
    setFinalRun(null);
    setFinalSnapshot(null);
    setHeatSession(null);
    heatSessionRef.current = null;
    heatStartState.current = null;
    finalizedRef.current = false;
    setHold(createHoldInteraction("wash"));
    setModal("fridge");
    setReaction(null);
  }

  function goToCommunity() {
    if (finalSnapshot && recap) {
      storeGuidedShareDraft({
        category: "experiment",
        title: `我在 3D 厨房做了${recap.dishName}`,
        body: `${recap.summary}\n\n这次想重点讨论：${recap.mechanisms[0]?.title ?? "火候判断"}。`,
        tags: [
          ingredient?.name ?? "烹饪",
          finalRun ? trainingGradeLabels[finalRun.grade] : "3D实训",
          "一人称厨房",
        ],
        experimentSummary: buildExperimentSummary(finalSnapshot),
      });
    }
    router.push("/community/?tab=discussion&compose=1");
  }

  if (!entered) {
    return (
      <div className={styles.introPage}>
        <div className={styles.introBackdrop} aria-hidden="true">
          <ThreeDKitchenCanvas
            session={session}
            guideId={selectedGuideId}
            joystick={joystick}
            controlsEnabled={false}
            teleportRequest={null}
            heating={false}
            holdActive={false}
            holdProgress={0}
            quality="high"
            onNearbyChange={() => undefined}
            onGuideClick={() => undefined}
            onPoseChange={setPlayerPosition}
          />
        </div>
        <div className={styles.introShade} aria-hidden="true" />
        <div className={styles.introCard}>
          <div className={styles.introBrand}>
            <ChefHat size={16} />
            SIMULATING-COOK · TRUE 3D LAB
          </div>
          <div className={styles.guideIntroHeading}>
            <span>选择你的跟随导师</span>
            <h1>今天谁陪你进厨房？</h1>
            <p>
              两位都是完整立体的 3D 角色，会保持约两米距离跟在侧前方，不遮挡准星和操作工位。
            </p>
          </div>
          <div className={styles.guideChoiceGrid}>
            {threeDGuides.map((guide) => (
              <button
                type="button"
                key={guide.id}
                data-3d-guide-choice={guide.id}
                className={`${styles.guideChoiceCard} ${
                  selectedGuideId === guide.id
                    ? styles.guideChoiceSelected
                    : ""
                }`}
                onClick={() => setSelectedGuideId(guide.id)}
                aria-pressed={selectedGuideId === guide.id}
              >
                <span className={styles.guideChoicePortrait}>
                  <img src={guide.portrait} alt={`${guide.name}角色参考`} />
                  {selectedGuideId === guide.id && (
                    <i>
                      <Check size={13} /> 已选择
                    </i>
                  )}
                </span>
                <span
                  className={styles.guideChoiceRole}
                  style={{ color: guide.accent }}
                >
                  {guide.role}
                </span>
                <strong>{guide.name}</strong>
                <small>{guide.tagline}</small>
              </button>
            ))}
          </div>
          <ProgressCard progress={progress} />
          {savedSession && (
            <button
              type="button"
              className={styles.resumeCard}
              onClick={() => beginSession(true)}
              data-3d-resume
            >
              <span>
                继续上次训练
                <small>
                  {savedSession.ingredientId
                    ? getIngredient(savedSession.ingredientId).name
                    : "未选食材"}{" "}
                  · {savedSession.phase}
                </small>
              </span>
              <ArrowRight size={16} />
            </button>
          )}
          <button
            type="button"
            className={styles.enterButton}
            onClick={() => beginSession(false)}
            data-3d-start
          >
            <Move size={17} />
            和{selectedGuideProfile.name}进入 3D 厨房
          </button>
          <div className={styles.introControls}>
            <span>电脑：WASD + 鼠标 + E</span>
            <span>手机：摇杆 + 滑动 + 长按按钮</span>
          </div>
          <Link href="/cook/classic/" className={styles.classicLink}>
            改用 2.5D 经典厨房
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className={styles.gamePage}
      data-3d-phase={session.phase}
      data-3d-cloud={cloudState}
      data-player-x={playerPosition[0].toFixed(2)}
      data-player-z={playerPosition[2].toFixed(2)}
      data-guide-motion={guideMotion}
      data-guide-x={guidePosition[0].toFixed(2)}
      data-guide-z={guidePosition[1].toFixed(2)}
    >
      <div className={styles.canvasWrap}>
        <ThreeDKitchenCanvas
          session={session}
          guideId={session.guideId}
          joystick={joystick}
          controlsEnabled={controlsEnabled}
          teleportRequest={teleportRequest}
          heating={session.stationState.heating}
          holdActive={holding}
          holdProgress={hold.progress}
          quality={quality}
          onNearbyChange={(target) => {
            setNearby(target);
            if (
              target?.id === "board" &&
              session.phase === "wash" &&
              !session.stationState.cleaned
            ) {
              const event = nextGuideReaction({
                phase: session.phase,
                cleaned: false,
                chopProgress: 0,
                chopPausedMs: 0,
                heatBand: "idle",
                dangerMs: 0,
                wrongStation: "board",
              });
              if (event) setReaction(event);
            }
          }}
          onGuideClick={() => setModal("guide")}
          onGuideMotionChange={setGuideMotion}
          onGuidePositionChange={setGuidePosition}
          onPoseChange={setPlayerPosition}
        />
        <div className={styles.crosshair} aria-hidden="true">
          <span />
        </div>
      </div>

      <header className={styles.topBar}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => setEntered(false)}
        >
          <ArrowLeft size={16} />
          训练厅
        </button>
        <div className={styles.gameTitle}>
          <span>SIMULATING-COOK · 3D KITCHEN</span>
          <strong>奶油风实训厨房 01</strong>
        </div>
        <div className={styles.topActions}>
          <button
            type="button"
            onClick={() => setModal("progress")}
            className={styles.iconButton}
            aria-label="查看训练进度"
          >
            <Trophy size={16} />
          </button>
          <button
            type="button"
            onClick={toggleVoice}
            className={styles.iconButton}
            aria-label={voiceEnabled ? "关闭语音提示" : "开启语音提示"}
          >
            {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button
            type="button"
            onClick={() => setQuality((current) => current === "high" ? "low" : "high")}
            className={styles.qualityButton}
          >
            <Gauge size={14} />
            {quality === "high" ? "高清" : "流畅"}
          </button>
          <button
            type="button"
            onClick={() => setModal("guide")}
            className={styles.guideChip}
            data-3d-guide-active={guideProfile.id}
          >
            <span style={{ background: guideProfile.accent }}>
              <img src={guideProfile.portrait} alt="" />
            </span>
            {guideProfile.name}
          </button>
        </div>
      </header>

      <div className={styles.phaseHud}>
        {[
          ["选食材", session.phase === "ingredient"],
          ["清洗", session.phase === "wash"],
          ["切配", session.phase === "chop"],
          ["烹饪", session.phase === "cook"],
          ["装盘", session.phase === "plate"],
          ["复盘", session.phase === "result"],
        ].map(([label, active], index) => (
          <span
            key={String(label)}
            className={active ? styles.phaseActive : ""}
          >
            {active ? <Check size={11} /> : index + 1}
            {label}
          </span>
        ))}
      </div>

      <div className={styles.stationDock} aria-label="免行走工位导航">
        {threeDStations.map((station) => (
          <button
            type="button"
            key={station.id}
            data-teleport={station.id}
            onClick={() => teleport(station.id)}
          >
            {station.label}
          </button>
        ))}
      </div>

      {nearby && (
        <div className={styles.interactionPrompt}>
          <span>{nearby.label}</span>
          <strong>{interactionForStation(nearby, session)}</strong>
          <small>
            <BackpackKey />
            {["sink", "board"].includes(nearby.id) &&
            ((nearby.id === "sink" && session.phase === "wash") ||
              (nearby.id === "board" && session.phase === "chop"))
              ? "按住 E"
              : "按 E"}
          </small>
        </div>
      )}

      {showHoldMeter && (
        <div
          className={styles.holdMeter}
          aria-live="polite"
          data-3d-hold
          data-hold-progress={Math.round(hold.progress)}
        >
          <div>
            <span>{hold.kind === "wash" ? "清洗进度" : "切配进度"}</span>
            <strong>{Math.round(hold.progress)}%</strong>
          </div>
          <div className={styles.holdTrack}>
            <i style={{ width: `${hold.progress}%` }} />
            <b style={{ left: "30%" }} />
            <b style={{ left: "60%" }} />
          </div>
          <small>{holding ? "保持按住，松开暂停" : "进度已暂停，可继续"}</small>
        </div>
      )}

      {session.stationState.heating && (
        <div className={`${styles.heatMeter} ${styles[`heat-${session.stationState.heatBand}`]}`}>
          <div>
            <Flame size={15} />
            <span>火候</span>
            <strong>
              {
                heatBandLabels[
                  heatBandFor(
                    session.state?.properties.cookedness ?? 0,
                    ingredient?.safeCookedness ?? 60,
                    session.stationState.dangerMs,
                  )
                ]
              }
            </strong>
          </div>
          <div className={styles.heatTrack}>
            <i
              style={{
                width: `${Math.min(
                  100,
                  ((session.state?.properties.cookedness ?? 0) /
                    Math.max(1, (ingredient?.safeCookedness ?? 60) + 8)) *
                    100,
                )}%`,
              }}
            />
          </div>
          <small>
            {session.stationState.heatBand === "danger"
              ? `${(session.stationState.dangerMs / 1000).toFixed(1)} 秒后糊锅`
              : session.stationState.heatBand === "perfect"
                ? "最佳出锅窗口"
                : "观察熟度与蒸汽"}
          </small>
        </div>
      )}

      {reaction && (
        <div
          className={`${styles.xiaozhiBubble} ${styles[`reaction-${reaction.tone}`]}`}
          role="status"
        >
          <span style={{ background: guideProfile.accent }}>
            <img src={guideProfile.portrait} alt="" />
          </span>
          <p>{reaction.message}</p>
          <button
            type="button"
            onClick={() => setReaction(null)}
            aria-label="关闭提示"
          >
            <X size={13} />
          </button>
        </div>
      )}

      <div className={styles.objective}>
        <span>当前目标</span>
        <strong>
          {!session.ingredientId
            ? "去冰箱选择食材"
            : session.phase === "wash"
              ? "到水槽按住 E 清洗"
              : session.phase === "chop"
                ? "到砧板按住 E 切配"
                : session.phase === "cook"
                  ? session.stationState.heating
                    ? "盯住火候窗口"
                    : "到灶台开始烹饪"
                  : session.phase === "plate"
                    ? "到成品岛台装盘"
                    : "查看结果并复盘"}
        </strong>
        <small>
          <Cloud size={12} />
          {cloudState === "cloud"
            ? "匿名云存档已同步"
            : cloudState === "syncing"
              ? "正在同步训练结果"
              : "本地存档，联网后补传"}
        </small>
      </div>

      <VirtualJoystick input={joystick} />

      <button
        type="button"
        className={styles.actionButton}
        data-3d-action
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          handleInteract();
        }}
        onPointerUp={(event) => {
          stopHold();
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={stopHold}
      >
        <Hand size={18} />
        {currentStation &&
        ["sink", "board"].includes(currentStation.id) &&
        ((currentStation.id === "sink" && session.phase === "wash") ||
          (currentStation.id === "board" && session.phase === "chop"))
          ? "按住操作"
          : "交互"}
        <kbd>E</kbd>
      </button>

      {modal === "fridge" && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="选择3D食材">
          <div className={styles.fridgePanel} data-3d-fridge>
            <header className={styles.modalHeader}>
              <div>
                <span>FRIDGE · 55 INGREDIENTS</span>
                <h2>选择这次训练的食材</h2>
              </div>
              <button type="button" onClick={() => setModal(null)} aria-label="关闭冰箱">
                <X size={18} />
              </button>
            </header>
            <div className={styles.categoryChips}>
              {categoryNames.map((category) => (
                <button
                  type="button"
                  key={category}
                  className={ingredientFilter === category ? styles.chipActive : ""}
                  onClick={() => setIngredientFilter(category)}
                >
                  {category}
                </button>
              ))}
            </div>
            <div className={styles.ingredientGrid}>
              {visibleIngredients.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  data-3d-ingredient={item.id}
                  onClick={() => chooseIngredient(item.id)}
                >
                  <span>
                    {hasIngredientPhoto(item.id) ? (
                      <img src={ingredientPhoto(item.id)} alt="" />
                    ) : (
                      <IngredientArt ingredient={item} size="small" />
                    )}
                  </span>
                  <strong>{item.name}</strong>
                  <small>{item.archetype}</small>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {modal === "stove" && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="3D灶台控制">
          <div className={styles.stovePanel} data-3d-stove>
            <header className={styles.modalHeader}>
              <div>
                <span>STOVE · LIVE HEAT</span>
                <h2>灶台</h2>
              </div>
              <button type="button" onClick={() => setModal(null)} aria-label="关闭灶台">
                <X size={18} />
              </button>
            </header>
            <div className={styles.stoveStatus}>
              <div className={styles.panVisual}>
                <span />
                {session.stationState.heating && <i />}
              </div>
              <div>
                <span>当前熟度</span>
                <strong>{Math.round(session.state?.properties.cookedness ?? 0)}</strong>
                <small>安全线 {ingredient?.safeCookedness ?? "--"}</small>
              </div>
              <div>
                <span>锅内温度</span>
                <strong>{Math.round(session.state?.properties.temperature ?? 24)}°C</strong>
                <small>{session.stationState.oilAdded ? "已加油" : "尚未加油"}</small>
              </div>
            </div>
            <div className={styles.methodPicker}>
              {methodOptions.map((method) => (
                <button
                  type="button"
                  key={method.id}
                  className={heatMethod === method.id ? styles.methodActive : ""}
                  onClick={() => {
                    setHeatMethod(method.id);
                    setTargetTemperature(
                      method.id === "boil" ||
                        method.id === "steam" ||
                        method.id === "braise"
                        ? 100
                        : 180,
                    );
                  }}
                >
                  {method.label}
                </button>
              ))}
            </div>
            <label className={styles.rangeField}>
              <span>
                目标温度
                <strong>{targetTemperature}°C</strong>
              </span>
              <input
                type="range"
                min={70}
                max={240}
                step={5}
                value={targetTemperature}
                onChange={(event) => setTargetTemperature(Number(event.target.value))}
              />
            </label>
            <div className={styles.heatLevelChips}>
              {(["low", "medium", "high"] as HeatLevel[]).map((level) => (
                <button
                  type="button"
                  key={level}
                  className={heatLevel === level ? styles.chipActive : ""}
                  onClick={() => setHeatLevel(level)}
                >
                  {level === "low" ? "小火" : level === "medium" ? "中火" : "大火"}
                </button>
              ))}
            </div>
            {!session.stationState.oilAdded && (
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={addOil}
                data-3d-add-oil
              >
                加入少量食用油
              </button>
            )}
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setModal("seasoning")}
              data-3d-open-seasoning
            >
              打开调料架
            </button>
            <div className={styles.stoveActions}>
              {!session.stationState.heating ? (
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={startHeat}
                  data-3d-start-heat
                >
                  <Flame size={16} />
                  {heatSession ? "继续加热" : "点火"}
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.stopButton}
                  onClick={stopHeatAndEvaluate}
                  data-3d-stop-heat
                >
                  关火并判定
                </button>
              )}
            </div>
            {session.stationState.heating && (
              <div className={styles.fireBands}>
                <span className={styles.bandGreen}>正常</span>
                <span className={styles.bandYellow}>接近</span>
                <span className={styles.bandPerfect}>最佳</span>
                <span className={styles.bandDanger}>危险</span>
              </div>
            )}
          </div>
        </div>
      )}

      {modal === "seasoning" && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="3D调料架">
          <div className={styles.seasoningPanel} data-3d-seasoning>
            <header className={styles.modalHeader}>
              <div>
                <span>SEASONING RACK</span>
                <h2>调味</h2>
              </div>
              <button type="button" onClick={() => setModal("stove")} aria-label="关闭调料架">
                <X size={18} />
              </button>
            </header>
            <div className={styles.seasoningGrid}>
              {seasonings
                .filter(
                  (item) =>
                    showAllSeasonings || commonSeasoningIds.includes(item.id),
                )
                .map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={selectedSeasoning === item.id ? styles.seasoningActive : ""}
                    onClick={() => setSelectedSeasoning(item.id)}
                  >
                    <strong>{item.shortName}</strong>
                    <small>{item.name}</small>
                  </button>
                ))}
            </div>
            <button
              type="button"
              className={styles.moreLink}
              onClick={() => setShowAllSeasonings((current) => !current)}
            >
              {showAllSeasonings ? "收起常用调料" : "展开全部调料"}
              <ChevronDown size={14} />
            </button>
            <div className={styles.amountChips}>
              {amountLevels.map((amount) => (
                <button
                  type="button"
                  key={amount.id}
                  className={amountLevel === amount.id ? styles.chipActive : ""}
                  onClick={() => setAmountLevel(amount.id)}
                >
                  {amount.label}
                </button>
              ))}
            </div>
            <p className={styles.seasoningDescription}>
              {selectedSeasoningDefinition.description}
            </p>
            <button type="button" className={styles.primaryButton} onClick={addSeasoning}>
              加入{selectedSeasoningDefinition.name}
            </button>
          </div>
        </div>
      )}

      {modal === "progress" && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="3D训练进度">
          <div className={styles.progressPanel} data-3d-progress>
            <header className={styles.modalHeader}>
              <div>
                <span>TRAINING PROGRESS</span>
                <h2>训练成长</h2>
              </div>
              <button type="button" onClick={() => setModal(null)} aria-label="关闭训练进度">
                <X size={18} />
              </button>
            </header>
            <ProgressCard progress={progress} />
            <div className={styles.lastRun}>
              <span>最近一次</span>
              <strong>{progress.lastDishName ?? "还没有完成训练"}</strong>
              <small>
                {progress.lastGrade
                  ? trainingGradeLabels[progress.lastGrade]
                  : "从冰箱取一份食材开始"}
              </small>
            </div>
            <div className={styles.progressCloud}>
              {cloudState === "cloud" ? <Cloud size={15} /> : <CloudOff size={15} />}
              {cloudState === "cloud"
                ? "匿名训练记录已同步到 Supabase"
                : "当前使用本地记录，联网后自动补传"}
            </div>
          </div>
        </div>
      )}

      {modal === "guide" && (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-label={`${guideProfile.name} AI导师`}
        >
          <div className={styles.guidePanel} data-3d-guide>
            <header className={styles.modalHeader}>
              <div className={styles.guideHeading}>
                <span
                  className={styles.guideAvatar}
                  style={{ background: guideProfile.accent }}
                >
                  <img src={guideProfile.portrait} alt="" />
                </span>
                <div>
                  <span>AI MENTOR</span>
                  <h2>{guideProfile.name} · 跟着你做</h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                aria-label={`关闭${guideProfile.name}`}
              >
                <X size={18} />
              </button>
            </header>
            <div className={styles.guideMessages} data-3d-guide-messages>
              {guideMessages.map((message) => (
                <div
                  key={message.id}
                  className={
                    message.role === "user"
                      ? styles.guideUserMessage
                      : styles.guidePartnerMessage
                  }
                >
                  {message.role === "partner" && (
                    <span>
                      {message.source === "llm"
                        ? "在线 AI"
                        : guideProfile.name}
                    </span>
                  )}
                  <p>{message.text}</p>
                </div>
              ))}
              {guideBusy && (
                <div className={styles.guidePartnerMessage}>
                  <span>在线 AI</span>
                  <p>
                    <LoaderCircle size={14} />
                    正在结合你的工位和火候回答…
                  </p>
                </div>
              )}
            </div>
            <form
              className={styles.guideComposer}
              onSubmit={(event) => {
                event.preventDefault();
                void askXiaozhi();
              }}
            >
              <textarea
                rows={3}
                maxLength={300}
                value={guideQuestion}
                onChange={(event) => setGuideQuestion(event.target.value)}
                placeholder="问清洗、切配、火候或刚才的错误…"
                aria-label={`向${guideProfile.name}提问`}
              />
              <div>
                <button type="button" onClick={toggleVoice} className={styles.voiceButton}>
                  {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                  {voiceEnabled ? "语音开" : "语音关"}
                </button>
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={guideBusy || !guideQuestion.trim()}
                >
                  <Send size={14} />
                  发送
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal === "result" && trainingResult && recap && (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="3D训练复盘">
          <div className={styles.resultPanel} data-3d-result>
            <div className={`${styles.resultGrade} ${gradeClass[trainingResult.grade]}`}>
              <Trophy size={26} />
              <span>{trainingGradeLabels[trainingResult.grade]}</span>
            </div>
            <h2>{recap.dishName}</h2>
            <p className={styles.resultReason}>{trainingResult.reason}</p>
            <div className={styles.resultMetrics}>
              <div>
                <span>熟度</span>
                <strong>{Math.round(session.state?.properties.cookedness ?? 0)}</strong>
              </div>
              <div>
                <span>上色</span>
                <strong>{Math.round(session.state?.properties.browning ?? 0)}</strong>
              </div>
              <div>
                <span>训练时长</span>
                <strong>{finalRun?.durationSeconds ?? 0}s</strong>
              </div>
            </div>
            <div className={styles.resultMechanisms}>
              {recap.mechanisms.slice(0, 3).map((item) => (
                <div key={item.title}>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                  <small>换食材也成立：{item.transfer}</small>
                </div>
              ))}
            </div>
            <div className={styles.safetyResult}>
              <Info size={14} />
              {recap.safety}
            </div>
            <div className={styles.resultActions}>
              <button type="button" className={styles.primaryButton} onClick={resetTraining}>
                <RotateCcw size={15} />
                {trainingResult.grade === "burnt" ? "重新取食材" : "再练一次"}
              </button>
              <button type="button" className={styles.secondaryButton} onClick={goToCommunity}>
                <MessageCircle size={15} />
                进入厨友社区
              </button>
              <button type="button" className={styles.textButton} onClick={() => setModal(null)}>
                返回厨房
              </button>
            </div>
          </div>
        </div>
      )}

      {session.phase === "plate" && trainingResult?.canServe && modal !== "result" && (
        <div className={styles.plateCallout}>
          <Sparkles size={17} />
          料理已完成，前往成品岛台按 E 装盘复盘。
        </div>
      )}
    </div>
  );
}

function BackpackKey() {
  return <kbd className={styles.inlineKey}>E</kbd>;
}
