// Builds the golden corpus twice and compares the fingerprints of model.json
// and of the dist/ tree. Until the command line ships a build command, there
// is nothing to build: the step says so and succeeds, so that the pipeline
// stays honest about what it verifies.
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

const root = resolve(dirname(new URL(import.meta.url).pathname), "..");
const cli = JSON.parse(readFileSync(resolve(root, "packages/cli/package.json"), "utf8"));

if (cli.bin === undefined) {
  console.log("determinism: the command line has no executable yet, nothing to build");
  process.exit(0);
}

console.error(
  "determinism: the command line exists but this script has not been extended to run it",
);
process.exit(1);
