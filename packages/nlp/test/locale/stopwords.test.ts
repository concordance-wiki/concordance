import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { languagePack, loadStopwords } from "../../src/index.js";

const expectedWords = {
  en: ["the", "a", "an", "of", "and", "is", "are", "with", "not", "which"],
  fr: ["le", "la", "les", "de", "des", "et", "est", "sont", "avec", "ne", "pas", "à"],
} as const;

function fileWords(locale: string): string[] {
  const url = new URL(`../../locales/${locale}/stopwords.txt`, import.meta.url);
  return readFileSync(url, "utf8")
    .split("\n")
    .filter((line) => line !== "" && !line.startsWith("#"));
}

describe.each(["en", "fr"] as const)("the %s pack ships default stopwords", (locale) => {
  const { stopwords } = languagePack(locale);

  it("contains the expected common words", () => {
    for (const word of expectedWords[locale]) {
      expect(stopwords.has(word), word).toBe(true);
    }
  });

  it("has at least 150 words", () => {
    expect(stopwords.size).toBeGreaterThanOrEqual(150);
  });

  it("has no capitalised word and none with spaces", () => {
    for (const word of stopwords) {
      expect(word, word).toBe(word.toLowerCase());
      expect(word, word).not.toMatch(/\s/);
    }
  });

  it("lists every word of the file once", () => {
    const listed = fileWords(locale);
    expect(new Set(listed).size).toBe(listed.length);
    expect(stopwords.size).toBe(listed.length);
    expect([...stopwords].sort()).toEqual([...listed].sort());
  });
});

describe("loadStopwords reads a stopword file", () => {
  it("returns the unique lowercase words sorted, skipping comments and blanks", () => {
    const text = [
      "# a comment line",
      "",
      "the",
      "The",
      "  of  ",
      "and # an inline comment",
      "   ",
      "a",
      "#",
      "of",
    ].join("\n");
    expect(loadStopwords(text)).toEqual(["a", "and", "of", "the"]);
  });

  it("accepts Windows line endings", () => {
    expect(loadStopwords("the\r\nof\r\n")).toEqual(["of", "the"]);
  });

  it("returns an empty list for an empty or comment-only text", () => {
    expect(loadStopwords("")).toEqual([]);
    expect(loadStopwords("# nothing\n\n")).toEqual([]);
  });

  it("keeps a multi-word line as one entry", () => {
    expect(loadStopwords("as well as\nas")).toEqual(["as", "as well as"]);
  });
});
