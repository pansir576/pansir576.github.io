import { getIngredient } from "./ingredients";
import type {
  IngredientArchetype,
  KitchenAction,
  KitchenTask,
  KitchenWorkspace,
} from "./types";

const cutOperations: Record<IngredientArchetype, string[]> = {
  leafy: ["greens-tear", "archetype-leaf-tear", "cut-small", "cut-large"],
  melon: ["cut-small", "cut-large", "archetype-melon-crush"],
  root: ["cut-small", "cut-large", "potato-cut-shred", "potato-cut-chunk"],
  mushroom: ["cut-small", "cut-large"],
  "soy-product": ["cut-small", "cut-large", "tofu-press"],
  "red-meat": ["archetype-meat-slice", "beef-slice-cross", "beef-slice-along"],
  poultry: ["archetype-meat-slice"],
  seafood: ["archetype-seafood-score", "fish-score"],
  egg: ["egg-beat-thorough", "egg-beat-light"],
  staple: ["cut-small", "archetype-staple-rinse"],
};

const dryOperations: Record<IngredientArchetype, string[]> = {
  leafy: ["greens-dry-well", "archetype-leaf-dry", "surface-dry"],
  melon: ["archetype-melon-dry", "surface-dry"],
  root: ["archetype-root-dry", "surface-dry"],
  mushroom: ["archetype-mushroom-squeeze", "surface-dry"],
  "soy-product": ["tofu-press", "archetype-soy-press", "surface-dry"],
  "red-meat": ["surface-dry", "beef-temper"],
  poultry: ["archetype-poultry-dry", "surface-dry"],
  seafood: ["fish-dry", "archetype-seafood-dry", "surface-dry"],
  egg: ["egg-residual-heat"],
  staple: ["archetype-staple-dry", "surface-dry"],
};

const cutLabels: Record<IngredientArchetype, [string, string]> = {
  leafy: ["切配叶片", "按目标手撕或切段，增加受热面积。"],
  melon: ["切配处理", "按需要切块、去皮或去籽。"],
  root: ["切配处理", "统一切法，让中心和表面更接近熟度。"],
  mushroom: ["切配处理", "厚菇改刀，薄菇整理即可。"],
  "soy-product": ["切配或压水", "切块或压去多余水分，方便定型。"],
  "red-meat": ["按纹理切配", "缩短纤维或切成合适厚度。"],
  poultry: ["切配或改刀", "让厚处更接近均匀受热。"],
  seafood: ["清理并改刀", "让厚处更快受热，并帮助表层入味。"],
  egg: ["打散蛋液", "让蛋白和蛋黄混合均匀。"],
  staple: ["整理或切配", "按食材状态整理，避免大小差异过大。"],
};

function hasAnyOperation(
  actions: KitchenAction[],
  operationIds: string[],
): boolean {
  return actions.some(
    (action) =>
      (action.type === "operation" &&
        operationIds.includes(action.operationId)) ||
      (action.type === "prep" &&
        (operationIds.includes(action.prepId) ||
          (operationIds.includes("cut-small") &&
            action.prepId === "cut-small") ||
          (operationIds.includes("cut-large") &&
            action.prepId === "cut-large"))),
  );
}

export function planKitchenTasks(
  ingredientId: string,
  actions: KitchenAction[],
  workspace: KitchenWorkspace,
): KitchenTask[] {
  const ingredient = getIngredient(ingredientId);
  const [cutTitle, cutDescription] = cutLabels[ingredient.archetype];
  const cleaned = hasAnyOperation(actions, ["wash", "soak"]);
  const prepared = hasAnyOperation(actions, cutOperations[ingredient.archetype]);
  const dried = hasAnyOperation(actions, dryOperations[ingredient.archetype]);

  const candidates: KitchenTask[] = [
    {
      id: "wash",
      title: "清洗食材",
      description: "先去除表面泥沙，并观察表面水的变化。",
      station: "sink",
      operationId: "wash",
      completed: cleaned,
      active: false,
      optional: ["egg"].includes(ingredient.archetype),
    },
    {
      id: "prepare",
      title: cutTitle,
      description: cutDescription,
      station: "board",
      operationId: cutOperations[ingredient.archetype][0],
      completed: prepared,
      active: false,
    },
    {
      id: "dry",
      title: "控制表面水分",
      description: "表面水越少，后续煎炒越容易升温上色。",
      station: "board",
      operationId: dryOperations[ingredient.archetype][0],
      completed: dried,
      active: false,
      optional: ["egg"].includes(ingredient.archetype),
    },
    {
      id: "pan",
      title: "把食材放进锅里",
      description: "锅为空时不能点火；把食材拖入锅内或点击进入锅中。",
      station: "pan",
      completed: workspace.inPan,
      active: false,
    },
  ];

  const next = candidates.find((task) => !task.completed);
  if (next) next.active = true;
  return candidates;
}

export function activeTask(tasks: KitchenTask[]): KitchenTask | undefined {
  return tasks.find((task) => task.active);
}

export function stationLabel(station: KitchenWorkspace["station"]): string {
  return station === "sink" ? "水槽" : station === "board" ? "砧板" : "炒锅";
}
