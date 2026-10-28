import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readGlbJson(filePath: string) {
  const data = readFileSync(filePath);
  let offset = 12;
  while (offset < data.length) {
    const chunkLength = data.readUInt32LE(offset);
    const chunkType = data.readUInt32LE(offset + 4);
    offset += 8;
    if (chunkType === 0x4e4f534a) {
      return JSON.parse(
        data
          .subarray(offset, offset + chunkLength)
          .toString("utf8")
          .replace(/\u0000+$/g, "")
          .trim(),
      );
    }
    offset += chunkLength;
  }
  throw new Error("GLB JSON chunk was not found");
}

describe("rigged Xiaomi asset", () => {
  const assetPath = resolve("public/models/xiaomi-rigged.glb");
  const asset = readGlbJson(assetPath);

  it("stays within the browser asset budget", () => {
    expect(readFileSync(assetPath).byteLength).toBeLessThanOrEqual(
      12 * 1024 * 1024,
    );
  });

  it("contains the required humanoid skin and clips", () => {
    expect(asset.skins).toHaveLength(1);
    expect(asset.skins[0].joints.length).toBeGreaterThanOrEqual(20);
    expect(asset.animations.map((clip: { name: string }) => clip.name)).toEqual(
      expect.arrayContaining(["Idle", "Walk", "Jog", "Turn"]),
    );
  });

  it("uses a skinned vertex-colored mesh without a face texture plane", () => {
    const primitive = asset.meshes[0].primitives[0];
    expect(primitive.attributes.JOINTS_0).toBeTypeOf("number");
    expect(primitive.attributes.WEIGHTS_0).toBeTypeOf("number");
    expect(primitive.attributes.COLOR_0).toBeTypeOf("number");
    expect(asset.images ?? []).toHaveLength(0);
  });
});
