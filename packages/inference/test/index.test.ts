import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";

describe("@concordance-wiki/inference", () => {
  it("exposes exactly its public API", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "CONTRACT_REPRESENTATION",
      "DUPLICATE_CHECK",
      "DUPLICATE_DEFAULTS",
      "FALLBACK_RELATION",
      "MATCH_RUNGS",
      "MAX_DISPLAYED_NEIGHBOURS",
      "OPERATION_AMBIGUOUS",
      "OPERATION_UNMATCHED",
      "RELATION_ORIGIN",
      "accumulateCooccurrences",
      "attachOperations",
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
      "importedOperations",
      "indexEntities",
      "locateLink",
      "mappedSection",
      "matchOperations",
      "mentionLinks",
      "mergeOperation",
      "neighbourhoodOptions",
      "neighbourhoodToModel",
      "operationNotes",
      "redirectLinks",
      "relationLabel",
      "resolveDuplicateResources",
      "resolveReference",
      "typeRelations",
    ]);
  });
});
