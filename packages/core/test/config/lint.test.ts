import { describe, expect, it } from "vitest";

import {
  LintConfigError,
  parseLintConfig,
  readLintConfig,
  readLintOverrides,
} from "../../src/config/lint.js";
import { memoryFileSystem } from "../../src/io/file-system.js";

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
    expect(parseLintConfig(text)).toStrictEqual({ ok: true, checks: {} });
  });

  it("rejects a file that is not valid YAML, with the first line of the parser's message", () => {
    expect(parseLintConfig("checks: [\n")).toStrictEqual({
      ok: false,
      issues: [
        {
          severity: "error",
          path: "",
          message:
            "not valid YAML: Flow sequence in block collection must be sufficiently indented and end with a ] at line 2, column 1:",
        },
      ],
    });
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

  it("reads the global block next to the checks", () => {
    expect(
      parseLintConfig(
        "global:\n  model: https://wiki.example/model.json\n  cache_dir: .cache/lint\n  max_age_hours: 6\n  profile: profile.yaml\n",
      ),
    ).toEqual({
      ok: true,
      checks: {},
      global: {
        model: "https://wiki.example/model.json",
        cache_dir: ".cache/lint",
        max_age_hours: 6,
        profile: "profile.yaml",
      },
    });
  });

  it("rejects an unknown global key, an empty model and a negative validity", () => {
    expect(
      parseLintConfig("global:\n  model: ''\n  max_age_hours: -1\n  refresh: always\n"),
    ).toEqual({
      ok: false,
      issues: [
        {
          severity: "error",
          path: "global.refresh",
          message: "unknown key",
          expected: "one of the documented keys",
        },
        {
          severity: "error",
          path: "global.model",
          message: "must NOT have fewer than 1 characters",
          received: "",
        },
        {
          severity: "error",
          path: "global.max_age_hours",
          message: "must be >= 0",
          received: -1,
        },
      ],
    });
  });

  it("reads the excluded globs next to the checks", () => {
    expect(parseLintConfig("exclude:\n  - vendor/**\n  - '*.generated.md'\n")).toStrictEqual({
      ok: true,
      checks: {},
      exclude: ["vendor/**", "*.generated.md"],
    });
  });

  it("rejects an empty glob and a glob that is not a string", () => {
    expect(parseLintConfig("exclude: ['', 3]\n")).toEqual({
      ok: false,
      issues: [
        {
          severity: "error",
          path: "exclude[0]",
          message: "must NOT have fewer than 1 characters",
          received: "",
        },
        {
          severity: "error",
          path: "exclude[1]",
          message: "wrong type",
          received: 3,
          expected: "string",
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

describe("readLintConfig", () => {
  it("gives empty overrides and no global block when the repository has no concordance-lint.yaml", () => {
    expect(readLintConfig(memoryFileSystem({ "/repo/note.md": "# Note\n" }), "/repo")).toEqual({
      checks: {},
    });
  });

  it("returns the checks, the global block and the excluded globs of the file at the root", () => {
    const fs = memoryFileSystem({
      "/repo/concordance-lint.yaml":
        "checks:\n  W-STALE: { severity: error }\nglobal:\n  model: ../wiki/dist/model.json\nexclude: [vendor/**]\n",
    });
    expect(readLintConfig(fs, "/repo")).toEqual({
      checks: { "W-STALE": { severity: "error" } },
      global: { model: "../wiki/dist/model.json" },
      exclude: ["vendor/**"],
    });
  });

  it("leaves out the blocks the file does not carry", () => {
    const fs = memoryFileSystem({ "/repo/concordance-lint.yaml": "exclude: [vendor/**]\n" });
    expect(readLintConfig(fs, "/repo")).toStrictEqual({ checks: {}, exclude: ["vendor/**"] });
    fs.writeText("/repo/concordance-lint.yaml", "global: { model: model.json }\n");
    expect(readLintConfig(fs, "/repo")).toStrictEqual({
      checks: {},
      global: { model: "model.json" },
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
