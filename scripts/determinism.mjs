// Builds the golden corpora twice through the built command line, with
// SOURCE_DATE_EPOCH pinning the only timestamp, and compares the two output
// trees byte for byte: the log, the model, the fragments, every page of the
// site, the search index and the assets, island bundles included. The build
// exits 0 once its log, its model and its site are written; any other status,
// or any differing file, fails the step. A tree without the pages of the site
// fails too: the rendering is part of what determinism covers.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compareTrees } from "./compare-builds.mjs";
import { readQuestions } from "./query-fixtures.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
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

/** The questions recorded for a corpus; none when it records none. */
function questionsOf(corpus) {
  const directory = resolve(root, "fixtures/corpora", corpus);
  return existsSync(join(directory, "expected/query/questions.yaml"))
    ? readQuestions(directory)
    : [];
}

/** One question asked of a built output through the command line, the age left out. */
function ask(output, args) {
  return spawnSync(process.execPath, [bin, "query", ...args, "--model", "model.json", "--no-age"], {
    cwd: output,
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
    for (const required of ["build.log.json", "model.json", "index.html", "search/meta.js"]) {
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
    // The answers of `query` on the two builds must not differ either: the command adds nothing of its own.
    let answered = 0;
    for (const question of questionsOf(corpus)) {
      const answers = outputs.map((output) => ask(output, question.args));
      if (answers[0].stdout !== answers[1].stdout || answers[0].status !== answers[1].status) {
        console.error(
          `determinism: query ${question.slug} answers differently on two builds of ${corpus}`,
        );
        process.exit(1);
      }
      answered += 1;
    }
    if (answered > 0) {
      console.log(
        `determinism: ${String(answered)} query answers are identical on both builds of ${corpus}`,
      );
    }
  } finally {
    for (const output of outputs) rmSync(output, { recursive: true, force: true });
  }
}
