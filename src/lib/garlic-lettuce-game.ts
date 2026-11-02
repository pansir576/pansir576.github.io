import type { GarlicLettuceVoiceLineId } from "@/lib/garlic-lettuce-dialogue";
import { XIAMI_GARLIC_LETTUCE_DIALOGUE } from "@/lib/garlic-lettuce-dialogue";

export type GarlicHeatLevel = "medium" | "high";
export type GarlicGreensBand = "raw" | "ready" | "over" | "burnt";
export type GarlicLettuceOutcomeKind =
  | "burnt-garlic"
  | "weak-garlic"
  | "raw-greens"
  | "over-greens"
  | "salty"
  | "bland"
  | "perfect";
export type SaltLevel = 0 | 1 | 2;

export interface GarlicHeatProfile {
  label: string;
  heatLabel: string;
  garlic: { readyMinMs: number; readyMaxMs: number; burnAtMs: number };
  greens: { readyMinMs: number; readyMaxMs: number; burnAtMs: number };
}

export interface GarlicLettuceSignals {
  heat: GarlicHeatLevel;
  garlicCookMs: number;
  greensCookMs: number;
  stirCount: number;
  salt: SaltLevel;
}

export interface GarlicLettuceOutcome {
  kind: GarlicLettuceOutcomeKind;
  voiceLineId: GarlicLettuceVoiceLineId;
  title: string;
  kicker: string;
  dialogue: string;
  explanation: string;
  stars: 1 | 2 | 3;
  score: number;
  metrics: {
    seasoning: number;
    garlicAroma: number;
    greensTexture: number;
    stir: number;
  };
}

export const GARLIC_HEAT_PROFILES: Record<
  GarlicHeatLevel,
  GarlicHeatProfile
> = {
  medium: {
    label: "中火",
    heatLabel: "稳住蒜香",
    garlic: { readyMinMs: 900, readyMaxMs: 2_800, burnAtMs: 5_200 },
    greens: { readyMinMs: 3_200, readyMaxMs: 6_200, burnAtMs: 8_500 },
  },
  high: {
    label: "大火",
    heatLabel: "快速断生",
    garlic: { readyMinMs: 500, readyMaxMs: 2_200, burnAtMs: 4_000 },
    greens: { readyMinMs: 2_200, readyMaxMs: 4_800, burnAtMs: 7_000 },
  },
};

export function garlicCookingBand(
  heat: GarlicHeatLevel,
  cookMs: number,
): GarlicGreensBand {
  const window = GARLIC_HEAT_PROFILES[heat].garlic;
  if (cookMs >= window.burnAtMs) return "burnt";
  if (cookMs < window.readyMinMs) return "raw";
  if (cookMs <= window.readyMaxMs) return "ready";
  return "over";
}

export function greensCookingBand(
  heat: GarlicHeatLevel,
  cookMs: number,
): GarlicGreensBand {
  const window = GARLIC_HEAT_PROFILES[heat].greens;
  if (cookMs >= window.burnAtMs) return "burnt";
  if (cookMs < window.readyMinMs) return "raw";
  if (cookMs <= window.readyMaxMs) return "ready";
  return "over";
}

function garlicScore(heat: GarlicHeatLevel, cookMs: number) {
  const window = GARLIC_HEAT_PROFILES[heat].garlic;
  if (cookMs >= window.burnAtMs) return 0;
  if (cookMs < window.readyMinMs) {
    return Math.round((cookMs / window.readyMinMs) * 52);
  }
  if (cookMs <= window.readyMaxMs) {
    const center = (window.readyMinMs + window.readyMaxMs) / 2;
    const half = (window.readyMaxMs - window.readyMinMs) / 2;
    return Math.round(100 - (Math.abs(cookMs - center) / half) * 8);
  }
  const overProgress =
    (cookMs - window.readyMaxMs) /
    (window.burnAtMs - window.readyMaxMs);
  return Math.round(90 - overProgress * 90);
}

function greensScore(heat: GarlicHeatLevel, cookMs: number) {
  const window = GARLIC_HEAT_PROFILES[heat].greens;
  if (cookMs >= window.burnAtMs) return 0;
  if (cookMs < window.readyMinMs) {
    return Math.round((cookMs / window.readyMinMs) * 48);
  }
  if (cookMs <= window.readyMaxMs) {
    const center = (window.readyMinMs + window.readyMaxMs) / 2;
    const half = (window.readyMaxMs - window.readyMinMs) / 2;
    return Math.round(100 - (Math.abs(cookMs - center) / half) * 9);
  }
  const overProgress =
    (cookMs - window.readyMaxMs) /
    (window.burnAtMs - window.readyMaxMs);
  return Math.round(88 - overProgress * 68);
}

function stirScore(stirCount: number) {
  if (stirCount <= 0) return 35;
  if (stirCount <= 3) return 96 + Math.min(4, stirCount - 1);
  if (stirCount <= 8) return 88 - (stirCount - 3) * 5;
  return Math.max(45, 62 - (stirCount - 8) * 1.5);
}

function seasoningScore(salt: SaltLevel) {
  return salt === 1 ? 100 : salt === 2 ? 42 : 55;
}

function starsFor(
  score: number,
  kind: GarlicLettuceOutcomeKind,
): 1 | 2 | 3 {
  if (kind !== "perfect") return score >= 70 ? 2 : 1;
  if (score >= 84) return 3;
  if (score >= 68) return 2;
  return 1;
}

