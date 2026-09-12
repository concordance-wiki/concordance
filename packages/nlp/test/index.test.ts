import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";

describe("@concordance-wiki/nlp", () => {
  it("exposes the language pack registry, the stopword file reader, text normalisation, the dictionary, the occurrence scan, the keyword discovery and its publication", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "HOMONYM_CHECK",
      "KEYWORD_TYPE",
      "LanguagePackError",
      "UNDEFINED_TERM_CHECK",
      "availableLocales",
      "buildAutomaton",
      "buildDictionary",
      "canonicalLocale",
      "compareMentions",
      "compareOccurrences",
      "comparisonForm",
      "comparisonWords",
      "dictionaryStopwords",
      "extractNgrams",
      "glossarySources",
      "isOnWordBoundaries",
      "keywordDefaults",
      "keywordEntities",
      "keywordForm",
      "keywordForms",
      "keywordOptions",
      "keywordPublicationDefaults",
      "keywordPublicationOptions",
      "languagePack",
      "loadLanguagePack",
      "loadStopwords",
      "longestMatches",
      "occurrenceConfidence",
      "publishKeywords",
      "registerLanguagePack",
      "resolveLocale",
      "scan",
      "scanDocument",
      "scoreCandidates",
      "singularize",
      "tokenize",
      "undefinedTermFindings",
      "wordBoundaries",
    ]);
  });
});
