/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Beaker,
  Check,
  ChefHat,
  ChevronDown,
  ChevronUp,
  Circle,
  CircleHelp,
  CookingPot,
  Droplets,
  Flame,
  Info,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Pause,
  Play,
  RotateCcw,
  Scissors,
  Sparkles,
  ThermometerSun,
  Timer,
  UtensilsCrossed,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { IngredientArt } from "@/components/ingredient-art";
import { getIngredient, ingredients } from "@/lib/ingredients";
import {
  advanceCookingSession,
  applyAction,
  finishCookingSession,
} from "@/lib/simulator";
import {
  buildDishRecap,
  createGuidedSession,
  dishCompletion,
  guidedDishProfile,
  guidedFlowRecommendation,
  guidedOperations,
  guidePartners,
  guidedPhases,
  guidePartnerMap,
  guidedStepStatus,
  preparationChecks,
  preparationComplete,
  recommendedIngredientIds,
  selectGuidedPartner,
  startGuidedIngredient,
} from "@/lib/guided-cook";
import {
  askCookingGuide,
  guidedGoalName,
} from "@/lib/guide-assistant";
import {
  clearGuidedSession,
  loadGuidedSession,
  saveGuidedSession,
  storeGuidedShareDraft,
} from "@/lib/guided-storage";
import { addExperiment, createSnapshot } from "@/lib/storage";
import { buildExperimentSummary } from "@/lib/community/validation";
import { outcomeGoals, principleTagLabels } from "@/lib/treatments";
import { seasonings } from "@/lib/principles";
import { heatMethods } from "@/lib/constants";
import { hasIngredientPhoto, ingredientPhoto } from "@/lib/media";
import type {
  AmountLevel,
  CookingSession,
  DishRecap,
  ExperimentSnapshot,
  GuideMessage,
  GuideMode,
  GuidePartnerId,
  GuidedCookSession,
  HeatAction,
  HeatLevel,
  HeatMethod,
  IngredientState,
  KitchenAction,
  KitchenStation,
  KitchenWorkspace,
  OutcomeGoal,
  SeasoningId,
  StirIntensity,
  TreatmentDefinition,
} from "@/lib/types";
import { GuideDrawer } from "./guide-drawer";
import { SceneFoodSample } from "./scene-food-sample";
import sceneStyles from "./immersive-kitchen-preview.module.css";
import styles from "./guided-kitchen.module.css";

type StationId =
  | "overview"
  | "seasoning"
  | "stove"
  | "prep"
  | "sink"
  | "plating";

type CookTab = "heat" | "seasoning";

interface SceneStation {
  id: StationId;
  label: string;
  hint: string;
  icon: typeof Flame;
  x: number;
  y: number;
  mobileX: number;
  mobileY: number;
  scale: number;
  cameraX: number;
  cameraY: number;
  mobileScale: number;
  mobileCameraX: number;
  mobileCameraY: number;
  partnerX: number;
  partnerY: number;
}

const stations: SceneStation[] = [
  {
    id: "overview",
    label: "厨房入口",
    hint: "自由环顾",
    icon: MapPin,
    x: 50,
    y: 47,
    mobileX: 50,
    mobileY: 44,
    scale: 1,
    cameraX: 0,
    cameraY: 0,
    mobileScale: 1,
    mobileCameraX: 0,
    mobileCameraY: 0,
    partnerX: 52,
    partnerY: 40,
  },
  {
    id: "seasoning",
    label: "调料台",
    hint: "油盐酱醋",
    icon: Sparkles,
    x: 46,
    y: 47,
    mobileX: 53,
    mobileY: 44,
    scale: 1.38,
    cameraX: 8,
    cameraY: 7,
    mobileScale: 1.42,
    mobileCameraX: 8,
    mobileCameraY: 7,
    partnerX: 61,
    partnerY: 39,
  },
  {
    id: "stove",
    label: "灶台",
    hint: "火候与受热",
    icon: Flame,
    x: 24,
    y: 57,
    mobileX: 23,
    mobileY: 56,
    scale: 1.44,
    cameraX: 15,
    cameraY: 8,
    mobileScale: 1.48,
    mobileCameraX: 16,
    mobileCameraY: 7,
    partnerX: 38,
    partnerY: 48,
  },
  {
    id: "prep",
    label: "操作台",
    hint: "切配与控水",
    icon: Scissors,
    x: 54,
    y: 59,
    mobileX: 47,
    mobileY: 55,
    scale: 1.34,
    cameraX: -1,
    cameraY: 12,
    mobileScale: 1.38,
    mobileCameraX: -1,
    mobileCameraY: 10,
    partnerX: 64,
    partnerY: 49,
  },
  {
    id: "sink",
    label: "水槽",
    hint: "清洗与沥水",
    icon: Droplets,
    x: 76,
    y: 57,
    mobileX: 77,
    mobileY: 56,
    scale: 1.44,
    cameraX: -18,
    cameraY: 7,
    mobileScale: 1.5,
    mobileCameraX: -20,
    mobileCameraY: 7,
    partnerX: 66,
    partnerY: 48,
  },
  {
    id: "plating",
    label: "成品岛台",
    hint: "装盘与复盘",
    icon: UtensilsCrossed,
    x: 55,
    y: 82,
    mobileX: 58,
    mobileY: 64,
    scale: 1.28,
    cameraX: -5,
    cameraY: 17,
    mobileScale: 1.32,
    mobileCameraX: -7,
    mobileCameraY: 18,
    partnerX: 48,
    partnerY: 68,
  },
];

const stationOrder = stations.map((station) => station.id);

