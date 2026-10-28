"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Beaker,
  Check,
  ChevronDown,
  CircleHelp,
  Copy,
  Flame,
  FlaskConical,
  GitCompareArrows,
  Info,
  MessagesSquare,
  Plus,
  Play,
  Pause,
  RotateCcw,
  Save,
  Scale,
  SlidersHorizontal,
  Sparkles,
  ThermometerSun,
  Timer,
  Trash2,
  Undo2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { FlavorBars } from "@/components/flavor-bars";
import { AnimatedNumber } from "@/components/kitchen/animated-number";
import { KitchenScene } from "@/components/kitchen/kitchen-scene";
import { OnboardingCoach } from "@/components/kitchen/onboarding-coach";
import { WorkflowGuide } from "@/components/kitchen/workflow-guide";
import { categoryMeta, heatMethods } from "@/lib/constants";
import { buildFeedback, foodFormFromState } from "@/lib/feedback";
import { getIngredient, ingredients } from "@/lib/ingredients";
import { playKitchenSound } from "@/lib/kitchen-audio";
import { activeTask, planKitchenTasks } from "@/lib/kitchen-tasks";
import {
  compareBranchActions,
  comparePrediction,
  detectPredictedChanges,
  stateDelta,
} from "@/lib/learning";
import {
  featuredIngredientIds,
  ingredientPhoto,
} from "@/lib/media";
import { seasonings } from "@/lib/principles";
import {
  applyAction,
  advanceCookingSession,
  createInitialState,
  describeAction,
  finishCookingSession,
  getTasteLabel,
} from "@/lib/simulator";
import {
  addExperiment,
  createSnapshot,
  loadComparisonIds,
  loadExperiments,
  MAX_COMPARISON,
  removeExperiment,
  storeComparisonIds,
} from "@/lib/storage";
import {
  outcomeGoals,
  predictionChoices,
  principleTagLabels,
  treatmentGroupsForIngredient,
} from "@/lib/treatments";
import { analyzeKitchenWorkflow } from "@/lib/workflow";
import type {
  AmountInput,
  AmountLevel,
  CookingSession,
  ContextRecommendation,
  ExperimentBranch,
  ExperimentSnapshot,
  FeedbackMessage,
  FoodForm,
  HeatAction,
  HeatLevel,
  HeatMethod,
  KitchenAction,
  KitchenStation,
  KitchenTask,
  KitchenWorkspace,
  OutcomeGoal,
  ParticleEffect,
  PredictionKind,
  SeasoningId,
  StirIntensity,
  TreatmentCategory,
  WorkflowStep,
} from "@/lib/types";

type WorkspaceTab = "treat" | "heat" | "season";

const amountLevels: { id: AmountLevel; label: string; hint: string }[] = [
  { id: "little", label: "少许", hint: "轻一点" },
  { id: "moderate", label: "适量", hint: "常规量" },
  { id: "lot", label: "较多", hint: "明显加强" },
];

const heatLevels: { id: HeatLevel; label: string }[] = [
  { id: "low", label: "小火" },
  { id: "medium", label: "中火" },
  { id: "high", label: "大火" },
];

const stirOptions: { id: StirIntensity; label: string }[] = [
  { id: "none", label: "不翻动" },
  { id: "gentle", label: "轻推" },
  { id: "frequent", label: "频繁翻动" },
];

const treatmentGroups: {
  id: TreatmentCategory;
  label: string;
  description: string;
}[] = [
  { id: "mechanical", label: "机械与结构", description: "切、撕、拍、压，改变热量与调味进入的路径。" },
  { id: "water-salt", label: "水盐与扩散", description: "控制表面水、渗透、腌制和入味速度。" },
  { id: "biological", label: "生物与酶", description: "安全模拟短时腌制、氧化和酶活性变化。" },
  { id: "universal", label: "通用处理", description: "任何食材都可用的基础动作。" },
];

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

const seasoningFamilies = [
  "基础咸味",
  "酸味",
  "甜味",
  "香辛料",
  "油脂类",
  "辅助类",
  "水",
] as const;

const visibleSeasonings = seasonings.filter(
  (seasoning) => !["oil", "vinegar", "chili"].includes(seasoning.id),
);

function makeBranch(
  id: "A" | "B",
  ingredientId: string,
  branchGroupId = `group-${ingredientId}`,
): ExperimentBranch {
  const state = createInitialState(ingredientId);
  return {
    id,
    label: id === "A" ? "1 号试验锅" : "2 号试验锅",
    ingredientId,
    state,
    history: [],
    actions: [],
    branchGroupId,
    workspace: {
      station: "sink",
      sampleStation: "sink",
      inPan: false,
    },
  };
}

function initialIngredient(searchParams: ReturnType<typeof useSearchParams>) {
  const requested = searchParams.get("ingredient");
  return ingredients.some((item) => item.id === requested)
    ? (requested as string)
    : "potato";
}

function goalLabel(goal: OutcomeGoal) {
  return outcomeGoals.find((item) => item.id === goal)?.name ?? "未设目标";
}

function BranchSummary({
  branch,
  reference,
}: {
  branch: ExperimentBranch;
  reference?: ExperimentBranch;
}) {
  const ingredient = getIngredient(branch.ingredientId);
  const delta =
    reference && reference.id !== branch.id
      ? stateDelta(reference.state, branch.state)
      : null;
  return (
    <article className="branch-summary-card">
      <div className="branch-summary-head">
        <span className="branch-badge">{branch.id === "A" ? "1" : "2"}</span>
        <div>
          <span className="mini-label">{ingredient.name} · {branch.actions.length} 步</span>
          <h3>{branch.label}</h3>
        </div>
        <span
          className="branch-color"
          style={{ backgroundColor: branch.state.appearance.color }}
        />
      </div>
      <p className="branch-appearance">{branch.state.appearance.label}</p>
      <FlavorBars flavor={branch.state.flavor} compact />
      <div className="branch-metrics">
        {[
          ["水分", Math.round(branch.state.properties.moisture), "moisture"],
          ["脆度", Math.round(branch.state.properties.crispness), "crispness"],
          ["嫩度", Math.round(branch.state.properties.tenderness), "tenderness"],
          ["上色", Math.round(branch.state.properties.browning), "browning"],
          ["挂汁", Math.round(branch.state.properties.sauceCoating), "sauceCoating"],
          ["浓淡", Math.round(branch.state.flavor.intensity), "intensity"],
        ].map(([label, value, key]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            {delta && (
              <small>
                {delta[key as keyof typeof delta] > 0 ? "+" : ""}
                {delta[key as keyof typeof delta]}
              </small>
            )}
          </div>
        ))}
      </div>
      <div className="branch-action-list">
        {branch.actions.length === 0 ? (
          <span>尚未操作</span>
        ) : (
          branch.actions.map((action, index) => (
            <span key={`${branch.id}-${index}`}>
              {String(index + 1).padStart(2, "0")} {describeAction(action)}
            </span>
          ))
        )}
      </div>
    </article>
  );
}

