import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";

describe("@concordance-wiki/nlp", () => {
  it("exposes the language pack registry, the stopword file reader, text normalisation, the dictionary and the occurrence scan", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "HOMONYM_CHECK",
      "LanguagePackError",
      "availableLocales",
      "buildAutomaton",
      "buildDictionary",
      "canonicalLocale",
      "compareOccurrences",
      "comparisonForm",
      "comparisonWords",
      "dictionaryStopwords",
      "glossarySources",
      "isOnWordBoundaries",
      "languagePack",
      "loadLanguagePack",
      "loadStopwords",
      "longestMatches",
      "occurrenceConfidence",
      "registerLanguagePack",
      "resolveLocale",
      "scan",
      "scanDocument",
      "singularize",
      "tokenize",
      "wordBoundaries",
    ]);
  });
});
