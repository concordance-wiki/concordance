import { describe, expect, it } from "vitest";

import { formatIssue, formatValidation } from "../../src/config/report.js";

describe("formatIssue", () => {
  it("prints severity, file, path, message, received value and expectation", () => {
    expect(
      formatIssue(
        {
          severity: "error",
          path: "project.locale",
          message: "value is not allowed",
          received: "de",
          expected: "one of en, fr",
        },
        "c.yaml",
      ),
    ).toBe(
      'error: c.yaml: project.locale: value is not allowed; received "de"; expected one of en, fr',
    );
  });

  it("omits the path when the issue concerns the whole document", () => {
    expect(formatIssue({ severity: "error", path: "", message: "not valid YAML" }, "c.yaml")).toBe(
      "error: c.yaml: not valid YAML",
    );
  });

  it("shows non-string values as JSON", () => {
    expect(
      formatIssue({ severity: "warning", path: "version", message: "m", received: 2 }, "c"),
    ).toBe("warning: c: version: m; received 2");
  });
});

describe("formatValidation", () => {
  it("ends with the verdict and the error count", () => {
    expect(
      formatValidation(
        { ok: false, issues: [{ severity: "error", path: "a", message: "m" }] },
        "c",
      ),
    ).toEqual(["error: c: a: m", "c: 1 error(s)"]);
  });

  it("prints warnings before a valid verdict", () => {
    const validation = {
      ok: true as const,
      config: { version: 1 as const, project: { name: "W" }, sources: [] },
      issues: [{ severity: "warning" as const, path: "lock", message: "ignored" }],
    };
    expect(formatValidation(validation, "c")).toEqual([
      "warning: c: lock: ignored",
      "c: valid configuration",
    ]);
  });
});
