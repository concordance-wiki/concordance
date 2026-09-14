// Runs mutation testing on the mutated packages, and keeps its incremental file.
//
//   node scripts/mutation.mjs                     every mutated package, one report
//   node scripts/mutation.mjs --package nlp       one package (the nightly matrix)
//   node scripts/mutation.mjs --since <ref>       the source files changed since <ref>
//                                                 (a pull request), static mutants ignored
//   node scripts/mutation.mjs --summary <dir>     aggregate the nightly reports downloaded
//                                                 under <dir>, merge their incremental files
//
// Every run reads and writes an incremental file under reports/mutation/incremental/: one per
// package for the nightly, `main.json` for the merged nightly result, `branch.json` for a pull
// request, which starts from `main.json` when it has no file of its own yet. The pipeline caches
// those files; `--force` retests everything. When GITHUB_STEP_SUMMARY is set, the mutation score
// of the run is appended to the job summary. Extra arguments go to `stryker run`.
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { systemCommand } from "./executables.mjs";

const mutatedPackages = ["core", "typing", "nlp", "inference", "checks"];
const incrementalDir = "reports/mutation/incremental";
const reportFile = "reports/mutation/mutation.json";
const threshold = 85;

const argv = process.argv.slice(2);
const option = (name) => {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    console.error(`usage: node scripts/mutation.mjs ${name} <value>`);
    process.exit(2);
  }
  argv.splice(index, 2);
  return value;
};

const summaryDir = option("--summary");
const pkg = option("--package");
const since = option("--since");

if (summaryDir !== undefined) {
  process.exit(summarise(summaryDir));
}
if (pkg !== undefined && !mutatedPackages.includes(pkg)) {
  console.error(`mutation: unknown package ${pkg}; one of ${mutatedPackages.join(", ")}`);
  process.exit(2);
}

// The package exports no executable: resolve its manifest and take the bin next to it.
const stryker = join(
  dirname(createRequire(import.meta.url).resolve("@stryker-mutator/core/package.json")),
  "bin/stryker.js",
);
const args = [stryker, "run"];
let incrementalFile = join(incrementalDir, "all.json");

if (pkg !== undefined) {
  incrementalFile = join(incrementalDir, `${pkg}.json`);
  args.push("--mutate", `packages/${pkg}/src/**/*.ts`);
} else if (since !== undefined) {
  incrementalFile = join(incrementalDir, "branch.json");
  const changed = execFileSync(
    systemCommand("git"),
    [
      "diff",
      "--name-only",
      `${since}...HEAD`,
      "--",
      ...mutatedPackages.map((p) => `packages/${p}/src`),
    ],
    { encoding: "utf8" },
  )
    .split("\n")
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"));
  if (changed.length === 0) {
    console.log("mutation: no mutated package source changed, nothing to mutate");
    process.exit(0);
  }
  console.log(`mutation: ${String(changed.length)} changed file(s) since ${since}`);
  seed(incrementalFile, join(incrementalDir, "main.json"));
  // A change limited to types or interfaces yields no mutant; that is a pass, not a
  // misconfiguration. A mutant that only the loading of a module executes needs the whole
  // suite to run again in a fresh process: the nightly run covers those, a pull request only
  // retests what its tests reach at runtime.
  args.push("--mutate", changed.join(","), "--allowEmpty", "--ignoreStatic");
}

args.push("--incrementalFile", incrementalFile, ...argv);
rmSync(reportFile, { force: true });
const run = spawnSync(process.execPath, args, { stdio: "inherit" });
if (existsSync(reportFile)) {
  const scope = pkg ?? (since === undefined ? "every package" : "changed files");
  publish("Mutation score", [[scope, scoreOf(readJson(reportFile))]]);
}
process.exit(run.status ?? 1);

/** Copies the merged nightly file as the starting point of a branch that has none yet. */
function seed(target, source) {
  if (existsSync(target) || !existsSync(source)) return;
  mkdirSync(incrementalDir, { recursive: true });
  writeFileSync(target, readFileSync(source));
  console.log(`mutation: incremental file seeded from ${source}`);
}

/**
 * Reads the `mutation.json` of every package artifact under `dir`, prints one score per package
 * and the line the job summary shows, merges the incremental files found next to them into
 * `main.json`, and fails when a package is under the threshold or missing.
 */
function summarise(dir) {
  const rows = [];
  const merged = { files: {}, testFiles: {} };
  let reports = 0;
  for (const name of mutatedPackages) {
    const report = join(dir, `mutation-${name}`, "mutation.json");
    if (!existsSync(report)) {
      rows.push([name, undefined]);
      continue;
    }
    rows.push([name, scoreOf(readJson(report))]);
    const incremental = join(dir, `mutation-${name}`, "incremental", `${name}.json`);
    if (existsSync(incremental)) mergeInto(merged, readJson(incremental), reports++);
  }
  const summary = rows
    .map(([name, score]) => `${name} ${score === undefined ? "missing" : `${score.toFixed(2)}%`}`)
    .join(" · ");
  console.log(`mutation: ${summary}`);
  publish("Nightly mutation score", rows);
  if (reports > 0) {
    mkdirSync(incrementalDir, { recursive: true });
    writeFileSync(join(incrementalDir, "main.json"), JSON.stringify(merged));
    console.log(
      `mutation: ${String(reports)} incremental file(s) merged into ${incrementalDir}/main.json`,
    );
  }
  return rows.every(([, score]) => score !== undefined && score >= threshold) ? 0 : 1;
}

/**
 * Adds the files and tests of one report to the merged one. Test identifiers are only unique
 * within their report, so they are prefixed with the index of the report they come from.
 */
function mergeInto(merged, report, index) {
  const id = (test) => `${String(index)}:${test}`;
  merged.schemaVersion ??= report.schemaVersion;
  merged.thresholds ??= report.thresholds;
  for (const [file, entry] of Object.entries(report.files ?? {})) {
    merged.files[file] = {
      ...entry,
      mutants: entry.mutants.map((mutant) => ({
        ...mutant,
        coveredBy: mutant.coveredBy?.map(id),
        killedBy: mutant.killedBy?.map(id),
      })),
    };
  }
  for (const [file, entry] of Object.entries(report.testFiles ?? {})) {
    merged.testFiles[file] = {
      ...entry,
      tests: entry.tests.map((test) => ({ ...test, id: id(test.id) })),
    };
  }
}

/** The mutation score as Stryker computes it: detected mutants over the valid ones. */
function scoreOf(report) {
  const counts = {};
  for (const { mutants } of Object.values(report.files ?? {})) {
    for (const { status } of mutants) counts[status] = (counts[status] ?? 0) + 1;
  }
  const detected = (counts.Killed ?? 0) + (counts.Timeout ?? 0);
  const valid = detected + (counts.Survived ?? 0) + (counts.NoCoverage ?? 0);
  return valid === 0 ? 100 : (detected / valid) * 100;
}

/** Appends a table of scores to the job summary of the pipeline, when there is one. */
function publish(title, rows) {
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary === undefined) return;
  const lines = [
    `### ${title}`,
    "",
    "| Package | Score | Threshold |",
    "| --- | ---: | --- |",
    ...rows.map(([name, score]) => {
      const cell = score === undefined ? "missing" : `${score.toFixed(2)}%`;
      const verdict = score !== undefined && score >= threshold ? "pass" : "fail";
      return `| ${name} | ${cell} | ${String(threshold)}% ${verdict} |`;
    }),
    "",
  ];
  writeFileSync(summary, `${lines.join("\n")}\n`, { flag: "a" });
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}
