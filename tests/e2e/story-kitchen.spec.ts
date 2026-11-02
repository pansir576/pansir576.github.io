import { expect, test, type Page } from "@playwright/test";
import iconManifest from "../../assets/story-kitchen/icon_manifest.json";
import storyManifest from "../../assets/story_state_manifest.json";

type StoryStep = (typeof storyManifest.recipes)[number]["steps"][number];
const toolIds = new Set(iconManifest.tools.map((item) => item.id));

async function startStory(page: Page, recipeId: number) {
  await page.goto(`/cook/story/?recipe=${recipeId}&legacy=1`);
  await expect(page.locator("[data-story-stage]")).toBeVisible();
}

function visibleObjects(step: StoryStep) {
  return step.renderObjects.filter((object) => object.visible);
}

async function assertCurrentRenderObjects(page: Page, step: StoryStep) {
  const objects = visibleObjects(step);
  const hotspot = page.locator(`[data-story-hotspot="${step.hotspot}"]`);
  const stage = page.locator("[data-2d-kitchen]");
  await expect(hotspot).toBeVisible();
  await expect(page.locator("[data-story-object]")).toHaveCount(objects.length);
  if (step.hotspot === "sink" || step.hotspot === "cutting_board") {
    await expect(page.locator("[data-story-object-prompt]")).toHaveAttribute(
      "data-placement",
      "above",
    );
  }
  if (step.hotspot === "plate") {
    await expect(page.locator("[data-story-object-prompt]")).toHaveAttribute(
      "data-placement",
      "below",
    );
  }
  const hotspotBox = await hotspot.boundingBox();
  const stageBox = await stage.boundingBox();
  expect(hotspotBox && stageBox).toBeTruthy();

  for (const object of objects) {
    const button = page.locator(
      `[data-story-object][data-story-render-id="${object.assetId}"]`,
    );
    const image = page.locator(
      `[data-story-render-id="${object.assetId}"] [data-story-object-image]`,
    );
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute(
      "data-story-object-region",
      step.hotspot,
    );
    await expect(button).toHaveAttribute(
      "aria-label",
      step.object.prompt,
    );
    await expect(image).toHaveJSProperty("naturalWidth", 512);
    await expect(image).toHaveAttribute(
      "src",
      /\/2d\/story-kitchen\/(ingredients|tools)\/.*_normal\.png$/,
    );
    await expect(image).toHaveCSS("position", "absolute");

    const objectBox = await button.boundingBox();
    const visibleWidth =
      Math.min(
        objectBox!.x + objectBox!.width,
        stageBox!.x + stageBox!.width,
      ) - Math.max(objectBox!.x, stageBox!.x);
    const visibleHeight =
      Math.min(
        objectBox!.y + objectBox!.height,
        stageBox!.y + stageBox!.height,
      ) - Math.max(objectBox!.y, stageBox!.y);
    expect(visibleWidth).toBeGreaterThanOrEqual(20);
    expect(visibleHeight).toBeGreaterThanOrEqual(20);
    expect(objectBox!.x + objectBox!.width / 2).toBeGreaterThanOrEqual(
      hotspotBox!.x,
    );
    expect(objectBox!.x + objectBox!.width / 2).toBeLessThanOrEqual(
      hotspotBox!.x + hotspotBox!.width,
    );
    expect(objectBox!.y + objectBox!.height / 2).toBeGreaterThanOrEqual(
      hotspotBox!.y,
    );
    expect(objectBox!.y + objectBox!.height / 2).toBeLessThanOrEqual(
      hotspotBox!.y + hotspotBox!.height,
    );
  }
}

function firstIngredientButton(page: Page, step: StoryStep) {
  const ingredient = visibleObjects(step).find(
    (object) => !toolIds.has(object.assetId),
  );
  if (!ingredient) throw new Error("No independent ingredient object found");
  return page.locator(
    `[data-story-object][data-story-render-id="${ingredient.assetId}"]`,
  );
}

async function completeCurrentObject(page: Page, step: StoryStep) {
  await assertCurrentRenderObjects(page, step);
  const object = firstIngredientButton(page, step);
  const assetId = await object.getAttribute("data-story-render-id");
  const image = page.locator(
    `[data-story-render-id="${assetId}"] [data-story-object-image]`,
  );

  await object.hover();
  await expect(object).toHaveAttribute("data-story-object-state", "click");
  await expect(image).toHaveAttribute("src", /_click\.png$/);

  await object.click();
  await expect(object).toHaveAttribute("data-story-object-state", "click");
  await page.waitForTimeout(80);
  await expect(object).toHaveAttribute("data-story-object-state", "click");
  await expect(object).toHaveAttribute("data-story-object-state", "success", {
    timeout: 1_000,
  });
  await expect(image).toHaveAttribute("src", /_success\.png$/);
  await expect(page.locator("[data-story-continue]")).toBeEnabled();
  await page.locator("[data-story-continue]").click();
}