const catalogCategories = [
  "畜肉",
  "禽肉",
  "水产",
  "叶菜",
  "瓜茄",
  "根茎",
  "菌菇豆制品",
  "主食辅料",
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

const seasoningFamilies = [
  "基础咸味",
  "酸味",
  "甜味",
  "香辛料",
  "油脂类",
  "辅助类",
  "水",
] as const;

const methodTemperatures: Record<HeatMethod, number> = {
  "stir-fry": 190,
  "pan-fry": 180,
  "shallow-fry": 170,
  boil: 100,
  blanch: 100,
  steam: 100,
  braise: 95,
  reduce: 120,
  rest: 70,
};

const amountLevels: { id: AmountLevel; label: string }[] = [
  { id: "little", label: "少许" },
  { id: "moderate", label: "适量" },
  { id: "lot", label: "较多" },
];

const stirOptions: { id: StirIntensity; label: string }[] = [
  { id: "none", label: "不翻动" },
  { id: "gentle", label: "轻推" },
  { id: "frequent", label: "频繁翻动" },
];

function spotStyle(station: SceneStation): CSSProperties {
  return {
    "--hotspot-x": `${station.x}%`,
    "--hotspot-y": `${station.y}%`,
    "--mobile-hotspot-x": `${station.mobileX}%`,
    "--mobile-hotspot-y": `${station.mobileY}%`,
  } as CSSProperties;
}

function stationForTreatment(operationId: string): KitchenStation {
  if (
    operationId.includes("wash") ||
    operationId.includes("rinse") ||
    operationId.includes("soak") ||
    operationId.includes("brine")
  ) {
    return "sink";
  }
  return "board";
}

function sceneStationForWorkspace(
  workspace: KitchenWorkspace | undefined,
): StationId {
  if (!workspace) return "overview";
  if (workspace.inPan || workspace.sampleStation === "pan") return "stove";
  if (workspace.sampleStation === "sink") return "sink";
  if (workspace.sampleStation === "board") return "prep";
  return "overview";
}

function partnerMessageId(role: GuideMessage["role"]): string {
  return `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function scenePartnerPosition(station: SceneStation): CSSProperties {
  return {
    "--partner-x": `${station.partnerX}%`,
    "--partner-y": `${station.partnerY}%`,
  } as CSSProperties;
}

function ingredientLabel(state: IngredientState | null): string {
  return state?.appearance.label ?? "尚未选食材";
}

export function GuidedKitchen() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [session, setSession] = useState<GuidedCookSession>(() =>
    createGuidedSession(),
  );
  const [resumeCandidate, setResumeCandidate] =
    useState<GuidedCookSession | null>(null);
  const [activeStationId, setActiveStationId] =
    useState<StationId>("overview");
  const [goalDraft, setGoalDraft] = useState<OutcomeGoal | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [moreOperationsOpen, setMoreOperationsOpen] = useState(false);
  const [moreSeasoningsOpen, setMoreSeasoningsOpen] = useState(false);
  const [moreMethodsOpen, setMoreMethodsOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideMode, setGuideMode] = useState<GuideMode>("flow");
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [messages, setMessages] = useState<GuideMessage[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [cookTab, setCookTab] = useState<CookTab>("heat");
  const [heatMethod, setHeatMethod] = useState<HeatMethod>("stir-fry");
  const [heatLevel, setHeatLevel] = useState<HeatLevel>("medium");
  const [targetTemperature, setTargetTemperature] = useState(180);
  const [durationMin, setDurationMin] = useState(4);
  const [lidCovered, setLidCovered] = useState(false);
  const [stirIntensity, setStirIntensity] =
    useState<StirIntensity>("gentle");
  const [selectedSeasoning, setSelectedSeasoning] =
    useState<SeasoningId>("salt");
  const [amountLevel, setAmountLevel] =
    useState<AmountLevel>("moderate");
  const [preciseAmount, setPreciseAmount] = useState(false);
  const [amountValue, setAmountValue] = useState(0);
  const [finalSnapshot, setFinalSnapshot] =
    useState<ExperimentSnapshot | null>(null);
  const [finalRecap, setFinalRecap] = useState<DishRecap | null>(null);
  const noticeTimer = useRef<number | null>(null);
  const operationPanelRef = useRef<HTMLElement>(null);

  const partner = session.partnerId
    ? guidePartnerMap.get(session.partnerId) ?? null
    : null;
  const ingredient =
    session.ingredientId ? getIngredient(session.ingredientId) : null;
  const activeStation =
    stations.find((station) => station.id === activeStationId) ?? stations[0];
  const profile = session.ingredientId
    ? guidedDishProfile(session.ingredientId, session.goal, session.actions)
    : null;
  const prepChecks =
    session.ingredientId && session.state
      ? preparationChecks(
          session.ingredientId,
          session.actions,
          session.workspace,
          session.goal,
        )
      : [];
  const prepComplete =
    Boolean(session.ingredientId) &&
    preparationComplete(
      session.ingredientId!,
      session.actions,
      session.workspace,
      session.goal,
    );
  const completion =
    session.ingredientId && session.state
      ? dishCompletion(
          session.ingredientId,
          session.state,
          session.actions,
          session.workspace,
          session.goal,
        )
      : null;
  const recommendation = guidedFlowRecommendation(
    session,
    prepChecks,
    completion ?? {
      canPlate: false,
      checks: [],
      missing: [],
    },
  );
  const operations =
    session.ingredientId && session.state
      ? guidedOperations(
          session.ingredientId,
          session.actions,
          session.workspace,
          session.goal,
        )
      : { common: [], more: [] };
  const recommendedIds = recommendedIngredientIds(goalDraft);
  const isHeating = session.workspace.session?.isHeating ?? false;
  const selectedSeasoningDefinition = seasonings.find(
    (item) => item.id === selectedSeasoning,
  )!;
  useEffect(() => {
    const saved = loadGuidedSession();
    if (
      saved &&
      saved.phase !== "partner" &&
      saved.phase !== "ingredient"
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResumeCandidate(saved);
    }
    try {
      setVoiceEnabled(
        window.localStorage.getItem("simulating-cook:voice:v1") === "on",
      );
    } catch {
      // Voice preference is optional.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (
      !hydrated ||
      (session.phase === "partner" && !session.partnerId)
    ) {
      return;
    }
    if (!session.workspace.session?.isHeating) {
      saveGuidedSession(session);
    }
  }, [hydrated, session]);

  useEffect(() => {
    if (!notice) return;
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 3200);
    return () => {
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    };
  }, [notice]);

  useEffect(() => {
    operationPanelRef.current?.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPanelCollapsed(false);
  }, [session.phase]);

  useEffect(() => {
    if (!isHeating) return;
    let lastTick = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const deltaSeconds = Math.min(2, (now - lastTick) / 1000);
      lastTick = now;
      setSession((current) => {
        const live = current.workspace.session;
        if (!live?.isHeating || !current.state) return current;
        const result = advanceCookingSession(
          current.state,
          live,
          deltaSeconds,
        );
        const reachedLimit =
          result.session.elapsedSimSeconds >= durationMin * 60;
        return {
          ...current,
          state: result.state,
          workspace: {
            ...current.workspace,
            sampleStation: "pan",
            inPan: true,
            session: {
              ...result.session,
              isHeating: reachedLimit ? false : result.session.isHeating,
            },
          },
          updatedAt: new Date().toISOString(),
        };
      });
    }, 250);
    const pauseWhenHidden = () => {
      if (document.visibilityState === "hidden") {
        setSession((current) =>
          current.workspace.session
            ? {
                ...current,
                workspace: {
                  ...current.workspace,
                  session: {
                    ...current.workspace.session,
                    isHeating: false,
                  },
                },
              }
            : current,
        );
      }
    };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", pauseWhenHidden);
    };
  }, [durationMin, isHeating]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target?.matches("input, textarea, select, button, [contenteditable]")
      ) {
        return;
      }
      const index = stationOrder.indexOf(activeStationId);
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setActiveStationId(stationOrder[(index + 1) % stationOrder.length]);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setActiveStationId(
          stationOrder[(index - 1 + stationOrder.length) % stationOrder.length],
        );
      } else if (/^[1-6]$/.test(event.key)) {
        event.preventDefault();
        setActiveStationId(stationOrder[Number(event.key) - 1]);
      } else if (event.key === "Escape") {
        setGuideOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeStationId]);

  useEffect(() => {
    if (!voiceEnabled || !partner || guideMode !== "flow") return;
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      `${recommendation.title}。${recommendation.reason}`,
    );
    utterance.lang = "zh-CN";
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
    return () => window.speechSynthesis.cancel();
  }, [guideMode, partner, recommendation.reason, recommendation.title, voiceEnabled]);

  function updateSession(
    updater: (current: GuidedCookSession) => GuidedCookSession,
  ) {
    setSession((current) => ({
      ...updater(current),
      updatedAt: new Date().toISOString(),
    }));
  }

  function showNotice(text: string) {
    setNotice(text);
  }

  function choosePartner(partnerId: GuidePartnerId) {
    const definition = guidePartnerMap.get(partnerId)!;
    const next = selectGuidedPartner(createGuidedSession(), partnerId);
    clearGuidedSession();
    setSession(next);
    setResumeCandidate(null);
    setGoalDraft(null);
    setActiveStationId("overview");
    setMessages([
      {
        id: partnerMessageId("partner"),
        role: "partner",
        text: definition.greeting,
        source: "flow",
        createdAt: new Date().toISOString(),
      },
    ]);
    showNotice(`${definition.name}已进入厨房`);
  }

  function resumeSavedSession() {
    if (!resumeCandidate) return;
    const partnerId = resumeCandidate.partnerId;
    const savedPartner = partnerId
      ? guidePartnerMap.get(partnerId)
      : guidePartners[0];
    setSession(resumeCandidate);
    setGoalDraft(resumeCandidate.goal);
    if (resumeCandidate.ingredientId) {
      const nextProfile = guidedDishProfile(
        resumeCandidate.ingredientId,
        resumeCandidate.goal,
        resumeCandidate.actions,
      );
      setHeatMethod(nextProfile.preferredMethods[0]);
      setTargetTemperature(nextProfile.targetTemperature);
    }
    setActiveStationId(
      sceneStationForWorkspace(resumeCandidate.workspace),
    );
    setResumeCandidate(null);
    setMessages([
      {
        id: partnerMessageId("partner"),
        role: "partner",
        text: `我们继续上次的${resumeCandidate.ingredientId ? getIngredient(resumeCandidate.ingredientId).name : "烹饪"}。${savedPartner?.greeting ?? ""}`,
        source: "flow",
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  function discardSavedSession() {
    clearGuidedSession();
    setResumeCandidate(null);
  }

  function chooseIngredient(ingredientId: string) {
    const next = startGuidedIngredient(
      session,
      ingredientId,
      goalDraft,
    );
    setSession(next);
    const nextProfile = guidedDishProfile(
      ingredientId,
      goalDraft,
      [],
    );
    setHeatMethod(nextProfile.preferredMethods[0]);
    setTargetTemperature(nextProfile.targetTemperature);
    setActiveStationId("sink");
    setLibraryOpen(false);
    setMoreOperationsOpen(false);
    setFinalSnapshot(null);
    setFinalRecap(null);
    showNotice(
      `${getIngredient(ingredientId).name}已经送到水槽，先完成预处理`,
    );
  }

  function runOperation(treatment: TreatmentDefinition) {
    if (!session.state) return;
    const nextState = applyAction(session.state, {
      type: "operation",
      operationId: treatment.id,
    });
    const station = stationForTreatment(treatment.id);
    const nextStation =
      station === "sink" ? "sink" : ("prep" as StationId);
    updateSession((current) => ({
      ...current,
      state: nextState,
      history: [...current.history, current.state!],
      actions: [
        ...current.actions,
        { type: "operation", operationId: treatment.id },
      ],
      workspace: {
        ...current.workspace,
        station,
        sampleStation: station,
        inPan: false,
      },
    }));
    setActiveStationId(nextStation);
    showNotice(`${treatment.name}：${nextState.events.at(-1)?.title ?? "状态已更新"}`);
  }

  function addOil() {
    if (!session.state) return;
    const action: KitchenAction = {
      type: "season",
      seasoningId: "oil",
      amount: { level: "little", precise: false },
    };
    const nextState = applyAction(session.state, action);
    updateSession((current) => ({
      ...current,
      state: nextState,
      history: [...current.history, current.state!],
      actions: [...current.actions, action],
      workspace: {
        ...current.workspace,
        station: "pan",
        sampleStation: "board",
        inPan: false,
      },
    }));
    setActiveStationId("stove");
    showNotice("已在锅中加入少量油，下一步把食材放入锅中");
  }

  function advanceToPan() {
    if (!prepComplete) {
      showNotice("还有必需的预处理没有完成");
      return;
    }
    updateSession((current) => ({
      ...current,
      phase: "pan",
      workspace: {
        ...current.workspace,
        station: "board",
        sampleStation: "board",
        inPan: false,
      },
    }));
    setActiveStationId("prep");
    showNotice("预处理完成，现在把食材送入炒锅");
  }

  function moveIntoPan() {
    updateSession((current) => ({
      ...current,
      phase: "cook",
      workspace: {
        ...current.workspace,
        station: "pan",
        sampleStation: "pan",
        inPan: true,
      },
    }));
    setActiveStationId("stove");
    setCookTab("heat");
    showNotice("食材已经入锅，可以点火了");
  }

  function addSeasoning() {
    if (!session.state) return;
    const amount = {
      level: amountLevel,
      precise: preciseAmount,
      value: preciseAmount ? amountValue : undefined,
      unit: preciseAmount ? selectedSeasoningDefinition.unit : undefined,
    };
    const action: KitchenAction = {
      type: "season",
      seasoningId: selectedSeasoning,
      amount,
    };
    const nextState = applyAction(session.state, action);
    updateSession((current) => ({
      ...current,
      state: nextState,
      history: [...current.history, current.state!],
      actions: [...current.actions, action],
      workspace: {
        ...current.workspace,
        station: "pan",
        sampleStation: "pan",
        inPan: true,
      },
    }));
    setActiveStationId("stove");
    showNotice(`已加入${selectedSeasoningDefinition.name}`);
  }

  function beginHeating() {
    if (!session.workspace.inPan) {
      showNotice("锅是空的：先把食材放入炒锅");
      return;
    }
    updateSession((current) => {
      const existing = current.workspace.session;
      const sessionValue: CookingSession = existing
        ? {
            ...existing,
            isHeating: true,
            targetTemperature,
            heatLevel,
            method: heatMethod,
            lidCovered,
            stirIntensity,
          }
        : {
            isHeating: true,
            targetTemperature,
            currentTemperature:
              current.state?.properties.temperature ?? 24,
            elapsedSimSeconds: 0,
            heatLevel,
            method: heatMethod,
            lidCovered,
            stirIntensity,
          };
      return {
        ...current,
        workspace: {
          ...current.workspace,
          station: "pan",
          sampleStation: "pan",
          inPan: true,
          session: sessionValue,
          heatStartState:
            current.workspace.heatStartState ??
            structuredClone(current.state!),
        },
      };
    });
    setActiveStationId("stove");
    showNotice("加热开始，观察温度、水分和熟度");
  }

  function pauseHeating() {
    updateSession((current) => ({
      ...current,
      workspace: {
        ...current.workspace,
        session: current.workspace.session
          ? { ...current.workspace.session, isHeating: false }
          : undefined,
      },
    }));
    showNotice("已暂停加热，状态会保留");
  }

  function stopHeating() {
    const live = session.workspace.session;
    const start = session.workspace.heatStartState;
    if (!live || !start || !session.state) {
      showNotice("还没有可记录的加热过程");
      return;
    }
    const finished = finishCookingSession(start, session.state, live);
    const heatAction: HeatAction = {
      type: "heat",
      method: live.method,
      heatLevel: live.heatLevel,
      targetTemperature: live.targetTemperature,
      durationMin: Math.max(0.1, live.elapsedSimSeconds / 60),
      lidCovered: live.lidCovered,
      stirIntensity: live.stirIntensity,
    };
    updateSession((current) => ({
      ...current,
      phase: "plate",
      state: finished,
      history: [...current.history, start],
      actions: [...current.actions, heatAction],
      workspace: {
        ...current.workspace,
        station: "pan",
        sampleStation: "pan",
        inPan: true,
        session: undefined,
        heatStartState: undefined,
      },
    }));
    setActiveStationId("plating");
    showNotice("已经关火，检查完成条件后装盘");
  }

  function returnToCook() {
    updateSession((current) => ({ ...current, phase: "cook" }));
    setActiveStationId("stove");
  }

  function plateDish() {
    if (!session.ingredientId || !session.state || !ingredient || !profile) {
      return;
    }
    const result = dishCompletion(
      session.ingredientId,
      session.state,
      session.actions,
      session.workspace,
      session.goal,
    );
    if (!result.canPlate) {
      showNotice(`还不能装盘：${result.missing.join("、")}`);
      return;
    }
    const snapshot = createSnapshot(
      session.ingredientId,
      profile.dishName,
      session.actions,
      session.state,
      undefined,
      partner ? `${partner.name}指导` : "一人称厨房",
      {
        dishName: profile.dishName,
        goal: session.goal ?? undefined,
        partnerId: session.partnerId ?? undefined,
      },
    );
    addExperiment(snapshot);
    setFinalSnapshot(snapshot);
    setFinalRecap(
      buildDishRecap(
        session.ingredientId,
        session.state,
        session.actions,
        session.goal,
      ),
    );
    updateSession((current) => ({
      ...current,
      phase: "recap",
      workspace: {
        ...current.workspace,
        station: "pan",
        sampleStation: "pan",
        inPan: true,
      },
    }));
    setActiveStationId("plating");
    showNotice("已经装盘，本轮实验已保存");
  }

  function startNewRound() {
    if (!session.partnerId) return;
    const next = selectGuidedPartner(createGuidedSession(), session.partnerId);
    setSession(next);
    setGoalDraft(null);
    setFinalSnapshot(null);
    setFinalRecap(null);
    setActiveStationId("overview");
    setGuideOpen(false);
    setCookTab("heat");
    setMoreOperationsOpen(false);
    setMoreSeasoningsOpen(false);
    setMoreMethodsOpen(false);
    showNotice("新一轮烹饪开始，先选择食材与目标");
  }

  function shareToCommunity() {
    if (!finalSnapshot || !finalRecap || !profile || !ingredient) {
      router.push("/community/");
      return;
    }
    const summary = buildExperimentSummary(finalSnapshot);
    storeGuidedShareDraft({
      category: "experiment",
      title: `我做了${finalRecap.dishName}，想分享这次变化`,
      body: `${finalRecap.summary}\n\n这次我用“${guidedGoalName(session.goal)}”作为目标。${finalRecap.mechanisms[0]?.detail ?? ""}\n\n大家会怎样调整用量或火候？`,
      tags: [
        ingredient.name,
        session.goal ? guidedGoalName(session.goal) : "烹饪原理",
        "一人称厨房",
      ],
      experimentSummary: summary,
    });
    router.push("/community/?tab=discussion&compose=1");
  }

  function toggleVoice() {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    try {
      window.localStorage.setItem(
        "simulating-cook:voice:v1",
        next ? "on" : "off",
      );
    } catch {
      // Voice preference is optional.
    }
    if (!next && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    showNotice(next ? "语音播报已开启" : "语音播报已关闭");
  }

  async function askPartner(question: string) {
    if (!partner) return;
    const userMessage: GuideMessage = {
      id: partnerMessageId("user"),
      role: "user",
      text: question,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, userMessage]);
    setAiBusy(true);
    try {
      const response = await askCookingGuide(session, question);
      setMessages((current) => [
        ...current,
        {
          id: partnerMessageId("partner"),
          role: "partner",
          text: response.answer,
          source: response.provider,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: partnerMessageId("partner"),
          role: "partner",
          text: "这次回答没有成功。我会保留当前烹饪进度，你可以重新提问或继续操作。",
          source: "local",
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setAiBusy(false);
    }
  }

  function resetEverything() {
    clearGuidedSession();
    setSession(createGuidedSession());
    setResumeCandidate(null);
    setGoalDraft(null);
    setFinalSnapshot(null);
    setFinalRecap(null);
    setMessages([]);
    setGuideOpen(false);
    setActiveStationId("overview");
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    showNotice("本轮指导厨房已重置，历史实验不受影响");
  }

  const sceneStyle = {
    "--camera-scale": activeStation.scale,
    "--camera-x": `${activeStation.cameraX}%`,
    "--camera-y": `${activeStation.cameraY}%`,
    "--mobile-camera-scale": activeStation.mobileScale,
    "--mobile-camera-x": `${activeStation.mobileCameraX}%`,
    "--mobile-camera-y": `${activeStation.mobileCameraY}%`,
  } as CSSProperties;
  const partnerSpot = scenePartnerPosition(activeStation);

  if (!hydrated) {
    return (
      <div className={styles.loadingScreen}>
        <LoaderCircle size={24} />
        正在进入一人称厨房…
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <section
        className={`${sceneStyles.scene} ${styles.guidedScene}`}
        aria-label="一人称烹饪厨房"
        data-active-station={activeStation.id}
        data-guided-phase={session.phase}
      >
        <div className={sceneStyles.world} style={sceneStyle}>
          <picture>
            <source
              media="(max-width: 700px)"
              srcSet="/images/scene/kitchen-mobile.webp"
            />
            <img
              className={sceneStyles.backdrop}
              src="/images/scene/kitchen-panorama.webp"
              alt="奶油白色橱柜、燃气灶、中央操作台、水槽和前景岛台组成的写实厨房"
            />
          </picture>
          <div className={sceneStyles.cinematicWash} aria-hidden="true" />

          {stations.slice(1).map((station) => {
            const Icon = station.icon;
            const isActive = activeStation.id === station.id;
            return (
              <button
                type="button"
                key={station.id}
                data-station-id={station.id}
                className={`${sceneStyles.hotspot} ${
                  isActive ? sceneStyles.hotspotActive : ""
                }`}
                style={spotStyle(station)}
                onClick={() => setActiveStationId(station.id)}
                aria-pressed={isActive}
                aria-label={`前往${station.label}，${station.hint}`}
              >
                <span
                  className={sceneStyles.hotspotPulse}
                  aria-hidden="true"
                />
                <span className={sceneStyles.hotspotIcon}>
                  <Icon size={17} />
                </span>
                <span className={sceneStyles.hotspotCopy}>
                  <strong>{station.label}</strong>
                  <small>{station.hint}</small>
                </span>
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            );
          })}

          {ingredient && session.state && session.phase !== "recap" && (
            <SceneFoodSample
              ingredient={ingredient}
              state={session.state}
              actionCount={session.actions.length}
              station={session.workspace.sampleStation}
              isHeating={isHeating}
            />
          )}

          {partner && session.phase !== "partner" && (
            <button
              type="button"
              className={styles.scenePartner}
              style={partnerSpot}
              onClick={() => setGuideOpen(true)}
              aria-label={`打开${partner.name}指导面板`}
              data-scene-partner
            >
              <span style={{ background: partner.accent }}>
                {partner.name.slice(0, 1)}
              </span>
              <i>{partner.name}在旁协助</i>
            </button>
          )}
        </div>

        <div
          className={`${sceneStyles.topHud} ${styles.guidedTopHud}`}
          data-top-hud
        >
          <Link className={sceneStyles.backLink} href="/">
            <ArrowLeft size={16} />
            首页
          </Link>
          <div className={sceneStyles.sceneIdentity}>
            <span>SIMULATING-COOK</span>
            <strong>一人称 · 奶油风厨房</strong>
          </div>
          <div className={styles.hudActions} data-hud-actions>
            {partner && (
              <button
                type="button"
                className={styles.partnerChip}
                onClick={() => setGuideOpen(true)}
                data-guide-open
              >
                <span style={{ background: partner.accent }}>
                  {partner.name.slice(0, 1)}
                </span>
                <div>
                  <strong>{partner.name}</strong>
                  <small>{partner.role}</small>
                </div>
                <MessageCircle size={14} />
              </button>
            )}
            <button
              type="button"
              className={styles.iconHudButton}
              onClick={resetEverything}
              aria-label="重置本轮指导厨房"
            >
              <RotateCcw size={16} />
            </button>
            <button
              type="button"
              className={styles.iconHudButton}
              onClick={() => setGuideOpen(true)}
              aria-label="打开操作帮助"
            >
              <CircleHelp size={16} />
            </button>
          </div>
        </div>

        <nav className={styles.phaseRail} aria-label="烹饪流程">
          {guidedPhases.map((phase, index) => {
            const status = guidedStepStatus(phase.id, session.phase);
            return (
              <div
                key={phase.id}
                className={`${styles.phaseStep} ${styles[`phase-${status}`]}`}
                aria-current={status === "active" ? "step" : undefined}
              >
                <span>
                  {status === "completed" ? (
                    <Check size={12} />
                  ) : (
                    String(index + 1).padStart(2, "0")
                  )}
                </span>
                <div>
                  <strong>{phase.shortLabel}</strong>
                  <small>{phase.label}</small>
                </div>
              </div>
            );
          })}
        </nav>

        <div className={styles.sceneMeters} aria-live="polite">
          <div>
            <span>锅内</span>
            <strong>{ingredientLabel(session.state)}</strong>
          </div>
          <div>
            <span>温度</span>
            <strong>
              {Math.round(session.state?.properties.temperature ?? 24)}°C
            </strong>
          </div>
          <div>
            <span>表面水</span>
            <strong>
              {Math.round(session.state?.properties.surfaceMoisture ?? 0)}
            </strong>
          </div>
          <div>
            <span>熟度</span>
            <strong>
              {Math.round(session.state?.properties.cookedness ?? 0)}
            </strong>
          </div>
        </div>

        {session.phase !== "partner" && (
          <aside
            ref={operationPanelRef}
            className={`${styles.operationPanel} ${
              panelCollapsed ? styles.operationPanelCollapsed : ""
            }`}
            aria-label="当前阶段操作"
          >
            <header className={styles.operationHeader}>
              <div>
                <span>
                  {guidedPhases.find((item) => item.id === session.phase)?.shortLabel ??
                    "烹饪"}
                </span>
                <h2>
                  {guidedPhases.find((item) => item.id === session.phase)?.label}
                </h2>
              </div>
              <div className={styles.operationHeaderActions}>
                <button
                  type="button"
                  onClick={() => setGuideOpen(true)}
                  aria-label="打开流程指导"
                  data-operation-guide
                >
                  <Sparkles size={16} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPanelCollapsed((current) => !current)
                  }
                  aria-expanded={!panelCollapsed}
                  aria-label={panelCollapsed ? "展开操作面板" : "收起操作面板"}
                  data-panel-toggle
                >
                  {panelCollapsed ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronUp size={16} />
                  )}
                </button>
              </div>
            </header>

            {session.phase === "ingredient" && (
              <div className={styles.ingredientPicker}>
                <div className={styles.partnerLine}>
                  <span style={{ background: partner?.accent }}>
                    {partner?.name.slice(0, 1)}
                  </span>
                  <p>{partner?.greeting}</p>
                </div>
                <div className={styles.goalPicker}>
                  <div className={styles.panelLabel}>
                    <span>这次想改变什么</span>
                    <small>可跳过</small>
                  </div>
                  <div className={styles.goalChips}>
                    {outcomeGoals.map((goal) => (
                      <button
                        type="button"
                        key={goal.id}
                        data-goal-id={goal.id}
                        className={
                          goalDraft === goal.id ? styles.goalActive : ""
                        }
                        onClick={() =>
                          setGoalDraft((current) =>
                            current === goal.id ? null : goal.id,
                          )
                        }
                        aria-pressed={goalDraft === goal.id}
                      >
                        {goal.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={styles.recommendationHeading}>
                  <span>伙伴推荐</span>
                  <small>
                    {goalDraft ? guidedGoalName(goalDraft) : "从易观察的食材开始"}
                  </small>
                </div>
                <div className={styles.ingredientRecommendations}>
                  {recommendedIds.map((id) => {
                    const item = getIngredient(id);
                    return (
                      <button
                        type="button"
                        key={id}
                        data-ingredient-id={id}
                        className={styles.ingredientCard}
                        onClick={() => chooseIngredient(id)}
                      >
                        <span className={styles.ingredientImage}>
                          {hasIngredientPhoto(id) ? (
                            <img
                              src={ingredientPhoto(id)}
                              alt=""
                              aria-hidden="true"
                            />
                          ) : (
                            <IngredientArt ingredient={item} size="small" />
                          )}
                        </span>
                        <div>
                          <strong>{item.name}</strong>
                          <small>{item.tagline}</small>
                        </div>
                        <ChevronDown size={14} />
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className={styles.libraryToggle}
                  onClick={() => setLibraryOpen((current) => !current)}
                  aria-expanded={libraryOpen}
                >
                  <span>
                    <ChefHat size={15} />
                    完整食材库 · {ingredients.length} 种
                  </span>
                  <ChevronDown
                    size={15}
                    className={libraryOpen ? styles.isOpen : ""}
                  />
                </button>
                {libraryOpen && (
                  <label className={styles.fullLibrary}>
                    <span>选择食材后直接送到水槽</span>
                    <select
                      defaultValue=""
                      aria-label="完整食材库"
                      onChange={(event) => {
                        if (event.target.value) {
                          chooseIngredient(event.target.value);
                        }
                      }}
                    >
                      <option value="">打开完整食材库</option>
                      {catalogCategories.map((category) => (
                        <optgroup key={category} label={category}>
                          {ingredients
                            .filter((item) => item.category === category)
                            .map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            )}

            {session.phase === "prepare" && session.state && ingredient && (
              <div className={styles.prepPanel}>
                <div className={styles.panelDescription}>
                  <span
                    className={styles.panelIngredientThumb}
                    style={{ background: ingredient.palette.soft }}
                  >
                    {hasIngredientPhoto(ingredient.id) ? (
                      <img src={ingredientPhoto(ingredient.id)} alt="" />
                    ) : (
                      <IngredientArt ingredient={ingredient} size="small" />
                    )}
                  </span>
                  <div>
                    <strong>{ingredient.name}</strong>
                    <small>{ingredient.tagline}</small>
                  </div>
                  <span className={styles.phaseTag}>预处理</span>
                </div>
                <div className={styles.checkList}>
                  {prepChecks.map((check) => (
                    <div
                      key={check.id}
                      className={`${styles.checkItem} ${
                        check.passed ? styles.checkPassed : ""
                      }`}
                    >
                      <span>
                        {check.passed ? (
                          <Check size={13} />
                        ) : (
                          <Circle size={11} />
                        )}
                      </span>
                      <div>
                        <strong>
                          {check.label}
                          {!check.required && <i>可选</i>}
                        </strong>
                        <small>{check.detail}</small>
                      </div>
                    </div>
                  ))}
                </div>
                <div className={styles.operationList}>
                  {operations.common.map((operation) => (
                    <button
                      type="button"
                      key={operation.id}
                      data-operation-id={operation.id}
                      className={styles.operationCard}
                      onClick={() => runOperation(operation)}
                    >
                      <span>
                        <Scissors size={16} />
                      </span>
                      <div>
                        <strong>{operation.name}</strong>
                        <small>{operation.purpose}</small>
                      </div>
                      {session.actions.some(
                        (action) =>
                          action.type === "operation" &&
                          action.operationId === operation.id,
                      ) && <Check size={14} />}
                    </button>
                  ))}
                </div>
                {operations.more.length > 0 && (
                  <>
                    <button
                      type="button"
                      className={styles.moreToggle}
                      onClick={() =>
                        setMoreOperationsOpen((current) => !current)
                      }
                      aria-expanded={moreOperationsOpen}
                    >
                      更多处理
                      <ChevronDown
                        size={15}
                        className={moreOperationsOpen ? styles.isOpen : ""}
                      />
                    </button>
                    {moreOperationsOpen && (
                      <div className={styles.operationList}>
                        {operations.more.map((operation) => (
                          <button
                            type="button"
                            key={operation.id}
                            data-operation-id={operation.id}
                            className={`${styles.operationCard} ${styles.operationMore}`}
                            onClick={() => runOperation(operation)}
                          >
                            <span>
                              <Sparkles size={15} />
                            </span>
                            <div>
                              <strong>{operation.name}</strong>
                              <small>{operation.purpose}</small>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <button
                  type="button"
                  className={styles.primaryAction}
                  onClick={advanceToPan}
                  disabled={!prepComplete}
                  data-phase-action="advance-pan"
                >
                  预处理完成，准备下锅
                  <ArrowRight size={16} />
                </button>
                {!prepComplete && (
                  <small className={styles.actionHint}>
                    先完成清单中的必需项目。
                  </small>
                )}
              </div>
            )}

            {session.phase === "pan" && ingredient && (
              <div className={styles.panPanel}>
                <div className={styles.panIllustration}>
                  <CookingPot size={39} />
                  <span>锅已准备好</span>
                  <p>
                    根据目标决定是否加油，然后把{ingredient.name}送入炒锅。
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.secondaryAction}
                  onClick={addOil}
                >
                  <Beaker size={16} />
                  先加少量食用油
                </button>
                <button
                  type="button"
                  className={styles.primaryAction}
                  onClick={moveIntoPan}
                  data-phase-action="move-pan"
                >
                  把{ingredient.name}放入锅中
                  <ArrowRight size={16} />
                </button>
                <div className={styles.safetyNote}>
                  <Info size={15} />
                  水煮、蒸制可以不额外加油；煎炒时油要计入总油量。
                </div>
              </div>
            )}

            {session.phase === "cook" && ingredient && session.state && (
              <div className={styles.cookPanel}>
                <div className={styles.cookTabs} role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={cookTab === "heat"}
                    className={cookTab === "heat" ? styles.cookTabActive : ""}
                    onClick={() => setCookTab("heat")}
                  >
                    <Flame size={15} />
                    火候
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={cookTab === "seasoning"}
                    className={
                      cookTab === "seasoning" ? styles.cookTabActive : ""
                    }
                    onClick={() => setCookTab("seasoning")}
                  >
                    <Beaker size={15} />
                    调味
                  </button>
                </div>
                {session.state.events.at(-1) && (
                  <div className={styles.latestEvent}>
                    <span>刚刚发生</span>
                    <strong>{session.state.events.at(-1)?.title}</strong>
                    <p>{session.state.events.at(-1)?.description}</p>
                    <div>
                      {session.state.events
                        .at(-1)
                        ?.principleTags.slice(0, 3)
                        .map((tag) => (
                          <i key={tag}>{principleTagLabels[tag]}</i>
                        ))}
                    </div>
                  </div>
                )}
                {cookTab === "heat" ? (
                  <div className={styles.heatControls}>
                    <div className={styles.controlBlock}>
                      <span>加热方式</span>
                      <div className={styles.methodGrid}>
                        {(moreMethodsOpen
                          ? heatMethods
                          : heatMethods.filter((method) =>
                              profile?.preferredMethods.includes(method.id),
                            )
                        ).map((method) => (
                          <button
                            type="button"
                            key={method.id}
                            className={
                              heatMethod === method.id
                                ? styles.methodActive
                                : ""
                            }
                            onClick={() => {
                              setHeatMethod(method.id);
                              setTargetTemperature(
                                methodTemperatures[method.id],
                              );
                            }}
                          >
                            <strong>{method.name}</strong>
                            <small>{method.description}</small>
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        className={styles.moreToggle}
                        onClick={() =>
                          setMoreMethodsOpen((current) => !current)
                        }
                      >
                        {moreMethodsOpen ? "收起其他方式" : "更多加热方式"}
                        <ChevronDown
                          size={14}
                          className={moreMethodsOpen ? styles.isOpen : ""}
                        />
                      </button>
                    </div>
                    <div className={styles.controlBlock}>
                      <span>火力</span>
                      <div className={styles.heatLevelRow}>
                        {(["low", "medium", "high"] as HeatLevel[]).map(
                          (level) => (
                            <button
                              type="button"
                              key={level}
                              className={
                                heatLevel === level
                                  ? styles.levelActive
                                  : ""
                              }
                              onClick={() => setHeatLevel(level)}
                            >
                              {level === "low"
                                ? "小火"
                                : level === "medium"
                                  ? "中火"
                                  : "大火"}
                            </button>
                          ),
                        )}
                      </div>
                    </div>
                    <label className={styles.slider}>
                      <span>
                        <span>
                          <ThermometerSun size={14} />
                          目标温度
                        </span>
                        <strong>{targetTemperature}°C</strong>
                      </span>
                      <input
                        type="range"
                        min={50}
                        max={260}
                        step={5}
                        value={targetTemperature}
                        onChange={(event) =>
                          setTargetTemperature(Number(event.target.value))
                        }
                      />
                    </label>
                    <label className={styles.slider}>
                      <span>
                        <span>
                          <Timer size={14} />
                          计划时长
                        </span>
                        <strong>{durationMin} 分钟</strong>
                      </span>
                      <input
                        type="range"
                        min={0.5}
                        max={60}
                        step={0.5}
                        value={durationMin}
                        onChange={(event) =>
                          setDurationMin(Number(event.target.value))
                        }
                      />
                    </label>
                    <div className={styles.heatOptions}>
                      <label>
                        <input
                          type="checkbox"
                          checked={lidCovered}
                          onChange={(event) =>
                            setLidCovered(event.target.checked)
                          }
                        />
                        盖盖
                      </label>
                      <div>
                        {stirOptions.map((option) => (
                          <button
                            type="button"
                            key={option.id}
                            className={
                              stirIntensity === option.id
                                ? styles.optionActive
                                : ""
                            }
                            onClick={() =>
                              setStirIntensity(option.id)
                            }
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {session.workspace.session && (
                      <div className={styles.liveHeatReadout}>
                        <div>
                          <span>当前温度</span>
                          <strong>
                            {Math.round(
                              session.workspace.session
                                .currentTemperature,
                            )}
                            °C
                          </strong>
                        </div>
                        <div>
                          <span>模拟受热</span>
                          <strong>
                            {(
                              session.workspace.session.elapsedSimSeconds / 60
                            ).toFixed(1)}
                            min
                          </strong>
                        </div>
                      </div>
                    )}
                    <div className={styles.heatActions}>
                      {isHeating ? (
                        <button
                          type="button"
                          className={styles.secondaryAction}
                          onClick={pauseHeating}
                        >
                          <Pause size={16} />
                          暂停
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={styles.primaryAction}
                          onClick={beginHeating}
                          data-phase-action="start-heat"
                        >
                          <Play size={16} />
                          {session.workspace.session
                            ? "继续加热"
                            : "点火开始"}
                        </button>
                      )}
                      {session.workspace.session && (
                        <button
                          type="button"
                          className={styles.stopHeat}
                          onClick={stopHeating}
                          data-phase-action="stop-heat"
                        >
                          <Flame size={16} />
                          关火并检查
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className={styles.seasoningControls}>
                    <div className={styles.commonSeasonings}>
                      {seasonings
                        .filter((item) =>
                          commonSeasoningIds.includes(item.id),
                        )
                        .map((item) => (
                          <button
                            type="button"
                            key={item.id}
                            className={
                              selectedSeasoning === item.id
                                ? styles.seasoningActive
                                : ""
                            }
                            onClick={() => {
                              setSelectedSeasoning(item.id);
                              setAmountValue(0);
                            }}
                          >
                            <strong>{item.shortName}</strong>
                            <small>{item.name}</small>
                          </button>
                        ))}
                    </div>
                    <button
                      type="button"
                      className={styles.moreToggle}
                      onClick={() =>
                        setMoreSeasoningsOpen((current) => !current)
                      }
                    >
                      展开全部 {seasonings.length} 种调料
                      <ChevronDown
                        size={15}
                        className={
                          moreSeasoningsOpen ? styles.isOpen : ""
                        }
                      />
                    </button>
                    {moreSeasoningsOpen && (
                      <div className={styles.seasoningFamilies}>
                        {seasoningFamilies.map((family) => (
                          <div key={family}>
                            <span>{family}</span>
                            <div>
                              {seasonings
                                .filter(
                                  (item) => item.family === family,
                                )
                                .map((item) => (
                                  <button
                                    type="button"
                                    key={item.id}
                                    className={
                                      selectedSeasoning === item.id
                                        ? styles.seasoningPillActive
                                        : ""
                                    }
                                    onClick={() =>
                                      setSelectedSeasoning(item.id)
                                    }
                                  >
                                    {item.shortName}
                                  </button>
                                ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className={styles.amountHeader}>
                      <div>
                        <span>用量</span>
                        <strong>
                          {preciseAmount
                            ? `${amountValue || 0}${selectedSeasoningDefinition.unit}`
                            : amountLevels.find(
                                (level) => level.id === amountLevel,
                              )?.label}
                        </strong>
                      </div>
                      <label>
                        <input
                          type="checkbox"
                          checked={preciseAmount}
                          onChange={(event) =>
                            setPreciseAmount(event.target.checked)
                          }
                        />
                        精确值
                      </label>
                    </div>
                    {preciseAmount ? (
                      <label className={styles.preciseAmount}>
                        <input
                          type="number"
                          min={0.1}
                          max={500}
                          step={0.5}
                          value={amountValue || ""}
                          onChange={(event) =>
                            setAmountValue(Number(event.target.value))
                          }
                          aria-label="精确用量"
                        />
                        <span>{selectedSeasoningDefinition.unit}</span>
                      </label>
                    ) : (
                      <div className={styles.amountLevels}>
                        {amountLevels.map((level) => (
                          <button
                            type="button"
                            key={level.id}
                            className={
                              amountLevel === level.id
                                ? styles.optionActive
                                : ""
                            }
                            onClick={() => setAmountLevel(level.id)}
                          >
                            {level.label}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className={styles.seasoningNote}>
                      <Info size={14} />
                      {selectedSeasoningDefinition.description}
                    </div>
                    <button
                      type="button"
                      className={styles.primaryAction}
                      onClick={addSeasoning}
                      disabled={
                        preciseAmount &&
                        (!amountValue || amountValue <= 0)
                      }
                    >
                      加入{selectedSeasoningDefinition.name}
                    </button>
                  </div>
                )}
              </div>
            )}

            {session.phase === "plate" && completion && (
              <div className={styles.platePanel}>
                <div className={styles.plateHero}>
                  <span>
                    <UtensilsCrossed size={25} />
                  </span>
                  <div>
                    <small>完成条件检查</small>
                    <strong>
                      {completion.canPlate ? "可以装盘" : "还差几步"}
                    </strong>
                  </div>
                </div>
                <div className={styles.checkList}>
                  {completion.checks.map((check) => (
                    <div
                      key={check.id}
                      className={`${styles.checkItem} ${
                        check.passed ? styles.checkPassed : ""
                      }`}
                    >
                      <span>
                        {check.passed ? (
                          <Check size={13} />
                        ) : (
                          <Circle size={11} />
                        )}
                      </span>
                      <div>
                        <strong>
                          {check.label}
                          {!check.required && <i>可选</i>}
                        </strong>
                        <small>{check.detail}</small>
                      </div>
                    </div>
                  ))}
                </div>
                {completion.canPlate ? (
                  <button
                    type="button"
                    className={styles.primaryAction}
                    onClick={plateDish}
                    data-phase-action="plate"
                  >
                    装盘并生成复盘
                    <Sparkles size={16} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.secondaryAction}
                    onClick={returnToCook}
                  >
                    <ArrowLeft size={16} />
                    返回继续烹饪
                  </button>
                )}
                {!completion.canPlate && (
                  <div className={styles.safetyNote}>
                    <Info size={15} />
                    缺少：{completion.missing.join("、")}。系统不提供星级或成功/失败判定。
                  </div>
                )}
              </div>
            )}

            {session.phase === "recap" && finalRecap && (
              <div className={styles.recapPanel}>
                <span className={styles.recapEyebrow}>DISH COMPLETE</span>
                <h2>{finalRecap.dishName}</h2>
                <p>{finalRecap.summary}</p>
                <div className={styles.recapMetrics}>
                  <span>{finalRecap.flavorSummary}</span>
                  <span>{finalRecap.textureSummary}</span>
                </div>
                <div className={styles.recapMechanisms}>
                  {finalRecap.mechanisms.slice(0, 3).map((item) => (
                    <details key={item.title}>
                      <summary>
                        <span>{item.title}</span>
                        <ChevronDown size={14} />
                      </summary>
                      <p>{item.detail}</p>
                      <small>换食材也成立：{item.transfer}</small>
                    </details>
                  ))}
                </div>
                <div className={styles.safetyNote}>
                  <Info size={15} />
                  {finalRecap.safety}
                </div>
                <div className={styles.recapActions}>
                  <button
                    type="button"
                    className={styles.primaryAction}
                    onClick={startNewRound}
                    data-recap-action="new-round"
                  >
                    <RotateCcw size={16} />
                    重新做菜
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryAction}
                    onClick={shareToCommunity}
                    data-recap-action="community"
                  >
                    <MessageCircle size={16} />
                    进入厨友社区
                  </button>
                  <button
                    type="button"
                    className={styles.textAction}
                    onClick={() => router.push("/")}
                    data-recap-action="exit"
                  >
                    退出首页
                  </button>
                </div>
                <Link
                  className={styles.recapCompareLink}
                  href="/compare/"
                >
                  查看保存的实验结果
                  <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </aside>
        )}

        <div className={styles.sceneCaption}>
          <span>{activeStation.label}</span>
          <small>{activeStation.hint}</small>
        </div>

        <nav className={sceneStyles.stationDock} aria-label="厨房工位">
          {stations.map((station, index) => {
            const Icon = station.icon;
            const isActive = station.id === activeStation.id;
            return (
              <button
                type="button"
                key={station.id}
                data-station-dock={station.id}
                className={`${sceneStyles.dockButton} ${
                  isActive ? sceneStyles.dockButtonActive : ""
                }`}
                onClick={() => setActiveStationId(station.id)}
                aria-current={isActive ? "location" : undefined}
              >
                <span>{index + 1}</span>
                <Icon size={16} />
                <strong>{station.label}</strong>
              </button>
            );
          })}
        </nav>

        {session.phase === "partner" && (
          <div className={styles.partnerSelection} role="dialog" aria-modal="true" aria-label="选择AI指导伙伴">
            <div className={styles.partnerSelectionCard}>
              <span className={styles.selectionEyebrow}>
                <ChefHat size={15} />
                SIMULATING-COOK · KITCHEN 01
              </span>
              <h1>今天，让谁陪你进厨房？</h1>
              <p>
                三位伙伴共享同一套食材与烹饪原理；区别在于更擅长提醒你看什么。
              </p>
              {resumeCandidate && (
                <div className={styles.resumeBanner}>
                  <div>
                    <span>上次未完成</span>
                    <strong>
                      {resumeCandidate.ingredientId
                        ? getIngredient(resumeCandidate.ingredientId).name
                        : "烹饪实验"}{" "}
                      ·{" "}
                      {guidedPhases.find(
                        (phase) => phase.id === resumeCandidate.phase,
                      )?.label}
                    </strong>
                  </div>
                  <button
                    type="button"
                    onClick={resumeSavedSession}
                    data-resume-session
                  >
                    继续
                  </button>
                  <button
                    type="button"
                    onClick={discardSavedSession}
                    aria-label="放弃上次实验"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              <div className={styles.partnerGrid}>
                {guidePartners.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    data-partner-id={item.id}
                    className={styles.partnerCard}
                    onClick={() => choosePartner(item.id)}
                  >
                    <span
                      className={styles.partnerPortrait}
                      style={{ background: item.accent }}
                    >
                      <i>{item.name.slice(0, 1)}</i>
                    </span>
                    <span className={styles.partnerRole}>{item.role}</span>
                    <strong>{item.name}</strong>
                    <small>{item.tagline}</small>
                    <p>{item.focus}</p>
                    <span className={styles.choosePartner}>
                      选择伙伴
                      <ArrowRight size={14} />
                    </span>
                  </button>
                ))}
              </div>
              <div className={styles.selectionFooter}>
                <span>
                  <CircleHelp size={14} />
                  伙伴只是辅助，不会替你锁住操作。
                </span>
                <span>
                  <MessageCircle size={14} />
                  随时切换流程指导或交流对话
                </span>
              </div>
            </div>
          </div>
        )}

        {notice && (
          <div className={styles.notice} role="status">
            <Sparkles size={15} />
            {notice}
          </div>
        )}
      </section>

      {partner && (
        <GuideDrawer
          open={guideOpen}
          partner={partner}
          session={session}
          mode={guideMode}
          messages={messages}
          busy={aiBusy}
          voiceEnabled={voiceEnabled}
          recommendation={recommendation}
          onClose={() => setGuideOpen(false)}
          onModeChange={setGuideMode}
          onToggleVoice={toggleVoice}
          onAsk={askPartner}
        />
      )}

      <footer className={styles.pageFooter}>
        <div>
          <span>SIMULATING-COOK · GUIDED KITCHEN</span>
          <strong>先理解，再动手；先观察，再调味。</strong>
        </div>
        <p>
          模拟结果用于理解趋势，不替代真实菜谱、过敏判断和食品安全操作。当前进度只保存在本机浏览器。
        </p>
        <Link href="/kitchen/">
          进入自由实验与 A/B 对照
          <ArrowRight size={15} />
        </Link>
      </footer>
    </div>
  );
}
