import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";

describe("@concordance-wiki/inference", () => {
  it("exposes exactly its public API", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "DUPLICATE_CHECK",
      "DUPLICATE_DEFAULTS",
      "MAX_DISPLAYED_NEIGHBOURS",
      "accumulateCooccurrences",
      "combineConfidences",
      "combineLinks",
      "combineOptions",
      "cooccurrenceLinks",
      "displayOptions",
      "displayedNeighbourhood",
      "displayedNeighbourhoodToModel",
      "duplicateOptions",
      "explicitLinks",
      "foldHeading",
      "formatDuplicateStats",
      "frontmatterLinks",
      "glossaryConfidence",
      "indexEntities",
      "mappedSection",
      "mentionLinks",
      "neighbourhoodOptions",
      "neighbourhoodToModel",
      "resolveDuplicateResources",
      "resolveReference",
    ]);
  });
});
