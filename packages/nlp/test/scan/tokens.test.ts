import { describe, expect, it } from "vitest";

import { languagePack, tokenize } from "../../src/index.js";

const en = languagePack("en");
const fr = languagePack("fr");

describe("tokenize", () => {
  it("gives each word its comparison form and its span in the original text", () => {
    expect(tokenize("The Free Payments, entered.", en)).toEqual([
      { word: "the", start: 0, end: 3 },
      { word: "free", start: 4, end: 8 },
      { word: "payment", start: 9, end: 17 },
      { word: "entered", start: 19, end: 26 },
    ]);
  });

  it("cuts a hyphenated compound into its parts", () => {
    expect(tokenize("un versement-libre", fr)).toEqual([
      { word: "un", start: 0, end: 2 },
      { word: "versement", start: 3, end: 12 },
      { word: "libre", start: 13, end: 18 },
    ]);
  });

  it("cuts the parts an apostrophe binds, whatever the apostrophe character", () => {
    expect(tokenize("l’écran d'accueil", fr)).toEqual([
      { word: "l", start: 0, end: 1 },
      { word: "ecran", start: 2, end: 7 },
      { word: "d", start: 8, end: 9 },
      { word: "accueil", start: 10, end: 17 },
    ]);
    expect(tokenize("dès d’aujourd’hui", fr)).toEqual([
      { word: "des", start: 0, end: 3 },
      { word: "d", start: 4, end: 5 },
      { word: "aujourd", start: 6, end: 13 },
      { word: "hui", start: 14, end: 17 },
    ]);
  });

  it("keeps the other characters the segmenter leaves inside a word", () => {
    expect(tokenize("version 3.14", en)).toEqual([
      { word: "version", start: 0, end: 7 },
      { word: "3.14", start: 8, end: 12 },
    ]);
  });

  it("skips a word whose comparison form is empty", () => {
    const pack = { ...en, normalize: (text: string) => en.normalize(text).replace(/\d/g, "") };
    expect(tokenize("version 42", pack)).toEqual([{ word: "version", start: 0, end: 7 }]);
  });

  it("gives no token for an empty or punctuation-only text", () => {
    expect(tokenize("", en)).toEqual([]);
    expect(tokenize(" — ...", en)).toEqual([]);
  });
});
