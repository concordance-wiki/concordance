import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";

describe("@concordance-wiki/inference", () => {
  it("exposes exactly its public API", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "accumulateCooccurrences",
      "combineConfidences",
      "combineLinks",
      "combineOptions",
      "cooccurrenceLinks",
      "explicitLinks",
      "frontmatterLinks",
      "glossaryConfidence",
      "indexEntities",
      "neighbourhoodOptions",
      "neighbourhoodToModel",
      "resolveReference",
    ]);
  });
});
