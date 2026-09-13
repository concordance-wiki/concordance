import { describe, expect, it } from "vitest";

import {
  SIMILAR_EXPRESSIONS_LIMIT,
  keywordForm,
  languagePack,
  similarExpressions,
  similarForm,
} from "../../src/index.js";

const pack = languagePack("en");

function keyed(...keys: string[]): { key: string }[] {
  return keys.map((key) => ({ key }));
}

describe("similarForm", () => {
  it("holds when one expression is a prefix, a suffix or an inner run of the other", () => {
    expect(similarForm("build summary", "build")).toBe(true);
    expect(similarForm("summary", "build summary")).toBe(true);
    expect(similarForm("keyword page threshold", "page")).toBe(true);
    expect(similarForm("build summary", "build summary")).toBe(true);
  });

  it("holds when the two share at least half of the distinct words of the longer one", () => {
    expect(similarForm("build summary", "build log")).toBe(true);
    expect(similarForm("keyword page threshold", "publication threshold page")).toBe(true);
    expect(similarForm("keyword page threshold", "threshold review")).toBe(false);
    expect(similarForm("summary line", "build summary")).toBe(true);
  });

  it("does not hold for expressions with no word in common, nor for a scattered match", () => {
    expect(similarForm("build summary", "cold start")).toBe(false);
    expect(similarForm("build the summary", "summary build")).toBe(true);
    expect(similarForm("a b c d", "a d")).toBe(true);
    expect(similarForm("a b c d", "a x")).toBe(false);
    expect(similarForm("a b c d", "a c")).toBe(true);
  });

  it("reads a contiguous run anywhere in the longer expression, and only a contiguous one, when few words are shared", () => {
    // Two of five words: the shared-words rule says nothing, containment alone decides.
    expect(similarForm("a b c d e", "c d")).toBe(true);
    expect(similarForm("a b c d e", "d e")).toBe(true);
    expect(similarForm("a b c d e", "a b")).toBe(true);
    expect(similarForm("a b c d e", "b d")).toBe(false);
    expect(similarForm("a b c d e", "d c")).toBe(false);
    expect(similarForm("a b c d e", "e f")).toBe(false);
    expect(similarForm("c d", "a b c d e")).toBe(true);
  });

  it("reads a plural and its singular alike once the keys are in comparison form", () => {
    expect(
      similarForm(keywordForm("Build summaries", pack), keywordForm("build summary", pack)),
    ).toBe(true);
    expect(keywordForm("Build summaries", pack)).toBe("build summary");
  });
});

describe("similarExpressions", () => {
  it("offers the expressions of a similar form, the closest first, then by key", () => {
    const candidates = keyed(
      "cold start",
      "summary",
      "build log",
      "build summary line",
      "build",
      "nightly build summary",
    );
    expect(similarExpressions("build summary", candidates).map((c) => c.key)).toEqual([
      "build summary line",
      "nightly build summary",
      "build",
      "summary",
      "build log",
    ]);
  });

  it("never offers the expression itself, lists each key once and stops at the limit", () => {
    const candidates = keyed("build summary", "build", "build", "summary", "build log");
    expect(similarExpressions("build summary", candidates).map((c) => c.key)).toEqual([
      "build",
      "summary",
      "build log",
    ]);
    const many = keyed(...Array.from({ length: 9 }, (_, i) => `build word${String(i)}`));
    expect(similarExpressions("build summary", many)).toHaveLength(SIMILAR_EXPRESSIONS_LIMIT);
    expect(SIMILAR_EXPRESSIONS_LIMIT).toBe(5);
    expect(similarExpressions("build summary", many, 2).map((c) => c.key)).toEqual([
      "build word0",
      "build word1",
    ]);
  });

  it("returns the candidates themselves, whatever else they carry, and nothing without a match", () => {
    const candidates = [
      { key: "build log", id: "glossary/build-log" },
      { key: "cold start", id: "keywords/cold-start" },
    ];
    expect(similarExpressions("build summary", candidates)).toEqual([candidates[0]]);
    expect(similarExpressions("cold", keyed("build summary"))).toEqual([]);
    expect(similarExpressions("cold", [])).toEqual([]);
  });

  it("gives the same list whatever the order of the candidates, keys breaking the ties of the overlap", () => {
    const candidates = keyed("summary", "build", "build log", "build summary line");
    const reversed = [...candidates].reverse();
    expect(similarExpressions("build summary", reversed)).toEqual(
      similarExpressions("build summary", candidates),
    );
    const tied = keyed("build zeta", "build delta", "build alpha", "build gamma");
    expect(similarExpressions("build summary", tied).map((c) => c.key)).toEqual([
      "build alpha",
      "build delta",
      "build gamma",
      "build zeta",
    ]);
    expect(similarExpressions("build summary", [...tied].reverse())).toEqual(
      similarExpressions("build summary", tied),
    );
  });
});
