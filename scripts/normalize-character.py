"""Remove chroma background and normalize a character portrait to 768x1152."""

from __future__ import annotations

import argparse
import runpy
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
ICON_TOOLS = runpy.run_path(str(ROOT / "scripts" / "normalize-cell-icon.py"))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    image = cv2.imread(str(args.input), cv2.IMREAD_COLOR)
    if image is None:
        raise RuntimeError(f"Unable to read {args.input}")
    alpha, background = ICON_TOOLS["chroma_mask"](image)
    rgba = cv2.cvtColor(image, cv2.COLOR_BGR2RGBA)
    rgba[..., 3] = alpha
    rgba = ICON_TOOLS["despill"](rgba, background)

    ys, xs = np.where(rgba[..., 3] > 12)
    if len(xs) == 0 or len(ys) == 0:
        raise RuntimeError("No character foreground survived chroma removal")
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    subject = Image.fromarray(rgba[y0:y1, x0:x1], "RGBA")

    canvas_width, canvas_height = 768, 1152
    scale = min(
        (canvas_width * 0.88) / subject.width,
        (canvas_height * 0.94) / subject.height,
    )
    subject = subject.resize(
        (
            max(1, round(subject.width * scale)),
            max(1, round(subject.height * scale)),
        ),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (canvas_width, canvas_height), (0, 0, 0, 0))
    x = (canvas_width - subject.width) // 2
    y = canvas_height - subject.height - max(12, int(canvas_height * 0.025))
    canvas.alpha_composite(subject, (x, y))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(args.out)
    print(f"saved {args.out}")


if __name__ == "__main__":
    main()
