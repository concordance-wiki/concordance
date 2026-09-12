import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";

describe("@concordance-wiki/nlp", () => {
  it("exposes the language pack registry, the stopword file reader and text normalisation", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "LanguagePackError",
      "availableLocales",
      "canonicalLocale",
      "comparisonForm",
      "comparisonWords",
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
