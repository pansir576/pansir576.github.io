"""Generate one four-state cooking asset for every canonical recipe step."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
COMFY = Path(r"D:\codex-ai\comfy_run.py")
PYTHON = Path(r"D:\codex-ai\venv-flux\Scripts\python.exe")
NORMALIZE_PYTHON = Path(r"D:\codex-ai\venv\Scripts\python.exe")
NORMALIZER = ROOT / "scripts" / "normalize-cell-icon.py"

INGREDIENT_NAMES = {
    "bamboo-shoots": "bamboo shoots",
    "beef": "beef",
    "beef-brisket": "beef brisket",
    "beef-shank": "beef shank",
    "bell-pepper": "red bell pepper",
    "carrot": "carrot",
    "chicken-thigh": "chicken thigh",
    "chives": "Chinese chives",
    "cucumber": "cucumber",
    "egg": "egg",
    "eggplant": "eggplant",
    "firm-tofu": "firm tofu",
    "fish": "sea bass",
    "garlic": "garlic",
    "glass-noodles": "glass noodles",
    "green-pepper": "green chili pepper",
    "greens": "leafy greens",
    "napa-cabbage": "napa cabbage",
    "pork": "pork belly",
    "pork-loin": "pork loin",
    "pork-ribs": "pork ribs",
    "potato": "potato",
    "shiitake": "shiitake mushrooms",
    "shrimp": "shrimp",
    "spinach": "spinach",
    "tofu": "soft tofu",
    "tomato": "tomato",
    "vermicelli": "rice vermicelli",
    "winter-melon": "winter melon",
    "wood-ear": "wood ear mushrooms",
    "youmaicai": "Indian lettuce",
}

CHINESE_INGREDIENT_NAMES = {
    "米饭": "cooked white rice",
    "西兰花": "broccoli florets",
    "四季豆": "green beans",
    "牛肉末": "ground beef",
    "牛腩": "beef brisket",
    "鲈鱼": "whole sea bass",
    "五花肉": "pork belly",
    "里脊肉": "pork loin",
    "鸡腿肉": "chicken thigh",
    "老豆腐": "firm tofu",
    "豆腐": "soft tofu",
    "青椒": "green chili pepper",
    "白菜": "napa cabbage",
    "虾": "shrimp",
    "排骨": "pork ribs",
    "粉丝": "glass noodles",
}

RECIPE_NAMES_EN = {
    1: "stir-fried shredded potato",
    2: "tomato scrambled eggs",
    3: "garlic Indian lettuce",
    4: "hot and sour shredded potato",
    5: "braised eggplant",
    6: "smashed cucumber salad",
    7: "stir-fried broccoli",
    8: "dry-fried green beans",
    9: "pepper pork stir-fry",
    10: "fish-fragrant pork shreds",
    11: "potato beef stew",
    12: "tomato beef brisket",
    13: "red-braised pork belly",
    14: "twice-cooked pork",
    15: "Kung Pao chicken",
    16: "braised chicken with shiitake",
    17: "steamed sea bass",
    18: "poached shrimp",
    19: "garlic glass noodles with shrimp",
    20: "home-style tofu",
    21: "Mapo tofu",
    22: "chive scrambled eggs",
    23: "spinach tofu soup",
    24: "winter melon pork rib soup",
    25: "egg fried rice",
}

SEASONING_NAMES = {
    "salt": "salt",
    "vinegar": "vinegar",
    "sugar": "sugar",
    "light-soy": "light soy sauce",
    "dark-soy": "dark soy sauce",
    "wine": "cooking wine",
    "doubanjiang": "chili bean paste",
    "sichuan-pepper": "Sichuan pepper",
    "star-anise": "star anise",
    "oil": "cooking oil",
    "starch": "starch",
    "chili": "dried chili",
    "garlic": "garlic",
    "scallion": "scallion",
    "ginger": "ginger",
}

CONTAINER = {
    "sink": "the prepared raw ingredients arranged as an isolated composition with a few clean water droplets",
    "cutting_board": "the prepared ingredients arranged as an isolated cooking stage on a small wooden cutting board",
    "stove": "the cooking mixture in a black carbon steel wok, shown as an isolated cooking-stage asset",
    "seasoning": "the seasoned mixture in a small white ceramic bowl, shown as an isolated cooking-stage asset",
    "plate": "the finished dish plated on a white round dinner plate, shown as an isolated cooking-stage asset",
}

POSITIVE = (
    "Japanese anime cel-shaded cooking game process icon. {subject}. "
    "{container}. Single clear cooking stage centered, recognizable ingredients "
    "and cooking state, crisp clean dark outline, flat color blocks, restrained "
    "soft shadow, subject fills 78 percent of the square with even margin, "
    "isolated on perfectly flat pure magenta background. No character, no hands, "
    "no text, no UI, no labels, no watermark, no extra dishes, no clutter. "
    "Not photorealistic, no photographic texture, no depth of field, no 3D render, "
    "no thick paint, no oil painting."
)

NEGATIVE = (
    "photorealistic, photograph, realistic food, 3D render, depth of field, blur, "
    "thick paint, oil painting, complex texture, character, hands, multiple plates, "
    "extra objects, text, labels, watermark, clutter, cropped subject"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", default=0, type=int)
    parser.add_argument("--limit", default=0, type=int)
    parser.add_argument("--seed-offset", default=0, type=int)
    parser.add_argument("--only", default="")
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def ingredient_subject(step: dict) -> str:
    names: list[str] = []
    for ingredient in step["ingredients"]:
        if ingredient.get("name") in CHINESE_INGREDIENT_NAMES:
            names.append(CHINESE_INGREDIENT_NAMES[ingredient["name"]])
            continue
        key = (
            ingredient.get("ingredientId")
            or ingredient.get("modifierId")
            or ingredient.get("seasoningId")
        )
        if key:
            name = INGREDIENT_NAMES.get(key) or SEASONING_NAMES.get(key)
            if name:
                names.append(name)
        elif ingredient.get("name"):
            names.append(ingredient["name"])
    unique = list(dict.fromkeys(names))
    return ", ".join(unique[:6])


def main() -> None:
    args = parse_args()
    manifest = json.loads(
        (ROOT / "assets" / "story_state_manifest.json").read_text("utf-8")
    )
    canonical_recipes = {
        recipe["id"]: recipe
        for recipe in json.loads(
            (ROOT / "src" / "lib" / "recipe-data.json").read_text("utf-8")
        )
    }
    definitions = [
        (recipe, step)
        for recipe in manifest["recipes"]
        for step in recipe["steps"]
    ]
    if args.only:
        requested = {
            item.strip()
            for item in args.only.split(",")
            if item.strip()
        }
        definitions = [
            (recipe, step)
            for recipe, step in definitions
            if f"recipe_{recipe['id']}_step_{step['stepId']}" in requested
        ]
    definitions = definitions[args.start :]
    if args.limit:
        definitions = definitions[: args.limit]

    raw_dir = ROOT / "assets" / "reference" / "food-state-raw"
    out_dir = ROOT / "assets" / "food_state"
    raw_dir.mkdir(parents=True, exist_ok=True)
    out_dir.mkdir(parents=True, exist_ok=True)

    for index, (recipe, step) in enumerate(definitions, start=args.start):
        stem = f"recipe_{recipe['id']}_step_{step['stepId']}"
        final = out_dir / f"state_food_{stem}_normal.png"
        if final.exists() and not args.force:
            print(f"skip {stem}", flush=True)
            continue

        raw = raw_dir / f"state_food_{stem}_raw.png"
        if not raw.exists() or args.force:
            recipe_ingredients = ingredient_subject(
                canonical_recipes[recipe["id"]]
            )
            step_description = re.sub(r"\s+", " ", step["description"]).strip()
            prompt = POSITIVE.format(
                subject=(
                    f"{RECIPE_NAMES_EN.get(recipe['id'], recipe['name'])} "
                    f"cooking stage. Ingredients: "
                    f"{recipe_ingredients}. Current step: {step_description}"
                ),
                container=CONTAINER[step["hotspot"]],
            )
            subprocess.run(
                [
                    str(PYTHON),
                    str(COMFY),
                    "--prompt",
                    prompt,
                    "--negative",
                    NEGATIVE,
                    "--out",
                    str(raw),
                    "--width",
                    "512",
                    "--height",
                    "512",
                    "--steps",
                    "4",
                    "--seed",
                    str(4000 + index + args.seed_offset),
                ],
                check=True,
            )

        subprocess.run(
            [
                str(NORMALIZE_PYTHON),
                str(NORMALIZER),
                "--input",
                str(raw),
                "--name",
                stem,
                "--out-dir",
                str(out_dir),
                "--prefix",
                "state_food",
                "--coverage",
                "0.78",
            ],
            check=True,
        )
        print(f"saved {stem}", flush=True)

    print(
        json.dumps(
            {
                "generatedOrChecked": len(definitions),
                "completed": sum(
                    1
                    for recipe, step in definitions
                    if (
                        out_dir
                        / f"state_food_recipe_{recipe['id']}_step_{step['stepId']}_normal.png"
                    ).exists()
                ),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
