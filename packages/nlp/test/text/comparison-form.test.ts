import { describe, expect, it } from "vitest";

import { comparisonForm, comparisonWords, languagePack } from "../../src/index.js";

type Case = readonly [name: string, input: string, expected: string];

const cases: Record<"en" | "fr", readonly Case[]> = {
  en: [
    ["lower-cases", "Explicit Link", "explicit link"],
    ["strips a plural in -s", "explicit links", "explicit link"],
    ["brings -ies back to -y", "entities", "entity"],
    ["brings -sses back to -ss", "addresses", "address"],
    ["brings -xes back to -x", "boxes", "box"],
    ["keeps a short word in -s", "bus", "bus"],
    ["keeps a singular", "related cap", "related cap"],
    ["keeps the s of a possessive apostrophe", "author's note", "author's note"],
    ["keeps a hyphen inside a word", "e-mail", "e-mail"],
  ],
  fr: [
    ["lower-cases", "Lien Explicite", "lien explicite"],
    ["strips a plural in -s on every word", "liens explicites", "lien explicite"],
    ["brings -aux back to -al", "chevaux", "cheval"],
    ["brings -eaux back to -eau", "bateaux", "bateau"],
    ["brings -eux back to -eu", "jeux", "jeu"],
    ["brings -oux back to -ou", "bijoux", "bijou"],
    ["keeps an invariant word in -x", "prix", "prix"],
    ["strips the accent and keeps the apostrophe inside a word", "l'entité", "l'entite"],
    ["unifies a curly apostrophe", "l’entité", "l'entite"],
    ["strips accents and plurals together", "règles de gestion", "regle de gestion"],
    ["singularises each part of a hyphenated word", "coûts-bénéfices", "cout-benefice"],
  ],
};

describe.each(["en", "fr"] as const)(
  "normalisation is a pure function, tested on a named case set covering accents, case, plurals, hyphens and apostrophes, in the %s locale",
  (locale) => {
    const pack = languagePack(locale);

    it.each(cases[locale])("%s", (_name, input, expected) => {
      expect(comparisonForm(input, pack)).toBe(expected);
    });

    it("is idempotent over the case set", () => {
      for (const [, input] of cases[locale]) {
        const once = comparisonForm(input, pack);
        expect(comparisonForm(once, pack)).toBe(once);
      }
    });

    it("gives the same result on every call, without keeping any state", () => {
      for (const [, input] of cases[locale]) {
        expect(comparisonForm(input, pack)).toBe(comparisonForm(input, pack));
      }
    });
  },
);

describe("lower-casing, accent stripping for comparison, original form kept for display", () => {
  const pack = languagePack("fr");

  it("returns a new string and leaves the text given untouched", () => {
    const display = "Règles de Gestion";
    const compared = comparisonForm(display, pack);
    expect(compared).toBe("regle de gestion");
    expect(display).toBe("Règles de Gestion");
  });

  it("lists the singularised words in text order", () => {
    expect(comparisonWords("Les Liens  explicites\ndu build", pack)).toEqual([
      "les",
      "lien",
      "explicite",
      "du",
      "build",
    ]);
  });

  it("lists no word for an empty or blank text", () => {
    expect(comparisonWords("", pack)).toEqual([]);
    expect(comparisonWords(" \n\t", pack)).toEqual([]);
    expect(comparisonForm("  ", pack)).toBe("");
  });
});
