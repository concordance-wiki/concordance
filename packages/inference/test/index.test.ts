import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";

describe("@concordance-wiki/inference", () => {
  it("exposes exactly its public API", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "DUPLICATE_CHECK",
      "DUPLICATE_DEFAULTS",
      "FALLBACK_RELATION",
      "MAX_DISPLAYED_NEIGHBOURS",
      "RELATION_ORIGIN",
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
      "relationLabel",
      "resolveDuplicateResources",
      "resolveReference",
      "typeRelations",
    ]);
  });
});
