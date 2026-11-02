"""Validate the 99-story-step asset set and its manifest."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
STATES = ("normal", "click", "success", "error")
HOTSPOTS = {
    "fridge",
    "sink",
    "cutting_board",
    "stove",
    "seasoning",
    "plate",
}


def main() -> None:
    manifest_path = ROOT / "assets" / "story_state_manifest.json"
    manifest = json.loads(manifest_path.read_text("utf-8"))
    bounds_path = ROOT / "assets" / "story_object_bounds.json"
    bounds_manifest = json.loads(bounds_path.read_text("utf-8"))
    saved_bounds = bounds_manifest.get("steps", {})
    errors: list[str] = []
    expected: set[Path] = set()
    recipes = manifest.get("recipes", [])
    steps = [step for recipe in recipes for step in recipe["steps"]]
    if len(recipes) != 25:
        errors.append(f"recipe count: {len(recipes)}")
    if len(steps) != 99:
        errors.append(f"step count: {len(steps)}")
    if sum(1 for step in steps if step.get("question")) != 25:
        errors.append("each recipe must contain exactly one light question")

    for recipe in recipes:
        questions = [step for step in recipe["steps"] if step.get("question")]
        if len(questions) != 1:
            errors.append(f"question count recipe {recipe['id']}: {len(questions)}")
        for step in recipe["steps"]:
            if step.get("hotspot") not in HOTSPOTS:
                errors.append(f"hotspot: {recipe['id']}-{step['stepId']}")
            story_object = step.get("object", {})
            label = str(story_object.get("label", "")).strip()
            action = str(story_object.get("action", "")).strip()
            prompt = str(story_object.get("prompt", "")).strip()
            if not label or not action or label not in prompt or action not in prompt:
                errors.append(f"object prompt: {recipe['id']}-{step['stepId']}")
            if any(
                phrase in prompt
                for phrase in ("点击此处", "当前操作区域", "当前区域", "点击高亮区域", "盘中中的")
            ):
                errors.append(f"generic prompt: {recipe['id']}-{step['stepId']}")

            state_bounds = []
            for state in STATES:
                relative = step["states"][state]
                expected.add(ROOT / relative)
                path = ROOT / relative
                if not path.exists():
                    errors.append(f"missing: {relative}")
                    continue
                with Image.open(path) as image:
                    if image.size != (512, 512):
                        errors.append(f"size: {path.name} {image.size}")
                    if image.mode != "RGBA":
                        errors.append(f"mode: {path.name} {image.mode}")
                        continue
                    alpha = image.getchannel("A")
                    state_bounds.append(alpha.getbbox())
                    if state_bounds[-1] is None:
                        errors.append(f"empty alpha: {path.name}")
                        continue
                    bounds = state_bounds[-1]
                    if (
                        bounds[0] == 0
                        or bounds[1] == 0
                        or bounds[2] == 512
                        or bounds[3] == 512
                    ):
                        errors.append(f"touches canvas: {path.name} {bounds}")
            if all(state_bounds):
                union = (
                    min(box[0] for box in state_bounds if box),
                    min(box[1] for box in state_bounds if box),
                    max(box[2] for box in state_bounds if box),
                    max(box[3] for box in state_bounds if box),
                )
                saved = saved_bounds.get(f"{recipe['id']}-{step['stepId']}")
                expected_bounds = {
                    "x": round(union[0] / 512, 6),
                    "y": round(union[1] / 512, 6),
                    "width": round((union[2] - union[0]) / 512, 6),
                    "height": round((union[3] - union[1]) / 512, 6),
                }
                if saved != expected_bounds:
                    errors.append(
                        f"alpha bounds: {recipe['id']}-{step['stepId']} "
                        f"expected {expected_bounds}, got {saved}"
                    )

    actual = set((ROOT / "assets" / "food_state").glob("*.png"))
    unexpected = sorted(path.name for path in actual - expected)
    if unexpected:
        errors.append(f"unexpected food_state files: {', '.join(unexpected[:20])}")

    print(
        json.dumps(
            {
                "recipes": len(recipes),
                "steps": len(steps),
                "files": len(expected),
                "questions": sum(1 for step in steps if step.get("question")),
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
