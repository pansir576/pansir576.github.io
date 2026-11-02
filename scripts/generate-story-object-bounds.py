"""Generate tight transparent bounds for each four-state story object."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "assets" / "story_state_manifest.json"
OUTPUT = ROOT / "assets" / "story_object_bounds.json"
CANVAS = 512


def union_bounds(step: dict[str, object]) -> tuple[int, int, int, int]:
    boxes: list[tuple[int, int, int, int]] = []
    states = step["states"]
    assert isinstance(states, dict)
    for relative in states.values():
        with Image.open(ROOT / relative) as image:
            bounds = image.convert("RGBA").getchannel("A").getbbox()
        if bounds is None:
            raise ValueError(f"empty alpha: {relative}")
        boxes.append(bounds)
    return (
        min(box[0] for box in boxes),
        min(box[1] for box in boxes),
        max(box[2] for box in boxes),
        max(box[3] for box in boxes),
    )


def main() -> None:
    manifest = json.loads(MANIFEST.read_text("utf-8"))
    bounds: dict[str, dict[str, float]] = {}
    for recipe in manifest["recipes"]:
        for step in recipe["steps"]:
            key = f"{recipe['id']}-{step['stepId']}"
            left, top, right, bottom = union_bounds(step)
            bounds[key] = {
                "x": round(left / CANVAS, 6),
                "y": round(top / CANVAS, 6),
                "width": round((right - left) / CANVAS, 6),
                "height": round((bottom - top) / CANVAS, 6),
            }

    payload = {
        "canvas": [CANVAS, CANVAS],
        "source": "union alpha bounds of normal/click/success/error",
        "steps": bounds,
    }
    OUTPUT.write_text(
        f"{json.dumps(payload, ensure_ascii=False, indent=2)}\n",
        encoding="utf-8",
    )
    print(json.dumps({"steps": len(bounds), "output": OUTPUT.name}, indent=2))


if __name__ == "__main__":
    main()
