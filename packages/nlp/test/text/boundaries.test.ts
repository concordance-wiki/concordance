import { describe, expect, it } from "vitest";

import { isOnWordBoundaries, languagePack, wordBoundaries } from "../../src/index.js";

const pack = languagePack("en");

describe("matches happen on word boundaries", () => {
  it("finds resource on word boundaries in a sentence", () => {
    expect(isOnWordBoundaries("the resource ends", 4, 12, pack)).toBe(true);
  });

  it("does not find resource on word boundaries inside resourceful", () => {
    expect(isOnWordBoundaries("resourceful", 0, 8, pack)).toBe(false);
  });

  it("requires the start and the end of the match to be boundaries", () => {
    expect(isOnWordBoundaries("the resource ends", 5, 12, pack)).toBe(false);
    expect(isOnWordBoundaries("the resource ends", 4, 13, pack)).toBe(false);
    expect(isOnWordBoundaries("resourceful", 3, 11, pack)).toBe(false);
  });

  it("accepts a match spanning several words", () => {
    expect(isOnWordBoundaries("a list mention entry", 2, 14, pack)).toBe(true);
  });

  it("accepts a match covering a single-word text", () => {
    expect(isOnWordBoundaries("resource", 0, 8, pack)).toBe(true);
  });

  it("gives the position of every word of a sentence with punctuation and a curly apostrophe", () => {
    expect(wordBoundaries("L’entité, lien-explicite; e-mail!", languagePack("fr"))).toEqual([
      { start: 0, end: 8, word: "L’entité" },
      { start: 10, end: 14, word: "lien" },
      { start: 15, end: 24, word: "explicite" },
      { start: 26, end: 27, word: "e" },
      { start: 28, end: 32, word: "mail" },
    ]);
  });

  it("gives no position for a text without words", () => {
    expect(wordBoundaries("... !", pack)).toEqual([]);
  });
});
