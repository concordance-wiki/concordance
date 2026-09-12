import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";

describe("@concordance-wiki/core", () => {
  it("exposes exactly its public API", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "formatIssue",
      "formatValidation",
      "isWellFormedGlob",
      "memoryFileSystem",
      "nodeFileSystem",
      "parseConfig",
      "readSchema",
      "validateConfig",
    ]);
  });
});