test("story kitchen exposes all 25 recipes and the fixed three-zone layout", async ({
  page,
}) => {
  const requested: string[] = [];
  page.on("request", (request) => requested.push(request.url()));
  await page.goto("/cook/story/");
  await expect(page.locator("[data-story-recipe-id]")).toHaveCount(25);
  await expect(page.locator("[data-story-dish-card]")).toHaveCount(25);
  await expect(
    page.locator('[data-story-dish-card][data-story-dish-ready="true"]'),
  ).toHaveCount(25);
  await page.locator('[data-story-recipe-id="2"]').click();
  await expect(page).toHaveURL(/\/cook\/story\/tomato-egg\/$/);
  await expect(page.locator("[data-tomato-egg-stage]")).toBeVisible();
  await page.goto("/cook/story/?recipe=2&legacy=1");
  await expect(page.locator("[data-2d-kitchen]")).toBeVisible();
  await expect(page.locator("[data-story-dialogue]")).toBeVisible();
  await expect(page.locator("[data-story-progress-bar]")).toBeVisible();
  await expect(page.locator("[data-story-hotspot]")).toHaveCount(6);
  const recipe = storyManifest.recipes.find((item) => item.id === 2)!;
  await assertCurrentRenderObjects(page, recipe.steps[0]);
  expect(
    requested.some((url) => url.includes("/2d/story-kitchen/ingredients/")),
  ).toBe(true);
  expect(
    requested.some((url) => url.includes("/2d/story-kitchen/tools/")),
  ).toBe(true);
  expect(requested.some((url) => url.includes("/2d/ingredients/"))).toBe(false);
  expect(requested.some((url) => url.includes("/2d/tools/"))).toBe(false);
  expect(requested.some((url) => url.includes("/2d/food_state/"))).toBe(false);
  await expect(page.getByRole("link", { name: /3D/ })).toHaveCount(0);
  await expect(page.locator("[data-story-background]")).toHaveCSS(
    "z-index",
    "10",
  );
  await expect(page.locator("[data-story-object-layer]")).toHaveCSS(
    "z-index",
    "20",
  );
  await expect(page.locator("[data-story-render-id]").first()).toHaveCSS(
    "z-index",
    "20",
  );
  await expect(
    page.locator('[data-story-hotspot="cutting_board"]'),
  ).toHaveCSS("z-index", "30");
  await expect(page.locator("[data-story-object]").first()).toHaveCSS(
    "z-index",
    "30",
  );
  await expect(page.locator("[data-story-object-prompt]")).toHaveCSS(
    "z-index",
    "40",
  );
  await expect(page.locator("[data-story-object-prompt]")).toHaveAttribute(
    "data-placement",
    "above",
  );

  const kitchen = await page.locator("[data-2d-kitchen]").boundingBox();
  const dialogue = await page.locator("[data-story-dialogue]").boundingBox();
  const progress = await page.locator("[data-story-progress-bar]").boundingBox();
  expect(kitchen && dialogue && progress).toBeTruthy();
  expect(kitchen!.x).toBeLessThan(dialogue!.x);
  expect(progress!.y).toBeGreaterThan(kitchen!.y);
  expect(kitchen!.width / kitchen!.height).toBeCloseTo(1344 / 768, 2);
});

test("all shared recipes use the unified playable prototype", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const sharedRecipeIds = storyManifest.recipes
    .map((recipe) => recipe.id)
    .filter((id) => id !== 2 && id !== 3);

  for (const recipeId of sharedRecipeIds) {
    await page.goto(`/cook/story/recipe/${recipeId}/`);
    await expect(
      page.locator(`[data-generic-recipe-id="${recipeId}"]`),
    ).toBeVisible();
    await expect(page.locator("[data-kitchen-background]")).toBeVisible();
    await expect(page.locator("[data-generic-object-prompt]")).toBeVisible();

    for (let step = 0; step < 8; step += 1) {
      if (
        (await page
          .locator(`[data-generic-recipe-id="${recipeId}"]`)
          .getAttribute("data-generic-finished")) === "true"
      ) {
        break;
      }
      await page.locator("[data-generic-object]").first().click();
      await expect(page.locator("[data-generic-complete-step]")).toHaveText(
        /下一步|查看成品/,
      );
      await page.locator("[data-generic-complete-step]").click();
    }

    await expect(
      page.locator(`[data-generic-recipe-id="${recipeId}"]`),
    ).toHaveAttribute("data-generic-finished", "true");
    await expect(
      page.locator(
        `[data-generic-result] [data-story-dish-recipe-id="${recipeId}"]`,
      ),
    ).toBeVisible();
  }
});

