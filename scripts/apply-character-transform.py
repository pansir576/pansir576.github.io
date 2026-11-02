"""Normalize keyframes and add deterministic eye, scale and aura overlays."""

from __future__ import annotations

import argparse
import runpy
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parent.parent
ICON_TOOLS = runpy.run_path(str(ROOT / "scripts" / "normalize-cell-icon.py"))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--stage", required=True, choices=["1", "2", "3"])
    return parser.parse_args()


def normalize(input_path: Path) -> Image.Image:
    image = cv2.imread(str(input_path), cv2.IMREAD_COLOR)
    if image is None:
        raise RuntimeError(f"Unable to read {input_path}")
    alpha, background = ICON_TOOLS["chroma_mask"](image)
    rgba = cv2.cvtColor(image, cv2.COLOR_BGR2RGBA)
    rgba[..., 3] = alpha
    rgba = ICON_TOOLS["despill"](rgba, background)
    ys, xs = np.where(rgba[..., 3] > 12)
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    subject = Image.fromarray(rgba[y0:y1, x0:x1], "RGBA")
    scale = min(768 * 0.88 / subject.width, 1152 * 0.94 / subject.height)
    subject = subject.resize(
        (
            max(1, round(subject.width * scale)),
            max(1, round(subject.height * scale)),
        ),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (768, 1152), (0, 0, 0, 0))
    canvas.alpha_composite(
        subject,
        ((768 - subject.width) // 2, 1152 - subject.height - 28),
    )
    return canvas


def add_aura(image: Image.Image, stage: int) -> Image.Image:
    alpha = image.getchannel("A")
    spread = {1: 9, 2: 15, 3: 24}[stage]
    glow_alpha = alpha.filter(ImageFilter.MaxFilter(spread * 2 + 1)).filter(
        ImageFilter.GaussianBlur(spread)
    )
    strength = {1: 0.24, 2: 0.36, 3: 0.52}[stage]
    glow = Image.new("RGBA", image.size, (142, 24, 36, 0))
    glow.putalpha(glow_alpha.point(lambda value: int(value * strength)))
    output = Image.new("RGBA", image.size, (0, 0, 0, 0))
    output.alpha_composite(glow)
    output.alpha_composite(image)
    return output


def add_scales(image: Image.Image, stage: int) -> Image.Image:
    pixels = np.array(image)
    height, width = pixels.shape[:2]
    red = pixels[..., 0].astype(np.int16)
    green = pixels[..., 1].astype(np.int16)
    blue = pixels[..., 2].astype(np.int16)
    skin = (
        (red > 155)
        & (green > 90)
        & (blue > 112)
        & (red > green + 18)
        & (green > blue + 4)
    )
    region = np.zeros((height, width), dtype=bool)
    region[
        int(height * 0.23) : int(height * 0.34),
        int(width * 0.38) : int(width * 0.62),
    ] = True
    skin &= region & (pixels[..., 3] > 180)

    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    color = (111, 36, 43, 42 if stage == 2 else 64)
    size = 12
    row = 0
    for y in range(int(height * 0.23), int(height * 0.34), size):
        offset = 0 if row % 2 == 0 else size // 2
        for x in range(int(width * 0.39) + offset, int(width * 0.62), size):
            draw.arc(
                (x - size, y, x + size, y + size),
                200,
                340,
                fill=color,
                width=1,
            )
        row += 1

    pattern = np.array(overlay)
    pattern[..., 3] = np.where(skin, pattern[..., 3], 0)
    pattern_image = Image.fromarray(pattern, "RGBA")
    output = image.copy()
    output.alpha_composite(pattern_image)
    return output


def change_eyes(image: Image.Image) -> Image.Image:
    rgba = np.array(image)
    hsv = cv2.cvtColor(rgba[..., :3], cv2.COLOR_RGB2HSV)
    height, width = rgba.shape[:2]
    eye_region = np.zeros((height, width), dtype=bool)
    eye_region[
        int(height * 0.1) : int(height * 0.3),
        int(width * 0.25) : int(width * 0.75),
    ] = True
    gold = (
        (hsv[..., 0] >= 12)
        & (hsv[..., 0] <= 35)
        & (hsv[..., 1] >= 95)
        & (hsv[..., 2] >= 65)
    )
    mask = gold & eye_region & (rgba[..., 3] > 160)
    hsv[..., 0] = np.where(mask, 179, hsv[..., 0])
    hsv[..., 1] = np.where(mask, np.maximum(hsv[..., 1], 190), hsv[..., 1])
    rgba[..., :3] = cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)
    return Image.fromarray(rgba, "RGBA")


def darken_hair(image: Image.Image) -> Image.Image:
    rgba = np.array(image)
    hsv = cv2.cvtColor(rgba[..., :3], cv2.COLOR_RGB2HSV)
    height, width = rgba.shape[:2]
    hair_region = np.zeros((height, width), dtype=bool)
    hair_region[int(height * 0.03) : int(height * 0.31), int(width * 0.24) : int(width * 0.76)] = True
    hair_region[int(height * 0.15) : int(height * 0.67), int(width * 0.12) : int(width * 0.34)] = True
    hair_region[int(height * 0.15) : int(height * 0.67), int(width * 0.66) : int(width * 0.88)] = True
    hair_color = (
        (hsv[..., 0] >= 8)
        & (hsv[..., 0] <= 38)
        & (hsv[..., 1] >= 55)
        & (hsv[..., 2] >= 65)
    )
    mask = hair_region & hair_color & (rgba[..., 3] > 150)
    hsv[..., 1] = np.where(mask, np.minimum(255, hsv[..., 1] * 1.12), hsv[..., 1])
    hsv[..., 2] = np.where(mask, hsv[..., 2] * 0.78, hsv[..., 2])
    rgba[..., :3] = cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)
    return Image.fromarray(rgba, "RGBA")


def main() -> None:
    args = parse_args()
    stage = int(args.stage)
    image = normalize(args.input)
    if stage >= 1:
        image = add_aura(image, stage)
    if stage >= 2:
        image = add_scales(image, stage)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    image.save(args.out)
    print(f"saved {args.out}")


if __name__ == "__main__":
    main()
