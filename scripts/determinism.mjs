// Builds the golden corpus twice and compares the fingerprints of model.json
// and of the dist/ tree. Until the command line exists, there is nothing to
// build: the step says so and succeeds, so that the pipeline stays honest
// about what it verifies.
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";

const root = resolve(dirname(new URL(import.meta.url).pathname), "..");
const cli = resolve(root, "packages/cli/package.json");

if (!existsSync(cli)) {
  console.log("determinism: no command line package yet, nothing to build");
  process.exit(0);
}

console.error("determinism: the command line exists but this script has not been extended to run it");
process.exit(1);
