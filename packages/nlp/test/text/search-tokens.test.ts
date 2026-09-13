import { describe, expect, it } from "vitest";

import { languagePack, searchTokens } from "../../src/index.js";

const en = languagePack("en");
const fr = languagePack("fr");

describe("searchTokens", () => {
  it("normalises every word with the pack and adds its comparison form, so that a prefix of either finds the note", () => {
    expect([...searchTokens("The Checks of Entities", en)]).toEqual([
      "the",
      "checks",
      "check",
      "of",
      "entities",
      "entity",
    ]);
    expect([...searchTokens("Règles de gestion", fr)]).toEqual([
      "regles",
      "regle",
      "de",
      "gestion",
    ]);
  });

  it("keeps a word with a separator inside as one token and adds each of its parts", () => {
    expect([...searchTokens("coûts-bénéfices", fr)]).toEqual([
      "couts-benefices",
      "cout-benefice",
      "couts",
      "cout",
      "benefices",
      "benefice",
    ]);
    expect([...searchTokens("business_object inference/recognition", en)]).toEqual([
      "business_object",
      "business",
      "object",
      "inference/recognition",
      "inference",
      "recognition",
    ]);
    expect([...searchTokens("l’entité", fr)]).toEqual(["l'entite", "entite"]);
  });

  it("trims the punctuation around a word and drops what is shorter than the minimum, two characters by default", () => {
    expect([...searchTokens("(build) summary: a I.D. — ok!", en)]).toEqual([
      "build",
      "summary",
      "i.d",
      "ok",
    ]);
    expect([...searchTokens("a bc def", en, 3)]).toEqual(["def"]);
    expect([...searchTokens("", en)]).toEqual([]);
    expect([...searchTokens(" ... ", en)]).toEqual([]);
  });

  it("gives each token once", () => {
    expect([...searchTokens("check check checks", en)]).toEqual(["check", "checks"]);
  });
});
