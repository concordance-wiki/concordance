import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";

describe("@concordance-wiki/lint", () => {
  it("exposes the local lint, its overrides, the safe fixes, the report and the machine formats", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "CANONICAL_KEY_ORDER",
      "DEFAULT_SOURCE_NAME",
      "JUNIT_CLEAN_CASE",
      "JUNIT_SUITE_NAME",
      "LINT_CONFIG_FILE",
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
      "hasFindingAtOrAbove",
      "isOutputFormat",
      "lintRepository",
      "locationOf",
      "normalizeFrontmatter",
      "parseLintConfig",
      "readLintOverrides",
      "rewriteRenamedLinks",
    ]);
  });
});
