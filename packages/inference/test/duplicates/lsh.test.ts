import { describe, expect, it } from "vitest";

import { candidatePairs, LSH_ROWS } from "../../src/duplicates/lsh.js";
import { createMinHash } from "../../src/duplicates/minhash.js";

interface Item {
  name: string;
  signature: Uint32Array;
}

function item(name: string, values: number[]): Item {
  return { name, signature: Uint32Array.from(values) };
}

function names(pairs: [Item, Item][]): string[] {
  return pairs.map(([a, b]) => `${a.name}-${b.name}`);
}

describe("the LSH banding", () => {
  it("uses four rows per band", () => {
    expect(LSH_ROWS).toBe(4);
  });

  it("pairs the items that agree on one band, once, in item order", () => {
    const items = [
      item("a", [1, 2, 3, 4, 9, 9, 9, 9]),
      item("b", [1, 2, 3, 4, 5, 6, 7, 8]),
      item("c", [0, 0, 0, 0, 5, 6, 7, 8]),
      item("d", [1, 2, 3, 4, 5, 6, 7, 8]),
    ];
    expect(names(candidatePairs(items, (entry) => entry.signature, 4))).toEqual([
      "a-b",
      "a-d",
      "b-c",
      "b-d",
      "c-d",
    ]);
  });

  it("never pairs items that share no band", () => {
    const items = [item("a", [1, 2, 3, 4, 5, 6, 7, 8]), item("b", [1, 2, 3, 0, 5, 6, 7, 0])];
    expect(candidatePairs(items, (entry) => entry.signature, 4)).toEqual([]);
  });

  it("keeps a band of 1,23 apart from a band of 12,3", () => {
    const items = [item("a", [1, 23, 4, 5]), item("b", [12, 3, 4, 5])];
    expect(candidatePairs(items, (entry) => entry.signature, 4)).toEqual([]);
  });

  it("ignores the trailing functions that do not fill a band", () => {
    const items = [item("a", [1, 2, 3, 4, 7]), item("b", [1, 2, 3, 4, 8])];
    expect(names(candidatePairs(items, (entry) => entry.signature, 4))).toEqual(["a-b"]);
  });

  it("returns nothing without items", () => {
    expect(candidatePairs([], (entry: Item) => entry.signature)).toEqual([]);
  });

  it("brings together similar signatures of the default MinHash with 32 bands", () => {
    const minHash = createMinHash(128);
    const base = Array.from({ length: 60 }, (_, index) => `shingle ${String(index)}`);
    const items = [
      { name: "a", signature: minHash.signature(base) },
      { name: "b", signature: minHash.signature([...base.slice(5), "x", "y", "z"]) },
      { name: "c", signature: minHash.signature(["p", "q", "r"]) },
    ];
    expect(names(candidatePairs(items, (entry) => entry.signature))).toEqual(["a-b"]);
  });
});
