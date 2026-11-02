"""Run local FLUX image-to-image while preserving character identity."""

from __future__ import annotations

import argparse
import json
import shutil
import time
import urllib.parse
import urllib.request
import uuid
from pathlib import Path


BASE = "http://127.0.0.1:8188"
COMFY_INPUT = Path(r"D:\codex-ai\ComfyUI\input")


def post_json(path: str, payload: dict) -> dict:
    request = urllib.request.Request(
        BASE + path,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def get_json(path: str) -> dict:
    with urllib.request.urlopen(BASE + path, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def build(
    prompt: str,
    negative: str,
    image_name: str,
    denoise: float,
    steps: int,
    seed: int,
) -> dict:
    return {
        "1": {
            "class_type": "UnetLoaderGGUF",
            "inputs": {"unet_name": "flux1-schnell-Q4_K_S.gguf"},
        },
        "2": {
            "class_type": "DualCLIPLoader",
            "inputs": {
                "clip_name1": "clip_l.safetensors",
                "clip_name2": "t5xxl_fp8_e4m3fn.safetensors",
                "type": "flux",
            },
        },
        "3": {
            "class_type": "CLIPTextEncode",
            "inputs": {"clip": ["2", 0], "text": prompt},
        },
        "4": {
            "class_type": "FluxGuidance",
            "inputs": {"conditioning": ["3", 0], "guidance": 3.2},
        },
        "5": {
            "class_type": "CLIPTextEncode",
            "inputs": {"clip": ["2", 0], "text": negative},
        },
        "6": {
            "class_type": "LoadImage",
            "inputs": {"image": image_name},
        },
        "7": {"class_type": "VAELoader", "inputs": {"vae_name": "ae.safetensors"}},
        "8": {
            "class_type": "VAEEncode",
            "inputs": {"pixels": ["6", 0], "vae": ["7", 0]},
        },
        "9": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0],
                "positive": ["4", 0],
                "negative": ["5", 0],
                "latent_image": ["8", 0],
                "seed": seed,
                "steps": steps,
                "cfg": 1.0,
                "sampler_name": "euler",
                "scheduler": "simple",
                "denoise": denoise,
            },
        },
        "10": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["9", 0], "vae": ["7", 0]},
        },
        "11": {
            "class_type": "SaveImage",
            "inputs": {"images": ["10", 0], "filename_prefix": "flux-img2img"},
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--negative", default="")
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--denoise", type=float, default=0.65)
    parser.add_argument("--steps", type=int, default=5)
    parser.add_argument("--seed", type=int, default=1)
    parser.add_argument("--timeout", type=int, default=900)
    args = parser.parse_args()

    image_name = f"codex-{uuid.uuid4().hex}-{args.input.name}"
    COMFY_INPUT.mkdir(parents=True, exist_ok=True)
    shutil.copy2(args.input, COMFY_INPUT / image_name)

    client_id = str(uuid.uuid4())
    started = time.time()
    queued = post_json(
        "/prompt",
        {
            "prompt": build(
                prompt=args.prompt,
                negative=args.negative,
                image_name=image_name,
                denoise=args.denoise,
                steps=args.steps,
                seed=args.seed,
            ),
            "client_id": client_id,
        },
    )
    if "prompt_id" not in queued:
        print("queue failed:", queued)
        return 1
    prompt_id = queued["prompt_id"]
    print("queued", prompt_id)

    while time.time() - started < args.timeout:
        time.sleep(3)
        history = get_json(f"/history/{prompt_id}")
        if prompt_id not in history:
            continue
        entry = history[prompt_id]
        if entry.get("status", {}).get("status_str") == "error":
            print("execution error:", json.dumps(entry["status"])[:2000])
            return 1
        images = entry.get("outputs", {}).get("11", {}).get("images", [])
        if not images:
            continue
        info = images[0]
        query = (
            "/view?filename="
            + urllib.parse.quote(info["filename"])
            + "&subfolder="
            + urllib.parse.quote(info.get("subfolder", ""))
            + "&type=output"
        )
        with urllib.request.urlopen(BASE + query, timeout=120) as response:
            payload = response.read()
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_bytes(payload)
        print(f"saved {args.out} in {time.time() - started:.0f}s")
        return 0

    print("timeout waiting for image")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
