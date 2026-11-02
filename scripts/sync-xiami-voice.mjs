import { access, cp, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const source = path.join(root, "assets", "voice", "xiami");
const output = path.join(root, "public", "audio", "xiami");
const publicRoot = path.join(root, "public");
if (!output.startsWith(`${publicRoot}${path.sep}`)) {
  throw new Error("Xiami voice output must stay inside public/");
}
async function validateVoicePack(recipe, expectedLineCount) {
  const directory = path.join(source, recipe, "v1");
  const manifest = JSON.parse(
    await readFile(path.join(directory, "manifest.json"), "utf8"),
  );

  if (
    !Array.isArray(manifest.lines) ||
    manifest.lines.length !== expectedLineCount
  ) {
    throw new Error(
      `${recipe} voice manifest must contain ${expectedLineCount} lines.`,
    );
  }

  for (const line of manifest.lines) {
    if (
      typeof line.id !== "string" ||
      typeof line.file !== "string" ||
      !Number.isFinite(line.durationMs) ||
      line.durationMs <= 0
    ) {
      throw new Error(`Invalid Xiami voice line: ${JSON.stringify(line)}`);
    }
    await access(path.join(directory, line.file)).catch(() => {
      throw new Error(`Missing Xiami voice asset: ${line.file}`);
    });
  }
}

for (const [pack, expectedLineCount] of [
  ["tomato-egg", 12],
  ["garlic-lettuce", 12],
  ["shared", 1],
]) {
  await validateVoicePack(pack, expectedLineCount);
}

await rm(output, { recursive: true, force: true });
await mkdir(path.dirname(output), { recursive: true });
await cp(source, output, { recursive: true });
