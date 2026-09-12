import { memoryFileSystem } from "@concordance-wiki/core";
import { describe, expect, it } from "vitest";

import { LintConfigError, parseLintConfig, readLintOverrides } from "../src/overrides.js";

describe("parseLintConfig", () => {
  it("reads the checks block", () => {
    expect(
      parseLintConfig(
        "checks:\n  W-STALE: { enabled: false }\n  W-TERM-UNUSED: { severity: info }\n",
      ),
    ).toEqual({
      ok: true,
      checks: { "W-STALE": { enabled: false }, "W-TERM-UNUSED": { severity: "info" } },
    });
  });

  it.each(["", "{}\n", "checks: {}\n"])("overrides nothing on %j", (text) => {
    expect(parseLintConfig(text)).toEqual({ ok: true, checks: {} });
  });

  it("rejects a file that is not valid YAML", () => {
    const result = parseLintConfig("checks: [\n");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => [issue.severity, issue.path])).toEqual([["error", ""]]);
      expect(result.issues[0]?.message).toMatch(/^not valid YAML: /);
    }
  });

  it("rejects a key that is not a check identifier", () => {
    expect(parseLintConfig("checks:\n  stale: { enabled: false }\n")).toEqual({
      ok: false,
      issues: [
        {
          severity: "error",
          path: "checks.stale",
          message: "key is not a check identifier",
          received: "stale",
        },
      ],
    });
  });

  it("rejects an unknown top-level key and a wrong override value", () => {
    expect(parseLintConfig("profile: x\nchecks:\n  W-STALE: { enabled: no }\n")).toEqual({
      ok: false,
      issues: [
        {
          severity: "error",
          path: "profile",
          message: "unknown key",
          expected: "one of the documented keys",
        },
        {
          severity: "error",
          path: "checks.W-STALE.enabled",
          message: "wrong type",
          received: "no",
          expected: "boolean",
        },
      ],
    });
  });
});

describe("readLintOverrides", () => {
  it("overrides nothing when the repository has no concordance-lint.yaml", () => {
    expect(readLintOverrides(memoryFileSystem({ "/repo/note.md": "# Note\n" }), "/repo")).toEqual(
      {},
    );
  });

  it("returns the overrides of the file at the root", () => {
    const fs = memoryFileSystem({
      "/repo/concordance-lint.yaml": "checks:\n  W-STALE: { severity: error }\n",
    });
    expect(readLintOverrides(fs, "/repo")).toEqual({ "W-STALE": { severity: "error" } });
  });

  it("throws an execution error naming the file and every issue", () => {
    const fs = memoryFileSystem({
      "/repo/concordance-lint.yaml": "checks:\n  stale: {}\n  W-X: 1\n",
    });
    let caught: unknown;
    try {
      readLintOverrides(fs, "/repo");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(LintConfigError);
    expect(caught).toMatchObject({
      name: "LintConfigError",
      message: [
        'error: /repo/concordance-lint.yaml: checks.stale: key is not a check identifier; received "stale"',
        "error: /repo/concordance-lint.yaml: checks.W-X: wrong type; received 1; expected object",
      ].join("\n"),
    });
  });
});
