import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";

describe("@concordance-wiki/nlp", () => {
  it("exposes the language pack registry, the stopword file reader, text normalisation, the dictionary, the occurrence scan and the keyword discovery", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "HOMONYM_CHECK",
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
      "keywordForm",
      "keywordForms",
      "keywordOptions",
      "languagePack",
      "loadLanguagePack",
      "loadStopwords",
      "longestMatches",
      "occurrenceConfidence",
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
