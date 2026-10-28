import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { customIngredientPhotoIds } from "@/lib/ingredient-photo-manifest";
import { hasIngredientPhoto, ingredientPhoto } from "@/lib/media";
import { ingredients } from "@/lib/ingredients";

describe("ingredient photo mapping", () => {
  it("uses the correct photographed potato instead of the lotus-root image", () => {
    expect(hasIngredientPhoto("potato")).toBe(true);
    expect(ingredientPhoto("potato")).toBe("/images/ingredient-potato.webp");
    expect(ingredientPhoto("lotus-root")).toBe(
      "/images/ingredient-custom-lotus-root.webp",
    );
  });

  it("keeps every custom ingredient image available on disk", () => {
    for (const ingredientId of customIngredientPhotoIds) {
      const publicPath = ingredientPhoto(ingredientId);
      expect(
        existsSync(
          path.join(
            process.cwd(),
            "public",
            publicPath.replace(/^\//, ""),
          ),
        ),
        ingredientId,
      ).toBe(true);
    }
  });

  it("has a photo-derived surface texture for every photographed ingredient", () => {
    for (const ingredient of ingredients.filter((item) =>
      hasIngredientPhoto(item.id),
    )) {
      expect(
        existsSync(
          path.join(
            process.cwd(),
            "public",
            "images",
            "food-textures",
            `${ingredient.id}.webp`,
          ),
        ),
        ingredient.id,
      ).toBe(true);
    }
  });
});
