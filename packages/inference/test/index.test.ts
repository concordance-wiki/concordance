import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";

describe("@concordance-wiki/inference", () => {
  it("exposes exactly its public API", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "MAX_DISPLAYED_NEIGHBOURS",
      "accumulateCooccurrences",
      "combineConfidences",
      "combineLinks",
      "combineOptions",
      "cooccurrenceLinks",
      "displayOptions",
      "displayedNeighbourhood",
      "displayedNeighbourhoodToModel",
      "explicitLinks",
      "foldHeading",
      "frontmatterLinks",
      "glossaryConfidence",
      "indexEntities",
      "mappedSection",
      "mentionLinks",
      "neighbourhoodOptions",
      "neighbourhoodToModel",
      "resolveReference",
    ]);
  });
});
