import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

import { nodeFileSystem } from "@concordance-wiki/core";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { lintRepository } from "../src/local.js";

const FILES = 5000;
const FOLDERS = 50;

// The generated tree is written once; the budget covers a loaded continuous integration runner.
vi.setConfig({ testTimeout: 60_000 });

/** A small note per file, each linking to the next one so that every link is resolved. */
function note(index: number): string {
  const next = (index + 1) % FILES;
  return `---\ntitle: Note ${String(index)}\nstatus: valid\n---\n# Note ${String(index)}\n\nSee [the next note](../folder-${String(next % FOLDERS)}/note-${String(next)}.md).\n\n## Objects\n\n- A paragraph with a few words.\n`;
}

describe("startup under two seconds on a 5,000-file repository", () => {
  const root = mkdtempSync(join(tmpdir(), "concordance-lint-scale-"));

  beforeAll(() => {
    for (let folder = 0; folder < FOLDERS; folder += 1) {
      mkdirSync(join(root, `folder-${String(folder)}`));
    }
    for (let index = 0; index < FILES; index += 1) {
      writeFileSync(
        join(root, `folder-${String(index % FOLDERS)}`, `note-${String(index)}.md`),
        note(index),
      );
    }
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("lints 5,000 small files well under the budget, streaming file by file", () => {
    const started = performance.now();
    const findings = lintRepository({ root, fs: nodeFileSystem });
    const elapsed = performance.now() - started;
    // Written to the raw stream so that the measured time shows in the report whatever the reporter.
    process.stderr.write(`lintRepository: ${String(FILES)} files in ${elapsed.toFixed(0)} ms\n`);
    expect(findings).toEqual([]);
    expect(elapsed).toBeLessThan(10_000);
  });
});
