import { describe, expect, it } from "vitest";

import { compareNeighbours } from "../../src/neighbourhood/order.js";

describe("the neighbour order", () => {
  it("puts the larger count first, then the lower identifier", () => {
    expect(compareNeighbours({ id: "b", count: 2 }, { id: "a", count: 1 })).toBe(-1);
    expect(compareNeighbours({ id: "a", count: 1 }, { id: "b", count: 2 })).toBe(1);
    expect(compareNeighbours({ id: "a", count: 1 }, { id: "b", count: 1 })).toBe(-1);
    expect(compareNeighbours({ id: "a", count: 1 }, { id: "a", count: 1 })).toBe(0);
  });
});
