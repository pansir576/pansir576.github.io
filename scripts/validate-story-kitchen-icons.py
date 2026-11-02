"""Validate the isolated story-kitchen icon namespace and manifest."""

from __future__ import annotations

import json
import runpy
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
DEFINITIONS = runpy.run_path(
    str(ROOT / "scripts" / "generate-cell-icons.py")
)
OUTPUT = ROOT / "assets" / "story-kitchen"
STATES = ("normal", "click", "success", "error")


def validate_group(prefix: str, names: list[str]) -> tuple[list[dict], list[str]]:
    directory = OUTPUT / f"{prefix}s"
    entries: list[dict] = []
    errors: list[str] = []
    for name in names:
        for state in STATES:
            path = directory / f"{prefix}_{name}_{state}.png"
            if not path.exists():
                errors.append(f"missing: {path.relative_to(ROOT)}")
                continue
            with Image.open(path) as image:
                if image.size != (512, 512):
                    errors.append(f"size: {path.name} {image.size}")
                if image.mode != "RGBA":
                    errors.append(f"mode: {path.name} {image.mode}")
                    continue
                bounds = image.getchannel("A").getbbox()
                if bounds is None:
                    errors.append(f"empty alpha: {path.name}")
                    continue
                x0, y0, x1, y1 = bounds
                if x0 == 0 or y0 == 0 or x1 == 512 or y1 == 512:
                    errors.append(f"touches canvas: {path.name} {bounds}")
                if state == "normal":
                    coverage = max(x1 - x0, y1 - y0) / 512
                    if not 0.67 <= coverage <= 0.88:
                        errors.append(
                            f"coverage: {path.name} {coverage:.3f}"
                        )
        entries.append(
            {
                "id": name,
                "states": {
                    state: (
                        f"assets/story-kitchen/{prefix}s/"
                        f"{prefix}_{name}_{state}.png"
                    )
                    for state in STATES
                },
            }
        )
    return entries, errors


def main() -> None:
    ingredients, ingredient_errors = validate_group(
        "ingredient",
        list(DEFINITIONS["INGREDIENTS"]),
    )
    tools, tool_errors = validate_group(
        "tool",
        list(DEFINITIONS["TOOLS"]),
    )
    errors = ingredient_errors + tool_errors
    manifest_path = OUTPUT / "icon_manifest.json"
    expected_manifest = {
        "size": [512, 512],
        "format": "PNG",
        "background": "transparent",
        "states": list(STATES),
        "ingredients": ingredients,
        "tools": tools,
    }
    if not manifest_path.exists():
        errors.append("missing: assets/story-kitchen/icon_manifest.json")
    else:
        actual_manifest = json.loads(manifest_path.read_text("utf-8"))
        if actual_manifest != expected_manifest:
            errors.append("manifest does not match generated asset set")

    print(
        json.dumps(
            {
                "ingredients": len(ingredients),
                "tools": len(tools),
                "files": (len(ingredients) + len(tools)) * len(STATES),
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
