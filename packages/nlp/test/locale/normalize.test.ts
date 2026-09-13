import { describe, expect, it } from "vitest";

import { languagePack } from "../../src/index.js";

const cases: readonly [name: string, input: string, expected: string][] = [
  ["strips accents", "Réglementation", "reglementation"],
  ["strips every combining mark of a word", "Été à l'écran", "ete a l'ecran"],
  ["lower-cases", "Explicit Link", "explicit link"],
  ["unifies the curly apostrophe", "l’entité", "l'entite"],
  ["keeps the straight apostrophe", "l'entité", "l'entite"],
  ["collapses multiple spaces and tabs", "explicit \t  link\tentry", "explicit link entry"],
  ["collapses line breaks", "explicit\nlink", "explicit link"],
  ["trims", "  explicit link \n", "explicit link"],
  ["leaves an already normalised text unchanged", "explicit link", "explicit link"],
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
