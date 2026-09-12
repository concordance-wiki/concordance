import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { nodeFileSystem, nodeGit } from "@concordance-wiki/core";
import { ingestSources } from "@concordance-wiki/ingest";
import { afterAll, describe, expect, it } from "vitest";

/** Hash of every file under a tree, `.git` included, with its content and modification time. */
function fingerprint(root: string): string {
  const hash = createHash("sha256");
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(path);
      } else {
        hash.update(`${path}\n${String(statSync(path).mtimeMs)}\n`);
        hash.update(readFileSync(path));
      }
    }
  };
  walk(root);
  return hash.digest("hex");
}

function git(cwd: string, ...args: string[]): void {
  execFileSync(
    "git",
    [
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "-c",
      "commit.gpgsign=false",
      ...args,
    ],
    {
      cwd,
      stdio: "ignore",
    },
  );
}

describe("ingestion never writes into a source", () => {
  const root = mkdtempSync(join(tmpdir(), "concordance-no-write-"));
  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("leaves the git repository and the local folder byte-identical, modification times included", async () => {
    const origin = join(root, "origin");
    mkdirSync(join(origin, "notes"), { recursive: true });
    writeFileSync(join(origin, "notes/term.md"), "# Term\n");
    git(origin, "init", "-q", "-b", "main");
    git(origin, "add", ".");
    git(origin, "commit", "-q", "-m", "first");
    const local = join(root, "local");
    mkdirSync(local);
    writeFileSync(join(local, "note.md"), "# Note\n");
    const before = { origin: fingerprint(origin), local: fingerprint(local) };

    const result = await ingestSources(
      {
        version: 1,
        project: { name: "Test" },
        sources: [
          { name: "repo", git: `file://${origin}`, ref: "main" },
          { name: "folder", path: local },
        ],
      },
      {
        fs: nodeFileSystem,
        git: nodeGit,
        cacheDirectory: join(root, "cache"),
        configDirectory: root,
      },
    );

    expect(result.findings).toEqual([]);
    expect(result.sources.map((source) => source.files.map((file) => file.path))).toEqual([
      ["notes/term.md"],
      ["note.md"],
    ]);
    expect(fingerprint(origin)).toBe(before.origin);
    expect(fingerprint(local)).toBe(before.local);
  });
});
