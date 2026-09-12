import { describe, expect, it } from "vitest";

import { languagePack } from "../../src/index.js";

const cases: readonly [name: string, input: string, expected: string][] = [
  ["strips accents", "Réglementation", "reglementation"],
  ["strips every combining mark of a word", "Été à l'écran", "ete a l'ecran"],
  ["lower-cases", "Free Payment", "free payment"],
  ["unifies the curly apostrophe", "l’adhérent", "l'adherent"],
  ["keeps the straight apostrophe", "l'adhérent", "l'adherent"],
  ["collapses multiple spaces and tabs", "free \t  payment\tentry", "free payment entry"],
  ["collapses line breaks", "free\npayment", "free payment"],
  ["trims", "  free payment \n", "free payment"],
  ["leaves an already normalised text unchanged", "free payment", "free payment"],
  ["keeps hyphens and digits", "Item-2", "item-2"],
];

describe.each(["en", "fr"] as const)("the %s pack normalises text for comparison", (locale) => {
  const pack = languagePack(locale);

  it.each(cases)("%s", (_name, input, expected) => {
    expect(pack.normalize(input)).toBe(expected);
  });

  it("is idempotent", () => {
    const once = pack.normalize("  Réglementation  de l’Écran ");
    expect(pack.normalize(once)).toBe(once);
  });
});
