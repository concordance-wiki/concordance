import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";

describe("@concordance-wiki/core", () => {
  it("exposes exactly its public API", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "PLUGIN_API_VERSION",
      "PluginDefinitionError",
      "PluginLoadError",
      "commandExists",
      "compareEntities",
      "compareFindings",
      "compareLinks",
      "compareProvenances",
      "compileGlobs",
      "definePlugin",
      "describeSchemaError",
      "epochClock",
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
      "sortCanonically",
      "summarize",
      "systemClock",
      "validateConfig",
    ]);
  });
});
