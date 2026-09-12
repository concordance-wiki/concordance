import type { Config } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import { keywordDefaults, keywordOptions, type KeywordOptions } from "../../src/index.js";

const config: Config = { version: 1, project: { name: "Minimal" }, sources: [] };

describe("keywordOptions", () => {
  it("defaults to n-grams of one to four words, three occurrences, two documents and a score of four", () => {
    const expected: KeywordOptions = {
      minWords: 1,
      maxWords: 4,
      minLength: 3,
      minOccurrences: 3,
      minDocuments: 2,
      minScore: 4,
      rejected: new Set(),
    };
    expect(keywordOptions(config)).toEqual(expected);
    expect(keywordOptions({ ...config, inference: {} })).toEqual(expected);
    expect(keywordOptions({ ...config, inference: { ngrams: {} } })).toEqual(expected);
    expect(keywordDefaults).toEqual({
      minWords: 1,
      maxWords: 4,
      minLength: 3,
      minOccurrences: 3,
      minDocuments: 2,
      minScore: 4,
    });
  });

  it("reads inference.ngrams and inference.candidate_score", () => {
    const configured: Config = {
      ...config,
      inference: {
        ngrams: { min: 2, max: 3, min_occurrences: 5, min_documents: 3 },
        candidate_score: 2.5,
      },
    };
    expect(keywordOptions(configured)).toEqual({
      minWords: 2,
      maxWords: 3,
      minLength: 3,
      minOccurrences: 5,
      minDocuments: 3,
      minScore: 2.5,
      rejected: new Set(),
    });
  });

  it("takes the rejected terms of the lock as written", () => {
    const lock = { rejected_terms: ["Exceptional payments", "server-side"] };
    expect(keywordOptions(config, lock).rejected).toEqual(
      new Set(["Exceptional payments", "server-side"]),
    );
    expect(keywordOptions(config, {}).rejected).toEqual(new Set());
  });
});
