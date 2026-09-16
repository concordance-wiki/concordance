import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

import { epochClock } from "@concordance-wiki/core";
import { describe, expect, it, vi } from "vitest";
import { parse } from "yaml";

import { buildCommand } from "../../src/commands/build.js";
import { queryCommand } from "../../src/commands/query.js";
import { recordedIo, type RecordedIo } from "../helpers.js";

// One full build of the realistic corpus; the machine may be loaded.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

const corpus = resolve(import.meta.dirname, "../../../../fixtures/corpora/realistic/en");
const CORPUS_ROOT = "/corpus";
const TEXT = new Set([".md", ".yaml", ".yml", ".json", ".svg", ".txt", ".wsdl", ".xml", ".css"]);
/** What one answer may weigh, in characters: what fits in a context with room to spare. */
const ANSWER_BUDGET = 6000;

interface Question {
  slug: string;
  asks: string;
  args: string[];
}

/** The corpus read into a file system kept in memory, the clock at the epoch: no date of the machine, no commit, enters the answers. */
function corpusInMemory(): RecordedIo {
  // Every source of the corpus is a local folder: the fake git is never asked to clone.
  const io = recordedIo({}, CORPUS_ROOT);
  io.clock = epochClock(0);
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
        continue;
      }
      const path = `${CORPUS_ROOT}/${relative(corpus, absolute).split("\\").join("/")}`;
      if (TEXT.has(extname(entry.name))) {
        io.fs.writeText(path, readFileSync(absolute, "utf8"));
      } else {
        io.fs.writeBytes(path, readFileSync(absolute));
      }
    }
  };
  walk(corpus);
  return io;
}

const plugins: Record<string, () => Promise<{ default: unknown }>> = {
  "@concordance-wiki/plugin-reader-office": () => import("@concordance-wiki/plugin-reader-office"),
};

function questions(): Question[] {
  const document = parse(readFileSync(join(corpus, "expected/query/questions.yaml"), "utf8")) as {
    questions: Question[];
  };
  return document.questions;
}

describe("The questions an agent asks are answered in one invocation each, as recorded", () => {
  it("answers every recorded question to the byte, within the budget, and refuses none", async () => {
    const built = corpusInMemory();
    expect(
      await buildCommand(["--output", `${CORPUS_ROOT}/dist`], built, {
        load: async (name) => {
          const loader = plugins[name];
          if (loader === undefined) throw new Error(`no plugin ${name}`);
          return (await loader()).default;
        },
        commandAvailable: () => Promise.resolve(false),
      }),
    ).toBe(0);
    const asked = questions();
    expect(asked.length).toBeGreaterThanOrEqual(20);
    const differences: string[] = [];
    for (const question of asked) {
      const io = recordedIo({}, `${CORPUS_ROOT}/dist`);
      io.fs = built.fs;
      io.clock = epochClock(0);
      const status = await queryCommand(
        [...question.args, "--model", "model.json", "--no-age"],
        io,
      );
      const answer = `exit ${String(status)}\n${io.stdout.map((line) => `${line}\n`).join("")}${io.stderr.map((line) => `${line}\n`).join("")}`;
      expect(status, `${question.slug}: the command refused the question`).not.toBe(2);
      expect(answer.length, `${question.slug}: over the budget`).toBeLessThanOrEqual(ANSWER_BUDGET);
      const recorded = readFileSync(join(corpus, "expected/query", `${question.slug}.txt`), "utf8");
      if (recorded !== answer) differences.push(question.slug);
    }
    expect(
      differences,
      "run pnpm query-fixtures:update after a change to the corpus or the wording",
    ).toEqual([]);
    expect(
      readdirSync(join(corpus, "expected/query"))
        .filter((name) => name.endsWith(".txt"))
        .sort(),
    ).toEqual(asked.map((question) => `${question.slug}.txt`).sort());
  });
});
