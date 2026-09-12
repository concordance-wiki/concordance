import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";

describe("@concordance-wiki/core", () => {
  it("exposes exactly its public API", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "PLUGIN_API_VERSION",
      "PluginDefinitionError",
      "PluginLoadError",
      "commandExists",
      "compareContracts",
      "compareEntities",
      "compareFindings",
      "compareLinks",
      "compareProvenances",
      "compileGlobs",
      "createSpeakerNumbering",
      "definePlugin",
      "describeSchemaError",
      "detectPersonalMentions",
      "epochClock",
      "fixedClock",
      "formatIssue",
      "formatValidation",
      "identifierFor",
      "importPlugin",
      "isWellFormedGlob",
      "loadPlugins",
      "loadPseudonymDictionary",
      "memoryFileSystem",
      "nodeFileSystem",
      "nodeGit",
      "pagePath",
      "pageUrl",
      "parseConfig",
      "pseudonymizeSpeaker",
      "pseudonymizeText",
      "pseudonymizeTranscript",
      "readSchema",
      "resolveDuplicates",
      "serializeBuildLog",
      "shouldFail",
      "slugify",
      "sortCanonically",
      "summarize",
      "systemClock",
      "transcriptsPublished",
      "validateConfig",
    ]);
  });
});
