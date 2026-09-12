import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";

describe("@concordance-wiki/checks", () => {
  it("pins its public exports", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "CheckRegistryError",
      "DOCUMENTATION_BASE_URL",
      "apiConsumerMismatch",
      "apiWithoutConsumer",
      "catalogue",
      "createRegistry",
      "documentationUrl",
      "isCheckId",
      "relationAmbiguous",
    ]);
  });
});
