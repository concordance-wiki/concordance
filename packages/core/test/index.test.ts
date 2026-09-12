import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";

describe("@concordance-wiki/core", () => {
  it("exposes exactly its public API", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "PLUGIN_API_VERSION",
      "PluginDefinitionError",
      "PluginLoadError",
      "commandExists",
      "compareFindings",
      "compileGlobs",
      "definePlugin",
      "describeSchemaError",
      "fixedClock",
      "formatIssue",
      "formatValidation",
      "importPlugin",
      "isWellFormedGlob",
      "loadPlugins",
      "memoryFileSystem",
      "nodeFileSystem",
      "nodeGit",
      "parseConfig",
      "readSchema",
      "systemClock",
      "validateConfig",
    ]);
  });
});
