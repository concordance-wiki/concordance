// Runs the commands of docs/guides/getting-started.md, in their order, through
// the built command line, so that the guide never promises a step that fails:
// `init --templates` and `validate-config` in an empty folder, then on a
// temporary copy of the golden corpus `validate-config`, `build`, `render`,
// `export`, `lint` from a source folder in the three report formats, and the
// reproducible double build. Every step must exit as the guide says and leave
// the files the guide names. Under thirty seconds on the golden corpus.
import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compareTrees } from "./compare-builds.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bin = resolve(root, "packages/cli/dist/bin.js");
const corpus = resolve(root, "fixtures/corpora/realistic/en");
const started = performance.now();
const failures = [];

function run(step, cwd, args, { expect = 0, env = {} } = {}) {
  const result = spawnSync(process.execPath, [bin, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  if (result.status !== expect) {
    failures.push(
      `${step}: concordance ${args.join(" ")} exited with ${String(result.status)}, expected ${String(expect)}\n${result.stdout}${result.stderr}`,
    );
  }
  return result;
}

function expectFile(step, path) {
  if (!existsSync(path)) {
    failures.push(`${step}: ${path} was not written`);
    return false;
  }
  if (statSync(path).isFile() && statSync(path).size === 0) {
    failures.push(`${step}: ${path} is empty`);
    return false;
  }
  return true;
}

const work = mkdtempSync(join(tmpdir(), "concordance-walkthrough-"));
try {
  // Step: create a configuration repository.
  const fresh = join(work, "my-wiki");
  cpSync(join(corpus, "glossary"), join(fresh, "notes"), { recursive: true });
  run("init", fresh, ["init", "--templates"]);
  expectFile("init", join(fresh, "concordance.yaml"));
  expectFile("init", join(fresh, "templates", "term.md"));
  run("init again", fresh, ["init"], { expect: 2 });
  run("validate the initial configuration", fresh, ["validate-config"]);
  run("build the initial configuration", fresh, ["build"]);
  expectFile("build the initial configuration", join(fresh, "dist", "index.html"));

  // Step: point the configuration at the golden corpus.
  const wiki = join(work, "golden");
  cpSync(corpus, wiki, { recursive: true });
  rmSync(join(wiki, "expected"), { recursive: true, force: true });
  run("validate-config", wiki, ["validate-config"]);
  const build = run("build", wiki, ["build"]);
  if (!/^site: \d+ pages written to /m.test(build.stdout)) {
    failures.push(`build: the summary does not report the pages written\n${build.stdout}`);
  }
  for (const file of [
    "dist/index.html",
    "dist/index/index.html",
    "dist/todo/index.html",
    "dist/search/index.html",
    "dist/search/meta.js",
    "dist/model.json",
    "dist/build.log.json",
    "dist/glossary/keyword-page/index.html",
    "dist/assets/site.css",
  ]) {
    expectFile("build", join(wiki, file));
  }
  const log = JSON.parse(readFileSync(join(wiki, "dist/build.log.json"), "utf8"));
  if (log.summary?.findings?.bySeverity?.error !== 0) {
    failures.push(`build: the golden corpus must build without an error finding`);
  }

  // Step: render again without the sources.
  rmSync(join(wiki, "dist/index.html"));
  run("render", wiki, ["render"]);
  expectFile("render", join(wiki, "dist/index.html"));

  // Step: export the graph.
  run("export", wiki, ["export", "--format", "cypher", "--output", "graph.cypher"]);
  if (expectFile("export", join(wiki, "graph.cypher"))) {
    if (!readFileSync(join(wiki, "graph.cypher"), "utf8").includes("MERGE")) {
      failures.push("export: graph.cypher holds no MERGE statement");
    }
  }

  // Step: lint a knowledge repository, as text and as the two forge reports.
  const specs = join(wiki, "specs");
  const lint = run("lint", specs, ["lint", "--source", "specs", "--config", "../concordance.yaml"]);
  if (!/^0 findings: 0 errors, 0 warnings, 0 info$/m.test(lint.stdout)) {
    failures.push(`lint: the golden corpus must lint clean\n${lint.stdout}${lint.stderr}`);
  }
  run("lint sarif", specs, ["lint", "--format", "sarif", "--output", "concordance.sarif"]);
  expectFile("lint sarif", join(specs, "concordance.sarif"));
  run("lint junit", specs, ["lint", "--format", "junit", "--output", "concordance-junit.xml"]);
  expectFile("lint junit", join(specs, "concordance-junit.xml"));

  // Step: reproducible builds.
  const env = { SOURCE_DATE_EPOCH: "0" };
  run("reproducible build 1", wiki, ["build", "--output", "first"], { env });
  run("reproducible build 2", wiki, ["build", "--output", "second"], { env });
  const { differences } = compareTrees(join(wiki, "first"), join(wiki, "second"));
  for (const { path, where } of differences) {
    failures.push(`reproducible builds: ${path} differs (${where})`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

const seconds = (performance.now() - started) / 1000;
if (seconds > 30) failures.push(`walkthrough: took ${seconds.toFixed(1)} s, the budget is 30 s`);
if (failures.length > 0) {
  for (const message of failures) console.error(`walkthrough: ${message}`);
  process.exit(1);
}
console.log(
  `walkthrough: every command of the getting-started guide ran as documented in ${seconds.toFixed(1)} s`,
);
