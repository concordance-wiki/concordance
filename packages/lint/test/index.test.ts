import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";

describe("@concordance-wiki/lint", () => {
  it("exposes the local lint, its overrides and the report", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "DEFAULT_SOURCE_NAME",
      "LINT_CONFIG_FILE",
      "LintConfigError",
      "countBySeverity",
      "formatFinding",
      "formatFindings",
      "hasFindingAtOrAbove",
      "lintRepository",
      "parseLintConfig",
      "readLintOverrides",
    ]);
  });
});
