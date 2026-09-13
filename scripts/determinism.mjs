// Builds the golden corpora twice through the built command line, with
// SOURCE_DATE_EPOCH pinning the only timestamp, and compares the two output
// trees byte for byte: the log, the model, the fragments, every page of the
// site, the search index and the assets, island bundles included. The build
// exits 0 once its log, its model and its site are written; any other status,
// or any differing file, fails the step. A tree without the pages of the site
// fails too: the rendering is part of what determinism covers.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { compareTrees } from "./compare-builds.mjs";

const root = resolve(dirname(new URL(import.meta.url).pathname), "..");
const bin = resolve(root, "packages/cli/dist/bin.js");
const corpora = ["minimal/en", "realistic/en"];

function build(corpus, output) {
  const config = resolve(root, "fixtures/corpora", corpus, "concordance.yaml");
  return spawnSync(process.execPath, [bin, "build", "--config", config, "--output", output], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, SOURCE_DATE_EPOCH: "0" },
  });
}

for (const corpus of corpora) {
  const outputs = [1, 2].map(() => mkdtempSync(join(tmpdir(), "concordance-determinism-")));
  try {
    const runs = outputs.map((output) => build(corpus, output));
    for (const run of runs) {
      if (run.status !== 0) {
        console.error(`determinism: the build of ${corpus} exited with ${String(run.status)}`);
        console.error(run.stdout + run.stderr);
        process.exit(1);
      }
    }

    const [first, second] = outputs;
    const { paths, differences } = compareTrees(first, second);
    for (const required of ["build.log.json", "model.json", "index.html", "search-index.json"]) {
      if (!paths.includes(required)) {
        console.error(`determinism: the build of ${corpus} did not write ${required}`);
        process.exit(1);
      }
    }
    if (differences.length > 0) {
      console.error(`determinism: two builds of ${corpus} differ`);
      for (const { path, where } of differences) {
        console.error(`  ${path}: ${where}`);
      }
      process.exit(1);
    }
    console.log(
      `determinism: two builds of ${corpus} are byte-identical (${String(paths.length)} file(s) compared)`,
    );
  } finally {
    for (const output of outputs) rmSync(output, { recursive: true, force: true });
  }
}
