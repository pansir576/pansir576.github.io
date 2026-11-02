"""Turn a chroma-keyed generated illustration into four normalized UI states."""

from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageFilter


STATE_COLORS = {
    "click": (255, 207, 92),
    "success": (106, 220, 143),
    "error": (239, 92, 78),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--name", required=True)
    parser.add_argument("--out-dir", required=True, type=Path)
    parser.add_argument("--prefix", default="ingredient")
    parser.add_argument("--size", default=512, type=int)
    parser.add_argument("--coverage", default=0.76, type=float)
    parser.add_argument("--fill-holes", action="store_true")
    return parser.parse_args()


def fill_alpha_holes(mask: np.ndarray) -> np.ndarray:
    binary = np.where(mask > 0, 255, 0).astype(np.uint8)
    height, width = binary.shape
    flood = binary.copy()
    flood_mask = np.zeros((height + 2, width + 2), dtype=np.uint8)
    cv2.floodFill(flood, flood_mask, (0, 0), 255)
    holes = cv2.bitwise_not(flood)
    return cv2.bitwise_or(binary, holes)


def chroma_mask(
    image: np.ndarray,
    fill_holes: bool = False,
) -> tuple[np.ndarray, np.ndarray]:
    height, width = image.shape[:2]
    border = np.concatenate(
        [
            image[:8].reshape(-1, 3),
            image[-8:].reshape(-1, 3),
            image[:, :8].reshape(-1, 3),
            image[:, -8:].reshape(-1, 3),
        ]
    )
    background = np.median(border, axis=0).astype(np.float32)
    distance = np.linalg.norm(image.astype(np.float32) - background, axis=2)
    distance = np.clip((distance - 22) / 34, 0, 1)
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    chroma_shadow = (
        (hsv[..., 0] >= 155)
        & (hsv[..., 1] >= 70)
        & (image[..., 0] >= 60)
    )
    distance[chroma_shadow] = 0

    grabcut = np.full((height, width), cv2.GC_PR_BGD, dtype=np.uint8)
    grabcut[distance > 0.55] = cv2.GC_PR_FGD
    grabcut[distance > 0.92] = cv2.GC_FGD
    grabcut[:12, :] = cv2.GC_BGD
    grabcut[-12:, :] = cv2.GC_BGD
    grabcut[:, :12] = cv2.GC_BGD
    grabcut[:, -12:] = cv2.GC_BGD
    background_model = np.zeros((1, 65), np.float64)
    foreground_model = np.zeros((1, 65), np.float64)
    cv2.grabCut(
        image,
        grabcut,
        None,
        background_model,
        foreground_model,
        5,
        cv2.GC_INIT_WITH_MASK,
    )
    mask = np.where(
        (grabcut == cv2.GC_FGD) | (grabcut == cv2.GC_PR_FGD),
        255,
        0,
    ).astype(np.uint8)
    mask = cv2.erode(mask, np.ones((3, 3), np.uint8), iterations=1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    core = cv2.erode(mask, np.ones((3, 3), np.uint8), iterations=6)
    magenta_fringe = (hsv[..., 0] >= 135) & (hsv[..., 1] >= 50)
    mask[(core == 0) & magenta_fringe] = 0
    if fill_holes:
        mask = fill_alpha_holes(mask)
    mask = cv2.GaussianBlur(mask, (5, 5), 0.9)
    near_background = (
        np.linalg.norm(image.astype(np.float32) - background, axis=2) < 30
    )
    mask[near_background] = 0

    count, labels, stats, _ = cv2.connectedComponentsWithStats(
        (mask > 18).astype(np.uint8),
        8,
    )
    keep = np.zeros_like(mask)
    minimum_area = max(80, int(width * height * 0.0015))
    for index in range(1, count):
        if stats[index, cv2.CC_STAT_AREA] >= minimum_area:
            keep[labels == index] = mask[labels == index]
    soft_distance = np.clip((distance - 0.12) / 0.35, 0, 1) * 255
    keep = np.minimum(keep, soft_distance.astype(np.uint8))
    return keep, background


def despill(rgba: np.ndarray, background: np.ndarray) -> np.ndarray:
    result = rgba.copy()
    alpha = result[..., 3:4].astype(np.float32) / 255
    rgb = result[..., :3].astype(np.float32)
    safe_alpha = np.maximum(alpha, 0.08)
    recovered = (rgb - (1 - alpha) * background) / safe_alpha
    blend = np.clip((0.92 - alpha) / 0.92, 0, 1)
    rgb = rgb * (1 - blend) + recovered * blend
    limit = np.maximum(rgb[..., 0], rgb[..., 1]) + 6
    magenta_spill = (rgb[..., 2] > limit) & (rgb[..., 0] > rgb[..., 1] + 12)
    rgb[..., 2] = np.where(magenta_spill, limit, rgb[..., 2])
    result[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    result[..., 3] = (alpha[..., 0] * 255).astype(np.uint8)
    return result


def normalize_subject(rgba: np.ndarray, size: int, coverage: float) -> Image.Image:
    alpha = rgba[..., 3]
    ys, xs = np.where(alpha > 10)
    if len(xs) == 0 or len(ys) == 0:
        raise ValueError("No foreground pixels survived chroma removal")

    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    subject = rgba[y0:y1, x0:x1]
    subject_image = Image.fromarray(subject, "RGBA")
    width, height = subject_image.size
    target = int(size * coverage)
    scale = min(target / width, target / height)
    resized = subject_image.resize(
        (max(1, round(width * scale)), max(1, round(height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(
        resized,
        ((size - resized.width) // 2, (size - resized.height) // 2),
    )
    return canvas


def glow_layer(base: Image.Image, color: tuple[int, int, int], radius: int) -> Image.Image:
    alpha = base.getchannel("A")
    expanded = alpha.filter(ImageFilter.MaxFilter(radius * 2 + 1))
    blurred = expanded.filter(ImageFilter.GaussianBlur(radius))
    glow = Image.new("RGBA", base.size, (*color, 0))
    glow.putalpha(blurred.point(lambda value: int(value * 0.46)))
    output = Image.new("RGBA", base.size, (0, 0, 0, 0))
    output.alpha_composite(glow)
    output.alpha_composite(base)
    return output


def outlined(base: Image.Image, color: tuple[int, int, int], width: int) -> Image.Image:
    alpha = base.getchannel("A")
    expanded = alpha.filter(ImageFilter.MaxFilter(width * 2 + 1))
    outline = Image.new("RGBA", base.size, (*color, 0))
    outline.putalpha(expanded.point(lambda value: int(value * 0.9)))
    output = Image.new("RGBA", base.size, (0, 0, 0, 0))
    output.alpha_composite(outline)
    output.alpha_composite(base)
    return output


def main() -> None:
    args = parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    image = cv2.imread(str(args.input), cv2.IMREAD_COLOR)
    if image is None:
        raise RuntimeError(f"Unable to read {args.input}")

    alpha, background = chroma_mask(image, fill_holes=args.fill_holes)
    rgba = cv2.cvtColor(image, cv2.COLOR_BGR2RGBA)
    rgba[..., 3] = alpha
    rgba = despill(rgba, background)
    normal = normalize_subject(rgba, args.size, args.coverage)

    normal.save(args.out_dir / f"{args.prefix}_{args.name}_normal.png")
    glow_layer(normal, STATE_COLORS["click"], 8).save(
        args.out_dir / f"{args.prefix}_{args.name}_click.png"
    )
    glow_layer(normal, STATE_COLORS["success"], 8).save(
        args.out_dir / f"{args.prefix}_{args.name}_success.png"
    )
    error = glow_layer(normal, STATE_COLORS["error"], 7)
    outlined(error, (255, 184, 168), 3).save(
        args.out_dir / f"{args.prefix}_{args.name}_error.png"
    )


if __name__ == "__main__":
    main()
