#!/usr/bin/env node
// Regenerates the answers of `concordance query` to the questions of a corpus. The corpus is
// read into a file system kept in memory, so that no date of the machine and no commit of the
// repository enters the answers; the clock is pinned to the epoch. Every question of
// `expected/query/questions.yaml` is run from the output folder and its answer written to
// `expected/query/<slug>.txt`: the exit code on the first line, the standard output, then the
// standard error. Usage: node scripts/query-fixtures.mjs [corpus]   (default realistic/en)
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

import { buildCommand } from "../packages/cli/dist/commands/build.js";
import { queryCommand } from "../packages/cli/dist/commands/query.js";
import { epochClock, memoryFileSystem } from "../packages/core/dist/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/** Where the corpus stands in the file system kept in memory. */
export const CORPUS_ROOT = "/corpus";
const TEXT_EXTENSIONS = new Set([
  ".md",
  ".yaml",
  ".yml",
  ".json",
  ".svg",
  ".txt",
  ".wsdl",
  ".xml",
  ".css",
]);

/** The questions of a corpus, as `questions.yaml` lists them. */
export function readQuestions(corpusDirectory) {
  const document = parse(
    readFileSync(join(corpusDirectory, "expected/query/questions.yaml"), "utf8"),
  );
  return document.questions;
}

/** A plugin of the workspace by its package name, from its built output; only the names of the workspace are looked up. */
async function loadPlugin(name) {
  const short = name.replace("@concordance-wiki/plugin-", "");
  if (!/^[a-z0-9-]+$/u.test(short) || !existsSync(resolve(root, "plugins", short))) {
    throw new Error(`no plugin of the workspace is named ${name}`);
  }
  const module = await import(resolve(root, "plugins", short, "dist/index.js"));
  return module.default;
}

/** Every file of a corpus, read into a file system kept in memory under `CORPUS_ROOT`. */
export function corpusInMemory(corpusDirectory) {
  const fs = memoryFileSystem();
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
        continue;
      }
      const path = `${CORPUS_ROOT}/${relative(corpusDirectory, absolute).split("\\").join("/")}`;
      if (TEXT_EXTENSIONS.has(extname(entry.name))) {
        fs.writeText(path, readFileSync(absolute, "utf8"));
      } else {
        fs.writeBytes(path, readFileSync(absolute));
      }
    }
  };
  walk(corpusDirectory);
  return fs;
}

/** Every source of the corpora is a local folder: git is never called. */
const noGit = {
  clone: () => Promise.reject(new Error("unexpected clone")),
  update: () => Promise.reject(new Error("unexpected update")),
  head: () => Promise.reject(new Error("unexpected head")),
  history: () => Promise.reject(new Error("unexpected history")),
};

/** The command line over the corpus in memory: what `out` and `err` receive is collected. */
export function ioOver(fs, cwd) {
  const stdout = [];
  const stderr = [];
  return {
    fs,
    git: noGit,
    clock: epochClock(0),
    cwd,
    stdout,
    stderr,
    out: (line) => stdout.push(line),
    err: (line) => stderr.push(line),
  };
}

/** The corpus built in memory; the output folder returned. */
export async function buildInMemory(corpusDirectory) {
  const fs = corpusInMemory(corpusDirectory);
  const io = ioOver(fs, CORPUS_ROOT);
  const output = `${CORPUS_ROOT}/dist`;
  const status = await buildCommand(["--output", output], io, {
    load: loadPlugin,
    commandAvailable: () => Promise.resolve(false),
  });
  if (status !== 0) {
    throw new Error(
      `the build of ${corpusDirectory} exited with ${String(status)}\n${io.stderr.join("\n")}`,
    );
  }
  return { fs, output };
}

/** One question run from the output folder: its exit code and its two streams, as the fixture records them. */
export async function askQuestion(fs, output, args) {
  const io = ioOver(fs, output);
  const status = await queryCommand([...args, "--model", "model.json", "--no-age"], io);
  const streams = [...io.stdout, ...io.stderr].map((line) => `${line}\n`).join("");
  return `exit ${String(status)}\n${streams}`;
}

/** The table of the questions and their invocations, written between the markers of the querying guide. */
export function writeGuideTable(guideFile, questions) {
  const quoted = (arg) => (/[\s"]/u.test(arg) ? `"${arg.replaceAll('"', String.raw`\"`)}"` : arg);
  const rows = questions.map((question) => {
    const command = question.args.map(quoted).join(" ");
    return `| ${question.asks} | \`concordance query ${command}\` |`;
  });
  const table = ["| An agent asks | It runs |", "|---|---|", ...rows].join("\n");
  const guide = readFileSync(guideFile, "utf8");
  const start = "<!-- questions:start -->";
  const end = "<!-- questions:end -->";
  const from = guide.indexOf(start);
  const to = guide.indexOf(end);
  if (from < 0 || to < from) throw new Error(`${guideFile}: the question markers are missing`);
  const updated = `${guide.slice(0, from + start.length)}\n${table}\n${guide.slice(to)}`;
  if (updated !== guide) writeFileSync(guideFile, updated);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const corpus = process.argv[2] ?? "realistic/en";
  // A corpus is a folder of the fixtures named `<name>/<locale>`, nothing else is read.
  if (!/^[a-z]+\/[a-z]{2}$/u.test(corpus))
    throw new Error(`not a corpus of the fixtures: ${corpus}`);
  const corpusDirectory = resolve(root, "fixtures/corpora", corpus);
  const { fs, output } = await buildInMemory(corpusDirectory);
  let defects = 0;
  for (const question of readQuestions(corpusDirectory)) {
    const answer = await askQuestion(fs, output, question.args);
    writeFileSync(join(corpusDirectory, "expected/query", `${question.slug}.txt`), answer);
    if (answer.startsWith("exit 2")) {
      defects += 1;
      console.error(`${question.slug}: the command refused the question\n${answer}`);
    }
    console.log(`${question.slug}: ${String(answer.length)} characters`);
  }
  writeGuideTable(resolve(root, "docs/guides/querying.md"), readQuestions(corpusDirectory));
  if (defects > 0) process.exit(1);
}
