import { describe, expect, it } from "vitest";

import { byCodeUnit } from "../src/order.js";

describe("byCodeUnit", () => {
  it("orders by code unit, uppercase before lowercase, whatever the runtime collation", () => {
    expect(byCodeUnit("a", "b")).toBe(-1);
    expect(byCodeUnit("b", "a")).toBe(1);
    expect(byCodeUnit("a", "a")).toBe(0);
    expect(["b", "B", "a"].sort(byCodeUnit)).toEqual(["B", "a", "b"]);
  });
});
