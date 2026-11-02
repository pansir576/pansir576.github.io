import type { Metadata } from "next";
import { notFound } from "next/navigation";
import storyManifestData from "../../../../../../assets/story_state_manifest.json";
import { GenericRecipePrototype } from "@/components/kitchen/generic-recipe-prototype";
import recipeData from "@/lib/recipe-data.json";
import type { RecipeDefinition } from "@/lib/recipe-types";

const recipes = recipeData as RecipeDefinition[];
const storyRecipes = storyManifestData.recipes;

export const dynamicParams = false;

export function generateStaticParams() {
  return recipes
    .filter((recipe) => recipe.id !== 2 && recipe.id !== 3)
    .map((recipe) => ({ id: String(recipe.id) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const recipe = recipes.find((item) => item.id === Number(id));
  return {
    title: recipe ? `${recipe.name} · 夏弥故事厨房` : "夏弥故事厨房",
    description: recipe
      ? `跟随夏弥完成${recipe.name}，点击食材和厨具完成步骤并获得成品评价。`
      : "跟随夏弥完成菜谱步骤并获得成品评价。",
  };
}

export default async function RecipePrototypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const recipe = recipes.find((item) => item.id === Number(id));
  const storyRecipe = storyRecipes.find((item) => item.id === Number(id));
  if (!recipe || !storyRecipe) notFound();

  return (
    <GenericRecipePrototype recipe={recipe} storyRecipe={storyRecipe} />
  );
}
