import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";

describe("@concordance-wiki/inference", () => {
  it("exposes exactly its public API", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "accumulateCooccurrences",
      "cooccurrenceLinks",
      "explicitLinks",
      "frontmatterLinks",
      "indexEntities",
      "neighbourhoodOptions",
      "neighbourhoodToModel",
      "resolveReference",
    ]);
  });
});
