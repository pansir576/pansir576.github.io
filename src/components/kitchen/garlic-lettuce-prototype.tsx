"use client";
/* eslint-disable @next/next/no-img-element -- transparent story assets are positioned directly in the kitchen scene */
/* eslint-disable react-hooks/set-state-in-effect -- browser-only voice preference is hydrated after mount */

import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Droplets,
  Flame,
  MoveHorizontal,
  RotateCcw,
  Sparkles,
  Star,
  Timer,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  evaluateGarlicLettuce,
  GARLIC_HEAT_PROFILES,
  garlicCookingBand,
  greensCookingBand,
  type GarlicGreensBand,
  type GarlicHeatLevel,
  type GarlicLettuceOutcome,
  type SaltLevel,
} from "@/lib/garlic-lettuce-game";
import {
  XIAMI_GARLIC_LETTUCE_DIALOGUE,
  type GarlicLettuceVoiceLineId,
} from "@/lib/garlic-lettuce-dialogue";
import {
  GARLIC_VOICE_LINES,
  getGarlicLettuceVoiceLine,
  getLowScoreDejectedVoiceLine,
  playXiamiVoice,
  preloadXiamiVoice,
  stopXiamiVoice,
} from "@/lib/xiami-voice";
import {
  loadRecipeVoiceEnabled,
  saveRecipeVoiceEnabled,
} from "@/lib/recipe-speech";
import shared from "./tomato-egg-prototype.module.css";
import styles from "./garlic-lettuce-prototype.module.css";

type Phase = "prep" | "heat" | "garlic" | "greens" | "serve" | "result";
type Placement = "tray" | "board" | "bowl" | "wok" | "plate";
type DragId = "greens" | "garlic" | "dish";

interface DragState {
  id: DragId;
  x: number;
  y: number;
}

const PHASES = ["洗切备料", "热锅热油", "蒜末爆香", "大火断生", "装盘复盘"];
const ASSETS = {
  greens:
    "/2d/story-kitchen/ingredients/ingredient_youmaicai_normal.png",
  garlic: "/2d/story-kitchen/play/garlic-clove.svg",
  knife: "/2d/story-kitchen/tools/tool_knife_normal.png",
};

const GARLIC_BITS: ReadonlyArray<
  readonly [left: number, top: number, rotate: number, size: number]
> = [
  [18, 30, -18, 7],
  [31, 18, 24, 5],
  [45, 29, -9, 8],
  [60, 17, 38, 6],
  [76, 29, -25, 7],
  [86, 43, 18, 5],
  [12, 48, 31, 6],
  [26, 44, -37, 8],
  [41, 48, 16, 6],
  [55, 42, -14, 7],
  [69, 49, 29, 5],
  [81, 59, -31, 7],
  [9, 65, 12, 5],
  [23, 63, -19, 7],
  [36, 70, 41, 5],
  [51, 65, -28, 8],
  [64, 72, 10, 6],
  [77, 78, -36, 5],
  [43, 84, 22, 6],
  [60, 88, -12, 4.5],
];

function IngredientCard({
  id,
  label,
  children,
  compact = false,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onKeyboardPlace,
}: {
  id: DragId;
  label: string;
  children: ReactNode;
  compact?: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: () => void;
  onKeyboardPlace: () => void;
}) {
  return (
    <button
      type="button"
      className={`${shared.ingredientCard} ${
        compact ? shared.ingredientCardCompact : ""
      }`}
      data-ingredient-drag={id}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onKeyboardPlace();
        }
      }}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

