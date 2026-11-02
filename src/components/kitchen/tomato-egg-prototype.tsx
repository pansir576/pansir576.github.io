"use client";
/* eslint-disable @next/next/no-img-element -- existing transparent story assets need direct DOM positioning */
/* eslint-disable react-hooks/set-state-in-effect -- browser-only speech preference is hydrated after mount */

import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Droplets,
  Flame,
  MoveHorizontal,
  RotateCcw,
  Scissors,
  Sparkles,
  Star,
  Timer,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  cookingBand,
  evaluateTomatoEgg,
  HEAT_PROFILES,
  type AmountLevel,
  type CookingBand,
  type HeatLevel,
  type TomatoEggOutcome,
} from "@/lib/tomato-egg-game";
import { TOMATO_EGG_WORKSTATIONS } from "@/lib/play-workstations";
import {
  loadRecipeVoiceEnabled,
  saveRecipeVoiceEnabled,
} from "@/lib/recipe-speech";
import {
  getXiamiVoiceLine,
  getLowScoreDejectedVoiceLine,
  playXiamiVoice,
  preloadXiamiVoice,
  stopXiamiVoice,
  type XiamiVoiceLineId,
} from "@/lib/xiami-voice";
import { XIAMI_TOMATO_EGG_DIALOGUE } from "@/lib/xiami-dialogue";
import styles from "./tomato-egg-prototype.module.css";

type Phase = "prep" | "heat" | "egg" | "tomato" | "finish" | "result";
type Placement = "tray" | "board" | "bowl" | "wok" | "reserve";
type DragId = "tomato" | "egg" | "dish";
type DropZone = "board" | "bowl" | "wok" | "plate";
type ActionKind = "cut" | "whisk";

interface DragState {
  id: DragId;
  x: number;
  y: number;
}

interface GestureState {
  kind: ActionKind;
  startTime: number;
  lastX: number;
  lastY: number;
  distance: number;
  pointerId: number;
  completed: boolean;
}

const ASSETS = {
  tomato:
    "/2d/story-kitchen/ingredients/ingredient_tomato_normal.png",
  egg: "/2d/story-kitchen/ingredients/ingredient_egg_normal.png",
  chives:
    "/2d/story-kitchen/ingredients/ingredient_chives_normal.png",
  knife: "/2d/story-kitchen/tools/tool_knife_normal.png",
  whisk: "/2d/story-kitchen/tools/tool_whisk_normal.png",
  plate: "/2d/story-kitchen/tools/tool_plate_normal.png",
} as const;

const PHASES = ["备料", "切配打蛋", "热锅下油", "炒蛋盛出", "番茄出沙", "合炒装盘"];

