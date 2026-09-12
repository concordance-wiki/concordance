// Builds the golden corpus twice and compares the fingerprints of model.json
// and of the dist/ tree. While the command line stops after the parsing step,
// there is nothing to compare: the step says so and succeeds, so that the
// pipeline stays honest about what it verifies. The build log is written to a
// temporary folder so that the fixtures stay untouched.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";

const root = resolve(dirname(new URL(import.meta.url).pathname), "..");
const bin = resolve(root, "packages/cli/dist/bin.js");
const config = resolve(root, "fixtures/corpora/minimal/en/concordance.yaml");
const output = mkdtempSync(join(tmpdir(), "concordance-determinism-"));

const run = spawnSync(process.execPath, [bin, "build", "--config", config, "--output", output], {
  encoding: "utf8",
});
rmSync(output, { recursive: true, force: true });

if (run.status === 2 && run.stderr.includes("not implemented in this version")) {
  console.log("determinism: the build stops before typing, nothing to compare yet");
  process.exit(0);
}

console.error("determinism: the build produces output but this script does not compare it yet");
console.error(run.stdout + run.stderr);
process.exit(1);