function AmountSelector({
  label,
  value,
  dataKey,
  options,
  onChange,
}: {
  label: string;
  value: SaltLevel | null;
  dataKey: string;
  options: { value: SaltLevel; label: string }[];
  onChange: (value: SaltLevel) => void;
}) {
  return (
    <div className={shared.amountControl}>
      <span>{label}</span>
      <div>
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            className={value === option.value ? shared.amountSelected : ""}
            data-amount-control={dataKey}
            data-amount-value={option.value}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function DishVisual({ result = false }: { result?: boolean }) {
  return (
    <span className={`${styles.dishVisual} ${result ? styles.dishVisualResult : ""}`}>
      {[0, 1, 2, 3].map((index) => (
        <img
          key={index}
          src={ASSETS.greens}
          alt=""
          draggable={false}
          style={{ "--leaf": index } as CSSProperties}
        />
      ))}
      <i className={styles.garlicBits} aria-hidden="true" />
    </span>
  );
}

export function GarlicLettucePrototype() {
  const [phase, setPhase] = useState<Phase>("prep");
  const [greensPlacement, setGreensPlacement] =
    useState<Placement>("tray");
  const [garlicPlacement, setGarlicPlacement] =
    useState<Placement>("tray");
  const [cutDone, setCutDone] = useState(false);
  const [garlicReady, setGarlicReady] = useState(false);
  const [heat, setHeat] = useState<GarlicHeatLevel | null>(null);
  const [oilAdded, setOilAdded] = useState(false);
  const [garlicCookMs, setGarlicCookMs] = useState(0);
  const [greensCookMs, setGreensCookMs] = useState(0);
  const [stirCount, setStirCount] = useState(0);
  const [salt, setSalt] = useState<SaltLevel | null>(null);
  const [outcome, setOutcome] = useState<GarlicLettuceOutcome | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceNeedsGesture, setVoiceNeedsGesture] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [notice, setNotice] = useState(
    "先把油麦菜拖到清洗砧板，大蒜拖到备料碗。",
  );
  const [knifeX, setKnifeX] = useState(50);
  const [stirAngle, setStirAngle] = useState(0);

  const gestureStartX = useRef<number | null>(null);
  const stirStartX = useRef<number | null>(null);
  const stirDistance = useRef(0);
  const voiceFallbackNotifiedRef = useRef(false);
  const lastRequestedVoiceLineRef = useRef<string | null>(null);

  const activeHeat = heat ?? "high";
  const isDejected =
    outcome !== null &&
    (outcome.score < 70 ||
      outcome.kind === "raw-greens" ||
      outcome.kind === "over-greens");
  const garlicBand = garlicCookingBand(activeHeat, garlicCookMs);
  const currentGreensBand = greensCookingBand(activeHeat, greensCookMs);
  const activeBand: GarlicGreensBand | null =
    phase === "garlic"
      ? garlicBand
      : phase === "greens" || phase === "serve"
        ? currentGreensBand
        : null;
  const canStartDish =
    phase === "greens" &&
    greensCookMs >= 800 &&
    stirCount >= 1 &&
    salt !== null;

  const mission = useMemo(() => {
    if (phase === "prep") {
      if (greensPlacement !== "board") return "步骤 1：把油麦菜拖到清洗砧板。";
      if (garlicPlacement !== "bowl") return "把大蒜拖到备料碗。";
      if (!cutDone) return "在砧板上横向滑动一次，完成清洗和切段。";
      if (!garlicReady) return "点击“拍碎切末”，准备蒜末。";
      return "备料完成。下一步选择火力并倒油。";
    }
    if (phase === "heat") {
      if (!heat) return "步骤 2：先选择中火或大火。";
      if (!oilAdded) return "沿锅边倒入食用油。";
      return "把蒜末拖进热锅，开始观察蒜香窗口。";
    }
    if (phase === "garlic") {
      if (garlicBand === "raw") return "蒜末还在加热，等到香气刚起来。";
      if (garlicBand === "ready") return "蒜香已起，马上把油麦菜拖进锅。";
      if (garlicBand === "over") return "蒜末开始变深，立刻下菜。";
      return "蒜末已焦，记录这次火候。";
    }
    if (phase === "greens") {
      if (salt === null) return "步骤 3：选择盐量。";
      if (currentGreensBand === "raw") return "保持大火，叶片刚软时准备出锅。";
      if (currentGreensBand === "ready") return "已经断生，翻匀后立即装盘。";
      if (currentGreensBand === "over") return "正在失水发软，尽快出锅。";
      return "已经过火，记录这次结果。";
    }
    if (phase === "serve") return "步骤 4：把蒜蓉油麦菜拖到盘中。";
    return "装盘完成。复盘蒜香、断生和调味。";
  }, [
    cutDone,
    currentGreensBand,
    garlicBand,
    garlicPlacement,
    garlicReady,
    greensPlacement,
    heat,
    oilAdded,
    phase,
    salt,
  ]);

  const progressIndex =
    phase === "prep"
      ? cutDone && garlicReady
        ? 1
        : 0
      : phase === "heat"
        ? 1
        : phase === "garlic"
          ? 2
          : phase === "greens"
            ? 3
            : 4;

  const voiceLineId: GarlicLettuceVoiceLineId =
    outcome?.voiceLineId ??
    (phase === "prep"
      ? "garlic-phase-prep"
      : phase === "heat"
        ? "garlic-phase-heat"
        : phase === "garlic"
          ? "garlic-phase-garlic"
          : phase === "greens"
            ? "garlic-phase-greens"
            : "garlic-phase-serve");
  const activeVoiceLineId = isDejected ? "low-score-dejected" : voiceLineId;
  const characterDialogue = isDejected
    ? "赏……个脸呗……把菜做好。"
    : XIAMI_GARLIC_LETTUCE_DIALOGUE[voiceLineId];
  const voiceLine = isDejected
    ? getLowScoreDejectedVoiceLine()
    : getGarlicLettuceVoiceLine(voiceLineId);

  const playCurrentVoice = useCallback(async () => {
    const result = await playXiamiVoice(voiceLine, {
      onFallback: () => {
        if (voiceFallbackNotifiedRef.current) return;
        voiceFallbackNotifiedRef.current = true;
        setNotice("夏弥配音加载失败，已切换系统语音。");
      },
    });
    if (result === "blocked") setVoiceNeedsGesture(true);
    else if (result !== "cancelled") setVoiceNeedsGesture(false);
  }, [voiceLine]);

  useEffect(() => {
    setVoiceEnabled(loadRecipeVoiceEnabled());
  }, []);

  useEffect(() => {
    if (voiceEnabled) preloadXiamiVoice(GARLIC_VOICE_LINES);
  }, [voiceEnabled]);

  useEffect(() => {
    if (!voiceEnabled) {
      lastRequestedVoiceLineRef.current = null;
      stopXiamiVoice();
      setVoiceNeedsGesture(false);
      return;
    }
    if (lastRequestedVoiceLineRef.current === activeVoiceLineId) return;
    lastRequestedVoiceLineRef.current = activeVoiceLineId;
    void playCurrentVoice();
  }, [activeVoiceLineId, playCurrentVoice, voiceEnabled]);

  useEffect(() => stopXiamiVoice, []);

  useEffect(() => {
    if (phase !== "garlic") return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const current = performance.now();
      setGarlicCookMs((value) => Math.min(12_000, value + current - previous));
      previous = current;
    }, 100);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "greens") return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const current = performance.now();
      setGreensCookMs((value) => Math.min(12_000, value + current - previous));
      previous = current;
    }, 100);
    return () => window.clearInterval(timer);
  }, [phase]);

  function keyboardPlace(id: DragId) {
    if (id === "greens" && phase === "prep" && greensPlacement === "tray") {
      setGreensPlacement("board");
      setNotice("油麦菜已放上清洗砧板。");
    }
    if (id === "garlic" && phase === "prep" && garlicPlacement === "tray") {
      setGarlicPlacement("bowl");
      setNotice("大蒜已放进备料碗。");
    }
    if (
      id === "garlic" &&
      phase === "heat" &&
      garlicPlacement === "bowl" &&
      heat &&
      oilAdded
    ) {
      setGarlicPlacement("wok");
      setPhase("garlic");
      setNotice("蒜末下锅，开始计时。");
    }
    if (
      id === "greens" &&
      phase === "garlic" &&
      greensPlacement === "board"
    ) {
      setGreensPlacement("wok");
      setPhase("greens");
      setNotice("油麦菜下锅，大火翻匀。");
    }
    if (id === "dish" && phase === "serve") finishDish();
  }

  function beginDrag(event: ReactPointerEvent<HTMLButtonElement>, id: DragId) {
    if (
      (id === "greens" && !["prep", "garlic"].includes(phase)) ||
      (id === "garlic" && !["prep", "heat"].includes(phase)) ||
      (id === "dish" && phase !== "serve")
    ) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ id, x: event.clientX, y: event.clientY });
  }

  function moveDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!drag) return;
    setDrag({ ...drag, x: event.clientX, y: event.clientY });
  }

  function endDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    id: DragId,
  ) {
    const zone = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-drop-zone]");
    const target = zone?.dataset.dropZone;
    setDrag(null);

    if (id === "greens" && target === "board" && phase === "prep") {
      setGreensPlacement("board");
      setNotice("油麦菜已放上清洗砧板，横向滑动一次完成清洗切段。");
    } else if (id === "garlic" && target === "bowl" && phase === "prep") {
      setGarlicPlacement("bowl");
      setNotice("大蒜已放进备料碗，点击“拍碎切末”。");
    } else if (
      id === "garlic" &&
      target === "wok" &&
      phase === "heat" &&
      garlicPlacement === "bowl"
    ) {
      if (!heat) {
        setNotice("先选火力。");
      } else if (!oilAdded) {
        setNotice("先倒油，再下蒜末。");
      } else {
        setGarlicPlacement("wok");
        setPhase("garlic");
        setNotice("蒜末下锅，开始计时。");
      }
    } else if (
      id === "greens" &&
      target === "wok" &&
      phase === "garlic"
    ) {
      setGreensPlacement("wok");
      setPhase("greens");
      setNotice("油麦菜下锅，大火翻匀。");
    } else if (id === "dish" && target === "plate" && phase === "serve") {
      finishDish();
    }
  }

  function completeCut(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (gestureStartX.current === null) {
      gestureStartX.current = event.clientX;
      return;
    }
    const distance = Math.abs(event.clientX - gestureStartX.current);
    gestureStartX.current = null;
    if (distance < 48 || cutDone) return;
    setCutDone(true);
    setKnifeX(78);
    setNotice("油麦菜已经洗净切段。");
    if (garlicReady) setPhase("heat");
  }

  function minceGarlic() {
    if (garlicPlacement !== "bowl") {
      setNotice("先把大蒜拖进备料碗。");
      return;
    }
    setGarlicReady(true);
    setNotice("蒜末已经拍碎切好。");
    if (cutDone) setPhase("heat");
  }

  function startStir(event: ReactPointerEvent<HTMLDivElement>) {
    if (phase !== "greens") return;
    stirStartX.current = event.clientX;
    stirDistance.current = 0;
  }

  function moveStir(event: ReactPointerEvent<HTMLDivElement>) {
    if (stirStartX.current === null) return;
    stirDistance.current += Math.abs(event.clientX - stirStartX.current);
    stirStartX.current = event.clientX;
    setStirAngle((value) => (value + (event.movementX || 0) * 0.8) % 360);
  }

  function endStir() {
    if (stirStartX.current === null) return;
    stirStartX.current = null;
    if (stirDistance.current > 55) {
      setStirCount((value) => value + 1);
      setNotice("翻匀一次。");
    }
  }

  function startServe() {
    if (!canStartDish) return;
    setPhase("serve");
    setNotice("已断生。把菜拖到盘中完成装盘。");
  }

  function finishDish() {
    if (phase !== "serve" || salt === null) return;
    setOutcome(
      evaluateGarlicLettuce({
        heat: activeHeat,
        garlicCookMs,
        greensCookMs,
        stirCount,
        salt,
      }),
    );
    setGreensPlacement("plate");
    setPhase("result");
    setNotice("装盘完成。");
  }

  function reset() {
    setPhase("prep");
    setGreensPlacement("tray");
    setGarlicPlacement("tray");
    setCutDone(false);
    setGarlicReady(false);
    setHeat(null);
    setOilAdded(false);
    setGarlicCookMs(0);
    setGreensCookMs(0);
    setStirCount(0);
    setSalt(null);
    setOutcome(null);
    setDrag(null);
    setKnifeX(50);
    setStirAngle(0);
    setNotice("先把油麦菜拖到清洗砧板，大蒜拖到备料碗。");
  }

  function toggleVoice() {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    saveRecipeVoiceEnabled(next);
    if (next) {
      lastRequestedVoiceLineRef.current = activeVoiceLineId;
      void playCurrentVoice();
    } else {
      lastRequestedVoiceLineRef.current = null;
      stopXiamiVoice();
      setVoiceNeedsGesture(false);
    }
  }

  function replayVoice() {
    lastRequestedVoiceLineRef.current = activeVoiceLineId;
    void playCurrentVoice();
  }

  const garlicDisplay = {
    raw: "香气未起",
    ready: "蒜香正好",
    over: "颜色变深",
    burnt: "已经焦苦",
  }[garlicBand];
  const greensDisplay = {
    raw: "尚未断生",
    ready: "刚好断生",
    over: "开始发软",
    burnt: "过火发黄",
  }[currentGreensBand];

  return (
    <div className={shared.page}>
      <header className={shared.hero}>
        <div>
          <Link href="/cook/story/" className={shared.backLink}>
            <ArrowLeft size={16} />
            返回烹语剧场
          </Link>
          <span className={shared.eyebrow}>PLAYABLE PROTOTYPE · REV 01</span>
          <h1>蒜蓉油麦菜：蒜香和断生只差几秒</h1>
          <p>
            快洗快切，热锅爆香蒜末，大火把油麦菜翻到刚断生。重点不是把步骤点完，而是接住蒜末和菜叶两个不同的火候窗口。
          </p>
        </div>
        <div className={shared.prototypeBadge}>
          <Sparkles size={18} />
          <span>
            第二道可玩菜谱
            <small>夏弥语言与四步流程同步</small>
          </span>
        </div>
      </header>

      <div className={shared.phaseRail} aria-label="当前烹饪阶段">
        {PHASES.map((label, index) => (
          <span
            key={label}
            className={
              index < progressIndex
                ? shared.phaseDone
                : index === progressIndex
                  ? shared.phaseCurrent
                  : ""
            }
          >
            <i>{index < progressIndex ? <Check size={12} /> : index + 1}</i>
            {label}
          </span>
        ))}
      </div>

      <div className={shared.gameLayout}>
        <section className={shared.stageColumn}>
          <div className={shared.stageFrame}>
            <div className={shared.stageTopline}>
              <span className={shared.mission}>
                <Timer size={16} />
                {mission}
              </span>
              <span
                className={shared.cookStatus}
                data-cook-state={activeBand ?? "idle"}
              >
                {phase === "garlic"
                  ? garlicDisplay
                  : phase === "greens" || phase === "serve"
                    ? greensDisplay
                    : phase === "result"
                      ? "已装盘"
                      : "准备中"}
              </span>
            </div>

            <div
              className={shared.kitchenCanvas}
              data-garlic-lettuce-stage
              data-phase={phase}
            >
              <div
                className={shared.kitchenBackground}
                data-kitchen-background
                aria-hidden="true"
              />
              <div className={shared.sceneVignette} aria-hidden="true" />

              {phase !== "result" && (
                <>
                  <div
                    className={`${shared.dropZone} ${shared.boardZone} ${
                      greensPlacement === "board" ? shared.zoneOccupied : ""
                    } ${
                      phase === "prep"
                        ? shared.zoneFocused
                        : shared.zoneBackgrounded
                    }`}
                    data-drop-zone="board"
                    data-active={phase === "prep" && greensPlacement === "tray"}
                  >
                    <span className={shared.zoneLabel}>清洗砧板</span>
                    <span className={shared.cuttingBoardVisual} aria-hidden="true" />
                    {greensPlacement === "board" && (
                      <div
                        className={styles.greensPrep}
                        data-wash-cut-surface
                        role="application"
                        aria-label="横向滑动一次清洗并切段"
                        onPointerDown={(event) => {
                          gestureStartX.current = event.clientX;
                        }}
                        onPointerUp={completeCut}
                      >
                        <img src={ASSETS.greens} alt="油麦菜" draggable={false} />
                        {!cutDone && (
                          <>
                            <img
                              className={shared.knife}
                              src={ASSETS.knife}
                              alt=""
                              draggable={false}
                              style={{ left: `${knifeX}%` }}
                            />
                            <span className={styles.prepHint}>
                              <MoveHorizontal size={14} />
                              横向滑动清洗切段
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div
                    className={`${shared.dropZone} ${shared.bowlZone} ${
                      garlicPlacement === "bowl" ? shared.zoneOccupied : ""
                    } ${
                      phase === "prep"
                        ? shared.zoneFocused
                        : shared.zoneBackgrounded
                    }`}
                    data-drop-zone="bowl"
                    data-active={phase === "prep" && garlicPlacement === "tray"}
                  >
                    <span className={shared.zoneLabel}>备料碗</span>
                    <img
                      className={shared.bowlVessel}
                      src="/2d/story-kitchen/play/bowl-vessel.svg"
                      alt=""
                      draggable={false}
                    />
                    {garlicPlacement === "bowl" && (
                      <img
                        className={styles.garlicInBowl}
                        src={ASSETS.garlic}
                        alt="大蒜"
                        draggable={false}
                      />
                    )}
                  </div>

                  <div
                    className={`${shared.dropZone} ${shared.wokZone} ${
                      garlicPlacement === "wok" || greensPlacement === "wok"
                        ? shared.zoneOccupied
                        : ""
                    } ${
                      ["garlic", "greens", "serve"].includes(phase)
                        ? shared.zoneFocused
                        : shared.zoneBackgrounded
                    }`}
                    data-drop-zone="wok"
                    data-active={["garlic", "greens"].includes(phase)}
                    onPointerDown={startStir}
                    onPointerMove={moveStir}
                    onPointerUp={endStir}
                    onPointerCancel={endStir}
                    role="application"
                    aria-label="炒锅，大火断生时可滑动翻匀"
                  >
                    <span className={shared.zoneLabel}>
                      {heat
                        ? `${GARLIC_HEAT_PROFILES[heat].label} · ${
                            GARLIC_HEAT_PROFILES[heat].heatLabel
                          }`
                        : "炒锅"}
                    </span>
                    <div
                      className={`${shared.flameGlow} ${
                        heat ? shared.flameOn : ""
                      } ${heat === "high" ? shared.flameHigh : ""}`}
                      aria-hidden="true"
                    />
                    <img
                      className={shared.wokVessel}
                      src="/2d/story-kitchen/play/wok-vessel.svg"
                      alt=""
                      draggable={false}
                    />
                    {oilAdded && (
                      <>
                        <span className={shared.oilSheen} data-oil-sheen />
                        <span className={shared.oilBadge}>
                          <Droplets size={11} />
                          油已下锅
                        </span>
                      </>
                    )}
                    {garlicPlacement === "wok" && (
                      <span
                        className={styles.garlicInWok}
                        data-state={garlicBand}
                        data-garlic-particles
                        role="img"
                        aria-label={`锅中蒜末：${garlicDisplay}`}
                        style={{ transform: `rotate(${stirAngle * 0.12}deg)` }}
                      >
                        <em className={styles.garlicAroma} />
                        <span className={styles.garlicSizzle}>
                          <Sparkles size={12} />
                          {garlicDisplay}
                        </span>
                        {GARLIC_BITS.map(
                          ([left, top, rotate, size], index) => (
                            <i
                              key={`${left}-${top}`}
                              className={styles.garlicBit}
                              style={
                                {
                                  left: `${left}%`,
                                  top: `${top}%`,
                                  width: `${size}px`,
                                  height: `${size * 0.72}px`,
                                  transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
                                  "--bit": index,
                                } as CSSProperties
                              }
                            />
                          ),
                        )}
                      </span>
                    )}
                    {greensPlacement === "wok" && (
                      <span
                        className={styles.greensInWok}
                        data-state={currentGreensBand}
                        style={{ transform: `rotate(${stirAngle * 0.16}deg)` }}
                      >
                        {[0, 1, 2, 3, 4].map((index) => (
                          <img
                            key={index}
                            src={ASSETS.greens}
                            alt=""
                            draggable={false}
                            style={{ "--leaf": index } as CSSProperties}
                          />
                        ))}
                      </span>
                    )}
                    {(heat || garlicPlacement === "wok") && (
                      <span className={shared.steam} aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                    )}
                  </div>

                  {phase === "serve" && (
                    <div
                      className={`${shared.dropZone} ${shared.plateZone} ${styles.servePlateZone}`}
                      data-drop-zone="plate"
                      data-active
                    >
                      <span className={shared.zoneLabel}>成品盘 · 拖到这里</span>
                      <span className={styles.plateGlow} aria-hidden="true" />
                      <img
                        className={styles.servePlateVessel}
                        data-plate-vessel
                        src="/2d/story-kitchen/tools/tool_plate_normal.png"
                        alt="空白成品盘"
                        draggable={false}
                      />
                      <span className={styles.servePlateHint}>
                        把蒜蓉油麦菜拖过来
                      </span>
                    </div>
                  )}
                </>
              )}

              {phase === "result" && outcome && (
                <div className={shared.resultScene} data-outcome={outcome.kind}>
                  <span className={styles.resultAura} />
                  <div className={shared.resultPlate}>
                    <img
                      src="/2d/story-kitchen/tools/tool_plate_normal.png"
                      alt=""
                      draggable={false}
                    />
                    <span className={styles.resultDish}>
                      <DishVisual result />
                    </span>
                  </div>
                  <div className={shared.resultCopy}>
                    <span>{outcome.kicker}</span>
                    <h2>{outcome.title}</h2>
                    <div
                      className={shared.resultStars}
                      aria-label={`${outcome.stars} 星评价`}
                    >
                      {[1, 2, 3].map((value) => (
                        <Star
                          key={value}
                          size={26}
                          fill={value <= outcome.stars ? "currentColor" : "none"}
                        />
                      ))}
                      <strong>{outcome.score}</strong>
                      <small>/ 100</small>
                    </div>
                    <p>{outcome.explanation}</p>
                  </div>
                </div>
              )}

              {phase !== "result" && (
                <div className={shared.stageNotice} aria-live="polite">
                  {notice}
                </div>
              )}
            </div>

            {phase !== "result" && (
              <div className={shared.inventory}>
                <div>
                  <span className={shared.inventoryLabel}>备料台</span>
                  <p>
                    {phase === "prep"
                      ? "洗切油麦菜，准备蒜末"
                      : phase === "heat"
                        ? "热油后把蒜末下锅"
                        : phase === "garlic"
                          ? "蒜香合适时下油麦菜"
                          : phase === "greens"
                            ? "选盐、翻匀、等待断生"
                            : "把成品拖到盘中"}
                  </p>
                </div>
                <div className={shared.inventoryItems}>
                  {phase === "prep" && greensPlacement === "tray" && (
                    <IngredientCard
                      id="greens"
                      label="油麦菜"
                      onPointerDown={(event) => beginDrag(event, "greens")}
                      onPointerMove={moveDrag}
                      onPointerUp={(event) => endDrag(event, "greens")}
                      onPointerCancel={() => setDrag(null)}
                      onKeyboardPlace={() => keyboardPlace("greens")}
                    >
                      <img src={ASSETS.greens} alt="" draggable={false} />
                    </IngredientCard>
                  )}
                  {phase === "prep" && garlicPlacement === "tray" && (
                    <IngredientCard
                      id="garlic"
                      label="大蒜"
                      onPointerDown={(event) => beginDrag(event, "garlic")}
                      onPointerMove={moveDrag}
                      onPointerUp={(event) => endDrag(event, "garlic")}
                      onPointerCancel={() => setDrag(null)}
                      onKeyboardPlace={() => keyboardPlace("garlic")}
                    >
                      <img src={ASSETS.garlic} alt="" draggable={false} />
                    </IngredientCard>
                  )}
                  {phase === "heat" && garlicPlacement === "bowl" && (
                    <IngredientCard
                      id="garlic"
                      label="蒜末"
                      onPointerDown={(event) => beginDrag(event, "garlic")}
                      onPointerMove={moveDrag}
                      onPointerUp={(event) => endDrag(event, "garlic")}
                      onPointerCancel={() => setDrag(null)}
                      onKeyboardPlace={() => keyboardPlace("garlic")}
                    >
                      <img src={ASSETS.garlic} alt="" draggable={false} />
                    </IngredientCard>
                  )}
                  {phase === "garlic" && greensPlacement === "board" && (
                    <IngredientCard
                      id="greens"
                      label="油麦菜"
                      onPointerDown={(event) => beginDrag(event, "greens")}
                      onPointerMove={moveDrag}
                      onPointerUp={(event) => endDrag(event, "greens")}
                      onPointerCancel={() => setDrag(null)}
                      onKeyboardPlace={() => keyboardPlace("greens")}
                    >
                      <img src={ASSETS.greens} alt="" draggable={false} />
                    </IngredientCard>
                  )}
                  {phase === "serve" && (
                    <IngredientCard
                      id="dish"
                      label="蒜蓉油麦菜"
                      onPointerDown={(event) => beginDrag(event, "dish")}
                      onPointerMove={moveDrag}
                      onPointerUp={(event) => endDrag(event, "dish")}
                      onPointerCancel={() => setDrag(null)}
                      onKeyboardPlace={() => keyboardPlace("dish")}
                    >
                      <DishVisual />
                    </IngredientCard>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className={shared.sideColumn}>
          <section className={shared.characterPanel}>
            <div className={shared.characterBackdrop} aria-hidden="true" />
            <div
              className={shared.characterPortrait}
              data-character-mood={isDejected ? "dejected" : "normal"}
            >
              <img
                className={`${shared.character} ${
                  isDejected ? styles.dejectedCharacter : ""
                }`}
                src="/2d/character/normal_xiami_02.png"
                alt="夏弥"
                draggable={false}
              />
              {isDejected && (
                <div className={styles.dejectedAction} data-dejected-action>
                  <img
                    className={styles.dejectedFace}
                    src="/2d/character/normal_xiami_02.png"
                    alt=""
                    draggable={false}
                  />
                  <span className={styles.dejectedDesk} aria-hidden="true" />
                  <span
                    className={styles.dejectedSighPuffs}
                    aria-hidden="true"
                  >
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className={styles.dejectedSighText} data-dejected-sigh>
                    唉……
                  </span>
                </div>
              )}
            </div>
            <div className={shared.dialogue}>
              <div className={shared.speaker}>
                <strong>夏弥</strong>
                <span data-voice-line={activeVoiceLineId}>
                  {outcome ? "复盘" : "关键提示"}
                </span>
                <div className={shared.voiceControls}>
                  <button
                    type="button"
                    data-voice-toggle
                    aria-label={voiceEnabled ? "关闭夏弥语音播报" : "开启夏弥语音播报"}
                    aria-pressed={voiceEnabled}
                    onClick={toggleVoice}
                  >
                    {voiceEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                    {voiceEnabled ? "语音开" : "语音关"}
                  </button>
                  {voiceEnabled && (
                    <button
                      type="button"
                      className={shared.replayVoice}
                      data-voice-replay
                      data-voice-play={voiceNeedsGesture ? "true" : undefined}
                      onClick={replayVoice}
                    >
                      {voiceNeedsGesture ? "点击播放" : "重听"}
                    </button>
                  )}
                </div>
              </div>
              <p aria-live="polite">{characterDialogue}</p>
            </div>
          </section>

          <section className={shared.controlPanel}>
            {phase === "prep" && (
              <>
                <div className={shared.panelHeading}>
                  <span>步骤 1 · 洗切备料</span>
                  <h2>菜要快洗，蒜要够碎</h2>
                </div>
                <div className={shared.checkList}>
                  <span className={greensPlacement === "board" ? shared.done : ""}>
                    <i>{greensPlacement === "board" ? <Check size={13} /> : "1"}</i>
                    油麦菜放到清洗砧板
                  </span>
                  <span className={garlicPlacement === "bowl" ? shared.done : ""}>
                    <i>{garlicPlacement === "bowl" ? <Check size={13} /> : "2"}</i>
                    大蒜放进备料碗
                  </span>
                  <span className={cutDone ? shared.done : ""}>
                    <i>{cutDone ? <Check size={13} /> : "3"}</i>
                    滑动一次洗净切段
                  </span>
                  <span className={garlicReady ? shared.done : ""}>
                    <i>{garlicReady ? <Check size={13} /> : "4"}</i>
                    蒜末拍到细碎
                  </span>
                </div>
                <button
                  type="button"
                  className={shared.primaryAction}
                  data-mince-garlic
                  disabled={garlicPlacement !== "bowl" || garlicReady}
                  onClick={minceGarlic}
                >
                  <Check size={18} />
                  {garlicReady ? "蒜末已备好" : "拍碎切末"}
                </button>
              </>
            )}

            {phase === "heat" && (
              <>
                <div className={shared.panelHeading}>
                  <span>步骤 2 · 热锅热油</span>
                  <h2>先把蒜香的地基搭好</h2>
                </div>
                <div className={shared.heatButtons}>
                  {(["medium", "high"] as const).map((level) => (
                    <button
                      type="button"
                      key={level}
                      className={heat === level ? shared.heatSelected : ""}
                      data-heat={level}
                      onClick={() => setHeat(level)}
                    >
                      <Flame size={18} />
                      <strong>{GARLIC_HEAT_PROFILES[level].label}</strong>
                      <small>{GARLIC_HEAT_PROFILES[level].heatLabel}</small>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className={shared.primaryAction}
                  data-add-oil
                  disabled={!heat || oilAdded}
                  onClick={() => {
                    setOilAdded(true);
                    setNotice("油已下锅，把蒜末拖进锅里。");
                  }}
                >
                  <Droplets size={18} />
                  {oilAdded ? "油已下锅" : "倒入食用油"}
                </button>
              </>
            )}

            {phase === "garlic" && (
              <>
                <div className={shared.panelHeading}>
                  <span>蒜香窗口</span>
                  <h2>蒜末一香就下菜</h2>
                </div>
                <div className={shared.liveReadout}>
                  <span><Timer size={16} />蒜末受热 {(garlicCookMs / 1000).toFixed(1)}s</span>
                  <strong data-cook-band={garlicBand}>{garlicDisplay}</strong>
                </div>
                <p className={shared.manualHint}>
                  <MoveHorizontal size={16} />
                  从备料台把油麦菜拖进炒锅。
                </p>
              </>
            )}

            {phase === "greens" && (
              <>
                <div className={shared.panelHeading}>
                  <span>步骤 3 · 大火断生</span>
                  <h2>叶子刚塌就够了</h2>
                </div>
                <div className={shared.liveReadout}>
                  <span><Timer size={16} />油麦菜受热 {(greensCookMs / 1000).toFixed(1)}s</span>
                  <strong data-cook-band={currentGreensBand}>{greensDisplay}</strong>
                </div>
                <div className={shared.seasoning}>
                  <AmountSelector
                    label="盐"
                    value={salt}
                    dataKey="salt"
                    onChange={setSalt}
                    options={[
                      { value: 0, label: "少放" },
                      { value: 1, label: "刚好" },
                      { value: 2, label: "多放" },
                    ]}
                  />
                </div>
                <p className={shared.manualHint}>
                  <MoveHorizontal size={16} />
                  在锅面滑动翻匀，已翻 {stirCount} 次。
                </p>
                <button
                  type="button"
                  className={shared.primaryAction}
                  data-serve-greens
                  disabled={!canStartDish}
                  onClick={startServe}
                >
                  <Check size={18} />
                  菜叶断生，准备装盘
                </button>
              </>
            )}

            {phase === "serve" && (
              <>
                <div className={shared.panelHeading}>
                  <span>步骤 4 · 装盘复盘</span>
                  <h2>余温还在继续，别等它变黄</h2>
                </div>
                <p className={shared.manualHint}>
                  <MoveHorizontal size={16} />
                  从备料台拖动“蒜蓉油麦菜”到盘中。
                </p>
              </>
            )}

            {phase === "result" && outcome && (
              <>
                <div className={shared.panelHeading}>
                  <span>本菜复盘</span>
                  <h2>{outcome.title}</h2>
                </div>
                <div className={styles.recapPlate} data-recap-plate>
                  <img
                    src="/2d/story-kitchen/tools/tool_plate_normal.png"
                    alt="成品盘"
                    draggable={false}
                  />
                  <span>
                    <small>成品盘</small>
                    <strong>蒜蓉油麦菜已经装盘</strong>
                  </span>
                  <Check size={16} />
                </div>
                <div className={styles.metricList}>
                  {[
                    ["调味", outcome.metrics.seasoning],
                    ["蒜香", outcome.metrics.garlicAroma],
                    ["断生", outcome.metrics.greensTexture],
                    ["翻匀", outcome.metrics.stir],
                  ].map(([label, value]) => (
                    <span key={label as string}>
                      <b>{label}</b>
                      <i><em style={{ width: `${value}%` }} /></i>
                      <strong>{value}</strong>
                    </span>
                  ))}
                </div>
                <div className={shared.resultActions}>
                  <button type="button" data-restart-game onClick={reset}>
                    <RotateCcw size={16} />
                    再做一盘
                  </button>
                  <Link href="/cook/story/">返回剧场</Link>
                </div>
              </>
            )}
          </section>
        </aside>
      </div>

      {drag && (
        <div
          className={shared.dragGhost}
          data-drag-ghost={drag.id}
          style={{ left: drag.x, top: drag.y } as CSSProperties}
        >
          {drag.id === "greens" ? (
            <img src={ASSETS.greens} alt="" draggable={false} />
          ) : drag.id === "garlic" ? (
            <img src={ASSETS.garlic} alt="" draggable={false} />
          ) : (
            <DishVisual />
          )}
        </div>
      )}
    </div>
  );
}
