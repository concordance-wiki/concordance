import { describe, expect, it } from "vitest";

import { markTitle } from "../../src/search/highlight.js";
import { queryWords } from "../../src/search/shared.js";

describe("markTitle", () => {
  it("marks the start of every token a word of the query prefixes, and keeps the rest plain", () => {
    expect(markTitle("Keyword page", queryWords("key"))).toEqual([
      { text: "Key", marked: true },
      { text: "word page", marked: false },
    ]);
    expect(markTitle("Keyword page", queryWords("page key"))).toEqual([
      { text: "Key", marked: true },
      { text: "word ", marked: false },
      { text: "page", marked: true },
    ]);
    expect(markTitle("Keyword page", queryWords("keyword"))).toEqual([
      { text: "Keyword", marked: true },
      { text: " page", marked: false },
    ]);
  });

  it("compares on the folded form the index uses: case and accents ignored, the marked text kept as written", () => {
    expect(markTitle("Épreuve du seuil", queryWords("epr"))).toEqual([
      { text: "Épr", marked: true },
      { text: "euve du seuil", marked: false },
    ]);
    expect(markTitle("Seuil de publication", queryWords("SEUIL"))).toEqual([
      { text: "Seuil", marked: true },
      { text: " de publication", marked: false },
    ]);
    expect(markTitle("Résumé de build", queryWords("résumé"))).toEqual([
      { text: "Résumé", marked: true },
      { text: " de build", marked: false },
    ]);
  });

  it("matches a token from its first letter or digit, past the punctuation the index trims, and marks the longest word", () => {
    expect(markTitle("(build) summary", queryWords("bu"))).toEqual([
      { text: "(", marked: false },
      { text: "bu", marked: true },
      { text: "ild) summary", marked: false },
    ]);
    expect(markTitle("keyword-page identifier", queryWords("keyword-p key"))).toEqual([
      { text: "keyword-p", marked: true },
      { text: "age identifier", marked: false },
    ]);
    // A dash between two words is a token without a letter: nothing to match there.
    expect(markTitle("Ab — Cd", queryWords("ab cd"))).toEqual([
      { text: "Ab", marked: true },
      { text: " — ", marked: false },
      { text: "Cd", marked: true },
    ]);
  });

  it("leaves a title plain when nothing matches, for an empty query, and gives one empty piece for an empty title", () => {
    expect(markTitle("Keyword page", queryWords("zebra"))).toEqual([
      { text: "Keyword page", marked: false },
    ]);
    expect(markTitle("Keyword page", [])).toEqual([{ text: "Keyword page", marked: false }]);
    expect(markTitle("", queryWords("key"))).toEqual([{ text: "", marked: false }]);
    expect(markTitle("  ", [])).toEqual([{ text: "  ", marked: false }]);
  });
});
