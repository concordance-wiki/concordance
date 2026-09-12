import type { Entity, Finding } from "@concordance-wiki/core";
import { loadDefaultProfile } from "@concordance-wiki/profile";
import { describe, expect, it } from "vitest";

import { buildEntity, typeSuffixesOf, type BuildEntityInput } from "../src/entity.js";
import { document, file, MODIFIED_AT, profile, source, sourceConfig } from "./helpers.js";

const specs = sourceConfig({
  rules: [
    { match: { path: "screens/**" }, set: { type: "screen", audience: "internal" } },
    { match: { suffix: ".rule.md" }, set: { type: "rule" } },
  ],
});

function build(overrides: Partial<BuildEntityInput> = {}): { entity: Entity; findings: Finding[] } {
  const ingested = file("screens/free-payment-entry.md");
  return buildEntity({
    file: ingested,
    source: source("specs", [ingested]),
    sourceConfig: specs,
    document: document({ title: "Free payment entry" }),
    profile: profile(),
    ...overrides,
  });
}

describe("buildEntity", () => {
  it("derives the identifier from the path with the type suffixes stripped", () => {
    expect(build().entity.id).toBe("specs/screens/free-payment-entry");
    const rule = build({ file: file("rules/Annual cap.rule.md") });
    expect(rule.entity.id).toBe("specs/rules/annual-cap");
    expect(typeSuffixesOf(specs)).toEqual([".rule.md"]);
    expect(typeSuffixesOf(sourceConfig())).toEqual([]);
  });

  it("takes a valid frontmatter id over the path and reports an invalid one as E-ID-INVALID", () => {
    const valid = build({ document: document({ frontmatter: { id: "specs/entry" } }) });
    expect(valid.entity.id).toBe("specs/entry");
    expect(valid.findings).toEqual([]);
    const invalid = build({ document: document({ frontmatter: { id: "Entry" } }) });
    expect(invalid.entity.id).toBe("specs/screens/free-payment-entry");
    expect(invalid.findings.map((finding) => finding.check)).toEqual(["E-ID-INVALID"]);
  });

  it("takes the title from the frontmatter, then the H1, then the file name", () => {
    const fromFrontmatter = build({
      document: document({ title: "Free payment entry", frontmatter: { title: "Entry" } }),
    });
    expect(fromFrontmatter.entity.title).toBe("Entry");
    expect(build().entity.title).toBe("Free payment entry");
    const fromFile = build({ document: document({ frontmatter: { title: 3 } }) });
    expect(fromFile.entity.title).toBe("free-payment-entry");
    expect(build({ file: file("a.rule.md"), document: document() }).entity.title).toBe("a.rule");
  });

  it("keeps only the string aliases of the frontmatter", () => {
    expect(build().entity.aliases).toEqual([]);
    const strings = build({ document: document({ frontmatter: { aliases: ["FP", 3, "free"] } }) });
    expect(strings.entity.aliases).toEqual(["FP", "free"]);
    expect(
      build({ document: document({ frontmatter: { aliases: "FP" } }) }).entity.aliases,
    ).toEqual([]);
  });

  it("takes the status from the frontmatter or from the profile's common default", () => {
    expect(build().entity.status).toBe("draft");
    expect(build({ profile: loadDefaultProfile() }).entity.status).toBe("valid");
    const declared = build({ document: document({ frontmatter: { status: "obsolete" } }) });
    expect(declared.entity.status).toBe("obsolete");
    expect(build({ document: document({ frontmatter: { status: 1 } }) }).entity.status).toBe(
      "draft",
    );
  });

  it("falls back to valid when the profile declares no usable status default", () => {
    const withoutDefault = profile({ common_attributes: { status: { type: "enum" } } });
    expect(build({ profile: withoutDefault }).entity.status).toBe("valid");
    expect(build({ profile: profile({}, false) }).entity.status).toBe("valid");
    const notAString = profile({ common_attributes: { status: { type: "enum", default: 1 } } });
    expect(build({ profile: notAString }).entity.status).toBe("valid");
    const withoutStatus = profile({ common_attributes: { title: { type: "string" } } });
    expect(build({ profile: withoutStatus }).entity.status).toBe("valid");
  });

  it("takes the summary from the frontmatter, then the first paragraph, else none", () => {
    const paragraphs = [
      { line: 3, text: "Lets an account manager record a payment." },
      { line: 5, text: "Second paragraph." },
    ];
    const declared = build({
      document: document({ paragraphs, frontmatter: { summary: "Records a payment." } }),
    });
    expect(declared.entity.summary).toBe("Records a payment.");
    const first = build({ document: document({ paragraphs, frontmatter: { summary: 0 } }) });
    expect(first.entity.summary).toBe("Lets an account manager record a payment.");
    expect("summary" in build().entity).toBe(false);
  });

  it("keeps the frontmatter without the common keys over the rule defaults, keys sorted", () => {
    const frontmatter = {
      url_pattern: "/pay",
      title: "Entry",
      aliases: [],
      status: "valid",
      summary: "s",
      tags: ["a"],
      application: "policy-admin",
      domain: "payments",
      id: "specs/entry",
      type: "screen",
      audience: "public",
      roles: ["roles/account-manager"],
    };
    const built = build({ document: document({ frontmatter }) });
    expect(Object.keys(built.entity.attributes)).toEqual(["audience", "roles", "url_pattern"]);
    expect(built.entity.attributes).toEqual({
      audience: "public",
      roles: ["roles/account-manager"],
      url_pattern: "/pay",
    });
    expect(build().entity.attributes).toEqual({ audience: "internal" });
    expect(built.entity.application).toBeUndefined();
    expect(built.entity.domain).toBeUndefined();
  });

  it("copies the file location, its commit when known and its last change", () => {
    expect("commit" in build().entity.source).toBe(false);
    expect(build().entity.source).toEqual({
      name: "specs",
      path: "screens/free-payment-entry.md",
      line: 1,
      last_modified: MODIFIED_AT,
    });
    const committed = file("screens/free-payment-entry.md", "0123456789abcdef");
    expect(build({ file: committed }).entity.source).toEqual({
      name: "specs",
      path: "screens/free-payment-entry.md",
      line: 1,
      commit: "0123456789abcdef",
      last_modified: MODIFIED_AT,
    });
  });

  it("carries the locale of the source and the type origin", () => {
    const ingested = file("screens/a.md");
    const built = build({ file: ingested, source: source("specs", [ingested], "fr") });
    expect(built.entity.locale).toBe("fr");
    expect(built.entity.type).toBe("screen");
    expect(built.entity.type_origin).toBe("rule#1");
  });

  it("enters the graph through the documents relation only for document and meeting", () => {
    expect(build().entity.graph).toBe("full");
    const meeting = build({
      sourceConfig: sourceConfig({ default_type: "meeting" }),
      file: file("a.md"),
    });
    expect(meeting.entity.graph).toBe("documents-only");
    const untyped = build({ sourceConfig: sourceConfig(), file: file("a.md") });
    expect([untyped.entity.type, untyped.entity.graph]).toEqual(["document", "documents-only"]);
    const unknown = build({ document: document({ frontmatter: { type: "regulation" } }) });
    expect([unknown.entity.type, unknown.entity.graph]).toEqual(["document", "documents-only"]);
    expect(unknown.findings.map((finding) => finding.check)).toEqual(["W-TYPE-UNKNOWN"]);
  });

  it("enters the graph fully when the profile does not describe the resolved type", () => {
    const withoutDocument = profile({
      types: { screen: { label: { en: "Screen" }, group: "app" } },
    });
    const built = build({
      profile: withoutDocument,
      sourceConfig: sourceConfig(),
      file: file("a.md"),
    });
    expect([built.entity.type, built.entity.graph]).toEqual(["document", "full"]);
    expect(built.findings.map((finding) => finding.check)).toEqual(["W-TYPE-UNKNOWN"]);
  });

  it("reports W-ATTRIBUTE-UNKNOWN for a frontmatter attribute absent from the type schema and keeps it", () => {
    const frontmatter = {
      url_pattern: "/pay",
      colour: "blue",
      title: "Entry",
      id: "specs/entry",
      type: "screen",
      weight: 2,
    };
    const built = build({ document: document({ frontmatter }) });
    expect(built.entity.attributes).toEqual({
      audience: "internal",
      colour: "blue",
      url_pattern: "/pay",
      weight: 2,
    });
    expect(built.findings).toEqual([
      {
        check: "W-ATTRIBUTE-UNKNOWN",
        severity: "warning",
        source: "specs",
        path: "screens/free-payment-entry.md",
        entity: "specs/entry",
        message:
          'frontmatter attribute "colour" of screens/free-payment-entry.md is not declared for type screen; it is kept as-is',
        remediation:
          "Use an attribute of the type, declare it in the project profile, or remove the key.",
      },
      {
        check: "W-ATTRIBUTE-UNKNOWN",
        severity: "warning",
        source: "specs",
        path: "screens/free-payment-entry.md",
        entity: "specs/entry",
        message:
          'frontmatter attribute "weight" of screens/free-payment-entry.md is not declared for type screen; it is kept as-is',
        remediation:
          "Use an attribute of the type, declare it in the project profile, or remove the key.",
      },
    ]);
  });

  it("accepts the common attributes of the profile and the attributes of the type", () => {
    const frontmatter = { url_pattern: "/pay", roles: [], status: "valid", title: "Entry" };
    expect(build({ document: document({ frontmatter }) }).findings).toEqual([]);
    const withDefaults = build({
      profile: loadDefaultProfile(),
      document: document({ frontmatter: { ...frontmatter, tags: ["a"], superseded_by: "x" } }),
    });
    expect(withDefaults.findings).toEqual([]);
  });

  it("checks the attributes against the common ones only when the profile declares none for the type", () => {
    const bare = profile(
      { types: { document: { label: { en: "Document" }, group: "source" } } },
      false,
    );
    const built = build({
      profile: bare,
      sourceConfig: sourceConfig(),
      file: file("a.md"),
      document: document({ frontmatter: { id: "specs/a", type: "document", title: "A" } }),
    });
    expect(built.findings.map((finding) => finding.message)).toEqual([
      'frontmatter attribute "title" of a.md is not declared for type document; it is kept as-is',
    ]);
  });
});
