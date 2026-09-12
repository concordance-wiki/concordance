import { describe, expect, it } from "vitest";

import { displayOptions } from "../../src/display/options.js";

describe("the display options", () => {
  it("shows 6 neighbours by default", () => {
    expect(displayOptions()).toEqual({ size: 6 });
    expect(displayOptions({})).toEqual({ size: 6 });
    expect(displayOptions({ neighbourhood: {} })).toEqual({ size: 6 });
  });

  it("reads the size from site.neighbourhood.size", () => {
    expect(displayOptions({ neighbourhood: { size: 9 } })).toEqual({ size: 9 });
  });
});
