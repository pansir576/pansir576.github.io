/* eslint-disable @next/next/no-img-element */
"use client";

import { IngredientArt } from "@/components/ingredient-art";
import { foodFormFromState } from "@/lib/feedback";
import {
  hasIngredientPhoto,
  ingredientPhoto,
} from "@/lib/media";
import type {
  FoodForm,
  IngredientDefinition,
  IngredientState,
  KitchenStation,
} from "@/lib/types";
import styles from "./guided-kitchen.module.css";

const formLabels: Record<FoodForm, string> = {
  whole: "原始形态",
  washed: "清洗完成",
  cut: "已经切配",
  "small-pieces": "切丝 / 小块",
  cooking: "受热中",
  done: "接近完成",
};

export function SceneFoodSample({
  ingredient,
  state,
  actionCount,
  station,
  isHeating,
}: {
  ingredient: IngredientDefinition;
  state: IngredientState;
  actionCount: number;
  station: KitchenStation;
  isHeating: boolean;
}) {
  const form = foodFormFromState(state, actionCount);
  const pieceCount =
    form === "small-pieces" ? 11 : form === "cut" ? 7 : 1;
  const image = hasIngredientPhoto(ingredient.id)
    ? ingredientPhoto(ingredient.id)
    : null;

  return (
    <div
      className={[
        styles.foodSample,
        styles[`sampleStation-${station}`],
        styles[`sampleForm-${form}`],
        styles[`sampleArchetype-${ingredient.archetype}`],
        styles[`sampleIngredient-${ingredient.id}`],
      ].join(" ")}
      data-food-form={form}
      style={
        {
          "--food-color": ingredient.palette.main,
          "--food-accent": ingredient.palette.accent,
          "--food-image": image ? `url("${image}")` : "none",
        } as React.CSSProperties
      }
      aria-label={`${ingredient.name}，${formLabels[form]}`}
    >
      <span className={styles.sampleShadow} aria-hidden="true" />
      <span className={styles.sampleBoard} aria-hidden="true" />
      {image ? (
        pieceCount === 1 ? (
          <span className={styles.singleFood}>
            <img src={image} alt="" />
          </span>
        ) : (
          <span className={styles.foodPieces} aria-hidden="true">
            {Array.from({ length: pieceCount }, (_, index) => (
              <i
                key={index}
                style={
                  {
                    "--piece-index": index,
                    "--piece-angle": `${(index % 2 === 0 ? -1 : 1) * (7 + index * 3)}deg`,
                    "--piece-x": `${(index - (pieceCount - 1) / 2) * 9}px`,
                    "--piece-y": `${((index % 4) - 1.5) * 9}px`,
                  } as React.CSSProperties
                }
              />
            ))}
          </span>
        )
      ) : (
        <IngredientArt ingredient={ingredient} size="small" />
      )}
      {(isHeating || form === "cooking" || form === "done") && (
        <span className={styles.sampleSteam} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      )}
      <span className={styles.sampleLabel}>
        {ingredient.name} · {formLabels[form]}
      </span>
    </div>
  );
}
