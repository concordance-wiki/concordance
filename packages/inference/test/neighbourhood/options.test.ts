import { describe, expect, it } from "vitest";

import { neighbourhoodOptions } from "../../src/neighbourhood/options.js";

describe("the neighbourhood options", () => {
  it("keeps 50 neighbours by default", () => {
    expect(neighbourhoodOptions()).toEqual({ k: 50 });
    expect(neighbourhoodOptions({})).toEqual({ k: 50 });
    expect(neighbourhoodOptions({ neighbours: {} })).toEqual({ k: 50 });
  });

  it("reads K from inference.neighbours.k", () => {
    expect(neighbourhoodOptions({ neighbours: { k: 7 } })).toEqual({ k: 7 });
  });
});
