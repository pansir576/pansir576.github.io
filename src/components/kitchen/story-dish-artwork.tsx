/* eslint-disable @next/next/no-img-element -- the artwork layers the existing transparent ingredient PNGs */

import type { CSSProperties } from "react";
import {
  getStoryDishSpec,
  storyIngredientAsset,
  type StoryDishForm,
} from "@/lib/story-dish-data";
import styles from "./story-dish-artwork.module.css";

interface StoryDishArtworkProps {
  recipeId: number;
  name: string;
  compact?: boolean;
}

interface PieceLayout {
  x: number;
  y: number;
  size: number;
  rotate: number;
}

const PILE_LAYOUT: PieceLayout[] = [
  { x: 34, y: 39, size: 39, rotate: -17 },
  { x: 53, y: 34, size: 42, rotate: 12 },
  { x: 68, y: 45, size: 37, rotate: 24 },
  { x: 43, y: 57, size: 43, rotate: -8 },
  { x: 61, y: 61, size: 36, rotate: 18 },
  { x: 28, y: 59, size: 31, rotate: 9 },
  { x: 74, y: 65, size: 28, rotate: -21 },
  { x: 49, y: 72, size: 32, rotate: 5 },
];

const SOUP_LAYOUT: PieceLayout[] = [
  { x: 34, y: 43, size: 31, rotate: -12 },
  { x: 54, y: 39, size: 34, rotate: 9 },
  { x: 67, y: 51, size: 28, rotate: 19 },
  { x: 43, y: 60, size: 30, rotate: -8 },
  { x: 59, y: 65, size: 27, rotate: 12 },
];

const NOODLE_LAYOUT: PieceLayout[] = [
  { x: 43, y: 42, size: 62, rotate: -10 },
  { x: 55, y: 48, size: 59, rotate: 12 },
  { x: 48, y: 57, size: 55, rotate: -5 },
  { x: 62, y: 62, size: 31, rotate: 22 },
  { x: 38, y: 65, size: 29, rotate: -22 },
];

function layoutFor(form: StoryDishForm): PieceLayout[] {
  if (form === "fish") {
    return [{ x: 51, y: 53, size: 82, rotate: -4 }];
  }
  if (form === "soup") return SOUP_LAYOUT;
  if (form === "noodles") return NOODLE_LAYOUT;
  if (form === "rice") return PILE_LAYOUT.slice(0, 6);
  return PILE_LAYOUT;
}

export function StoryDishArtwork({
  recipeId,
  name,
  compact = false,
}: StoryDishArtworkProps) {
  const spec = getStoryDishSpec(recipeId);
  const layout = layoutFor(spec.form);
  const bowl = spec.form === "soup" || spec.form === "rice";

  return (
    <div
      className={`${styles.artwork} ${
        compact ? styles.compact : styles.result
      } ${styles[`form_${spec.form}`]}`}
      role="img"
      aria-label={`${name}成品`}
      data-story-dish-artwork
      data-story-dish-card={compact ? "true" : undefined}
      data-story-dish-ready="true"
      data-story-dish-recipe-id={recipeId}
      style={{ "--dish-sauce": spec.sauce } as CSSProperties}
    >
      <span className={styles.aura} aria-hidden="true" />
      <span
        className={`${styles.vessel} ${bowl ? styles.bowl : styles.plate}`}
        aria-hidden="true"
      />
      <span className={styles.sauce} aria-hidden="true" />
      <span className={styles.riceBase} aria-hidden="true" />
      <span className={styles.foodLayer}>
        {layout.map((piece, index) => {
          const asset = spec.assets[index % spec.assets.length];
          return (
            <img
              key={`${asset}-${index}`}
              className={styles.piece}
              src={storyIngredientAsset(asset)}
              alt=""
              loading={compact ? "lazy" : "eager"}
              draggable={false}
              style={
                {
                  "--piece-x": `${piece.x}%`,
                  "--piece-y": `${piece.y}%`,
                  "--piece-size": `${piece.size}%`,
                  "--piece-rotate": `${piece.rotate}deg`,
                  "--piece-delay": `${index * 55}ms`,
                } as CSSProperties
              }
            />
          );
        })}
        <img
          className={styles.garnish}
          src={storyIngredientAsset(spec.garnish)}
          alt=""
          loading={compact ? "lazy" : "eager"}
          draggable={false}
        />
      </span>
      {!compact && (
        <span className={styles.steam} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      )}
    </div>
  );
}
