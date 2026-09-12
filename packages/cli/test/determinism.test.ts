import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

import {
  fixedClock,
  memoryFileSystem,
  nodeFileSystem,
  parseModel,
  type BuildLog,
} from "@concordance-wiki/core";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { main } from "../src/main.js";
import { FakeGit } from "./helpers.js";

const root = resolve(import.meta.dirname, "../../..");
const config = join(root, "fixtures/corpora/minimal/en/concordance.yaml");
const executable = join(root, "packages/cli/dist/bin.js");

/** Every file under a tree: forward-slash path relative to the root, in code-unit order, with its content hash. */
function listTree(tree: string): [path: string, digest: string][] {
  const entries: [string, string][] = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
      } else {
        const path = relative(tree, absolute).split("\\").join("/");
        entries.push([path, createHash("sha256").update(readFileSync(absolute)).digest("hex")]);
      }
    }
  };
  walk(tree);
  return entries.sort(([a], [b]) => Number(a > b) - Number(a < b));
}

/** One hash for the whole tree: the paths and the contents, nothing else (no time, no mode). */
function fingerprint(tree: string): string {
  const hash = createHash("sha256");
  for (const [path, digest] of listTree(tree)) {
    hash.update(`${path}\n${digest}\n`);
  }
  return hash.digest("hex");
}

function readLog(tree: string): BuildLog {
  // Our own JSON, written by the build under test.
  return JSON.parse(readFileSync(join(tree, "build.log.json"), "utf8")) as BuildLog;
}

// Two full builds and possibly a compilation of the command line; the machine may be loaded.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 180_000 });

describe("An integration test builds the golden corpus twice and compares the fingerprints of model.json and of the dist/ tree", () => {
  const outputs: string[] = [];
  const temporaryOutput = (): string => {
    const output = mkdtempSync(join(tmpdir(), "concordance-determinism-"));
    outputs.push(output);
    return output;
  };

  afterEach(() => {
    for (const output of outputs.splice(0)) {
      rmSync(output, { recursive: true, force: true });
    }
  });

  async function buildInProcess(output: string): Promise<number> {
    return main(["build", "--config", config, "--output", output], {
      fs: nodeFileSystem,
      git: new FakeGit(memoryFileSystem()),
      clock: fixedClock("2026-09-12T12:00:00Z"),
      cwd: root,
      out: () => undefined,
      err: () => undefined,
    });
  }

  // Parallel steps (conversion, once it exists) must sort their outputs before writing; this is the test that catches an unsorted one.
  it("produces byte-identical output trees from two builds in the same process with a fixed clock", async () => {
    const first = temporaryOutput();
    const second = temporaryOutput();
    expect(await buildInProcess(first)).toBe(2);
    expect(await buildInProcess(second)).toBe(2);
    // No site yet: every file the build writes is compared, today the log and the model.
    expect(listTree(first).map(([path]) => path)).toEqual(["build.log.json", "model.json"]);
    expect(listTree(second)).toEqual(listTree(first));
    expect(fingerprint(second)).toBe(fingerprint(first));
    expect(readLog(first).at).toBe("2026-09-12T12:00:00.000Z");
    expect(parseModel(readFileSync(join(first, "model.json"), "utf8")).build.at).toBe(
      "2026-09-12T12:00:00.000Z",
    );
  });

  describe("through the real executable", () => {
    beforeAll(() => {
      if (!existsSync(executable)) {
        const tsc = join(root, "node_modules/typescript/bin/tsc");
        execFileSync(process.execPath, [tsc, "-b", "packages/cli/tsconfig.build.json"], {
          cwd: root,
          stdio: "inherit",
        });
      }
    });

    function buildWithExecutable(output: string): { status: number | null; stderr: string } {
      const run = spawnSync(
        process.execPath,
        [executable, "build", "--config", config, "--output", output],
        { cwd: root, encoding: "utf8", env: { ...process.env, SOURCE_DATE_EPOCH: "0" } },
      );
      return { status: run.status, stderr: run.stderr };
    }

    it("pins the only timestamp with SOURCE_DATE_EPOCH and yields byte-identical trees from two runs", () => {
      const first = temporaryOutput();
      const second = temporaryOutput();
      const runs = [buildWithExecutable(first), buildWithExecutable(second)];
      for (const run of runs) {
        expect(run.status).toBe(2);
        expect(run.stderr).toContain("not implemented in this version");
      }
      expect(readLog(first).at).toBe("1970-01-01T00:00:00.000Z");
      expect(parseModel(readFileSync(join(first, "model.json"), "utf8")).build.at).toBe(
        "1970-01-01T00:00:00.000Z",
      );
      expect(listTree(second)).toEqual(listTree(first));
      expect(listTree(first).map(([path]) => path)).toEqual(["build.log.json", "model.json"]);
      expect(fingerprint(second)).toBe(fingerprint(first));
    });
  });
});
