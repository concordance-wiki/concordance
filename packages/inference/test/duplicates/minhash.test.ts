import { describe, expect, it } from "vitest";

import { createMinHash, estimatedJaccard, MINHASH_SEED } from "../../src/duplicates/minhash.js";
import { exactJaccard, shingleSet } from "../../src/duplicates/shingles.js";
import { generator, normalize, perturb, randomText } from "./fixtures.js";

describe("the MinHash signature", () => {
  it("has one value per hash function and is all ones for an empty set", () => {
    const signature = createMinHash(8).signature([]);
    expect([...signature]).toEqual(Array.from({ length: 8 }, () => 0xffffffff));
  });

  it("is the same in two runs and for two orderings of the shingles", () => {
    const minHash = createMinHash(16);
    const first = minHash.signature(["a b", "c d", "e f"]);
    expect([...minHash.signature(["e f", "a b", "c d"])]).toEqual([...first]);
    expect([...createMinHash(16).signature(["a b", "c d", "e f"])]).toEqual([...first]);
  });

  it("changes with the seed and uses a fixed default seed", () => {
    const shingles = ["a b", "c d"];
    const defaulted = createMinHash(16).signature(shingles);
    expect([...createMinHash(16, MINHASH_SEED).signature(shingles)]).toEqual([...defaulted]);
    expect([...createMinHash(16, 7).signature(shingles)]).not.toEqual([...defaulted]);
  });

  it("gives the same values under the fixed seed from one release to the next", () => {
    expect([...createMinHash(4).signature(["a b"])]).toEqual([
      1335140397, 105271120, 3170369139, 1940499862,
    ]);
  });

  it("takes the minimum over the shingles for every function", () => {
    const minHash = createMinHash(8);
    const a = minHash.signature(["a b"]);
    const b = minHash.signature(["c d"]);
    const both = minHash.signature(["a b", "c d"]);
    both.forEach((value, index) => {
      expect(value).toBe(Math.min(a[index] ?? -1, b[index] ?? -1));
    });
  });
});

describe("the estimated Jaccard index", () => {
  it("is 1 for identical sets and 0 for disjoint ones", () => {
    const minHash = createMinHash(128);
    const a = minHash.signature(["a b", "c d", "e f"]);
    expect(estimatedJaccard(a, minHash.signature(["c d", "a b", "e f"]))).toBe(1);
    expect(estimatedJaccard(a, minHash.signature(["g h", "i j", "k l"]))).toBe(0);
  });

  it("stays within 0.1 of the exact index with 128 functions", () => {
    const random = generator(3);
    const minHash = createMinHash(128);
    const text = randomText(random, 300);
    const a = shingleSet(normalize(text), 5);
    const b = shingleSet(normalize(perturb(text, random, 12)), 5);
    const exact = exactJaccard(a, b);
    expect(exact).toBeGreaterThan(0.3);
    expect(exact).toBeLessThan(0.9);
    expect(
      Math.abs(estimatedJaccard(minHash.signature(a), minHash.signature(b)) - exact),
    ).toBeLessThan(0.1);
  });
});
