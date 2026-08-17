import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ignored = new Set([".git", "dist", "node_modules"]);

function collectJavaScript(directory) {
  return readdirSync(directory).flatMap(name => {
    if (ignored.has(name)) return [];
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return collectJavaScript(path);
    return path.endsWith(".js") ? [path] : [];
  });
}

const files = collectJavaScript(process.cwd());
const result = spawnSync(process.execPath, ["--check", ...files], { stdio: "inherit" });
process.exitCode = result.status ?? 1;
