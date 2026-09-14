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

  it("names a check key that is not an identifier, at the key rather than at the checks block", () => {
    expect(issuesOf({ ...minimal, checks: { stale: { enabled: false } } })).toEqual([
      {
        path: "checks.stale",
        message: "key is not allowed",
        severity: "error",
        expected: "a value matching ^[EWI]-[A-Z0-9]+(-[A-Z0-9]+)*$",
      },
    ]);
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

  it("accepts a displayed neighbourhood size between 1 and 12 and returns it typed", () => {
    const result = validateConfig({ ...minimal, site: { neighbourhood: { size: 12 } } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.site?.neighbourhood?.size).toBe(12);
      expect(result.issues).toEqual([]);
    }
    expect(validateConfig({ ...minimal, site: { neighbourhood: { size: 1 } } }).ok).toBe(true);
  });

  it("rejects a displayed neighbourhood size above the cap of 12", () => {
    expect(issuesOf({ ...minimal, site: { neighbourhood: { size: 13 } } })).toEqual([
      { path: "site.neighbourhood.size", message: "must be <= 12", severity: "error" },
    ]);
  });

  it("rejects a displayed neighbourhood size below 1 or not an integer", () => {
    expect(issuesOf({ ...minimal, site: { neighbourhood: { size: 0 } } })).toEqual([
      { path: "site.neighbourhood.size", message: "must be >= 1", severity: "error" },
    ]);
    expect(issuesOf({ ...minimal, site: { neighbourhood: { size: 6.5 } } })).toEqual([
      {
        path: "site.neighbourhood.size",
        message: "wrong type",
        severity: "error",
        expected: "integer",
      },
    ]);
  });

  it("accepts the published address of the site and the days between two publications, typed", () => {
    const result = validateConfig({
      ...minimal,
      site: { url: "https://example.org/handbook/", publish_every_days: 1 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.site?.url).toBe("https://example.org/handbook/");
      expect(result.config.site?.publish_every_days).toBe(1);
      expect(result.issues).toEqual([]);
    }
  });

  it("rejects a site address that is not HTTPS and a publication cadence under a day", () => {
    expect(issuesOf({ ...minimal, site: { url: "http://example.org/" } })).toEqual([
      {
        path: "site.url",
        message: "value does not match the expected format",
        severity: "error",
        expected: "a value matching ^https://[^\\s]+$",
      },
    ]);
    expect(issuesOf({ ...minimal, site: { publish_every_days: 0 } })).toEqual([
      { path: "site.publish_every_days", message: "must be >= 1", severity: "error" },
    ]);
  });

  it("accepts inference.keyword_pages.min_confidence between 0 and 1 and rejects the rest", () => {
    for (const confidence of [0, 0.5, 0.8765, 1]) {
      const result = validateConfig({
        ...minimal,
        inference: { keyword_pages: { min_confidence: confidence } },
      });
      expect(result.ok, String(confidence)).toBe(true);
      if (result.ok) {
        expect(result.config.inference?.keyword_pages?.min_confidence).toBe(confidence);
      }
    }
    expect(
      issuesOf({ ...minimal, inference: { keyword_pages: { min_confidence: 1.01 } } }),
    ).toEqual([
      {
        path: "inference.keyword_pages.min_confidence",
        message: "must be <= 1",
        severity: "error",
      },
    ]);
    expect(
      issuesOf({ ...minimal, inference: { keyword_pages: { min_confidence: -0.1 } } }),
    ).toEqual([
      {
        path: "inference.keyword_pages.min_confidence",
        message: "must be >= 0",
        severity: "error",
      },
    ]);
  });

  it("accepts build.mentions_inline from zero up and rejects a negative or fractional count", () => {
    for (const count of [0, 1, 20, 500]) {
      const result = validateConfig({ ...minimal, build: { mentions_inline: count } });
      expect(result.ok, String(count)).toBe(true);
      if (result.ok) expect(result.config.build?.mentions_inline).toBe(count);
    }
    expect(issuesOf({ ...minimal, build: { mentions_inline: -1 } })).toEqual([
      { path: "build.mentions_inline", message: "must be >= 0", severity: "error" },
    ]);
    expect(issuesOf({ ...minimal, build: { mentions_inline: 2.5 } })).toEqual([
      {
        path: "build.mentions_inline",
        message: "wrong type",
        severity: "error",
        expected: "integer",
      },
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

  it("accepts a domain folder as true or as a single path segment, and rejects anything else", () => {
    expect(
      validateConfig({
        ...minimal,
        domains: [
          { id: "ingestion", folder: true, subdomains: [{ id: "readers", folder: "reader" }] },
          { id: "quality", folder: false, match: ["**/*check*"] },
          { id: "publication", folder: "site_v2.pages" },
        ],
      }).ok,
    ).toBe(true);
    const result = validateConfig({
      ...minimal,
      domains: [
        { id: "a", folder: "specs/ingestion", subdomains: [{ id: "b", folder: "" }] },
        { id: "c", folder: 3 },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([
      {
        severity: "error",
        path: "domains[0].folder",
        message: "value does not match the expected format",
        received: "specs/ingestion",
        expected: "a value matching ^[A-Za-z0-9._-]+$",
      },
      {
        severity: "error",
        path: "domains[0].subdomains[0].folder",
        message: "value does not match the expected format",
        received: "",
        expected: "a value matching ^[A-Za-z0-9._-]+$",
      },
      {
        severity: "error",
        path: "domains[1].folder",
        message: "wrong type",
        received: 3,
        expected: "boolean or string",
      },
    ]);
  });

  it("accepts an HTTPS contribute_url and rejects any other address", () => {
    expect(
      validateConfig({
        ...minimal,
        project: { name: "Wiki", contribute_url: "https://forge.example/notes/issues/new" },
      }).ok,
    ).toBe(true);
    const result = validateConfig({
      ...minimal,
      project: { name: "Wiki", contribute_url: "http://forge.example/notes" },
    });
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([
      {
        severity: "error",
        path: "project.contribute_url",
        message: "value does not match the expected format",
        received: "http://forge.example/notes",
        expected: "a value matching ^https://[^\\s]+$",
      },
    ]);
  });

  it("accepts the legal pages and the about file of a project, and rejects a status outside the three declared states, a plain HTTP address or a stray legal key", () => {
    expect(
      validateConfig({
        ...minimal,
        project: {
          name: "Wiki",
          about: "about.md",
          legal: {
            mentions_url: "https://forge.example/legal/mentions",
            accessibility_url: "https://forge.example/legal/accessibility",
            accessibility_status: "partially-compliant",
            privacy_url: "https://forge.example/legal/privacy",
          },
        },
      }).ok,
    ).toBe(true);
    expect(
      issuesOf({
        ...minimal,
        project: {
          name: "Wiki",
          about: "",
          legal: {
            accessibility_status: "conforming",
            privacy_url: "http://forge.example/legal/privacy",
            statement: "yes",
          },
        },
      }),
    ).toEqual([
      {
        severity: "error",
        path: "project.legal.statement",
        message: "unknown key",
        expected: "one of the documented keys",
      },
      {
        severity: "error",
        path: "project.legal.accessibility_status",
        message: "value is not allowed",
        expected: 'one of "non-compliant", "partially-compliant", "compliant"',
      },
      {
        severity: "error",
        path: "project.legal.privacy_url",
        message: "value does not match the expected format",
        expected: "a value matching ^https://[^\\s]+$",
      },
      {
        severity: "error",
        path: "project.about",
        message: "must NOT have fewer than 1 characters",
      },
    ]);
  });

  it("accepts a title and titled, described folders on a source, keyed by their path, and rejects an empty title, a stray key or a path with a slash at either end", () => {
    const result = validateConfig({
      ...minimal,
      sources: [
        {
          name: "specs",
          path: "./specs",
          title: "Specifications",
          folders: {
            screens: { title: "Screens", description: "What a reader sees, page by page." },
            "rules/links": { title: "Links" },
            "rules/vocabulary": { description: "The words the checks agree on." },
          },
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.sources[0]?.folders?.["rules/links"]).toEqual({ title: "Links" });
    }
    expect(
      issuesOf({
        ...minimal,
        sources: [
          {
            name: "specs",
            path: "./specs",
            title: "",
            folders: { "rules/": { title: "Rules" }, screens: { colour: "red" } },
          },
        ],
      }),
    ).toEqual([
      {
        path: "sources[0].title",
        message: "must NOT have fewer than 1 characters",
        severity: "error",
      },
      {
        path: "sources[0].folders.rules/",
        message: "key is not allowed",
        severity: "error",
        expected: "a value matching ^[^/\\s][^\\s]*[^/\\s]$|^[^/\\s]$",
      },
      {
        path: "sources[0].folders.screens.colour",
        message: "unknown key",
        severity: "error",
        expected: "one of the documented keys",
      },
    ]);
  });

  it("accepts the lock key with a warning saying which blocks of the file are applied", () => {
    const result = validateConfig({ ...minimal, lock: "./concordance.lock.yaml" });
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([
      {
        severity: "warning",
        path: "lock",
        message:
          "rejected_terms and duplicates of the lock file are applied; links are recorded, not read",
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

  it("does not publish transcripts by default and says nothing about it", () => {
    const result = validateConfig({ ...minimal, privacy: { exclude: ["**/private/**"] } });
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    if (result.ok) {
      expect(result.config.privacy?.publish_transcripts).toBeUndefined();
    }
  });

  it("warns when transcripts are published without pseudonymisation", () => {
    const result = validateConfig({ ...minimal, privacy: { publish_transcripts: true } });
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([
      {
        severity: "warning",
        path: "privacy.publish_transcripts",
        message:
          "transcripts are published without pseudonymisation: every speaker and every name is published as written",
      },
    ]);
  });

  it("warns when transcripts are published with pseudonymisation declared but not enabled", () => {
    const result = validateConfig({
      ...minimal,
      privacy: { publish_transcripts: true, pseudonymize: { dictionary: "./pseudonyms.yaml" } },
    });
    expect(result.ok).toBe(true);
    expect(result.issues.map((issue) => issue.path)).toEqual(["privacy.publish_transcripts"]);
  });

  it("lists the unpseudonymised publication after the ignored keys", () => {
    const result = validateConfig({
      ...minimal,
      lock: "./concordance.lock.yaml",
      privacy: { publish_transcripts: true },
    });
    expect(result.issues.map((issue) => issue.path)).toEqual([
      "lock",
      "privacy.publish_transcripts",
    ]);
  });

  it("says nothing when transcripts are published with pseudonymisation enabled", () => {
    const result = validateConfig({
      ...minimal,
      privacy: {
        publish_transcripts: true,
        pseudonymize: { enabled: true, dictionary: "./pseudonyms.yaml" },
      },
    });
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("says nothing when transcripts are kept out, pseudonymised or not", () => {
    expect(validateConfig({ ...minimal, privacy: { publish_transcripts: false } }).issues).toEqual(
      [],
    );
    expect(
      validateConfig({
        ...minimal,
        privacy: { pseudonymize: { enabled: true, dictionary: "./pseudonyms.yaml" } },
      }).issues,
    ).toEqual([]);
  });

  it("rejects pseudonymisation enabled without a dictionary", () => {
    const result = validateConfig({
      ...minimal,
      privacy: { publish_transcripts: true, pseudonymize: { enabled: true } },
    });
    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([
      {
        severity: "error",
        path: "privacy.pseudonymize.dictionary",
        message: "required key is missing when pseudonymize.enabled is true",
        expected: "the path of the pseudonyms file",
      },
    ]);
  });

  it("accepts pseudonymisation disabled without a dictionary", () => {
    const result = validateConfig({
      ...minimal,
      privacy: { pseudonymize: { enabled: false, keep_roles: true } },
    });
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("lists the missing dictionary after the other errors", () => {
    const result = validateConfig({
      ...minimal,
      domains: [{ id: "a", match: ["**/{x"] }],
      privacy: { pseudonymize: { enabled: true } },
    });
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.path)).toEqual([
      "domains[0].match[0]",
      "privacy.pseudonymize.dictionary",
    ]);
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
    ["**/keyword*", true],
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