test("legacy recipe links migrate into the new prototype and return to the picker", async ({
  page,
}) => {
  await page.goto("/cook/story/?recipe=1");
  await expect(page).toHaveURL(/\/cook\/story\/recipe\/1\/$/);
  await expect(page.locator('[data-generic-recipe-id="1"]')).toBeVisible();
  await page.getByRole("link", { name: "返回菜谱选择" }).click();
  await expect(page).toHaveURL(/\/cook\/story\/$/);
  await expect(page.locator("[data-story-recipe-id]")).toHaveCount(25);
});

test("object shows click for hover and 180ms before success", async ({ page }) => {
  await startStory(page, 1);
  const step = storyManifest.recipes.find((recipe) => recipe.id === 1)!.steps[0];
  await assertCurrentRenderObjects(page, step);
  const object = firstIngredientButton(page, step);
  const assetId = await object.getAttribute("data-story-render-id");
  const image = page.locator(
    `[data-story-render-id="${assetId}"] [data-story-object-image]`,
  );
  const otherObject = page.locator("[data-story-object]").nth(1);
  await expect(object).toHaveAttribute("data-story-object-state", "normal");

  await object.hover();
  await expect(object).toHaveAttribute("data-story-object-state", "click");
  await expect(image).toHaveAttribute("src", /_click\.png$/);
  await expect(otherObject).toHaveAttribute("data-story-object-state", "normal");

  await page.mouse.move(10, 10);
  await expect(object).toHaveAttribute("data-story-object-state", "normal");

  await object.click();
  await expect(object).toHaveAttribute("data-story-object-state", "click");
  await page.waitForTimeout(80);
  await expect(object).toHaveAttribute("data-story-object-state", "click");
  await expect(object).toHaveAttribute("data-story-object-state", "success", {
    timeout: 1_000,
  });
  await expect(image).toHaveAttribute("src", /_success\.png$/);
});

test("step changes crossfade new, persistent and removed render objects", async ({
  page,
}) => {
  await startStory(page, 2);
  const recipe = storyManifest.recipes.find((item) => item.id === 2)!;
  const firstStep = recipe.steps[0];
  const secondStep = recipe.steps[1];

  await completeCurrentObject(page, firstStep);
  await expect(page.locator("[data-story-stage]")).toHaveAttribute(
    "data-story-step",
    "2",
  );
  await page.waitForFunction(
    () =>
      document.querySelectorAll(
        '[data-story-render-transition="leaving"]',
      ).length > 0,
  );
  await expect(
    page.locator(
      '[data-story-object-layer] > [data-story-render-id="egg"]',
    ),
  ).toHaveAttribute("data-story-render-transition", "stable");

  await page.waitForTimeout(340);
  const expectedIds = visibleObjects(secondStep)
    .map((object) => object.assetId)
    .sort();
  const renderedIds = await page
    .locator("[data-story-object-layer] > [data-story-render-id]")
    .evaluateAll((nodes) =>
      nodes
        .map((node) => node.getAttribute("data-story-render-id") ?? "")
        .sort(),
    );
  expect(renderedIds).toEqual(expectedIds);
  await expect(
    page.locator('[data-story-render-transition="leaving"]'),
  ).toHaveCount(0);
});

test("wrong action plays every dragon keyframe before the humanoid correction", async ({
  page,
}) => {
  await startStory(page, 1);
  await page.evaluate(() => {
    const stage = document.querySelector("[data-story-stage]");
    if (!stage) throw new Error("Story stage not found");
    const phases: string[] = [];
    (
      window as typeof window & { __storyPhases?: string[] }
    ).__storyPhases = phases;
    const record = () =>
      phases.push(stage.getAttribute("data-story-character-phase") ?? "");
    record();
    new MutationObserver(record).observe(stage, {
      attributes: true,
      attributeFilter: ["data-story-character-phase"],
    });
  });
  await page.locator('[data-story-hotspot="stove"]').click();
  await expect(page.locator("[data-story-stage]")).toHaveAttribute(
    "data-story-character-phase",
    "pre-error",
  );
  const step = storyManifest.recipes.find((recipe) => recipe.id === 1)!.steps[0];
  for (const object of visibleObjects(step)) {
    await expect(
      page.locator(
        `[data-story-object][data-story-render-id="${object.assetId}"]`,
      ),
    ).toHaveAttribute("data-story-object-state", "error");
    await expect(
      page.locator(
        `[data-story-render-id="${object.assetId}"] [data-story-object-image]`,
      ),
    ).toHaveAttribute("src", /_error\.png$/);
  }
  await expect(page.locator("[data-story-stage]")).toHaveAttribute(
    "data-story-character-phase",
    "dragon",
  );
  const phases = await page.evaluate(
    () =>
      (
        window as typeof window & { __storyPhases?: string[] }
      ).__storyPhases ?? [],
  );
  expect(phases).toEqual([
    "normal",
    "pre-error",
    "transform-01",
    "transform-02",
    "transform-03",
    "dragon",
  ]);
  await expect(page.getByText("正确操作", { exact: true })).toBeVisible();
  await expect(page.getByText("为什么", { exact: true })).toBeVisible();
  await expect(page.locator('[aria-label="完全龙化的耶梦加得"]')).toHaveCSS(
    "background-image",
    /yemengjiade\.png/,
  );

  await page.locator("[data-story-retry]").click();
  await expect(page.locator("[data-story-stage]")).toHaveAttribute(
    "data-story-character-phase",
    "normal",
  );
  for (const object of visibleObjects(step)) {
    await expect(
      page.locator(
        `[data-story-object][data-story-render-id="${object.assetId}"]`,
      ),
    ).toHaveAttribute("data-story-object-state", "normal");
  }
});

