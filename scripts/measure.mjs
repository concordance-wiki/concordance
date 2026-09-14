// Measures what an integrator can expect on the golden corpus: the duration of
// a first build, the duration of a second build in the same folder (the cache
// warm), the number of pages, the weight of the site, of the search index and
// of the build outputs the site does not serve. Prints the figures as the
// markdown table of docs/guides/operations.md ("What to expect"), so that they
// can be refreshed with `pnpm measure` after `pnpm build`; `--json` prints
// them as JSON instead. `--corpus <path>` measures another configuration
// folder (fixtures/corpora/realistic/en by default).
import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { cpSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { cpus, tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

// Code-unit order, never the collation of the runtime: the output is the same on every machine.
const byCodeUnit = (a, b) => Number(a > b) - Number(a < b);

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bin = resolve(root, "packages/cli/dist/bin.js");
const { values } = parseArgs({
  options: {
    corpus: { type: "string", default: "fixtures/corpora/realistic/en" },
    json: { type: "boolean", default: false },
  },
});
const corpus = resolve(root, values.corpus);

function walk(dir, out = []) {
  for (const name of readdirSync(dir).sort(byCodeUnit)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

const bytesOf = (files) => files.reduce((sum, file) => sum + statSync(file).size, 0);
const megabytes = (bytes) => `${(bytes / 1_000_000).toFixed(1)} MB`;
const kilobytes = (bytes) => `${Math.round(bytes / 1000)} kB`;
const seconds = (ms) => `${(ms / 1000).toFixed(1)} s`;

function build(cwd) {
  const started = performance.now();
  const result = spawnSync(process.execPath, [bin, "build"], { cwd, encoding: "utf8" });
  const elapsed = performance.now() - started;
  if (result.status !== 0) {
    console.error(`measure: the build exited with ${String(result.status)}`);
    console.error(result.stdout + result.stderr);
    process.exit(1);
  }
  return elapsed;
}

const work = mkdtempSync(join(tmpdir(), "concordance-measure-"));
try {
  cpSync(corpus, work, { recursive: true });
  rmSync(join(work, "expected"), { recursive: true, force: true });
  rmSync(join(work, "dist"), { recursive: true, force: true });
  rmSync(join(work, ".concordance-cache"), { recursive: true, force: true });

  const sourceFiles = walk(work).filter((file) => !relative(work, file).startsWith("."));
  const markdown = sourceFiles.filter((file) => file.endsWith(".md"));
  const sources = readdirSync(work).filter((name) =>
    statSync(join(work, name)).isDirectory(),
  ).length;

  const first = build(work);
  const second = build(work);

  const dist = join(work, "dist");
  const files = walk(dist);
  const under = (prefix) => files.filter((file) => relative(dist, file).startsWith(prefix));
  const pages = files.filter((file) => file.endsWith(".html"));
  const fragments = under("fragments/");
  const mentions = fragments.filter((file) => file.endsWith(".mentions.json"));
  const searchIndex = under("search/").filter((file) => file.endsWith(".js"));
  const model = join(dist, "model.json");
  const log = join(dist, "build.log.json");
  const served = files.filter(
    (file) =>
      file !== model && file !== log && (!fragments.includes(file) || mentions.includes(file)),
  );

  const figures = {
    date: new Date().toISOString().slice(0, 10),
    machine: `${String(cpus().length)} cores, ${process.arch}, Node.js ${process.versions.node}`,
    corpus: {
      sources,
      markdownFiles: markdown.length,
      files: sourceFiles.length,
      bytes: bytesOf(sourceFiles),
    },
    firstBuildMs: Math.round(first),
    secondBuildMs: Math.round(second),
    pages: pages.length,
    siteBytes: bytesOf(served),
    pagesBytes: bytesOf(pages),
    largestPageBytes: Math.max(...pages.map((file) => statSync(file).size)),
    assetsBytes: bytesOf(under("assets/")),
    searchIndexBytes: bytesOf(searchIndex),
    mentionsBytes: bytesOf(mentions),
    modelBytes: statSync(model).size,
    fragmentsBytes: bytesOf(fragments.filter((file) => !mentions.includes(file))),
    logBytes: statSync(log).size,
    distBytes: bytesOf(files),
  };

  if (values.json) {
    console.log(JSON.stringify(figures, null, 2));
  } else {
    const rows = [
      [
        "Corpus",
        `${String(figures.corpus.markdownFiles)} markdown files in ${String(figures.corpus.sources)} sources, ${kilobytes(figures.corpus.bytes)}`,
      ],
      ["First build", seconds(figures.firstBuildMs)],
      ["Second build, same folder", seconds(figures.secondBuildMs)],
      ["Pages", String(figures.pages)],
      ["Site as served (pages, assets, search index, mentions)", megabytes(figures.siteBytes)],
      [
        "Pages alone",
        `${megabytes(figures.pagesBytes)}, largest ${kilobytes(figures.largestPageBytes)}`,
      ],
      ["Search index", kilobytes(figures.searchIndexBytes)],
      ["Mentions fragments", kilobytes(figures.mentionsBytes)],
      ["`model.json`", megabytes(figures.modelBytes)],
      ["Note fragments", megabytes(figures.fragmentsBytes)],
      ["`build.log.json`", kilobytes(figures.logBytes)],
      ["`dist/` in full", megabytes(figures.distBytes)],
    ];
    console.log(`Measured on ${figures.date} (${figures.machine}).`);
    console.log("");
    console.log("| Measure | Value |");
    console.log("|---|---|");
    for (const [label, value] of rows) console.log(`| ${label} | ${value} |`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
