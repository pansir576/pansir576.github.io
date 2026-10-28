import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const recipePath = path.join(root, "src", "lib", "recipe-data.json");
const recipes = JSON.parse(await readFile(recipePath, "utf8"));

const extraDurationSteps = new Map([
  [9, 2],
  [10, 3],
  [14, 1],
  [15, 3],
  [16, 2],
  [25, 2],
]);

const safetyDurations = new Map([
  ["8:duration-level-2", "四季豆未彻底加热可能引起食物中毒，必须炒至内部熟透。"],
  ["11:duration-level-2", "牛肉中心未充分受热存在食品安全风险，应延长加热并确认熟度。"],
  ["12:duration-level-2", "牛腩未充分炖熟存在食品安全风险，应继续加热至中心熟透。"],
  ["13:duration-level-2", "猪肉未充分受热存在食品安全风险，应确认中心熟度。"],
  ["13:duration-level-3", "红烧猪肉炖煮不足存在食品安全风险，应延长加热时间。"],
  ["17:duration-level-1", "鱼肉中心未充分受热存在食品安全风险，应蒸至中心熟透。"],
  ["17:duration-level-2", "鱼肉腌制和后续加热时间不足会影响熟度，应执行标准时长。"],
  ["18:duration-level-1", "虾未充分加热存在食品安全风险，应煮至肉质不透明并卷曲。"],
  ["19:duration-level-3", "虾未充分受热存在食品安全风险，应延长加热并确认熟透。"],
  ["22:duration-level-2", "鸡蛋未充分凝固时会保留生蛋风险，应加热至蛋液完全凝固。"],
  ["24:duration-level-1", "排骨未充分加热至熟透存在食品安全风险，应执行标准炖煮时长。"],
]);

const addedSafetyDurations = new Map([
  [9, "猪肉丝未充分受热存在食品安全风险，应炒至中心完全变色熟透。"],
  [10, "猪肉丝未充分受热存在食品安全风险，应延长加热并确认熟度。"],
  [14, "五花肉未煮至熟透再切片会产生食品安全风险，应执行标准时长。"],
  [15, "鸡丁中心未充分受热存在食品安全风险，应炒至完全熟透。"],
  [16, "鸡肉未充分受热存在食品安全风险，应炒至中心不再带生色。"],
  [25, "蛋液未充分凝固存在生蛋风险，应炒至蛋液完全凝固。"],
]);

function durationGroup(stepId, safetyWarning) {
  return {
    id: `duration-level-${stepId}`,
    label: "加热时长",
    kind: "duration",
    defaultOptionId: "medium",
    options: [
      {
        id: "short",
        label: "偏短",
        risk: "safety",
        effect: { duration: -5, safety: -8 },
        simulation: { durationMin: 2 },
        warning: safetyWarning,
      },
      {
        id: "medium",
        label: "适中",
        risk: "none",
        effect: { duration: 3, aroma: 3 },
        simulation: { durationMin: 4 },
      },
      {
        id: "long",
        label: "偏长",
        risk: "quality",
        effect: { duration: 9, water: -4 },
        simulation: { durationMin: 7 },
        warning: "加热时间偏长会让食材失水、变老或失去鲜嫩口感。",
      },
    ],
  };
}

for (const recipe of recipes) {
  const stepId = extraDurationSteps.get(recipe.id);
  if (!stepId || !addedSafetyDurations.has(recipe.id)) continue;
  const step = recipe.steps.find((item) => item.stepId === stepId);
  if (!step) {
    throw new Error(`Missing step ${recipe.id}:${stepId}`);
  }
  const groupId = `duration-level-${stepId}`;
  if (!step.variableGroups.some((group) => group.id === groupId)) {
    step.variableGroups.push(
      durationGroup(stepId, addedSafetyDurations.get(recipe.id)),
    );
  }
  safetyDurations.set(
    `${recipe.id}:${groupId}`,
    addedSafetyDurations.get(recipe.id),
  );
}

for (const recipe of recipes) {
  for (const step of recipe.steps) {
    for (const group of step.variableGroups) {
      const safetyKey = `${recipe.id}:${group.id}`;
      const safetyWarning = safetyDurations.get(safetyKey);
      for (const option of group.options) {
        if (option.id === group.defaultOptionId) {
          option.risk = "none";
        } else if (safetyWarning && /^short(?:-|$)/.test(option.id)) {
          option.risk = "safety";
          option.warning = safetyWarning;
          option.effect.safety = Math.min(option.effect.safety ?? 0, -8);
        } else if (option.warning) {
          option.risk = "quality";
        } else {
          option.risk = "none";
        }
      }
    }
  }
}

await writeFile(recipePath, `${JSON.stringify(recipes, null, 2)}\n`, "utf8");
