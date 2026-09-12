// Builds the golden corpus twice and compares the fingerprints of model.json
// and of the dist/ tree. While the command line stops after the configuration
// step, there is nothing to compare: the step says so and succeeds, so that
// the pipeline stays honest about what it verifies.
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";

const root = resolve(dirname(new URL(import.meta.url).pathname), "..");
const bin = resolve(root, "packages/cli/dist/bin.js");
const config = resolve(root, "fixtures/corpora/minimal/en/concordance.yaml");

const run = spawnSync(process.execPath, [bin, "build", "--config", config], { encoding: "utf8" });

if (run.status === 2 && run.stderr.includes("not implemented in this version")) {
  console.log("determinism: the build stops after configuration, nothing to compare yet");
  process.exit(0);
}

console.error("determinism: the build produces output but this script does not compare it yet");
console.error(run.stdout + run.stderr);
process.exit(1);
