import { describe, expect, it } from "vitest";

import {
  describeSchemaError,
  isWellFormedGlob,
  validateConfig,
} from "../../src/config/validate.js";

const minimal = {
  version: 1,
  project: { name: "Wiki" },
  sources: [{ name: "notes", path: "./notes" }],
};

function issuesOf(
  document: unknown,
): { path: string; message: string; severity: string; expected?: string }[] {
  return validateConfig(document).issues.map(({ path, message, severity, expected }) => ({
    path,
    message,
    severity,
    ...(expected === undefined ? {} : { expected }),
  }));
}

describe("validateConfig against the published schema", () => {
  it("accepts a minimal configuration and returns it typed", () => {
    const result = validateConfig(minimal);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.sources[0]?.name).toBe("notes");
      expect(result.issues).toEqual([]);
    }
  });

  it("reports every required key missing at the root", () => {
    expect(issuesOf({}).map((issue) => issue.path)).toEqual(["version", "project", "sources"]);
  });

  it("reports an unknown nested key", () => {
    expect(
      issuesOf({ ...minimal, project: { name: "W", colour: "red" } }).map((issue) => issue.path),
    ).toEqual(["project.colour"]);
  });

  it("reports the path of a missing required key", () => {
    expect(issuesOf({ version: 1, project: {}, sources: [{ name: "a", path: "." }] })).toEqual([
      { path: "project.name", message: "required key is missing", severity: "error" },
    ]);
  });

  it("reports an unknown key with the documented keys as expectation", () => {
    expect(issuesOf({ ...minimal, extra: true })).toEqual([
      {
        path: "extra",
        message: "unknown key",
        severity: "error",
        expected: "one of the documented keys",
      },
    ]);
  });

  it("reports a value outside an enumeration with the received and expected values", () => {
    const result = validateConfig({ ...minimal, applications: [{ id: "a", status: "gone" }] });
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([
      {
        severity: "error",
        path: "applications[0].status",
        message: "value is not allowed",
        received: "gone",
        expected: 'one of "active", "legacy", "target"',
      },
    ]);
  });

  it("accepts any BCP 47 language tag as a locale and rejects a malformed one", () => {
    expect(validateConfig({ ...minimal, project: { name: "W", locale: "fr-CA" } }).ok).toBe(true);
    expect(
      issuesOf({ ...minimal, project: { name: "W", locale: "French" } }).map((issue) => issue.path),
    ).toEqual(["project.locale"]);
  });

  it("reports a wrong schema version as a constant mismatch", () => {
    expect(issuesOf({ ...minimal, version: 2 })).toEqual([
      { path: "version", message: "value is not allowed", severity: "error", expected: "1" },
    ]);
  });

  it("reports a wrong type", () => {
    expect(issuesOf({ ...minimal, sources: "notes" })).toEqual([
      { path: "sources", message: "wrong type", severity: "error", expected: "array" },
    ]);
  });

  it("reports a value that does not match the expected format", () => {
    const [issue] = issuesOf({ ...minimal, sources: [{ name: "Notes!", path: "." }] });
    expect(issue).toMatchObject({
      path: "sources[0].name",
      message: "value does not match the expected format",
    });
    expect(issue?.expected).toMatch(/^a value matching /);
  });

  it("reports a source that is neither git, path nor tracker once, at the source", () => {
    const paths = issuesOf({ ...minimal, sources: [{ name: "a" }] }).map((issue) => issue.path);
    expect(paths).toEqual(["sources[0]"]);
  });

  it("falls back to the validator message for other keywords", () => {
    expect(issuesOf({ ...minimal, sources: [] })).toEqual([
      { path: "sources", message: "must NOT have fewer than 1 items", severity: "error" },
    ]);
  });

  it("reports a source that is both git and path once, at the source", () => {
    const issues = issuesOf({ ...minimal, sources: [{ name: "a", git: "x", path: "y" }] });
    expect(issues.map((issue) => issue.path)).toEqual(["sources[0]"]);
  });

  it("reports a plugin entry that is neither a name nor an object, without the branch details", () => {
    const issues = issuesOf({ ...minimal, plugins: [42] });
    expect(issues.map((issue) => `${issue.path}: ${issue.message}`)).toEqual([
      "plugins[0]: value matches none of the accepted shapes",
    ]);
  });

  it("names the array index in the path of a nested error", () => {
    expect(
      issuesOf({ ...minimal, domains: [{ id: "d", subdomains: [{ title: "no id" }] }] }),
    ).toEqual([
      {
        path: "domains[0].subdomains[0].id",
        message: "required key is missing",
        severity: "error",
      },
    ]);
  });
});

describe("validateConfig beyond the schema", () => {
  it("rejects a source declared twice under the same name", () => {
    const result = validateConfig({
      ...minimal,
      sources: [
        { name: "notes", path: "./a" },
        { name: "notes", path: "./b" },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([
      {
        severity: "error",
        path: "sources[1].name",
        message: "source name is already used by sources[0]",
        received: "notes",
        expected: "a unique name per source",
      },
    ]);
  });

  it("rejects a malformed domain glob, including in a subdomain", () => {
    const result = validateConfig({
      ...minimal,
      domains: [
        { id: "none" },
        { id: "a", match: ["**/{x"], subdomains: [{ id: "b", match: ["ok/**", "[bad"] }] },
      ],
    });
    expect(result.ok).toBe(false);
    expect(new Set(result.issues.map((issue) => issue.severity))).toEqual(new Set(["error"]));
    expect(result.issues.map((issue) => `${issue.path}=${String(issue.received)}`)).toEqual([
      "domains[1].match[0]=**/{x",
      "domains[1].subdomains[0].match[1]=[bad",
    ]);
  });

  it("accepts the lock key with a warning that it is ignored", () => {
    const result = validateConfig({ ...minimal, lock: "./concordance.lock.yaml" });
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([
      {
        severity: "warning",
        path: "lock",
        message: expect.stringContaining("accepted but ignored") as string,
      },
    ]);
  });

  it("accepts a tracker source with a warning that it is ignored", () => {
    const result = validateConfig({
      ...minimal,
      sources: [
        { name: "notes", path: "." },
        { name: "backlog", kind: "tracker", provider: "gitlab" },
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.issues.map((issue) => issue.path)).toEqual(["sources[1]"]);
  });
});

describe("describeSchemaError", () => {
  it("falls back to the keyword when the validator gives no message", () => {
    const issue = describeSchemaError(
      { keyword: "custom", instancePath: "/sources/0", schemaPath: "#/x", params: {} },
      { sources: [{ name: "a" }] },
    );
    expect(issue).toEqual({
      severity: "error",
      path: "sources[0]",
      message: "custom",
      received: { name: "a" },
    });
  });
});

describe("isWellFormedGlob", () => {
  it.each([
    ["**/payment*", true],
    ["{a,b}/**", true],
    ["[abc]*.md", true],
    ["**/{a", false],
    ["a}", false],
    ["[abc", false],
    ["a]", false],
    ["}{", false],
    ["][", false],
  ])("judges %s as %s", (pattern, expected) => {
    expect(isWellFormedGlob(pattern)).toBe(expected);
  });
});