test("every recipe can complete through its manifest-driven story flow", async ({
  page,
}) => {
  test.setTimeout(180_000);
  for (const recipe of storyManifest.recipes) {
    await startStory(page, recipe.id);
    for (const step of recipe.steps) {
      await expect(page.locator("[data-story-stage]")).toHaveAttribute(
        "data-story-target",
        step.hotspot,
      );
      await completeCurrentObject(page, step);
    }
    await expect(page.locator("[data-story-stage]")).toHaveAttribute(
      "data-story-finished",
      "true",
    );
    await expect(page.locator("[data-story-finished-dish]")).toBeVisible();
    await expect(
      page.locator("[data-story-finished-dish] [data-story-dish-artwork]"),
    ).toHaveAttribute("data-story-dish-recipe-id", String(recipe.id));
  }
});

test("story progress is isolated from recipe progress and survives refresh", async ({
  page,
}) => {
  await page.goto("/cook/");
  await page.evaluate(() => {
    window.localStorage.setItem(
      "simulating-cook:recipe-session:v1",
      JSON.stringify({ marker: "recipe" }),
    );
    window.localStorage.removeItem("simulating-cook:story-session:v1");
  });
  await startStory(page, 2);
  const step = storyManifest.recipes.find((recipe) => recipe.id === 2)!.steps[0];
  await assertCurrentRenderObjects(page, step);
  await firstIngredientButton(page, step).click();
  await expect(page.locator("[data-story-continue]")).toBeEnabled();
  await page.locator("[data-story-continue]").click();
  await page.reload();
  await expect(page.locator("[data-story-stage]")).toHaveAttribute(
    "data-story-step",
    "2",
  );
  expect(
    await page.evaluate(() =>
      window.localStorage.getItem("simulating-cook:recipe-session:v1"),
    ),
  ).toBe('{"marker":"recipe"}');
});

test("legacy 3d URL redirects without loading 3D resources", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (request) => requested.push(request.url()));
  await page.goto("/cook/3d/");
  await expect(page).toHaveURL(/\/cook\/story\/$/);
  await expect(page.locator("[data-story-recipe-id]")).toHaveCount(25);
  expect(
    requested.some((url) =>
      /\.(glb|gltf|hdr)(\?|$)|three-d|three\.min\.js/i.test(url),
    ),
  ).toBe(false);
});

test("story kitchen remains usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startStory(page, 22);
  await expect(page.locator("[data-2d-kitchen]")).toBeVisible();
  await expect(page.locator("[data-story-dialogue]")).toBeVisible();
  await expect(page.locator("[data-story-progress-bar]")).toBeVisible();
  await expect(page.locator("[data-story-progress-bar]")).toHaveCSS(
    "position",
    "sticky",
  );
  const step = storyManifest.recipes.find((recipe) => recipe.id === 22)!.steps[0];
  await assertCurrentRenderObjects(page, step);
  const object = firstIngredientButton(page, step);
  await expect(object).toBeVisible();
  await expect(page.locator("[data-story-object-prompt]")).toBeVisible();
  await expect(page.locator("[data-story-object-image]").first()).toHaveJSProperty(
    "naturalWidth",
    512,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const stage = await page.locator("[data-2d-kitchen]").boundingBox();
  const objectBox = await object.boundingBox();
  expect(stage && objectBox).toBeTruthy();
  expect(stage!.width / stage!.height).toBeCloseTo(1344 / 768, 2);
  expect(objectBox!.width).toBeGreaterThanOrEqual(20);

  await object.click();
  await expect(object).toHaveAttribute("data-story-object-state", "click");
  await page.waitForTimeout(80);
  await expect(object).toHaveAttribute("data-story-object-state", "click");
  await expect(object).toHaveAttribute("data-story-object-state", "success", {
    timeout: 1_000,
  });
  await expect(page.locator("[data-story-continue]")).toBeEnabled();
});
