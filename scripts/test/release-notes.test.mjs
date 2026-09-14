import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  changelogSection,
  entriesByBump,
  publishedPackages,
  releaseNotes,
} from "../release-notes.mjs";

const roots = [];

/** A workspace of the given packages, each with its manifest and, when given, its changelog. */
function workspace(packages) {
  const root = mkdtempSync(join(tmpdir(), "concordance-notes-"));
  roots.push(root);
  writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n  - plugins/*\n");
  // A folder without a manifest is not a package.
  mkdirSync(join(root, "packages/empty"), { recursive: true });
  mkdirSync(join(root, "plugins"), { recursive: true });
  for (const { folder, name, version, changelog, isPrivate } of packages) {
    const dir = join(root, folder);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name, version, ...(isPrivate === true ? { private: true } : {}) }),
    );
    if (changelog !== undefined) writeFileSync(join(dir, "CHANGELOG.md"), changelog);
  }
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const coreChangelog = `# @concordance-wiki/core

## 0.2.0

### Minor Changes

- abc1234: Reads the profile once.
- abc1235: Sorts the findings.

  Every list is canonical.

### Patch Changes

- abc1236: Fixes the clock.
- Updated dependencies [abc1234]
  - @concordance-wiki/profile@0.2.0

## 0.1.0

### Minor Changes

- abc1230: Creates the package.
`;

const cliChangelog = `# @concordance-wiki/cli

## 0.2.0

### Minor Changes

- abc1234: Reads the profile once.

### Patch Changes

- Updated dependencies [abc1234]
  - @concordance-wiki/core@0.2.0
`;

describe("publishedPackages", () => {
  it("lists the public packages of every workspace folder by name, private ones left out", () => {
    const root = workspace([
      { folder: "plugins/reader", name: "@concordance-wiki/plugin-reader", version: "0.2.0" },
      { folder: "packages/core", name: "@concordance-wiki/core", version: "0.2.0" },
      { folder: "packages/fixture", name: "fixture", version: "0.0.0", isPrivate: true },
    ]);
    expect(publishedPackages(root).map((pkg) => pkg.name)).toEqual([
      "@concordance-wiki/core",
      "@concordance-wiki/plugin-reader",
    ]);
  });
});

describe("changelogSection", () => {
  it("returns the section of the version up to the next version", () => {
    expect(changelogSection(coreChangelog, "0.1.0")).toBe(
      "\n### Minor Changes\n\n- abc1230: Creates the package.\n",
    );
    expect(changelogSection(coreChangelog, "0.2.0")).toContain("- abc1236: Fixes the clock.");
    expect(changelogSection(coreChangelog, "0.2.0")).not.toContain("Creates the package");
  });

  it("returns undefined when the version has no section", () => {
    expect(changelogSection(coreChangelog, "0.3.0")).toBeUndefined();
  });
});

describe("entriesByBump", () => {
  it("groups the entries by bump, keeps their continuation lines and drops the dependency bumps", () => {
    const entries = entriesByBump(changelogSection(coreChangelog, "0.2.0"));
    expect(entries.get("Major")).toEqual([]);
    expect(entries.get("Minor")).toEqual([
      "- abc1234: Reads the profile once.",
      "- abc1235: Sorts the findings.\n\n  Every list is canonical.",
    ]);
    expect(entries.get("Patch")).toEqual(["- abc1236: Fixes the clock."]);
  });

  it("ignores an entry that stands before any bump heading", () => {
    expect([...entriesByBump("- stray entry\n\n### Patch Changes\n\n- kept\n").values()]).toEqual([
      [],
      [],
      ["- kept"],
    ]);
  });
});

describe("releaseNotes", () => {
  it("writes every entry once, by bump, and names the packages at the version", () => {
    const root = workspace([
      {
        folder: "packages/core",
        name: "@concordance-wiki/core",
        version: "0.2.0",
        changelog: coreChangelog,
      },
      {
        folder: "packages/cli",
        name: "@concordance-wiki/cli",
        version: "0.2.0",
        changelog: cliChangelog,
      },
      { folder: "packages/ui", name: "@concordance-wiki/ui", version: "0.1.0" },
    ]);
    expect(releaseNotes(root, "0.2.0")).toBe(
      [
        "## v0.2.0",
        "",
        "### Minor changes",
        "",
        "- abc1234: Reads the profile once.",
        "- abc1235: Sorts the findings.",
        "",
        "  Every list is canonical.",
        "",
        "### Patch changes",
        "",
        "- abc1236: Fixes the clock.",
        "",
        "### Packages at 0.2.0",
        "",
        "`@concordance-wiki/cli`, `@concordance-wiki/core`",
        "",
      ].join("\n"),
    );
  });

  it("fails when no changelog carries the version", () => {
    const root = workspace([
      {
        folder: "packages/core",
        name: "@concordance-wiki/core",
        version: "0.2.0",
        changelog: coreChangelog,
      },
    ]);
    expect(() => releaseNotes(root, "0.3.0")).toThrow(
      "no changelog carries an entry for version 0.3.0",
    );
  });
});
