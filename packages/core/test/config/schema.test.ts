import { describe, expect, it } from "vitest";

import { compiledSchema, readSchema } from "../../src/config/schema.js";

describe("readSchema", () => {
  it.each([
    "config",
    "lint",
    "profile",
    "type-module",
    "model",
    "lock",
    "theme",
    "plugin",
    "language-pack",
    "pseudonyms",
  ] as const)("reads the %s schema shipped with the package", (name) => {
    const schema = readSchema(name) as { $id?: string };
    expect(schema.$id).toBe(
      `https://concordance-wiki.github.io/concordance/schemas/${name}.schema.json`,
    );
  });
});

describe("compiledSchema", () => {
  it("compiles a schema once per process and hands the same validator back, its references registered", () => {
    expect(compiledSchema("config")).toBe(compiledSchema("config"));
    expect(readSchema("config")).toBe(readSchema("config"));
    const config = {
      version: 1,
      project: { name: "Wiki" },
      applications: [{ id: "wiki" }],
      sources: [{ name: "notes", path: "./notes", application: "wiki" }],
    };
    expect(compiledSchema("config")(config)).toBe(true);
    expect(compiledSchema("type-module")({})).toBe(false);
    expect(compiledSchema("lint")({ checks: { "W-STALE": { severity: "info" } } })).toBe(true);
  });
});
