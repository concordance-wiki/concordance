import { describe, expect, it } from "vitest";

import {
  exactJaccard,
  normaliseText,
  sharedLines,
  shingleSet,
} from "../../src/duplicates/shingles.js";
import { normalize } from "./fixtures.js";

describe("the text normalisation", () => {
  it("keeps one comparison line per non-empty source line and counts words and characters", () => {
    const text = normaliseText("The Cap\r\n\r\nof the Related, cap!\n   \nthe end", normalize);
    expect(text).toEqual({
      lines: ["cap", "related cap", "end"],
      words: ["cap", "related", "cap", "end"],
      characters: "cap related cap end".length,
    });
  });

  it("is empty for a text without words", () => {
    expect(normaliseText("the of and", normalize)).toEqual({ lines: [], words: [], characters: 0 });
  });
});

describe("the shingle set", () => {
  it("holds every distinct run of consecutive words", () => {
    expect([...shingleSet(["a", "b", "c", "a", "b", "c", "d"], 3)]).toEqual([
      "a b c",
      "b c a",
      "c a b",
      "b c d",
    ]);
  });

  it("is empty for a text shorter than the shingle size", () => {
    expect(shingleSet(["a", "b"], 3).size).toBe(0);
  });
});

describe("the exact Jaccard index", () => {
  it("is the intersection over the union", () => {
    expect(exactJaccard(new Set(["a", "b", "c"]), new Set(["b", "c", "d", "e"]))).toBe(0.4);
  });

  it("is 0 when both sets are empty", () => {
    expect(exactJaccard(new Set(), new Set())).toBe(0);
  });
});

describe("the shared lines", () => {
  it("counts distinct lines in common over the distinct lines of both", () => {
    expect(sharedLines(["x", "y", "y"], ["y", "z"])).toBeCloseTo(1 / 3, 6);
  });
});
