import { memoryFileSystem, type Config } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import { lintedFiles } from "../src/files.js";

const root = "/repo";

const fs = () =>
  memoryFileSystem({
    [`${root}/.gitignore`]: "build/\n",
    [`${root}/note.md`]: "# Note\n",
    [`${root}/drafts/wip.md`]: "# Draft\n",
    [`${root}/vendor/lib.md`]: "# Vendored\n",
    [`${root}/build/page.md`]: "# Built\n",
  });

const config: Config = {
  version: 1,
  project: { name: "Wiki" },
  sources: [],
  privacy: { exclude: ["drafts/**"] },
};

describe("lintedFiles", () => {
  it("lists every file but the ones git ignores when nothing else excludes any", () => {
    expect(lintedFiles({ root, fs: fs() })).toEqual([
      ".gitignore",
      "drafts/wip.md",
      "note.md",
      "vendor/lib.md",
    ]);
  });

  it("applies privacy.exclude of the configuration and exclude of concordance-lint.yaml together", () => {
    expect(
      lintedFiles({ root, fs: fs(), config, overrides: { checks: {}, exclude: ["vendor/**"] } }),
    ).toEqual([".gitignore", "note.md"]);
  });

  it("keeps the ignored files when gitignore is off", () => {
    expect(lintedFiles({ root, fs: fs(), config, gitignore: false })).toEqual([
      ".gitignore",
      "build/page.md",
      "note.md",
      "vendor/lib.md",
    ]);
  });
});
