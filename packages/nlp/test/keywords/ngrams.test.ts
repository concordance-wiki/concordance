import { describe, expect, it } from "vitest";

import {
  extractNgrams,
  keywordForm,
  languagePack,
  ngramContext,
  ngramSurface,
  type ExtractNgramsOptions,
  type KeywordUnit,
  type NgramOccurrence,
} from "../../src/index.js";

const en = languagePack("en");
const fr = languagePack("fr");
const defaults: ExtractNgramsOptions = { maxWords: 4, minLength: 3 };

function keysOf(units: KeywordUnit[], options = defaults, pack = en): string[] {
  return extractNgrams(units, pack, options).map((occurrence) => occurrence.key);
}

describe("extractNgrams", () => {
  it("generates n-grams of one to four words over notes and documents", () => {
    const units = [
      { path: "notes/cap.md", line: 3, text: "Nightly build summary printed verbatim" },
      { path: "documents/minutes.md", line: 8, text: "Glossary owner" },
    ];
    expect(keysOf(units)).toEqual([
      "nightly",
      "nightly build",
      "nightly build summary",
      "nightly build summary printed",
      "build",
      "build summary",
      "build summary printed",
      "build summary printed verbatim",
      "summary",
      "summary printed",
      "summary printed verbatim",
      "printed",
      "printed verbatim",
      "verbatim",
      "glossary",
      "glossary owner",
      "owner",
    ]);
  });

  it("starts at the configured shortest n-gram and stops at the longest", () => {
    const units = [{ path: "a.md", line: 1, text: "nightly build summary printed verbatim" }];
    expect(keysOf(units, { minWords: 2, maxWords: 3, minLength: 3 })).toEqual([
      "nightly build",
      "nightly build summary",
      "build summary",
      "build summary printed",
      "summary printed",
      "summary printed verbatim",
      "printed verbatim",
    ]);
  });

  it("excludes n-grams starting or ending with a stopword", () => {
    const units = [{ path: "a.md", line: 1, text: "the cap of the build" }];
    expect(keysOf(units)).toEqual(["cap", "cap of the build", "build"]);
  });

  it("excludes n-grams starting or ending with a stopword of the French pack", () => {
    const units = [{ path: "a.md", line: 1, text: "Le plafond des liens" }];
    expect(keysOf(units, defaults, fr)).toEqual(["plafond", "plafond des lien", "lien"]);
  });

  it("compares the given stopwords in comparison form", () => {
    const units = [{ path: "a.md", line: 1, text: "Screens list the cap" }];
    const stopwords = new Set(["Screens", "the"]);
    expect(keysOf(units, { ...defaults, stopwords })).toEqual(["list", "list the cap", "cap"]);
  });

  it("excludes n-grams made only of digits", () => {
    const units = [{ path: "a.md", line: 1, text: "2026 03 12 workshop" }];
    expect(keysOf(units)).toEqual([
      "2026 03 12 workshop",
      "03 12 workshop",
      "12 workshop",
      "workshop",
    ]);
  });

  it("excludes n-grams under a minimum length", () => {
    const unit: KeywordUnit = { path: "a.md", line: 1, text: "EL MS api" };
    const units = [unit];
    expect(keysOf(units)).toEqual(["el ms", "el ms api", "ms api", "api"]);
    expect(extractNgrams(units, en, defaults)[3]).toStrictEqual({
      key: "api",
      path: "a.md",
      line: 1,
      position: 6,
      end: 9,
      unit,
    });
  });

  it("keys each n-gram on its normalised, singularised words", () => {
    const units = [
      { path: "a.md", line: 1, text: "Build summaries" },
      { path: "b.md", line: 1, text: "build summary" },
    ];
    const occurrences = extractNgrams(units, en, defaults);
    expect(occurrences.map((occurrence) => [occurrence.key, ngramSurface(occurrence)])).toEqual([
      ["build", "Build"],
      ["build summary", "Build summaries"],
      ["summary", "summaries"],
      ["build", "build"],
      ["build summary", "build summary"],
      ["summary", "summary"],
    ]);
  });

  it("carries where every occurrence was met, its surface and context read on demand", () => {
    const unit: KeywordUnit = {
      source: "specs",
      path: "a.md",
      line: 4,
      text: "In the Mentions API.",
    };
    const units = [unit];
    const occurrences = extractNgrams(units, en, { maxWords: 2, minLength: 3 });
    const expected: NgramOccurrence[] = [
      { key: "mention", source: "specs", path: "a.md", line: 4, position: 7, end: 15, unit },
      { key: "mention api", source: "specs", path: "a.md", line: 4, position: 7, end: 19, unit },
      { key: "api", source: "specs", path: "a.md", line: 4, position: 16, end: 19, unit },
    ];
    expect(occurrences).toEqual(expected);
    expect(occurrences.map(ngramSurface)).toEqual(["Mentions", "Mentions API", "API"]);
    expect(occurrences.map(ngramContext)).toEqual([
      "In the Mentions API.",
      "In the Mentions API.",
      "In the Mentions API.",
    ]);
    // The key of an expression met twice is one string, not one per occurrence.
    const twice = extractNgrams([...units, ...units], en, { maxWords: 1, minLength: 3 });
    expect(twice[0]?.key).toBe(twice[2]?.key);
  });

  it("quotes the inline code of a unit back in the context, the span and its position staying in the text read", () => {
    const [occurrence] = extractNgrams(
      [
        {
          path: "a.md",
          line: 1,
          text: "In the  Mentions API.",
          code: [{ at: 7, text: "site" }],
        },
      ],
      en,
      { minWords: 2, maxWords: 2, minLength: 4 },
    );
    expect(occurrence).toMatchObject({ key: "mention api", position: 8 });
    expect(occurrence && ngramSurface(occurrence)).toBe("Mentions API");
    expect(occurrence && ngramContext(occurrence)).toBe("In the site Mentions API.");
  });

  it("trims the context to 160 characters around the span with an ellipsis", () => {
    const text = `${"word ".repeat(20)}target span${" word".repeat(20)}`;
    const units = [{ path: "a.md", line: 1, text }];
    const occurrence = extractNgrams(units, en, defaults).find((o) => o.key === "target span");
    expect(occurrence).toMatchObject({ position: 100 });
    expect(occurrence && ngramSurface(occurrence)).toBe("target span");
    expect(occurrence && ngramContext(occurrence)).toBe(`…${text.slice(25, 185)}…`);
    expect(occurrence && ngramContext(occurrence)).toHaveLength(162);
  });

  it("marks only the cut side when the span sits near an edge of a long unit", () => {
    const text = `target span${" word".repeat(40)}`;
    const units = [{ path: "a.md", line: 1, text }];
    const occurrence = extractNgrams(units, en, defaults).find((o) => o.key === "target span");
    expect(occurrence && ngramContext(occurrence)).toBe(`${text.slice(0, 160)}…`);
  });
});

describe("keywordForm", () => {
  it("tokenises a term like the texts, cutting hyphens and singularising", () => {
    expect(keywordForm("Cold-start Mentions", en)).toBe("cold start mention");
    expect(keywordForm("", en)).toBe("");
  });
});
