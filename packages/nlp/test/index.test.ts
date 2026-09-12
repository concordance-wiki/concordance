import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";

describe("@concordance-wiki/nlp", () => {
  it("exposes its entry point without any public export yet", () => {
    expect(Object.keys(entry)).toEqual([]);
  });
});
