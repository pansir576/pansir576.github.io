"""Create transparent food cutouts from the photographed ingredient library."""

from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
IMAGE_ROOT = ROOT / "public" / "images"
OUTPUT_ROOT = IMAGE_ROOT / "food-cutouts"

FEATURED_IDS = [
    "greens",
    "potato",
    "egg",
    "tomato",
    "tofu",
    "beef",
    "pork",
    "fish",
    "lotus-root",
    "carrot",
    "daikon",
    "yam",
    "celtuce",
    "taro",
    "shiitake",
]

def source_for(ingredient_id: str) -> Path | None:
    if ingredient_id == "potato":
        return IMAGE_ROOT / "ingredient-potato.webp"
    custom = IMAGE_ROOT / f"ingredient-custom-{ingredient_id}.webp"
    if custom.exists():
        return custom
    original = IMAGE_ROOT / f"ingredient-{ingredient_id}.webp"
    return original if original.exists() else None


def refine_alpha(ingredient_id: str, image: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    b, g, r = cv2.split(image.astype(np.float32))
    value = np.maximum(np.maximum(r, g), b)
    green = (g > r * 1.08) & (g > b * 1.12)
    red = (r > g * 1.13) & (r > b * 1.02)
    saturation = (value - np.minimum(np.minimum(r, g), b)) / np.maximum(value, 1)

    if ingredient_id == "potato":
        alpha = np.where(green, 0, alpha).astype(np.uint8)
    elif ingredient_id == "egg":
        alpha = np.where(green | (value < 52), 0, alpha).astype(np.uint8)
    elif ingredient_id == "tomato":
        keep = red | (green & (value > 65))
        alpha = np.where(keep, alpha, 0).astype(np.uint8)
    elif ingredient_id in {"tofu", "pork"}:
        alpha = np.where(green, 0, alpha).astype(np.uint8)
    elif ingredient_id == "fish":
        silver = (saturation < 0.34) & (value > 55)
        alpha = np.where(silver | red, alpha, 0).astype(np.uint8)
    return alpha


def cutout(source: Path, output: Path, ingredient_id: str) -> None:
    image = cv2.imread(str(source), cv2.IMREAD_COLOR)
    if image is None:
        raise RuntimeError(f"Unable to read {source}")
    height, width = image.shape[:2]
    mask = np.zeros((height, width), dtype=np.uint8)
    margin_x = max(3, int(width * 0.045))
    margin_y = max(3, int(height * 0.045))
    rectangle = (
        margin_x,
        margin_y,
        width - margin_x * 2,
        height - margin_y * 2,
    )
    background_model = np.zeros((1, 65), np.float64)
    foreground_model = np.zeros((1, 65), np.float64)
    cv2.grabCut(
        image,
        mask,
        rectangle,
        background_model,
        foreground_model,
        6,
        cv2.GC_INIT_WITH_RECT,
    )
    alpha = np.where(
        (mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD),
        255,
        0,
    ).astype(np.uint8)
    alpha = refine_alpha(ingredient_id, image, alpha)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(alpha, 8)
    if count > 1:
        areas = stats[1:, cv2.CC_STAT_AREA]
        threshold = max(24, int(width * height * 0.003))
        keep = {
            index + 1
            for index, area in enumerate(areas)
            if area >= threshold
        }
        alpha = np.where(np.isin(labels, list(keep)), 255, 0).astype(np.uint8)
    kernel = np.ones((5, 5), np.uint8)
    alpha = cv2.morphologyEx(alpha, cv2.MORPH_CLOSE, kernel, iterations=2)
    alpha = cv2.GaussianBlur(alpha, (7, 7), 1.8)
    ys, xs = np.where(alpha > 20)
    if len(xs) == 0 or len(ys) == 0:
        alpha = np.zeros((height, width), dtype=np.uint8)
        cv2.ellipse(
            alpha,
            (width // 2, height // 2),
            (int(width * 0.43), int(height * 0.43)),
            0,
            0,
            360,
            255,
            -1,
        )
        ys, xs = np.where(alpha > 20)
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    padding = max(8, int(max(x1 - x0, y1 - y0) * 0.06))
    x0 = max(0, x0 - padding)
    y0 = max(0, y0 - padding)
    x1 = min(width, x1 + padding)
    y1 = min(height, y1 + padding)
    rgb = cv2.cvtColor(image[y0:y1, x0:x1], cv2.COLOR_BGR2RGB)
    rgba = np.dstack((rgb, alpha[y0:y1, x0:x1]))
    output.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, "RGBA").save(
        output,
        format="WEBP",
        quality=92,
        method=6,
    )
def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--ids", nargs="*")
    args = parser.parse_args()
    if args.ids:
        ingredient_ids = args.ids
    elif args.all:
        custom_ids = {
            path.name.removeprefix("ingredient-custom-").removesuffix(".webp")
            for path in IMAGE_ROOT.glob("ingredient-custom-*.webp")
        }
        original_ids = {
            path.name.removeprefix("ingredient-").removesuffix(".webp")
            for path in IMAGE_ROOT.glob("ingredient-*.webp")
            if not path.name.startswith("ingredient-custom-")
        }
        ingredient_ids = sorted(custom_ids | original_ids)
    else:
        ingredient_ids = FEATURED_IDS
    for ingredient_id in ingredient_ids:
        source = source_for(ingredient_id)
        if not source:
            print(f"skip {ingredient_id}: no photo")
            continue
        output = OUTPUT_ROOT / f"{ingredient_id}.webp"
        if output.exists():
            print(f"skip {output.relative_to(ROOT)}")
            continue
        cutout(source, output, ingredient_id)
        print(f"created {output.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
