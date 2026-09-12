import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { nodeFileSystem, type SourceConfig } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import { lintRepository } from "../src/local.js";

const templates = fileURLToPath(new URL("../../../docs/templates", import.meta.url));

/** The templates declare `type:` in their frontmatter; a rule per type mirrors what a project would write. */
const source: SourceConfig = {
  name: "templates",
  path: "./templates",
  rules: readdirSync(templates)
    .filter((name) => name.endsWith(".md") && name !== "README.md")
    .sort()
    .map((name) => ({ match: { frontmatter: "type" }, set: { type: name.replace(/\.md$/, "") } })),
};

describe("the note templates under docs/templates", () => {
  it("each pass the linter without a finding", () => {
    expect(source.rules?.length).toBeGreaterThan(10);
    expect(lintRepository({ root: templates, source, fs: nodeFileSystem })).toEqual([]);
  });
});
