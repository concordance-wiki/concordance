// Runs a script in every workspace package that defines it. While the
// workspace has no package, says so and succeeds: the pipeline stays green and
// honest about what it verified.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";

const task = process.argv[2];
if (!task) {
  console.error("usage: node scripts/workspace.mjs <script>");
  process.exit(2);
}

const root = resolve(dirname(new URL(import.meta.url).pathname), "..");
const packages = ["packages", "plugins", "presets"].flatMap((dir) => {
  const base = join(root, dir);
  if (!existsSync(base)) return [];
  return readdirSync(base).filter((name) => existsSync(join(base, name, "package.json")));
});

if (packages.length === 0) {
  console.log(`${task}: no workspace package yet, nothing to ${task}`);
  process.exit(0);
}

execFileSync("pnpm", ["-r", "--if-present", task], { stdio: "inherit", cwd: root });
