import { describe, expect, it } from "vitest";

import { byCodeUnit, compareNeighbours } from "../../src/neighbourhood/order.js";

describe("the neighbour order", () => {
  it("compares identifiers by code unit", () => {
    expect(byCodeUnit("a", "b")).toBe(-1);
    expect(byCodeUnit("b", "a")).toBe(1);
    expect(byCodeUnit("a", "a")).toBe(0);
    // "Z" (0x5A) sorts before "a" (0x61), whatever the locale of the runtime says.
    expect(byCodeUnit("Z", "a")).toBe(-1);
  });

  it("puts the larger count first, then the lower identifier", () => {
    expect(compareNeighbours({ id: "b", count: 2 }, { id: "a", count: 1 })).toBe(-1);
    expect(compareNeighbours({ id: "a", count: 1 }, { id: "b", count: 2 })).toBe(1);
    expect(compareNeighbours({ id: "a", count: 1 }, { id: "b", count: 1 })).toBe(-1);
    expect(compareNeighbours({ id: "a", count: 1 }, { id: "a", count: 1 })).toBe(0);
  });
});
