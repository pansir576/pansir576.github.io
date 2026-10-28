import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("Usage: node scripts/run-next.mjs <dev|build|start> [...args]");
  process.exit(1);
}

const env = { ...process.env };

// Some Windows workspaces mount AppData separately from the project. Next.js
// atomically renames its config file, which can fail across those mounts.
if (process.platform === "win32") {
  const buildRoot = path.join(process.cwd(), ".build-env", "AppData");
  const roaming = path.join(buildRoot, "Roaming");
  const local = path.join(buildRoot, "Local");
  mkdirSync(roaming, { recursive: true });
  mkdirSync(local, { recursive: true });
  env.APPDATA = roaming;
  env.LOCALAPPDATA = local;
}

env.NEXT_TELEMETRY_DISABLED = "1";

const nextCli = path.join(
  process.cwd(),
  "node_modules",
  "next",
  "dist",
  "bin",
  "next",
);
const child = spawn(process.execPath, [nextCli, command, ...args], {
  env,
  stdio: "inherit",
  windowsHide: true,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
