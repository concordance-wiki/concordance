import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";

describe("@concordance-wiki/nlp", () => {
  it("exposes the language pack registry, the stopword file reader, text normalisation, the search tokens, the dictionary, the occurrence scan, the keyword discovery and its publication", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "HOMONYM_CHECK",
      "KEYWORD_TYPE",
      "LanguagePackError",
      "SIMILAR_EXPRESSIONS_LIMIT",
      "UNDEFINED_TERM_CHECK",
      "availableLocales",
      "buildAutomaton",
      "buildDictionary",
      "canonicalLocale",
      "compareMentions",
      "compareOccurrences",
      "comparisonForm",
      "comparisonWords",
      "definedExpressions",
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
      "searchTokens",
      "similarExpressions",
      "similarForm",
      "singularize",
      "tokenize",
      "undefinedTermFindings",
      "wordBoundaries",
    ]);
  });
});
