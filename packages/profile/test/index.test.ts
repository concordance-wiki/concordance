import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";

describe("@concordance-wiki/profile", () => {
  it("exposes exactly its public API", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "allowedRelations",
      "fingerprintProfile",
      "loadDefaultProfile",
      "mergeProfiles",
      "parseProfile",
      "resolveProfile",
      "singleRelation",
      "validateProfile",
    ]);
  });
});
