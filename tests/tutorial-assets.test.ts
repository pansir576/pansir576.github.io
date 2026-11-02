import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import iconManifest from "../assets/icon_manifest.json";
import hotspotManifest from "../assets/bg/kitchen_hotspots.json";
import storyManifest from "../assets/story_state_manifest.json";
import characterManifest from "../assets/character_manifest.json";
import storyKitchenManifest from "../assets/story-kitchen/icon_manifest.json";
import packageJson from "../package.json";

function pngDimensions(relativePath: string) {
  const data = readFileSync(path.join(process.cwd(), relativePath));
  expect(data.subarray(1, 4).toString("ascii")).toBe("PNG");
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
    colorType: data[25],
  };
}

describe("2D tutorial assets", () => {
  it("keeps the fixed kitchen background and no unreferenced asset candidates", () => {
    const kitchen = pngDimensions("assets/bg/kitchen_bg.png");
    expect(kitchen).toEqual({ width: 1344, height: 768, colorType: 2 });
    expect(readdirSync("assets/bg").sort()).toEqual([
      "kitchen_bg.png",
      "kitchen_hotspots.json",
    ]);

    const iconFiles = [...iconManifest.ingredients, ...iconManifest.tools]
      .flatMap((item) => Object.values(item.states))
      .map((file) => path.basename(file))
      .sort();
    const actualIconFiles = ["ingredients", "tools"]
      .flatMap((directory) =>
        readdirSync(`assets/${directory}`).map((file) => file),
      )
      .sort();
    expect(actualIconFiles).toEqual(iconFiles);
  });

  it("contains 55 ingredients and 7 tools in four 512px transparent states", () => {
    const items = [...iconManifest.ingredients, ...iconManifest.tools];
    expect(iconManifest.ingredients).toHaveLength(55);
    expect(iconManifest.tools).toHaveLength(7);
    for (const item of items) {
      expect(Object.keys(item.states)).toEqual([
        "normal",
        "click",
        "success",
        "error",
      ]);
      for (const file of Object.values(item.states)) {
        const png = pngDimensions(file);
        expect(png.width).toBe(512);
        expect(png.height).toBe(512);
        expect(png.colorType).toBe(6);
      }
    }
  });

  it("keeps the story kitchen on its isolated reference-styled asset set", () => {
    const items = [
      ...storyKitchenManifest.ingredients,
      ...storyKitchenManifest.tools,
    ];
    expect(storyKitchenManifest.ingredients).toHaveLength(55);
    expect(storyKitchenManifest.tools).toHaveLength(7);
    expect(new Set(items.map((item) => item.id))).toEqual(
      new Set(
        [...iconManifest.ingredients, ...iconManifest.tools].map(
          (item) => item.id,
        ),
      ),
    );
    for (const item of items) {
      for (const file of Object.values(item.states)) {
        expect(file).toMatch(
          /^assets\/story-kitchen\/(ingredients|tools)\/.+\.png$/,
        );
        const png = pngDimensions(file);
        expect(png).toEqual({ width: 512, height: 512, colorType: 6 });
      }
    }
  });

  it("contains 99 recipe step states and ten transparent character frames", () => {
    const steps = storyManifest.recipes.flatMap((recipe) => recipe.steps);
    expect(storyManifest.recipes).toHaveLength(25);
    expect(steps).toHaveLength(99);
    expect(steps.filter((step) => step.question)).toHaveLength(25);
    expect(characterManifest.normal).toHaveLength(4);
    for (const step of steps) {
      expect(Object.keys(step.states)).toHaveLength(4);
      for (const file of Object.values(step.states)) {
        const png = pngDimensions(file);
        expect(png).toEqual({ width: 512, height: 512, colorType: 6 });
      }
    }
    for (const name of [
      ...characterManifest.normal,
      characterManifest.correct,
      "pre_error_xiami.png",
      "transform_01.png",
      "transform_02.png",
      "transform_03.png",
      "yemengjiade.png",
    ]) {
      const png = pngDimensions(`assets/character/${name}`);
      expect(png.width).toBe(768);
      expect(png.height).toBe(1152);
      expect(png.colorType).toBe(6);
    }
  });

  it("extends every step with independent, hotspot-aligned render objects", () => {
    const steps = storyManifest.recipes.flatMap((recipe) => recipe.steps);
    const hotspotMap = new Map(
      hotspotManifest.hotspots.map((hotspot) => [hotspot.id, hotspot]),
    );
    const assetMap = new Map(
      [...iconManifest.ingredients, ...iconManifest.tools].map((item) => [
        item.id,
        item.states,
      ]),
    );
    const toolIds = new Set(iconManifest.tools.map((item) => item.id));
    expect([...hotspotMap.keys()]).toEqual([
      "fridge",
      "sink",
      "cutting_board",
      "stove",
      "seasoning",
      "plate",
    ]);
    expect(
      steps.flatMap((step) => step.renderObjects),
    ).toHaveLength(222);
    for (const step of steps) {
      expect(step.object.label.trim()).not.toBe("");
      expect(step.object.action.trim()).not.toBe("");
      expect(step.object.prompt).toContain(step.object.label);
      expect(step.object.prompt).toContain(step.object.action);
      expect(step.object.prompt).not.toMatch(
        /点击此处|当前操作区域|当前区域|点击高亮区域|盘中中的/,
      );
      expect(hotspotMap.has(step.hotspot)).toBe(true);
      expect(step.renderObjects.length).toBeGreaterThan(0);

      const hotspot = hotspotMap.get(step.hotspot)!;
      const ids = step.renderObjects.map((object) => object.assetId);
      expect(new Set(ids).size).toBe(ids.length);
      for (const object of step.renderObjects) {
        expect(Object.keys(object).sort()).toEqual([
          "assetId",
          "scale",
          "visible",
          "x",
          "y",
        ]);
        expect(assetMap.has(object.assetId)).toBe(true);
        expect(Object.keys(assetMap.get(object.assetId)!)).toEqual([
          "normal",
          "click",
          "success",
          "error",
        ]);
        expect(object.visible).toBe(true);
        expect(object.x).toBeGreaterThanOrEqual(hotspot.x);
        expect(object.x).toBeLessThanOrEqual(hotspot.x + hotspot.width);
        expect(object.y).toBeGreaterThanOrEqual(hotspot.y);
        expect(object.y).toBeLessThanOrEqual(hotspot.y + hotspot.height);
        expect(object.scale).toBeGreaterThan(0.05);
        expect(object.scale).toBeLessThan(0.25);
      }
      const ingredientObjects = step.renderObjects.filter(
        (object) => !toolIds.has(object.assetId),
      );
      for (let left = 0; left < ingredientObjects.length; left += 1) {
        for (let right = left + 1; right < ingredientObjects.length; right += 1) {
          const first = ingredientObjects[left];
          const second = ingredientObjects[right];
          const overlapsX =
            Math.abs(first.x - second.x) <
            (first.scale + second.scale) / 2;
          const overlapsY =
            Math.abs(first.y - second.y) <
            (first.scale + second.scale) / 2;
          expect(overlapsX && overlapsY).toBe(false);
        }
      }
    }
    expect(hotspotMap.get("sink")?.labelPlacement).toBe("above");
    expect(hotspotMap.get("cutting_board")?.labelPlacement).toBe("above");
    expect(hotspotMap.get("plate")?.labelPlacement).toBe("below");
  });

  it("preserves all frozen story text, hotspots and question fields", () => {
    const immutableSteps = storyManifest.recipes.flatMap((recipe) =>
      recipe.steps.map((step) => ({
        recipeId: step.recipeId,
        stepId: step.stepId,
        hotspot: step.hotspot,
        title: step.title,
        description: step.description,
        knowledge: step.knowledge,
        actionLabel: step.actionLabel,
        correctText: step.correctText,
        errorOperation: step.errorOperation,
        errorPrinciple: step.errorPrinciple,
        object: step.object,
        states: step.states,
        question: step.question,
      })),
    );
    expect(
      createHash("sha256")
        .update(JSON.stringify(immutableSteps))
        .digest("hex"),
    ).toBe("a297324430216a981ddffb39e0db95c2f8acfee6dc072453bf5214ad9e4220e5");
  });

  it("keeps recipe and story storage namespaces separate", () => {
    const recipeSource = readFileSync(
      "src/lib/recipe-engine.ts",
      "utf8",
    );
    const storySource = readFileSync(
      "src/components/kitchen/story-kitchen.tsx",
      "utf8",
    );
    expect(recipeSource).toContain("simulating-cook:recipe-session:v1");
    expect(storySource).toContain("simulating-cook:story-session:v1");
    expect(storySource).toContain("renderObjects");
    expect(storySource).not.toMatch(/storyStep\.states|story_object_bounds/);
    expect(storySource).not.toMatch(/清炒土豆丝|番茄炒蛋|宫保鸡丁/);
    for (const recipe of storyManifest.recipes) {
      for (const step of recipe.steps) {
        expect([
          "fridge",
          "sink",
          "cutting_board",
          "stove",
          "seasoning",
          "plate",
        ]).toContain(step.hotspot);
      }
    }
  });

  it("keeps the one-question-per-recipe and dragon transition contract", () => {
    for (const recipe of storyManifest.recipes) {
      expect(
        recipe.steps.filter((step) => step.question),
      ).toHaveLength(1);
    }
    expect(
      characterManifest.transition.map((item) => item.atSeconds),
    ).toEqual([0, 0.3, 0.6, 1, 1.1]);
  });

  it("has no 3D runtime route, model, or dependency", () => {
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };
    expect(dependencies).not.toHaveProperty("three");
    expect(dependencies).not.toHaveProperty("@react-three/fiber");
    expect(dependencies).not.toHaveProperty("@react-three/drei");
    expect(dependencies).not.toHaveProperty("@react-three/rapier");
    const redirectSource = readFileSync("src/app/cook/3d/page.tsx", "utf8");
    expect(redirectSource).not.toMatch(/three|webgl|three-d/i);
    expect(existsSync(path.join(process.cwd(), "public/models"))).toBe(false);
  });
});
