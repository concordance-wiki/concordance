import { describe, expect, it } from "vitest";

import { neighbourhoodToModel } from "../../src/neighbourhood/serialize.js";
import type { Neighbourhood } from "../../src/neighbourhood/types.js";

describe("the neighbours block of the model", () => {
  it("writes the keys in identifier order with the neighbours best first", () => {
    const neighbourhood: Neighbourhood = {
      k: 2,
      nodes: new Map([
        [
          "specs/rate",
          [
            { id: "specs/cap", count: 3 },
            { id: "specs/entry", count: 1 },
          ],
        ],
        ["specs/cap", [{ id: "specs/rate", count: 3 }]],
      ]),
    };
    const block = neighbourhoodToModel(neighbourhood);
    expect(Object.keys(block)).toEqual(["specs/cap", "specs/rate"]);
    expect(block).toEqual({
      "specs/cap": [{ id: "specs/rate", count: 3 }],
      "specs/rate": [
        { id: "specs/cap", count: 3 },
        { id: "specs/entry", count: 1 },
      ],
    });
  });

  it("copies the neighbours so that the model never aliases the accumulation", () => {
    const neighbour = { id: "specs/rate", count: 3 };
    const block = neighbourhoodToModel({ k: 1, nodes: new Map([["specs/cap", [neighbour]]]) });
    expect(block["specs/cap"]?.[0]).toEqual(neighbour);
    expect(block["specs/cap"]?.[0]).not.toBe(neighbour);
  });
});
