import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";

describe("@concordance-wiki/profile", () => {
  it("exposes exactly its public API", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "MODULE_COMPONENTS_FOLDER",
      "MODULE_COMPONENT_PATTERN",
      "MODULE_DECLARATION_FILE",
      "MODULE_MESSAGES_FOLDER",
      "MODULE_SCHEMA_FILE",
      "MODULE_SOURCE_LANGUAGE",
      "MODULE_TEMPLATE_FILE",
      "TYPES_DIRECTORY_KEY",
      "TYPE_MESSAGE_KEYS",
      "allowedRelations",
      "defaultTypesDirectory",
      "fingerprintProfile",
      "loadDefaultProfile",
      "mergeProfiles",
      "neighbourOrder",
      "parseProfile",
      "readTypeModule",
      "readTypeModules",
      "resolveProfile",
      "singleRelation",
      "typeDefinitionOf",
      "typesDirectoryOf",
      "typesOf",
      "validateProfile",
    ]);
  });
});
