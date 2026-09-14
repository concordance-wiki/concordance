import { describe, expect, it } from "vitest";

import { emergentDomainsOptions } from "../../src/domains/options.js";

describe("the emergent domain options", () => {
  it("are absent while the configuration has no inference.domains", () => {
    expect(emergentDomainsOptions()).toBeUndefined();
    expect(emergentDomainsOptions({})).toBeUndefined();
  });

  it("read the thresholds and leave assignment off unless asked", () => {
    expect(emergentDomainsOptions({ domains: { min_neighbours: 4, radius: 2 } })).toEqual({
      minNeighbours: 4,
      radius: 2,
      assign: false,
    });
    expect(
      emergentDomainsOptions({ domains: { min_neighbours: 1, radius: 3, assign: true } }),
    ).toEqual({ minNeighbours: 1, radius: 3, assign: true });
  });
});
