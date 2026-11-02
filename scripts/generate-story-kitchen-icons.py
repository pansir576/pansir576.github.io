"""Generate the isolated reference-styled icon set used by the story kitchen."""

from __future__ import annotations

import argparse
import hashlib
import json
import runpy
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
COMFY_RUNNER = Path(r"D:\codex-ai\comfy_run.py")
FLUX_PYTHON = Path(r"D:\codex-ai\venv-flux\Scripts\python.exe")
NORMALIZE_PYTHON = Path(r"D:\codex-ai\venv\Scripts\python.exe")
NORMALIZER = ROOT / "scripts" / "normalize-cell-icon.py"
DEFINITIONS = runpy.run_path(str(ROOT / "scripts" / "generate-cell-icons.py"))
OUTPUT = ROOT / "assets" / "story-kitchen"
RAW = ROOT / "assets" / "reference" / "story-kitchen-raw"
STATES = ("normal", "click", "success", "error")
SUBJECT_OVERRIDES = {
    "potato": (
        "one irregular raw potato tuber with rough tan skin, several natural "
        "growth buds and small dark skin blemishes, viewed from the side"
    ),
    "tofu": (
        "one clean solid cube of fresh white tofu with gently varied creamy "
        "surfaces and a fully opaque filled interior, no container"
    ),
    "knife": (
        "one complete Japanese chef knife with one broad stainless steel blade "
        "and one separate warm brown wooden handle, no engraving"
    ),
    "cutting_board": (
        "one completely empty rectangular wooden cutting board with warm grain, "
        "nothing placed on its surface"
    ),
    "bowl": (
        "one completely empty white ceramic mixing bowl with a clean hollow "
        "interior, no food or liquid inside"
    ),
    "whisk": (
        "one complete stainless-steel balloon whisk with a central handle and "
        "a full open loop cage, no dough, bread or food"
    ),
    "wok": (
        "one empty round black carbon steel wok with a single long wooden "
        "handle, no food"
    ),
    "plate": (
        "one completely empty white round dinner plate with a clean center, "
        "no food or object on it"
    ),
}

STYLE = (
    "Refined Japanese cookbook food specimen illustration for a cozy 2D cooking game. "
    "An inanimate food object, never a character: single {subject}, centered, "
    "three-quarter view, recognizable silhouette. Semi-realistic anime food art with "
    "sophisticated cel shading, layered brush shading, natural skin pores, fibers and "
    "surface texture, tasteful specular highlights, crisp warm dark-brown linework, "
    "and a restrained soft contact shadow. Detailed but appetizing, not photorealistic. "
    "Subject fills about 76 percent of the square with clean even margin. "
    "Absolutely no eyes, face, blush, mouth or limbs. "
    "Isolated on perfectly flat solid #FF00FF chroma background with no gradient, "
    "no vignette, no texture and no scene."
)

TOOL_STYLE = (
    "Refined Japanese cookbook kitchenware illustration for a cozy 2D cooking game. "
    "A single inanimate kitchen tool: {subject}. The tool is completely empty, "
    "clean and unoccupied, centered in three-quarter view with a recognizable "
    "silhouette. Semi-realistic anime product art with sophisticated cel shading, "
    "layered material texture, tasteful specular highlights, crisp warm "
    "dark-brown linework, and a restrained soft contact shadow. Detailed but "
    "graphically clean, not photorealistic. Subject fills about 76 percent of the "
    "square with clean even margin. No ingredients, food, liquid, garnish, plate "
    "or extra object. Absolutely no text, letters, logo or watermark. "
    "Isolated on perfectly flat solid #FF00FF chroma background with no gradient, "
    "no vignette, no texture and no scene."
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--group",
        choices=["ingredients", "tools", "all"],
        default="all",
    )
    parser.add_argument("--names", nargs="*", default=[])
    parser.add_argument("--start", type=int, default=0)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--seed-offset", type=int, default=0)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--preview", action="store_true")
    return parser.parse_args()


def ordered_definitions(group: str) -> list[tuple[str, str, str]]:
    definitions: list[tuple[str, str, str]] = []
    if group in {"ingredients", "all"}:
        definitions.extend(
            (
                "ingredient",
                name,
                SUBJECT_OVERRIDES.get(name, subject),
            )
            for name, subject in DEFINITIONS["INGREDIENTS"].items()
        )
    if group in {"tools", "all"}:
        definitions.extend(
            ("tool", name, subject)
            for name, subject in DEFINITIONS["TOOLS"].items()
        )
    return definitions


