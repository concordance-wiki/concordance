import { describe, expect, it } from "vitest";

import {
  availableLocales,
  canonicalLocale,
  languagePack,
  type LanguagePack,
  registerLanguagePack,
  resolveLocale,
} from "../../src/index.js";

// A locale the engine does not ship, as a plugin would bring.
function fakePack(locale: string): LanguagePack {
  return {
    locale,
    language: "Test",
    normalize: (text) => text,
    segment: () => [],
    suffixes: new Set(),
    stopwords: new Set(),
    plural: [],
    collation: {},
    compare: (a, b) => Number(a > b) - Number(a < b),
  };
}

describe("each source accepts a locale, otherwise the project locale, default en", () => {
  it("takes the locale of the source first", () => {
    expect(resolveLocale({ locale: "fr" }, { locale: "en" })).toBe("fr");
    expect(resolveLocale({ locale: "en" }, { locale: "fr" })).toBe("en");
  });

  it("falls back to the project locale", () => {
    expect(resolveLocale({}, { locale: "fr" })).toBe("fr");
  });

  it("falls back to en when neither declares a locale", () => {
    expect(resolveLocale({}, {})).toBe("en");
  });

  it("returns the canonical form of a BCP 47 tag", () => {
    expect(resolveLocale({ locale: "FR-ca" }, {})).toBe("fr-CA");
    expect(canonicalLocale("en-us")).toBe("en-US");
  });

  it("rejects a malformed tag", () => {
    expect(() => canonicalLocale("not a tag")).toThrow(RangeError);
  });
});

describe("the locale selects a language pack built from data files", () => {
  it("gives the fr pack its name, normalisation, stopwords, plural rules and collation", () => {
    const pack = languagePack("fr");
    expect(pack.locale).toBe("fr");
    expect(pack.language).toBe("Français");
    expect(pack.normalize("Règle")).toBe("regle");
    expect(pack.stopwords.has("les")).toBe(true);
    expect(pack.plural.map((rule) => rule.ending)).toEqual([
      "eaux",
      "aux",
      "eux",
      "oux",
      "ss",
      "s",
    ]);
    expect(pack.compare("eau", "écran")).toBeLessThan(0);
  });

  it("gives the en pack its name, normalisation, stopwords, plural rules and collation", () => {
    const pack = languagePack("en");
    expect(pack.locale).toBe("en");
    expect(pack.language).toBe("English");
    expect(pack.normalize("Rule")).toBe("rule");
    expect(pack.stopwords.has("the")).toBe(true);
    expect(pack.plural[0]).toEqual({ ending: "ies", singular: "y", minLength: 5 });
    expect(pack.compare("item 2", "item 10")).toBeLessThan(0);
  });

  it("serves a regional variant with the pack of its language", () => {
    expect(languagePack("fr-CA").locale).toBe("fr");
    expect(languagePack("en-GB").locale).toBe("en");
  });

  it("segments a text into words with the locale's rules", () => {
    const words = languagePack("fr").segment("L'auteur écrit 10 fiches.");
    expect(words.filter((word) => word.isWordLike).map((word) => word.text)).toEqual([
      "L'auteur",
      "écrit",
      "10",
      "fiches",
    ]);
    expect(words[0]).toEqual({ text: "L'auteur", index: 0, isWordLike: true });
  });
});

describe("the en and fr packs are shipped; other locales come from plugins", () => {
  it("lists the shipped locales", () => {
    expect(availableLocales()).toEqual(expect.arrayContaining(["en", "fr"]));
  });

  it("names the shipped locales when asked for an unknown one", () => {
    expect(() => languagePack("de")).toThrow(
      /no language pack for locale "de": the engine ships en, fr/,
    );
  });

  it("refuses to register a locale twice", () => {
    expect(() => {
      registerLanguagePack(fakePack("en"));
    }).toThrow('a language pack for locale "en" is already registered');
  });

  it("serves a pack registered for a new locale and lists it", () => {
    registerLanguagePack(fakePack("xx"));
    expect(languagePack("xx").language).toBe("Test");
    expect(availableLocales()).toContain("xx");
  });
});
