import { describe, expect, it } from "vitest";

import { repositoryFiles } from "../../src/glob/repository.js";
import { memoryFileSystem } from "../../src/io/file-system.js";

const fs = () =>
  memoryFileSystem({
    "/repo/.gitignore": "build/\n*.log\n",
    "/repo/README.md": "# Read me\n",
    "/repo/notes/a.md": "# A\n",
    "/repo/notes/debug.log": "",
    "/repo/build/site.md": "# Generated\n",
    "/repo/vendor/.gitignore": "*\n",
    "/repo/vendor/lib.md": "# Vendored\n",
    "/repo/drafts/wip.md": "# Draft\n",
  });

describe("repositoryFiles", () => {
  it("lists every file but the ones git ignores, in path order", () => {
    expect(repositoryFiles({ fs: fs(), root: "/repo" })).toEqual([
      ".gitignore",
      "README.md",
      "drafts/wip.md",
      "notes/a.md",
    ]);
  });

  it("drops the excluded globs before the ignore files are read, so an excluded ignore file never applies", () => {
    expect(
      repositoryFiles({ fs: fs(), root: "/repo", exclude: ["drafts/**", ".gitignore"] }),
    ).toEqual(["README.md", "build/site.md", "notes/a.md", "notes/debug.log"]);
  });

  it("keeps the ignored files when gitignore is off, and still drops the excluded ones", () => {
    expect(
      repositoryFiles({ fs: fs(), root: "/repo", exclude: ["**/*.log"], gitignore: false }),
    ).toEqual([
      ".gitignore",
      "README.md",
      "build/site.md",
      "drafts/wip.md",
      "notes/a.md",
      "vendor/.gitignore",
      "vendor/lib.md",
    ]);
  });
});
