import type { XiamiVoiceLineId } from "@/lib/xiami-voice";
import { XIAMI_TOMATO_EGG_DIALOGUE } from "@/lib/xiami-dialogue";

export type HeatLevel = "medium" | "high";
export type AmountLevel = 0 | 1 | 2;
export type CookingBand = "raw" | "ready" | "over" | "burnt";
export type CookingItem = "egg" | "tomato";

export type TomatoEggOutcomeKind =
  | "burnt"
  | "raw"
  | "salty"
  | "bland"
  | "perfect";

export interface HeatProfile {
  label: string;
  heatLabel: string;
  egg: { readyMinMs: number; readyMaxMs: number; burnAtMs: number };
  tomato: { readyMinMs: number; readyMaxMs: number; burnAtMs: number };
}

export interface TomatoEggSignals {
  heat: HeatLevel;
  eggCookMs: number;
  tomatoCookMs: number;
  stirCount: number;
  salt: AmountLevel;
  sugar: AmountLevel;
}

export interface TomatoEggOutcome {
  kind: TomatoEggOutcomeKind;
  voiceLineId: XiamiVoiceLineId;
  title: string;
  kicker: string;
  dialogue: string;
  explanation: string;
  stars: 1 | 2 | 3;
  score: number;
  metrics: {
    flavor: number;
    eggDoneness: number;
    tomatoDoneness: number;
    texture: number;
  };
}

export const HEAT_PROFILES: Record<HeatLevel, HeatProfile> = {
  medium: {
    label: "中火",
    heatLabel: "稳定出沙",
    egg: { readyMinMs: 3_400, readyMaxMs: 5_600, burnAtMs: 7_600 },
    tomato: { readyMinMs: 4_300, readyMaxMs: 7_000, burnAtMs: 9_000 },
  },
  high: {
    label: "大火",
    heatLabel: "快速收紧",
    egg: { readyMinMs: 1_900, readyMaxMs: 3_300, burnAtMs: 5_000 },
    tomato: { readyMinMs: 2_700, readyMaxMs: 4_600, burnAtMs: 6_500 },
  },
};

function itemWindow(heat: HeatLevel, item: CookingItem) {
  return HEAT_PROFILES[heat][item];
}

export function cookingBand(
  heat: HeatLevel,
  cookMs: number,
  item: CookingItem,
): CookingBand {
  const window = itemWindow(heat, item);
  if (cookMs >= window.burnAtMs) return "burnt";
  if (cookMs < window.readyMinMs) return "raw";
  if (cookMs <= window.readyMaxMs) return "ready";
  return "over";
}

function donenessScore(
  heat: HeatLevel,
  cookMs: number,
  item: CookingItem,
) {
  const window = itemWindow(heat, item);
  if (cookMs < window.readyMinMs) {
    return Math.round((cookMs / window.readyMinMs) * 55);
  }
  if (cookMs <= window.readyMaxMs) {
    const center = (window.readyMinMs + window.readyMaxMs) / 2;
    const halfWindow = (window.readyMaxMs - window.readyMinMs) / 2;
    return Math.round(100 - (Math.abs(cookMs - center) / halfWindow) * 7);
  }
  if (cookMs < window.burnAtMs) {
    const lateProgress =
      (cookMs - window.readyMaxMs) /
      (window.burnAtMs - window.readyMaxMs);
    return Math.round(90 - lateProgress * 45);
  }
  return 0;
}

function textureScore(stirCount: number) {
  if (stirCount < 2) return 48 + stirCount * 14;
  if (stirCount <= 8) return 92 + Math.min(8, stirCount - 2);
  if (stirCount <= 14) return 96 - (stirCount - 8) * 5;
  return Math.max(45, 66 - (stirCount - 14) * 2);
}

function flavorScore(salt: AmountLevel, sugar: AmountLevel) {
  if (salt === 1) return sugar === 0 ? 100 : sugar === 1 ? 96 : 68;
  if (salt === 2) return sugar === 2 ? 34 : 44;
  return sugar === 2 ? 45 : 58;
}

function starsFor(score: number, outcome: TomatoEggOutcomeKind): 1 | 2 | 3 {
  if (outcome !== "perfect") return score >= 70 ? 2 : 1;
  if (score >= 84) return 3;
  if (score >= 68) return 2;
  return 1;
}

