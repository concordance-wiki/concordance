import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";

describe("@concordance-wiki/nlp", () => {
  it("exposes the language pack registry and the stopword file reader", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "LanguagePackError",
      "availableLocales",
      "canonicalLocale",
      "languagePack",
      "loadLanguagePack",
      "loadStopwords",
      "registerLanguagePack",
      "resolveLocale",
    ]);
  });
});
