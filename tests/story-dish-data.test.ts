import { describe, expect, it } from "vitest";
import iconManifest from "../assets/story-kitchen/icon_manifest.json";
import recipeData from "../src/lib/recipe-data.json";
import { getStoryDishSpec } from "../src/lib/story-dish-data";

const ingredientIds = new Set(
  iconManifest.ingredients.map((ingredient) => ingredient.id),
);

describe("story dish artwork data", () => {
  it("covers every recipe with existing ingredient assets", () => {
    expect(recipeData).toHaveLength(25);
    for (const recipe of recipeData) {
      const spec = getStoryDishSpec(recipe.id);
      expect(spec.assets.length).toBeGreaterThan(0);
      expect(["pile", "fish", "soup", "rice", "noodles"]).toContain(
        spec.form,
      );
      for (const assetId of [...spec.assets, spec.garnish]) {
        expect(ingredientIds.has(assetId), `${recipe.name}: ${assetId}`).toBe(
          true,
        );
      }
    }
  });
});
