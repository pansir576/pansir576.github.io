import type { IngredientDefinition } from "@/lib/types";

interface IngredientArtProps {
  ingredient: IngredientDefinition;
  size?: "small" | "medium" | "large";
  animated?: boolean;
  className?: string;
}

export function IngredientArt({
  ingredient,
  size = "medium",
  animated = false,
  className = "",
}: IngredientArtProps) {
  return (
    <div
      className={`ingredient-art art-${size} ${animated ? "is-animated" : ""} ${className}`}
      style={
        {
          "--art-main": ingredient.palette.main,
          "--art-soft": ingredient.palette.soft,
          "--art-accent": ingredient.palette.accent,
        } as React.CSSProperties
      }
      aria-hidden="true"
    >
      <svg viewBox="0 0 240 200" role="presentation">
        <circle cx="120" cy="102" r="86" className="art-halo" />
        {ingredient.art === "greens" && (
          <g>
            <path
              d="M117 164c-3-39-1-79 3-111"
              className="art-stem"
              strokeWidth="11"
            />
            <path
              d="M119 126c-23-29-43-34-59-25-10 22 10 44 48 39"
              className="art-leaf art-leaf-a"
            />
            <path
              d="M120 103c26-31 49-30 58-14 5 23-19 39-53 29"
              className="art-leaf art-leaf-b"
            />
            <path
              d="M120 85c-17-32-8-50 8-51 19 4 24 26 7 52"
              className="art-leaf art-leaf-c"
            />
            <path d="M119 73v86" className="art-detail-line" strokeWidth="2" />
          </g>
        )}
        {ingredient.art === "potato" && (
          <g>
            <path
              d="M72 75c16-28 61-31 91-7 28 22 25 71-7 91-34 21-85 4-94-31-5-19-1-37 10-53Z"
              className="art-solid"
            />
            <circle cx="101" cy="87" r="4" className="art-detail-dot" />
            <circle cx="145" cy="78" r="3" className="art-detail-dot" />
            <circle cx="152" cy="127" r="4" className="art-detail-dot" />
            <path d="M89 137c20 10 49 6 65-11" className="art-detail-line" />
            <path d="M115 155c-13-20-7-45 18-65" className="art-sheen" />
          </g>
        )}
        {ingredient.art === "egg" && (
          <g>
            <path
              d="M59 107c0-31 26-59 61-59 39 0 64 30 61 59-2 30-26 53-61 53-38 0-61-24-61-53Z"
              className="art-white"
            />
            <circle cx="130" cy="105" r="36" className="art-solid" />
            <circle cx="118" cy="93" r="10" className="art-sheen-fill" />
          </g>
        )}
        {ingredient.art === "tomato" && (
          <g>
            <circle cx="121" cy="108" r="67" className="art-solid" />
            <path
              d="M121 49c-2-13 1-21 8-28M118 47c-17-6-29-4-38 7M126 48c14-10 25-9 34 1M123 50c-3 10-9 16-18 20"
              className="art-leaf-path"
            />
            <path
              d="M119 45c2 5 3 9 2 14"
              className="art-leaf-path"
              strokeWidth="7"
            />
            <circle cx="96" cy="88" r="9" className="art-sheen-fill" />
          </g>
        )}
        {ingredient.art === "tofu" && (
          <g>
            <path d="m69 77 65-28 47 33-65 30Z" className="art-face-light" />
            <path d="m69 77 47 35v49L69 123Z" className="art-face-main" />
            <path d="m116 112 65-30v50l-65 29Z" className="art-face-dark" />
            <path d="m85 86 17 11M99 79l17 12" className="art-detail-line" />
            <path d="m128 122 38-18M137 137l38-18" className="art-detail-line" />
          </g>
        )}
        {ingredient.art === "beef" && (
          <g>
            <path
              d="M66 79c20-25 58-31 91-15 39 20 34 72-7 91-35 16-77-2-90-35-6-16-4-30 6-41Z"
              className="art-solid"
            />
            <path
              d="M79 119c26 12 52 5 71-15 14-15 20-31 13-47M85 88c11 4 16 10 17 20M139 146c6-11 10-23 8-35"
              className="art-detail-line"
              strokeWidth="5"
            />
            <path d="M88 82c-4 28 2 52 22 68" className="art-sheen" />
          </g>
        )}
        {ingredient.art === "pork" && (
          <g>
            <path
              d="M61 69c17-22 103-22 120 0v66c-18 23-102 23-120 0Z"
              className="art-soft"
            />
            <path d="M65 82c32 11 85 11 114 0v14c-31 12-84 12-114 0Z" className="art-solid" />
            <path d="M65 105c31 11 83 11 114 0v15c-30 10-83 10-114 0Z" className="art-face-light" />
            <path d="M65 129c32 10 84 10 114 0v7c-18 21-97 21-114 0Z" className="art-solid" />
            <path d="M82 74c-3 27-2 51 2 71M132 72c3 30 3 56-1 78" className="art-detail-line" />
          </g>
        )}
        {ingredient.art === "fish" && (
          <g>
            <path
              d="M54 106c29-39 70-52 113-21l28-25v65l-28-24c-43 30-84 20-113-8 9-2 14-4 20-8-6-4-12-4-20 0Z"
              className="art-solid"
            />
            <circle cx="92" cy="95" r="5" className="art-detail-dot" />
            <path d="M109 93c15 7 30 7 45 0M130 119c13-3 26-9 36-18M131 77c12 3 24 9 34 18" className="art-detail-line" />
            <path d="M71 107c25-19 55-24 85-10" className="art-sheen" />
          </g>
        )}
      </svg>
    </div>
  );
}
