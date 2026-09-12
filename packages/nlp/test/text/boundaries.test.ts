import { describe, expect, it } from "vitest";

import { isOnWordBoundaries, languagePack, wordBoundaries } from "../../src/index.js";

const pack = languagePack("en");

describe("matches happen on word boundaries", () => {
  it("finds contract on word boundaries in a sentence", () => {
    expect(isOnWordBoundaries("the contract ends", 4, 12, pack)).toBe(true);
  });

  it("does not find contract on word boundaries inside contractual", () => {
    expect(isOnWordBoundaries("contractual", 0, 8, pack)).toBe(false);
  });

  it("requires the start and the end of the match to be boundaries", () => {
    expect(isOnWordBoundaries("the contract ends", 5, 12, pack)).toBe(false);
    expect(isOnWordBoundaries("the contract ends", 4, 13, pack)).toBe(false);
    expect(isOnWordBoundaries("contractual", 3, 11, pack)).toBe(false);
  });

  it("accepts a match spanning several words", () => {
    expect(isOnWordBoundaries("a free payment entry", 2, 14, pack)).toBe(true);
  });

  it("accepts a match covering a single-word text", () => {
    expect(isOnWordBoundaries("contract", 0, 8, pack)).toBe(true);
  });

  it("gives the position of every word of a sentence with punctuation and a curly apostrophe", () => {
    expect(wordBoundaries("L’adhérent, versement-libre; e-mail!", languagePack("fr"))).toEqual([
      { start: 0, end: 10, word: "L’adhérent" },
      { start: 12, end: 21, word: "versement" },
      { start: 22, end: 27, word: "libre" },
      { start: 29, end: 30, word: "e" },
      { start: 31, end: 35, word: "mail" },
    ]);
  });

  it("gives no position for a text without words", () => {
    expect(wordBoundaries("... !", pack)).toEqual([]);
  });
});