export function KitchenStudio() {
  const searchParams = useSearchParams();
  const initialId = initialIngredient(searchParams);
  const [branches, setBranches] = useState<ExperimentBranch[]>(() => [
    makeBranch("A", initialId),
  ]);
  const [activeBranchId, setActiveBranchId] = useState<"A" | "B">("A");
  const active = branches.find((branch) => branch.id === activeBranchId) ?? branches[0];
  const ingredient = getIngredient(active.ingredientId);
  const state = active.state;
  const actions = active.actions;
  const stateHistory = active.history;

  const [activeTab, setActiveTab] = useState<WorkspaceTab>("treat");
  const [heatMethod, setHeatMethod] = useState<HeatMethod>("stir-fry");
  const [heatLevel, setHeatLevel] = useState<HeatLevel>("medium");
  const [targetTemperature, setTargetTemperature] = useState(160);
  const [durationMin, setDurationMin] = useState(2);
  const [lidCovered, setLidCovered] = useState(false);
  const [stirIntensity, setStirIntensity] = useState<StirIntensity>("gentle");
  const [amountLevel, setAmountLevel] = useState<AmountLevel>("moderate");
  const [preciseAmount, setPreciseAmount] = useState(false);
  const [amountValue, setAmountValue] = useState(0);
  const [selectedSeasoning, setSelectedSeasoning] = useState<SeasoningId>("salt");
  const [selectedGoal, setSelectedGoal] = useState<OutcomeGoal | null>(null);
  const [predictionMode, setPredictionMode] = useState(false);
  const [predictions, setPredictions] = useState<PredictionKind[]>([]);
  const [predictionReview, setPredictionReview] = useState<{
    matched: PredictionKind[];
    missed: PredictionKind[];
    unexpected: PredictionKind[];
    title: string;
    explanation: string;
  } | null>(null);
  const [snapshotName, setSnapshotName] = useState("");
  const [saved, setSaved] = useState<ExperimentSnapshot[]>([]);
  const [comparison, setComparison] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [onboardingStep, setOnboardingStep] = useState<number | null>(null);
  const [effects, setEffects] = useState<ParticleEffect[]>([]);
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  const effectCounter = useRef(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(loadExperiments());
    setComparison(loadComparisonIds());
  }, []);

  useEffect(() => {
    try {
      const savedSound = window.localStorage.getItem("cooking-lab:sound:v1");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (savedSound === "off") setSoundEnabled(false);
      const onboarding = window.localStorage.getItem(
        "cooking-lab:onboarding:v1",
      );
      if (onboarding !== "done") setOnboardingStep(0);
    } catch {
      // Browser privacy mode may disable local preferences.
    }
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const isHeating = active.workspace?.session?.isHeating ?? false;

  useEffect(() => {
    if (!isHeating) return;
    let lastTick = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const deltaSeconds = Math.min(2, (now - lastTick) / 1000);
      lastTick = now;
      setBranches((current) =>
        current.map((branch) => {
          if (
            branch.id !== activeBranchId ||
            !branch.workspace?.session?.isHeating
          ) {
            return branch;
          }
          const result = advanceCookingSession(
            branch.state,
            branch.workspace.session,
            deltaSeconds,
          );
          const reachedLimit =
            result.session.elapsedSimSeconds >= durationMin * 60;
          return {
            ...branch,
            state: result.state,
            workspace: {
              ...branch.workspace,
              station: "pan",
              sampleStation: "pan",
              inPan: true,
              session: {
                ...result.session,
                isHeating: reachedLimit ? false : result.session.isHeating,
              },
            },
          };
        }),
      );
    }, 250);
    const pauseWhenHidden = () => {
      if (document.visibilityState === "hidden") {
        setBranches((current) =>
          current.map((branch) =>
            branch.id === activeBranchId && branch.workspace?.session
              ? {
                  ...branch,
                  workspace: {
                    ...branch.workspace,
                    session: {
                      ...branch.workspace.session,
                      isHeating: false,
                    },
                  },
                }
              : branch,
          ),
        );
        playKitchenSound("sizzle-stop");
      }
    };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", pauseWhenHidden);
    };
  }, [activeBranchId, durationMin, isHeating]);

  const selectedSeasoningDefinition = seasonings.find(
    (item) => item.id === selectedSeasoning,
  )!;
  const groups = treatmentGroupsForIngredient(ingredient.id);
  const workspace: KitchenWorkspace = active.workspace ?? {
    station: "sink",
    sampleStation: "sink",
    inPan: false,
  };
  const branchB = branches.find((branch) => branch.id === "B");
  const branchDiff =
    branchB && branches[0]
      ? compareBranchActions(branches[0], branchB)
      : null;
  const availableGoals = outcomeGoals;
  const goalDefinition = selectedGoal
    ? outcomeGoals.find((item) => item.id === selectedGoal)
    : null;
  const tasks = planKitchenTasks(ingredient.id, actions, workspace);
  const currentTask = activeTask(tasks);
  const foodForm = foodFormFromState(state, actions.length) as FoodForm;
  const workflow = analyzeKitchenWorkflow({
    ingredientId: ingredient.id,
    actions,
    workspace,
    state,
    goal: selectedGoal,
    isHeating,
    hasSavedResult: saved.some(
      (experiment) => experiment.branchGroupId === active.branchGroupId,
    ),
  });

  const currentFlavorSummary = (() => {
    const rows = [
      ["酸", state.flavor.sour],
      ["甜", state.flavor.sweet],
      ["咸", state.flavor.salty],
      ["鲜", state.flavor.umami],
      ["辣", state.flavor.spicy],
    ] as const;
    const strongest = rows.reduce((a, b) => (a[1] >= b[1] ? a : b));
    return strongest[1] < 10
      ? "味道仍然清淡"
      : `${strongest[0]}味${getTasteLabel(strongest[1])}`;
  })();

  function updateBranch(
    updater: (branch: ExperimentBranch) => ExperimentBranch,
  ) {
    setBranches((current) =>
      current.map((branch) =>
        branch.id === activeBranchId ? updater(branch) : branch,
      ),
    );
  }

  function updateWorkspace(workspaceUpdate: Partial<KitchenWorkspace>) {
    updateBranch((branch) => ({
      ...branch,
      workspace: {
        ...(branch.workspace ?? {
          station: "sink",
          sampleStation: "sink",
          inPan: false,
        }),
        ...workspaceUpdate,
      },
    }));
  }

  function triggerEffect(type: ParticleEffect["type"]) {
    effectCounter.current += 1;
    const effect = { id: effectCounter.current, type };
    setEffects((current) => [...current.slice(-2), effect]);
    window.setTimeout(() => {
      setEffects((current) => current.filter((item) => item.id !== effect.id));
    }, 1400);
    if (!soundEnabled) return;
    if (type === "water") playKitchenSound("water");
    else if (type === "cut") playKitchenSound("cut");
    else if (type === "sizzle") playKitchenSound("sizzle-start");
  }

  function stationForAction(action: KitchenAction): KitchenStation {
    if (action.type === "heat" || action.type === "season") return "pan";
    if (action.type === "prep") {
      return ["wash", "soak"].includes(action.prepId) ? "sink" : "board";
    }
    const id = action.operationId;
    if (
      ["wash", "soak", "archetype-staple-rinse"].includes(id) ||
      id.includes("rinse") ||
      id.includes("soak") ||
      id.includes("clean")
    ) {
      return "sink";
    }
    return "board";
  }

  function moveSample(station: KitchenStation) {
    updateBranch((branch) => {
      const current = branch.workspace ?? {
        station: "sink" as const,
        sampleStation: "sink" as const,
        inPan: false,
      };
      return {
        ...branch,
        workspace: {
          ...current,
          station,
          sampleStation: station,
          inPan: station === "pan",
          session:
            station === "pan" || !current.session?.isHeating
              ? current.session
              : { ...current.session, isHeating: false },
        },
      };
    });
    if (station === "pan") {
      setFeedback({
        id: "moved-pan",
        tone: "neutral",
        text: "食材已经入锅。现在可以选择火力并点火。",
      });
    }
  }

  function switchBranch(nextId: "A" | "B") {
    if (nextId === activeBranchId) return;
    if (workspace.session?.isHeating) {
      updateWorkspace({
        session: { ...workspace.session, isHeating: false },
      });
      playKitchenSound("sizzle-stop");
    }
    setActiveBranchId(nextId);
    setPredictionReview(null);
  }

  function handleTaskClick(task: KitchenTask) {
    updateWorkspace({ station: task.station });
    if (task.id === "pan") {
      moveSample("pan");
    } else if (task.operationId) {
      setActiveTab("treat");
      setNotice(`下一步：${task.title}`);
      window.setTimeout(() => {
        document
          .querySelector(`[data-operation-id="${task.operationId}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 80);
    }
  }

  function scrollToArea(selector: string) {
    window.setTimeout(() => {
      document.querySelector(selector)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 60);
  }

  function handleWorkflowStep(step: WorkflowStep) {
    if (step.station) updateWorkspace({ station: step.station });
    if (step.targetTab === "ingredient") {
      scrollToArea(".ingredient-selector-panel");
      return;
    }
    if (step.targetTab === "treat") {
      setActiveTab("treat");
      scrollToArea(".controls-panel");
      return;
    }
    if (step.targetTab === "pan") {
      scrollToArea(".three-station-kitchen");
      return;
    }
    if (step.targetTab === "heat") {
      setActiveTab("heat");
      scrollToArea(".controls-panel");
      return;
    }
    if (step.targetTab === "season") {
      setActiveTab("season");
      scrollToArea(".controls-panel");
      return;
    }
    scrollToArea(".save-panel");
  }

  function handleRecommendationClick(recommendation: ContextRecommendation) {
    if (recommendation.station === "pan" && recommendation.id === "recommend-pan") {
      moveSample("pan");
    }
    if (recommendation.operationId) {
      setActiveTab("treat");
      setNotice(`建议操作：${recommendation.title}`);
      window.setTimeout(() => {
        document
          .querySelector(
            `[data-operation-id="${recommendation.operationId}"]`,
          )
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 80);
      return;
    }
    if (recommendation.targetTab === "heat") {
      setActiveTab("heat");
      scrollToArea(".controls-panel");
      return;
    }
    if (recommendation.targetTab === "season") {
      setActiveTab("season");
      scrollToArea(".controls-panel");
      return;
    }
    if (recommendation.targetTab === "pan") {
      scrollToArea(".three-station-kitchen");
      return;
    }
    scrollToArea(".save-panel");
  }

  function runAction(action: KitchenAction) {
    if (predictionMode && predictions.length === 0) {
      setNotice("先选择一个预测，或关闭预测模式");
      return;
    }
    const before = active.state;
    const next = applyAction(before, action);
    const latest = next.events.at(-1);
    if (predictionMode && latest) {
      const observed = detectPredictedChanges(before, next);
      const review = comparePrediction(predictions, observed);
      setPredictionReview({
        ...review,
        title: latest.title,
        explanation: latest.description,
      });
      setPredictions([]);
    }
    const station = stationForAction(action);
    updateBranch((branch) => ({
      ...branch,
      state: next,
      history: [...branch.history, branch.state],
      actions: [...branch.actions, action],
      workspace: {
        ...(branch.workspace ?? {
          station: "sink" as const,
          sampleStation: "sink" as const,
          inPan: false,
        }),
        station,
        sampleStation: station,
        inPan: station === "pan",
      },
    }));
    setFeedback(buildFeedback(next, action));
    if (action.type === "operation") {
      const id = action.operationId;
      if (id.includes("cut") || id.includes("tear") || id.includes("slice") || id.includes("score")) {
        triggerEffect("cut");
      } else if (id.includes("wash") || id.includes("soak") || id.includes("rinse")) {
        triggerEffect("water");
      }
    }
  }

  function undo() {
    if (workspace.session) playKitchenSound("sizzle-stop");
    updateBranch((branch) => {
      const previous = branch.history.at(-1);
      if (!previous) return branch;
      return {
        ...branch,
        state: previous,
        history: branch.history.slice(0, -1),
        actions: branch.actions.slice(0, -1),
        workspace: {
          ...(branch.workspace ?? workspace),
          station: "board",
          sampleStation: "board",
          inPan: false,
          session: undefined,
          heatStartState: undefined,
        },
      };
    });
    setPredictionReview(null);
    setNotice(`已撤销${active.label}上一步`);
  }

  function resetActiveBranch() {
    updateBranch((branch) => ({
      ...branch,
      state: createInitialState(branch.ingredientId),
      history: [],
      actions: [],
      workspace: {
        station: "sink",
        sampleStation: "sink",
        inPan: false,
      },
    }));
    setPredictionReview(null);
    setPredictions([]);
    setNotice(`${active.label}已重置`);
  }

  function resetExperiment() {
    playKitchenSound("sizzle-stop");
    setBranches([
      makeBranch("A", ingredient.id, `group-${ingredient.id}`),
    ]);
    setActiveBranchId("A");
    setPredictionReview(null);
    setPredictions([]);
    setFeedback({
      id: "experiment-reset",
      tone: "neutral",
      text: "实验已重置。可以从清洗食材重新开始。",
    });
    setEffects([]);
    setSnapshotName("");
    setNotice("实验已全部重置，已保存的历史记录不受影响");
  }

  function changeIngredient(nextId: string) {
    playKitchenSound("sizzle-stop");
    const nextIngredient = getIngredient(nextId);
    setBranches([makeBranch("A", nextId, `group-${nextId}`)]);
    setActiveBranchId("A");
    setSelectedGoal(null);
    setPredictionReview(null);
    setNotice(`已换成${nextIngredient.name}，开始新的 1 号试验锅`);
  }

  function duplicateBranch() {
    if (branchB) {
      setNotice("当前已经有 1 号和 2 号试验锅");
      return;
    }
    if (workspace.session?.isHeating) {
      updateWorkspace({
        session: { ...workspace.session, isHeating: false },
      });
      playKitchenSound("sizzle-stop");
    }
    const groupId = active.branchGroupId;
    const cloned: ExperimentBranch = {
      ...structuredClone(active),
      id: "B",
      label: "2 号试验锅",
      branchGroupId: groupId,
      workspace: {
        ...(active.workspace ?? workspace),
        session: undefined,
        heatStartState: undefined,
      },
    };
    setBranches((current) => [
      { ...current[0], branchGroupId: groupId },
      cloned,
    ]);
    setActiveBranchId("B");
    setNotice("已复制为 2 号试验锅；现在只改变一个变量做对照");
  }

  function removeBranch() {
    if (!branchB) return;
    playKitchenSound("sizzle-stop");
    setBranches([branches[0]]);
    setActiveBranchId("A");
    setNotice("2 号试验锅已关闭");
  }

  function startLiveHeat() {
    if (predictionMode && predictions.length === 0) {
      setNotice("先选择一个预测，或关闭预测模式");
      return;
    }
    if (!workspace.inPan) {
      setNotice("锅是空的哦：先把食材移到炒锅区域");
      setFeedback({
        id: "empty-pan",
        tone: "warning",
        text: "锅是空的。先把食材放到炒锅，再点火。",
      });
      return;
    }
    if (workspace.session && workspace.session.elapsedSimSeconds > 0) {
      updateWorkspace({
        station: "pan",
        sampleStation: "pan",
        inPan: true,
        session: {
          ...workspace.session,
          isHeating: true,
          targetTemperature,
          heatLevel,
          method: heatMethod,
          lidCovered,
          stirIntensity,
        },
      });
    } else {
      const session: CookingSession = {
        isHeating: true,
        targetTemperature,
        currentTemperature: state.properties.temperature,
        elapsedSimSeconds: 0,
        heatLevel,
        method: heatMethod,
        lidCovered,
        stirIntensity,
      };
      updateWorkspace({
        station: "pan",
        sampleStation: "pan",
        inPan: true,
        session,
        heatStartState: structuredClone(state),
      });
    }
    setFeedback({
      id: "heat-start",
      tone: "neutral",
      text: "点火后温度会持续上升。观察水分、熟度和颜色，达到目标后关火。",
    });
    triggerEffect("sizzle");
  }

  function pauseLiveHeat() {
    if (!workspace.session) return;
    updateWorkspace({
      session: { ...workspace.session, isHeating: false },
    });
    playKitchenSound("sizzle-stop");
    setFeedback({
      id: "heat-pause",
      tone: "neutral",
      text: "已暂停加热。可以调整火力、盖盖或翻动方式后再继续。",
    });
  }

  function stopLiveHeat() {
    const session = workspace.session;
    const startState = workspace.heatStartState;
    if (!session || !startState) return;
    const finished = finishCookingSession(startState, state, session);
    const action: HeatAction = {
      type: "heat",
      method: session.method,
      heatLevel: session.heatLevel,
      targetTemperature: session.targetTemperature,
      durationMin: Math.max(0.1, session.elapsedSimSeconds / 60),
      lidCovered: session.lidCovered,
      stirIntensity: session.stirIntensity,
    };
    if (predictionMode) {
      const observed = detectPredictedChanges(startState, finished);
      const review = comparePrediction(predictions, observed);
      setPredictionReview({
        ...review,
        title: finished.events.at(-1)?.title ?? "实时烹饪结束",
        explanation:
          finished.events.at(-1)?.description ?? "加热已经停止。",
      });
      setPredictions([]);
    }
    updateBranch((branch) => ({
      ...branch,
      state: finished,
      history: [...branch.history, startState],
      actions: [...branch.actions, action],
      workspace: {
        ...(branch.workspace ?? workspace),
        station: "pan",
        sampleStation: "pan",
        inPan: true,
        session: undefined,
        heatStartState: undefined,
      },
    }));
    playKitchenSound("sizzle-stop");
    triggerEffect("steam");
    setFeedback(buildFeedback(finished, action));
  }

  function executeSeasoning() {
    const amount: AmountInput = {
      level: amountLevel,
      precise: preciseAmount,
      value: preciseAmount ? amountValue : undefined,
      unit: preciseAmount ? selectedSeasoningDefinition.unit : undefined,
    };
    runAction({
      type: "season",
      seasoningId: selectedSeasoning,
      amount,
    });
  }

  function togglePrediction(id: PredictionKind) {
    setPredictions((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 2) {
        setNotice("最多先预测两个变化，保持判断聚焦");
        return current;
      }
      return [...current, id];
    });
  }

  function saveCurrentExperiment() {
    if (workspace.session) {
      setNotice("实时烹饪还在进行，请先暂停或关火并记录");
      return;
    }
    const fallbackName = `${ingredient.name} ${active.label} ${saved.length + 1}`;
    const snapshot = createSnapshot(
      ingredient.id,
      snapshotName || fallbackName,
      active.actions,
      active.state,
      active.branchGroupId,
      active.label,
    );
    setSaved(addExperiment(snapshot));
    setSnapshotName("");
    setNotice(`${active.label}已保存到当前浏览器`);
  }

  function toggleComparison(id: string) {
    const exists = comparison.includes(id);
    if (!exists && comparison.length >= MAX_COMPARISON) {
      setNotice("最多同时对比 3 个实验，请先移除一个");
      return;
    }
    setComparison(
      storeComparisonIds(
        exists ? comparison.filter((item) => item !== id) : [...comparison, id],
      ),
    );
  }

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try {
      window.localStorage.setItem("cooking-lab:sound:v1", next ? "on" : "off");
    } catch {
      // Local preferences are optional.
    }
    if (!next) playKitchenSound("sizzle-stop");
  }

  function closeOnboarding() {
    setOnboardingStep(null);
    try {
      window.localStorage.setItem("cooking-lab:onboarding:v1", "done");
    } catch {
      // The guide can reappear if storage is unavailable.
    }
  }

  function deleteSaved(id: string) {
    setSaved(removeExperiment(id));
    setComparison(loadComparisonIds());
    setNotice("已删除保存的实验");
  }

  const activeAmountLabel = preciseAmount
    ? amountValue > 0
      ? `${amountValue}${selectedSeasoningDefinition.unit}`
      : "请输入用量"
    : amountLevels.find((item) => item.id === amountLevel)?.label;

  return (
    <div className="site-shell kitchen-shell">
      <div className="kitchen-heading">
        <div>
          <div className="eyebrow">
            <FlaskConical size={15} />
            自由实验 2.0 / PRINCIPLE LAB
          </div>
          <h1>处理食材，不只照做。</h1>
          <p>
            先判断食材状态，再选择处理和时机。复制为 1、2 号试验锅，只改一个变量，看懂变化究竟由什么造成。
          </p>
        </div>
        <div className="kitchen-heading-actions">
          <Link
            className="button button-ghost compact-action"
            href="/community/"
          >
            <MessagesSquare size={17} />
            厨友交流
          </Link>
          <button
            type="button"
            className="button button-ghost compact-action reset-experiment-button"
            onClick={resetExperiment}
          >
            <RotateCcw size={17} />
            重置实验
          </button>
          <button
            type="button"
            className="button button-ghost compact-action"
            onClick={toggleSound}
            aria-label={soundEnabled ? "关闭音效" : "开启音效"}
          >
            {soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
            {soundEnabled ? "音效开" : "已静音"}
          </button>
          <button
            type="button"
            className="button button-ghost compact-action"
            onClick={() => setOnboardingStep(0)}
          >
            <CircleHelp size={17} />
            重看引导
          </button>
          <Link className="button button-ghost" href="/compare/">
            <GitCompareArrows size={18} />
            历史对比
            {comparison.length > 0 && <span className="count-badge">{comparison.length}</span>}
          </Link>
        </div>
      </div>

      {notice && (
        <div className="toast" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}

      <section className="goal-selector-panel">
        <div className="goal-selector-title">
          <span className="mini-label">本次目标</span>
          <strong>{selectedGoal ? goalLabel(selectedGoal) : "先选一个想改变的结果"}</strong>
        </div>
        <div className="goal-chips" role="radiogroup" aria-label="选择烹饪目标">
          {availableGoals.map((goal) => (
            <button
              type="button"
              key={goal.id}
              className={selectedGoal === goal.id ? "is-selected" : ""}
              onClick={() =>
                setSelectedGoal((current) => (current === goal.id ? null : goal.id))
              }
              role="radio"
              aria-checked={selectedGoal === goal.id}
            >
              {goal.name}
            </button>
          ))}
        </div>
        {goalDefinition && (
          <div className="goal-guidance">
            <Info size={15} />
            <p>
              {goalDefinition.description}
              <strong>可调整：</strong>
              {goalDefinition.variables.join("、")}。系统只提示变量，不替你决定步骤。
            </p>
          </div>
        )}
      </section>

      <section className="ingredient-selector-panel">
        <div className="selector-label">
          <span className="mini-label">当前食材</span>
          <strong>{ingredient.name}</strong>
        </div>
        <div className="ingredient-select-strip" role="radiogroup" aria-label="选择食材">
          {ingredients.filter((item) => featuredIngredientIds.has(item.id)).map((item) => (
            <button
              type="button"
              key={item.id}
              className={item.id === ingredient.id ? "ingredient-select-button is-selected" : "ingredient-select-button"}
              onClick={() => changeIngredient(item.id)}
              role="radio"
              aria-checked={item.id === ingredient.id}
            >
              <span className="ingredient-select-thumb">
                <Image src={ingredientPhoto(item.id)} alt="" fill sizes="28px" />
              </span>
              {item.name}
            </button>
          ))}
        </div>
        <label className="all-ingredient-select">
          <span>全部 {ingredients.length} 种食材</span>
          <select
            value={ingredient.id}
            onChange={(event) => changeIngredient(event.target.value)}
            aria-label="从完整食材库选择"
          >
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
      </section>

      <section className="branch-toolbar" aria-label="双试验锅对照">
        <div className="branch-tabs">
          {branches.map((branch) => (
            <button
              type="button"
              key={branch.id}
              className={activeBranchId === branch.id ? "branch-tab is-active" : "branch-tab"}
              onClick={() => switchBranch(branch.id)}
            >
              <span className="branch-badge">{branch.id === "A" ? "1" : "2"}</span>
              {branch.label}
              <small>{branch.actions.length} 步</small>
            </button>
          ))}
        </div>
        <div className="branch-actions">
          {!branchB && (
            <button type="button" className="button branch-copy-button" onClick={duplicateBranch}>
              <Copy size={15} />
              复制为 2 号试验锅
            </button>
          )}
          {branchB && (
            <button type="button" className="button button-text" onClick={removeBranch}>
              <X size={15} /> 关闭 2 号锅
            </button>
          )}
        </div>
        {branchDiff && (
          <div className={branchDiff.isSingleVariable ? "variable-status is-clean" : "variable-status"}>
            <Sparkles size={15} />
            <span>{branchDiff.description}</span>
          </div>
        )}
      </section>

      <WorkflowGuide
        workflow={workflow}
        tasks={tasks}
        prepGuide={ingredient.prepGuide}
        onStepClick={handleWorkflowStep}
        onTaskClick={handleTaskClick}
        onRecommendationClick={handleRecommendationClick}
      />

      <div className="kitchen-workspace">
        <section className="lab-panel prep-lab-panel">
          <div className="lab-panel-header">
            <div>
              <span className="mini-label">LIVE SAMPLE · {active.label}</span>
              <h2>{active.label}</h2>
            </div>
            <span className="lab-status">
              <i /> 状态实时更新
            </span>
          </div>

          <KitchenScene
            ingredient={ingredient}
            state={state}
            workspace={workspace}
            form={foodForm}
            activeStation={currentTask?.station}
            effects={effects}
            isHeating={isHeating}
            onMoveSample={moveSample}
            onDragSample={() => setFeedback({
              id: "drag-started",
              tone: "neutral",
              text: "把食材拖到水槽、砧板或炒锅。",
            })}
          />

          {feedback && (
            <div className={`scene-feedback is-${feedback.tone}`} role="status">
              <Sparkles size={16} />
              <p>{feedback.text}</p>
            </div>
          )}

          <div className="state-metrics expanded">
            {[
              ["熟度", state.properties.cookedness],
              ["水分", state.properties.moisture],
              ["表面水", state.properties.surfaceMoisture],
              ["脆度", state.properties.crispness],
              ["嫩度", state.properties.tenderness],
              ["上色", state.properties.browning],
              ["保形", state.properties.shapeIntegrity],
              ["挂汁", state.properties.sauceCoating],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong><AnimatedNumber value={Number(value)} /></strong>
                <i style={{ width: `${Math.min(Number(value), 100)}%` }} />
              </div>
            ))}
          </div>

          <div className="flavor-panel">
            <div className="flavor-panel-heading">
              <div>
                <span className="mini-label">味觉图谱</span>
                <h3>{currentFlavorSummary}</h3>
              </div>
              <Scale size={19} />
            </div>
            <FlavorBars flavor={state.flavor} />
          </div>

          {state.warnings.length > 0 && (
            <div className="warning-panel">
              <AlertCircle size={18} />
              <div>
                {state.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="lab-panel controls-panel">
          <div className="lab-panel-header">
            <div>
              <span className="mini-label">ACTION DECK · {active.label}</span>
              <h2>操作台</h2>
            </div>
            <SlidersHorizontal size={19} />
          </div>

          <div className="prediction-control">
            <label className="switch-label prediction-switch">
              <input
                type="checkbox"
                checked={predictionMode}
                onChange={(event) => {
                  setPredictionMode(event.target.checked);
                  setPredictionReview(null);
                  setPredictions([]);
                }}
              />
              <span className="switch-track" />
              先预测再揭晓
            </label>
            {predictionMode && (
              <div className="prediction-choices" role="group" aria-label="预测本次变化">
                {predictionChoices.map((choice) => (
                  <button
                    type="button"
                    key={choice.id}
                    className={predictions.includes(choice.id) ? "is-selected" : ""}
                    onClick={() => togglePrediction(choice.id)}
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {predictionReview && (
            <div className="prediction-review">
              <strong>{predictionReview.title}</strong>
              <p>{predictionReview.explanation}</p>
              <span>
                预测到 {predictionReview.matched.length} 项
                {predictionReview.missed.length > 0 &&
                  ` · 未发生 ${predictionReview.missed.length} 项`}
                {predictionReview.unexpected.length > 0 &&
                  ` · 另外变化 ${predictionReview.unexpected.length} 项`}
              </span>
              <button type="button" onClick={() => setPredictionReview(null)}>
                <X size={13} /> 收起
              </button>
            </div>
          )}

          <div className="workspace-tabs" role="tablist" aria-label="操作类型">
            <button
              type="button"
              className={activeTab === "treat" ? "is-active" : ""}
              onClick={() => setActiveTab("treat")}
              role="tab"
              aria-selected={activeTab === "treat"}
            >
              <Sparkles size={17} />
              处理
            </button>
            <button
              type="button"
              className={activeTab === "heat" ? "is-active" : ""}
              onClick={() => setActiveTab("heat")}
              role="tab"
              aria-selected={activeTab === "heat"}
            >
              <Flame size={17} />
              火候
            </button>
            <button
              type="button"
              className={activeTab === "season" ? "is-active" : ""}
              onClick={() => setActiveTab("season")}
              role="tab"
              aria-selected={activeTab === "season"}
            >
              <Beaker size={17} />
              调味
            </button>
          </div>

          <div className="tab-content treatment-tab-content">
            {activeTab === "treat" && (
              <div className="treatment-panel">
                <p className="panel-hint">
                  当前只显示适用于{ingredient.name}的处理。按钮上的标签说明它主要改变什么，不直接替你选择答案。
                </p>
                {treatmentGroups.map((group) => {
                  const items = groups[group.id];
                  if (!items.length) return null;
                  return (
                    <section className="treatment-group" key={group.id}>
                      <div className="treatment-group-heading">
                        <div>
                          <strong>{group.label}</strong>
                          <small>{group.description}</small>
                        </div>
                        <span>{items.length}</span>
                      </div>
                      <div className="treatment-grid">
                        {items.map((item) => (
                          <button
                            type="button"
                            key={item.id}
                            data-operation-id={item.id}
                            className={[
                              goalDefinition?.principleTags.some((tag) =>
                                item.principleTags.includes(tag),
                              )
                                ? "is-goal-relevant"
                                : "",
                              currentTask?.operationId === item.id
                                ? "is-task-focus"
                                : "",
                            ].filter(Boolean).join(" ")}
                            onClick={() =>
                              runAction({ type: "operation", operationId: item.id })
                            }
                          >
                            <span className="treatment-plus">
                              {actions.some(
                                (action) =>
                                  action.type === "operation" &&
                                  action.operationId === item.id,
                              ) ? (
                                <Check size={14} />
                              ) : (
                                <Plus size={14} />
                              )}
                            </span>
                            <span>
                              <strong>{item.name}</strong>
                              <small>{item.purpose}</small>
                            </span>
                            <span className="treatment-tags">
                              {item.principleTags.slice(0, 2).map((tag) => (
                                <i key={tag}>{principleTagLabels[tag]}</i>
                              ))}
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}

            {activeTab === "heat" && (
              <div className="heat-action-panel">
                <div className="control-group">
                  <span className="control-label">加热方式</span>
                  <div className="method-selector expanded">
                    {heatMethods.map((method) => (
                      <button
                        type="button"
                        key={method.id}
                        className={heatMethod === method.id ? "is-selected" : ""}
                        onClick={() => setHeatMethod(method.id)}
                      >
                        <strong>{method.name}</strong>
                        <small>{method.description}</small>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="control-group inline-control-group">
                  <span className="control-label">火力</span>
                  <div className="segmented-control">
                    {heatLevels.map((level) => (
                      <button
                        type="button"
                        className={heatLevel === level.id ? "is-selected" : ""}
                        key={level.id}
                        onClick={() => setHeatLevel(level.id)}
                      >
                        {level.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="range-control">
                  <span>
                    <span className="control-label">
                      <ThermometerSun size={15} /> 目标温度
                    </span>
                    <strong>{targetTemperature}°C</strong>
                  </span>
                  <input
                    type="range"
                    min={50}
                    max={280}
                    step={5}
                    value={targetTemperature}
                    onChange={(event) => setTargetTemperature(Number(event.target.value))}
                    aria-label="目标温度"
                  />
                  <small>水煮、焯水和蒸制会按水或蒸汽环境处理。</small>
                </label>

                <label className="range-control">
                  <span>
                    <span className="control-label">
                      <Timer size={15} /> 持续时间
                    </span>
                    <strong>{durationMin} 分钟</strong>
                  </span>
                  <input
                    type="range"
                    min={0.25}
                    max={30}
                    step={0.25}
                    value={durationMin}
                    onChange={(event) => setDurationMin(Number(event.target.value))}
                    aria-label="持续时间"
                  />
                </label>

                <div className="heat-variable-row">
                  <label className="lid-control">
                    <input
                      type="checkbox"
                      checked={lidCovered}
                      onChange={(event) => setLidCovered(event.target.checked)}
                    />
                    <span className="switch-track" />
                    盖盖
                  </label>
                  <div>
                    <span className="control-label">翻动强度</span>
                    <div className="segmented-control compact">
                      {stirOptions.map((option) => (
                        <button
                          type="button"
                          key={option.id}
                          className={stirIntensity === option.id ? "is-selected" : ""}
                          onClick={() => setStirIntensity(option.id)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {workspace.session && (
                  <div className="live-heat-readout" aria-live="polite">
                    <div>
                      <span>当前温度</span>
                      <strong><AnimatedNumber value={workspace.session.currentTemperature} />°C</strong>
                    </div>
                    <div>
                      <span>模拟受热</span>
                      <strong><AnimatedNumber value={workspace.session.elapsedSimSeconds / 60} decimals={1} /> 分钟</strong>
                    </div>
                    <div>
                      <span>状态</span>
                      <strong>{workspace.session.isHeating ? "加热中" : "已暂停"}</strong>
                    </div>
                  </div>
                )}
                <div className="live-heat-actions">
                  {!workspace.session?.isHeating ? (
                    <button type="button" className="button button-primary execute-button" onClick={startLiveHeat}>
                      <Play size={18} />
                      {workspace.session ? "继续加热" : "点火开始"}
                    </button>
                  ) : (
                    <button type="button" className="button button-ghost execute-button" onClick={pauseLiveHeat}>
                      <Pause size={18} />
                      暂停加热
                    </button>
                  )}
                  {workspace.session && (
                    <button type="button" className="button live-stop-button" onClick={stopLiveHeat}>
                      <Flame size={17} />
                      关火并记录
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeTab === "season" && (
              <div className="season-action-panel">
                <div className="seasoning-family-list">
                  <div className="seasoning-library-count">
                    <span>常用调料库</span>
                    <strong>{visibleSeasonings.length}</strong>
                    <small>包含模拟用水</small>
                  </div>
                  {seasoningFamilies.map((family) => (
                    <div className="seasoning-family" key={family}>
                      <span>{family}</span>
                      <div className="seasoning-grid" role="radiogroup" aria-label={family}>
                        {visibleSeasonings
                          .filter((seasoning) => seasoning.family === family)
                          .map((seasoning) => (
                            <button
                              type="button"
                              key={seasoning.id}
                              className={
                                seasoning.id === selectedSeasoning
                                  ? "is-selected"
                                  : ""
                              }
                              onClick={() => {
                                setSelectedSeasoning(seasoning.id);
                                setAmountValue(0);
                              }}
                              role="radio"
                              aria-checked={seasoning.id === selectedSeasoning}
                            >
                              <span>{seasoning.shortName}</span>
                              <small>{seasoning.name}</small>
                            </button>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="amount-panel">
                  <div className="amount-heading">
                    <div>
                      <span className="control-label">用量</span>
                      <strong>{activeAmountLabel}</strong>
                    </div>
                    <label className="switch-label">
                      <input
                        type="checkbox"
                        checked={preciseAmount}
                        onChange={(event) => setPreciseAmount(event.target.checked)}
                      />
                      <span className="switch-track" />
                      使用精确值
                    </label>
                  </div>

                  {preciseAmount ? (
                    <label className="precise-input">
                      <input
                        type="number"
                        min={0.1}
                        max={500}
                        step={0.5}
                        value={amountValue || ""}
                        onChange={(event) => setAmountValue(Number(event.target.value))}
                        placeholder="输入数值"
                        aria-label="精确用量"
                      />
                      <span>{selectedSeasoningDefinition.unit}</span>
                    </label>
                  ) : (
                    <div className="amount-segmented">
                      {amountLevels.map((level) => (
                        <button
                          type="button"
                          key={level.id}
                          className={amountLevel === level.id ? "is-selected" : ""}
                          onClick={() => setAmountLevel(level.id)}
                        >
                          <strong>{level.label}</strong>
                          <small>{level.hint}</small>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="seasoning-note">
                  <Info size={16} />
                  <p>
                    {selectedSeasoningDefinition.description}
                  </p>
                </div>

                <button
                  type="button"
                  className="button button-primary execute-button"
                  onClick={executeSeasoning}
                  disabled={preciseAmount && (!amountValue || amountValue <= 0)}
                >
                  <Plus size={18} />
                  加入{selectedSeasoningDefinition.name}
                  {activeAmountLabel ? ` · ${activeAmountLabel}` : ""}
                </button>
              </div>
            )}
          </div>

          <div className="action-footer">
            <button type="button" className="button button-ghost" onClick={undo} disabled={stateHistory.length === 0}>
              <Undo2 size={17} /> 撤销 {active.label}
            </button>
            <button type="button" className="button button-text" onClick={resetActiveBranch} disabled={actions.length === 0}>
              <RotateCcw size={16} /> 重置 {active.label}
            </button>
          </div>
        </section>
      </div>

      {branchB && (
        <section className="lab-panel branch-comparison-panel">
          <div className="lab-panel-header">
            <div>
              <span className="mini-label">TWO-PAN COMPARISON</span>
              <h2>两口试验锅，一眼看差异</h2>
            </div>
            <span className={branchDiff?.isSingleVariable ? "variable-chip is-clean" : "variable-chip"}>
              {branchDiff?.isSingleVariable ? "单变量对照" : "多变量对照"}
            </span>
          </div>
          <div className="branch-comparison-grid">
            <BranchSummary branch={branches[0]} />
            <BranchSummary branch={branchB} reference={branches[0]} />
          </div>
          <div className="branch-comparison-note">
            <CircleHelp size={16} />
            <p>{branchDiff?.description} 先用相同操作建立基准，再只改变切法、盐时机、温度、时间或一个调味变量，差异才更容易解释。</p>
          </div>
        </section>
      )}

      <div className="kitchen-lower-grid">
        <section className="lab-panel timeline-panel">
          <div className="lab-panel-header">
            <div>
              <span className="mini-label">CAUSAL LOG · {active.label}</span>
              <h2>因果时间线</h2>
            </div>
            <span className="timeline-count">{actions.length} 步</span>
          </div>
          <div className="timeline-list">
            {[...state.events].reverse().map((event, index) => {
              const meta = categoryMeta[event.category];
              return (
                <details className="timeline-event causal" key={event.id} open={index === 0}>
                  <summary>
                    <span className={`event-dot ${meta.className}`} />
                    <div>
                      <span className="timeline-action">{event.action}</span>
                      <strong>{event.title}</strong>
                    </div>
                    <span className={`science-pill ${meta.className}`}>{meta.short}</span>
                    <ChevronDown size={17} />
                  </summary>
                  <div className="timeline-event-body">
                    <p>{event.description}</p>
                    {event.before.moisture && (
                      <div className="causal-digest">
                        <div>
                          <span>操作前</span>
                          <p>{event.before.moisture}</p>
                          <p>{event.before.texture}</p>
                        </div>
                        <ArrowRight size={15} />
                        <div>
                          <span>操作后</span>
                          <p>{event.after.moisture}</p>
                          <p>{event.after.texture}</p>
                        </div>
                      </div>
                    )}
                    <div className="principle-tag-row">
                      {event.principleTags.map((tag) => (
                        <span key={tag}>{principleTagLabels[tag]}</span>
                      ))}
                      {event.effects.map((effect) => (
                        <i key={effect}>{effect}</i>
                      ))}
                    </div>
                    {event.transfer && (
                      <div className="transfer-note">
                        <Sparkles size={14} />
                        <p><strong>换食材也成立：</strong>{event.transfer}</p>
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        </section>

        <section className="lab-panel save-panel">
          <div className="lab-panel-header">
            <div>
              <span className="mini-label">SAVE & COMPARE</span>
              <h2>保存 {active.label}</h2>
            </div>
            <Save size={19} />
          </div>
          <p className="panel-hint">
            1、2 号试验锅各自保存当前状态与完整操作。历史对比最多选择 3 个结果。
          </p>
          <label className="snapshot-name-field">
            <span>实验名称</span>
            <input
              type="text"
              value={snapshotName}
              onChange={(event) => setSnapshotName(event.target.value)}
              placeholder={`${ingredient.name} ${active.label} ${saved.length + 1}`}
              maxLength={40}
            />
          </label>
          <button
            type="button"
            className="button button-primary save-button"
            onClick={saveCurrentExperiment}
            disabled={actions.length === 0}
          >
            <Save size={17} /> 保存 {active.label}
          </button>
          {actions.length === 0 && <small className="save-help">至少完成一个操作后才能保存。</small>}

          <div className="saved-mini-list">
            <div className="saved-mini-heading">
              <span>最近实验</span>
              <Link href="/compare/">
                查看全部 <ArrowRight size={14} />
              </Link>
            </div>
            {saved.length === 0 ? (
              <div className="empty-mini">还没有保存的实验</div>
            ) : (
              saved.slice(0, 5).map((experiment) => (
                <div className="saved-mini-item" key={experiment.id}>
                  <button
                    type="button"
                    className={comparison.includes(experiment.id) ? "compare-check is-checked" : "compare-check"}
                    onClick={() => toggleComparison(experiment.id)}
                    aria-label={`${comparison.includes(experiment.id) ? "移出" : "加入"}对比：${experiment.name}`}
                  >
                    {comparison.includes(experiment.id) && <Check size={13} />}
                  </button>
                  <div>
                    <strong>{experiment.name}</strong>
                    <small>
                      {getIngredient(experiment.ingredientId).name} · {experiment.branchLabel ?? "单线"} · {experiment.actions.length} 步
                    </small>
                  </div>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => deleteSaved(experiment.id)}
                    aria-label={`删除实验：${experiment.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="kitchen-disclaimer">
        <Info size={19} />
        <p>
          状态数值用于比较趋势，不代表真实实验测量。长期发酵、熟成和长期腌制没有纳入模拟，请遵循实际食品安全操作。
        </p>
      </section>
      {onboardingStep !== null && (
        <OnboardingCoach
          step={onboardingStep}
          onNext={() => setOnboardingStep((step) => Math.min(2, (step ?? 0) + 1))}
          onClose={closeOnboarding}
        />
      )}
    </div>
  );
}