def stable_seed(prefix: str, name: str, offset: int = 0) -> int:
    digest = hashlib.blake2b(
        f"story-kitchen-v2:{prefix}:{name}".encode("utf-8"),
        digest_size=4,
    ).digest()
    return (int.from_bytes(digest, "big") + offset) % 2_000_000_000


def generate_one(
    prefix: str,
    name: str,
    subject: str,
    seed_offset: int,
    force: bool,
) -> None:
    raw = RAW / f"{prefix}_{name}_raw.png"
    group_dir = OUTPUT / f"{prefix}s"
    normal = group_dir / f"{prefix}_{name}_normal.png"
    raw.parent.mkdir(parents=True, exist_ok=True)
    group_dir.mkdir(parents=True, exist_ok=True)

    if force or not raw.exists():
        style = TOOL_STYLE if prefix == "tool" else STYLE
        subprocess.run(
            [
                str(FLUX_PYTHON),
                str(COMFY_RUNNER),
                "--prompt",
                style.format(subject=subject),
                "--negative",
                (
                    "text, letters, Chinese characters, Japanese characters, caption, "
                    "label, logo, watermark, signature, checkerboard, transparency grid, "
                    "face, eyes, blush, mouth, limbs, mascot, cartoon character, "
                    "anthropomorphic, multiple separate items, pale pink meat matching "
                    "the background, food, ingredients, liquid, soup, garnish, "
                    "plate, prepared dish, table, frame, border, cropped subject, "
                    "photograph, photorealistic, 3D render, clay, oil painting, "
                    "messy background, high saturation neon"
                ),
                "--out",
                str(raw),
                "--width",
                "1024",
                "--height",
                "1024",
                "--steps",
                "4",
                "--seed",
                str(stable_seed(prefix, name, seed_offset)),
            ],
            check=True,
        )

    if force or not normal.exists():
        subprocess.run(
            [
                str(NORMALIZE_PYTHON),
                str(NORMALIZER),
                "--input",
                str(raw),
                "--name",
                name,
                "--out-dir",
                str(group_dir),
                "--prefix",
                prefix,
                "--coverage",
                "0.76",
                "--fill-holes",
            ],
            check=True,
        )
    print(f"ready {prefix}_{name}")


def manifest_entry(prefix: str, name: str) -> dict[str, object]:
    group = f"{prefix}s"
    return {
        "id": name,
        "states": {
            state: (
                f"assets/story-kitchen/{group}/{prefix}_{name}_{state}.png"
            )
            for state in STATES
        },
    }


def write_manifest_if_complete(
    ingredients: list[tuple[str, str, str]],
    tools: list[tuple[str, str, str]],
) -> bool:
    finals = [
        OUTPUT / f"{prefix}s" / f"{prefix}_{name}_{state}.png"
        for prefix, name, _ in [*ingredients, *tools]
        for state in STATES
    ]
    if not all(path.exists() for path in finals):
        return False
    manifest = {
        "size": [512, 512],
        "format": "PNG",
        "background": "transparent",
        "states": list(STATES),
        "ingredients": [
            manifest_entry(prefix, name)
            for prefix, name, _ in ingredients
        ],
        "tools": [manifest_entry(prefix, name) for prefix, name, _ in tools],
    }
    (OUTPUT / "icon_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return True


def main() -> None:
    args = parse_args()
    all_ingredients = ordered_definitions("ingredients")
    all_tools = ordered_definitions("tools")
    selected = ordered_definitions(args.group)
    if args.names:
        requested = set(args.names)
        selected = [item for item in selected if item[1] in requested]
    selected = selected[args.start :]
    if args.limit:
        selected = selected[: args.limit]
    if not selected:
        raise SystemExit("No matching story-kitchen assets selected")

    for prefix, name, subject in selected:
        generate_one(
            prefix,
            name,
            subject,
            args.seed_offset,
            args.force,
        )

    manifest_written = write_manifest_if_complete(all_ingredients, all_tools)
    print(
        json.dumps(
            {
                "selected": len(selected),
                "preview": args.preview,
                "manifestWritten": manifest_written,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
