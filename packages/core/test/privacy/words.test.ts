import { describe, expect, it } from "vitest";

import { fold, foldSegment, segment } from "../../src/privacy/words.js";

describe("segment", () => {
  it("cuts words and separators with their offsets", () => {
    expect(segment("Mary  Ann.")).toEqual([
      { text: "Mary", index: 0, isWordLike: true },
      { text: "  ", index: 4, isWordLike: false },
      { text: "Ann", index: 6, isWordLike: true },
      { text: ".", index: 9, isWordLike: false },
    ]);
  });

  it("cuts a word at its apostrophes so that the name after an elision stays a word", () => {
    expect(segment("d'Alice, l\u2019avis'", "fr")).toEqual([
      { text: "d", index: 0, isWordLike: true },
      { text: "'", index: 1, isWordLike: false },
      { text: "Alice", index: 2, isWordLike: true },
      { text: ",", index: 7, isWordLike: false },
      { text: " ", index: 8, isWordLike: false },
      { text: "l", index: 9, isWordLike: true },
      { text: "\u2019", index: 10, isWordLike: false },
      { text: "avis", index: 11, isWordLike: true },
      { text: "'", index: 15, isWordLike: false },
    ]);
  });
});

describe("fold", () => {
  it("lowercases and strips accents", () => {
    expect(fold("Élodie DUPONT")).toBe("elodie dupont");
  });
});

describe("foldSegment", () => {
  it("reads any run of whitespace as one space and folds the rest", () => {
    expect(foldSegment({ text: " \t ", index: 0, isWordLike: false })).toBe(" ");
    expect(foldSegment({ text: "Ça", index: 0, isWordLike: true })).toBe("ca");
  });
});
