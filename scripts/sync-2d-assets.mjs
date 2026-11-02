import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const source = path.join(root, "assets");
const output = path.join(root, "public", "2d");
const generatedRoot = path.resolve(root, "public");

if (!path.resolve(output).startsWith(`${generatedRoot}${path.sep}`)) {
  throw new Error("2D asset output must stay inside public/");
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const directory of [
  "bg",
  "ingredients",
  "tools",
  "character",
  "food_state",
  "script",
  "story-kitchen",
]) {
  await cp(path.join(source, directory), path.join(output, directory), {
    recursive: true,
  });
}
for (const file of [
  "icon_manifest.json",
  "character_manifest.json",
  "story_state_manifest.json",
  "story_object_bounds.json",
]) {
  await cp(path.join(source, file), path.join(output, file));
}
