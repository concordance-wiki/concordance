import { describe, expect, it } from "vitest";

import { displayedNeighbourhoodToModel } from "../../src/display/serialize.js";
import type { DisplayedNeighbour } from "../../src/display/types.js";

const rate: DisplayedNeighbour = {
  id: "specs/rate",
  title: "Rate",
  type: "screen",
  kind: "entity",
  relation: "reads",
  direction: "out",
  confidence: 0.9,
  rank: 2,
};
const cap: DisplayedNeighbour = { ...rate, id: "specs/cap", title: "Cap", direction: "in" };

describe("the displayed_neighbourhood block of the model", () => {
  it("writes the keys in identifier order with the neighbours best first", () => {
    const block = displayedNeighbourhoodToModel(
      new Map([
        ["specs/rate", [cap]],
        ["specs/alone", []],
        ["specs/cap", [rate]],
      ]),
    );
    expect(Object.keys(block)).toEqual(["specs/alone", "specs/cap", "specs/rate"]);
    expect(block).toEqual({ "specs/alone": [], "specs/cap": [rate], "specs/rate": [cap] });
  });

  it("carries the rank of every neighbour so that a panel can separate the priority groups", () => {
    const word: DisplayedNeighbour = {
      ...rate,
      id: "words/build-summary",
      kind: "keyword",
      rank: 6,
    };
    const block = displayedNeighbourhoodToModel(new Map([["specs/cap", [rate, word]]]));
    expect(block["specs/cap"]?.map((neighbour) => neighbour.rank)).toEqual([2, 6]);
  });

  it("copies the neighbours so that the model never aliases the computation", () => {
    const block = displayedNeighbourhoodToModel(new Map([["specs/cap", [rate]]]));
    expect(block["specs/cap"]?.[0]).toEqual(rate);
    expect(block["specs/cap"]?.[0]).not.toBe(rate);
  });
});
