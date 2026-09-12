import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";

describe("@concordance-wiki/cli", () => {
  it("exposes exactly its public API", () => {
    expect(Object.keys(entry).sort()).toEqual(["exitCodes", "main", "usage"]);
  });
});
