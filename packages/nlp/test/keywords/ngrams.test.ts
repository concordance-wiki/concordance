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
      { path: "notes/cap.md", line: 3, text: "Annual cap checked server side" },
      { path: "documents/minutes.md", line: 8, text: "Branch manager" },
    ];
    expect(keysOf(units)).toEqual([
      "annual",
      "annual cap",
      "annual cap checked",
      "annual cap checked server",
      "cap",
      "cap checked",
      "cap checked server",
      "cap checked server side",
      "checked",
      "checked server",
      "checked server side",
      "server",
      "server side",
      "side",
      "branch",
      "branch manager",
      "manager",
    ]);
  });

  it("starts at the configured shortest n-gram and stops at the longest", () => {
    const units = [{ path: "a.md", line: 1, text: "annual cap checked server side" }];
    expect(keysOf(units, { minWords: 2, maxWords: 3, minLength: 3 })).toEqual([
      "annual cap",
      "annual cap checked",
      "cap checked",
      "cap checked server",
      "checked server",
      "checked server side",
      "server side",
    ]);
  });

  it("excludes n-grams starting or ending with a stopword", () => {
    const units = [{ path: "a.md", line: 1, text: "the cap of the contract" }];
    expect(keysOf(units)).toEqual(["cap", "cap of the contract", "contract"]);
  });

  it("excludes n-grams starting or ending with a stopword of the French pack", () => {
    const units = [{ path: "a.md", line: 1, text: "Le plafond des versements" }];
    expect(keysOf(units, defaults, fr)).toEqual(["plafond", "plafond des versement", "versement"]);
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
    const units = [{ path: "a.md", line: 1, text: "FP VL api" }];
    expect(keysOf(units)).toEqual(["fp vl", "fp vl api", "vl api", "api"]);
    expect(extractNgrams(units, en, defaults)[3]).toStrictEqual({
      key: "api",
      surface: "api",
      path: "a.md",
      line: 1,
      position: 6,
      context: "FP VL api",
    });
  });

  it("keys each n-gram on its normalised, singularised words", () => {
    const units = [
      { path: "a.md", line: 1, text: "Exceptional payments" },
      { path: "b.md", line: 1, text: "exceptional payment" },
    ];
    const occurrences = extractNgrams(units, en, defaults);
    expect(occurrences.map((occurrence) => [occurrence.key, occurrence.surface])).toEqual([
      ["exceptional", "Exceptional"],
      ["exceptional payment", "Exceptional payments"],
      ["payment", "payments"],
      ["exceptional", "exceptional"],
      ["exceptional payment", "exceptional payment"],
      ["payment", "payment"],
    ]);
  });

  it("carries the surface form, the position and the source of every occurrence", () => {
    const units = [{ source: "specs", path: "a.md", line: 4, text: "In the Payments API." }];
    const occurrences = extractNgrams(units, en, { maxWords: 2, minLength: 3 });
    const expected: NgramOccurrence[] = [
      {
        key: "payment",
        surface: "Payments",
        source: "specs",
        path: "a.md",
        line: 4,
        position: 7,
        context: "In the Payments API.",
      },
      {
        key: "payment api",
        surface: "Payments API",
        source: "specs",
        path: "a.md",
        line: 4,
        position: 7,
        context: "In the Payments API.",
      },
      {
        key: "api",
        surface: "API",
        source: "specs",
        path: "a.md",
        line: 4,
        position: 16,
        context: "In the Payments API.",
      },
    ];
    expect(occurrences).toEqual(expected);
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
    expect(keywordForm("Server-side Payments", en)).toBe("server side payment");
    expect(keywordForm("", en)).toBe("");
  });
});
