import { describe, expect, it } from "vitest";

import { comparisonKey, directoryProximity, jaroWinkler } from "../../src/duplicates/similarity.js";

describe("the comparison key", () => {
  it("lowercases, strips accents and folds punctuation to single spaces", () => {
    expect(comparisonKey("Payments_Workshop--2024 (Été)")).toBe("payments workshop 2024 ete");
  });

  it("is empty for a name made of punctuation only", () => {
    expect(comparisonKey("---")).toBe("");
  });
});

describe("the Jaro-Winkler similarity", () => {
  it("gives martha and marhta 0.9611", () => {
    expect(jaroWinkler("martha", "marhta")).toBeCloseTo(0.9611, 4);
  });

  it("gives dixon and dicksonx 0.8133", () => {
    expect(jaroWinkler("dixon", "dicksonx")).toBeCloseTo(0.8133, 4);
  });

  it("gives jellyfish and smellyfish 0.8963", () => {
    expect(jaroWinkler("jellyfish", "smellyfish")).toBeCloseTo(0.8963, 4);
  });

  it("gives 1 to identical strings and 0 when nothing matches or a string is empty", () => {
    expect(jaroWinkler("abc", "abc")).toBe(1);
    expect(jaroWinkler("ab", "ab")).toBe(1);
    expect(jaroWinkler("abc", "xyz")).toBe(0);
    expect(jaroWinkler("", "abc")).toBe(0);
    expect(jaroWinkler("abc", "")).toBe(0);
    expect(jaroWinkler("", "")).toBe(0);
  });

  it("caps the prefix bonus at four characters and stops it at the end of the shorter string", () => {
    expect(jaroWinkler("abcdefgh", "abcdefxy")).toBeCloseTo(0.9, 4);
    expect(jaroWinkler("ab", "abcd")).toBeCloseTo(0.8667, 4);
  });

  it("uses a match window that keeps distant characters apart", () => {
    expect(jaroWinkler("ab", "ba")).toBe(0);
    expect(jaroWinkler("abcd", "dcba")).toBeCloseTo(0.5, 4);
  });
});

describe("the directory proximity", () => {
  it("is 1 for the same folder, including the root", () => {
    expect(directoryProximity("a/b", "a/b")).toBe(1);
    expect(directoryProximity("", "")).toBe(1);
  });

  it("is the depth of the common prefix over the deeper folder", () => {
    expect(directoryProximity("a/b/c", "a/b/d")).toBeCloseTo(2 / 3, 6);
    expect(directoryProximity("a/b", "a/b/c/d")).toBe(0.5);
    expect(directoryProximity("a", "b")).toBe(0);
  });

  it("is 0 between the root and any folder", () => {
    expect(directoryProximity("", "a")).toBe(0);
    expect(directoryProximity("a/b", "")).toBe(0);
  });
});
