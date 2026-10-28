export const siteMedia = {
  hero: "/images/hero-wok.webp",
  process: "/images/process-cooking.webp",
} as const;

const photographedIngredientIds = new Set([
  "greens",
  "potato",
  "egg",
  "tomato",
  "tofu",
  "beef",
  "pork",
  "fish",
]);

export const featuredIngredientIds = new Set([...photographedIngredientIds]);

export function hasIngredientPhoto(id: string): boolean {
  return photographedIngredientIds.has(id) || customIngredientPhotoIds.has(id);
}

export function ingredientPhoto(id: string): string {
  if (customIngredientPhotoIds.has(id)) {
    return `/images/ingredient-custom-${id}.webp`;
  }
  return `/images/ingredient-${id}.webp`;
}
import { customIngredientPhotoIds } from "./ingredient-photo-manifest";