export function evaluateTomatoEgg(
  signals: TomatoEggSignals,
): TomatoEggOutcome {
  const eggScore = donenessScore(signals.heat, signals.eggCookMs, "egg");
  const tomatoScore = donenessScore(
    signals.heat,
    signals.tomatoCookMs,
    "tomato",
  );
  const doneness = Math.round(eggScore * 0.55 + tomatoScore * 0.45);
  const flavor = flavorScore(signals.salt, signals.sugar);
  const texture = textureScore(signals.stirCount);
  const score = Math.round(
    flavor * 0.32 + doneness * 0.48 + texture * 0.2,
  );
  const eggBand = cookingBand(signals.heat, signals.eggCookMs, "egg");
  const tomatoBand = cookingBand(
    signals.heat,
    signals.tomatoCookMs,
    "tomato",
  );

  let kind: TomatoEggOutcomeKind;
  if (eggBand === "burnt" || tomatoBand === "burnt") {
    kind = "burnt";
  } else if (eggBand === "raw" || tomatoBand === "raw") {
    kind = "raw";
  } else if (signals.salt === 2) {
    kind = "salty";
  } else if (signals.salt === 0) {
    kind = "bland";
  } else {
    kind = "perfect";
  }

  const stars = starsFor(score, kind);
  const metrics = {
    flavor,
    eggDoneness: eggScore,
    tomatoDoneness: tomatoScore,
    texture,
  };

  if (kind === "burnt") {
    const burntItem = eggBand === "burnt" ? "鸡蛋" : "番茄";
    const voiceLineId =
      burntItem === "鸡蛋"
        ? "outcome-burnt-egg"
        : "outcome-burnt-tomato";
    return {
      kind,
      voiceLineId,
      title: "这次真的炒糊了",
      kicker: "火候警报 · 焦化",
      dialogue: XIAMI_TOMATO_EGG_DIALOGUE[voiceLineId],
      explanation: `${burntItem}超过当前火力可承受的时间，糖和蛋白质发生焦化。下次要么早点盛出，要么把火力降下来。`,
      stars,
      score,
      metrics,
    };
  }

  if (kind === "raw") {
    const voiceLineId =
      eggBand === "raw"
        ? "outcome-raw-egg"
        : "outcome-raw-tomato";
    return {
      kind,
      voiceLineId,
      title: "流程走完了，火候还没到",
      kicker: "火候不足 · 夹生",
      dialogue: XIAMI_TOMATO_EGG_DIALOGUE[voiceLineId],
      explanation:
        "鸡蛋需要足够受热才能形成稳定蛋絮，番茄也需要时间让果胶破裂、水分释放。提前进入下一阶段会留下夹生或生涩感。",
      stars,
      score,
      metrics,
    };
  }

  if (kind === "salty") {
    return {
      kind,
      voiceLineId: "outcome-salty",
      title: "盐把番茄的酸甜压住了",
      kicker: "调味偏差 · 偏咸",
      dialogue: XIAMI_TOMATO_EGG_DIALOGUE["outcome-salty"],
      explanation:
        "这道菜有番茄的有机酸和少量糖，盐过量会把酸甜层次压平，也让鸡蛋显得更干。",
      stars,
      score,
      metrics,
    };
  }

  if (kind === "bland") {
    return {
      kind,
      voiceLineId: "outcome-bland",
      title: "步骤齐了，味道还没连起来",
      kicker: "调味偏差 · 偏淡",
      dialogue: XIAMI_TOMATO_EGG_DIALOGUE["outcome-bland"],
      explanation:
        "少量盐能提番茄甜感、托住鸡蛋香气。完全不放盐时，整道菜会显得水、平。",
      stars,
      score,
      metrics,
    };
  }

  return {
    kind,
    voiceLineId: "outcome-perfect",
    title: "四步都落在点上",
    kicker: "完美出锅 · 蛋嫩番茄出沙",
    dialogue: XIAMI_TOMATO_EGG_DIALOGUE["outcome-perfect"],
    explanation:
      signals.heat === "high"
        ? "大火减少了水汽拖沓，但你在鸡蛋变老、番茄焦化前分别接住了它们。"
        : "中火让鸡蛋和番茄都均匀受热，你有足够时间观察到蛋液凝固和番茄出沙。",
    stars,
    score,
    metrics,
  };
}
