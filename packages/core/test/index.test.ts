import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";

describe("@concordance-wiki/core", () => {
  it("exposes exactly its public API", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "compareFindings",
      "compileGlobs",
      "describeSchemaError",
      "fixedClock",
      "formatIssue",
      "formatValidation",
      "isWellFormedGlob",
      "memoryFileSystem",
      "nodeFileSystem",
      "nodeGit",
      "parseConfig",
      "readSchema",
      "systemClock",
      "validateConfig",
    ]);
  });
});