function TomatoChunks({
  small = false,
  cookState = "raw",
  cookProgress = 0,
}: {
  small?: boolean;
  cookState?: CookingBand;
  cookProgress?: number;
}) {
  return (
    <span
      className={`${styles.tomatoChunks} ${small ? styles.tomatoChunksSmall : ""}`}
      data-tomato-chunks
      data-cook-state={cookState}
      aria-label={
        cookState === "ready"
          ? "番茄软化出沙"
          : cookState === "over"
            ? "番茄收汁"
            : cookState === "burnt"
              ? "番茄焦化"
              : "番茄块"
      }
      style={
        {
          "--tomato-cook": Math.min(1, Math.max(0, cookProgress)),
        } as CSSProperties
      }
    >
      {Array.from({ length: small ? 7 : 13 }, (_, index) => (
        <b
          key={`pulp-${index}`}
          className={styles.tomatoPulpBit}
          data-tomato-pulp
          aria-hidden="true"
          style={
            {
              "--pulp-x": `${8 + ((index * 29) % 78)}%`,
              "--pulp-y": `${19 + ((index * 37) % 58)}%`,
              "--pulp-r": `${-48 + index * 13}deg`,
            } as CSSProperties
          }
        />
      ))}
      {Array.from({ length: small ? 5 : 7 }, (_, index) => (
        <i
          key={index}
          className={styles.tomatoChunk}
          style={
            {
              "--chunk-x": `${18 + ((index * 23) % 64)}%`,
              "--chunk-y": `${22 + ((index * 31) % 54)}%`,
              "--chunk-r": `${-32 + index * 17}deg`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}

function EggLiquid({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`${styles.eggLiquid} ${small ? styles.eggLiquidSmall : ""}`}
      data-egg-liquid
      aria-label="黄色鸡蛋液"
    >
      <i />
      <i />
      <i />
    </span>
  );
}

function EggCurds({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`${styles.eggCurds} ${small ? styles.eggCurdsSmall : ""}`}
      data-egg-curds
      aria-label="蓬松鸡蛋块"
    >
      {Array.from({ length: small ? 5 : 8 }, (_, index) => (
        <i
          key={index}
          className={styles.eggCurd}
          style={
            {
              "--curd-x": `${16 + ((index * 27) % 68)}%`,
              "--curd-y": `${17 + ((index * 19) % 58)}%`,
              "--curd-r": `${-24 + index * 12}deg`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}

function ScallionBits() {
  return (
    <span className={styles.scallionBits} data-scallion-bits aria-label="葱花">
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <i key={index} />
      ))}
    </span>
  );
}

function IngredientCard({
  id,
  label,
  image,
  compact = false,
  bare = false,
  children,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onKeyboardPlace,
}: {
  id: DragId;
  label: string;
  image?: string;
  compact?: boolean;
  bare?: boolean;
  children?: React.ReactNode;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onKeyboardPlace: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.ingredientCard} ${
        compact ? styles.ingredientCardCompact : ""
      } ${bare ? styles.ingredientCardBare : ""}`}
      data-ingredient-drag={id}
      aria-label={`拖动${label}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClick={(event) => {
        if (event.detail === 0) onKeyboardPlace();
      }}
    >
      {children ?? (image ? <img src={image} alt="" draggable={false} /> : null)}
      <span>{label}</span>
    </button>
  );
}

function AmountSelector({
  label,
  value,
  onChange,
  dataKey,
  options,
}: {
  label: string;
  value: AmountLevel | null;
  onChange: (value: AmountLevel) => void;
  dataKey: "salt" | "sugar";
  options: { value: AmountLevel; label: string }[];
}) {
  return (
    <div className={styles.amountControl}>
      <span>{label}</span>
      <div>
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            className={value === option.value ? styles.amountSelected : ""}
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

export function TomatoEggPrototype() {
  const [phase, setPhase] = useState<Phase>("prep");
  const [tomatoPlacement, setTomatoPlacement] =
    useState<Placement>("tray");
  const [eggPlacement, setEggPlacement] = useState<Placement>("tray");
  const [cutDone, setCutDone] = useState(false);
  const [whiskDone, setWhiskDone] = useState(false);
  const [scallionReady, setScallionReady] = useState(false);
  const [heat, setHeat] = useState<HeatLevel | null>(null);
  const [oilAdded, setOilAdded] = useState(false);
  const [eggCookMs, setEggCookMs] = useState(0);
  const [tomatoCookMs, setTomatoCookMs] = useState(0);
  const [stirCount, setStirCount] = useState(0);
  const [sugar, setSugar] = useState<AmountLevel | null>(null);
  const [salt, setSalt] = useState<AmountLevel | null>(null);
  const [outcome, setOutcome] = useState<TomatoEggOutcome | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceNeedsGesture, setVoiceNeedsGesture] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [notice, setNotice] = useState(
    "先切番茄、打散鸡蛋，再备好葱花。每一步只做一次有效动作。",
  );
  const [knifeX, setKnifeX] = useState(50);
  const [whiskAngle, setWhiskAngle] = useState(0);
  const [stirAngle, setStirAngle] = useState(0);

  const gestureRef = useRef<GestureState | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const stirRef = useRef({
    lastX: 0,
    lastY: 0,
    distance: 0,
    counted: false,
  });
  const voiceFallbackNotifiedRef = useRef(false);
  const lastRequestedVoiceLineRef = useRef<string | null>(null);

  const prepComplete = cutDone && whiskDone && scallionReady;
  const gamePhase: Phase =
    phase === "prep" && prepComplete ? "heat" : phase;
  const activeHeat = heat ?? "medium";
  const flame = heat ? HEAT_PROFILES[heat] : null;
  const eggBand = cookingBand(activeHeat, eggCookMs, "egg");
  const tomatoBand = cookingBand(activeHeat, tomatoCookMs, "tomato");
  const tomatoVisualProgress =
    tomatoCookMs / HEAT_PROFILES[activeHeat].tomato.burnAtMs;
  const resultTomatoBand: CookingBand =
    outcome?.kind === "raw"
      ? "raw"
      : outcome?.kind === "burnt"
        ? "burnt"
        : "ready";
  const hasWokIngredient =
    tomatoPlacement === "wok" || eggPlacement === "wok";
  const bothInWok =
    tomatoPlacement === "wok" && eggPlacement === "wok";
  const canPlate = gamePhase === "finish" && bothInWok && salt !== null;
  const isDejected = outcome !== null && outcome.score < 70;
  const activeBand =
    gamePhase === "egg"
      ? eggBand
      : gamePhase === "tomato"
        ? tomatoBand
        : null;

  const progressIndex = useMemo(() => {
    if (gamePhase === "prep") {
      return tomatoPlacement !== "tray" && eggPlacement !== "tray" ? 1 : 0;
    }
    if (gamePhase === "heat") return 2;
    if (gamePhase === "egg") return 3;
    if (gamePhase === "tomato") return 4;
    return 5;
  }, [eggPlacement, gamePhase, tomatoPlacement]);

  const mission = useMemo(() => {
    if (gamePhase === "prep") {
      if (tomatoPlacement === "tray" || eggPlacement === "tray") {
        return "步骤 1：番茄拖到砧板，鸡蛋打入碗中。";
      }
      if (!cutDone) return "番茄切块：在砧板上向左或向右滑动一次。";
      if (!whiskDone) return "打散鸡蛋：在碗中划一次圈即可完成。";
      if (!scallionReady) return "备葱花：点击右侧“切好葱花”，准备最后点缀。";
      return "备料完成。下一步先热锅、再倒油。";
    }
    if (gamePhase === "heat") {
      return "步骤 2：选中火或大火，再沿锅边倒入食用油。";
    }
    if (gamePhase === "egg") {
      if (!oilAdded) return "锅里还没有油。先点“倒入食用油”再下蛋液。";
      if (eggPlacement !== "wok") return "把蛋液拖进热锅，观察凝固状态。";
      if (eggBand === "raw") return "蛋液仍偏流动，让它在锅里再定型一会儿。";
      if (eggBand === "ready") return "鸡蛋刚好定型，现在划散并盛出。";
      if (eggBand === "over") return "鸡蛋开始变老，尽快划散盛出。";
      return "鸡蛋已经焦了。记录结果后再调整火候。";
    }
    if (gamePhase === "tomato") {
      if (tomatoPlacement !== "wok") return "把番茄块下锅，先选择糖量。";
      if (sugar === null) return "少量糖用于中和番茄酸味，先选择糖量。";
      if (tomatoBand === "raw") return "番茄还在出水，继续加热到果肉变软、边缘出沙。";
      if (tomatoBand === "ready") return "番茄已经出沙，现在倒回鸡蛋。";
      if (tomatoBand === "over") return "番茄水分收得过快，尽快倒回鸡蛋。";
      return "番茄已经焦化，记录这次火候。";
    }
    if (gamePhase === "finish") {
      if (salt === null) return "最后加盐：选择少放、刚好或多放。";
      return "沿锅滑一次把蛋和番茄翻匀，然后拖到盘中。";
    }
    return "装盘完成。评价来自切配、两次火候、翻炒和调味。";
  }, [
    cutDone,
    eggBand,
    eggPlacement,
    gamePhase,
    salt,
    scallionReady,
    sugar,
    tomatoBand,
    tomatoPlacement,
    whiskDone,
    oilAdded,
  ]);

  const voiceLineId: XiamiVoiceLineId =
    outcome?.voiceLineId ??
    (gamePhase === "prep"
      ? "phase-prep"
      : gamePhase === "heat"
        ? "phase-heat"
        : gamePhase === "egg"
          ? "phase-egg"
          : gamePhase === "tomato"
            ? "phase-tomato"
            : "phase-finish");
  const activeVoiceLineId = isDejected ? "low-score-dejected" : voiceLineId;
  const characterDialogue = isDejected
    ? "赏……个脸呗……把菜做好。"
    : XIAMI_TOMATO_EGG_DIALOGUE[voiceLineId];
  const voiceLine = isDejected
    ? getLowScoreDejectedVoiceLine()
    : getXiamiVoiceLine(voiceLineId);

  const playCurrentVoice = useCallback(async () => {
    const result = await playXiamiVoice(voiceLine, {
      onFallback: () => {
        if (voiceFallbackNotifiedRef.current) return;
        voiceFallbackNotifiedRef.current = true;
        setNotice("夏弥配音加载失败，已切换系统语音。");
      },
    });
    if (result === "blocked") {
      setVoiceNeedsGesture(true);
    } else if (result !== "cancelled") {
      setVoiceNeedsGesture(false);
    }
  }, [voiceLine]);

  useEffect(() => {
    setVoiceEnabled(loadRecipeVoiceEnabled());
  }, []);

  useEffect(() => {
    if (!voiceEnabled) return;
    preloadXiamiVoice();
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
    if (gamePhase !== "egg" || eggPlacement !== "wok") return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const current = performance.now();
      const delta = current - previous;
      previous = current;
      setEggCookMs((value) => Math.min(15_000, value + delta));
    }, 100);
    return () => window.clearInterval(timer);
  }, [eggPlacement, gamePhase]);

  useEffect(() => {
    if (gamePhase !== "tomato" || tomatoPlacement !== "wok") return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const current = performance.now();
      const delta = current - previous;
      previous = current;
      setTomatoCookMs((value) => Math.min(15_000, value + delta));
    }, 100);
    return () => window.clearInterval(timer);
  }, [gamePhase, tomatoPlacement]);

  useEffect(
    () => () => {
      if (holdTimerRef.current !== null) {
        window.clearTimeout(holdTimerRef.current);
      }
    },
    [],
  );

  function completeGesture(kind: ActionKind) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.completed) return;
    gesture.completed = true;
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (kind === "cut") {
      setCutDone(true);
      setKnifeX(50);
      setNotice("番茄已经切成块。");
    } else {
      setWhiskDone(true);
      setWhiskAngle(0);
      setNotice("鸡蛋已经变成均匀蛋液。");
    }
  }

  function beginDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    id: DragId,
  ) {
    if (gamePhase === "result") return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ id, x: event.clientX, y: event.clientY });
  }

  function moveDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!drag) return;
    setDrag((current) =>
      current
        ? { ...current, x: event.clientX, y: event.clientY }
        : current,
    );
  }

  function endDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    id: DragId,
  ) {
    if (!drag) return;
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const zoneElement = element?.closest<HTMLElement>("[data-drop-zone]");
    const zone = (zoneElement?.dataset.dropZone as DropZone | undefined) ?? null;
    setDrag(null);
    handleDrop(id, zone);
  }

  function cancelDrag() {
    setDrag(null);
  }

  function handleDrop(id: DragId, zone: DropZone | null) {
    if (!zone) {
      setNotice("没有放进操作区域，再试一次。");
      return;
    }
    if (id === "dish") {
      if (zone !== "plate") {
        setNotice("合炒好的菜要拖到盘子里。");
        return;
      }
      if (salt === null) {
        setNotice("还差最后加盐。");
        return;
      }
      finishDish();
      return;
    }
    if (gamePhase === "prep") {
      if (id === "tomato" && zone === "board") {
        setTomatoPlacement("board");
        setNotice("番茄到位。现在滑动一次切块。");
      } else if (id === "egg" && zone === "bowl") {
        setEggPlacement("bowl");
        setNotice("鸡蛋打入碗中。现在划一次圈打散。");
      } else {
        setNotice("番茄放砧板，鸡蛋放碗里。");
      }
      return;
    }
    if (gamePhase === "heat") {
      setNotice("先选火力并倒油。");
      return;
    }
    if (gamePhase === "egg" && zone === "wok") {
      if (!oilAdded) {
        setNotice("锅里还没有油，先倒入食用油。");
        return;
      }
      if (id === "egg") {
        setEggPlacement("wok");
        setNotice("蛋液入锅，鸡蛋计时开始。");
      } else {
        setNotice("先炒鸡蛋，再炒番茄。");
      }
      return;
    }
    if (gamePhase === "tomato" && zone === "wok") {
      if (id === "tomato") {
        setTomatoPlacement("wok");
        setNotice("番茄块入锅，番茄计时开始。");
      } else {
        setNotice("鸡蛋已经盛出，先把番茄炒出沙。");
      }
      return;
    }
    if (gamePhase === "finish" && zone === "wok") {
      setNotice("鸡蛋和番茄已经回锅，选好盐并翻匀后拖到盘中。");
    }
  }

  function keyboardPlace(id: DragId) {
    if (gamePhase === "prep") {
      handleDrop(id, id === "tomato" ? "board" : "bowl");
    } else if (gamePhase === "egg" && id === "egg") {
      handleDrop(id, "wok");
    } else if (gamePhase === "tomato" && id === "tomato") {
      handleDrop(id, "wok");
    } else if (gamePhase === "finish" && id === "dish") {
      handleDrop(id, "plate");
    }
  }

  function startGesture(
    event: ReactPointerEvent<HTMLElement>,
    kind: ActionKind,
  ) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    gestureRef.current = {
      kind,
      startTime: performance.now(),
      lastX: event.clientX,
      lastY: event.clientY,
      distance: 0,
      pointerId: event.pointerId,
      completed: false,
    };
    holdTimerRef.current = window.setTimeout(() => completeGesture(kind), 650);
  }

  function moveGesture(event: ReactPointerEvent<HTMLElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.completed) return;
    const dx = event.clientX - gesture.lastX;
    const dy = event.clientY - gesture.lastY;
    gesture.distance += Math.hypot(dx, dy);
    gesture.lastX = event.clientX;
    gesture.lastY = event.clientY;
    if (gesture.kind === "cut") {
      const rect = event.currentTarget.getBoundingClientRect();
      setKnifeX(
        Math.min(
          94,
          Math.max(6, ((event.clientX - rect.left) / rect.width) * 100),
        ),
      );
    } else {
      setWhiskAngle((value) => value + dx * 2.2 + dy * 1.4);
    }
    if (gesture.distance >= 24) completeGesture(gesture.kind);
  }

  function endGesture(event: ReactPointerEvent<HTMLElement>) {
    const gesture = gestureRef.current;
    if (!gesture) return;
    if (!gesture.completed && gesture.distance >= 16) {
      completeGesture(gesture.kind);
    }
    if (!gesture.completed) {
      setNotice(
        gesture.kind === "cut"
          ? "在砧板上滑动一次就能切块。"
          : "在碗里划一次圈就能打散。",
      );
    }
    gestureRef.current = null;
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (event.currentTarget.hasPointerCapture(gesture.pointerId)) {
      event.currentTarget.releasePointerCapture(gesture.pointerId);
    }
  }

  function startStir(event: ReactPointerEvent<HTMLDivElement>) {
    if (
      event.button !== 0 ||
      !["egg", "tomato", "finish"].includes(gamePhase)
    ) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    stirRef.current = {
      lastX: event.clientX,
      lastY: event.clientY,
      distance: 0,
      counted: false,
    };
  }

  function moveStir(event: ReactPointerEvent<HTMLDivElement>) {
    const stir = stirRef.current;
    if (!stir.lastX) return;
    const dx = event.clientX - stir.lastX;
    const dy = event.clientY - stir.lastY;
    stir.lastX = event.clientX;
    stir.lastY = event.clientY;
    stir.distance += Math.hypot(dx, dy);
    setStirAngle((value) => value + dx);
    if (!stir.counted && stir.distance >= 24) {
      stir.counted = true;
      setStirCount((value) => value + 1);
    }
  }

  function chooseHeat(level: HeatLevel) {
    setHeat(level);
    if (gamePhase === "heat") {
      setPhase("egg");
      setNotice(
        `${HEAT_PROFILES[level].label}已开。沿锅边倒油，再下蛋液。`,
      );
    } else {
      setNotice(`火力切到${HEAT_PROFILES[level].label}。`);
    }
  }

  function addOil() {
    setOilAdded(true);
    setNotice("油已经沿锅边倒入，可以下蛋液了。");
  }

  function prepareScallion() {
    setScallionReady(true);
    setNotice("葱花备好了。合炒后用它收尾。");
  }

  function reserveEgg() {
    if (eggPlacement !== "wok" || eggCookMs < 600) return;
    setEggPlacement("reserve");
    setStirCount((value) => value + 1);
    setPhase("tomato");
    setNotice("鸡蛋已经划散盛出。现在下番茄并选择糖量。");
  }

  function returnEgg() {
    if (
      tomatoPlacement !== "wok" ||
      sugar === null ||
      tomatoCookMs < 600
    ) {
      return;
    }
    setEggPlacement("wok");
    setStirCount((value) => value + 1);
    setPhase("finish");
    setNotice("鸡蛋回到锅里。最后加盐、翻匀、撒葱花。");
  }

  function finishDish() {
    if (!canPlate || !heat) return;
    setOutcome(
      evaluateTomatoEgg({
        heat,
        eggCookMs,
        tomatoCookMs,
        stirCount,
        salt: salt ?? 1,
        sugar: sugar ?? 0,
      }),
    );
    setPhase("result");
    setNotice("装盘完成。");
  }

  function reset() {
    setPhase("prep");
    setTomatoPlacement("tray");
    setEggPlacement("tray");
    setCutDone(false);
    setWhiskDone(false);
    setScallionReady(false);
    setHeat(null);
    setOilAdded(false);
    setEggCookMs(0);
    setTomatoCookMs(0);
    setStirCount(0);
    setSugar(null);
    setSalt(null);
    setOutcome(null);
    setDrag(null);
    setNotice("先切番茄、打散鸡蛋，再备好葱花。每一步只做一次有效动作。");
    setKnifeX(50);
    setWhiskAngle(0);
    setStirAngle(0);
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

  const stageTime = gamePhase === "egg" ? eggCookMs : tomatoCookMs;
  const stageWindow =
    gamePhase === "egg"
      ? HEAT_PROFILES[activeHeat].egg
      : HEAT_PROFILES[activeHeat].tomato;

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <Link href="/cook/story/" className={styles.backLink}>
            <ArrowLeft size={16} />
            返回烹语剧场
          </Link>
          <span className={styles.eyebrow}>PLAYABLE PROTOTYPE · REV 03</span>
          <h1>番茄炒蛋：按真实步骤做一遍</h1>
          <p>
            切番茄、打蛋、备葱，热锅倒油，鸡蛋先炒后盛出，番茄出沙再回锅。不再用重复滑动代替烹饪。
          </p>
        </div>
        <div className={styles.prototypeBadge}>
          <Sparkles size={18} />
          <span>
            单菜品原型
            <small>四步流程与菜谱实训对齐</small>
          </span>
        </div>
      </header>

      <div className={styles.phaseRail} aria-label="当前烹饪阶段">
        {PHASES.map((label, index) => (
          <span
            key={label}
            className={
              index < progressIndex
                ? styles.phaseDone
                : index === progressIndex
                  ? styles.phaseCurrent
                  : ""
            }
          >
            <i>{index < progressIndex ? <Check size={12} /> : index + 1}</i>
            {label}
          </span>
        ))}
      </div>

      <div className={styles.gameLayout}>
        <section className={styles.stageColumn}>
          <div className={styles.stageFrame}>
            <div className={styles.stageTopline}>
              <span className={styles.mission}>
                <Timer size={16} />
                {mission}
              </span>
              <span
                className={styles.cookStatus}
                data-cook-state={activeBand ?? "idle"}
              >
                {activeBand
                  ? {
                      raw: "尚需受热",
                      ready: "最佳窗口",
                      over: "正在变老",
                      burnt: "已经焦化",
                    }[activeBand]
                  : gamePhase === "result"
                    ? "已装盘"
                    : "准备中"}
              </span>
            </div>

            <div
              className={styles.kitchenCanvas}
              data-tomato-egg-stage
              data-phase={gamePhase}
            >
              <div
                className={styles.kitchenBackground}
                data-kitchen-background
                aria-hidden="true"
              />
              <div className={styles.sceneVignette} aria-hidden="true" />

              {gamePhase !== "result" && (
                <>
                  <div
                    className={`${styles.dropZone} ${styles.boardZone} ${
                      tomatoPlacement === "board" ? styles.zoneOccupied : ""
    } ${
      gamePhase === "prep" || tomatoPlacement === "board"
        ? styles.zoneFocused
        : styles.zoneBackgrounded
    }`}
                    data-workstation="cutting-board"
                    data-drop-zone="board"
                    data-active={
                      gamePhase === "prep" && tomatoPlacement === "tray"
                    }
                  >
                    <span className={styles.zoneLabel}>
                      {TOMATO_EGG_WORKSTATIONS.board.label}
                    </span>
                    <span className={styles.cuttingBoardVisual} aria-hidden="true" />
                    {tomatoPlacement === "board" && !cutDone && (
                      <div
                        className={styles.gestureSurface}
                        data-cut-surface
                        aria-label="在砧板上滑动一次切番茄"
                        onPointerDown={(event) => startGesture(event, "cut")}
                        onPointerMove={moveGesture}
                        onPointerUp={endGesture}
                        onPointerCancel={endGesture}
                      >
                        <img
                          className={styles.prepTomato}
                          src={ASSETS.tomato}
                          alt="砧板上的整颗番茄"
                          draggable={false}
                        />
                        <img
                          className={styles.knife}
                          src={ASSETS.knife}
                          alt=""
                          draggable={false}
                          style={{ left: `${knifeX}%` }}
                        />
                        <span className={styles.gestureHint}>
                          <Scissors size={15} />
                          滑动一次切块
                        </span>
                      </div>
                    )}
                    {tomatoPlacement === "board" && cutDone && (
                      <IngredientCard
                        id="tomato"
                        label="番茄块"
                        compact
                        bare
                        onPointerDown={(event) => beginDrag(event, "tomato")}
                        onPointerMove={moveDrag}
                        onPointerUp={(event) => endDrag(event, "tomato")}
                        onPointerCancel={cancelDrag}
                        onKeyboardPlace={() => keyboardPlace("tomato")}
                      >
                        <TomatoChunks small />
                      </IngredientCard>
                    )}
                    {scallionReady && (
                      <span className={styles.boardScallion}>
                        <ScallionBits />
                      </span>
                    )}
                  </div>

                  <div
                    className={`${styles.dropZone} ${styles.bowlZone} ${
                      eggPlacement === "bowl" ? styles.zoneOccupied : ""
    } ${
      gamePhase === "prep" ||
      (gamePhase === "egg" && eggPlacement === "bowl")
        ? styles.zoneFocused
        : styles.zoneBackgrounded
    }`}
                    data-workstation="mixing-bowl"
                    data-drop-zone="bowl"
                    data-active={
                      gamePhase === "prep" && eggPlacement === "tray"
                    }
                  >
                    <span className={styles.zoneLabel}>
                      {TOMATO_EGG_WORKSTATIONS.bowl.label}
                    </span>
                    <img
                      className={styles.bowlVessel}
                      src="/2d/story-kitchen/play/bowl-vessel.svg"
                      alt=""
                      draggable={false}
                    />
                    {eggPlacement === "bowl" && !whiskDone && (
                      <div
                        className={styles.whiskSurface}
                        data-whisk-surface
                        aria-label="在碗中划一次圈打散鸡蛋"
                        onPointerDown={(event) => startGesture(event, "whisk")}
                        onPointerMove={moveGesture}
                        onPointerUp={endGesture}
                        onPointerCancel={endGesture}
                      >
                        <img
                          className={styles.eggInBowl}
                          src={ASSETS.egg}
                          alt="碗中的鸡蛋"
                          draggable={false}
                        />
                        <img
                          className={styles.whisk}
                          src={ASSETS.whisk}
                          alt=""
                          draggable={false}
                          style={{ transform: `rotate(${whiskAngle}deg)` }}
                        />
                        <span className={styles.gestureHint}>划一次打散</span>
                      </div>
                    )}
                    {eggPlacement === "bowl" && whiskDone && (
                      <IngredientCard
                        id="egg"
                        label="鸡蛋液"
                        compact
                        bare
                        onPointerDown={(event) => beginDrag(event, "egg")}
                        onPointerMove={moveDrag}
                        onPointerUp={(event) => endDrag(event, "egg")}
                        onPointerCancel={cancelDrag}
                        onKeyboardPlace={() => keyboardPlace("egg")}
                      >
                        <EggLiquid small />
                      </IngredientCard>
                    )}
                  </div>

                  {eggPlacement === "reserve" && (
                    <div className={styles.reservedEgg} data-reserved-egg>
                      <EggCurds small />
                      <span>鸡蛋已盛出</span>
                    </div>
                  )}

                  <div
                    className={`${styles.dropZone} ${styles.wokZone} ${
                      tomatoPlacement === "wok" || eggPlacement === "wok"
                        ? styles.zoneOccupied
                        : ""
    } ${
      gamePhase === "egg" || gamePhase === "tomato" || gamePhase === "finish"
        ? styles.zoneFocused
        : styles.zoneBackgrounded
    }`}
                    data-workstation="wok"
                    data-drop-zone="wok"
                    data-active={["egg", "tomato", "finish"].includes(gamePhase)}
                    onPointerDown={startStir}
                    onPointerMove={moveStir}
                    tabIndex={["egg", "tomato", "finish"].includes(gamePhase) ? 0 : -1}
                    role="application"
                    aria-label="炒锅，可滑动翻炒"
                  >
                    <span className={styles.zoneLabel}>
                      {flame
                        ? `${flame.label} · ${flame.heatLabel}`
                        : TOMATO_EGG_WORKSTATIONS.wok.label}
                    </span>
                    <div
                      className={`${styles.flameGlow} ${
                        heat ? styles.flameOn : ""
                      } ${heat === "high" ? styles.flameHigh : ""}`}
                      aria-hidden="true"
                    />
                    <img
                      className={styles.wokVessel}
                      src="/2d/story-kitchen/play/wok-vessel.svg"
                      alt=""
                      draggable={false}
                    />
                    {oilAdded && (
                      <>
                        <span className={styles.oilSheen} data-oil-sheen />
                        <span className={styles.oilBadge} data-oil-label>
                          <Droplets size={11} />
                          油已下锅
                        </span>
                      </>
                    )}
                    {tomatoPlacement === "wok" && (
                      <span
                        className={styles.wokTomatoes}
                        style={{ transform: `rotate(${stirAngle * 0.14}deg)` }}
                      >
                        <TomatoChunks
                          cookState={tomatoBand}
                          cookProgress={tomatoVisualProgress}
                        />
                      </span>
                    )}
                    {eggPlacement === "wok" && (
                      <span
                        className={styles.wokEgg}
                        style={{ transform: `rotate(${-stirAngle * 0.12}deg)` }}
                      >
                        {gamePhase === "egg" && eggBand === "raw" ? (
                          <EggLiquid />
                        ) : (
                          <EggCurds />
                        )}
                      </span>
                    )}
                    {gamePhase === "finish" && scallionReady && <ScallionBits />}
                    {(heat || hasWokIngredient) && (
                      <span className={styles.steam} aria-hidden="true">
                        <i />
                        <i />
                        <i />
                      </span>
                    )}
                  </div>

                  {gamePhase === "finish" && oilAdded && (
                    <div
                      className={`${styles.dropZone} ${styles.plateZone}`}
                      data-drop-zone="plate"
                      data-active={canPlate}
                      data-workstation="plate"
                    >
                      <span className={styles.zoneLabel}>
                        {TOMATO_EGG_WORKSTATIONS.plate.label}
                      </span>
                      <span className={styles.plateVessel} aria-hidden="true">
                        <i />
                      </span>
                    </div>
                  )}
                </>
              )}

              {gamePhase === "result" && outcome && (
                <div
                  className={`${styles.resultScene} ${
                    styles[`outcome${outcome.kind[0].toUpperCase()}${outcome.kind.slice(1)}`]
                  }`}
                  data-outcome={outcome.kind}
                >
                  <div className={styles.resultAura} aria-hidden="true" />
                  <div className={styles.resultPlate}>
                    <img src={ASSETS.plate} alt="" draggable={false} />
                    <div className={styles.resultFood}>
                      <TomatoChunks
                        small
                        cookState={resultTomatoBand}
                        cookProgress={1}
                      />
                      <EggCurds small />
                      <ScallionBits />
                    </div>
                  </div>
                  <div className={styles.resultCopy}>
                    <span>{outcome.kicker}</span>
                    <h2>{outcome.title}</h2>
                    <div
                      className={styles.resultStars}
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

              {gamePhase !== "result" && (
                <div className={styles.stageNotice} aria-live="polite">
                  {notice}
                </div>
              )}
            </div>
          </div>

          {gamePhase !== "result" && (
            <div className={styles.inventory} data-ingredient-tray>
              <div>
                <span className={styles.inventoryLabel}>食材台</span>
                <p>
                  {gamePhase === "prep"
                    ? "先完成切块、打散、备葱"
                    : gamePhase === "heat"
                      ? "热锅倒油后再下蛋液"
                      : "只拖当前步骤需要的食材"}
                </p>
              </div>
              <div className={styles.inventoryItems}>
                {tomatoPlacement === "tray" && (
                  <IngredientCard
                    id="tomato"
                    label="番茄"
                    image={ASSETS.tomato}
                    onPointerDown={(event) => beginDrag(event, "tomato")}
                    onPointerMove={moveDrag}
                    onPointerUp={(event) => endDrag(event, "tomato")}
                    onPointerCancel={cancelDrag}
                    onKeyboardPlace={() => keyboardPlace("tomato")}
                  />
                )}
                {eggPlacement === "tray" && (
                  <IngredientCard
                    id="egg"
                    label="鸡蛋"
                    image={ASSETS.egg}
                    onPointerDown={(event) => beginDrag(event, "egg")}
                    onPointerMove={moveDrag}
                    onPointerUp={(event) => endDrag(event, "egg")}
                    onPointerCancel={cancelDrag}
                    onKeyboardPlace={() => keyboardPlace("egg")}
                  />
                )}
                {gamePhase === "finish" && bothInWok && salt !== null && (
                  <IngredientCard
                    id="dish"
                    label="番茄炒蛋"
                    onPointerDown={(event) => beginDrag(event, "dish")}
                    onPointerMove={moveDrag}
                    onPointerUp={(event) => endDrag(event, "dish")}
                    onPointerCancel={cancelDrag}
                    onKeyboardPlace={() => keyboardPlace("dish")}
                  >
                    <span className={styles.dishPreview}>
                      <TomatoChunks
                        small
                        cookState={tomatoBand}
                        cookProgress={tomatoVisualProgress}
                      />
                      <EggCurds small />
                    </span>
                  </IngredientCard>
                )}
                {prepComplete &&
                  eggPlacement !== "tray" &&
                  tomatoPlacement !== "tray" &&
                  gamePhase === "heat" && (
                    <span className={styles.inventoryEmpty}>
                      <Check size={17} />
                      备料完成
                    </span>
                  )}
              </div>
            </div>
          )}
        </section>

        <aside className={styles.sideColumn}>
          <section className={styles.characterPanel}>
            <div className={styles.characterBackdrop} aria-hidden="true" />
            <div
              className={styles.characterPortrait}
              data-character-mood={isDejected ? "dejected" : "normal"}
            >
              <img
                className={`${styles.character} ${
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
            <div className={styles.dialogue}>
              <div className={styles.speaker}>
                <strong>夏弥</strong>
                <span data-voice-line={activeVoiceLineId}>
                  {outcome ? "复盘" : "关键提示"}
                </span>
                <div className={styles.voiceControls}>
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
                      className={styles.replayVoice}
                      data-voice-replay
                      data-voice-play={
                        voiceNeedsGesture ? "true" : undefined
                      }
                      aria-label={
                        voiceNeedsGesture
                          ? "点击播放夏弥提示"
                          : "重听夏弥提示"
                      }
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

          <section className={styles.controlPanel}>
            {gamePhase === "prep" && (
              <>
                <div className={styles.panelHeading}>
                  <span>步骤 1 · 切块 / 打散 / 备葱</span>
                  <h2>只做一次有效动作</h2>
                </div>
                <div className={styles.checkList}>
                  <span className={tomatoPlacement !== "tray" ? styles.done : ""}>
                    <i>{tomatoPlacement !== "tray" ? <Check size={13} /> : "1"}</i>
                    番茄放到砧板
                  </span>
                  <span className={cutDone ? styles.done : ""}>
                    <i>{cutDone ? <Check size={13} /> : "2"}</i>
                    滑动一次切成番茄块
                  </span>
                  <span className={eggPlacement !== "tray" ? styles.done : ""}>
                    <i>{eggPlacement !== "tray" ? <Check size={13} /> : "3"}</i>
                    鸡蛋打入碗中
                  </span>
                  <span className={whiskDone ? styles.done : ""}>
                    <i>{whiskDone ? <Check size={13} /> : "4"}</i>
                    划一次圈打成蛋液
                  </span>
                </div>
                <button
                  type="button"
                  className={`${styles.secondaryAction} ${
                    scallionReady ? styles.actionComplete : ""
                  }`}
                  data-prepare-scallion
                  disabled={scallionReady}
                  onClick={prepareScallion}
                >
                  {scallionReady ? <Check size={16} /> : <span>葱</span>}
                  {scallionReady ? "葱花已备好" : "切好葱花"}
                </button>
              </>
            )}

            {(gamePhase === "heat" ||
              gamePhase === "egg" ||
              gamePhase === "tomato") && (
              <>
                <div className={styles.panelHeading}>
                  <span>
                    {gamePhase === "egg"
                      ? "步骤 2 · 热锅倒油炒蛋"
                      : gamePhase === "tomato"
                        ? "步骤 3 · 番茄炒出沙"
                        : "步骤 2 · 热锅倒油"}
                  </span>
                  <h2>
                    {gamePhase === "tomato"
                      ? "少量糖收顺酸味，等番茄出沙"
                      : "中火更稳，大火更快"}
                  </h2>
                </div>
                <div className={styles.heatButtons}>
                  <button
                    type="button"
                    className={heat === "medium" ? styles.heatSelected : ""}
                    data-heat="medium"
                    onClick={() => chooseHeat("medium")}
                  >
                    <span className={styles.flameIcon}>
                      <Flame size={20} />
                    </span>
                    <strong>中火</strong>
                    <small>蛋嫩、番茄均匀出沙</small>
                  </button>
                  <button
                    type="button"
                    className={heat === "high" ? styles.heatSelected : ""}
                    data-heat="high"
                    onClick={() => chooseHeat("high")}
                  >
                    <span className={`${styles.flameIcon} ${styles.flameIconHigh}`}>
                      <Flame size={24} />
                    </span>
                    <strong>大火</strong>
                    <small>速度快，更容易炒老</small>
                  </button>
                </div>

                {!oilAdded && gamePhase !== "heat" && (
                  <button
                    type="button"
                    className={styles.oilAction}
                    data-add-oil
                    onClick={addOil}
                  >
                    <Droplets size={19} />
                    <span>
                      倒入食用油
                      <small>沿锅边一圈，避免干锅下蛋</small>
                    </span>
                  </button>
                )}

                {gamePhase === "heat" && oilAdded && (
                  <p className={styles.inlineHint}>
                    油已经下锅。先选火力，再进入炒蛋。
                  </p>
                )}

                {gamePhase === "egg" && (
                  <>
                    {eggPlacement === "wok" && (
                      <CookReadout
                        label="鸡蛋"
                        timeMs={stageTime}
                        band={eggBand}
                        window={stageWindow}
                      />
                    )}
                    <button
                      type="button"
                      className={styles.primaryAction}
                      data-reserve-egg
                      disabled={eggPlacement !== "wok" || eggCookMs < 600}
                      onClick={reserveEgg}
                    >
                      <Check size={18} />
                      划散鸡蛋并盛出
                    </button>
                  </>
                )}

                {gamePhase === "tomato" && (
                  <>
                    <div className={styles.seasoning}>
                      <AmountSelector
                        label="糖"
                        value={sugar}
                        dataKey="sugar"
                        onChange={setSugar}
                        options={[
                          { value: 0, label: "少量" },
                          { value: 2, label: "偏多" },
                        ]}
                      />
                    </div>
                    {tomatoPlacement === "wok" && (
                      <CookReadout
                        label="番茄"
                        timeMs={stageTime}
                        band={tomatoBand}
                        window={stageWindow}
                      />
                    )}
                    <button
                      type="button"
                      className={styles.primaryAction}
                      data-return-egg
                      disabled={
                        tomatoPlacement !== "wok" ||
                        sugar === null ||
                        tomatoCookMs < 600
                      }
                      onClick={returnEgg}
                    >
                      <Check size={18} />
                      番茄出沙，倒回鸡蛋
                    </button>
                  </>
                )}
              </>
            )}

            {gamePhase === "finish" && (
              <>
                <div className={styles.panelHeading}>
                  <span>步骤 4 · 加盐 / 翻匀 / 撒葱花</span>
                  <h2>混合翻匀即可，不需要久炒</h2>
                </div>
                <div className={styles.seasoning}>
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
                <p className={styles.manualHint}>
                  <MoveHorizontal size={16} />
                  可沿锅面滑一次翻匀；葱花已经准备在锅里。
                </p>
                <button
                  type="button"
                  className={styles.primaryAction}
                  data-finish-dish
                  disabled={!canPlate}
                  onClick={finishDish}
                >
                  <Check size={18} />
                  装盘并接受评价
                </button>
              </>
            )}

            {gamePhase === "result" && outcome && (
              <>
                <div className={styles.panelHeading}>
                  <span>四步复盘</span>
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
                    <strong>番茄炒蛋已经装盘</strong>
                  </span>
                  <Check size={16} />
                </div>
                <div className={styles.metricList}>
                  {[
                    ["调味", outcome.metrics.flavor],
                    ["鸡蛋", outcome.metrics.eggDoneness],
                    ["番茄", outcome.metrics.tomatoDoneness],
                    ["翻匀", outcome.metrics.texture],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <i><b style={{ width: `${value}%` }} /></i>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
                <div className={styles.resultActions}>
                  <button type="button" onClick={reset} data-restart-game>
                    <RotateCcw size={17} />
                    再做一盘
                  </button>
                  <Link href="/cook/story/">
                    <ArrowLeft size={17} />
                    返回剧场
                  </Link>
                </div>
              </>
            )}
          </section>
        </aside>
      </div>

      {drag && (
        <div
          className={styles.dragGhost}
          data-drag-ghost={drag.id}
          style={{ left: drag.x, top: drag.y } as CSSProperties}
        >
          {drag.id === "dish" ? (
            <span className={styles.dishPreview}>
              <TomatoChunks
                small
                cookState={tomatoBand}
                cookProgress={tomatoVisualProgress}
              />
              <EggCurds small />
            </span>
          ) : drag.id === "tomato" ? (
            <TomatoChunks small />
          ) : (
            <EggLiquid small />
          )}
        </div>
      )}
    </div>
  );
}

function CookReadout({
  label,
  timeMs,
  band,
  window,
}: {
  label: string;
  timeMs: number;
  band: "raw" | "ready" | "over" | "burnt";
  window: { readyMinMs: number; readyMaxMs: number; burnAtMs: number };
}) {
  return (
    <div className={styles.liveReadout}>
      <span>
        <Timer size={16} />
        {label}受热 {(timeMs / 1000).toFixed(1)}s
      </span>
      <strong data-cook-band={band}>
        {
          {
            raw: "尚未定型",
            ready: "最佳窗口",
            over: "正在变老",
            burnt: "已经焦化",
          }[band]
        }
      </strong>
      <div className={styles.cookMeter}>
        <span
          className={styles.cookMeterFill}
          style={{ width: `${Math.min(100, (timeMs / window.burnAtMs) * 100)}%` }}
        />
        <i
          className={styles.readyBand}
          style={{
            left: `${(window.readyMinMs / window.burnAtMs) * 100}%`,
            width: `${((window.readyMaxMs - window.readyMinMs) / window.burnAtMs) * 100}%`,
          }}
        />
      </div>
    </div>
  );
}
