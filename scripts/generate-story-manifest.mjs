import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const recipes = JSON.parse(
  await readFile(path.join(root, "src", "lib", "recipe-data.json"), "utf8"),
);

const states = ["normal", "click", "success", "error"];
const hotspotPrompts = {
  fridge: "冰箱前的",
  sink: "清洗池中的",
  cutting_board: "砧板上的",
  stove: "锅中的",
  seasoning: "调料架上的",
  plate: "盘中的",
};

function inferHotspot(step, stepIndex) {
  const text = `${step.title} ${step.description} ${step.actionLabel}`;
  if (/装盘|摆盘|出锅/.test(text)) return "plate";
  if (/蘸汁/.test(step.title)) return "plate";
  if (/调成[^，。；]*汁|准备[^，。；]*调料/.test(text)) {
    return "seasoning";
  }
  if (/腌制|上浆/.test(step.title)) return "seasoning";
  if (/清洗|洗净|冲洗|泡水|浸泡|淘洗|焯水|控水/.test(text)) {
    return "sink";
  }
  if (/锅|油|炒|煎|炸|炖|煮|蒸|烧|焖|爆香|翻匀|收汁|火候|加热/.test(text)) {
    return "stove";
  }
  const seasoningAction = /调味|加|放|调入|撒|腌制|拌|勾芡/.test(text);
  const seasoningTerm =
    /食盐|盐|白糖|糖|醋|生抽|老抽|豆瓣|料酒|花椒|八角|水淀粉/.test(text);
  if (seasoningAction && seasoningTerm) return "seasoning";
  if (/切|剁|拍|打散|去皮|备料|改刀|切配/.test(text)) {
    return "cutting_board";
  }
  return ["cutting_board", "stove", "seasoning", "sink"][
    stepIndex % 4
  ];
}

function compactAction(step) {
  const title = step.title.trim();
  if (!/^步骤\s*\d+$/.test(title)) return title;
  const firstClause = step.description
    .split(/[，。；]/)[0]
    .trim()
    .replace(/^(将|把|在|用)/, "");
  return firstClause || step.description;
}

function objectNamesForStep(recipe, step, hotspot) {
  if (hotspot === "plate") return [recipe.name];
  const text = `${step.title} ${step.description}`;
  const aliases = {
    食盐: ["盐"],
    白糖: ["糖"],
    白醋: ["醋"],
    大蒜: ["蒜"],
    小葱: ["葱", "葱花"],
    胡椒粉: ["胡椒"],
    淀粉: ["水淀粉"],
    生抽: ["酱油"],
  };
  const matched = ["main", "supporting", "seasoning"].flatMap((role) =>
    recipe.ingredients.filter((ingredient) => {
      if (ingredient.role !== role) return false;
      const names = [ingredient.name, ...(aliases[ingredient.name] ?? [])];
      return names.some((name) => text.includes(name));
    }),
  );
  const unique = [...new Set(matched.map((ingredient) => ingredient.name))];
  if (unique.length > 0) return unique.slice(0, 2);
  const fallback =
    recipe.ingredients.find((ingredient) => ingredient.role === "main") ??
    recipe.ingredients[0];
  return [fallback?.name ?? recipe.name];
}

function buildObject(recipe, step, hotspot) {
  const label = objectNamesForStep(recipe, step, hotspot).join("、");
  const action = compactAction(step);
  return {
    label,
    action,
    prompt: `点击${hotspotPrompts[hotspot]}${label}，${action}`,
  };
}

function buildQuestion(step) {
  const group = step.variableGroups[0];
  if (!group) return null;
  const options = group.options.slice(0, 3).map((option) => ({
    id: option.id,
    label: option.label,
  }));
  const correct = options.find(
    (option) => option.id === group.defaultOptionId,
  );
  if (!correct) {
    const fallback = group.options.find(
      (option) => option.id === group.defaultOptionId,
    );
    options[0] = { id: fallback.id, label: fallback.label };
  }
  return {
    text: `${group.label}怎么做更稳妥？`,
    options,
    correctOptionId: group.defaultOptionId,
  };
}

const storyRecipes = recipes.map((recipe) => {
  const questionStep = recipe.steps.find(
    (step) => step.variableGroups.length > 0,
  );
  return {
    id: recipe.id,
    name: recipe.name,
    category: recipe.category,
    summary: recipe.summary,
    steps: recipe.steps.map((step, stepIndex) => {
      const stateStem = `recipe_${recipe.id}_step_${step.stepId}`;
      const hotspot = inferHotspot(step, stepIndex);
      return {
        recipeId: recipe.id,
        stepId: step.stepId,
        hotspot,
        title: step.title,
        description: step.description,
        knowledge: step.knowledge,
        actionLabel: step.actionLabel,
        correctText: `这一步完成了。${step.knowledge}`,
        errorOperation: `重新执行本步：${step.description}`,
        errorPrinciple: step.knowledge || step.aiWarning,
        object: buildObject(recipe, step, hotspot),
        states: Object.fromEntries(
          states.map((state) => [
            state,
            `assets/food_state/state_food_${stateStem}_${state}.png`,
          ]),
        ),
        question: step.stepId === questionStep?.stepId
          ? buildQuestion(step)
          : null,
      };
    }),
  };
});

const manifest = {
  size: [512, 512],
  format: "PNG",
  background: "transparent",
  states,
  recipes: storyRecipes,
};

await writeFile(
  path.join(root, "assets", "story_state_manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

console.log(
  JSON.stringify(
    {
      recipes: storyRecipes.length,
      steps: storyRecipes.reduce((sum, recipe) => sum + recipe.steps.length, 0),
      questions: storyRecipes.reduce(
        (sum, recipe) =>
          sum + recipe.steps.filter((step) => step.question).length,
        0,
      ),
    },
    null,
    2,
  ),
);