export function evaluateGarlicLettuce(
  signals: GarlicLettuceSignals,
): GarlicLettuceOutcome {
  const garlic = garlicScore(signals.heat, signals.garlicCookMs);
  const greens = greensScore(signals.heat, signals.greensCookMs);
  const stir = Math.round(stirScore(signals.stirCount));
  const seasoning = seasoningScore(signals.salt);
  const score = Math.round(
    garlic * 0.32 + greens * 0.35 + stir * 0.13 + seasoning * 0.2,
  );
  const currentGreensBand = greensCookingBand(
    signals.heat,
    signals.greensCookMs,
  );
  const garlicWindow = GARLIC_HEAT_PROFILES[signals.heat].garlic;

  let kind: GarlicLettuceOutcomeKind;
  if (signals.garlicCookMs >= garlicWindow.burnAtMs) {
    kind = "burnt-garlic";
  } else if (signals.garlicCookMs < garlicWindow.readyMinMs) {
    kind = "weak-garlic";
  } else if (
    currentGreensBand === "raw" ||
    currentGreensBand === "burnt"
  ) {
    kind =
      currentGreensBand === "raw" ? "raw-greens" : "over-greens";
  } else if (currentGreensBand === "over") {
    kind = "over-greens";
  } else if (signals.salt === 2) {
    kind = "salty";
  } else if (signals.salt === 0) {
    kind = "bland";
  } else {
    kind = "perfect";
  }

  const base = {
    kind,
    stars: starsFor(score, kind),
    score,
    metrics: {
      seasoning,
      garlicAroma: garlic,
      greensTexture: greens,
      stir,
    },
  };

  if (kind === "burnt-garlic") {
    return {
      ...base,
      voiceLineId: "garlic-outcome-burnt-garlic",
      title: "蒜香变成了焦苦",
      kicker: "火候警报 · 蒜末焦化",
      dialogue: XIAMI_GARLIC_LETTUCE_DIALOGUE["garlic-outcome-burnt-garlic"],
      explanation:
        "蒜末颗粒小，接触热油后升温很快。颜色从浅金变深褐时，香气已经开始转成苦味，必须重新起锅。",
    };
  }

  if (kind === "weak-garlic") {
    return {
      ...base,
      voiceLineId: "garlic-outcome-weak-garlic",
      title: "菜嫩，但蒜香没醒",
      kicker: "香气不足 · 底味偏弱",
      dialogue: XIAMI_GARLIC_LETTUCE_DIALOGUE["garlic-outcome-weak-garlic"],
      explanation:
        "蒜末需要短暂受热，让含硫香气物质释放。油温不足或停留时间太短，蒜香没有建立，整道菜会显得空。",
    };
  }

  if (kind === "raw-greens") {
    return {
      ...base,
      voiceLineId: "garlic-outcome-raw-greens",
      title: "颜色在，口感还没到",
      kicker: "断生不足 · 叶梗偏硬",
      dialogue: XIAMI_GARLIC_LETTUCE_DIALOGUE["garlic-outcome-raw-greens"],
      explanation:
        "叶菜需要足够受热让细胞壁软化。叶片刚塌、菜梗仍脆是断生；完全生硬则涩味和青草味会明显。",
    };
  }

  if (kind === "over-greens") {
    return {
      ...base,
      voiceLineId: "garlic-outcome-over-greens",
      title: "绿意被炒没了",
      kicker: "加热过度 · 发黄软塌",
      dialogue: XIAMI_GARLIC_LETTUCE_DIALOGUE["garlic-outcome-over-greens"],
      explanation:
        "叶绿素和维生素 C 都不耐长时间高温。油麦菜失水、变黄、完全软塌后再出锅，脆嫩感已经无法恢复。",
    };
  }

  if (kind === "salty") {
    return {
      ...base,
      voiceLineId: "garlic-outcome-salty",
      title: "盐压住了蒜香",
      kicker: "调味偏差 · 偏咸",
      dialogue: XIAMI_GARLIC_LETTUCE_DIALOGUE["garlic-outcome-salty"],
      explanation:
        "叶菜体积大、含水量高，表面容易吸附盐。盐过量会遮盖清甜，也让刚建立的蒜香显得刺口。",
    };
  }

  if (kind === "bland") {
    return {
      ...base,
      voiceLineId: "garlic-outcome-bland",
      title: "香气有，味道没落地",
      kicker: "调味偏差 · 偏淡",
      dialogue: XIAMI_GARLIC_LETTUCE_DIALOGUE["garlic-outcome-bland"],
      explanation:
        "少量盐能托住叶菜的清甜与蒜香。完全不放盐时，水分感和青味会更突出，味道显得散。",
    };
  }

  return {
    ...base,
    voiceLineId: "garlic-outcome-perfect",
    title: "快、准，正是叶菜的火候",
    kicker: "完美出锅 · 蒜香断生",
    dialogue: XIAMI_GARLIC_LETTUCE_DIALOGUE["garlic-outcome-perfect"],
    explanation:
      signals.heat === "high"
        ? "大火缩短了叶菜受热时间，而你在蒜末转深前下菜，又在叶片刚断生时收手。"
        : "中火让蒜香更从容地释放，绿叶菜也保住了刚断生的脆嫩与颜色。",
  };
}
