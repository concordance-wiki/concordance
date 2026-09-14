import { describe, expect, it } from "vitest";

import {
  extractNgrams,
  keywordForm,
  languagePack,
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
    const units = [{ path: "a.md", line: 1, text: "EL MS api" }];
    expect(keysOf(units)).toEqual(["el ms", "el ms api", "ms api", "api"]);
    expect(extractNgrams(units, en, defaults)[3]).toStrictEqual({
      key: "api",
      surface: "api",
      path: "a.md",
      line: 1,
      position: 6,
      context: "EL MS api",
    });
  });

  it("keys each n-gram on its normalised, singularised words", () => {
    const units = [
      { path: "a.md", line: 1, text: "Build summaries" },
      { path: "b.md", line: 1, text: "build summary" },
    ];
    const occurrences = extractNgrams(units, en, defaults);
    expect(occurrences.map((occurrence) => [occurrence.key, occurrence.surface])).toEqual([
      ["build", "Build"],
      ["build summary", "Build summaries"],
      ["summary", "summaries"],
      ["build", "build"],
      ["build summary", "build summary"],
      ["summary", "summary"],
    ]);
  });

  it("carries the surface form, the position and the source of every occurrence", () => {
    const units = [{ source: "specs", path: "a.md", line: 4, text: "In the Mentions API." }];
    const occurrences = extractNgrams(units, en, { maxWords: 2, minLength: 3 });
    const expected: NgramOccurrence[] = [
      {
        key: "mention",
        surface: "Mentions",
        source: "specs",
        path: "a.md",
        line: 4,
        position: 7,
        context: "In the Mentions API.",
      },
      {
        key: "mention api",
        surface: "Mentions API",
        source: "specs",
        path: "a.md",
        line: 4,
        position: 7,
        context: "In the Mentions API.",
      },
      {
        key: "api",
        surface: "API",
        source: "specs",
        path: "a.md",
        line: 4,
        position: 16,
        context: "In the Mentions API.",
      },
    ];
    expect(occurrences).toEqual(expected);
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
    expect(occurrence).toMatchObject({
      key: "mention api",
      surface: "Mentions API",
      position: 8,
      context: "In the site Mentions API.",
    });
  });

  it("trims the context to 160 characters around the span with an ellipsis", () => {
    const text = `${"word ".repeat(20)}target span${" word".repeat(20)}`;
    const units = [{ path: "a.md", line: 1, text }];
    const occurrence = extractNgrams(units, en, defaults).find((o) => o.key === "target span");
    expect(occurrence).toMatchObject({ position: 100, surface: "target span" });
    expect(occurrence?.context).toBe(`…${text.slice(25, 185)}…`);
    expect(occurrence?.context).toHaveLength(162);
  });

  it("marks only the cut side when the span sits near an edge of a long unit", () => {
    const text = `target span${" word".repeat(40)}`;
    const units = [{ path: "a.md", line: 1, text }];
    const occurrence = extractNgrams(units, en, defaults).find((o) => o.key === "target span");
    expect(occurrence?.context).toBe(`${text.slice(0, 160)}…`);
  });
});

describe("keywordForm", () => {
  it("tokenises a term like the texts, cutting hyphens and singularising", () => {
    expect(keywordForm("Cold-start Mentions", en)).toBe("cold start mention");
    expect(keywordForm("", en)).toBe("");
  });
});
