"""Validate the Xia Mi character portraits and the dragon transition sequence."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
CHARACTER = ROOT / "assets" / "character"
EXPECTED = (
    "normal_xiami_01.png",
    "normal_xiami_02.png",
    "normal_xiami_03.png",
    "normal_xiami_04.png",
    "correct_xiami.png",
    "pre_error_xiami.png",
    "transform_01.png",
    "transform_02.png",
    "transform_03.png",
    "yemengjiade.png",
)
TRANSITION = (
    "pre_error_xiami.png",
    "transform_01.png",
    "transform_02.png",
    "transform_03.png",
    "yemengjiade.png",
)


def main() -> None:
    errors: list[str] = []
    images: dict[str, Image.Image] = {}
    for name in EXPECTED:
        path = CHARACTER / name
        if not path.exists():
            errors.append(f"missing: {name}")
            continue
        image = Image.open(path)
        if image.size != (768, 1152):
            errors.append(f"size: {name} {image.size}")
        if image.mode != "RGBA":
            errors.append(f"mode: {name} {image.mode}")
            continue
        alpha = image.getchannel("A")
        if alpha.getbbox() is None:
            errors.append(f"empty: {name}")
            continue
        if alpha.getextrema()[0] != 0:
            errors.append(f"no transparent pixels: {name}")
        if name == "yemengjiade.png":
            bounds = alpha.getbbox()
            if bounds:
                width = bounds[2] - bounds[0]
                height = bounds[3] - bounds[1]
                silhouette_ratio = width / max(1, height)
                if not 0.35 <= silhouette_ratio <= 0.8:
                    errors.append(
                        "yemengjiade silhouette must be a humanoid portrait, "
                        f"not a wide serpent: {silhouette_ratio:.3f}"
                    )
        images[name] = image.copy()

    differences: list[dict[str, float]] = []
    for before, after in zip(TRANSITION, TRANSITION[1:]):
        if before not in images or after not in images:
            continue
        left = np.asarray(images[before], dtype=np.int16)
        right = np.asarray(images[after], dtype=np.int16)
        mean_difference = float(np.abs(left - right).mean() / 255)
        differences.append(
            {
                "from": before,
                "to": after,
                "normalizedPixelDifference": round(mean_difference, 4),
            }
        )
        if mean_difference < 0.015:
            errors.append(f"transition too similar: {before} -> {after}")

    manifest = {
        "canvas": [768, 1152],
        "format": "PNG",
        "background": "transparent",
        "normal": EXPECTED[:4],
        "correct": EXPECTED[4],
        "transition": [
            {"atSeconds": 0, "file": "pre_error_xiami.png"},
            {"atSeconds": 0.3, "file": "transform_01.png"},
            {"atSeconds": 0.6, "file": "transform_02.png"},
            {"atSeconds": 1, "file": "transform_03.png"},
            {"atSeconds": 1.1, "file": "yemengjiade.png"},
        ],
        "differences": differences,
    }
    (ROOT / "assets" / "character_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "files": len(EXPECTED),
                "dimensions": [768, 1152],
                "differences": differences,
                "errors": errors,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
