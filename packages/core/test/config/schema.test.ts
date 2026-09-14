import { describe, expect, it } from "vitest";

import { readSchema } from "../../src/config/schema.js";

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
