import { describe, expect, it } from "vitest";

import { readSchema } from "../../src/config/schema.js";
import { PLUGIN_API_VERSION } from "../../src/plugin/api.js";

describe("plugin API", () => {
  it("exposes a versioned plugin API with eight contribution points", () => {
    expect(PLUGIN_API_VERSION).toBe("1");
    const schema = readSchema("plugin") as {
      properties: { contributes: { properties: Record<string, unknown> } };
    };
    expect(Object.keys(schema.properties.contributes.properties)).toEqual([
      "readers",
      "converters",
      "sources",
      "inferenceMethods",
      "checks",
      "projections",
      "uiComponents",
      "themes",
    ]);
  });
});
