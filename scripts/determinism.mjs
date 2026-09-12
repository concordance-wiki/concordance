// Builds the golden corpus twice through the built command line, with
// SOURCE_DATE_EPOCH pinning the only timestamp, and compares the two output
// trees byte for byte. Every file the build writes is compared, so the script
// needs no update when model.json and the site appear. The build still stops
// after parsing with exit code 2 once its log is written: that outcome is
// accepted; any other failure, or any differing file, fails the step.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

const root = resolve(dirname(new URL(import.meta.url).pathname), "..");
const bin = resolve(root, "packages/cli/dist/bin.js");
const config = resolve(root, "fixtures/corpora/minimal/en/concordance.yaml");

/** Forward-slash relative path to content hash, for every file under the tree. */
function listTree(tree) {
  const entries = new Map();
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
      } else {
        const path = relative(tree, absolute).split("\\").join("/");
        entries.set(path, createHash("sha256").update(readFileSync(absolute)).digest("hex"));
      }
    }
  };
  walk(tree);
  return entries;
}

function build(output) {
  return spawnSync(process.execPath, [bin, "build", "--config", config, "--output", output], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, SOURCE_DATE_EPOCH: "0" },
  });
}

const outputs = [1, 2].map(() => mkdtempSync(join(tmpdir(), "concordance-determinism-")));
try {
  const runs = outputs.map(build);
  for (const run of runs) {
    const notImplemented =
      run.status === 2 && run.stderr.includes("not implemented in this version");
    if (run.status !== 0 && !notImplemented) {
      console.error(`determinism: the build exited with ${String(run.status)}`);
      console.error(run.stdout + run.stderr);
      process.exit(1);
    }
  }

  const [first, second] = outputs.map(listTree);
  const paths = [...new Set([...first.keys(), ...second.keys()])].sort();
  const differences = paths.filter((path) => first.get(path) !== second.get(path));
  if (differences.length > 0) {
    console.error("determinism: two builds of the golden corpus differ");
    for (const path of differences) {
      const where = first.has(path)
        ? second.has(path)
          ? "differs"
          : "missing from the second build"
        : "missing from the first build";
      console.error(`  ${path}: ${where}`);
    }
    process.exit(1);
  }
  console.log(
    `determinism: two builds of the golden corpus are byte-identical (${String(paths.length)} file(s) compared)`,
  );
} finally {
  for (const output of outputs) rmSync(output, { recursive: true, force: true });
}
