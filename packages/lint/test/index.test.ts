import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";

describe("@concordance-wiki/lint", () => {
  it("exposes the local and global lints, their overrides, the safe fixes, the report and the machine formats", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "CACHE_META_FILE",
      "CACHE_MODEL_FILE",
      "CANONICAL_KEY_ORDER",
      "DEFAULT_CACHE_DIR",
      "DEFAULT_MAX_AGE_HOURS",
      "DEFAULT_SOURCE_NAME",
      "GLOBAL_CHECKS",
      "JUNIT_CLEAN_CASE",
      "JUNIT_SUITE_NAME",
      "LINT_CONFIG_FILE",
      "LOCAL_CHECKS",
      "LintConfigError",
      "OUTPUT_FORMATS",
      "REPOSITORY_URL",
      "SARIF_SCHEMA_URL",
      "SOURCE_ROOT_ID",
      "TOOL_NAME",
      "countBySeverity",
      "deduceType",
      "documentationOf",
      "fixRepository",
      "formatFinding",
      "formatFindings",
      "formatFindingsAs",
      "formatJson",
      "formatJunit",
      "formatSarif",
      "globalFindings",
      "hasFindingAtOrAbove",
      "isOutputFormat",
      "lintGlobal",
      "lintRepository",
      "loadPublishedModel",
      "locationOf",
      "mergeFindings",
      "normalizeFrontmatter",
      "parseLintConfig",
      "readLintConfig",
      "readLintOverrides",
      "resolveGlobalConfig",
      "rewriteRenamedLinks",
    ]);
  });
});
