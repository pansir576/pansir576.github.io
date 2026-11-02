"""Generate and normalize the cel-shaded ingredient and tool icon library."""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
COMFY = Path(r"D:\codex-ai\comfy_run.py")
PYTHON = Path(r"D:\codex-ai\venv-flux\Scripts\python.exe")
NORMALIZE_PYTHON = Path(r"D:\codex-ai\venv\Scripts\python.exe")
NORMALIZER = ROOT / "scripts" / "normalize-cell-icon.py"

INGREDIENTS = {
    "greens": "a small cluster of Shanghai bok choy",
    "potato": "one whole brown potato with a few eyes",
    "egg": "one whole brown chicken egg",
    "tomato": "one fresh red tomato with a small green stem",
    "tofu": "one neat cube of soft white tofu floating alone, no plate or container",
    "beef": "one clean slab of raw beef tenderloin",
    "pork": "one clean slab of raw pork belly",
    "fish": "one whole silver sea bass",
    "pork-loin": "one clean cut of raw pork loin floating alone, no plate or tray",
    "pork-ribs": "a small rack of raw pork ribs",
    "beef-brisket": "one clean piece of raw beef brisket",
    "beef-shank": "one clean cut of raw beef shank",
    "lamb-leg": "one clean raw lamb leg cut",
    "lamb-chop": "one raw lamb chop",
    "chicken-breast": "one clean raw chicken breast floating alone, no plate or tray",
    "chicken-thigh": "one clean raw chicken thigh",
    "whole-chicken": "one whole raw chicken floating alone, no plate or platter",
    "duck-leg": "one clean raw duck leg",
    "old-duck": "one clean raw mature duck",
    "grass-carp": "one whole silver grass carp",
    "crucian-carp": "one whole silver crucian carp",
    "shrimp": "one raw shrimp with shell and tail",
    "clam": "one closed fresh clam shell",
    "squid": "one fresh whole squid",
    "napa-cabbage": "one compact napa cabbage",
    "spinach": "a small bundle of fresh spinach",
    "youmaicai": "a small bundle of fresh Indian lettuce",
    "lettuce": "one fresh head of lettuce",
    "chives": "a small neat bundle of fresh chives",
    "cilantro": "a small neat bundle of fresh cilantro",
    "celery": "two fresh celery stalks with leaves",
    "water-spinach": "a small bundle of fresh water spinach",
    "cucumber": "one fresh green cucumber",
    "winter-melon": "one wedge of pale green winter melon floating alone, no plate",
    "pumpkin": "one wedge of orange pumpkin",
    "luffa": "one fresh green luffa gourd",
    "eggplant": "one glossy purple eggplant",
    "green-pepper": "one fresh green chili pepper",
    "bell-pepper": "one fresh red bell pepper",
    "carrot": "one fresh orange carrot",
    "daikon": "one fresh white daikon radish",
    "lotus-root": "one pale lotus root cross-section slice with many circular holes",
    "yam": "one long cylindrical beige Chinese yam root with thin bark",
    "taro": "one oval brown taro root with rough skin and a short stem",
    "celtuce": "one thick pale-green celtuce stem with a small leafy top",
    "shiitake": "three fresh shiitake mushrooms",
    "enoki": "one small bundle of enoki mushrooms",
    "king-oyster": "two king oyster mushrooms",
    "wood-ear": "a small cluster of wood ear mushrooms",
    "firm-tofu": "one neat block of firm white tofu floating alone, no plate or container",
    "dried-tofu": "one flat square of golden dried tofu with grid score marks, no plate",
    "yuba": "a small folded sheet of fresh yuba",
    "glass-noodles": "a small neat loose bundle of dry transparent glass noodles, no plate",
    "vermicelli": "a small neat bundle of dry rice vermicelli",
    "bamboo-shoots": "one fresh bamboo shoot",
}

TOOLS = {
    "knife": "one Japanese-style kitchen chef knife",
    "cutting_board": "one rectangular wooden cutting board",
    "bowl": "one white ceramic mixing bowl",
    "whisk": "one metal kitchen whisk",
    "wok": "one black carbon steel wok",
    "spatula": "one metal cooking spatula",
    "plate": "one white round dinner plate",
}

POSITIVE = (
    "Japanese anime cel-shaded cooking game inventory icon, {subject}, "
    "single object centered, crisp clean dark outline, simple flat color blocks, "
    "restrained minimal soft shadow, recognizable silhouette, subject fills 78 percent "
    "of the square with even margin, isolated on perfectly flat pure magenta background, "
    "no text, no UI, no plate, no extra objects. Not photorealistic, no photographic "
    "texture, no depth of field, no 3D render, no thick paint, no oil painting, "
    "no complex texture."
)

NEGATIVE = (
    "photorealistic, photograph, realistic food, 3D render, depth of field, blur, "
    "thick paint, oil painting, complex texture, extra objects, plate, text, watermark, "
    "clutter, multiple compositions, cropped subject"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--group", choices=["ingredients", "tools", "all"], default="all")
    parser.add_argument("--start", default=0, type=int)
    parser.add_argument("--limit", default=0, type=int)
    parser.add_argument("--seed-offset", default=0, type=int)
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def generate_one(
    prefix: str,
    name: str,
    subject: str,
    seed: int,
    force: bool,
) -> None:
    out_dir = ROOT / "assets" / f"{prefix}s"
    raw_dir = ROOT / "assets" / "reference" / "icon-raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    out_dir.mkdir(parents=True, exist_ok=True)
    final = out_dir / f"{prefix}_{name}_normal.png"
    if final.exists() and not force:
        print(f"skip {prefix}_{name}")
        return

    raw = raw_dir / f"{prefix}_{name}_raw.png"
    if not raw.exists() or force:
        command = [
            str(PYTHON),
            str(COMFY),
            "--prompt",
            POSITIVE.format(subject=subject),
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
            str(seed),
        ]
        subprocess.run(command, check=True)

    subprocess.run(
        [
            str(NORMALIZE_PYTHON),
            str(NORMALIZER),
            "--input",
            str(raw),
            "--name",
            name,
            "--out-dir",
            str(out_dir),
            "--prefix",
            prefix,
        ],
        check=True,
    )
    print(f"saved {prefix}_{name}")


def main() -> None:
    args = parse_args()
    definitions: list[tuple[str, str, str]] = []
    if args.group in {"ingredients", "all"}:
        definitions.extend(
            ("ingredient", name, subject)
            for name, subject in INGREDIENTS.items()
        )
    if args.group in {"tools", "all"}:
        definitions.extend(
            ("tool", name, subject)
            for name, subject in TOOLS.items()
        )

    definitions = definitions[args.start :]
    if args.limit:
        definitions = definitions[: args.limit]
    for index, (prefix, name, subject) in enumerate(definitions, start=args.start):
        generate_one(
            prefix,
            name,
            subject,
            2000 + index + args.seed_offset,
            args.force,
        )


if __name__ == "__main__":
    main()
