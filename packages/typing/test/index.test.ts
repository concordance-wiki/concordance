import type { Config } from "@concordance-wiki/core";
import type { ParsedMarkdown } from "@concordance-wiki/ingest";
import { describe, expect, it } from "vitest";

import * as entry from "../src/index.js";
import { typeSources } from "../src/index.js";
import { APPLICATIONS, document, DOMAINS, file, profile, source, sourceConfig } from "./helpers.js";

const config: Config = {
  version: 1,
  project: { name: "Wiki" },
  applications: APPLICATIONS,
  domains: DOMAINS,
  sources: [
    sourceConfig({ name: "glossary", type: "screen", application: "concordance-cli" }),
    sourceConfig({
      name: "specs",
      application: "concordance-cli",
      rules: [{ match: { suffix: ".rule.md" }, set: { type: "rule" } }],
    }),
  ],
};

function documents(entries: Record<string, ParsedMarkdown>): Map<string, ParsedMarkdown> {
  return new Map(Object.entries(entries));
}

describe("@concordance-wiki/typing", () => {
  it("exposes exactly its public API", () => {
    expect(Object.keys(entry).sort()).toEqual([
      "FALLBACK_TYPE",
      "UNCLASSIFIED_DOMAIN",
      "buildEntity",
      "compileDomains",
      "filingFindings",
      "resolveApplication",
      "resolveDomain",
      "resolveType",
      "ruleMatches",
      "typeSources",
      "typeSuffixesOf",
    ]);
  });
});

describe("typeSources", () => {
  it("builds one entity per parsed markdown file and skips the other files", () => {
    const files = [file("link-cap.rule.md"), file("diagram.png"), file("unreadable.md")];
    const result = typeSources({
      sources: [source("specs", files)],
      documents: documents({
        "specs/link-cap.rule.md": document({ title: "Related link cap" }),
        "specs/diagram.png": document(),
      }),
      config,
      profile: profile(),
    });
    expect(result.findings).toEqual([]);
    expect(result.entities).toEqual([
      {
        id: "specs/link-cap",
        type: "rule",
        title: "Related link cap",
        aliases: [],
        locale: "en",
        application: "concordance-cli",
        domain: "inference",
        status: "draft",
        type_origin: "suffix",
        graph: "full",
        attributes: {},
        source: {
          name: "specs",
          path: "link-cap.rule.md",
          line: 1,
          last_modified: "2026-03-12T10:00:00.000Z",
        },
      },
    ]);
  });

  it("resolves the domains declared globally on every source and files the rest as unclassified", () => {
    const result = typeSources({
      sources: [
        source("glossary", [file("link.md"), file("build.md")]),
        source("specs", [file("screens/keyword-page.md"), file("quality/staleness.md")]),
      ],
      documents: documents({
        "glossary/link.md": document(),
        "glossary/build.md": document(),
        "specs/screens/keyword-page.md": document(),
        "specs/quality/staleness.md": document(),
      }),
      config,
      profile: profile(),
    });
    expect(result.entities.map((entity) => [entity.id, entity.domain])).toEqual([
      ["glossary/build", "unclassified"],
      ["glossary/link", "inference"],
      ["specs/quality/staleness", "quality"],
      ["specs/screens/keyword-page", "inference/recognition"],
    ]);
    expect(result.findings.map((finding) => [finding.check, finding.entity])).toEqual([
      ["W-DOMAIN-UNCLASSIFIED", "glossary/build"],
    ]);
  });

  it("yields W-APP-MISSING for every entity of a source without an application", () => {
    const orphan: Config = {
      version: 1,
      project: { name: "Wiki" },
      sources: [sourceConfig({ name: "notes" })],
    };
    const result = typeSources({
      sources: [source("notes", [file("entity.md")])],
      documents: documents({ "notes/entity.md": document() }),
      config: orphan,
      profile: profile(),
    });
    expect(result.entities.map((entity) => [entity.application, entity.domain])).toEqual([
      [undefined, "unclassified"],
    ]);
    expect(result.findings.map((finding) => finding.check)).toEqual([
      "W-APP-MISSING",
      "W-DOMAIN-UNCLASSIFIED",
    ]);
  });

  it("resolves duplicate identifiers and keeps the first in (source, path) order", () => {
    const result = typeSources({
      sources: [source("specs", [file("link-cap.rule.md"), file("link-cap.md")])],
      documents: documents({
        "specs/link-cap.rule.md": document({ title: "Rule" }),
        "specs/link-cap.md": document({ title: "Note" }),
      }),
      config,
      profile: profile(),
    });
    expect(result.entities.map((entity) => [entity.id, entity.title])).toEqual([
      ["specs/link-cap", "Note"],
    ]);
    expect(result.findings.map((finding) => [finding.check, finding.path])).toEqual([
      ["E-ID-DUP", "link-cap.rule.md"],
    ]);
  });

  it("sorts the entities by identifier and the findings canonically", () => {
    const glossary = source("glossary", [file("z.md"), file("a.md")]);
    const specs = source("specs", [file("b.rule.md"), file("a.md")]);
    const result = typeSources({
      sources: [specs, glossary],
      documents: documents({
        "glossary/z.md": document({ frontmatter: { colour: "blue", domain: "quality" } }),
        "glossary/a.md": document({ frontmatter: { type: "regulation", domain: "quality" } }),
        "specs/b.rule.md": document({ frontmatter: { type: "screen", domain: "quality" } }),
        "specs/a.md": document({ frontmatter: { id: "Bad", domain: "quality" } }),
      }),
      config,
      profile: profile(),
    });
    expect(result.entities.map((entity) => entity.id)).toEqual([
      "glossary/a",
      "glossary/z",
      "specs/a",
      "specs/b",
    ]);
    expect(result.findings.map((finding) => [finding.check, finding.source, finding.path])).toEqual(
      [
        ["E-ID-INVALID", "specs", "a.md"],
        ["E-TYPE-CONFLICT", "specs", "b.rule.md"],
        ["W-ATTRIBUTE-UNKNOWN", "glossary", "z.md"],
        ["W-TYPE-UNKNOWN", "glossary", "a.md"],
      ],
    );
  });

  it("rejects an ingested source that the configuration does not declare", () => {
    const input = {
      sources: [source("meetings", [])],
      documents: documents({}),
      config,
      profile: profile(),
    };
    expect(() => typeSources(input)).toThrow(
      'ingested source "meetings" is not declared in the configuration',
    );
  });
});
