import type { Locale } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import {
  availableLocales,
  languagePack,
  type LanguagePack,
  registerLanguagePack,
  resolveLocale,
} from "../../src/index.js";

// A locale the configuration does not accept, as a plugin would bring.
const extra = "xx" as Locale;

function fakePack(locale: Locale): LanguagePack {
  const collator = new Intl.Collator("en");
  return {
    locale,
    normalize: (text) => text,
    stopwords: new Set(),
    typePrefixes: {},
    collator,
    compare: (a, b) => collator.compare(a, b),
  };
}

describe("each source accepts locale en or fr, otherwise the project locale, default en", () => {
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
});

describe("the locale selects a language pack", () => {
  it("gives normalisation, stopwords, type prefixes and collation for fr", () => {
    const pack = languagePack("fr");
    expect(pack.locale).toBe("fr");
    expect(pack.normalize("Règle")).toBe("regle");
    expect(pack.stopwords.has("les")).toBe(true);
    expect(pack.typePrefixes["screen"]).toEqual(["écran", "page"]);
    expect(pack.compare("eau", "écran")).toBeLessThan(0);
  });

  it("gives normalisation, stopwords, type prefixes and collation for en", () => {
    const pack = languagePack("en");
    expect(pack.locale).toBe("en");
    expect(pack.normalize("Rule")).toBe("rule");
    expect(pack.stopwords.has("the")).toBe(true);
    expect(pack.typePrefixes["screen"]).toEqual(["screen", "page"]);
    expect(pack.compare("item 2", "item 10")).toBeLessThan(0);
  });

  it("returns the same pack instance on every call", () => {
    expect(languagePack("en")).toBe(languagePack("en"));
  });
});

describe("the en and fr packs are in the core; an unknown locale is a configuration error unless a plugin provides it", () => {
  it("lists en and fr before any registration", () => {
    expect(availableLocales()).toEqual(["en", "fr"]);
  });

  it("throws on an unknown locale", () => {
    expect(() => languagePack(extra)).toThrow(
      'no language pack for locale "xx": the core ships en and fr, other locales come from plugins',
    );
  });

  it("throws on re-registering a core locale", () => {
    expect(() => {
      registerLanguagePack(fakePack("en"));
    }).toThrow('a language pack for locale "en" is already registered');
    expect(() => {
      registerLanguagePack(fakePack("fr"));
    }).toThrow('a language pack for locale "fr" is already registered');
    expect(languagePack("en").stopwords.has("the")).toBe(true);
  });

  it("serves and lists a locale a plugin registers, sorted", () => {
    const pack = fakePack(extra);
    registerLanguagePack(pack);
    expect(languagePack(extra)).toBe(pack);
    expect(availableLocales()).toEqual(["en", "fr", "xx"]);
  });

  it("throws on registering a plugin locale twice", () => {
    expect(() => {
      registerLanguagePack(fakePack(extra));
    }).toThrow('a language pack for locale "xx" is already registered');
  });
});
