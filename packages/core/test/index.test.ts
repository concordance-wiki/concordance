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
      "identifierFor",
      "importPlugin",
      "isWellFormedGlob",
      "loadPlugins",
      "memoryFileSystem",
      "nodeFileSystem",
      "nodeGit",
      "pagePath",
      "pageUrl",
      "parseConfig",
      "readSchema",
      "resolveDuplicates",
      "serializeBuildLog",
      "shouldFail",
      "slugify",
      "summarize",
      "systemClock",
      "validateConfig",
    ]);
  });
});
