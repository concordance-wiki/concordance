import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";

describe("@concordance-wiki/nlp", () => {
  it("exposes the language pack registry, the stopword file reader, text normalisation and the dictionary", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "HOMONYM_CHECK",
      "LanguagePackError",
      "availableLocales",
      "buildDictionary",
      "canonicalLocale",
      "comparisonForm",
      "comparisonWords",
      "dictionaryStopwords",
      "glossarySources",
      "isOnWordBoundaries",
      "languagePack",
      "loadLanguagePack",
      "loadStopwords",
      "registerLanguagePack",
      "resolveLocale",
      "singularize",
      "wordBoundaries",
    ]);
  });
});
