import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "../assets/voice/xiami/tomato-egg/v1/manifest.json";
import sharedManifest from "../assets/voice/xiami/shared/v1/manifest.json";
import { XIAMI_TOMATO_EGG_DIALOGUE } from "../src/lib/xiami-dialogue";

describe("Xiami voice asset pack", () => {
  it("contains all phase and outcome lines with unique IDs", () => {
    expect(manifest.lines).toHaveLength(12);
    expect(new Set(manifest.lines.map((line) => line.id)).size).toBe(12);
    expect(manifest.lines.filter((line) => line.kind === "phase")).toHaveLength(
      5,
    );
    expect(
      manifest.lines.filter((line) => line.kind === "outcome"),
    ).toHaveLength(7);
  });

  it("keeps audio manifest text in sync with the character dialogue", () => {
    for (const line of manifest.lines) {
      expect(line.text).toBe(
        XIAMI_TOMATO_EGG_DIALOGUE[
          line.id as keyof typeof XIAMI_TOMATO_EGG_DIALOGUE
        ],
      );
    }
  });

  it("keeps every referenced MP3 in the source asset directory", async () => {
    const assetDirectory = path.resolve(
      "assets",
      "voice",
      "xiami",
      "tomato-egg",
      "v1",
    );
    for (const line of manifest.lines) {
      const filePath = path.join(assetDirectory, line.file);
      const info = await stat(filePath);
      const header = (await readFile(filePath)).subarray(0, 3);
      expect(info.size).toBeGreaterThan(10_000);
      expect(header.toString("ascii")).toBe("ID3");
    }
  });

  it("provides the shared low-score dejected line", async () => {
    expect(sharedManifest.lines).toHaveLength(1);
    expect(sharedManifest.lines[0]).toMatchObject({
      id: "low-score-dejected",
      text: "赏……个脸呗……把菜做好。",
      file: "low-score-dejected.mp3",
    });
    const filePath = path.resolve(
      "assets",
      "voice",
      "xiami",
      "shared",
      "v1",
      sharedManifest.lines[0].file,
    );
    const info = await stat(filePath);
    const header = (await readFile(filePath)).subarray(0, 3);
    expect(info.size).toBeGreaterThan(10_000);
    expect(header.toString("ascii")).toBe("ID3");
  });
});
