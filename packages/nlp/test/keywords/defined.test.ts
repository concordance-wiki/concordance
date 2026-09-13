import { describe, expect, it } from "vitest";

import {
  definedExpressions,
  extractNgrams,
  languagePack,
  scoreCandidates,
  type DefinedExpressionsOptions,
  type KeywordUnit,
} from "../../src/index.js";

const pack = languagePack("en");
const defaults: DefinedExpressionsOptions = {
  pack,
  dictionaryKeys: new Set(["build summary"]),
  minOccurrences: 3,
  minDocuments: 2,
};

function unit(path: string, text: string, line = 1, source?: string): KeywordUnit {
  return { ...(source === undefined ? {} : { source }), path, line, text };
}

function defined(units: KeywordUnit[], options: Partial<DefinedExpressionsOptions> = {}) {
  const occurrences = extractNgrams(units, pack, { maxWords: 3, minLength: 3 });
  return definedExpressions(occurrences, { ...defaults, ...options });
}

const recurring = [
  unit("a.md", "The build summary is printed", 1, "specs"),
  unit("b.md", "Build summaries count pages", 4, "specs"),
  unit("c.md", "after the build summary", 2, "glossary"),
];

describe("definedExpressions", () => {
  it("lists the dictionary entries that reach the threshold with their counts, in key order", () => {
    expect(defined(recurring, { dictionaryKeys: new Set(["build summary", "Pages"]) })).toEqual([
      { key: "build summary", occurrences: 3, documents: 3 },
    ]);
    const units = [...recurring, unit("d.md", "pages and pages", 1, "specs")];
    expect(
      defined(units, {
        dictionaryKeys: new Set(["build summary", "Pages"]),
        minOccurrences: 3,
        minDocuments: 1,
      }),
    ).toEqual([
      { key: "build summary", occurrences: 3, documents: 3 },
      { key: "page", occurrences: 3, documents: 2 },
    ]);
  });

  it("sorts the expressions by key whatever the order they are met in", () => {
    const units = [
      unit("z.md", "pages and pages and pages", 1, "specs"),
      ...recurring,
      unit("y.md", "the alpha value", 1, "specs"),
      unit("x.md", "the alpha value", 1, "specs"),
      unit("w.md", "the alpha value", 1, "specs"),
    ];
    expect(
      defined(units, {
        dictionaryKeys: new Set(["Pages", "build summary", "alpha value"]),
        minDocuments: 1,
      }).map((expression) => expression.key),
    ).toEqual(["alpha value", "build summary", "page"]);
  });

  it("applies both thresholds: occurrences, and distinct files across sources", () => {
    expect(defined(recurring, { minOccurrences: 4 })).toEqual([]);
    expect(defined(recurring, { minDocuments: 4 })).toEqual([]);
    const sameFile = [
      unit("a.md", "build summary", 1, "specs"),
      unit("a.md", "build summary", 2, "specs"),
      unit("a.md", "build summary", 3, "glossary"),
    ];
    expect(defined(sameFile)).toEqual([{ key: "build summary", occurrences: 3, documents: 2 }]);
    expect(defined(sameFile, { minDocuments: 3 })).toEqual([]);
    const unsourced = sameFile.map(({ path, line, text }) => ({ path, line, text }));
    expect(defined(unsourced)).toEqual([]);
    expect(defined(unsourced, { minDocuments: 1 })).toEqual([
      { key: "build summary", occurrences: 3, documents: 1 },
    ]);
    // A unit without a source and a unit of the source named "" read the same file.
    const mixed = [unit("a.md", "build summary", 1, ""), ...unsourced];
    expect(defined(mixed, { minDocuments: 1 })).toEqual([
      { key: "build summary", occurrences: 4, documents: 1 },
    ]);
    expect(defined(mixed, { minDocuments: 2 })).toEqual([]);
  });

  it("names exactly the expressions the candidate scoring excludes for being defined", () => {
    const occurrences = extractNgrams(recurring, pack, { maxWords: 3, minLength: 3 });
    const candidates = scoreCandidates(occurrences, { ...defaults, rejected: new Set() });
    expect(candidates.map((candidate) => candidate.key)).not.toContain("build summary");
    expect(defined(recurring).map((expression) => expression.key)).toEqual(["build summary"]);
    expect(defined(recurring, { dictionaryKeys: new Set() })).toEqual([]);
  });
});
